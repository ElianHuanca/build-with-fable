/**
 * Constantes de UI táctil.
 * La escena es de 960×540 con Scale.FIT: en un teléfono en horizontal (p. ej. 851×393 CSS px)
 * el factor es ~0.73, así que un objetivo táctil de 44 CSS px necesita ≥ 60 px de escena.
 */
export const MIN_TOUCH = 64;

/** Tamaño del área táctil (hit area) para un botón dibujado de w×h: nunca menor que MIN_TOUCH. */
export function touchSize(w, h) {
  return [Math.max(w, MIN_TOUCH), Math.max(h, MIN_TOUCH)];
}

/** Clave de localStorage para forzar el modo táctil: '1' lo activa, '0' lo desactiva. */
export const TOUCH_STORAGE_KEY = 'dengue.touch';

/**
 * ¿Se muestran los controles táctiles? Detección con `game.device.input.touch`, con
 * posibilidad de forzar (pruebas, laptops táctiles) mediante localStorage 'dengue.touch'.
 * @param {Phaser.Game} game
 */
export function esModoTactil(game) {
  try {
    const v = localStorage.getItem(TOUCH_STORAGE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* sin storage */ }
  return !!game?.device?.input?.touch;
}
