# Plan v5 — Modelo real de reconocimiento de mosquitos (edge + reentrenamiento continuo)

**Estado: propuesta para discutir. Nada de esto está implementado todavía.**

Reemplaza la "Cámara IA (DEMO)" simulada de v3/v4 por un modelo de visión por computadora real,
entrenado con datasets públicos consolidados, que corre **localmente** en:

1. **Raspberry Pi 4 (8 GB)** como servidor de inferencia (trampas de mosquitos con cámara).
2. **Teléfonos** (fotos que envía la gente).

Con un **pipeline de reentrenamiento continuo**: cada foto capturada en producción vuelve al
dataset para la siguiente iteración del modelo.

---

## 0. Resumen de las decisiones técnicas propuestas

| Decisión | Propuesta | Por qué |
|---|---|---|
| Arquitectura | **Dos etapas**: detector (¿dónde hay mosquito?) → clasificador (¿qué especie?) | Ver §2. Es la diferencia entre 70 % y 90 % de acierto real |
| Detector | YOLO11n @ 416 px, INT8 | Chico, rápido en CPU ARM, exporta a ONNX/NCNN/TFLite |
| Clasificador | MobileNetV4-Small o EfficientNet-Lite0 @ 224 px, INT8 | ~10 ms por recorte en Pi 4; mismo peso sirve en celular |
| Dónde se entrena | **Kaggle** (GPU gratis) | Roboflow solo ofrece ViT/ResNet/DINOv3 para clasificación: ninguno está optimizado para CPU ARM |
| Dónde viven los datos | **Roboflow** (curación, etiquetado, active learning) + **Kaggle Datasets** (dataset consolidado congelado) | Ver §5 |
| Runtime en el Pi | **ONNX Runtime** (confirmado: Pi OS 64 bits) | NCNN queda como comparación opcional de latencia, no como fallback obligatorio |
| Seguimiento de experimentos | Weights & Biases | Comparar campeón vs. retador entre reentrenamientos |

---

## 1. Las dos cosas que pueden hundir este proyecto (leer antes que nada)

### 1.1 La brecha laboratorio ↔ campo

**Es el riesgo #1, por encima de la elección de arquitectura.** Casi todos los datasets públicos
de mosquitos son *fotos macro de laboratorio*: mosquito muerto, fondo blanco, iluminación
controlada, enfoque perfecto. Las fotos reales que va a recibir el sistema son:

- de trampa: mosquito pequeño dentro de una imagen más grande, a veces varios, polvo, malla de
  fondo, iluminación artificial nocturna;
- de celular: movidas, mal iluminadas, comprimidas por WhatsApp, el mosquito ocupa 5 % del cuadro.

Un modelo entrenado solo con imágenes de laboratorio puede dar 95 % en su test set y **60 % en
campo**. Mitigaciones (todas incluidas en el plan): augmentación fotométrica agresiva (§6), un
test set separado con fotos "tipo campo", y el flywheel de §7 — que es justamente el mecanismo
para que la distribución real vaya reemplazando a la de laboratorio.

**Expectativa honesta:** la v1 del modelo va a andar bien en imágenes limpias (~88-94 %) y
mediocre en fotos reales de celular (~65-80 %). Eso es normal y esperable. El modelo se vuelve
bueno en campo recién después de 2-3 ciclos de reentrenamiento con datos propios.

### 1.2 Un softmax de 4 clases siempre responde una de las 4

Si el modelo solo conoce `aegypti / albopictus / culex / anopheles`, cuando alguien fotografíe
una mosca, una araña o su dedo, va a responder "Aedes aegypti, 87 % de confianza". En una
herramienta de salud pública eso es peor que no responder.

**Obligatorio:** el clasificador debe tener además:
- `otro_mosquito` — culícidos que no son de las 4 especies objetivo,
- `no_es_mosquito` — cualquier otra cosa (negativos duros: moscas, polillas, arañas, fondos).

Más un **umbral de confianza** con salida explícita de "no estoy seguro, volvé a intentar con
más luz / más cerca". Esto conecta con la regla que ya tiene el proyecto de no presentar
contenido de salud como validado sin revisión de SEDES (ver `ATTRIBUTION.md`).

