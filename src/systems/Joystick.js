import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const RADIUS = 48;
/** Fracción de la altura por debajo de la cual se acepta el toque (deja libre el HUD de misiones). */
const ZONE_TOP = 0.4;
/** Modo fijo: radio alrededor de la base que activa el joystick y zona inferior izquierda. */
const FIJO_RADIO_ACTIVACION = 90;
const FIJO_ZONE_X = 0.45;
const FIJO_ZONE_Y = 0.45;
const FIJO_POS = { x: 110, y: 110 }; // desde la esquina inferior izquierda

/**
 * Joystick virtual con dos modos:
 *  - `'flotante'`: aparece donde el usuario toca en la mitad izquierda, por debajo del HUD
 *    (y > 40 % de la altura) y se oculta al soltar.
 *  - `'fijo'` (estilo Brawl Stars): base siempre visible en (110, alto − 110); cualquier toque a
 *    ≤ 90 px de la base o en la zona inferior izquierda (x < 45 %, y > 45 %) lo activa; la base
 *    no se mueve, el knob sí (desplazamiento desde el punto de toque, limitado al radio) y vuelve
 *    al centro con un tween al soltar.
 * En ambos modos ignora toques que caen sobre un objeto interactivo (`over`).
 */
export class Joystick {
  /** @param {{ modo?: 'fijo'|'flotante' }} [opts] */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.modo = opts.modo === 'fijo' ? 'fijo' : 'flotante';
    this.pointer = null;
    this.origin = new Phaser.Math.Vector2();
    this.vector = new Phaser.Math.Vector2();
    this.knobTween = null;

    const fijo = this.modo === 'fijo';
    this.base = scene.add.circle(0, 0, RADIUS, hex(PALETTE.marino), fijo ? 0.45 : 0.35)
      .setStrokeStyle(3, hex(PALETTE.celeste), 0.8);
    this.knob = scene.add.circle(0, 0, RADIUS * 0.45, hex(PALETTE.verde), 0.9)
      .setStrokeStyle(2, hex(PALETTE.blanco), 0.9);
    for (const o of [this.base, this.knob]) o.setScrollFactor(0).setDepth(10000).setVisible(fijo);
    if (fijo) {
      this.colocarBase(scene.scale.width, scene.scale.height);
      this.onResize = (size) => this.colocarBase(size.width, size.height);
      scene.scale.on('resize', this.onResize);
      scene.events.once('shutdown', () => scene.scale.off('resize', this.onResize));
    }

    scene.input.on('pointerdown', (p, over) => {
      if (this.pointer || (over && over.length)) return;
      if (fijo ? !this.inZoneFijo(p) : !Joystick.inZone(scene, p)) return;
      this.pointer = p;
      if (this.knobTween) { this.knobTween.stop(); this.knobTween = null; }
      // El vector se mide desde el punto donde empezó el toque (en modo fijo el knob se
      // dibuja desplazado desde la base, que no se mueve).
      this.origin.set(p.x, p.y);
      if (!fijo) {
        this.base.setPosition(p.x, p.y).setVisible(true);
        this.knob.setPosition(p.x, p.y).setVisible(true);
      }
    });
    const release = (p) => {
      if (this.pointer && p.id === this.pointer.id) {
        this.pointer = null;
        this.vector.set(0, 0);
        if (fijo) {
          this.knobTween = scene.tweens.add({
            targets: this.knob, x: this.base.x, y: this.base.y, duration: 120, ease: 'Sine.easeOut',
          });
        } else {
          this.base.setVisible(false);
          this.knob.setVisible(false);
        }
      }
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  colocarBase(w, h) {
    this.base.setPosition(FIJO_POS.x, h - FIJO_POS.y);
    if (!this.pointer) this.knob.setPosition(this.base.x, this.base.y);
  }

  /** ¿El puntero cae en la zona del joystick flotante (mitad izquierda, debajo del HUD)? */
  static inZone(scene, p) {
    return p.x <= scene.scale.width / 2 && p.y >= scene.scale.height * ZONE_TOP;
  }

  /** Modo fijo: a ≤ 90 px de la base o en la zona inferior izquierda. */
  inZoneFijo(p) {
    const { width, height } = this.scene.scale;
    if (Phaser.Math.Distance.Between(p.x, p.y, this.base.x, this.base.y) <= FIJO_RADIO_ACTIVACION) return true;
    return p.x < width * FIJO_ZONE_X && p.y > height * FIJO_ZONE_Y;
  }

  update() {
    if (!this.pointer) return this.vector;
    const d = new Phaser.Math.Vector2(this.pointer.x - this.origin.x, this.pointer.y - this.origin.y);
    if (d.length() > RADIUS) d.setLength(RADIUS);
    this.knob.setPosition(this.base.x + d.x, this.base.y + d.y);
    this.vector.set(d.x / RADIUS, d.y / RADIUS);
    // Zona muerta pequeña
    if (this.vector.length() < 0.15) this.vector.set(0, 0);
    return this.vector;
  }
}
