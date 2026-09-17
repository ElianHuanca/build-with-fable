"""
Fase 4 del plan v5 — Entrenamiento del clasificador de especie (Etapa B).

Recibe RECORTES de mosquito (los produce la consolidación; en producción los produce el
detector) y decide la clase: aegypti, albopictus, anopheles, culex, otro_mosquito,
no_es_mosquito.

Corre en Kaggle con GPU. Lee la salida del notebook de consolidación montada como Input.

Decisiones que importan (ver PLAN_V5 §6):
- Augmentación fuerte de LUZ y de CAPTURA (compresión JPEG, ruido, rotación completa) para la
  brecha laboratorio↔campo; y deliberadamente SIN blur fuerte, escala de grises ni cambios de
  tono grandes: borran el dibujo del tórax y las bandas de las patas, que son justo los rasgos
  que separan aegypti de albopictus.
- El preprocesado de evaluación (letterbox a 224 sin deformar) se guarda en preprocesado.json:
  el Pi y el celular DEBEN replicarlo idéntico o la precisión medida acá no vale.
- La cuantización INT8 se VERIFICA contra el test: puede costar puntos de precisión en silencio.
"""

from __future__ import annotations

import json
import math
import os
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np

TRABAJO = Path("/kaggle/working")
SALIDA = TRABAJO / "clasificador-v1"

# MobileNetV4-Conv-Small: ~10 ms por recorte en Cortex-A72 INT8 (a medir en el Pi real).
# Fallbacks por si la versión de timm instalada no trae los pesos.
MODELOS = [
    "mobilenetv4_conv_small.e2400_r224_in1k",
    "tf_efficientnet_lite0.in1k",
    "mobilenetv3_small_100.lamb_in1k",
]
IMG = 224
EPOCHS = 40
PATIENCE = 8               # early stopping sobre macro-F1 de validación
BATCH = 128
LR = 1e-3
WEIGHT_DECAY = 0.05
LABEL_SMOOTHING = 0.1
SEMILLA = 1312

# Criterios de aceptación de la Fase 4 (PLAN_V5 §8).
F1_MACRO_MINIMO = 0.85
RECALL_POR_CLASE_MINIMO = 0.80
# Si la versión INT8 pierde más que esto frente a FP32, NO se recomienda para producción.
PERDIDA_INT8_MAXIMA = 0.02

MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def buscar_entrada() -> Path:
    for p in Path("/kaggle/input").rglob("mosquito-merged-v1/clasificador"):
        if (p / "train").is_dir():
            return p
    raise SystemExit(
        "No se encontró mosquito-merged-v1/clasificador en /kaggle/input.\n"
        "Add Input → Notebook Output → dengue-invaders-consolidacion-dataset (última versión OK)."
    )


def fijar_semillas() -> None:
    import torch

    random.seed(SEMILLA)
    np.random.seed(SEMILLA)
    torch.manual_seed(SEMILLA)
    torch.cuda.manual_seed_all(SEMILLA)


def configurar_wandb():
    try:
        from kaggle_secrets import UserSecretsClient
        import wandb

        wandb.login(key=UserSecretsClient().get_secret("WANDB_API_KEY"))
        return wandb.init(project="dengue-invaders-mosquitos", job_type="clasificador")
    except Exception:                                          # noqa: BLE001
        return None


# --------------------------------------------------------------------------------------
# Datos
# --------------------------------------------------------------------------------------


