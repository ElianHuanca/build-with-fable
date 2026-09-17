import Phaser from 'phaser';

/**
 * Reputacion — "confianza del barrio" en SEDES y en el trabajo del jugador (plan v4, capa de
 * consecuencia visible, separada del riesgo de epidemia). No es condición de victoria/derrota:
 * es un termómetro narrativo, pensado para toasts cortos y una barra chica en el HUD, en el mismo
 * espíritu que `hud.barrio`/`hud.riesgo`.
 *
 * Relación con los otros sistemas (Reputacion NO los importa ni los conoce; es GameScene quien
 * escucha `EpidemicMeter`/`Hospital` y llama a los métodos de acá):
 * - `EpidemicMeter` (`src/systems/EpidemicMeter.js`) mide el riesgo de epidemia (0..100) segundo a
 *   segundo. Reputacion no duplica ese cálculo: reacciona cuando el riesgo se sostiene alto por un
 *   rato (`tick`) y cuando el jugador actúa sobre sus causas (limpiar criaderos, fumigar brotes).
 * - `Hospital` (`src/objects/Hospital.js`) emite `'saturado'`/`'desaturado'` al llenarse/vaciarse
 *   sus camas. Un hospital saturado es la consecuencia más dura y visible de un riesgo alto
 *   sostenido, así que golpea fuerte la reputación; desaturar la recupera, pero menos de lo que
 *   costó perderla (confianza cuesta más ganar que perder... pero acá al revés: perderla es más
 *   fácil que recuperarla, como en la vida real de un barrio).
 *
 * Valor 0..100, arranca en `VALOR_INICIAL` (70: ni desconfianza total ni confianza ciega). Emite
 * eventos Phaser `'mejora'` y `'empeora'` cada vez que el valor cruza de una "banda" a otra
 * (bandas de 20 puntos: 0-20, 20-40, 40-60, 60-80, 80-100), y además `'enRiesgo'`/`'confianzaAlta'`
 * al cruzar los umbrales narrativos (<30 y >80) para que GameScene dispare un toast puntual sin
 * tener que recalcular bandas él mismo.
 */

// Arranque: ver JSDoc arriba.
const VALOR_INICIAL = 70;
const MIN = 0, MAX = 100;

// Bandas de 20 puntos para 'mejora'/'empeora' (0..4).
const ANCHO_BANDA = 20;
const banda = (v) => Math.min(4, Math.floor(v / ANCHO_BANDA));

// Umbrales narrativos: por debajo, el barrio "no confía"; por arriba, confianza alta.
const UMBRAL_RIESGO = 30;
const UMBRAL_CONFIANZA_ALTA = 80;

// --- Magnitudes de cada evento del juego (ajustables sin tocar la lógica) ---
// Buenas acciones del jugador.
const SUBIDA_LIMPIEZA = 2;           // limpiar un criadero
const SUBIDA_FUMIGADO_PRONTO = 4;    // fumigar un brote antes de que crezca
const SUBIDA_HOSPITAL_DESATURADO = 6;
// Consecuencias negativas.
const BAJADA_HOSPITAL_SATURADO = 15; // más dura: perder confianza es más fácil que ganarla
const BAJADA_CRIADEROS_ACUMULADOS = 0.03; // por criadero sucio y por segundo (tick)
// Riesgo epidémico sostenido: solo pesa si se mantiene alto por un rato, no de golpe.
const UMBRAL_RIESGO_EPIDEMIA = 60;   // valor de EpidemicMeter a partir del cual empieza a pesar
const BAJADA_RIESGO_SOSTENIDO_POR_SEG = 0.25;
// Recuperación pasiva lenta cuando todo está tranquilo (barrio "se olvida" de a poco).
const SUBIDA_PASIVA_POR_SEG = 0.05;

const clamp = (v) => Math.min(MAX, Math.max(MIN, v));

export class Reputacion extends Phaser.Events.EventEmitter {
  constructor(valorInicial = VALOR_INICIAL) {
    super();
    this.valor = clamp(valorInicial);
    this._banda = banda(this.valor);
    this._enRiesgo = this.valor < UMBRAL_RIESGO;
    this._confianzaAlta = this.valor > UMBRAL_CONFIANZA_ALTA;
    this._registry = null;
  }

  /** Valor actual (0..100). */
  valorActual() {
    return this.valor;
  }

  /** ¿El barrio está desconfiado (por debajo del umbral de riesgo)? */
  estaEnRiesgo() {
    return this._enRiesgo;
  }

  /** ¿El barrio confía mucho en el trabajo del jugador/SEDES? */
  tieneConfianzaAlta() {
    return this._confianzaAlta;
  }

