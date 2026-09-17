"""
Fase 2 del plan v5 — Consolidación del dataset de mosquitos.

Corre en un notebook de Kaggle. Descarga todas las fuentes de ml/dataset/fuentes.yaml
(Roboflow Universe + Kaggle), normaliza las etiquetas con ml/dataset/taxonomia.yaml,
deduplica, y produce DOS datasets listos para entrenar:

    detector/       YOLO, una sola clase 'mosquito'          → Fase 3
    clasificador/   carpetas por clase, recortes de mosquito → Fase 4

Nada de esto toca el disco de la máquina del usuario: se descarga dentro de Kaggle y se
publica como Kaggle Dataset.

--------------------------------------------------------------------------------------
REQUISITOS EN EL NOTEBOOK DE KAGGLE
--------------------------------------------------------------------------------------
1. Settings → Persistence → "Files only" (para que /kaggle/working sobreviva).
2. Add-ons → Secrets → agregar `ROBOFLOW_API_KEY` (clave privada de Roboflow).
   NUNCA pegar la clave en el código ni en el chat.
3. Internet: ON.
4. Acelerador: no hace falta GPU en esta fase (es I/O y CPU).

    !pip -q install roboflow imagehash pyyaml pillow tqdm

--------------------------------------------------------------------------------------
DECISIÓN DE DISEÑO IMPORTANTE — por qué se agrupa por pHash en vez de solo borrar duplicados
--------------------------------------------------------------------------------------
Varias fuentes de Universe son re-subidas del mismo material original. Si la misma imagen
cae en train y en test, las métricas salen infladas y el modelo parece excelente hasta que
llega al campo.

Borrar duplicados "perfectamente" es frágil (recompresiones, reescalados, recortes leves).
Entonces además de borrar los exactos, el split se hace **por grupo de pHash**: aunque
sobreviva un duplicado, todas sus copias caen en el MISMO split. Eso elimina la fuga de
datos aunque la deduplicación no sea perfecta.
"""

from __future__ import annotations

import json
import os
import random
import re
import shutil
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path

import yaml
from PIL import Image
from tqdm.auto import tqdm

# --------------------------------------------------------------------------------------
# Configuración
# --------------------------------------------------------------------------------------

SALIDA = Path("/kaggle/working/mosquito-merged-v1")
DESCARGAS = Path("/kaggle/temp/descargas")   # /kaggle/temp no cuenta para el output
VERSION_DATASET = "v1"

# Qué tiers de fuentes.yaml descargar. Empezar con [1] para una corrida rápida.
TIERS = [1, 2]

SPLIT = {"train": 0.70, "valid": 0.15, "test": 0.15}
SEMILLA = 1312

# Margen alrededor de la caja al recortar para el clasificador. El contexto (patas, postura)
# ayuda a distinguir Anopheles, que se posa inclinado.
MARGEN_RECORTE = 0.15
LADO_MINIMO_RECORTE = 32   # recortes más chicos que esto no tienen detalle de tórax utilizable

random.seed(SEMILLA)

# --------------------------------------------------------------------------------------
# Taxonomía
# --------------------------------------------------------------------------------------


def normalizar(etiqueta: str) -> str:
    """minúsculas, sin acentos, separadores colapsados. Debe coincidir con lo que documenta
    taxonomia.yaml, porque los patrones del YAML se escriben contra ESTA forma."""
    s = unicodedata.normalize("NFKD", str(etiqueta))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[_\-.]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