def transformaciones():
    import albumentations as A
    import cv2
    from albumentations.pytorch import ToTensorV2

    # Letterbox: el recorte de un mosquito no es cuadrado; estirarlo deformaría las proporciones
    # del cuerpo (que ayudan a separar Anopheles). Se replica igual en producción.
    base = [
        A.LongestMaxSize(max_size=IMG),
        A.PadIfNeeded(min_height=IMG, min_width=IMG, border_mode=cv2.BORDER_CONSTANT, fill=0),
    ]
    norm = [A.Normalize(mean=MEAN, std=STD), ToTensorV2()]

    entrenamiento = A.Compose(
        base
        + [
            # Geometría: en una trampa el mosquito aparece en cualquier orientación.
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.5),
            A.Affine(rotate=(-180, 180), scale=(0.85, 1.15), translate_percent=(-0.06, 0.06),
                     border_mode=cv2.BORDER_CONSTANT, fill=0, p=0.8),
            # Luz: la parte más importante contra la brecha laboratorio↔campo.
            A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.7),
            A.RandomGamma(gamma_limit=(70, 140), p=0.3),
            A.CLAHE(clip_limit=2.0, p=0.15),
            # Tono SUAVE a propósito (ver docstring): un cambio grande vuelve marrón un Aedes.
            A.HueSaturationValue(hue_shift_limit=5, sat_shift_limit=20, val_shift_limit=20, p=0.4),
            # Captura real: WhatsApp, sensores baratos, pulso.
            A.ImageCompression(quality_range=(40, 95), p=0.5),
            A.OneOf([A.GaussNoise(std_range=(0.02, 0.08)), A.ISONoise()], p=0.3),
            A.MotionBlur(blur_limit=(3, 5), p=0.15),          # leve: blur fuerte borra el tórax
            A.CoarseDropout(num_holes_range=(1, 3), hole_height_range=(0.05, 0.12),
                            hole_width_range=(0.05, 0.12), fill=0, p=0.2),
        ]
        + norm
    )
    evaluacion = A.Compose(base + norm)
    return entrenamiento, evaluacion


class Recortes:
    def __init__(self, raiz: Path, clases: list[str], transform):
        self.transform = transform
        self.items = [
            (str(p), i)
            for i, c in enumerate(clases)
            for p in sorted((raiz / c).glob("*"))
            if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
        ]

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, idx: int):
        import cv2

        ruta, etiqueta = self.items[idx]
        img = cv2.cvtColor(cv2.imread(ruta), cv2.COLOR_BGR2RGB)
        return self.transform(image=img)["image"], etiqueta


def cargadores(entrada: Path, clases: list[str]):
    import torch
    from torch.utils.data import DataLoader, WeightedRandomSampler

    t_train, t_eval = transformaciones()
    ds = {
        "train": Recortes(entrada / "train", clases, t_train),
        "valid": Recortes(entrada / "valid", clases, t_eval),
        "test": Recortes(entrada / "test", clases, t_eval),
    }

    # Desbalance (albopictus ≈ 4× anopheles): muestreo con peso ∝ 1/sqrt(frecuencia).
    # 1/frecuencia pura sobre-repite las clases chicas hasta memorizarlas; la raíz es un punto medio.
    conteo = Counter(e for _, e in ds["train"].items)
    pesos = [1.0 / math.sqrt(conteo[e]) for _, e in ds["train"].items]
    sampler = WeightedRandomSampler(pesos, num_samples=len(pesos), replacement=True)

    workers = min(4, os.cpu_count() or 2)
    return ds, {
        "train": DataLoader(ds["train"], batch_size=BATCH, sampler=sampler, num_workers=workers,
                            pin_memory=True, drop_last=True, persistent_workers=True),
        "valid": DataLoader(ds["valid"], batch_size=BATCH * 2, num_workers=workers, pin_memory=True),
        "test": DataLoader(ds["test"], batch_size=BATCH * 2, num_workers=workers, pin_memory=True),
    }, dict(conteo)


# --------------------------------------------------------------------------------------
# Modelo
# --------------------------------------------------------------------------------------


def crear_modelo(n_clases: int):
    import timm

    for nombre in MODELOS:
        try:
            m = timm.create_model(nombre, pretrained=True, num_classes=n_clases)
            print(f"Modelo base: {nombre}")
            return m, nombre
        except Exception as e:                                 # noqa: BLE001
            print(f"  {nombre} no disponible ({type(e).__name__}), pruebo el siguiente")
    raise SystemExit("Ningún modelo base disponible en timm.")


