import Phaser from 'phaser';
import { Layout } from './Layout.js';

/** Lado de un tile del nivel en px de mundo. */
export const TILE = 64;
/** Tiles de ancho visibles (mockup sección 2): ~9 en vertical, ~15 en horizontal. */
export const TILES_VISIBLES = { vertical: 9, horizontal: 15 };
export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 1.6;

/** Zoom de la cámara principal para un lienzo de w×h. */
export function zoomPara(w, h) {
  const tiles = h > w ? TILES_VISIBLES.vertical : TILES_VISIBLES.horizontal;
  return Phaser.Math.Clamp(w / (tiles * TILE), ZOOM_MIN, ZOOM_MAX);
}

/** ¿Es un objeto de UI (fijo a la pantalla)? Regla: scrollFactor 0 en ambos ejes. */
function esUI(go) {
  return go.scrollFactorX === 0 && go.scrollFactorY === 0;
}

/**
 * Asigna un objeto (y los hijos de un contenedor) a una de las dos cámaras:
 * UI → lo ignora la principal; mundo → lo ignora la de UI.
 */
function marcar(go, ui, mainId, uiId) {
  if (!go) return;
  go.cameraFilter = ui ? ((go.cameraFilter | mainId) & ~uiId) : ((go.cameraFilter | uiId) & ~mainId);
  if (Array.isArray(go.list)) for (const h of go.list) marcar(h, ui, mainId, uiId);
}

/**
 * Zoom automático de la cámara principal con una segunda cámara (`scene.uiCam`) sin zoom para
 * la UI de la escena (joystick, botones táctiles, minimapa, avisos, cartel, menú de pausa).
 *
 * Llamar UNA vez al final de `GameScene.create()` (con todos los objetos ya creados):
 *   applyCameraZoom(this);
 *
 * Reparto de cámaras: todo objeto del display list con `scrollFactor` 0 en ambos ejes es UI y
 * lo dibuja solo `uiCam`; el resto es mundo y lo dibuja solo la principal (con zoom). Los
 * objetos creados después (textos flotantes, efectos, brotes…) se clasifican en el siguiente
 * POST_UPDATE, cuando ya tienen su scrollFactor definitivo (los encadenados `.setScrollFactor(0)`
 * se aplican después de ADDED_TO_SCENE). Un objeto que cambie de scrollFactor más tarde puede
 * reclasificarse con `scene.marcarCamara(go, esUI)`.
 *
 * El zoom se recalcula en cada resize (Layout.onResize): ~9 tiles de ancho en vertical y ~15
 * en horizontal, acotado a [0.7, 1.6].
 */
export function applyCameraZoom(scene) {
  if (scene.uiCam) return scene.uiCam;
  const main = scene.cameras.main;
  const { w, h } = Layout.size(scene);
  const uiCam = scene.cameras.add(0, 0, w, h, false, 'ui');
  uiCam.setScroll(0, 0).setZoom(1);
  scene.uiCam = uiCam;
  scene.marcarCamara = (go, ui) => marcar(go, ui, main.id, uiCam.id);

  // Objetos ya existentes.
  for (const go of scene.children.list) marcar(go, esUI(go), main.id, uiCam.id);

  // Objetos futuros: se clasifican en el siguiente post-update (antes de renderizar).
  const pendientes = new Set();
  const onAdded = (go) => pendientes.add(go);
  const clasificar = () => {
    if (!pendientes.size) return;
    for (const go of pendientes) {
      // Si ya fue metido en un contenedor, hereda la cámara del contenedor (filtro 0 = ambas).
      if (go.parentContainer || !go.scene) continue;
      marcar(go, esUI(go), main.id, uiCam.id);
    }
    pendientes.clear();
  };
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, clasificar);

  const offResize = Layout.onResize(scene, (width, height) => {
    main.setZoom(zoomPara(width, height));
    uiCam.setSize(width, height).setScroll(0, 0).setZoom(1);
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, clasificar);
    offResize();
    pendientes.clear();
    scene.uiCam = null;
    scene.marcarCamara = null;
  });
  return uiCam;
}

/**
 * Punto de mundo → píxel del lienzo según la cámara principal (tiene en cuenta el zoom).
 * Útil para `renderer.snapshotArea` (GameScene.capturar).
 */
export function worldToScreen(scene, x, y) {
  const cam = scene.cameras.main;
  return {
    x: (x - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2,
    y: (y - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2,
  };
}