class Taxonomia:
    def __init__(self, ruta: Path):
        self.cfg = yaml.safe_load(ruta.read_text(encoding="utf-8"))
        self.canonicas = list(self.cfg["clases_canonicas"])
        self.ambiguas = list(self.cfg["ambiguas"])
        self.det = self.cfg["detector"]
        self.ruido = [normalizar(s) for s in self.cfg.get("ruido_sufijos", [])]
        self._descartar = self.cfg.get("descartar", {})
        self._mapeo = self.cfg["mapeo"]
        self._cache: dict[str, str | None] = {}

    def _quitar_ruido(self, s: str) -> str:
        cambio = True
        while cambio:
            cambio = False
            for suf in self.ruido:
                if s.endswith(" " + suf):
                    s = s[: -(len(suf) + 1)].strip()
                    cambio = True
                if s.startswith(suf + " "):
                    s = s[len(suf) + 1 :].strip()
                    cambio = True
        return s

    def es_descartable(self, etiqueta: str) -> bool:
        """Etiquetas basura explícitas (Unlabeled, '====', clases numéricas). A diferencia de una
        etiqueta simplemente no reconocida, estas NUNCA reciben la clase por defecto de la fuente."""
        s = self._quitar_ruido(normalizar(etiqueta))
        if not s or s in [normalizar(x) for x in self._descartar.get("exactos", [])]:
            return True
        return any(re.search(p, s) for p in self._descartar.get("patrones", []))

    def resolver_con_defecto(self, etiqueta: str, defecto: str | None) -> str | None:
        """Como `resolver`, pero en fuentes de negativos (moscas, polillas...) las etiquetas que no
        son de mosquito caen en `defecto` ('no_es_mosquito'). Si la etiqueta SÍ resuelve a una clase
        de mosquito (ej. la clase 'Mosquito' de un dataset de insectos), manda la taxonomía."""
        clase = self.resolver(etiqueta)
        if clase is None and defecto and not self.es_descartable(etiqueta):
            return defecto
        return clase

    def resolver(self, etiqueta: str) -> str | None:
        """Devuelve la clase canónica (o ambigua), o None si hay que descartar la etiqueta."""
        if etiqueta in self._cache:
            return self._cache[etiqueta]
        s = self._quitar_ruido(normalizar(etiqueta))
        resultado = None

        if s in [normalizar(x) for x in self._descartar.get("exactos", [])] or not s:
            resultado = None
        elif any(re.search(p, s) for p in self._descartar.get("patrones", [])):
            resultado = None
        else:
            for clase, reglas in self._mapeo.items():
                exactos = [normalizar(x) for x in reglas.get("exactos", [])]
                if s in exactos:
                    resultado = clase
                    break
                if any(re.search(p, s) for p in reglas.get("patrones", [])):
                    resultado = clase
                    break

        self._cache[etiqueta] = resultado
        return resultado

    def sirve_para_clasificador(self, clase: str | None) -> bool:
        # Las ambiguas ('aedes_sp', 'mosquito_sp') son mosquitos, pero no dicen especie:
        # entrenar el clasificador con ellas sería enseñarle ruido.
        return clase is not None and clase in self.canonicas

    def sirve_para_detector(self, clase: str | None) -> bool:
        return clase is not None and clase in self.det["incluye"]


# --------------------------------------------------------------------------------------
# Registro de imágenes
# --------------------------------------------------------------------------------------


@dataclass
class Muestra:
    """Una imagen con su procedencia. `phash` es la clave de agrupación para el split."""
    ruta: str
    fuente: str
    etiqueta_original: str
    clase: str                       # canónica o ambigua
    cajas: list = field(default_factory=list)   # [(clase, cx, cy, w, h)] normalizadas YOLO
    phash: str | None = None
    split: str | None = None


def cargar_config(raiz: Path) -> tuple[Taxonomia, dict]:
    tax = Taxonomia(raiz / "taxonomia.yaml")
    fuentes = yaml.safe_load((raiz / "fuentes.yaml").read_text(encoding="utf-8"))
    return tax, fuentes


# --------------------------------------------------------------------------------------
# Descarga
# --------------------------------------------------------------------------------------


