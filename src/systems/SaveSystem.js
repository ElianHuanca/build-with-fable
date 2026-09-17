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

/**
 * Reto familiar (v4): 3 acciones reales de prevención (ver src/data/library.js,
 * pestaña 'prevencion') para hacer en casa durante la semana. Se guardan bajo la
 * clave 'reto' del mismo blob de progreso: { acciones: [id,id,id], hechas: [bool,bool,bool],
 * reclamado: boolean }. `reclamado` se pone en true tras otorgar la insignia, para que
 * la próxima llamada a retoActual() arme un set nuevo.
 */
export const RETO_ACCIONES = ['baldes', 'tanques', 'floreros', 'llantas', 'descacharrado'];

function elegirTresAcciones() {
  const ids = RETO_ACCIONES.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, 3);
}

/**
 * Mejoras compradas en la Tienda SEDES (v4 §4.2), pagadas con Bs y persistentes entre jornadas
 * (a diferencia de puntos/estrellas, que son por jornada). Cada una es un multiplicador aplicado
 * a una mecánica que YA existe en el juego — no se inventó un recurso nuevo (p. ej. munición de
 * tanque) para no salirse del alcance del plan v4 (ver docs/PLAN_V4_MUNDO_VIVO.md §9, "no convertir
 * el juego en un city-builder"). `efecto` es el multiplicador que aplica GameScene/Player al leer
 * `SaveSystem.tieneMejora(id)`.
 */
export const MEJORAS = [
  { id: 'mochila', costo: 150, efecto: 1.25 },   // +25% radio de detección de criaderos/brotes/basura
  { id: 'fumigacion', costo: 200, efecto: 0.75 }, // -25% duración de fumigar un brote
  { id: 'bicicleta', costo: 250, efecto: 1.2 },   // +20% velocidad a pie
];

export class SaveSystem {
  constructor() {
    this.memoria = leerTodo() || {};
  }

  /** Saldo actual de Bs (moneda del Agente, v4 §1), persistente entre jornadas. */
  saldoBs() {
    const todo = leerTodo();
    if (todo) this.memoria = todo;
    return Number.isFinite(this.memoria.bs) ? this.memoria.bs : 0;
  }

  /** Suma `cantidad` Bs al saldo (bono de jornada, recompensas). Ignora cantidades ≤ 0. */
  depositar(cantidad) {
    if (!(cantidad > 0)) return this.saldoBs();
    const nuevo = this.saldoBs() + Math.round(cantidad);
    this.memoria = { ...this.memoria, bs: nuevo };
    escribirTodo(this.memoria);
    return nuevo;
  }

  /**
   * Descuenta `cantidad` Bs del saldo para un gasto puntual (p. ej. contratar una cuadrilla,
   * v4 §4.3) — a diferencia de `comprarMejora`, esto no deja nada "comprado" de forma permanente,
   * solo gasta. Devuelve `{ ok, saldo }`; `ok=false` (y no descuenta nada) si no alcanza.
   */
  gastar(cantidad) {
    const saldo = this.saldoBs();
    if (!(cantidad > 0) || saldo < cantidad) return { ok: false, saldo };
    const nuevo = saldo - Math.round(cantidad);
    this.memoria = { ...this.memoria, bs: nuevo };
    escribirTodo(this.memoria);
    return { ok: true, saldo: nuevo };
  }

  /** ¿La mejora `id` ya fue comprada? */
  tieneMejora(id) {
    const todo = leerTodo();
    if (todo) this.memoria = todo;
    return !!this.memoria.mejoras?.[id];
  }

  /**
   * Intenta comprar una mejora de `MEJORAS`: descuenta su costo si el saldo alcanza y no fue
   * comprada antes. Devuelve `{ ok, saldo }` — `ok=false` si ya la tenía o no le alcanza.
   */
  comprarMejora(id) {
    const def = MEJORAS.find((m) => m.id === id);
    if (!def || this.tieneMejora(id)) return { ok: false, saldo: this.saldoBs() };
    const saldo = this.saldoBs();
    if (saldo < def.costo) return { ok: false, saldo };
    const nuevoSaldo = saldo - def.costo;
    const mejoras = { ...(this.memoria.mejoras || {}), [id]: true };
    this.memoria = { ...this.memoria, bs: nuevoSaldo, mejoras };
    escribirTodo(this.memoria);
    return { ok: true, saldo: nuevoSaldo };
  }

  /** Multiplicador efectivo de una mejora (1 si no fue comprada o no existe). */
  efectoMejora(id) {
    const def = MEJORAS.find((m) => m.id === id);
    return def && this.tieneMejora(id) ? def.efecto : 1;
  }

  /**
   * Reto familiar vigente: lo genera si no existe todavía o si el anterior ya
   * fue completado y reclamado (ver reclamarReto()).
   * @returns {{acciones:string[], hechas:boolean[]}}
   */
  retoActual() {
    const todo = leerTodo();
    if (todo) this.memoria = todo;
    const r = this.memoria.reto;
    if (!r || !Array.isArray(r.acciones) || r.reclamado) {
      const acciones = elegirTresAcciones();
      const nuevo = { acciones, hechas: [false, false, false], reclamado: false };
      this.memoria = { ...this.memoria, reto: nuevo };
      escribirTodo(this.memoria);
      return { acciones: nuevo.acciones, hechas: nuevo.hechas.slice() };
    }
    const hechas = [0, 1, 2].map((i) => !!r.hechas?.[i]);
    return { acciones: r.acciones.slice(0, 3), hechas };
  }

  /** Marca hecha (o no) una de las 3 acciones del reto vigente. */
  marcarRetoHecho(indice, hecho = true) {
    const actual = this.retoActual();
    const hechas = actual.hechas.slice();
    if (indice < 0 || indice >= hechas.length) return actual;
    hechas[indice] = !!hecho;
    const r = { acciones: actual.acciones, hechas, reclamado: false };
    this.memoria = { ...this.memoria, reto: r };
    escribirTodo(this.memoria);
    return { acciones: r.acciones, hechas: hechas.slice() };
  }

  /** ¿Las 3 acciones del reto vigente están marcadas como hechas? */
  retoCompleto() {
    const { hechas } = this.retoActual();
    return hechas.length === 3 && hechas.every(Boolean);
  }

  /** Marca el reto vigente como reclamado: la próxima retoActual() arma uno nuevo. */
  reclamarReto() {
    const actual = this.retoActual();
    const r = { acciones: actual.acciones, hechas: actual.hechas, reclamado: true };
    this.memoria = { ...this.memoria, reto: r };
    escribirTodo(this.memoria);
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
