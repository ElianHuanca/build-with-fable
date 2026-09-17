"""
Genera ml/notebooks/01_consolidar_dataset.ipynb a partir de los archivos del repo.

El notebook de Kaggle es autocontenido: lleva adentro taxonomia.yaml, fuentes.yaml y el script
de consolidación (celdas %%writefile). Así no depende de clonar el repo ni de subir un Dataset
de configuración aparte. La fuente de verdad sigue siendo el repo: después de editar cualquiera
de esos archivos, regenerar con

    python ml/notebooks/build_notebook.py
"""

import json
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
SALIDA = ML / "notebooks" / "01_consolidar_dataset.ipynb"


def md(texto: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": texto.strip("\n").splitlines(True)}


def code(texto: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": texto.strip("\n").splitlines(True),
    }


def writefile(destino: str, contenido: str) -> dict:
    return code(f"%%writefile {destino}\n{contenido}")


taxonomia = (ML / "dataset" / "taxonomia.yaml").read_text(encoding="utf-8")
fuentes = (ML / "dataset" / "fuentes.yaml").read_text(encoding="utf-8")
script = (ML / "notebooks" / "01_consolidar_dataset.py").read_text(encoding="utf-8")

celdas = [
    md(
        """
# Dengue Invaders — Fase 2: consolidación del dataset de mosquitos

Descarga ~19 datasets públicos (Roboflow Universe + Kaggle), normaliza sus etiquetas a una
taxonomía común, deduplica por pHash y produce dos datasets listos para entrenar:

- `detector/` — YOLO, una sola clase `mosquito` (Fase 3)
- `clasificador/` — recortes por especie: `aegypti`, `albopictus`, `culex`, `anopheles`,
  `otro_mosquito`, `no_es_mosquito` (Fase 4)

Plan completo: `docs/PLAN_V5_MODELO_IA.md` del repo *build-with-fable*.

## Antes de correr

1. **Add-ons → Secrets → Add Secret**: label `ROBOFLOW_API_KEY`, valor = tu clave privada de
   Roboflow (Workspace Settings → API Keys). Activá el toggle del secret para ESTE notebook.
2. **Settings → Internet: ON.**
3. **Settings → Persistence: Files only.**
4. No hace falta GPU en esta fase.

La primera celda de código verifica el secret y corta con un mensaje claro si falta.

> ⚠️ Este notebook se genera desde el repo con `ml/notebooks/build_notebook.py`.
> Si editás algo acá, llevá el cambio al repo o se pierde en la próxima regeneración.
"""
    ),
    code(
        """
# 1) Verificación del secret — falla rápido, antes de instalar o descargar nada.
from kaggle_secrets import UserSecretsClient

try:
    _clave = UserSecretsClient().get_secret("ROBOFLOW_API_KEY")
    assert _clave and len(_clave) > 10
    print("✅ ROBOFLOW_API_KEY encontrada.")
except Exception as e:
    raise SystemExit(
        "❌ Falta el secret ROBOFLOW_API_KEY.\\n"
        "   Add-ons → Secrets → Add Secret (label ROBOFLOW_API_KEY) y activalo para este notebook.\\n"
        f"   Detalle: {type(e).__name__}"
    )
finally:
    _clave = None  # no dejar la clave viva en el namespace del notebook
"""
    ),
    code("!pip -q install roboflow imagehash pyyaml pillow tqdm kagglehub"),
    md("## Configuración (copiada del repo)"),
    code("!mkdir -p /kaggle/working/config"),
    writefile("/kaggle/working/config/taxonomia.yaml", taxonomia),
    writefile("/kaggle/working/config/fuentes.yaml", fuentes),
    writefile("/kaggle/working/consolidar.py", script),
    md(
        """
## Corrida

Corrida completa `TIERS = [1, 2]`. La v3 (solo tier 1) ya validó el pipeline en 23 min;
esta debería tardar ~40-60 min.
"""
    ),
    code(
        """
import sys, importlib
from pathlib import Path

sys.path.insert(0, "/kaggle/working")
import consolidar
importlib.reload(consolidar)

TIERS = [1, 2]         # corrida completa (la v3 con [1] validó el pipeline)

consolidar.TIERS = TIERS
consolidar.main(Path("/kaggle/working/config"))
"""
    ),
    md(
        """
## Resultado

Revisar en el reporte:
- ¿≥ 25 000 imágenes únicas?
- ¿≥ 1 500 por clase objetivo? **`anopheles` es la que más riesgo tiene de quedar corta.**
- ¿Cuántos duplicados eliminó? Si son muchísimos, varias fuentes eran el mismo material.

Si todo está bien: *Save Version* y publicar `/kaggle/working/mosquito-merged-v1` como Dataset
`mosquito-merged-v1` (entrada de las Fases 3 y 4).
"""
    ),
    code(
        """
!du -sh /kaggle/working/mosquito-merged-v1/* 2>/dev/null
!find /kaggle/working/mosquito-merged-v1/clasificador -type f | awk -F/ '{print $(NF-2)"/"$(NF-1)}' | sort | uniq -c
"""
    ),
]

def guardar(ruta: Path, cells: list) -> None:
    nb = {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    ruta.write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Generado {ruta} ({len(cells)} celdas, {ruta.stat().st_size // 1024} KB)")


guardar(SALIDA, celdas)

# ------------------------------------------------------------------ Fase 3: detector ---------

detector = (ML / "notebooks" / "02_entrenar_detector.py").read_text(encoding="utf-8")

celdas_detector = [
    md(
        """
# Dengue Invaders — Fase 3: entrenamiento del detector de mosquitos

Entrena un YOLO nano de **una sola clase** (`mosquito`) sobre la salida del notebook de
consolidación, lo evalúa en el test congelado y exporta ONNX + NCNN + TFLite INT8 para la
Raspberry Pi 4 y el celular.

## Antes de correr

1. **Add Input → Notebook Output → `dengue-invaders-consolidacion-dataset`** (la última versión
   que haya terminado bien).
2. **Settings → Accelerator → GPU T4 x2** (o P100). Sin GPU, la primera celda corta.
3. **Settings → Internet: ON** (para bajar los pesos base de Ultralytics).
4. *(Opcional)* **Add-ons → Secrets → `WANDB_API_KEY`** activado: registra la corrida en W&B.
   Sin él, entrena igual.
5. Lanzar con **Save Version → Save & Run All (Commit)** — así los secrets llegan a la corrida.

Tiempo estimado: 1-2 h en T4, según cuántas imágenes haya dejado la consolidación.

> ⚠️ Generado desde el repo con `ml/notebooks/build_notebook.py`.
"""
    ),
    code("!pip -q install -U ultralytics pyyaml onnx onnxslim onnxruntime"),
    writefile("/kaggle/working/entrenar_detector.py", detector),
    code('!echo "=== /kaggle/input ===" && find /kaggle/input -maxdepth 4 2>&1 | head -100'),
    code(
        """
import sys, importlib
sys.path.insert(0, "/kaggle/working")
import entrenar_detector
importlib.reload(entrenar_detector)
entrenar_detector.main()
"""
    ),
    md("## Curvas y métricas"),
    code(
        """
from IPython.display import Image, display
from pathlib import Path
run = Path("/kaggle/working/runs/detector")
for nombre in ["results.png", "PR_curve.png", "confusion_matrix.png", "val_batch0_pred.jpg"]:
    p = run / nombre
    if p.exists():
        print(nombre); display(Image(filename=str(p), width=900))
"""
    ),
]

guardar(ML / "notebooks" / "02_entrenar_detector.ipynb", celdas_detector)

# ------------------------------------------------------------------ Fase 4: clasificador -----

clasificador = (ML / "notebooks" / "03_entrenar_clasificador.py").read_text(encoding="utf-8")

guardar(ML / "notebooks" / "03_entrenar_clasificador.ipynb", [
    md(
        """
# Dengue Invaders — Fase 4: clasificador de especie de mosquito

MobileNetV4-Small sobre los recortes de la consolidación. Clases: `aegypti`, `albopictus`,
`anopheles`, `culex`, `otro_mosquito`, `no_es_mosquito`. Exporta ONNX FP32 + ONNX INT8
(verificada contra el test) + TFLite (best effort).

## Antes de correr
1. **Add Input → Notebook Output → `dengue-invaders-consolidacion-dataset`** (última versión OK).
2. **Accelerator → GPU T4 x2** (o P100).
3. **Internet: ON.**
4. *(Opcional)* Secret **`WANDB_API_KEY`** activado.
5. **Save Version → Save & Run All (Commit).**

Tiempo estimado: 1-2 h en T4.

> ⚠️ Generado desde el repo con `ml/notebooks/build_notebook.py`.
"""
    ),
    # albumentations >= 2: el script usa la API nueva (fill=, quality_range=, std_range=...).
    code("!pip -q install -U 'albumentations>=2.0' timm onnx onnxruntime onnxslim wandb scikit-learn"),
    writefile("/kaggle/working/entrenar_clasificador.py", clasificador),
    code('!echo "=== /kaggle/input ===" && find /kaggle/input -maxdepth 4 2>&1 | head -100'),
    code(
        """
import sys, importlib
sys.path.insert(0, "/kaggle/working")
import entrenar_clasificador
importlib.reload(entrenar_clasificador)
entrenar_clasificador.main()
"""
    ),
    md("## Matriz de confusión del test"),
    code(
        """
import json
import matplotlib.pyplot as plt
r = json.load(open("/kaggle/working/clasificador-v1/RESUMEN.json"))
cm, clases = r["test"]["matriz_confusion"], r["clases"]
fig, ax = plt.subplots(figsize=(7, 6))
ax.imshow(cm, cmap="Blues")
ax.set_xticks(range(len(clases)), clases, rotation=45, ha="right"); ax.set_yticks(range(len(clases)), clases)
ax.set_xlabel("predicho"); ax.set_ylabel("real")
for i, fila in enumerate(cm):
    for j, v in enumerate(fila):
        ax.text(j, i, v, ha="center", va="center", fontsize=8)
plt.tight_layout(); plt.show()
"""
    ),
])