---

## 2. Por qué dos etapas y no un solo detector multiclase

Lo intuitivo sería un solo YOLO con 4 clases de especie. **No conviene**, y la razón es de
resolución efectiva:

Lo que distingue a *Aedes aegypti* de *Aedes albopictus* es el dibujo del tórax (lira blanca vs.
una sola línea central) — un detalle de pocos píxeles. En una foto de trampa de 640×640 donde el
mosquito ocupa 40×40 px, al detector le quedan ~15 px de tórax para decidir: imposible de forma
confiable.

```
Una etapa:    imagen 640px → [YOLO 4 clases] → especie        (tórax ≈ 15 px)  ✗
Dos etapas:   imagen 640px → [YOLO 1 clase] → recorte → resize 224px
                           → [clasificador] → especie          (tórax ≈ 90 px)  ✓
```

Ventajas adicionales:

- **Trampa vs. celular con el mismo modelo.** La trampa tiene varios mosquitos por foto (detectar
  todos → clasificar cada uno); el celular tiene uno descentrado (detectar → recortar → clasificar).
- **Se mejoran por separado.** El detector "hay un mosquito acá" se resuelve rápido y casi no
  necesita reentrenamiento. Toda la precisión de especie vive en el clasificador, que es el barato
  de reentrenar (imágenes chicas, red chica, minutos de GPU).
- **Datasets distintos alimentan cada etapa.** Los datasets de una sola clase `mosquito` (≈20 000
  imágenes) sirven para el detector aunque no tengan especie.
- **El clasificador entrena con recortes**, que es exactamente la distribución que verá en
  producción.

---

## 3. Modelos objetivo y rendimiento esperado en Raspberry Pi 4

El Pi 4 es **CPU pura** (Cortex-A72 de 4 núcleos, sin NPU). Todo pasa por cuantización INT8.

| Etapa | Modelo | Entrada | Tamaño INT8 | Latencia estimada Pi 4* |
|---|---|---|---|---|
| A — Detector | YOLO11n | 416×416 | ~3 MB | 90-160 ms |
| B — Clasificador | MobileNetV4-Conv-Small | 224×224 | ~4 MB | 8-15 ms / recorte |
| | EfficientNet-Lite0 (alternativa) | 224×224 | ~5 MB | 15-25 ms / recorte |

\* **Estimaciones a verificar en Fase 3 sobre el hardware real.** No las tomes como dato hasta
medirlas; dependen mucho del runtime, del sistema operativo de 64 bits y de la refrigeración.

Foto de trampa típica (1 detección + 1 clasificación): **~120-180 ms**, es decir 5-8 imágenes por
segundo. Más que suficiente para trampas que fotografían cada varios segundos o minutos.

**Runtimes, en orden de preferencia para el Pi:**
1. **NCNN** — normalmente el más rápido en ARM CPU, pero el flujo de conversión es más manual.
2. **ONNX Runtime** — casi tan rápido, mucho más simple, buen soporte de INT8. *Recomendado para
   empezar.*
3. **TFLite / LiteRT con XNNPACK** — el camino natural si además querés el mismo modelo en Android.

**Requisito:** Raspberry Pi OS de **64 bits**. En 32 bits se pierde bastante rendimiento.

**Acelerador opcional:** un **Coral USB Accelerator** (~60-80 USD) daría 10-30× en el Pi 4, pero
exige TFLite INT8 completo con ops soportadas. **No hace falta** para trampas que sacan fotos
puntuales; solo evaluarlo si en el futuro se quiere video en tiempo real.

**Celular:** los mismos pesos, exportados a TFLite, corren con NNAPI (Android) o Core ML (iOS); o
ONNX Runtime Mobile. El clasificador de 224 px va a ir sobrado en cualquier teléfono moderno.

---

## 4. Inventario de datasets encontrados (2026-09-16)

Búsqueda real en Roboflow Universe y Kaggle. **Todo lo listado es CC BY 4.0, MIT, CDLA-Permissive
o dominio público** — ninguna licencia restrictiva. CC BY 4.0 **exige atribución**: hay que
producir un `ATTRIBUTION_DATASET.md`, igual que ya se hizo con las fotos de la Biblioteca.

