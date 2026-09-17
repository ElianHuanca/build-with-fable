# `ml/` — Modelo real de reconocimiento de mosquitos

Implementación del [plan v5](../docs/PLAN_V5_MODELO_IA.md). Reemplaza la "Cámara IA (DEMO)"
simulada por un modelo entrenado de verdad, que corre **localmente** en una Raspberry Pi 4 y en
celulares.

```
ml/
  dataset/
    taxonomia.yaml            # mapeo etiqueta-de-cualquier-fuente → clase canónica
    fuentes.yaml              # inventario de datasets con licencia y cobertura
    test_taxonomia.py         # verifica el mapeo contra etiquetas reales (81 casos)
  notebooks/
    build_notebook.py         # arma los .ipynb desde los .py (fuente de verdad = el .py)
    01_consolidar_dataset.py/.ipynb   # Fase 2
    02_entrenar_detector.py/.ipynb    # Fase 3
    03_entrenar_clasificador.py/.ipynb # Fase 4
    kernel-metadata*.json     # metadata para subir con `kaggle kernels push`
  pi/
    diagnostico_pi.txt        # hardware/SO real de la Raspberry Pi del proyecto
```

Los notebooks de Kaggle **se generan, no se editan a mano**: cualquier cambio va en el `.py`
correspondiente y después `python ml/notebooks/build_notebook.py`.

## Estado (2026-09-17)

| Fase | Qué | Estado |
|---|---|---|
| 0 | Taxonomía canónica | ✅ 81/81 tests (`ml/dataset/test_taxonomia.py`) |
| 1 | Inventario de fuentes + licencias | ✅ `dataset/fuentes.yaml`, 24 fuentes |
| 2 | Consolidación del dataset | ✅ **hecho** — `mosquito-merged-v1`, 76 459 imágenes |
| 3 | Detector (YOLO) | ✅ **hecho** — mAP@50 test 0,977 (ver abajo) |
| 4 | Clasificador (MobileNetV4) | ✅ **hecho** — F1-macro test 0,882 (ver abajo); INT8 no usable, se usa ONNX FP32 |
| 5 | Servicio de inferencia en el Pi | 🟡 código listo (`pi/`), falta desplegar y medir latencia real |
| 6 | Integración con el juego | ⬜ |
| 7 | Flywheel de reentrenamiento | ⬜ |

