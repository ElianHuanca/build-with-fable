"""
Verifica que taxonomia.yaml mapea correctamente las etiquetas REALES de cada fuente.

Las etiquetas de abajo están copiadas literalmente de lo que devolvió la búsqueda en Roboflow
Universe / Kaggle el 2026-09-16 (espacios sobrantes y errores de tipeo incluidos: son reales).

Correr antes de lanzar la consolidación en Kaggle:

    python ml/dataset/test_taxonomia.py

Un fallo acá significa que la consolidación va a etiquetar mal miles de imágenes.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "notebooks"))

import importlib.util

spec = importlib.util.spec_from_file_location(
    "consolidar", Path(__file__).resolve().parents[1] / "notebooks" / "01_consolidar_dataset.py"
)
consolidar = importlib.util.module_from_spec(spec)
sys.modules["consolidar"] = consolidar
spec.loader.exec_module(consolidar)

tax = consolidar.Taxonomia(Path(__file__).parent / "taxonomia.yaml")

# (etiqueta real, clase canónica esperada) — None = debe descartarse
CASOS: list[tuple[str, str | None]] = [
    # --- aegypti (11 variantes reales entre las fuentes) ---
    ("Aedes aegypti", "aegypti"),
    ("aedes aegypti ", "aegypti"),          # denguemetric: espacio final real
    ("Aedes_aegypti", "aegypti"),
    ("Aedes Aegypti", "aegypti"),
    ("aegypti", "aegypti"),
    ("Ae-aegypti", "aegypti"),
    ("Aedes aegypti Female", "aegypti"),
    ("Aedes aegypti Male", "aegypti"),
    ("Aedes aegypti landing", "aegypti"),
    ("Aedes aegypti smashed", "aegypti"),
    ("aegypti smashed", "aegypti"),
    # --- albopictus ---
    ("Aedes albopictus", "albopictus"),
    ("Aedes_albobictus", "albopictus"),     # mosquito-itce6: error de tipeo real
    ("Ae-albopictus", "albopictus"),
    ("albopictus", "albopictus"),
    ("Aedes albopictus Female", "albopictus"),
    ("albopictus landing", "albopictus"),
    ("Aedes  albopictus landing", "albopictus"),   # doble espacio real
    # --- culex ---
    ("Culex", "culex"),
    ("culex", "culex"),
    ("Cx-quinquefasciatus", "culex"),
    ("Culex quinquefasciatus landing", "culex"),
    ("Culex quinquefasciatus Male", "culex"),
    ("Culex tritaeniorhynchus Female", "culex"),
    ("Cx-vishnui", "culex"),
    ("Culex erythrothorax", "culex"),
    ("Culex tarsalis", "culex"),
    ("CULEX", "culex"),
    # --- anopheles (incluye especies sin género en la etiqueta) ---
    ("anopheles", "anopheles"),
    ("ANOPHELES", "anopheles"),
    ("An-tessellatus", "anopheles"),
    ("Anopheles_stephensi", "anopheles"),
    ("Anopheles culiciformis", "anopheles"),
    ("Anopheles_barbirostris", "anopheles"),
    ("gambiae", "anopheles"),
    ("funestus", "anopheles"),
    ("coustani", "anopheles"),
    ("quadrimaculatus", "anopheles"),
    ("punctipennis", "anopheles"),
    ("crucians", "anopheles"),
    # --- otro_mosquito ---
    ("culiseta", "otro_mosquito"),
    ("Culiseta inornata", "otro_mosquito"),
    ("japonicus-koreicus", "otro_mosquito"),
    ("Armigeres_subalbatus", "otro_mosquito"),
    ("Ae-vexans", "otro_mosquito"),
    ("Aedes vittatus Female", "otro_mosquito"),
    ("Non Aedes", "otro_mosquito"),         # es mosquito, NO es 'no_es_mosquito'
    ("non_aedes", "otro_mosquito"),
    # --- no_es_mosquito ---
    ("Debris", "no_es_mosquito"),
    ("Insect", "no_es_mosquito"),
    # --- ambiguas: mosquito sí, especie no ---
    ("AEDES", "aedes_sp"),
    ("aedes", "aedes_sp"),
    ("Mosquito", "mosquito_sp"),
    ("mosquito", "mosquito_sp"),
    ("objects", "mosquito_sp"),
    ("moustique", "mosquito_sp"),
    ("ka", "mosquito_sp"),
    # --- descartar ---
    ("Unlabeled", None),
    ("==============================", None),
    ("0", None),
    ("- Mosquito Detection - 2023-10-18 12-12am", None),
    ("", None),
]

fallos = []
for etiqueta, esperado in CASOS:
    obtenido = tax.resolver(etiqueta)
    if obtenido != esperado:
        fallos.append((etiqueta, esperado, obtenido))

print(f"Casos probados: {len(CASOS)}")
if fallos:
    print(f"\n[FALLOS] {len(fallos)}:\n")
    for etiqueta, esperado, obtenido in fallos:
        print(f"  {etiqueta!r}\n      esperado: {esperado}\n      obtenido: {obtenido}")
    sys.exit(1)

# --- Fuentes de negativos con clase_por_defecto: 'no_es_mosquito' ---
# Etiquetas reales de insect_detect_classification, insects-2fw0a y moth-juac0. Ninguna debe caer
# por accidente en una especie de mosquito (un patrón demasiado amplio lo haría), y la clase
# 'Mosquito' que trae el dataset de insectos NO debe convertirse en negativo.
NEGATIVOS = [
    ("fly", "no_es_mosquito"), ("hbee", "no_es_mosquito"), ("hovfly", "no_es_mosquito"),
    ("wasp", "no_es_mosquito"), ("shadow", "no_es_mosquito"), ("other", "no_es_mosquito"),
    ("episyr_balt", "no_es_mosquito"), ("Fruit Flies", "no_es_mosquito"),
    ("Aphids", "no_es_mosquito"), ("Grasshopper", "no_es_mosquito"),
    ("Spider Mites", "no_es_mosquito"), ("Colorado Potato Beetles", "no_es_mosquito"),
    ("Africanized Honey Bees (Killer Bees)", "no_es_mosquito"),
    ("ATLAS MOTH", "no_es_mosquito"), ("DEATHS HEAD HAWK MOTH", "no_es_mosquito"),
    ("HORNET MOTH", "no_es_mosquito"), ("CLEARWING MOTH", "no_es_mosquito"),
    ("Mosquito", "mosquito_sp"),          # el mosquito del dataset de insectos NO es negativo
    ("Unlabeled", None),                  # basura explícita: nunca recibe la clase por defecto
]
for etiqueta, esperado in NEGATIVOS:
    obtenido = tax.resolver_con_defecto(etiqueta, "no_es_mosquito")
    if obtenido != esperado:
        fallos.append((f"[defecto] {etiqueta}", esperado, obtenido))
if fallos:
    for etiqueta, esperado, obtenido in fallos:
        print(f"  {etiqueta!r} esperado={esperado} obtenido={obtenido}")
    sys.exit(1)
print(f"Negativos probados: {len(NEGATIVOS)}")

# Stem original de exportaciones de Roboflow (clave anti-fuga de augmentaciones)
assert consolidar.stem_original("/x/IMG_123_jpg.rf.9f2c1a.jpg") == "IMG_123"
assert consolidar.stem_original("/x/IMG_123_jpg.rf.77aa00.jpg") == "IMG_123"
assert consolidar.stem_original("/x/foto-sin-roboflow.png") == "foto-sin-roboflow"

# Chequeos de coherencia del propio YAML
assert tax.sirve_para_clasificador("aegypti")
assert not tax.sirve_para_clasificador("aedes_sp"), "las ambiguas no deben entrar al clasificador"
assert not tax.sirve_para_clasificador("mosquito_sp")
assert tax.sirve_para_detector("aedes_sp"), "las ambiguas SÍ deben entrar al detector"
assert tax.sirve_para_detector("otro_mosquito")
assert not tax.sirve_para_detector("no_es_mosquito")

print("[OK] Taxonomia correcta: todas las etiquetas reales mapean como se espera.")
