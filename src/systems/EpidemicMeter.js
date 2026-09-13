/**
 * EpidemicMeter — riesgo de epidemia del nivel v2 (mockup, sección 1.4). No depende de Phaser
 * (como ScoreManager/MissionManager): `deltaMs` lo da GameScene (`this.game.loop.delta`).
 *
 * Sube con cada brote activo (según su nivel) y con cada criadero sucio; baja de golpe al
 * fumigar un brote o al limpiar un criadero. Clamp 0..100.
 */
const SUBIDA_POR_NIVEL = { pequeno: 0.4, medio: 0.8, grande: 1.5 };
const SUBIDA_POR_CRIADERO_SUCIO = 0.05;
const BAJADA_FUMIGADO = { pequeno: 8, medio: 12, grande: 18 };
const BAJADA_LIMPIEZA = 3;

const clamp = (v) => Math.min(100, Math.max(0, v));

export class EpidemicMeter {
  constructor() {
    this.listeners = [];
    this.reset();
  }

  reset() {
    this.valor = 0;
    this.emit();
  }

  /** Suscribe un callback que recibe (valor, this) en cada cambio. Devuelve una función para desuscribir. */
  onChange(cb) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  emit() {
    for (const cb of this.listeners) cb(this.valor, this);
  }

  /** Aplica un nuevo valor clampeado y emite solo si cambió de verdad. */
  set(v) {
    const clamped = clamp(v);
    if (clamped === this.valor) return;
    this.valor = clamped;
    this.emit();
  }

  /**
   * @param {number} deltaMs tiempo transcurrido desde el último tick (ms)
   * @param {{ brotesActivos?: Array<{nivel:string}>, criaderosSucios?: number }} [opts]
   */
  tick(deltaMs, { brotesActivos = [], criaderosSucios = 0 } = {}) {
    if (!deltaMs) return;
    let subePorSeg = criaderosSucios * SUBIDA_POR_CRIADERO_SUCIO;
    for (const brote of brotesActivos) {
      subePorSeg += SUBIDA_POR_NIVEL[brote?.nivel] ?? SUBIDA_POR_NIVEL.pequeno;
    }
    if (subePorSeg <= 0) return;
    this.set(this.valor + subePorSeg * (deltaMs / 1000));
  }

  /** Un brote fue fumigado: baja de golpe según su nivel. */
  registrarFumigado(nivel) {
    this.set(this.valor - (BAJADA_FUMIGADO[nivel] ?? BAJADA_FUMIGADO.pequeno));
  }

  /** Un criadero fue limpiado: baja un poco. */
  registrarLimpieza() {
    this.set(this.valor - BAJADA_LIMPIEZA);
  }
}