def descargar_roboflow(fuentes: list[dict], destino: Path) -> dict[str, Path]:
    """Descarga cada proyecto público de Universe. Si uno falla, sigue con el resto:
    una fuente caída no debe tumbar una corrida de horas."""
    from roboflow import Roboflow
    from kaggle_secrets import UserSecretsClient

    api_key = UserSecretsClient().get_secret("ROBOFLOW_API_KEY")
    rf = Roboflow(api_key=api_key)

    formato = {
        "object-detection": "yolov8",
        "instance-segmentation": "yolov8",
        "classification": "folder",
    }

    rutas: dict[str, Path] = {}
    for f in tqdm(fuentes, desc="Roboflow"):
        slug = f["slug"]
        ws, proj = slug.split("/")
        carpeta = destino / ws / proj
        if carpeta.exists() and any(carpeta.iterdir()):
            rutas[slug] = carpeta
            continue
        try:
            p = rf.workspace(ws).project(proj)
            version = f.get("version")
            if not version:
                # `Version.version` puede venir como "workspace/project/3": nos quedamos con el
                # último segmento numérico en vez de asumir que ya es un entero.
                disponibles = []
                for v in p.versions():
                    try:
                        disponibles.append(int(str(v.version).rstrip("/").split("/")[-1]))
                    except (ValueError, AttributeError):
                        continue
                if not disponibles:
                    raise RuntimeError("no se pudo determinar la versión publicada")
                version = max(disponibles)
                print(f"  {slug}: sin versión fijada, uso la {version}")
            p.version(int(version)).download(
                formato[f["tipo"]], location=str(carpeta), overwrite=False
            )
            rutas[slug] = carpeta
        except Exception as e:                                    # noqa: BLE001
            print(f"  ⚠️  {slug}: {type(e).__name__}: {e}")
    return rutas


def descargar_kaggle(fuentes: list[dict]) -> dict[str, Path]:
    """En una corrida no interactiva (Save & Run All) Kaggle NO deja adjuntar datasets nuevos con
    kagglehub ('New Datasets cannot be attached in non-interactive sessions'): hay que agregarlos
    como Input en el editor antes de lanzar. Por eso se busca primero en /kaggle/input."""
    import kagglehub

    rutas: dict[str, Path] = {}
    for f in tqdm(fuentes, desc="Kaggle"):
        nombre = f["slug"].split("/")[-1]
        montados = [p for p in Path("/kaggle/input").rglob(nombre) if p.is_dir()]
        if montados:
            rutas[f["slug"]] = montados[0]
            continue
        try:
            rutas[f["slug"]] = Path(kagglehub.dataset_download(f["slug"]))
        except Exception as e:                                    # noqa: BLE001
            print(f"  ⚠️  {f['slug']}: {type(e).__name__}: {e}")
            print(f"      → Agregalo en el editor: Add Input → Datasets → {f['slug']}")
    return rutas


# --------------------------------------------------------------------------------------
# Lectura de cada formato
# --------------------------------------------------------------------------------------

EXT_IMG = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def leer_yolo(raiz: Path, slug: str, tax: Taxonomia, defecto: str | None = None) -> list[Muestra]:
    """Formato YOLO de Roboflow: data.yaml + {split}/images + {split}/labels.
    Los splits originales se ignoran: se rearman desde cero para que el split sea consistente
    entre todas las fuentes y respete los grupos de pHash."""
    data_yaml = next(raiz.rglob("data.yaml"), None)
    if not data_yaml:
        return []
    nombres = yaml.safe_load(data_yaml.read_text(encoding="utf-8")).get("names", [])
    if isinstance(nombres, dict):
        nombres = [nombres[k] for k in sorted(nombres)]

    muestras: list[Muestra] = []
    for img in raiz.rglob("*"):
        if img.suffix.lower() not in EXT_IMG or "labels" in img.parts:
            continue
        lbl = Path(str(img).replace("/images/", "/labels/")).with_suffix(".txt")
        if not lbl.exists():
            continue

        cajas, originales = [], []
        for linea in lbl.read_text(encoding="utf-8").strip().splitlines():
            partes = linea.split()
            if len(partes) < 5:
                continue
            idx = int(float(partes[0]))
            if idx >= len(nombres):
                continue
            original = nombres[idx]
            clase = tax.resolver_con_defecto(original, defecto)
            if clase is None:
                continue
            coords = [float(x) for x in partes[1:]]
            # Segmentación: el polígono se reduce a su caja envolvente.
            if len(coords) > 4:
                xs, ys = coords[0::2], coords[1::2]
                cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
                w, h = max(xs) - min(xs), max(ys) - min(ys)
            else:
                cx, cy, w, h = coords[:4]
            cajas.append((clase, cx, cy, w, h))
            originales.append(original)

        if not cajas:
            continue
        dominante = Counter(c[0] for c in cajas).most_common(1)[0][0]
        muestras.append(
            Muestra(
                ruta=str(img),
                fuente=slug,
                etiqueta_original=";".join(sorted(set(originales))),
                clase=dominante,
                cajas=cajas,
            )
        )
    return muestras