### 4.1 Para la Etapa A (detector, clase única `mosquito`)

| Fuente | Imágenes | Clases | Licencia |
|---|---|---|---|
| `mosquitos001/mosquito-4ocly` | 9 895 | mosquito | CC BY 4.0 |
| `trapmos/mosquito-5wsj2` | 10 000 | aegypti, albopictus | CC BY 4.0 |
| *(todos los de 4.2 también sirven, colapsando especies a una clase)* | | | |

### 4.2 Para la Etapa B (clasificador de especie)

| Fuente | Imágenes | Cobertura de especies | Licencia |
|---|---|---|---|
| `mosquitos-u6ipx/mosquito-detection-dataset` | 7 672 | **aegypti, albopictus, anopheles, culex**, culiseta, japonicus | CC BY 4.0 |
| `license-plate-detection-ldjnv/mosquitos-classification` | 7 239 | Ae-aegypti, Ae-albopictus, Ae-vexans, An-tessellatus, Cx-quinquefasciatus, Cx-vishnui, Misc | CC BY 4.0 |
| `mosquito-tidps/mosquito-detection-yr7y3` | 7 211 | aegypti, albopictus, Culex, Cx quinquefasciatus (con estados landing/smashed) | CC BY 4.0 |
| `mosquito-itce6/mosquito_annotation` | 6 800 | 27 clases: Aedes spp., **Anopheles spp.**, Culex spp., sexo | CC BY 4.0 |
| `mosquitoscan/mosquito-detection-esjag` | 4 252 | aegypti, albopictus, culiseta, japonicus | CC BY 4.0 |
| `angelomontalban.../aedes-species-classifier-clean` | 3 775 | aegypti, albopictus | CC BY 4.0 |
| `tickcitizenscience/mosquito-qi01f` | 2 792 | aegypti, albopictus | CC BY 4.0 |
| `sebskie-uvuoi/mosquito-6vtkg` | 1 400 | aegypti, albopictus | CC BY 4.0 |
| `alves-world/dengu-gk6lv` | 1 367 | aegypti, albopictus, Cx quinquefasciatus | CC BY 4.0 |
| `mozziev3/mozziev3` | 1 003 | aegypti/albopictus × macho/hembra, No-Aedes | CC BY 4.0 |
| `denguemetric-o9fa8/aedes-classification` | 931 | aegypti, albopictus | CC BY 4.0 |
| `ks-job/anopheles-nmkvs` | 215 | anopheles | CC BY 4.0 |
| **Kaggle** `ahsanatiq/mosquitos-classification-images` | 3 000 | AEDES / ANOPHELES / CULEX (solo género) | MIT |
| **Kaggle** `cyberthorn/chula-mosquito-classification` | 6 especies (5,5 GB) | microscopía, Tailandia | CDLA-Permissive |

### 4.3 Para negativos duros (clase `no_es_mosquito`)

| Fuente | Imágenes | Uso |
|---|---|---|
| `mosquito1/americano-y8n5a` | 14 640 | `aedes` vs `non_aedes` — la mitad `non_aedes` es oro para negativos |
| *(pendiente)* dataset genérico de insectos | — | buscar moscas/polillas/arañas para robustecer |

**Total bruto estimado: 60 000-80 000 imágenes.** Después de deduplicar y filtrar por taxonomía,
la expectativa realista es **30 000-50 000 utilizables**.

### 4.4 Riesgo específico: duplicados entre fuentes

Varios de estos proyectos de Universe son **re-subidas o forks del mismo material original**
(`sebskie` tiene dos, `mosqkito` mezcla clases de varios, etc.). Si la misma imagen cae en train y
en test, las métricas salen infladas y el modelo parece excelente hasta que llega al campo.

**Mitigación obligatoria:** deduplicación por *perceptual hash* (pHash/dHash) sobre el pool
completo **antes** de dividir en train/val/test. Se hace en la Fase 2.

### 4.5 Nota aparte: larvas

