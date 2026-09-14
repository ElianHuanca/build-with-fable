import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

/**
 * Efectos reutilizables de la cámara IA (v3, demo simulada).
 *
 *   CameraFX.flash(scene, ms = 150)                        // destello blanco a pantalla completa
 *   CameraFX.scanner(scene, rect, ms, opts) → { stop }     // línea celeste que recorre `rect` {x,y,w,h}
 *   CameraFX.landmarks(scene, rect, labels, opts) → Container
 *                                                          // 4–6 puntos de referencia con etiquetas cortas
 *   CameraFX.reticle(scene, x, y, size) → Container        // retícula de enfoque (esquinas + cruz)
 *   CameraFX.frameCorners(scene, rect, len, thick) → Graphics  // esquinas blancas del marco de cámara
 *
 * Todos devuelven objetos de la escena que el llamador puede añadir a su contenedor
 * y destruir al cerrar. `rect` está en coordenadas de escena (no de contenedor).
 */
const FONT = 'Arial, sans-serif';

export const CameraFX = {
  /** Flash blanco de `ms` milisegundos por encima de todo. Devuelve el rectángulo (se autodestruye). */
  flash(scene, ms = 150, depth = 1000) {
    const { width: w, height: h } = scene.scale;
    const r = scene.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 1).setDepth(depth);
    scene.tweens.add({
      targets: r, alpha: 0, duration: ms, ease: 'Quad.easeOut',
      onComplete: () => r.destroy(),
    });
    return r;
  },

  /**
   * Barrido de escáner: una línea celeste con estela recorre `rect` de arriba abajo (y vuelve)
   * durante `ms`. `opts.passes` (2 por defecto) es el número de recorridos completos.
   * Devuelve { obj, stop } — `obj` es un Graphics para añadir a un contenedor.
   */
  scanner(scene, rect, ms = 2200, opts = {}) {
    const passes = opts.passes ?? 2;
    const color = opts.color ?? hex(PALETTE.celeste);
    const g = scene.add.graphics();
    const state = { t: 0 };
    const draw = () => {
      g.clear();
      // Posición en ping-pong: 0..1..0 por pasada.
      const p = (state.t * passes) % 1;
      const yy = rect.y + p * rect.h;
      const trail = Math.min(60, rect.h * 0.35);
      for (let i = 0; i < 8; i++) {
        const a = 0.28 * (1 - i / 8);
        g.fillStyle(color, a).fillRect(rect.x, yy - i * (trail / 8), rect.w, trail / 8);
      }
      g.lineStyle(2, color, 1).lineBetween(rect.x, yy, rect.x + rect.w, yy);
      g.lineStyle(1, 0xffffff, 0.8).lineBetween(rect.x, yy + 1, rect.x + rect.w, yy + 1);
    };
    const tw = scene.tweens.add({
      targets: state, t: 1, duration: ms, ease: 'Linear', onUpdate: draw,
      onComplete: () => { g.clear(); },
    });
    draw();
    return { obj: g, stop: () => { tw.stop(); if (g.active) g.clear(); } };
  },

  /**
   * Puntos de referencia: círculos celestes con etiqueta que aparecen uno a uno sobre `rect`
   * (posiciones pseudoaleatorias estables con `opts.seed`). `labels` = strings cortos (4–6).
   * Devuelve un Container en (0,0) de escena.
   */
  landmarks(scene, rect, labels, opts = {}) {
    const c = scene.add.container(0, 0);
    const rnd = mulberry(opts.seed ?? 7);
    const delay0 = opts.delay ?? 500;
    const gap = opts.gap ?? 260;
    const font = opts.fontSize ?? 11;
    const n = Phaser.Math.Clamp(labels.length, 0, 6);
    // Distribución en anillo alrededor del centro para no amontonarlos.
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rnd() * 0.8 - 0.4;
      const rad = (0.18 + rnd() * 0.18) * Math.min(rect.w, rect.h);
      const px = rect.x + rect.w / 2 + Math.cos(ang) * rad;
      const py = rect.y + rect.h / 2 + Math.sin(ang) * rad;
      const pt = scene.add.container(px, py).setScale(0).setAlpha(0);
      const g = scene.add.graphics();
      g.lineStyle(2, hex(PALETTE.celeste), 1).strokeCircle(0, 0, 7);
      g.fillStyle(hex(PALETTE.celeste), 1).fillCircle(0, 0, 3);
      g.lineStyle(1, hex(PALETTE.celeste), 0.8).lineBetween(0, -7, 0, -14);
      // Etiqueta hacia el lado que tenga más espacio dentro del rect.
      const right = px < rect.x + rect.w / 2;
      const txt = scene.add.text(right ? 10 : -10, -14, labels[i], {
        fontFamily: FONT, fontSize: font, fontStyle: 'bold', color: PALETTE.blanco,
        backgroundColor: 'rgba(20,40,60,0.85)', padding: { x: 4, y: 2 },
      }).setOrigin(right ? 0 : 1, 0.5);
      pt.add([g, txt]);
      c.add(pt);
      scene.tweens.add({
        targets: pt, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut', delay: delay0 + i * gap,
        onStart: () => scene.game.events.emit('sfx', 'pop'),
      });
      // Pulso suave permanente del anillo.
      scene.tweens.add({ targets: g, alpha: 0.5, duration: 600, yoyo: true, repeat: -1, delay: delay0 + i * gap });
    }
    return c;
  },

  /** Retícula: cruz central + arco discontinuo. Devuelve Container en (x, y). */
  reticle(scene, x, y, size = 120) {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    const s = size / 2, col = hex(PALETTE.celeste);
    g.lineStyle(2, col, 0.9);
    g.strokeCircle(0, 0, s * 0.75);
    g.lineBetween(-s, 0, -s * 0.45, 0).lineBetween(s * 0.45, 0, s, 0);
    g.lineBetween(0, -s, 0, -s * 0.45).lineBetween(0, s * 0.45, 0, s);
    g.fillStyle(col, 1).fillCircle(0, 0, 2.5);
    c.add(g);
    scene.tweens.add({ targets: g, alpha: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  },

  /** Esquinas blancas de un marco de cámara alrededor de `rect`. */
  frameCorners(scene, rect, len = 26, thick = 4, color = 0xffffff) {
    const g = scene.add.graphics();
    g.lineStyle(thick, color, 1);
    const { x, y, w, h } = rect;
    const L = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (const [cx, cy, sx, sy] of L) {
      g.lineBetween(cx, cy, cx + len * sx, cy);
      g.lineBetween(cx, cy, cx, cy + len * sy);
    }
    return g;
  },
};

/** PRNG determinista (mulberry32) para que los puntos sean estables por foto. */
export function mulberry(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