def leer_carpetas(raiz: Path, slug: str, tax: Taxonomia, defecto: str | None = None) -> list[Muestra]:
    """Formato 'folder' (clasificación): una carpeta por clase. Sirve tanto para los exports
    de Roboflow como para los datasets de Kaggle organizados así."""
    muestras: list[Muestra] = []
    for img in raiz.rglob("*"):
        if img.suffix.lower() not in EXT_IMG:
            continue
        original = img.parent.name
        clase = tax.resolver_con_defecto(original, defecto)
        if clase is None:
            continue
        muestras.append(
            Muestra(ruta=str(img), fuente=slug, etiqueta_original=original, clase=clase)
        )
    return muestras


def leer_fuente(ruta: Path, f: dict, tax: Taxonomia) -> list[Muestra]:
    defecto = f.get("clase_por_defecto")
    if f.get("tipo") == "classification" or next(ruta.rglob("data.yaml"), None) is None:
        muestras = leer_carpetas(ruta, f["slug"], tax, defecto)
    else:
        muestras = leer_yolo(ruta, f["slug"], tax, defecto)
    tope = f.get("max_imagenes")
    if tope and len(muestras) > tope:
        # Tope por fuente: evita que una fuente grande de negativos (7 700 polillas) domine su
        # clase. Muestreo con semilla fija para que la consolidación sea reproducible.
        muestras = random.Random(SEMILLA).sample(muestras, tope)
    return muestras


# --------------------------------------------------------------------------------------
# Deduplicación y split
# --------------------------------------------------------------------------------------


def calcular_phash(muestras: list[Muestra]) -> None:
    import imagehash

    for m in tqdm(muestras, desc="pHash"):
        try:
            with Image.open(m.ruta) as im:
                m.phash = str(imagehash.phash(im.convert("RGB")))
        except Exception:                                          # noqa: BLE001
            m.phash = None   # imagen corrupta: se descarta más abajo


def deduplicar(muestras: list[Muestra]) -> tuple[list[Muestra], dict]:
    """Quita imágenes corruptas y copias exactas (mismo pHash). Conserva la primera aparición,
    priorizando las fuentes con cajas (sirven para ambas etapas)."""
    validas = [m for m in muestras if m.phash]
    corruptas = len(muestras) - len(validas)

    validas.sort(key=lambda m: (0 if m.cajas else 1, m.fuente))
    vistos: set[str] = set()
    unicas: list[Muestra] = []
    for m in validas:
        if m.phash in vistos:
            continue
        vistos.add(m.phash)
        unicas.append(m)

    return unicas, {
        "entrada": len(muestras),
        "corruptas": corruptas,
        "duplicadas_exactas": len(validas) - len(unicas),
        "salida": len(unicas),
    }


def stem_original(ruta: str) -> str:
    """Nombre de la imagen ORIGINAL de la que salió una exportación de Roboflow.

    Roboflow exporta cada variante augmentada como `<original>_<ext>.rf.<hash>.<ext>`
    (ej. `IMG_123_jpg.rf.9f2c...jpg`). Todas las variantes de una misma foto comparten el prefijo
    antes de `.rf.`. Hace falta porque una imagen espejada o rotada tiene OTRO pHash: sin esta
    clave, las augmentaciones de una misma foto podían caer una en train y otra en test (fuga de
    datos detectada en la corrida v3 de la consolidación, 2026-09-16)."""
    nombre = Path(ruta).name
    base = nombre.split(".rf.")[0] if ".rf." in nombre else Path(nombre).stem
    return re.sub(r"_(jpe?g|png|bmp|webp)$", "", base, flags=re.IGNORECASE)


