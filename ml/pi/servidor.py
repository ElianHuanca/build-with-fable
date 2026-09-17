"""
Fase 5 — servicio HTTP de inferencia para la Raspberry Pi.

El Pi es "solo servidor de inferencia" (decisión ya tomada, ver docs/PLAN_V5_MODELO_IA.md §11):
no captura sus propias fotos, las recibe de trampas con cámara propia o del celular.

Uso:
    POST /identify   (multipart/form-data, campo "foto")
    GET  /salud
"""

from __future__ import annotations

import io
from pathlib import Path

from flask import Flask, jsonify, request
from PIL import Image

from inferencia import MotorInferencia

CARPETA_MODELOS = Path(__file__).parent / "modelos"

app = Flask(__name__)
motor = MotorInferencia(CARPETA_MODELOS)


@app.get("/salud")
def salud():
    return jsonify({"estado": "ok"})


@app.post("/identify")
def identify():
    archivo = request.files.get("foto")
    if archivo is None:
        return jsonify({"error": "falta el campo 'foto' (multipart/form-data)"}), 400

    try:
        imagen = Image.open(io.BytesIO(archivo.read()))
    except Exception:
        return jsonify({"error": "no se pudo leer la imagen"}), 400

    resultados = motor.identificar(imagen)

    if not resultados:
        return jsonify({"mosquito_detectado": False, "detecciones": []})

    return jsonify({
        "mosquito_detectado": True,
        "detecciones": [
            {
                "caja": list(r.caja),
                "confianza_deteccion": round(r.confianza_deteccion, 4),
                "especie": r.especie,
                "confianza_especie": round(r.confianza_especie, 4),
                "seguro": r.seguro,
            }
            for r in resultados
        ],
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
