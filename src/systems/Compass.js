import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const DEPTH = 9000;
const RADIO_ORBITA = 56;

/**
 * Brújula automática: flecha alrededor del jugador apuntando al brote activo más cercano
 * (mismo estilo visual que la flecha de TouchControls.usarLupa, en coordenadas de mundo).
 * A diferencia de esa flecha —que se autooculta a los 2 s—, permanece visible todo el
 * tiempo que `target` no sea null; se oculta únicamente cuando no hay brote activo.
 */
export class Compass {
  constructor(scene) {
    this.scene = scene;
    this.flecha = scene.add.graphics().setDepth(DEPTH).setVisible(false);
    this.flecha.fillStyle(hex(PALETTE.amarillo), 1).fillTriangle(18, 0, -8, -11, -8, 11);
    this.flecha.lineStyle(2, hex(PALETTE.marino), 1).strokeTriangle(18, 0, -8, -11, -8, 11);
  }

  /**
   * Llamar cada frame desde GameScene.update().
   * @param {{x:number,y:number}|null} target Brote activo más cercano, o null para ocultar.
   */
  update(target) {
    const player = this.scene.player;
    if (!target || !player) {
      this.flecha.setVisible(false);
      return;
    }
    const ang = Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y);
    this.flecha
      .setPosition(player.x + Math.cos(ang) * RADIO_ORBITA, player.y + Math.sin(ang) * RADIO_ORBITA)
      .setRotation(ang)
      .setVisible(true);
  }

  /** Nodos a ocultar en las fotos (GameScene.capturar): sin esto la flecha salía en la captura. */
  overlays() { return [this.flecha]; }

  destroy() {
    this.flecha.destroy();
  }
}
