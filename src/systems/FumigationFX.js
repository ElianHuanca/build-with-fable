import { PALETTE, hex } from '../data/palette.js';

/**
 * FumigationFX — animación de fumigar un Brote (mockup, sección 1.3/FumigationFX).
 *
 * Progreso 0..1 durante toda la duración de la fumigación (2.5 s a pie, 1.5 s con
 * `rapido=true` desde la camioneta): nube de espray alrededor del brote (partículas `spray`
 * si existe la textura, si no un círculo celeste pulsante) mientras el propio brote se
 * desvanece (alpha 1→0) en sincronía con el progreso. SFX 'spray' al iniciar.
 *
 * A diferencia de EliminationFX/Criadero (donde el estado lo pone clean()), aquí es la FX la
 * que marca `brote.state = 'fumigado'` y emite 'fumigado' (brote) en el propio brote al
 * terminar — Brote.fumigar() solo arranca la animación y bloquea la reentrada. Nunca rechaza:
 * si algo falla (textura ausente, escena cerrada a mitad de camino) resuelve igual, dejando el
 * brote en el estado final de todos modos.
 */
export const FUMIGATION_DURATIONS = Object.freeze({ normal: 2500, rapido: 1500 });

const running = new WeakMap();

function tween(scene, config) {
  return new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });
}

/**
 * Reproduce la secuencia sobre un Brote. Reentrada bloqueada por brote: una segunda llamada
 * mientras la primera sigue en curso devuelve la misma Promise.
 * @param {Phaser.Scene} scene
 * @param {import('../objects/Brote.js').Brote} brote
 * @param {{ rapido?: boolean }} [opts]
 * @returns {Promise<void>}
 */
export function playFumigation(scene, brote, opts = {}) {
  if (running.has(brote)) return running.get(brote);
  const p = run(scene, brote, opts).finally(() => running.delete(brote));
  running.set(brote, p);
  return p;
}

async function run(scene, brote, { rapido = false } = {}) {
  const duration = rapido ? FUMIGATION_DURATIONS.rapido : FUMIGATION_DURATIONS.normal;
  const sfx = (name) => scene.events.emit('sfx', name);
  const temp = [];

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
    await tween(scene, { targets: brote, alpha: 0, duration, ease: 'Sine.easeIn' });
  } catch (err) {
    console.warn('[FumigationFX] Falló la animación, aplicando estado fumigado directo', err);
    if (brote.scene) brote.setAlpha(0);
  } finally {
    temp.forEach((o) => o && o.destroy && o.destroy());
    brote.state = 'fumigado';
    brote.emit('fumigado', brote);
  }
}