def predecir(modelo, loader, device) -> tuple[np.ndarray, np.ndarray]:
    import torch

    modelo.eval()
    y_true, y_pred = [], []
    with torch.no_grad(), torch.autocast("cuda", dtype=torch.float16):
        for x, y in loader:
            y_pred.append(modelo(x.to(device, non_blocking=True)).argmax(1).cpu().numpy())
            y_true.append(y.numpy())
    return np.concatenate(y_true), np.concatenate(y_pred)


def metricas(y_true, y_pred, clases: list[str]) -> dict:
    from sklearn.metrics import classification_report, confusion_matrix, f1_score

    reporte = classification_report(y_true, y_pred, target_names=clases, output_dict=True,
                                    zero_division=0)
    return {
        "accuracy": float(reporte["accuracy"]),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro")),
        "recall_por_clase": {c: round(float(reporte[c]["recall"]), 4) for c in clases},
        "precision_por_clase": {c: round(float(reporte[c]["precision"]), 4) for c in clases},
        "matriz_confusion": confusion_matrix(y_true, y_pred).tolist(),
    }


def entrenar(modelo, loaders, device, run):
    import torch

    opt = torch.optim.AdamW(modelo.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    pasos = EPOCHS * len(loaders["train"])
    calentamiento = 2 * len(loaders["train"])

    def lr_lambda(paso):
        if paso < calentamiento:
            return (paso + 1) / calentamiento
        prog = (paso - calentamiento) / max(1, pasos - calentamiento)
        return 0.5 * (1 + math.cos(math.pi * prog))

    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_lambda)
    crit = torch.nn.CrossEntropyLoss(label_smoothing=LABEL_SMOOTHING)
    scaler = torch.amp.GradScaler("cuda")

    mejor_f1, sin_mejora = -1.0, 0
    ruta_mejor = SALIDA / "clasificador.pt"
    from sklearn.metrics import f1_score

    for epoca in range(1, EPOCHS + 1):
        modelo.train()
        t0, perdida_total = time.time(), 0.0
        for x, y in loaders["train"]:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.autocast("cuda", dtype=torch.float16):
                perdida = crit(modelo(x), y)
            scaler.scale(perdida).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            perdida_total += perdida.item()

        yt, yp = predecir(modelo, loaders["valid"], device)
        f1 = f1_score(yt, yp, average="macro")
        perdida_media = perdida_total / len(loaders["train"])
        print(f"época {epoca:2d}  loss {perdida_media:.4f}  val F1-macro {f1:.4f}  ({time.time() - t0:.0f}s)")
        if run:
            run.log({"epoca": epoca, "loss": perdida_media, "val_f1_macro": f1, "lr": sched.get_last_lr()[0]})

        if f1 > mejor_f1:
            mejor_f1, sin_mejora = f1, 0
            torch.save(modelo.state_dict(), ruta_mejor)
        else:
            sin_mejora += 1
            if sin_mejora >= PATIENCE:
                print(f"Early stopping: {PATIENCE} épocas sin mejorar.")
                break

    modelo.load_state_dict(torch.load(ruta_mejor, map_location=device))
    return mejor_f1


# --------------------------------------------------------------------------------------
# Exportación
# --------------------------------------------------------------------------------------


