#!/usr/bin/env bash
# Descarga los artefactos entrenados (Fases 3 y 4) desde el output de los notebooks de Kaggle
# y los deja en ml/pi/modelos/ con los nombres que espera inferencia.py.
#
# Requiere KAGGLE_API_TOKEN en el entorno (rotar el token viejo antes de usar este script en
# un dispositivo nuevo, ver ml/README.md).
set -euo pipefail

if [ -z "${KAGGLE_API_TOKEN:-}" ]; then
    echo "❌ Falta KAGGLE_API_TOKEN en el entorno." >&2
    exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO="$DIR/modelos"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DESTINO"

echo "Bajando salida del detector..."
kaggle kernels output smn404/dengue-invaders-entrenar-detector -p "$TMP/detector"

echo "Bajando salida del clasificador..."
kaggle kernels output smn404/dengue-invaders-entrenar-clasificador -p "$TMP/clasificador"

buscar() { find "$1" -iname "$2" -print -quit; }

DET_ONNX="$(buscar "$TMP/detector" "best.onnx")"
CLS_ONNX="$(buscar "$TMP/clasificador" "clasificador_fp32.onnx")"
ETIQUETAS="$(buscar "$TMP/clasificador" "etiquetas.json")"
PREPROC="$(buscar "$TMP/clasificador" "preprocesado.json")"

for f in "$DET_ONNX" "$CLS_ONNX" "$ETIQUETAS" "$PREPROC"; do
    if [ -z "$f" ]; then
        echo "❌ No se encontró alguno de los archivos esperados en la salida de Kaggle." >&2
        echo "   Revisar a mano en $TMP" >&2
        exit 1
    fi
done

cp "$DET_ONNX" "$DESTINO/detector.onnx"
cp "$CLS_ONNX" "$DESTINO/clasificador.onnx"
cp "$ETIQUETAS" "$DESTINO/etiquetas.json"
cp "$PREPROC" "$DESTINO/preprocesado.json"

echo "✅ Modelos listos en $DESTINO:"
ls -lh "$DESTINO"
