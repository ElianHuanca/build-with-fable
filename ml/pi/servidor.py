"""
Fase 5 — servicio HTTP de inferencia para la Raspberry Pi.

El Pi es "solo servidor de inferencia" (decisión ya tomada, ver docs/PLAN_V5_MODELO_IA.md §11):
no captura sus propias fotos, las recibe de trampas con cámara propia o del celular.

Uso:
    POST /identify   (multipart/form-data, campo "foto")
    GET  /salud
    GET  /           (página HTML mínima para probar /identify a mano, con foto o cámara)

Cada foto recibida en /identify se guarda en ml/pi/subidas/ (imagen + .json con el resultado),
para el flywheel de reentrenamiento de la Fase 7. Ver docs/PLAN_V5_MODELO_IA.md §8.

Nota: por ahora no hay CORS habilitado, así que solo se puede llamar a /identify desde el mismo
origen (esta página) o con curl/apps nativas. Para que un frontend en OTRO dominio (p. ej. el
juego servido en Vercel) pueda llamarlo desde el navegador, hay que agregar flask-cors restringido
al dominio real una vez que se conozca — ver docs/DESPLIEGUE_INFERENCIA.md.
"""

from __future__ import annotations

import io
import json
import uuid
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template_string, request
from PIL import Image

from inferencia import MotorInferencia

CARPETA_MODELOS = Path(__file__).parent / "modelos"
CARPETA_SUBIDAS = Path(__file__).parent / "subidas"
CARPETA_SUBIDAS.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
motor = MotorInferencia(CARPETA_MODELOS)

PAGINA_PRUEBA = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dengue Invaders — prueba de inferencia</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 24px auto; padding: 0 16px; color: #222; }
  button { font-size: 16px; padding: 10px 16px; margin-top: 8px; }
  pre { background: #f2f2f2; padding: 12px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
  img { max-width: 100%; border-radius: 8px; margin-top: 12px; }
</style>
</head>
<body>
  <h1>🦟 Dengue Invaders — prueba de inferencia</h1>
  <p>Subí una foto o sacala con la cámara del celular para probar <code>/identify</code> directo contra este servidor.</p>
  <input id="foto" type="file" accept="image/*" capture="environment">
  <p><button id="enviar">Identificar</button></p>
  <img id="previa" style="display:none" alt="previsualización">
  <pre id="resultado"></pre>
  <script>
    const input = document.getElementById('foto');
    const previa = document.getElementById('previa');
    input.addEventListener('change', () => {
      const f = input.files[0];
      if (f) { previa.src = URL.createObjectURL(f); previa.style.display = 'block'; }
    });
    document.getElementById('enviar').addEventListener('click', async () => {
      const f = input.files[0];
      const resultado = document.getElementById('resultado');
      if (!f) { resultado.textContent = 'Elegí una foto primero.'; return; }
      resultado.textContent = 'Analizando...';
      const datos = new FormData();
      datos.append('foto', f);
      try {
        const resp = await fetch('/identify', { method: 'POST', body: datos });
        const json = await resp.json();
        resultado.textContent = JSON.stringify(json, null, 2);
      } catch (e) {
        resultado.textContent = 'Error: ' + e;
      }
    });
  </script>
</body>
</html>"""


@app.get("/")
def pagina_prueba():
    return render_template_string(PAGINA_PRUEBA)


def _guardar_subida(datos: bytes, formato: str | None, respuesta: dict) -> None:
    """Guarda cada foto recibida junto al resultado de la identificación, para el flywheel de
    reentrenamiento (Fase 7, ver docs/PLAN_V5_MODELO_IA.md §8: etiquetado → reentreno →
    evaluación). Un fallo de disco no debe tumbar la respuesta al cliente."""
    try:
        extension = (formato or "jpg").lower()
        nombre = f"{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}"
        (CARPETA_SUBIDAS / f"{nombre}.{extension}").write_bytes(datos)
        (CARPETA_SUBIDAS / f"{nombre}.json").write_text(
            json.dumps(respuesta, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        app.logger.exception("No se pudo guardar la foto subida en %s", CARPETA_SUBIDAS)


@app.get("/salud")
def salud():
    return jsonify({"estado": "ok"})


@app.post("/identify")
def identify():
    archivo = request.files.get("foto")
    if archivo is None:
        return jsonify({"error": "falta el campo 'foto' (multipart/form-data)"}), 400

    datos = archivo.read()
    try:
        imagen = Image.open(io.BytesIO(datos))
    except Exception:
        return jsonify({"error": "no se pudo leer la imagen"}), 400

    resultados = motor.identificar(imagen)

    if not resultados:
        respuesta = {"mosquito_detectado": False, "detecciones": []}
    else:
        respuesta = {
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
        }

    _guardar_subida(datos, imagen.format, respuesta)
    return jsonify(respuesta)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
