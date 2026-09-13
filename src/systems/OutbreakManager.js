import Phaser from 'phaser';
import { Brote } from '../objects/Brote.js';

// Intervalo entre apariciones (se elige uno nuevo al azar tras cada spawn).
const SPAWN_MIN_MS = 25000;
const SPAWN_MAX_MS = 40000;
// Probabilidad de aparecer cerca de un criadero sucio en vez de en un punto al azar del mapa.
const PROB_CERCA_CRIADERO = 0.7;
const CERCA_MIN_PX = 80;
const CERCA_MAX_PX = 160;

/**
 * OutbreakManager — hace aparecer y llevar la cuenta de los Brote del nivel (mockup, sección 1.3).
 * No fumiga ni destruye brotes: eso lo hace quien llame a `Brote.fumigar()` (GameScene); este
 * sistema solo decide cuándo y dónde aparecen, y mantiene `this.activos` al día.
 *
 * `.onChange(cb)` se dispara con `cb(this.activos)` cuando un brote aparece, crece de nivel
 * (el propio Brote emite 'crecio') o se fumiga (Brote emite 'fumigado').
 */
export class OutbreakManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ criaderos?: Array<{x:number,y:number,state?:string}>, bounds: {x:number,y:number,w:number,h:number} }} opts
   *   criaderos: lista viva de criaderos del nivel (se lee `state` en cada spawn);
   *   bounds: rectángulo del mapa donde pueden aparecer los brotes.
   */
  constructor(scene, { criaderos = [], bounds } = {}) {
    this.scene = scene;
    this.criaderos = criaderos;
    this.bounds = bounds || { x: 0, y: 0, w: scene.scale.width, h: scene.scale.height };
    this.activos = [];
    this.onChangeCb = null;
    this.destruido = false;
    this.acumulado = 0;
    this.proximoSpawn = this.randomSpawnDelay();

    scene.events.once('shutdown', () => this.destroy());
  }

  /** Suscribe un único callback simple (alcanza para que GameScene reaccione). */
  onChange(cb) { this.onChangeCb = cb; }

  randomSpawnDelay() {
    return Phaser.Math.Between(SPAWN_MIN_MS, SPAWN_MAX_MS);
  }

  /** Llamar cada frame desde GameScene.update(). */
  update(time, delta) {
    if (this.destruido) return;
    this.acumulado += delta;
    if (this.acumulado < this.proximoSpawn) return;
    this.acumulado = 0;
    this.proximoSpawn = this.randomSpawnDelay();
    this.spawn();
  }

  /** Punto de aparición: 70% cerca (80-160px) de un criadero sucio, 30% al azar en bounds. */
  elegirPosicion() {
    const { x, y, w, h } = this.bounds;
    const sucios = this.criaderos.filter((c) => c && c.state !== 'limpio');
    if (sucios.length > 0 && Math.random() < PROB_CERCA_CRIADERO) {
      const base = Phaser.Utils.Array.GetRandom(sucios);
      const dist = Phaser.Math.FloatBetween(CERCA_MIN_PX, CERCA_MAX_PX);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      return {
        x: Phaser.Math.Clamp(base.x + Math.cos(ang) * dist, x, x + w),
        y: Phaser.Math.Clamp(base.y + Math.sin(ang) * dist, y, y + h),
      };
    }
    return { x: Phaser.Math.FloatBetween(x, x + w), y: Phaser.Math.FloatBetween(y, y + h) };
  }

  spawn() {
    const { x, y } = this.elegirPosicion();
    const brote = new Brote(this.scene, x, y);
    brote.on('crecio', () => this.onChangeCb?.(this.activos));
    brote.on('fumigado', () => this.quitar(brote));
    this.activos.push(brote);
    this.onChangeCb?.(this.activos);
  }

  quitar(brote) {
    if (!this.activos.includes(brote)) return;
    this.activos = this.activos.filter((b) => b !== brote);
    this.onChangeCb?.(this.activos);
  }

  /** Detiene nuevas apariciones al cerrar la escena (los Brote ya creados los destruye Phaser). */
  destroy() {
    this.destruido = true;
    this.onChangeCb = null;
  }
}
