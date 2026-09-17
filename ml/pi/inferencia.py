"""
Fase 5 — motor de inferencia (detector + clasificador encadenados).

Solo depende de onnxruntime + numpy + Pillow. Nada de PyTorch/TensorFlow en el Pi.

Reproduce el mismo preprocesado usado en el entrenamiento:
- Detector (02_entrenar_detector.py): letterbox a IMGSZ, salida YOLO cruda (sin NMS, hay
  que aplicarlo acá).
- Clasificador (03_entrenar_clasificador.py): letterbox a 224 sin deformar + normalización
  ImageNet — MISMOS valores que preprocesado.json, que hay que descargar junto al modelo
  (no se hardcodean acá para no desincronizarse si se reentrena).
- Recorte del detector al clasificador con el mismo margen que 01_consolidar_dataset.py
  (MARGEN_RECORTE) para no correr el clasificador con una distribución distinta a la de
  entrenamiento.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

MARGEN_RECORTE = 0.15  # igual que ml/notebooks/01_consolidar_dataset.py
LADO_MINIMO_RECORTE = 32

DETECTOR_CONF_MINIMA = 0.35
DETECTOR_IOU_NMS = 0.45
CLASIFICADOR_CONFIANZA_MINIMA = 0.55  # por debajo de esto, "no estoy seguro" en vez de forzar especie


@dataclass
class Deteccion:
    caja: tuple[int, int, int, int]  # x0, y0, x1, y1 en píxeles de la imagen original
    confianza: float


@dataclass
class Identificacion:
    caja: tuple[int, int, int, int]
    confianza_deteccion: float
    especie: str
    confianza_especie: float
    seguro: bool


def _letterbox(imagen: np.ndarray, lado: int, relleno: int = 114) -> tuple[np.ndarray, float, int, int]:
    """Redimensiona preservando proporción y rellena a lado x lado. Devuelve la imagen,
    la escala aplicada y el padding (para poder revertirlo al mapear cajas de vuelta)."""
    h, w = imagen.shape[:2]
    escala = min(lado / h, lado / w)
    nh, nw = round(h * escala), round(w * escala)
    redimensionada = np.array(Image.fromarray(imagen).resize((nw, nh), Image.BILINEAR))
    lienzo = np.full((lado, lado, 3), relleno, dtype=np.uint8)
    pad_y, pad_x = (lado - nh) // 2, (lado - nw) // 2
    lienzo[pad_y:pad_y + nh, pad_x:pad_x + nw] = redimensionada
    return lienzo, escala, pad_x, pad_y


def _nms(cajas: np.ndarray, puntajes: np.ndarray, iou_umbral: float) -> list[int]:
    """NMS clásico en numpy puro — sin dependencias extra."""
    x0, y0, x1, y1 = cajas[:, 0], cajas[:, 1], cajas[:, 2], cajas[:, 3]
    areas = (x1 - x0) * (y1 - y0)
    orden = puntajes.argsort()[::-1]
    mantener = []
    while orden.size > 0:
        i = orden[0]
        mantener.append(int(i))
        resto = orden[1:]
        xx0 = np.maximum(x0[i], x0[resto])
        yy0 = np.maximum(y0[i], y0[resto])
        xx1 = np.minimum(x1[i], x1[resto])
        yy1 = np.minimum(y1[i], y1[resto])
        inter = np.maximum(0, xx1 - xx0) * np.maximum(0, yy1 - yy0)
        iou = inter / (areas[i] + areas[resto] - inter + 1e-9)
        orden = resto[iou <= iou_umbral]
    return mantener


class MotorInferencia:
    def __init__(self, carpeta_modelos: Path):
        carpeta_modelos = Path(carpeta_modelos)
        opciones = ort.SessionOptions()
        opciones.intra_op_num_threads = 4  # los 4 núcleos del Pi 4

        self._detector = ort.InferenceSession(
            str(carpeta_modelos / "detector.onnx"), sess_options=opciones,
            providers=["CPUExecutionProvider"],
        )
        entrada_det = self._detector.get_inputs()[0]
        self._detector_imgsz = entrada_det.shape[2]  # (1, 3, imgsz, imgsz)
        self._detector_entrada_nombre = entrada_det.name

        self._clasificador = ort.InferenceSession(
            str(carpeta_modelos / "clasificador.onnx"), sess_options=opciones,
            providers=["CPUExecutionProvider"],
        )
        self._clasificador_entrada_nombre = self._clasificador.get_inputs()[0].name

        self._clases = json.loads((carpeta_modelos / "etiquetas.json").read_text(encoding="utf-8"))
        prep = json.loads((carpeta_modelos / "preprocesado.json").read_text(encoding="utf-8"))
        self._img_clasificador = prep["entrada"][2]  # [1, 3, IMG, IMG]
        self._mean = np.array(prep["normalizacion"]["mean"], dtype=np.float32).reshape(3, 1, 1)
        self._std = np.array(prep["normalizacion"]["std"], dtype=np.float32).reshape(3, 1, 1)

    def _detectar(self, imagen: np.ndarray) -> list[Deteccion]:
        h, w = imagen.shape[:2]
        lienzo, escala, pad_x, pad_y = _letterbox(imagen, self._detector_imgsz)
        entrada = lienzo.astype(np.float32) / 255.0
        entrada = entrada.transpose(2, 0, 1)[None, ...]  # NCHW

        salida = self._detector.run(None, {self._detector_entrada_nombre: entrada})[0]
        # Ultralytics exporta (1, 4+nc, N); con nc=1 -> (1, 5, N): cx,cy,w,h,conf
        salida = salida[0].T  # (N, 5)
        conf = salida[:, 4]
        candidatos = salida[conf >= DETECTOR_CONF_MINIMA]
        conf = conf[conf >= DETECTOR_CONF_MINIMA]
        if len(candidatos) == 0:
            return []

        cx, cy, bw, bh = candidatos[:, 0], candidatos[:, 1], candidatos[:, 2], candidatos[:, 3]
        cajas_letterbox = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], axis=1)

        indices = _nms(cajas_letterbox, conf, DETECTOR_IOU_NMS)

        detecciones = []
        for i in indices:
            x0, y0, x1, y1 = cajas_letterbox[i]
            # revertir letterbox -> coordenadas de la imagen original
            x0, x1 = (x0 - pad_x) / escala, (x1 - pad_x) / escala
            y0, y1 = (y0 - pad_y) / escala, (y1 - pad_y) / escala
            x0, y0 = max(0, int(x0)), max(0, int(y0))
            x1, y1 = min(w, int(x1)), min(h, int(y1))
            if x1 - x0 < 1 or y1 - y0 < 1:
                continue
            detecciones.append(Deteccion((x0, y0, x1, y1), float(conf[i])))
        return detecciones

    def _recortar_con_margen(self, imagen: np.ndarray, caja: tuple[int, int, int, int]) -> np.ndarray | None:
        h, w = imagen.shape[:2]
        x0, y0, x1, y1 = caja
        bw, bh = (x1 - x0) * (1 + MARGEN_RECORTE), (y1 - y0) * (1 + MARGEN_RECORTE)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        rx0, ry0 = max(0, int(cx - bw / 2)), max(0, int(cy - bh / 2))
        rx1, ry1 = min(w, int(cx + bw / 2)), min(h, int(cy + bh / 2))
        if rx1 - rx0 < LADO_MINIMO_RECORTE or ry1 - ry0 < LADO_MINIMO_RECORTE:
            return None
        return imagen[ry0:ry1, rx0:rx1]

    def _clasificar(self, recorte: np.ndarray) -> tuple[str, float]:
        lienzo, _, _, _ = _letterbox(recorte, self._img_clasificador, relleno=0)
        entrada = lienzo.astype(np.float32) / 255.0
        entrada = entrada.transpose(2, 0, 1)  # CHW
        entrada = (entrada - self._mean) / self._std
        entrada = entrada[None, ...].astype(np.float32)

        logits = self._clasificador.run(None, {self._clasificador_entrada_nombre: entrada})[0][0]
        exp = np.exp(logits - logits.max())
        probs = exp / exp.sum()
        idx = int(probs.argmax())
        return self._clases[idx], float(probs[idx])

    def identificar(self, imagen_pil: Image.Image) -> list[Identificacion]:
        imagen = np.array(imagen_pil.convert("RGB"))
        resultados = []
        for det in self._detectar(imagen):
            recorte = self._recortar_con_margen(imagen, det.caja)
            if recorte is None:
                continue
            especie, confianza = self._clasificar(recorte)
            seguro = confianza >= CLASIFICADOR_CONFIANZA_MINIMA and especie != "no_es_mosquito"
            resultados.append(Identificacion(
                caja=det.caja,
                confianza_deteccion=det.confianza,
                especie=especie if seguro else "incierto",
                confianza_especie=confianza,
                seguro=seguro,
            ))
        return resultados
