import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const RADIUS = 48;

/** Joystick virtual: aparece donde el usuario toca en la mitad izquierda de la pantalla. */
export class Joystick {
  constructor(scene) {
    this.scene = scene;
    this.pointer = null;
    this.origin = new Phaser.Math.Vector2();
    this.vector = new Phaser.Math.Vector2();

    this.base = scene.add.circle(0, 0, RADIUS, hex(PALETTE.marino), 0.35).setStrokeStyle(3, hex(PALETTE.celeste), 0.8);
    this.knob = scene.add.circle(0, 0, RADIUS * 0.45, hex(PALETTE.verde), 0.9).setStrokeStyle(2, hex(PALETTE.blanco), 0.9);
    for (const o of [this.base, this.knob]) o.setScrollFactor(0).setDepth(10000).setVisible(false);

    scene.input.on('pointerdown', (p) => {
      if (this.pointer || p.x > scene.scale.width / 2) return;
      this.pointer = p;
      this.origin.set(p.x, p.y);
      this.base.setPosition(p.x, p.y).setVisible(true);
      this.knob.setPosition(p.x, p.y).setVisible(true);
    });
    const release = (p) => {
      if (this.pointer && p.id === this.pointer.id) {
        this.pointer = null;
        this.vector.set(0, 0);
        this.base.setVisible(false);
        this.knob.setVisible(false);
      }
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  update() {
    if (!this.pointer) return this.vector;
    const d = new Phaser.Math.Vector2(this.pointer.x - this.origin.x, this.pointer.y - this.origin.y);
    if (d.length() > RADIUS) d.setLength(RADIUS);
    this.knob.setPosition(this.origin.x + d.x, this.origin.y + d.y);
    this.vector.set(d.x / RADIUS, d.y / RADIUS);
    // Zona muerta pequeña
    if (this.vector.length() < 0.15) this.vector.set(0, 0);
    return this.vector;
  }
}
