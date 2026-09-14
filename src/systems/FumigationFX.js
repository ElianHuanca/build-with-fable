import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

/**
 * FumigationFX — animación de fumigar un Brote (mockup 1.3; plan v3 sección 1.4).
 *
 * Progreso 0..1 durante toda la duración (2.5 s a pie, 1.5 s con `rapido=true` desde la
 * camioneta; `factor` la alarga, p. ej. ×1.5 si el brote es grande). Secuencia:
 *  - El jugador "saca el rociador": sprite `rociador` (o un rectángulo gris con boquilla) en
 *    la mano, orientado hacia el brote; con `rapido` sale del tanque trasero de la camioneta.
 *  - Cono de niebla: partículas `spray` (o un círculo blanco generado) desde la boquilla hacia
 *    el enjambre, ampliándose, con gravedad leve y tinte blanco-celeste (~70/s).
 *  - Los mosquitos se agitan con el progreso (brote.agitacion) y desde el 40 % caen uno a uno
 *    en orden aleatorio (y+18, giro 180°, alpha 0, rebote), de modo que al 100 % cayeron todos.
 *    Gotas (`drop`) salpican sobre el enjambre. Pulso verde al final.
 *  - Cancelar (`cancelFumigation`): los caídos no vuelven, la niebla se apaga con fade y la
 *    Promise resuelve `false`. Si termina, marca `brote.state = 'fumigado'`, emite 'fumigado'
 *    (brote) y resuelve `true`. Nunca rechaza.
 * SFX: emite 'sfx:loop'/'sfx:stop' 'spray' (AudioManager lo reproduce en loop).
 */
export const FUMIGATION_DURATIONS = Object.freeze({ normal: 2500, rapido: 1500 });

// Fracción del progreso a partir de la cual empiezan a caer los mosquitos.
const INICIO_CAIDA = 0.4;
const NIEBLA_POR_SEGUNDO = 72;

const running = new WeakMap();

/**
 * Reproduce la secuencia sobre un Brote. Reentrada bloqueada por brote: una segunda llamada
 * mientras la primera sigue en curso devuelve la misma Promise.
 * @param {Phaser.Scene} scene
 * @param {import('../objects/Brote.js').Brote} brote
 * @param {{ rapido?: boolean, factor?: number, conVehiculo?: boolean }} [opts]
 * @returns {Promise<boolean>} true si se completó, false si se canceló
 */
export function playFumigation(scene, brote, opts = {}) {
  if (running.has(brote)) return running.get(brote).promise;
  const ctrl = { cancel: null, progreso: 0 };
  ctrl.promise = run(scene, brote, opts, ctrl).finally(() => running.delete(brote));
  running.set(brote, ctrl);
  return ctrl.promise;
}

/** Interrumpe la fumigación en curso de `brote` (si la hay); la Promise original resuelve `false`. */
export function cancelFumigation(brote) {
  const ctrl = running.get(brote);
  if (!ctrl) return false;
  ctrl.cancel?.();
  return true;
}

/** Progreso 0..1 de la fumigación en curso (0 si no hay ninguna). */
export function fumigationProgress(brote) {
  return running.get(brote)?.progreso ?? 0;
}

/** Textura del rociador: 'rociador' si está cargada; si no, un tubo gris con boquilla. */
function rociadorTexture(scene) {
  if (scene.textures.exists('rociador')) return 'rociador';
  const fb = 'fb_rociador';
  if (!scene.textures.exists(fb)) {
    const W = 30, H = 12;
    const rt = scene.add.renderTexture(0, 0, W, H).setVisible(false);
    const g = scene.add.graphics();
    g.fillStyle(hex(PALETTE.gris), 1).fillRoundedRect(0, 3, 20, 6, 2);
    g.fillStyle(hex(PALETTE.marino), 1).fillRoundedRect(4, 0, 8, 12, 2); // depósito/mango
    g.fillStyle(hex(PALETTE.grisClaro), 1).fillRect(19, 2, 7, 8);        // boquilla
    g.fillStyle(hex(PALETTE.celeste), 1).fillRect(26, 4, 4, 4);
    g.lineStyle(1, hex(PALETTE.linea), 0.9).strokeRoundedRect(0.5, 3.5, 19, 5, 2).strokeRect(19.5, 2.5, 6, 7);
    rt.draw(g).saveTexture(fb);
    g.destroy(); rt.destroy();
  }
  return fb;
}

