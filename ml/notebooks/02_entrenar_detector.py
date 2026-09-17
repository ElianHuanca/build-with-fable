"""
Fase 3 del plan v5 — Entrenamiento del detector (Etapa A: "¿dónde hay un mosquito?").

Corre en Kaggle con GPU (T4 o P100). Lee la salida del notebook de consolidación
(smn404/dengue-invaders-consolidacion-dataset) montada como fuente de datos, entrena un YOLO
nano de una sola clase y exporta los formatos para la Raspberry Pi 4 y el celular.

Por qué se exportan TRES formatos: todavía no está confirmado si el Pi corre 32 bits (armv7l)
o 64 bits (aarch64), y eso decide el runtime (ver ml/README.md). Exportar todos cuesta un par
de minutos y evita reentrenar:
    - ONNX    → ONNX Runtime (solo aarch64)
    - NCNN    → NCNN (armv7l y aarch64, suele ser el más rápido en ARM)
    - TFLite INT8 → tflite-runtime (armv7l y aarch64) y Android

W&B es opcional: si el secret WANDB_API_KEY está agregado al notebook, se registra la corrida.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import yaml

# --------------------------------------------------------------------------------------
# Configuración
# --------------------------------------------------------------------------------------

TRABAJO = Path("/kaggle/working")


def _buscar_entrada() -> Path | None:
    # Kaggle monta la salida de otro notebook en rutas que cambiaron entre versiones de la
    # plataforma (/kaggle/input/<slug>/ o /kaggle/input/notebooks/<usuario>/<slug>/...).
    # Buscar el data.yaml en vez de fijar la ruta.
    for yaml_path in Path("/kaggle/input").rglob("mosquito-merged-v1/detector/data.yaml"):
        return yaml_path.parent
    return None


ENTRADA = _buscar_entrada() or Path("/kaggle/input/dengue-invaders-consolidacion-dataset/mosquito-merged-v1/detector")
SALIDA = TRABAJO / "detector-v1"

# YOLO26 es la generación de Ultralytics pensada para edge (sin NMS, más rápida en CPU).
# Si los pesos no están disponibles en la versión instalada, se cae a YOLO11n, que es el
# modelo del plan original.
MODELOS = ["yolo26n.pt", "yolo11n.pt"]

# 416 px: compromiso entre detectar mosquitos chicos en fotos de trampa y la latencia en el Pi
# (el costo crece con el cuadrado del lado: 640 px es ~2,4× más lento que 416).
IMGSZ = 416
EPOCHS = 120
PATIENCE = 25          # early stopping: cortar si mAP no mejora en 25 épocas
SEMILLA = 1312

# Criterio de aceptación de la Fase 3 (PLAN_V5 §8).
MAP50_MINIMO = 0.85


def configurar_wandb() -> bool:
    try:
        from kaggle_secrets import UserSecretsClient
        import os

        clave = UserSecretsClient().get_secret("WANDB_API_KEY")
        os.environ["WANDB_API_KEY"] = clave
        os.environ["WANDB_PROJECT"] = "dengue-invaders-mosquitos"
        return True
    except Exception:                                          # noqa: BLE001
        import os

        os.environ["WANDB_MODE"] = "disabled"
        return False


def preparar_data_yaml() -> Path:
    """El data.yaml de la consolidación apunta a /kaggle/working del OTRO notebook. Acá los datos
    están montados de solo lectura en /kaggle/input, así que se reescribe la ruta."""
    if not ENTRADA.exists():
        raise SystemExit(
            f"No se encontró {ENTRADA}.\n"
            "Agregar el notebook 'dengue-invaders-consolidacion-dataset' como fuente de datos "
            "(Add Input → Notebook Output) y verificar que su última versión terminó bien."
        )
    cfg = yaml.safe_load((ENTRADA / "data.yaml").read_text(encoding="utf-8"))
    cfg["path"] = str(ENTRADA)
    destino = TRABAJO / "data_detector.yaml"
    destino.write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")

    for split in ("train", "valid", "test"):
        n = len(list((ENTRADA / split / "images").glob("*")))
        print(f"  {split}: {n} imágenes")
    return destino


def cargar_modelo():
    from ultralytics import YOLO

    for nombre in MODELOS:
        try:
            modelo = YOLO(nombre)
            print(f"Modelo base: {nombre}")
            return modelo, nombre
        except Exception as e:                                 # noqa: BLE001
            print(f"  {nombre} no disponible ({type(e).__name__}), pruebo el siguiente")
    raise SystemExit("Ningún modelo base disponible.")


def main() -> None:
    import torch

    if not torch.cuda.is_available():
        raise SystemExit(
            "Sin GPU. Settings → Accelerator → GPU T4 x2 (o P100) y volver a correr."
        )
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"W&B: {'activo' if configurar_wandb() else 'desactivado (sin secret WANDB_API_KEY)'}")

    data_yaml = preparar_data_yaml()
    modelo, base = cargar_modelo()

    modelo.train(
        data=str(data_yaml),
        imgsz=IMGSZ,
        epochs=EPOCHS,
        patience=PATIENCE,
        batch=-1,              # batch automático según memoria de la GPU
        seed=SEMILLA,
        project=str(TRABAJO / "runs"),
        name="detector",
        exist_ok=True,
        # Augmentación: rotación completa (en una trampa el mosquito aparece en cualquier
        # orientación) y variación de luz fuerte (brecha laboratorio↔campo, PLAN_V5 §1.1).
        # Blur y escala de grises quedan fuera a propósito: borran el rasgo diagnóstico
        # (PLAN_V5 §6.2). En el detector importa menos que en el clasificador, pero se mantiene
        # la coherencia.
        degrees=180.0,
        flipud=0.5,
        fliplr=0.5,
        hsv_h=0.01,
        hsv_s=0.5,
        hsv_v=0.5,
        mosaic=1.0,
        close_mosaic=10,
        plots=True,
    )

    # Evaluar el MEJOR checkpoint sobre el TEST congelado (nunca usado para elegir épocas).
    mejor = TRABAJO / "runs" / "detector" / "weights" / "best.pt"
    from ultralytics import YOLO

    final = YOLO(str(mejor))
    metricas = final.val(data=str(data_yaml), split="test", imgsz=IMGSZ, plots=True)
    map50 = float(metricas.box.map50)
    map5095 = float(metricas.box.map)
    print(f"\nTEST  mAP@50 = {map50:.3f}   mAP@50-95 = {map5095:.3f}")

    SALIDA.mkdir(parents=True, exist_ok=True)
    shutil.copy2(mejor, SALIDA / "detector.pt")

    # Exportaciones para el Pi y el celular. Cada una en try: que falle una no debe perder las otras.
    exportados = {}
    for fmt, kwargs in [
        ("onnx", {"simplify": True, "opset": 12}),
        ("ncnn", {}),
        ("tflite", {"int8": True, "data": str(data_yaml)}),   # INT8 necesita imágenes de calibración
    ]:
        try:
            ruta = final.export(format=fmt, imgsz=IMGSZ, **kwargs)
            destino = SALIDA / Path(ruta).name
            if Path(ruta).is_dir():
                shutil.copytree(ruta, destino, dirs_exist_ok=True)
            else:
                shutil.copy2(ruta, destino)
            exportados[fmt] = destino.name
            print(f"  exportado {fmt}: {destino.name}")
        except Exception as e:                                 # noqa: BLE001
            exportados[fmt] = f"FALLÓ: {type(e).__name__}: {e}"
            print(f"  ⚠️ {fmt}: {e}")

    resumen = {
        "modelo_base": base,
        "imgsz": IMGSZ,
        "test_map50": round(map50, 4),
        "test_map50_95": round(map5095, 4),
        "cumple_criterio_fase3": map50 >= MAP50_MINIMO,
        "criterio_map50_minimo": MAP50_MINIMO,
        "exportados": exportados,
        "pendiente": "medir latencia real en la Raspberry Pi 4 (criterio: ≤ 200 ms)",
    }
    (SALIDA / "RESUMEN.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))
    print(json.dumps(resumen, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
