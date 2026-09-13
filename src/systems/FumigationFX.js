import { PALETTE, hex } from '../data/palette.js';

/**
 * FumigationFX — animación de fumigar un Brote (mockup, sección 1.3/FumigationFX).
 *
 * Progreso 0..1 durante toda la duración de la fumigación (2.5 s a pie, 1.5 s con
 * `rapido=true` desde la camioneta; `factor` la alarga, p. ej. ×1.5 si el brote es grande):
 * nube de espray alrededor del brote (partículas `spray` si existe la textura, si no un círculo
 * celeste pulsante) mientras el propio brote se desvanece (alpha 1→0) en sincronía con el
 * progreso. SFX 'spray' al iniciar.
 *
 * Se puede interrumpir con `cancelFumigation(brote)` (el jugador soltó el botón): la nube
 * desaparece, el brote recupera su opacidad y la Promise resuelve `false`. Si termina, la FX
 * marca `brote.state = 'fumigado'`, emite 'fumigado' (brote) en el propio brote y resuelve
 * `true` — Brote.fumigar() solo arranca la animación y bloquea la reentrada. Nunca rechaza: si
 * algo falla (textura ausente, escena cerrada a mitad de camino) resuelve igual, dejando el
 * brote en el estado final de todos modos.
 */
export const FUMIGATION_DURATIONS = Object.freeze({ normal: 2500, rapido: 1500 });

const running = new WeakMap();

/**
 * Reproduce la secuencia sobre un Brote. Reentrada bloqueada por brote: una segunda llamada
 * mientras la primera sigue en curso devuelve la misma Promise.
 * @param {Phaser.Scene} scene
 * @param {import('../objects/Brote.js').Brote} brote
 * @param {{ rapido?: boolean, factor?: number }} [opts]
 * @returns {Promise<boolean>} true si se completó, false si se canceló
 */
export function playFumigation(scene, brote, opts = {}) {
  if (running.has(brote)) return running.get(brote).promise;
  const ctrl = { cancel: null };
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

async function run(scene, brote, { rapido = false, factor = 1 } = {}, ctrl) {
  const duration = Math.round((rapido ? FUMIGATION_DURATIONS.rapido : FUMIGATION_DURATIONS.normal) * (factor || 1));
  const sfx = (name) => scene.events.emit('sfx', name);
  const temp = [];
  let completado = false;

  try {
    sfx('spray');

    let nube;
    if (scene.textures.exists('spray')) {
      nube = scene.add.particles(brote.x, brote.y, 'spray', {
        speed: { min: 30, max: 80 },
        angle: { min: 0, max: 360 },
        lifespan: 450,
        scale: { start: 0.9, end: 0.2 },
        alpha: { start: 0.85, end: 0 },
        frequency: 50,
      }).setDepth((brote.depth || 0) + 2);
    } else {
      const radio = (brote.width || 60) * 0.6;
      nube = scene.add.circle(brote.x, brote.y, radio, hex(PALETTE.celeste), 0.3)
        .setDepth((brote.depth || 0) + 2);
      scene.tweens.add({
        targets: nube, alpha: 0.12, scale: 1.2, duration: 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    temp.push(nube);

    // El brote se desvanece durante toda la duración: la propia opacidad ES el progreso 0..1.
    completado = await new Promise((resolve) => {
      const tw = scene.tweens.add({
        targets: brote, alpha: 0, duration, ease: 'Sine.easeIn',
        onUpdate: () => { ctrl.progreso = tw.progress; },
        onComplete: () => resolve(true),
      });
      ctrl.cancel = () => { tw.stop(); resolve(false); };
    });
  } catch (err) {
    console.warn('[FumigationFX] Falló la animación, aplicando estado fumigado directo', err);
    completado = true;
  } finally {
    ctrl.cancel = null;
    temp.forEach((o) => o && o.destroy && o.destroy());
    if (completado) {
      if (brote.scene) brote.setAlpha(0);
      brote.state = 'fumigado';
      brote.emit('fumigado', brote);
    } else if (brote.scene) {
      brote.setAlpha(1);
    }
  }
  return completado;
}