def exportar(modelo, ds_valid, ds_test, clases) -> dict:
    """ONNX FP32 + ONNX INT8 (cuantización estática calibrada) y, si se puede, TFLite INT8.
    La INT8 se evalúa contra el test: si pierde demasiado, queda marcada como no recomendada."""
    import torch
    import onnxruntime as ort
    from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static

    resultado: dict = {}
    modelo = modelo.float().cpu().eval()
    fp32 = SALIDA / "clasificador_fp32.onnx"
    torch.onnx.export(
        modelo, torch.randn(1, 3, IMG, IMG), fp32, opset_version=13,
        input_names=["imagen"], output_names=["logits"],
        dynamic_axes={"imagen": {0: "lote"}, "logits": {0: "lote"}},
        # dynamo=False: en esta versión de PyTorch el exportador "dynamo" es el default y
        # requiere el paquete `onnxscript`, que no viene en la imagen de Kaggle — tumbó una
        # corrida entera DESPUÉS de 40 épocas de entrenamiento (2026-09-16). El exportador
        # clásico (TorchScript) no lo necesita y es suficiente para este modelo.
        dynamo=False,
    )
    resultado["onnx_fp32"] = fp32.name

    class Calibracion(CalibrationDataReader):
        def __init__(self, n=512):
            idx = random.Random(SEMILLA).sample(range(len(ds_valid)), min(n, len(ds_valid)))
            self.datos = iter([{"imagen": ds_valid[i][0].unsqueeze(0).numpy()} for i in idx])

        def get_next(self):
            return next(self.datos, None)

    int8 = SALIDA / "clasificador_int8.onnx"
    try:
        from onnxruntime.quantization.shape_inference import quant_pre_process

        pre = SALIDA / "_pre.onnx"
        quant_pre_process(str(fp32), str(pre))
        quantize_static(str(pre), str(int8), Calibracion(), quant_format=QuantFormat.QDQ,
                        per_channel=True, activation_type=QuantType.QUInt8,
                        weight_type=QuantType.QInt8)
        pre.unlink(missing_ok=True)
        resultado["onnx_int8"] = int8.name
    except Exception as e:                                     # noqa: BLE001
        resultado["onnx_int8"] = f"FALLÓ: {type(e).__name__}: {e}"

    # Verificación FP32 vs INT8 en el test, con ONNX Runtime en CPU (lo mismo que correrá en el Pi).
    def acc_onnx(ruta: Path) -> float:
        sess = ort.InferenceSession(str(ruta), providers=["CPUExecutionProvider"])
        aciertos = 0
        for i in range(len(ds_test)):
            x, y = ds_test[i]
            aciertos += int(sess.run(None, {"imagen": x.unsqueeze(0).numpy()})[0].argmax() == y)
        return aciertos / len(ds_test)

    resultado["test_acc_onnx_fp32"] = round(acc_onnx(fp32), 4)
    if int8.exists():
        resultado["test_acc_onnx_int8"] = round(acc_onnx(int8), 4)
        perdida = resultado["test_acc_onnx_fp32"] - resultado["test_acc_onnx_int8"]
        resultado["perdida_por_int8"] = round(perdida, 4)
        resultado["int8_recomendado"] = perdida <= PERDIDA_INT8_MAXIMA

    # TFLite (para Pi de 32 bits sin ONNX Runtime, y Android). Best effort, aislado a propósito:
    # onnx2tf arrastra tensorflow/numpy y una vez desalineó numpy/scipy en la imagen de Kaggle,
    # tumbando el notebook entero DESPUÉS de entrenar (2026-09-16). Ya con el modelo entrenado y
    # evaluado, cualquier lío de esta instalación queda contenido acá y no pierde la corrida.
    try:
        import subprocess

        subprocess.run(["pip", "install", "-q", "onnx2tf"], check=True, capture_output=True, timeout=600)
        subprocess.run(["onnx2tf", "-i", str(fp32), "-o", str(SALIDA / "tflite"), "-oiqt", "-qt", "per-tensor"],
                       check=True, capture_output=True, timeout=1800)
        resultado["tflite"] = sorted(p.name for p in (SALIDA / "tflite").glob("*.tflite"))
    except Exception as e:                                     # noqa: BLE001
        resultado["tflite"] = f"FALLÓ (no bloqueante, no es ONNX Runtime que es el runtime real del Pi): {type(e).__name__}"
    return resultado