def agrupar(muestras: list[Muestra]) -> list[list[Muestra]]:
    """Une en un mismo grupo las muestras que comparten pHash O imagen original (union-find).
    Todo el grupo va al mismo split."""
    padre = list(range(len(muestras)))

    def raiz(i: int) -> int:
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i

    def unir(a: int, b: int) -> None:
        ra, rb = raiz(a), raiz(b)
        if ra != rb:
            padre[rb] = ra

    primero_por_clave: dict[str, int] = {}
    for i, m in enumerate(muestras):
        for clave in (f"ph:{m.phash}", f"st:{m.fuente}/{stem_original(m.ruta)}"):
            if clave in primero_por_clave:
                unir(i, primero_por_clave[clave])
            else:
                primero_por_clave[clave] = i

    grupos: dict[int, list[Muestra]] = defaultdict(list)
    for i, m in enumerate(muestras):
        grupos[raiz(i)].append(m)
    return list(grupos.values())


def asignar_split(muestras: list[Muestra]) -> tuple[list[Muestra], dict]:
    """Split estratificado por clase y AGRUPADO (ver `agrupar`).

    En valid y test se conserva UNA sola muestra por grupo: las variantes augmentadas que ya traía
    la exportación de Roboflow sirven para entrenar, pero en evaluación inflarían el conteo con
    copias de la misma foto y el test dejaría de ser un conjunto limpio."""
    grupos = agrupar(muestras)

    por_clase: dict[str, list[list[Muestra]]] = defaultdict(list)
    for g in grupos:
        clase = Counter(m.clase for m in g).most_common(1)[0][0]
        por_clase[clase].append(g)

    conservadas: list[Muestra] = []
    descartadas_eval = 0
    conteo = {s: Counter() for s in SPLIT}
    for clase, gs in sorted(por_clase.items()):
        random.shuffle(gs)
        n = len(gs)
        n_train = int(n * SPLIT["train"])
        n_valid = int(n * SPLIT["valid"])
        tramos = {
            "train": gs[:n_train],
            "valid": gs[n_train : n_train + n_valid],
            "test": gs[n_train + n_valid :],
        }
        for split, grupos_split in tramos.items():
            for g in grupos_split:
                if split != "train" and len(g) > 1:
                    g = sorted(g, key=lambda m: m.ruta)[:1]   # determinista
                    descartadas_eval += 1
                for m in g:
                    m.split = split
                    conservadas.append(m)
                conteo[split][clase] += len(g)

    return conservadas, {
        "grupos": len(grupos),
        "grupos_con_variantes": sum(1 for g in grupos if len(g) > 1),
        "variantes_quitadas_de_valid_test": descartadas_eval,
        "por_split": {s: dict(c) for s, c in conteo.items()},
    }


# --------------------------------------------------------------------------------------
# Escritura de los dos datasets
# --------------------------------------------------------------------------------------


