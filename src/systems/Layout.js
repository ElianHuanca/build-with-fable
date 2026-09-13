/**
 * Layout responsivo (v2, mobile first).
 * El juego usa Phaser.Scale.RESIZE: el lienzo ocupa toda la ventana y cada escena
 * reacomoda su UI con estas utilidades cuando cambia el tamaño.
 *
 *   const { w, h } = Layout.size(scene);
 *   Layout.isPortrait(scene)                 // alto > ancho
 *   Layout.anchor(scene, 'br', -100, -100)   // {x, y} desde una esquina/centro
 *   Layout.onResize(scene, (w, h) => {...})  // llama ya y en cada resize; se limpia en shutdown
 *   Layout.panelWidth(scene, 560)            // min(w - 2*margen, 560)
 *   Layout.ui(scene)                         // factor 0.8..1.3 para fuentes/botones
 *   Layout.safe(scene)                       // márgenes seguros {top,right,bottom,left}
 *
 * Anclas: 'tl' 'tc' 'tr' 'cl' 'c' 'cr' 'bl' 'bc' 'br'.
 */
export const Layout = {
  MARGIN: 16,

  size(scene) {
    return { w: scene.scale.width, h: scene.scale.height };
  },

  isPortrait(scene) {
    return scene.scale.height > scene.scale.width;
  },

  safe(scene) {
    const m = Layout.MARGIN;
    // Espacio extra arriba/abajo en teléfonos con notch o barra del navegador.
    const extra = Layout.isPortrait(scene) ? 8 : 0;
    return { top: m + extra, right: m, bottom: m + extra, left: m };
  },

  anchor(scene, where, dx = 0, dy = 0) {
    const { w, h } = Layout.size(scene);
    const xs = { l: 0, c: w / 2, r: w };
    const ys = { t: 0, c: h / 2, b: h };
    const v = where[0], hz = where[1] || 'c';
    const y = ys[v === 'c' && where.length === 1 ? 'c' : v] ?? h / 2;
    const x = xs[hz] ?? w / 2;
    return { x: x + dx, y: y + dy };
  },

  panelWidth(scene, max = 560) {
    const { w } = Layout.size(scene);
    return Math.min(w - Layout.MARGIN * 2, max);
  },

  /** Factor de escala para UI: 1 en 540 px de lado menor; acotado para no exagerar. */
  ui(scene) {
    const { w, h } = Layout.size(scene);
    const f = Math.min(w, h) / 540;
    return Math.max(0.8, Math.min(1.3, f));
  },

  /** Registra fn(w, h): la ejecuta de inmediato y en cada cambio de tamaño; se quita al cerrar la escena. */
  onResize(scene, fn) {
    const handler = (gameSize) => fn(gameSize.width, gameSize.height);
    scene.scale.on('resize', handler);
    scene.events.once('shutdown', () => scene.scale.off('resize', handler));
    scene.events.once('destroy', () => scene.scale.off('resize', handler));
    fn(scene.scale.width, scene.scale.height);
    return () => scene.scale.off('resize', handler);
  },
};
