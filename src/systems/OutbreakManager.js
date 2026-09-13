import Phaser from 'phaser';
import { Brote } from '../objects/Brote.js';

// Primer brote de la jornada (GDD sección 3) e intervalo entre los siguientes (al azar tras cada spawn).
const PRIMER_SPAWN_MS = 15000;
const SPAWN_MIN_MS = 25000;
const SPAWN_MAX_MS = 40000;
// Brotes activos a la vez como máximo: si se alcanza, el spawn se salta y se espera el próximo intervalo.
const MAX_ACTIVOS = 3;
// Probabilidad de aparecer cerca de un criadero sucio en vez de en un punto al azar del mapa.
const PROB_CERCA_CRIADERO = 0.7;
const CERCA_MIN_PX = 80;
const CERCA_MAX_PX = 160;
// Distancia mínima a un objeto sólido (casa, árbol, muro) para que el brote quede alcanzable.
const DIST_MIN_SOLIDO = 72;
const MARGEN_BORDE = 48;
const INTENTOS_POSICION = 30;

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
   * @param {{ criaderos?: Array<{x:number,y:number,state?:string}>, bounds: {x:number,y:number,w:number,h:number},
   *   solidos?: Array<{x:number,y:number}> }} opts
   *   criaderos: lista viva de criaderos del nivel (se lee `state` en cada spawn);
   *   bounds: rectángulo del mapa donde pueden aparecer los brotes;
   *   solidos: centros de los objetos sólidos del nivel (los brotes evitan nacer encima).
   */
  constructor(scene, { criaderos = [], bounds, solidos = [] } = {}) {
    this.scene = scene;
    this.criaderos = criaderos;
    this.bounds = bounds || { x: 0, y: 0, w: scene.scale.width, h: scene.scale.height };
    this.solidos = solidos;
    this.activos = [];
    this.onChangeCb = null;
    this.destruido = false;
    // Se programa sobre el reloj de la jornada (ms transcurridos que pasa GameScene, ya
    // descontada la pausa) y no sobre `loop.delta`, que Phaser suaviza/acota si el equipo va lento.
    this.transcurrido = 0;
    this.proximoSpawn = PRIMER_SPAWN_MS;
    this.proximoSpawnEn = PRIMER_SPAWN_MS;

    scene.events.once('shutdown', () => this.destroy());
  }

  /** Suscribe un único callback simple (alcanza para que GameScene reaccione). */
  onChange(cb) { this.onChangeCb = cb; }

  randomSpawnDelay() {
    return Phaser.Math.Between(SPAWN_MIN_MS, SPAWN_MAX_MS);
  }

  /**
   * Llamar cada frame desde GameScene.update().
   * @param {number} transcurridoMs ms de jornada transcurridos (sin contar la pausa)
   */
  update(transcurridoMs) {
    if (this.destruido) return;
    this.transcurrido = transcurridoMs;
    if (transcurridoMs < this.proximoSpawnEn) return;
    this.proximoSpawn = this.randomSpawnDelay();
    this.proximoSpawnEn = transcurridoMs + this.proximoSpawn;
    if (this.activos.length >= MAX_ACTIVOS) return;
    this.spawn();
  }

  /** Punto de aparición: 70% cerca (80-160px) de un criadero sucio, 30% al azar en bounds. */
  elegirPosicion() {
    const { x, y, w, h } = this.bounds;
    const sucios = this.criaderos.filter((c) => c && c.state !== 'limpio');
    const cerca = sucios.length > 0 && Math.random() < PROB_CERCA_CRIADERO;
    let p = null;
    for (let i = 0; i < INTENTOS_POSICION; i++) {
      if (cerca) {
        const base = Phaser.Utils.Array.GetRandom(sucios);
        const dist = Phaser.Math.FloatBetween(CERCA_MIN_PX, CERCA_MAX_PX);
        const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
        p = {
          x: Phaser.Math.Clamp(base.x + Math.cos(ang) * dist, x + MARGEN_BORDE, x + w - MARGEN_BORDE),
          y: Phaser.Math.Clamp(base.y + Math.sin(ang) * dist, y + MARGEN_BORDE, y + h - MARGEN_BORDE),
        };
      } else {
        p = {
          x: Phaser.Math.FloatBetween(x + MARGEN_BORDE, x + w - MARGEN_BORDE),
          y: Phaser.Math.FloatBetween(y + MARGEN_BORDE, y + h - MARGEN_BORDE),
        };
      }
      if (this.esAlcanzable(p)) return p;
    }
    return p; // último intento aunque no sea ideal: mejor un brote raro que ninguno
  }

  /** ¿El punto queda lejos de todo objeto sólido (casas, árboles, muros)? */
  esAlcanzable(p) {
    for (const s of this.solidos) {
      if (Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y) < DIST_MIN_SOLIDO) return false;
    }
    return true;
  }

  /** Crea un brote (en `pos` o en un punto elegido) y avisa por onChange. */
  spawn(pos) {
    const { x, y } = pos || this.elegirPosicion();
    const brote = new Brote(this.scene, x, y);
    brote.on('crecio', () => this.onChangeCb?.(this.activos));
    brote.on('fumigado', () => this.quitar(brote));
    this.activos.push(brote);
    this.onChangeCb?.(this.activos);
    return brote;
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
    this.activos = [];
  }
}
