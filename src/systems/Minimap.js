import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { Layout } from './Layout.js';
import { MINIMAPA, HUD_KEY_DERECHA_Y } from '../scenes/HUDScene.js';

const DEPTH = 9500;
const RADIO_MARCO = 10;
const PAD = 6; // margen interno: los puntos no tocan el borde del marco
const ROJO = 0xe74c3c;
// Horizontal sin HUD todavía: espacio del panel "Barrio protegido" (MARGEN 12 + alto 74) más un respiro.
const ALTO_PANEL_BARRIO = 86;
const GAP_BARRIO = 10;

/**
 * Minimapa fijo en la esquina superior derecha. Vertical: 100×100 en (w−12−100, 56), en la zona
 * que la HUD deja libre; horizontal: 148×148 en (w−12−148, y) donde y es lo que la HUD publica en
 * el registry (`hudDerechaY`, bajo los paneles "Barrio protegido"/"Riesgo de epidemia") o 96 si
 * aún no arrancó. Transforma linealmente los límites físicos del nivel
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
    this.size = MINIMAPA.horizontal;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH);
    this.marco = scene.add.graphics();
    this.puntos = scene.add.graphics();
    this.container.add([this.marco, this.puntos]);

    this.onResize = (w) => this.reposicionar(w);
    this.offResize = Layout.onResize(scene, this.onResize);
    // La HUD arranca después que GameScene: reubicar cuando publique su ocupación de la derecha.
    // ('setdata' la primera vez que existe la clave, 'changedata' después.)
    this.onRegistry = (parent, key) => { if (key === HUD_KEY_DERECHA_Y) this.reposicionar(scene.scale.width); };
    scene.registry.events.on('setdata', this.onRegistry);
    scene.registry.events.on('changedata', this.onRegistry);
    scene.events.once('shutdown', () => this.quitarRegistry());
  }

  reposicionar(w) {
    const portrait = Layout.isPortrait(this.scene);
    this.size = portrait ? MINIMAPA.vertical : MINIMAPA.horizontal;
    const x = w - MINIMAPA.margen - this.size;
    let y = MINIMAPA.top;
    if (!portrait) {
      const hudY = Number(this.scene.registry.get(HUD_KEY_DERECHA_Y));
      y = Math.max(MINIMAPA.top, Number.isFinite(hudY) && hudY > 0 ? hudY : ALTO_PANEL_BARRIO + GAP_BARRIO);
    }
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

  quitarRegistry() {
    this.scene.registry.events.off('setdata', this.onRegistry);
    this.scene.registry.events.off('changedata', this.onRegistry);
  }

  destroy() {
    this.offResize?.();
    this.quitarRegistry();
    this.container.destroy();
  }
}
