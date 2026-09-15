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
    this._bobT = 0; // fase del balanceo mientras avanza (ver `update`)
    this._polvoMs = 0; // acumulador para espaciar las partículas de polvo del escape
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

  /** Textura de una partícula de polvo del escape: disco gris suave de 14 px. */
  static polvoTexture(scene) {
    const key = 'fb_polvo_vehiculo';
    if (scene.textures.exists(key)) return key;
    const rt = scene.add.renderTexture(0, 0, 14, 14).setVisible(false);
    const g = scene.add.graphics();
    for (let r = 6, a = 0.05; r > 1; r -= 1.5, a += 0.1) g.fillStyle(hex(PALETTE.gris), a).fillCircle(7, 7, r);
    rt.draw(g).saveTexture(key);
    g.destroy(); rt.destroy();
    return key;
  }

  /** Suelta una partícula de polvo detrás del vehículo (lado opuesto a la dirección de marcha). */
  emitirPolvo() {
    const back = { down: [0, -14], up: [0, 14], left: [22, 4], right: [-22, 4] }[this.dir] || [0, -14];
    const px = this.x + back[0] + Phaser.Math.Between(-3, 3);
    const py = this.y + back[1] + Phaser.Math.Between(-2, 2);
    const p = this.scene.add.image(px, py, Vehiculo.polvoTexture(this.scene))
      .setDepth((this.depth || 0) - 1).setScale(0.5).setAlpha(0.55);
    this.scene.tweens.add({
      targets: p, y: py + 6, scale: 1.1, alpha: 0, duration: 500, ease: 'Sine.easeOut',
      onComplete: () => p.destroy(),
    });
  }

  /**
   * Llamar cada frame: mientras `montado`, sigue al jugador (decorativo, sin física). Como no
   * tiene piernas no hay animación de cuadros, pero sí un balanceo sutil ("squash and stretch")
   * y polvo de escape mientras avanza, para que no se sienta pegado y estático al jugador.
   */
  update() {
    if (!this.montado || !this.jinete) {
      this._bobT = 0; this._polvoMs = 0;
      this.setAngle(0).setScale(1, 1);
      return;
    }
    if (this.jinete.dir) this.setDireccion(this.jinete.dir);

    const prevX = this.x, prevY = this.y;
    this.setPosition(this.jinete.x, this.jinete.y + 4);
    this.setDepth(this.jinete.y - 1); // detrás del jugador en el orden de dibujo

    const deltaMs = this.scene.game.loop.delta || 16;
    const moviendo = Phaser.Math.Distance.Between(prevX, prevY, this.x, this.y) > 0.05;

    if (moviendo) {
      this._bobT += deltaMs * 0.014;
      this.setAngle(Math.sin(this._bobT) * 2.2);
      this.setScale(1, 1 + Math.sin(this._bobT * 2) * 0.035);

      this._polvoMs -= deltaMs;
      if (this._polvoMs <= 0) {
        this._polvoMs = Phaser.Math.Between(90, 140);
        this.emitirPolvo();
      }
    } else {
      this._bobT = 0; this._polvoMs = 0;
      this.setAngle(0).setScale(1, 1);
    }
  }
}