`cyberthorn/mosquitolarvae-7400-classification` (4 especies de larvas, microscopía) no sirve para
este modelo, pero es **muy interesante para el juego**: identificar larvas en agua estancada es
literalmente la mecánica de criaderos de Dengue Invaders. Queda anotado como idea futura, fuera
del alcance de este plan.

---

## 5. Estrategia de almacenamiento (restricción: no hay disco local)

Todo se mueve **nube a nube**; el disco de tu computadora nunca almacena el dataset.

```
Roboflow Universe ─┐
                   ├→ [Notebook de Kaggle: descarga, normaliza, dedup, split]
Kaggle Datasets   ─┘        ↓
                     Kaggle Dataset "mosquito-merged-vN"  (dataset congelado)
                            ↓
                     [Notebook de Kaggle: entrena en GPU]
                            ↓
                     Pesos exportados (5-25 MB)  →  descarga al Pi
```

- Los datasets se descargan **dentro del notebook de Kaggle** (API de Roboflow + `kagglehub`),
  nunca a tu máquina.
- Kaggle da ~20 GB de disco de trabajo por sesión y almacenamiento generoso para Datasets propios.
- Lo único que baja a tu computadora son los **pesos finales** (megabytes) para copiarlos al Pi.
- **Costo: 0** en este esquema, salvo que el plan gratuito de Roboflow no alcance (§9).

**Dos variantes a decidir en Fase 0:**

| | Variante A — Roboflow como dataset maestro | Variante B — Kaggle como dataset maestro |
|---|---|---|
| Curación/etiquetado | En Roboflow (mejor UI, autolabel) | En Roboflow solo para lo nuevo |
| Dataset consolidado | En Roboflow (cuenta contra la cuota) | En Kaggle Datasets (gratis, generoso) |
| Ventaja | Un solo lugar, versionado nativo | Barato, sin límite práctico |
| Recomendación | Si el plan de Roboflow lo permite | **Por defecto si hay dudas de cuota** |

En ambas, Roboflow es el **buzón de entrada + herramienta de etiquetado** del flywheel (§7).

---

## 6. Preprocesamiento y augmentación

**Regla clave: augmentar en tiempo de entrenamiento, no al generar la versión del dataset.**
La augmentación estática de Roboflow multiplica ×3 y ocupa cuota de almacenamiento con variedad
fija. La augmentación en el `DataLoader` (albumentations) da variedad infinita y cuesta 0 de
almacenamiento.

### 6.1 Transformaciones recomendadas

**Geométricas** (el mosquito aparece en cualquier orientación en una trampa):
- `HorizontalFlip`, `VerticalFlip`
- `Rotate(±180°)` — sí, completo
- `RandomResizedCrop(scale=0.7-1.0)`
- `ShiftScaleRotate` suave

**Fotométricas** — *las más importantes*, atacan directamente la brecha de §1.1 y tu pedido de
"distintas iluminaciones":
- `RandomBrightnessContrast(±0.25)`
- `RandomGamma`, `CLAHE`
- `HueSaturationValue` **suave** (ver §6.2)
- `ColorJitter`

**Degradación realista de captura** (simula fotos de celular/trampa):
- `ImageCompression(quality=40-90)` — artefactos JPEG de WhatsApp
- `ISONoise`, `GaussNoise`
- `MotionBlur` / `Defocus` **leves**
- `RandomShadow`, `RandomSunFlare` (ocasional)
- `CoarseDropout` chico (oclusión parcial: patas, malla de la trampa)

### 6.2 Lo que NO hay que hacer (específico de este dominio)

| Evitar | Por qué |
|---|---|
| Blur fuerte | Borra el dibujo del tórax, que es *el* rasgo que separa aegypti de albopictus |
| Escala de grises | Elimina las señales de color de patas y abdomen |
| Cambio de tono agresivo | Convierte un Culex marrón en algo que parece otra especie |
| Recortes muy agresivos | Puede dejar fuera el tórax, la región diagnóstica |

Una augmentación que destruye el rasgo diagnóstico no "regulariza": **enseña ruido**.

### 6.3 Preprocesamiento fijo
- Detector: letterbox a 416×416, normalización 0-1.
- Clasificador: recorte de la caja + **margen de ~15 %** (el contexto de patas ayuda), resize a
  224×224, normalización ImageNet.

