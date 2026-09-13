/**
 * Progreso por nivel en localStorage (clave 'dengue.progreso').
 * Tolera localStorage inaccesible (modo privado, iframe sin permisos): en ese
 * caso usa una copia en memoria que dura la sesión.
 */
export const SAVE_KEY = 'dengue.progreso';

function leerTodo() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null; // sin localStorage: se usa solo la memoria
    const raw = ls.getItem(SAVE_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return null; // inaccesible o corrupto
  }
}

function escribirTodo(datos) {
  try {
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(datos));
    return true;
  } catch {
    return false;
  }
}

export class SaveSystem {
  constructor() {
    this.memoria = leerTodo() || {};
  }

  /** @returns {{estrellas:number, mejorTiempo:number|null, mejorPuntos:number}|null} */
  getNivel(id) {
    const todo = leerTodo();
    if (todo) this.memoria = todo;
    const n = this.memoria[id];
    if (!n) return null;
    return {
      estrellas: n.estrellas ?? 0,
      mejorTiempo: n.mejorTiempo ?? null,
      mejorPuntos: n.mejorPuntos ?? 0,
    };
  }

  /**
   * Guarda el resultado de una partida conservando el máximo de estrellas,
   * el mínimo tiempo y el máximo de puntos.
   * @returns {{estrellas:number, mejorTiempo:number|null, mejorPuntos:number}} registro resultante
   */
  guardarNivel(id, { estrellas = 0, tiempo = null, puntos = 0 } = {}) {
    const prev = this.getNivel(id) || { estrellas: 0, mejorTiempo: null, mejorPuntos: 0 };
    const rec = {
      estrellas: Math.max(prev.estrellas, estrellas),
      mejorTiempo: tiempo == null ? prev.mejorTiempo
        : (prev.mejorTiempo == null ? tiempo : Math.min(prev.mejorTiempo, tiempo)),
      mejorPuntos: Math.max(prev.mejorPuntos, puntos),
      jugadoEn: Date.now(),
    };
    this.memoria = { ...this.memoria, [id]: rec };
    escribirTodo(this.memoria);
    return { estrellas: rec.estrellas, mejorTiempo: rec.mejorTiempo, mejorPuntos: rec.mejorPuntos };
  }

  /** Borra todo el progreso. */
  reset() {
    this.memoria = {};
    try { globalThis.localStorage?.removeItem(SAVE_KEY); } catch { /* ignorar */ }
  }
}

/** Instancia compartida para todo el juego. */
export const saveSystem = new SaveSystem();