/** Textura de niebla: 'niebla' (v3) o 'spray' si están; si no, un disco blanco suave de 32 px. */
function nieblaTexture(scene) {
  if (scene.textures.exists('niebla')) return 'niebla';
  if (scene.textures.exists('spray')) return 'spray';
  const fb = 'fb_spray';
  if (!scene.textures.exists(fb)) {
    const rt = scene.add.renderTexture(0, 0, 32, 32).setVisible(false);
    const g = scene.add.graphics();
    for (let r = 16, a = 0.08; r > 3; r -= 3, a += 0.1) g.fillStyle(0xffffff, a).fillCircle(16, 16, r);
    rt.draw(g).saveTexture(fb);
    g.destroy(); rt.destroy();
  }
  return fb;
}

/** Punto de origen de la niebla: mano del jugador o tanque trasero de la camioneta. */
function origenNiebla(scene, brote, conVehiculo) {
  const p = scene.player;
  const v = scene.vehiculo;
  if (conVehiculo && v && v.montado) {
    // El tanque va atrás: lado opuesto a la dirección de marcha.
    const back = { down: [0, -14], up: [0, 14], left: [16, 0], right: [-16, 0] }[v.dir] || [0, -14];
    return { x: v.x + back[0], y: v.y + back[1] - 6, depth: (v.depth || 0) + 1, enTanque: true };
  }
  if (p) {
    const a = Math.atan2(brote.y - p.y, brote.x - p.x);
    return { x: p.x + Math.cos(a) * 12, y: p.y + 4 + Math.sin(a) * 4, depth: (p.depth || 0) + 1, enTanque: false };
  }
  return { x: brote.x - 40, y: brote.y, depth: (brote.depth || 0) + 1, enTanque: false };
}