---

## 7. El flywheel de reentrenamiento

Lo que pediste: que cada foto nueva (trampa o celular) alimente el próximo entrenamiento.

```
   Pi 4 / celular ──inferencia local──→ resultado al usuario
         │
         │  (si confianza < umbral  O  muestreo aleatorio ~5 %)
         ↓
   POST imagen + predicción + metadatos → proyecto "inbox" en Roboflow
         │
         ↓
   Revisión humana en Roboflow (la predicción viene como pre-anotación:
   se corrige, no se dibuja desde cero)
         │
         ↓
   Cada N imágenes nuevas (o mensual) → nueva versión del dataset
         │
         ↓
   Reentrenamiento en Kaggle (checkpoint = modelo anterior)
         │
         ↓
   ⚖️  Evaluación contra el TEST SET CONGELADO
         │
         ├─ mejor que el campeón → se promueve a producción
         └─ peor o igual → se descarta, el campeón sigue
```

### 7.1 Detalles que importan

- **Inferencia local, no por API.** El Pi corre el modelo offline (sin costo por llamada, sin
  internet obligatorio). El upload al buzón es un `POST` aparte, asíncrono y tolerante a fallos —
  si no hay red, se encola.
- **Metadatos en cada subida:** `fuente:trampa-01|celular`, `fecha`, `prediccion`, `confianza`,
  `version_modelo`, `zona`. Sin esto no se puede diagnosticar después por qué el modelo falla.
- **Qué subir:** baja confianza (lo más informativo) + un muestreo aleatorio (para detectar
  *deriva de distribución*, que las de baja confianza solas no capturan).
- **Nunca entrenar con pre-anotaciones sin revisar.** Si se entrena con las predicciones propias
  del modelo sin corregirlas, el modelo refuerza sus propios errores.
- **El test set se congela en la Fase 2 y no se toca nunca más.** Ni se augmenta, ni se le agregan
  imágenes nuevas, ni se reentrena sobre él. Es la única vara de medición honesta entre versiones.
  Si el test set cambia entre modelos, las comparaciones no significan nada.
- **Campeón/retador:** un modelo nuevo solo reemplaza al anterior si gana en el test congelado,
  con margen. Si no, se descarta.

### 7.2 Automatización
- Roboflow tiene **Active Learning** nativo, pero está pensado para inferencia *a través de*
  Roboflow. Como acá la inferencia es local, el upload se implementa a mano (son ~20 líneas).
- El reentrenamiento se puede disparar con un *scheduled notebook* de Kaggle (mensual) o a mano.
  Arrancar **a mano** y automatizar recién cuando el ciclo esté probado.

---

## 8. Fases de ejecución

### Fase 0 — Decisiones y cuentas · *sin código*
- [ ] Completar la autorización de Kaggle (hoy las búsquedas públicas funcionan, pero los
      endpoints de cuenta responden `Unauthenticated`).
- [ ] Verificar cuota del plan de Roboflow → decidir Variante A o B (§5).
- [ ] Crear cuenta de Weights & Biases, guardar la API key en *Kaggle Secrets*.
- [ ] Congelar la **taxonomía canónica**: `aegypti`, `albopictus`, `culex`, `anopheles`,
      `otro_mosquito`, `no_es_mosquito`.
- **Entregable:** `docs/TAXONOMIA.yaml` con el mapeo de cada etiqueta de cada fuente a la clase
  canónica (ej. `"Aedes aegypti landing"` → `aegypti`; `"An-tessellatus"` → `anopheles`).

### Fase 1 — Inventario y licencias
- [ ] Catálogo definitivo de fuentes con licencia, conteo y mapeo de clases.
- [ ] Verificar licencia una por una (no confiar en el tag de Universe sin mirar).
- [ ] Buscar dataset de insectos genéricos para negativos duros.
- **Entregable:** `docs/DATASET_SOURCES.md` + `ATTRIBUTION_DATASET.md` (CC BY exige crédito).

