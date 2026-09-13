import Phaser from 'phaser';

/**
 * EliminationFX — la "animación estrella" en 4 pasos (mockup, sección EliminationFX).
 *
 * 1. Drenado (1500 ms): el criadero pasa a `<tipo>_vacio`; encima se dibuja `agua_<tipo>`
 *    que baja de escala en Y (Sine.easeIn) anclada en su base, alpha 1→0.6. SFX 'gluglu'.
 * 2. Splash (al 40 % del drenado): 30 gotas (`drop`) hacia arriba con gravedad, 600 ms.
 * 3. Disolución (800 ms): máscara bitmap de ruido (`noise`) sobre el agua que se encoge
 *    mientras el agua hace fade 0.6→0 (en CANVAS solo fade+scale). SFX 'pop'.
 * 4. Limpio (400 ms): textura `<tipo>_limpio`, rebote 1→1.15→1 Back.easeOut y 12 chispas
 *    (`spark`) radiales. SFX 'points'. Total ≈ 3.3 s.
 *
 * Eventos de escena: 'sfx' (nombre), 'foto:antes' (criadero), 'foto:despues' (criadero).
 * Reentrada bloqueada por criadero: una segunda llamada devuelve la misma Promise.
 */

export const FX_DURATIONS = Object.freeze({
  drain: 1500,
  splashAt: 0.4, // fracción del drenado
  splashLife: 600,
  dissolve: 800,
  clean: 400,
  total: 1500 + 800 + 400, // 2700 ms de tweens + colas de partículas ≈ 3.3 s
});

const running = new WeakMap();

const has = (scene, key) => scene.textures.exists(key);

function tween(scene, config) {
  return new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });
}

/**
 * Reproduce la secuencia sobre un Criadero. No cambia `criadero.state`; eso lo hace clean().
 * @param {Phaser.Scene} scene
 * @param {import('../objects/Criadero.js').Criadero} criadero
 * @returns {Promise<void>}
 */
export function playElimination(scene, criadero) {
  if (running.has(criadero)) return running.get(criadero);
  const p = run(scene, criadero).finally(() => running.delete(criadero));
  running.set(criadero, p);
  return p;
}

async function run(scene, criadero) {
  const { x, y, type } = criadero;
  const isCanvas = scene.sys.game.renderer.type === Phaser.CANVAS;
  const temp = []; // objetos temporales a destruir al final
  const sfx = (name) => scene.events.emit('sfx', name);

  scene.events.emit('foto:antes', criadero);

  // ---- 1. Drenado -------------------------------------------------------
  // Resuelve texturas vía la clase del criadero (evita import circular; conserva el fallback).
  const textureFor = (state) => {
    const C = criadero.constructor;
    if (C && typeof C.textureFor === 'function') return C.textureFor(scene, type, state);
    const k = `${type}_${state}`;
    return has(scene, k) ? k : criadero.texture.key;
  };
  criadero.setTexture(textureFor('vacio'));

  const waterKey = criadero.waterKey || `agua_${type}`;
  let water = null;
  if (has(scene, waterKey)) {
    const h = scene.textures.get(waterKey).getSourceImage().height;
    // Origen en la base del agua; y desplazada para que quede alineada con el criadero (origen 0.5,0.5).
    water = scene.add.image(x, y + h / 2, waterKey).setOrigin(0.5, 1).setDepth(criadero.depth + 1);
    temp.push(water);
  }

  sfx('gluglu');
  const drain = water
    ? tween(scene, { targets: water, scaleY: 0.05, alpha: 0.6, duration: FX_DURATIONS.drain, ease: 'Sine.easeIn' })
    : new Promise((r) => scene.time.delayedCall(FX_DURATIONS.drain, r));

  // ---- 2. Splash (al 40 % del drenado) ----------------------------------
  const splashDelay = FX_DURATIONS.drain * FX_DURATIONS.splashAt;
  const splashDone = new Promise((resolve) => {
    scene.time.delayedCall(splashDelay, () => {
      if (!has(scene, 'drop')) return resolve();
      const emitter = scene.add.particles(x, y, 'drop', {
        speed: { min: 80, max: 180 },
        angle: { min: 200, max: 340 },
        gravityY: 400,
        lifespan: FX_DURATIONS.splashLife,
        scale: { start: 1, end: 0.3 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      }).setDepth(criadero.depth + 2);
      temp.push(emitter);
      emitter.explode(30);
      scene.time.delayedCall(FX_DURATIONS.splashLife + 50, resolve);
    });
  });

  await drain;

  // ---- 3. Disolución ----------------------------------------------------
  if (water) {
    let maskImg = null;
    if (!isCanvas && has(scene, 'noise')) {
      maskImg = scene.make.image({ x, y, key: 'noise', add: false });
      water.setMask(maskImg.createBitmapMask());
      temp.push(maskImg);
    }
    const targets = maskImg ? [water, maskImg] : [water];
    await Promise.all([
      tween(scene, { targets: water, alpha: 0, duration: FX_DURATIONS.dissolve, ease: 'Sine.easeOut' }),
      maskImg
        ? tween(scene, { targets: maskImg, scale: 0.1, angle: 25, duration: FX_DURATIONS.dissolve, ease: 'Sine.easeIn' })
        : tween(scene, { targets: water, scaleX: 0.2, duration: FX_DURATIONS.dissolve, ease: 'Sine.easeIn' }),
    ]);
    targets.forEach((t) => t.clearMask && t.clearMask(true));
    water.setVisible(false);
  } else {
    await new Promise((r) => scene.time.delayedCall(FX_DURATIONS.dissolve, r));
  }
  sfx('pop');

  // ---- 4. Estado limpio -------------------------------------------------
  criadero.setTexture(textureFor('limpio'));
  let sparkDone = Promise.resolve();
  if (has(scene, 'spark')) {
    const sparks = scene.add.particles(x, y, 'spark', {
      speed: { min: 60, max: 140 },
      angle: { min: 0, max: 360 },
      lifespan: 500,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    }).setDepth(criadero.depth + 2);
    temp.push(sparks);
    sparks.explode(12);
    sparkDone = new Promise((r) => scene.time.delayedCall(550, r));
  }
  await tween(scene, { targets: criadero, scale: 1.15, duration: FX_DURATIONS.clean / 2, yoyo: true, ease: 'Back.easeOut' });
  criadero.setScale(1);
  sfx('points');

  await Promise.all([splashDone, sparkDone]);
  temp.forEach((o) => o && o.destroy && o.destroy());
  scene.events.emit('foto:despues', criadero);
}