async function run(scene, brote, { rapido = false, factor = 1, conVehiculo = rapido } = {}, ctrl) {
  const duration = Math.round((rapido ? FUMIGATION_DURATIONS.rapido : FUMIGATION_DURATIONS.normal) * (factor || 1));
  let completado = false;
  let niebla = null, gotas = null, rociador = null;

  try {
    scene.events.emit('sfx:loop', 'spray');

    // 1) Rociador en la mano (o sobre el tanque) apuntando al enjambre.
    const o = origenNiebla(scene, brote, conVehiculo);
    const ang = Math.atan2(brote.y - o.y, brote.x - o.x);
    rociador = scene.add.image(o.x, o.y, rociadorTexture(scene))
      .setOrigin(0.2, 0.5).setRotation(ang).setDepth(o.depth).setScale(0.2).setAlpha(0.9);
    if (Math.cos(ang) < 0) rociador.setFlipY(true);
    scene.tweens.add({ targets: rociador, scale: 1, duration: 160, ease: 'Back.easeOut' });
    const largo = rociador.width * 0.8; // distancia origen → boquilla
    const boquilla = () => ({ x: rociador.x + Math.cos(ang) * largo, y: rociador.y + Math.sin(ang) * largo });

    // 2) Cono de niebla desde la boquilla hacia el enjambre, ampliándose.
    const dist = Math.max(30, Phaser.Math.Distance.Between(o.x, o.y, brote.x, brote.y));
    const grados = Phaser.Math.RadToDeg(ang);
    const vel = Phaser.Math.Clamp(dist * 1.6, 70, 220);
    const vida = Phaser.Math.Clamp((dist + brote.radioOrbita * 1.4) / vel * 1000, 500, 1400);
    const b0 = boquilla();
    niebla = scene.add.particles(b0.x, b0.y, nieblaTexture(scene), {
      angle: { min: grados - 15, max: grados + 15 },
      speed: { min: vel * 0.7, max: vel * 1.15 },
      lifespan: vida,
      scale: { start: 0.35, end: 1.5 },
      alpha: { start: 0.75, end: 0 },
      gravityY: 22,
      frequency: Math.round(1000 / NIEBLA_POR_SEGUNDO),
      tint: [0xffffff, 0xeaf7ff, hex(PALETTE.celeste)],
      blendMode: 'ADD',
    }).setDepth(Math.max(brote.depth || 0, o.depth) + 2);

    // 3) Gotas salpicando sobre el enjambre.
    if (scene.textures.exists('drop')) {
      gotas = scene.add.particles(brote.x, brote.y - 8, 'drop', {
        speed: { min: 20, max: 60 }, angle: { min: 200, max: 340 },
        lifespan: 550, gravityY: 180, scale: { start: 0.6, end: 0.2 }, alpha: { start: 0.9, end: 0 },
        frequency: 90, emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, brote.radioOrbita * 0.8) },
      }).setDepth((brote.depth || 0) + 3);
    }

    // 4) Progreso: agitación creciente y caída uno a uno (los que ya cayeron no vuelven).
    const vivos = Phaser.Utils.Array.Shuffle(brote.mosquitosVivos().slice());
    const n = vivos.length;
    const caer = (m) => {
      brote.derribar(m);
      scene.tweens.add({
        targets: m, y: m.y + 18, angle: 180, alpha: 0, duration: 420, ease: 'Bounce.easeOut',
        onComplete: () => { if (m.scene) m.destroy(); },
      });
    };
    let idx = 0;

    completado = await new Promise((resolve) => {
      const marcador = { t: 0 };
      const tw = scene.tweens.add({
        targets: marcador, t: 1, duration, ease: 'Linear',
        onUpdate: () => {
          const t = marcador.t;
          ctrl.progreso = t;
          brote.agitacion = Math.min(1, t * 1.4);
          if (rociador?.scene) { const b = boquilla(); niebla?.setPosition(b.x, b.y); }
          // Cae el mosquito i cuando t supera 0.4 + i/n·0.6 → al 100 % cayeron todos.
          while (idx < n && t >= INICIO_CAIDA + (idx / n) * (1 - INICIO_CAIDA)) caer(vivos[idx++]);
        },
        onComplete: () => { while (idx < n) caer(vivos[idx++]); resolve(true); },
      });
      ctrl.cancel = () => { tw.stop(); resolve(false); };
    });
  } catch (err) {
    console.warn('[FumigationFX] Falló la animación, aplicando estado fumigado directo', err);
    completado = true;
  } finally {
    ctrl.cancel = null;
    scene.events.emit('sfx:stop', 'spray');
    if (brote.scene) brote.agitacion = 0;

    // La niebla se apaga con fade (no de golpe); el rociador se guarda.
    const apagar = (obj, ms) => {
      if (!obj || !obj.scene) return;
      if (obj.stop) obj.stop();
      scene.tweens.add({ targets: obj, alpha: 0, duration: ms, onComplete: () => obj.destroy() });
    };
    apagar(niebla, completado ? 700 : 450);
    apagar(gotas, 300);
    if (rociador?.scene) {
      scene.tweens.add({ targets: rociador, scale: 0.2, alpha: 0, duration: 180, delay: completado ? 250 : 0, onComplete: () => rociador.destroy() });
    }

    if (completado) {
      if (brote.scene) {
        // Pulso de luz verde al terminar.
        const pulso = scene.add.circle(brote.x, brote.y, 12, hex(PALETTE.verde), 0.55).setDepth((brote.depth || 0) + 4);
        scene.tweens.add({ targets: pulso, scale: brote.radioOrbita / 6, alpha: 0, duration: 450, ease: 'Sine.easeOut', onComplete: () => pulso.destroy() });
        scene.tweens.add({ targets: brote, alpha: 0, duration: 250 });
      }
      brote.state = 'fumigado';
      brote.emit('fumigado', brote);
    } else if (brote.scene) {
      brote.setAlpha(1);
    }
  }
  return completado;
}