  /**
   * Conecta esta instancia a un `registry` de Phaser (`scene.registry`): cada cambio de valor se
   * refleja en `registry.set('reputacion', valor)`, para que HUDScene (u otra escena) lo lea sin
   * necesitar una referencia a esta clase. Llama una vez con el valor inicial.
   */
  vincularRegistry(registry) {
    this._registry = registry;
    this._registry?.set('reputacion', this.valor);
    return this;
  }

  /** Aplica un nuevo valor clampeado; emite los eventos de cruce de banda/umbral solo si corresponde. */
  _set(v) {
    const anterior = this.valor;
    const clamped = clamp(v);
    if (clamped === anterior) return;
    this.valor = clamped;
    this._registry?.set('reputacion', this.valor);

    const bandaAnterior = this._banda;
    const bandaNueva = banda(this.valor);
    if (bandaNueva !== bandaAnterior) {
      this._banda = bandaNueva;
      this.emit(bandaNueva > bandaAnterior ? 'mejora' : 'empeora', this.valor, this);
    }

    const enRiesgoAntes = this._enRiesgo;
    this._enRiesgo = this.valor < UMBRAL_RIESGO;
    if (this._enRiesgo && !enRiesgoAntes) this.emit('enRiesgo', this.valor, this);

    const confianzaAltaAntes = this._confianzaAlta;
    this._confianzaAlta = this.valor > UMBRAL_CONFIANZA_ALTA;
    if (this._confianzaAlta && !confianzaAltaAntes) this.emit('confianzaAlta', this.valor, this);
  }

  /** Sube el valor en `cantidad` puntos (positivo). */
  subir(cantidad) {
    if (cantidad > 0) this._set(this.valor + cantidad);
  }

  /** Baja el valor en `cantidad` puntos (positivo = baja esa magnitud). */
  bajar(cantidad) {
    if (cantidad > 0) this._set(this.valor - cantidad);
  }

  // --- Atajos semánticos para que GameScene no tenga que conocer las magnitudes ---

  /** El jugador limpió un criadero: pequeña mejora de confianza. */
  registrarLimpieza() {
    this.subir(SUBIDA_LIMPIEZA);
  }

  /** El jugador fumigó un brote antes de que se saliera de control: mejora de confianza. */
  registrarFumigadoPronto() {
    this.subir(SUBIDA_FUMIGADO_PRONTO);
  }

  /** El hospital llegó a su límite de camas (evento `'saturado'` de `Hospital`): golpe fuerte. */
  registrarHospitalSaturado() {
    this.bajar(BAJADA_HOSPITAL_SATURADO);
  }

  /** El hospital volvió a tener camas libres (evento `'desaturado'` de `Hospital`): recupera algo. */
  registrarHospitalDesaturado() {
    this.subir(SUBIDA_HOSPITAL_DESATURADO);
  }

  /**
   * Llamar cada frame desde `GameScene.update` (mismo patrón que `EpidemicMeter.tick`), pasando
   * el valor actual del medidor de epidemia y la cantidad de criaderos sucios. El riesgo sostenido
   * y los criaderos acumulados desgastan la confianza de a poco; si todo está tranquilo, se
   * recupera despacio sola (el barrio "se olvida" con el tiempo).
   * @param {number} deltaMs tiempo transcurrido desde el último tick (ms)
   * @param {{ epidemiaValor?: number, criaderosSucios?: number }} [opts]
   */
  tick(deltaMs, { epidemiaValor = 0, criaderosSucios = 0 } = {}) {
    if (!deltaMs) return;
    const seg = deltaMs / 1000;
    let cambio = 0;
    if (epidemiaValor >= UMBRAL_RIESGO_EPIDEMIA) {
      cambio -= BAJADA_RIESGO_SOSTENIDO_POR_SEG * seg;
    }
    if (criaderosSucios > 0) {
      cambio -= BAJADA_CRIADEROS_ACUMULADOS * criaderosSucios * seg;
    }
    if (epidemiaValor < UMBRAL_RIESGO_EPIDEMIA && criaderosSucios === 0) {
      cambio += SUBIDA_PASIVA_POR_SEG * seg;
    }
    if (cambio !== 0) this._set(this.valor + cambio);
  }

  /** Reinicia al valor inicial (o al indicado) y re-sincroniza el registry si está vinculado. */
  reset(valorInicial = VALOR_INICIAL) {
    this.valor = clamp(valorInicial);
    this._banda = banda(this.valor);
    this._enRiesgo = this.valor < UMBRAL_RIESGO;
    this._confianzaAlta = this.valor > UMBRAL_CONFIANZA_ALTA;
    this._registry?.set('reputacion', this.valor);
  }
}