### Fase 2 — Consolidación del dataset *(el trabajo más importante y el más aburrido)*
- [ ] Notebook de Kaggle que descarga cada fuente vía API (nada al disco local).
- [ ] Normalizar etiquetas a la taxonomía canónica.
- [ ] **Deduplicar por pHash** entre todas las fuentes (§4.4).
- [ ] Split estratificado **por grupo** (recortes de la misma imagen original nunca se separan
      entre splits) → train 70 / val 15 / test 15.
- [ ] **Congelar el test set** y apartar dentro de él un subconjunto "tipo campo".
- [ ] Publicar como Kaggle Dataset `mosquito-merged-v1`.
- **Criterio de aceptación:** ≥ 25 000 imágenes utilizables, ≥ 1 500 por clase objetivo, 0
  duplicados cruzando splits, distribución de clases documentada.

### Fase 3 — Detector (Etapa A)
- [ ] Entrenar YOLO11n @ 416 px, todas las especies colapsadas a `mosquito`.
- [ ] Exportar ONNX INT8 (y NCNN para comparar).
- [ ] **Medir en el Pi 4 real** — acá se validan o se caen los números de §3.
- **Criterio de aceptación:** mAP@50 ≥ 0,85 · latencia ≤ 200 ms en Pi 4 · funciona con varios
  mosquitos por imagen.

### Fase 4 — Clasificador (Etapa B)
- [ ] Generar el dataset de recortes desde las cajas ground-truth (+15 % de margen).
- [ ] Entrenar MobileNetV4-Small con la augmentación de §6; manejar el desbalance
      (`anopheles` va a ser la clase rara) con *class weights* u *oversampling*.
- [ ] Exportar TFLite INT8 + ONNX; medir en Pi 4 y en un celular.
- **Criterio de aceptación:** F1 macro ≥ 0,85 · recall ≥ 0,80 **en cada clase** · latencia ≤ 30 ms
  por recorte · la clase `no_es_mosquito` efectivamente rechaza fotos de otros insectos.

### Fase 5 — Servicio de inferencia en el Pi
- [ ] Servicio Python (FastAPI + ONNX Runtime): `POST /identify` → `{especie, confianza, cajas[]}`.
- [ ] Umbral de confianza + respuesta explícita de "no estoy seguro".
- [ ] Cola local de subida al buzón (tolerante a falta de red).
- [ ] Servicio como `systemd unit`, arranque automático.
- **Criterio de aceptación:** end-to-end sobre una foto real de trampa, sin internet, en < 1 s.

### Fase 6 — Integración con el juego
- [ ] `CameraScene.js`: reemplazar la simulación por un `fetch()` al servicio del Pi (o al
      endpoint que se elija), manteniendo el flujo de UI que ya existe.
- [ ] Manejo de: sin conexión, baja confianza, `no_es_mosquito`.
- [ ] **Quitar la etiqueta "DEMO"** solo cuando el modelo sea real — y reemplazarla por la
      confianza real, no por una simulada.
- **Nota:** el trabajo de v4 dejó esto listo — la pantalla ya acepta foto de cámara/galería y ya
  existe el punto exacto donde hoy se inventa la especie.

### Fase 7 — Flywheel y producción
- [ ] Buzón en Roboflow + hook de subida desde el Pi.
- [ ] Ritmo de revisión/etiquetado definido (quién y cada cuánto).
- [ ] Notebook de reentrenamiento con *gate* campeón/retador sobre el test congelado.
- [ ] W&B para comparar corridas.
- [ ] Versionado de modelos en el Pi + rollback.
- **Criterio de aceptación:** un ciclo completo ejecutado de punta a punta (foto de campo →
  etiqueta → reentreno → evaluación → promoción o descarte).

---

## 9. Costos y límites a verificar

| Ítem | Situación | Acción |
|---|---|---|
| Kaggle GPU | ~30 h/semana gratis (P100/T4) | Sobra: cada entrenamiento son 1-3 h |
| Kaggle storage | Generoso para datasets propios | Verificar en Fase 0 |
| Roboflow plan gratuito | **Límite de imágenes a confirmar** | Si no alcanza: Variante B (§5), o hacer el proyecto público en Universe (suele levantar límites y encaja con la misión de salud pública de SEDES), o plan pago |
| RF-DETR NAS | Requiere plan Core/Growth | Opcional; optimiza arquitectura contra latencia del hardware objetivo. Lindo, no imprescindible |
| W&B | Gratis para uso personal | — |
| Coral USB | 60-80 USD | Solo si en el futuro hace falta video en tiempo real |

