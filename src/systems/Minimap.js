import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { Layout } from './Layout.js';

const DEPTH = 9500;
const SIZE_VERTICAL = 96;
const SIZE_HORIZONTAL = 140;
const RADIO_MARCO = 10;
const PAD = 6; // margen interno: los puntos no tocan el borde del marco
const ROJO = 0xe74c3c;
// Espacio que deja libre el panel "Barrio protegido" del HUD (MARGEN 12 + alto 74) más un respiro.
const ALTO_PANEL_BARRIO = 86;
const GAP_BARRIO = 10;

/**
 * Minimapa fijo en la esquina superior derecha (debajo del panel "Barrio protegido" del HUD,
 * sin superponerse). Transforma linealmente los límites físicos del nivel
 * (`scene.physics.world.bounds`) al cuadro del minimapa y redibuja los puntos con Graphics
 * en cada `.update()` — pocas entidades, no hace falta RenderTexture.
 * Colores: jugador blanco, estación azul, criaderos sucios amarillo, brotes rojo parpadeante,
 * vehículo verde.
 */
export class Minimap {
  /**
   * @param {{ getEntities: () => {
   *   player: {x:number,y:number}|null,
   *   estacion: {x:number,y:number}|null,
   *   criaderos: Array<{x:number,y:number,state:string}>,
   *   brotes: Array<{x:number,y:number,state:string}>,
   *   vehiculo: {x:number,y:number}|null,
   * } }} opts
   */
  constructor(scene, opts) {
    this.scene = scene;
    this.getEntities = opts.getEntities;
    this.size = SIZE_HORIZONTAL;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH);
    this.marco = scene.add.graphics();
    this.puntos = scene.add.graphics();
    this.container.add([this.marco, this.puntos]);

    this.onResize = (w, h) => this.reposicionar(w, h);
    Layout.onResize(scene, this.onResize);
  }

  reposicionar(w, h) {
    this.size = Layout.isPortrait(this.scene) ? SIZE_VERTICAL : SIZE_HORIZONTAL;
    const safe = Layout.safe(this.scene);
    const x = w - safe.right - this.size;
    const y = Math.max(safe.top, ALTO_PANEL_BARRIO + GAP_BARRIO);
    this.container.setPosition(x, y);
    this.dibujarMarco();
  }

  dibujarMarco() {
    const s = this.size;
    const g = this.marco.clear();
    g.fillStyle(hex(PALETTE.marino), 0.9).fillRoundedRect(0, 0, s, s, RADIO_MARCO);
    g.lineStyle(3, hex(PALETTE.celeste), 1).strokeRoundedRect(0, 0, s, s, RADIO_MARCO);
  }

  /** Límites de mundo usados para la transformación lineal (fallback defensivo si aún no hay nivel). */
  limites() {
    const b = this.scene.physics?.world?.bounds;
    if (b && b.width > 0 && b.height > 0) return b;
    return { x: 0, y: 0, width: this.scene.scale.width, height: this.scene.scale.height };
  }

  /** Proyecta un punto de mundo al cuadro interno del minimapa (con margen PAD). */
  proyectar(x, y, b) {
    const inner = this.size - PAD * 2;
    const nx = Phaser.Math.Clamp((x - b.x) / b.width, 0, 1);
    const ny = Phaser.Math.Clamp((y - b.y) / b.height, 0, 1);
    return { x: PAD + nx * inner, y: PAD + ny * inner };
  }

  puntoColor(g, x, y, b, color, radio) {
    const p = this.proyectar(x, y, b);
    g.fillStyle(hex(color), 1).fillCircle(p.x, p.y, radio);
  }

  /** Llamar una vez por frame desde GameScene.update(). */
  update() {
    const e = this.getEntities?.() || {};
    const b = this.limites();
    const g = this.puntos.clear();

    if (Array.isArray(e.criaderos)) {
      for (const c of e.criaderos) {
        if (c && c.state !== 'limpio') this.puntoColor(g, c.x, c.y, b, PALETTE.amarillo, 2.5);
      }
    }
    if (e.estacion) this.puntoColor(g, e.estacion.x, e.estacion.y, b, PALETTE.azulGorra, 3.5);
    if (Array.isArray(e.brotes)) {
      const blink = 0.35 + 0.65 * ((Math.sin(this.scene.time.now / 150) + 1) / 2);
      for (const brote of e.brotes) {
        if (!brote || brote.state === 'fumigado') continue;
        const p = this.proyectar(brote.x, brote.y, b);
        g.fillStyle(ROJO, blink).fillCircle(p.x, p.y, 3.5);
      }
    }
    if (e.vehiculo) this.puntoColor(g, e.vehiculo.x, e.vehiculo.y, b, PALETTE.verde, 3);
    if (e.player) this.puntoColor(g, e.player.x, e.player.y, b, PALETTE.blanco, 3);
  }

  destroy() {
    this.container.destroy();
  }
}
