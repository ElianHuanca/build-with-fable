import { PUNTOS_POR_CRIADERO } from '../data/facts.js';

/** Puntos por criadero limpio. */
export const PUNTOS_CRIADERO = PUNTOS_POR_CRIADERO ?? 50;
/** Bonus si el criadero se limpia dentro de COMBO_MS del anterior. */
export const BONUS_COMBO = 25;
export const COMBO_MS = 20000;
/** Umbrales de estrellas (segundos). */
export const UMBRAL_3_ESTRELLAS = 150;
export const UMBRAL_2_ESTRELLAS = 240;

/**
 * Puntaje del nivel: +50 por criadero, +25 de bonus por combo (< 20 s del anterior).
 * No depende de Phaser; `now` es un timestamp en ms (scene.time.now o Date.now()).
 */
export class ScoreManager {
  constructor() { this.reset(); }

  reset() {
    this.puntos = 0;
    this.combo = 0;            // criaderos consecutivos dentro de la ventana de combo
    this.ultimoCriadero = null; // ms del último criadero limpio
  }

  /**
   * Registra un criadero limpio.
   * @param {number} now ms actuales
   * @returns {{puntos:number, bonus:number, combo:number, total:number}} puntos y bonus obtenidos en esta limpieza
   */
  addCriadero(now = Date.now()) {
    const enCombo = this.ultimoCriadero !== null && now - this.ultimoCriadero <= COMBO_MS;
    this.combo = enCombo ? this.combo + 1 : 1;
    const bonus = enCombo ? BONUS_COMBO : 0;
    this.puntos += PUNTOS_CRIADERO + bonus;
    this.ultimoCriadero = now;
    return { puntos: PUNTOS_CRIADERO, bonus, combo: this.combo, total: this.puntos };
  }

  /** Fracción 0..1 de criaderos limpios. */
  progreso(limpios, total) {
    if (!total) return 0;
    return Math.min(1, Math.max(0, limpios / total));
  }

  /**
   * Estrellas según el tiempo total en segundos (solo si el nivel se completó).
   * 3 si < 150 s, 2 si < 240 s, 1 por completar.
   */
  calcularEstrellas(segundos, completo = true) {
    if (!completo) return 0;
    if (segundos < UMBRAL_3_ESTRELLAS) return 3;
    if (segundos < UMBRAL_2_ESTRELLAS) return 2;
    return 1;
  }
}