---

## 10. Qué NO hacer todavía

- **No empezar por el modelo.** El 80 % del resultado sale de la Fase 2 (consolidación limpia y
  deduplicada). Un dataset sucio con la mejor arquitectura rinde peor que un dataset limpio con
  YOLO11n.
- **No entrenar el clasificador en Roboflow.** Sus opciones (ViT/ResNet/DINOv3) no están pensadas
  para CPU ARM: un ResNet18 en Pi 4 son ~150-250 ms contra ~10 ms de MobileNetV4-Small.
- **No sacar la etiqueta "DEMO" del juego** hasta tener métricas reales sobre el test congelado.
- **No prometer diagnóstico.** Esto identifica *especies de mosquito*, no diagnostica dengue. El
  mismo criterio que ya aplica el proyecto al contenido educativo pendiente de revisión de SEDES.
- **No automatizar el reentrenamiento** antes de haber hecho un ciclo completo a mano.

---

## 11. Preguntas abiertas

### Resueltas (2026-09-16)

1. ~~**¿Variante A o B de almacenamiento?**~~ → **Variante B**: el dataset maestro vive en Kaggle.
   Cero riesgo de cuota de Roboflow, y es lo que el usuario ya proponía. Roboflow queda como
   buzón de entrada y herramienta de etiquetado del flywheel (§7).
2. ~~**¿Hay fotos propias de trampas?**~~ → **No, todavía no.** Hasta que existan, el sustituto
   para el test set "tipo campo" son `trapmos/mosquito-5wsj2` (imágenes de trampa) y
   `tickcitizenscience/mosquito-qi01f` (ciencia ciudadana, fotos de celular). Ambos marcados en
   `ml/dataset/fuentes.yaml`. **Apenas existan fotos propias, pasan a ser el test set real** —
   es el cambio que más va a mover la aguja del proyecto.

### Abiertas

3. ~~**Sistema operativo del Pi: ¿32 o 64 bits?**~~ → **Confirmado `aarch64` (2026-09-16)**.
   Diagnóstico real del Pi: kernel `6.1.21-v8+`, `PRETTY_NAME="Debian GNU/Linux 11 (bullseye)"`
   (así reporta Raspberry Pi OS de 64 bits — el de 32 bits diría "Raspbian", no "Debian"),
   Python 3.9.2, 4 núcleos, 7,6 GB RAM, 14 GB libres de disco, systemd 247. **Runtime: ONNX
   Runtime**, sin necesidad de TFLite ni de reinstalar el sistema operativo. Detalle completo en
   `ml/pi/diagnostico_pi.txt`.
   Sin cámara conectada en el momento del diagnóstico (`vcgencmd get_camera` → `detected=0`) —
   ver pregunta 7 más abajo: define si este Pi además captura fotos o solo sirve inferencia.
4. **¿Cuántas especies objetivo?** El juego usa 4. Los datasets traen `culiseta` y
   `japonicus/koreicus` sin costo extra. Hoy caen en `otro_mosquito`; ascenderlas a clases
   propias es cambiar una línea de `taxonomia.yaml` y regenerar.
5. **¿Sexo del mosquito?** `mosquito-itce6` y `mozziev3` traen macho/hembra. Solo la hembra pica
   — dato epidemiológicamente relevante que el juego ya enseña. Se puede agregar como segunda
   cabeza de clasificación en la Fase 4 sin tocar el dataset.
6. **¿El Pi sirve una sola trampa o es servidor central de varias?** Cambia el diseño del
   servicio (cola, concurrencia, almacenamiento local de imágenes).
7. ~~**¿Este Pi específico va a tener una cámara propia?**~~ → **Resuelto (2026-09-17): solo
   servidor de inferencia.** Las fotos llegan de otro lado (trampas con cámara propia en la red
   local, o el celular vía la app). El servicio de la Fase 5 es un endpoint `POST /identify` sin
   código de captura de cámara — más simple que el escenario alternativo.
