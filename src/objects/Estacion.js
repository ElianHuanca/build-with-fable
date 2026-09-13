import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const W = 128, H = 128;

/**
 * Estación SEDES: edificio fijo donde el agente empieza y vuelve, con la camioneta
 * estacionada al lado (ver `Vehiculo`). Usa la textura `estacion` si existe; si no, dibuja
 * un edificio simple con Graphics (rectángulo PALETTE.azulGorra + techo + garaje), igual
 * que el patrón de fallback de `Criadero.textureFor`.
 * Cuerpo estático, sin collider (no bloquea al jugador, como Criadero).
 */
export class Estacion extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, Estacion.textureFor(scene));
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // cuerpo estático: no bloquea al jugador (sin collider)
    this.body.setSize(W * 0.7, H * 0.35).setOffset(W * 0.15, H * 0.55);
    this.setDepth(y + H / 2);
  }

  /** Devuelve la clave de textura del edificio, creando un fallback (una sola vez) si no existe. */
  static textureFor(scene) {
    const key = 'estacion';
    if (scene.textures.exists(key)) return key;
    const fb = 'fb_estacion';
    if (!scene.textures.exists(fb)) {
      const rt = scene.add.renderTexture(0, 0, W, H).setVisible(false);
      const g = scene.add.graphics();
      g.fillStyle(hex(PALETTE.azulGorra), 1).fillRect(6, 30, W - 12, H - 36);
      g.lineStyle(3, hex(PALETTE.linea), 1).strokeRect(6, 30, W - 12, H - 36);
      g.fillStyle(hex(PALETTE.azulGorraOscuro), 1).fillTriangle(0, 30, W, 30, W / 2, 4);
      g.lineStyle(3, hex(PALETTE.linea), 1).strokeTriangle(0, 30, W, 30, W / 2, 4);
      g.fillStyle(hex(PALETTE.gris), 1).fillRect(W / 2 - 28, H - 42, 56, 42);
      g.lineStyle(2, hex(PALETTE.linea), 1).strokeRect(W / 2 - 28, H - 42, 56, 42);
      const t = scene.add.text(W / 2, 46, 'SEDES', {
        fontFamily: 'Arial, sans-serif', fontSize: 14, fontStyle: 'bold', color: PALETTE.blanco,
        stroke: PALETTE.linea, strokeThickness: 3,
      }).setOrigin(0.5);
      rt.draw(g).draw(t).saveTexture(fb);
      g.destroy(); t.destroy(); rt.destroy();
    }
    return fb;
  }

  /** ¿El jugador está a `radio` px del centro de la estación? */
  cerca(player, radio = 90) {
    return !!player && Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y) <= radio;
  }
}
