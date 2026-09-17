import Phaser from 'phaser';
import { saveSystem } from './SaveSystem.js';

/**
 * Economía del Agente (plan v4 §1/§4): "Bs" (bolivianos), moneda separada de los puntos/estrellas
 * de la jornada. Esta clase es SOLO el acumulador de la jornada en curso (como `Reputacion`,
 * `EpidemicMeter`): registra cuánto se ganó hoy por acción y calcula el bono de SEDES al cerrar,
 * pero NO toca el saldo persistente — eso es responsabilidad de `SaveSystem` (saldoBs()/
 * depositar()/comprarMejora()), que sí sobrevive entre jornadas y alimenta la Tienda SEDES.
 * GameScene llama `depositarEnBilletera()` una sola vez, en `finDeNivel()`, después de calcular
 * el bono final — así el jugador nunca gasta en la Tienda un Bs que "ganó" a mitad de una jornada
 * que después perdió (no hay forma de retirar en medio de la jornada, solo de acumular).
 */

/** Bs por acción (ajustables sin tocar la lógica). */
const BS_LIMPIEZA = 8;
const BS_BASURA = 4;
const BS_BASURA_TARDE = 2;
const BS_BROTE = { pequeno: 12, medio: 16, grande: 20 };
/** Bono de SEDES al cerrar la jornada: hasta BS_BONO_MAX según % de barrio protegido (0..1). */
const BS_BONO_MAX = 100;

export class Economia extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    this.ganadoJornada = 0;
  }

  /** Bs ganados en la jornada hasta ahora (sin contar el bono final, que se suma al cerrar). */
  totalGanadoJornada() {
    return this.ganadoJornada;
  }

  _ganar(cantidad) {
    if (!(cantidad > 0)) return;
    this.ganadoJornada += cantidad;
    this.emit('ganancia', cantidad, this.ganadoJornada);
  }

  /** El jugador limpió un criadero. */
  registrarLimpieza() {
    this._ganar(BS_LIMPIEZA);
  }

  /** El jugador fumigó un brote de nivel `nivel` ('pequeno'|'medio'|'grande'). */
  registrarFumigado(nivel) {
    this._ganar(BS_BROTE[nivel] ?? BS_BROTE.pequeno);
  }

  /** El jugador recogió basura antes de que madurara (o tarde, ya como criadero: paga menos). */
  registrarBasuraRecogida(tarde = false) {
    this._ganar(tarde ? BS_BASURA_TARDE : BS_BASURA);
  }

  /**
   * Bono de SEDES al cerrar la jornada (v4 §1: "SEDES literalmente le paga al jugador"),
   * proporcional al % de barrio protegido (0..1). No modifica el saldo — solo calcula y suma
   * al acumulado de la jornada; `depositarEnBilletera()` lo vuelca junto con todo lo demás.
   * @param {number} pctProtegido 0..1
   * @returns {number} el bono calculado
   */
  aplicarBonoJornada(pctProtegido) {
    const bono = Math.round(BS_BONO_MAX * Phaser.Math.Clamp(pctProtegido, 0, 1));
    this._ganar(bono);
    return bono;
  }

  /**
   * Vuelca lo ganado en la jornada al saldo persistente (`SaveSystem.depositar()`) y reinicia el
   * acumulador. Llamar una sola vez, en `GameScene.finDeNivel()` (después de `aplicarBonoJornada`
   * si corresponde). Devuelve el saldo total resultante.
   */
  depositarEnBilletera() {
    const total = this.ganadoJornada;
    this.ganadoJornada = 0;
    return total > 0 ? saveSystem.depositar(total) : saveSystem.saldoBs();
  }
}
