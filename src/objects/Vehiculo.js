import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const W = 56, H = 36;
const DIRS = ['down', 'up', 'left', 'right'];

/**
 * Camioneta de fumigación: nace estacionada junto a la estación. `subir(player)` la hace
 * seguir al jugador cada frame (decorativo, sin cuerpo físico propio); `bajar(x, y)` la deja
 * estacionada donde el jugador la dejó. Usa texturas `vehiculo_<down|up|left|right>` según la
 * última dirección del jugador si existen; si no, un rectángulo de fallback (mismo patrón de
 * `Criadero.textureFor`).
 */
export class Vehiculo extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, Vehiculo.textureFor(scene, 'down'));
    this.dir = 'down';
    this.montado = false;
    this.jinete = null;
    scene.add.existing(this);
    this.setDepth(y);
  }

  /** Textura para una dirección; genera el fallback (rectángulo) una sola vez por dirección. */
  static textureFor(scene, dir) {
    const key = `vehiculo_${dir}`;
    if (scene.textures.exists(key)) return key;
    const fb = `fb_${key}`;
    if (!scene.textures.exists(fb)) {
      const rt = scene.add.renderTexture(0, 0, W, H).setVisible(false);
      const g = scene.add.graphics();
      g.fillStyle(hex(PALETTE.verde), 1).fillRoundedRect(2, 4, W - 4, H - 8, 6);
      g.lineStyle(3, hex(PALETTE.linea), 1).strokeRoundedRect(2, 4, W - 4, H - 8, 6);
      const vx = dir === 'left' ? 4 : W - 20;
      g.fillStyle(hex(PALETTE.celeste), 0.85).fillRoundedRect(vx, 8, 16, H - 16, 3);
      g.fillStyle(hex(PALETTE.gris), 1).fillCircle(12, H - 4, 6).fillCircle(W - 12, H - 4, 6);
      rt.draw(g).saveTexture(fb);
      g.destroy(); rt.destroy();
    }
    return fb;
  }

  /** Cambia la textura según la dirección (si hay sprites de 4 direcciones cargados). */
  setDireccion(dir) {
    if (dir === this.dir || !DIRS.includes(dir)) return;
    this.dir = dir;
    this.setTexture(Vehiculo.textureFor(this.scene, dir));
  }

  /** ¿El jugador está a `radio` px del centro de la camioneta? */
  cerca(player, radio = 90) {
    return !!player && Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y) <= radio;
  }

  /** Sube al jugador: la camioneta pasa a seguirlo cada frame (ver `update`). */
  subir(player) {
    this.montado = true;
    this.jinete = player;
  }

  /** Baja al jugador: la camioneta queda estacionada en (x, y). */
  bajar(x, y) {
    this.montado = false;
    this.jinete = null;
    this.setPosition(x, y);
    this.setDepth(y);
  }

  /** Llamar cada frame: mientras `montado`, sigue al jugador (decorativo, sin física). */
  update() {
    if (!this.montado || !this.jinete) return;
    if (this.jinete.dir) this.setDireccion(this.jinete.dir);
    this.setPosition(this.jinete.x, this.jinete.y + 4);
    this.setDepth(this.jinete.y - 1); // detrás del jugador en el orden de dibujo
  }
}