def main() -> None:
    import torch

    if not torch.cuda.is_available():
        raise SystemExit("Sin GPU. Settings → Accelerator → GPU T4 x2 (o P100).")
    fijar_semillas()
    SALIDA.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda")
    run = configurar_wandb()
    print(f"GPU: {torch.cuda.get_device_name(0)} · W&B: {'activo' if run else 'desactivado'}")

    entrada = buscar_entrada()
    clases = sorted(d.name for d in (entrada / "train").iterdir()
                    if d.is_dir() and any(d.iterdir()))
    print(f"Clases ({len(clases)}): {clases}")
    ds, loaders, conteo = cargadores(entrada, clases)
    print(f"train {len(ds['train'])} · valid {len(ds['valid'])} · test {len(ds['test'])}")
    print(f"distribución train: {conteo}")

    modelo, base = crear_modelo(len(clases))
    modelo = modelo.to(device).to(memory_format=torch.channels_last)
    mejor_val = entrenar(modelo, loaders, device, run)

    # Test congelado: se mira UNA vez, con el mejor checkpoint elegido por validación.
    yt, yp = predecir(modelo, loaders["test"], device)
    test = metricas(yt, yp, clases)
    objetivo = [c for c in ["aegypti", "albopictus", "anopheles", "culex"] if c in clases]
    cumple = (test["f1_macro"] >= F1_MACRO_MINIMO
              and all(test["recall_por_clase"][c] >= RECALL_POR_CLASE_MINIMO for c in clases))

    (SALIDA / "etiquetas.json").write_text(json.dumps(clases, ensure_ascii=False))
    (SALIDA / "preprocesado.json").write_text(json.dumps({
        "entrada": [1, 3, IMG, IMG], "formato": "RGB, NCHW, float32",
        "redimension": f"letterbox: lado mayor a {IMG}, relleno negro centrado hasta {IMG}x{IMG}",
        "normalizacion": {"mean": MEAN, "std": STD, "escala": "píxel/255 antes de normalizar"},
        "salida": "logits → softmax → índice en etiquetas.json",
    }, indent=2, ensure_ascii=False))

    resumen = {
        "modelo_base": base,
        "clases": clases,
        "val_f1_macro_mejor": round(mejor_val, 4),
        "test": test,
        "clases_objetivo": objetivo,
        "cumple_criterio_fase4": cumple,
        "criterios": {"f1_macro_min": F1_MACRO_MINIMO, "recall_por_clase_min": RECALL_POR_CLASE_MINIMO},
        "pendiente": "medir latencia real en la Raspberry Pi 4 (criterio: ≤ 30 ms por recorte)",
    }
    # Se guarda ACÁ, antes de exportar: el entrenamiento (la parte cara, ~1-2h de GPU) y su
    # evaluación en el test ya están completos y son lo que importa. Si la exportación (formatos
    # ONNX/TFLite) falla por cualquier motivo, estas métricas reales no deben perderse — ya pasó
    # una vez (2026-09-16: un bug de torch.onnx.export tumbó el kernel con el modelo ya entrenado
    # y evaluado, y sin este guardado temprano el resultado habría quedado sin registrar).
    (SALIDA / "RESUMEN.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))

    try:
        resumen["exportacion"] = exportar(modelo, ds["valid"], ds["test"], clases)
    except Exception as e:                                     # noqa: BLE001
        resumen["exportacion"] = f"FALLÓ POR COMPLETO: {type(e).__name__}: {e}"
        print(f"⚠️ Exportación falló, pero el entrenamiento y la evaluación ya están guardados: {e}")
    (SALIDA / "RESUMEN.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))
    print(json.dumps({k: v for k, v in resumen.items() if k != "test"}, indent=2, ensure_ascii=False))
    print(f"\nTEST  F1-macro {test['f1_macro']:.4f}  accuracy {test['accuracy']:.4f}")
    print("recall por clase:", test["recall_por_clase"])
    if run:
        run.summary.update({"test_f1_macro": test["f1_macro"], "test_accuracy": test["accuracy"]})
        run.finish()


if __name__ == "__main__":
    main()