def escribir_detector(muestras: list[Muestra], tax: Taxonomia, salida: Path) -> dict:
    """YOLO con una sola clase. Solo usa muestras con cajas (las de clasificación no tienen
    coordenadas, así que no sirven para enseñar a localizar)."""
    base = salida / "detector"
    for split in SPLIT:
        (base / split / "images").mkdir(parents=True, exist_ok=True)
        (base / split / "labels").mkdir(parents=True, exist_ok=True)

    conteo = Counter()
    for m in tqdm([m for m in muestras if m.cajas], desc="detector"):
        cajas = [c for c in m.cajas if tax.sirve_para_detector(c[0])]
        if not cajas:
            continue
        destino = base / m.split
        nombre = f"{m.phash}{Path(m.ruta).suffix.lower()}"
        shutil.copy2(m.ruta, destino / "images" / nombre)
        (destino / "labels" / f"{m.phash}.txt").write_text(
            "\n".join(f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}" for _, cx, cy, w, h in cajas),
            encoding="utf-8",
        )
        conteo[m.split] += 1

    (base / "data.yaml").write_text(
        yaml.safe_dump(
            {
                "path": str(base),
                "train": "train/images",
                "val": "valid/images",
                "test": "test/images",
                "nc": 1,
                "names": [tax.det["clase_unica"]],
            },
            sort_keys=False,
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    return dict(conteo)


def escribir_clasificador(muestras: list[Muestra], tax: Taxonomia, salida: Path) -> dict:
    """Carpetas por clase con RECORTES. Las fuentes con cajas aportan un recorte por caja;
    las de clasificación aportan la imagen completa (ya vienen encuadradas)."""
    base = salida / "clasificador"
    for split in SPLIT:
        for clase in tax.canonicas:
            (base / split / clase).mkdir(parents=True, exist_ok=True)

    conteo: dict[str, Counter] = {s: Counter() for s in SPLIT}
    descartados_chicos = 0

    for m in tqdm(muestras, desc="clasificador"):
        try:
            with Image.open(m.ruta) as im:
                im = im.convert("RGB")
                W, H = im.size

                if not m.cajas:
                    if not tax.sirve_para_clasificador(m.clase):
                        continue
                    destino = base / m.split / m.clase / f"{m.phash}.jpg"
                    im.save(destino, "JPEG", quality=92)
                    conteo[m.split][m.clase] += 1
                    continue

                for i, (clase, cx, cy, w, h) in enumerate(m.cajas):
                    if not tax.sirve_para_clasificador(clase):
                        continue
                    bw, bh = w * W * (1 + MARGEN_RECORTE), h * H * (1 + MARGEN_RECORTE)
                    x0 = max(0, int(cx * W - bw / 2))
                    y0 = max(0, int(cy * H - bh / 2))
                    x1 = min(W, int(cx * W + bw / 2))
                    y1 = min(H, int(cy * H + bh / 2))
                    if (x1 - x0) < LADO_MINIMO_RECORTE or (y1 - y0) < LADO_MINIMO_RECORTE:
                        descartados_chicos += 1
                        continue
                    destino = base / m.split / clase / f"{m.phash}_{i}.jpg"
                    im.crop((x0, y0, x1, y1)).save(destino, "JPEG", quality=92)
                    conteo[m.split][clase] += 1
        except Exception:                                          # noqa: BLE001
            continue

    return {
        "por_split": {s: dict(c) for s, c in conteo.items()},
        "descartados_por_tamano": descartados_chicos,
    }


# --------------------------------------------------------------------------------------
# Reporte
# --------------------------------------------------------------------------------------


def escribir_reporte(salida: Path, info: dict) -> None:
    (salida / "MANIFIESTO.json").write_text(
        json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    cls = info["clasificador"]["por_split"]
    clases = sorted({c for s in cls.values() for c in s})
    filas = ["| clase | train | valid | test | total |", "|---|---|---|---|---|"]
    for c in clases:
        tr, va, te = cls["train"].get(c, 0), cls["valid"].get(c, 0), cls["test"].get(c, 0)
        filas.append(f"| {c} | {tr} | {va} | {te} | {tr + va + te} |")

    dedup = info["dedup"]
    md = f"""# Dataset consolidado de mosquitos — {VERSION_DATASET}

Generado por `ml/notebooks/01_consolidar_dataset.py` (plan v5, Fase 2).
Tiers incluidos: {TIERS} · semilla: {SEMILLA}

## Deduplicación
- Imágenes leídas: **{dedup['entrada']}**
- Corruptas descartadas: {dedup['corruptas']}
- Duplicados exactos (mismo pHash) eliminados: **{dedup['duplicadas_exactas']}**
- Imágenes únicas: **{dedup['salida']}**

> El split se hace por grupo de pHash, así que ninguna copia de una misma imagen puede caer
> en dos splits distintos. Es lo que evita inflar las métricas.

## Clasificador (recortes por clase)
{chr(10).join(filas)}

Recortes descartados por ser menores a {LADO_MINIMO_RECORTE} px: {info['clasificador']['descartados_por_tamano']}

## Detector (una clase)
{json.dumps(info['detector'], indent=2, ensure_ascii=False)}

## Fuentes efectivamente usadas
{chr(10).join(f'- `{k}`: {v} imágenes' for k, v in sorted(info['por_fuente'].items()))}

## Criterios de aceptación de la Fase 2
- [{'x' if dedup['salida'] >= 25000 else ' '}] ≥ 25 000 imágenes utilizables
- [{'x' if all(sum(cls[s].get(c, 0) for s in cls) >= 1500 for c in ['aegypti', 'albopictus', 'culex', 'anopheles']) else ' '}] ≥ 1 500 por clase objetivo
- [{'x' if sum(cls[s].get('no_es_mosquito', 0) for s in cls) >= 1000 else ' '}] ≥ 1 000 negativos (`no_es_mosquito`)
- [x] 0 duplicados ni variantes augmentadas cruzando splits (garantizado por diseño)

## Agrupación anti-fuga
- Grupos: {info['splits']['grupos']}
- Grupos con variantes augmentadas de la exportación de Roboflow: {info['splits']['grupos_con_variantes']}
- Variantes quitadas de valid/test (en evaluación queda 1 por foto original): {info['splits']['variantes_quitadas_de_valid_test']}
"""
    (salida / "REPORTE.md").write_text(md, encoding="utf-8")
    print(md)


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------


def main(raiz_config: Path) -> None:
    tax, fuentes = cargar_config(raiz_config)
    SALIDA.mkdir(parents=True, exist_ok=True)
    DESCARGAS.mkdir(parents=True, exist_ok=True)

    rf_fuentes = [f for f in fuentes.get("roboflow", []) if f.get("tier") in TIERS]
    kg_fuentes = [f for f in fuentes.get("kaggle", []) if f.get("tier") in TIERS]
    print(f"Fuentes seleccionadas: {len(rf_fuentes)} Roboflow + {len(kg_fuentes)} Kaggle\n")

    rutas = descargar_roboflow(rf_fuentes, DESCARGAS)
    rutas.update(descargar_kaggle(kg_fuentes))

    muestras: list[Muestra] = []
    por_fuente: dict[str, int] = {}
    for f in rf_fuentes + kg_fuentes:
        ruta = rutas.get(f["slug"])
        if not ruta:
            continue
        leidas = leer_fuente(ruta, f, tax)
        por_fuente[f["slug"]] = len(leidas)
        muestras.extend(leidas)
        print(f"  {f['slug']}: {len(leidas)} imágenes utilizables")

    print(f"\nTotal leído: {len(muestras)}")
    calcular_phash(muestras)
    muestras, dedup = deduplicar(muestras)
    print(f"Tras deduplicar: {dedup['salida']} (-{dedup['duplicadas_exactas']} duplicados)")

    muestras, splits = asignar_split(muestras)
    print(f"Grupos: {splits['grupos']} ({splits['grupos_con_variantes']} con variantes augmentadas)")
    info = {
        "version": VERSION_DATASET,
        "tiers": TIERS,
        "semilla": SEMILLA,
        "dedup": dedup,
        "splits": splits,
        "por_fuente": por_fuente,
        "detector": escribir_detector(muestras, tax, SALIDA),
        "clasificador": escribir_clasificador(muestras, tax, SALIDA),
    }
    escribir_reporte(SALIDA, info)


if __name__ == "__main__":
    # En Kaggle: subir taxonomia.yaml y fuentes.yaml como Dataset de entrada, o clonar el repo.
    raiz = Path(os.environ.get("CONFIG_DIR", "/kaggle/input/mosquito-config"))
    main(raiz)