Notebooks en Kaggle (cuenta `smn404`, todos privados):
- [dengue-invaders-consolidacion-dataset](https://www.kaggle.com/code/smn404/dengue-invaders-consolidacion-dataset) — versión 5, completa, sin GPU.
- [dengue-invaders-entrenar-detector](https://www.kaggle.com/code/smn404/dengue-invaders-entrenar-detector) — necesita GPU T4/P100.
- [dengue-invaders-entrenar-clasificador](https://www.kaggle.com/code/smn404/dengue-invaders-entrenar-clasificador) — necesita GPU T4/P100.

## Resultado de la Fase 2 (consolidación, versión 5)

76 459 imágenes únicas de 18 fuentes, deduplicadas y agrupadas para que ninguna foto (ni sus
variantes augmentadas) cruce entre train/valid/test.

| clase | train | valid | test | total |
|---|---|---|---|---|
| aegypti | 8 165 | 954 | 935 | 10 054 |
| albopictus | 11 421 | 1 799 | 1 797 | 15 017 |
| culex | 7 063 | 958 | 969 | 8 990 |
| anopheles | 2 519 | 339 | 343 | 3 201 |
| otro_mosquito | 2 401 | 372 | 374 | 3 147 |
| no_es_mosquito | 6 217 | 295 | 297 | 6 809 |

`anopheles` sigue siendo la clase más chica (3 201) pero pasó el mínimo de 1 500. Detector:
37 739 / 4 204 / 4 173 imágenes con caja (train/valid/test).

## Resultado de la Fase 3 (detector, `yolo26n`, 2026-09-17)

Entrenado sobre 37 739 / 4 204 / 4 173 imágenes (train/valid/test) con caja, clase única
`mosquito`, 416 px, hasta 120 épocas (con `patience=25`).

| métrica | valor | criterio |
|---|---|---|
| mAP@50 (test) | **0,977** | ≥ 0,85 ✅ |
| mAP@50-95 (test) | 0,695 | (informativo, sin mínimo) |

**Cumple el criterio de la Fase 3 con margen amplio.** Exportado a `best.onnx` (para el Pi),
`best_ncnn_model` y `best_int8.tflite` (2,7 MB, 3,4× más chico que el FP32 original de 9,3 MB) —
los tres formatos disponibles en el output de la versión final del notebook
`dengue-invaders-entrenar-detector`. Falta medir la latencia real en el Pi (ver Backlog).

## Resultado de la Fase 4 (clasificador, versión 8, 2026-09-17)

`mobilenetv4_conv_small.e2400_r224_in1k`, 40 épocas, F1-macro test **0,882** (mínimo 0,85: ✅).

| clase | recall | precisión |
|---|---|---|
| anopheles | 97,7 % | 99,1 % |
| no_es_mosquito | 97,3 % | 92,9 % |
| culex | 91,0 % | 93,4 % |
| albopictus | 88,9 % | 88,2 % |
| aegypti | 82,1 % | 82,0 % |
| otro_mosquito | 73,0 % | 72,8 % |

`anopheles` — la clase con menos datos y la que más preocupaba — resultó la de mejor desempeño.
**No cumple el criterio formal de la Fase 4** (recall ≥ 80 % en TODAS las clases) solo por
`otro_mosquito` (73 %): es la clase "cajón de sastre" (Culiseta, Armigeres, etc., todo lo que no
es ninguna de las 4 especies objetivo), la más heterogénea y la más fácil de confundir con las
demás en la matriz de confusión. Las 4 especies objetivo del juego superan individualmente el
80 %. No se relanzó el entrenamiento por esto — se anota como mejora futura (ver Backlog abajo).

**INT8 no usable, detectado automáticamente:** la cuantización estática colapsó a 6,5 % de
precisión (prácticamente azar) contra el 87,9 % del modelo FP32 — probablemente por cómo
`onnxruntime.quantization` maneja activaciones con rango negativo (salen así después de
normalizar con media/desvío de ImageNet) en una arquitectura con bloques tipo SE de
MobileNetV4. El propio pipeline lo marcó `int8_recomendado: false` sin intervención manual, que
es exactamente para lo que se diseñó esa verificación. **Para el Pi se usa `clasificador_fp32.onnx`**
hasta que se investigue la cuantización (activaciones con `QuantType.QInt8` en vez de `QUInt8`,
o cuantización dinámica en vez de estática, son los próximos intentos razonables).

Todos los artefactos (`clasificador.pt`, `clasificador_fp32.onnx`, `clasificador_int8.onnx`,
`etiquetas.json`, `preprocesado.json`) están en el output de la versión 8 del notebook
`dengue-invaders-entrenar-clasificador`.

## Fase 5 — servicio de inferencia en el Pi (código listo, falta desplegar)

```
ml/pi/
  inferencia.py                       # detector + clasificador encadenados (ONNX Runtime puro)
  servidor.py                         # Flask: POST /identify, GET /salud
  descargar_modelos.sh                # baja los artefactos desde el output de Kaggle
  requirements.txt
  dengue-invaders-inferencia.service  # systemd, siempre encendido
```

`inferencia.py` no hardcodea clases ni normalización: los lee de `etiquetas.json` y
`preprocesado.json`, los mismos archivos que exporta `03_entrenar_clasificador.py`, así que si
se reentrena el clasificador con otras clases no hace falta tocar este código. El recorte del
detector al clasificador usa el mismo `MARGEN_RECORTE` que la consolidación (Fase 2) para no
correr el clasificador con una distribución de entrada distinta a la de entrenamiento. Si la
confianza de especie queda por debajo de `CLASIFICADOR_CONFIANZA_MINIMA` o el clasificador dice
`no_es_mosquito`, la respuesta marca `"especie": "incierto"` en vez de forzar una de las 4
especies — el problema del softmax que "siempre contesta" (plan §1.2).

**Desplegar en el Pi:**

```bash
git clone <este repo> ~/build-with-fable   # o `git pull` si ya está clonado
cd ~/build-with-fable/ml/pi
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

export KAGGLE_API_TOKEN="<token nuevo, rotado>"
bash descargar_modelos.sh                  # deja modelos/ con detector.onnx, clasificador.onnx, etiquetas.json, preprocesado.json

python servidor.py                          # prueba manual: POST /identify con una foto
```

Para dejarlo siempre encendido, ajustar las rutas de `dengue-invaders-inferencia.service` a
donde haya quedado clonado el repo y:

```bash
sudo cp dengue-invaders-inferencia.service /etc/systemd/system/
sudo systemctl enable --now dengue-invaders-inferencia.service
```

Probar el endpoint:

```bash
curl -F "foto=@/ruta/a/una/foto.jpg" http://localhost:8080/identify
```

**No usar el MCP de Kaggle en el Pi** para esto: en este mismo proyecto el OAuth del MCP de
Kaggle expiraba seguido y terminamos usando la CLI con `KAGGLE_API_TOKEN` (ver Decisiones abajo).
Para una descarga puntual de dos archivos en un dispositivo headless, la CLI con token es más
simple y confiable — no hace falta conectar nada nuevo.

**Pendiente:** medir la latencia real de `/identify` sobre una foto típica (backlog).

## Hardware del Pi (confirmado, ver `ml/pi/diagnostico_pi.txt`)

**`aarch64`, Raspberry Pi OS 64 bits.** Kernel `6.1.21-v8+`, Python 3.9.2, 4 núcleos, 7,6 GB RAM,
14 GB libres de disco, systemd 247. **Runtime: ONNX Runtime** — no hace falta TFLite ni
reinstalar nada.

**Pendiente de decidir (no bloquea las Fases 3-4):** el diagnóstico no encontró ninguna cámara
conectada. Antes de la Fase 5 hay que saber si este Pi va a capturar fotos él mismo (cámara CSI/
USB propia) o si solo va a exponer el servicio de inferencia mientras las fotos llegan de otro
lado (trampas con cámara propia en la red, o el celular). Cambia el diseño del servicio.

## Publicar el dataset consolidado como Kaggle Dataset (paso obligatorio, no lo saltees)

**Lección real (2026-09-17):** conectar el notebook de la Fase 2 directo como fuente de datos
del detector/clasificador (`kernel_sources`) **falla en silencio**. Kaggle solo monta el
`.ipynb`/`.html` del notebook fuente y comprime la salida real en `_output_.zip` sin extraerla —
nunca aparece como carpeta navegable en `/kaggle/input`, así que `buscar_entrada()` no encuentra
nada aunque la metadata diga que la fuente está conectada. Confirmado bajando el log de una
corrida con un `find /kaggle/input` de diagnóstico.

Para que los archivos de verdad lleguen, la salida de la Fase 2 tiene que publicarse como
**Dataset**, no quedar como "notebook output":

1. Abrir el [notebook de consolidación](https://www.kaggle.com/code/smn404/dengue-invaders-consolidacion-dataset) → pestaña **Output** → carpeta `mosquito-merged-v1` →
   **New Dataset** (puede quedar privado). Nombre: `mosquito-merged-v1`.
2. Los `kernel-metadata.json` del detector y el clasificador ya apuntan a
   `"dataset_sources": ["<usuario>/mosquito-merged-v1"]` — no hace falta tocar el código,
   `buscar_entrada()` busca el dataset recursivamente en `/kaggle/input`.

## Cómo lanzar las Fases 3 y 4 (ya subidas, faltan correr)

Los dos notebooks ya están en Kaggle apuntando al Dataset de la Fase 2 (una vez publicado, ver
arriba) y pueden correr **en paralelo** (Kaggle permite 2 sesiones con GPU a la vez).

Para cada uno, en el editor:
1. **Settings → Accelerator → GPU T4 x2** (o P100).
2. **Add-ons → Secrets → `WANDB_API_KEY`** activado (opcional; sin él, entrena igual).
3. Verificar que en **Input** figure el Dataset `mosquito-merged-v1` (no el notebook).
4. **Save Version → Save & Run All (Commit) → Save.**

Tiempo estimado: 1-2 h cada uno. Los criterios de aceptación (mAP@50 ≥ 0,85 para el detector,
F1-macro ≥ 0,85 y recall ≥ 0,80 por clase para el clasificador) quedan en `RESUMEN.json` de cada
salida.

## Si hay que regenerar la consolidación (cambios en taxonomía/fuentes)

```bash
python ml/dataset/test_taxonomia.py        # correr SIEMPRE antes de subir
python ml/notebooks/build_notebook.py      # regenera los 3 .ipynb desde los .py
```

Y subir con la CLI de Kaggle (requiere `KAGGLE_API_TOKEN` en el entorno):

```bash
python -m kaggle kernels push -p ml/notebooks
```

**Ojo:** `kernels push` dispara una ejecución inmediata sin GPU y sin los secrets del notebook
(los secrets solo llegan cuando se lanza desde el editor web con "Save & Run All"). Está pensado
así a propósito: sirve para llevar el código nuevo al notebook sin gastar cuota, y la primera
celda de cada uno corta enseguida si detecta que falta el secret o la GPU. La corrida real
siempre se lanza a mano desde el editor.

## Decisiones ya tomadas (y por qué)

- **Dos etapas** (detector → recorte → clasificador) en vez de un YOLO multiclase.
  En una foto de trampa el mosquito ocupa ~40 px; el dibujo del tórax que separa *aegypti* de
  *albopictus* queda en ~15 px: irreconocible. Recortando y reescalando a 224 px pasa a ~90 px.
- **Kaggle entrena, Roboflow cura.** Roboflow solo ofrece ViT/ResNet/DINOv3 para clasificación, y
  ninguno sirve para CPU ARM (ResNet18 ≈ 200 ms en Pi 4 vs. ≈ 10 ms de MobileNetV4-Small).
- **Variante B de almacenamiento**: el dataset maestro vive en Kaggle (gratis, sin límite
  práctico). Roboflow queda como buzón de entrada y herramienta de etiquetado del flywheel.
- **Split agrupado por pHash + nombre de imagen original**, no solo deduplicado. La v3 de la
  consolidación (descartada) tenía fuga real: el 41 % de las fotos tenía variantes augmentadas
  (rotadas/espejadas por la propia exportación de Roboflow) que caían una en train y otra en
  test. Ahora se agrupan por unión de pHash + stem del archivo original, y en valid/test queda
  una sola copia por foto real.
- **Clases `otro_mosquito` y `no_es_mosquito`** obligatorias: sin ellas, un softmax de 4 clases
  responde "Aedes aegypti 87 %" ante la foto de una mosca. `no_es_mosquito` sale de 3 datasets de
  insectos/polillas con `clase_por_defecto`, no de negativos manuales.
- **Etiquetas ambiguas** (`AEDES` sin especie, `mosquito` genérico) entrenan el detector pero se
  descartan del clasificador: no se puede aprender a separar especies con datos que no las dicen.
- **Topes por fuente** (`max_imagenes`): `americano` (14 640 imágenes, todas `aedes`/`non_aedes`
  sin especie) se limitó a 1 500 para que no ahogara `otro_mosquito`; `moth-juac0` a 1 200 por lo
  mismo con `no_es_mosquito`.
- **Cuantización INT8 verificada, no asumida.** El notebook del clasificador mide la precisión de
  la versión INT8 contra el test *con el mismo motor que va a correr en el Pi* (ONNX Runtime CPU)
  y la marca como no recomendada si pierde más de 2 puntos contra FP32.
- **Guardar métricas ANTES de exportar, no después.** La primera corrida del clasificador
  entrenó las 40 épocas bien (F1-macro val 0,937) pero `torch.onnx.export` tumbó el kernel
  entero al final: en la versión de PyTorch de la imagen de Kaggle, el exportador "dynamo" es
  el default y necesita el paquete `onnxscript`, que no está instalado. Como `RESUMEN.json` se
  escribía después de exportar, ese resultado real no quedó registrado en ningún lado (el
  checkpoint `.pt` sí sobrevivió como output). Se corrigió en dos frentes: `dynamo=False`
  explícito en el export, y `RESUMEN.json` ahora se escribe apenas se calculan las métricas del
  test, antes de intentar exportar — un fallo de exportación nunca vuelve a tapar un
  entrenamiento real.

## Tests

```bash
python ml/dataset/test_taxonomia.py
```

81 casos: 62 de mapeo de especie, 19 de las fuentes de negativos, más la función que extrae el
nombre de imagen original de una exportación de Roboflow (clave del fix anti-fuga). Si falla, la
consolidación etiquetaría mal miles de imágenes o volvería a filtrar datos entre splits.

## Backlog (no bloquea las fases siguientes)

- **`otro_mosquito` por debajo del recall mínimo (73 % vs. 80 %)**: es la clase más heterogénea
  (agrupa todo lo que no es ninguna de las 4 especies objetivo). Ideas para mejorarla sin
  retocar el resto: separar en sub-clases con más datos propios en vez de un cajón único, o
  simplemente aceptar que el juego no necesita distinguir "otro mosquito" de forma fina — lo que
  importa es no confundirlo con las 4 especies objetivo, y ahí el error es menor que el 27 %
  global sugiere (la mayoría de sus fallos son contra `albopictus`/`culex`, especies reales, no
  contra `no_es_mosquito`).
- **Cuantización INT8 rota** (ver arriba): probar `QuantType.QInt8` para activaciones o
  cuantización dinámica antes de volver a intentar estática con calibración distinta.
- **Medir latencia real en el Pi** (Fase 5): ni el detector (`best.onnx`) ni el clasificador
  (`clasificador_fp32.onnx`) se corrieron todavía sobre el hardware real — es la validación
  pendiente más importante antes de dar por buena la elección de arquitectura. Criterio informal
  del plan: ≤ 200 ms por foto para el detector.
