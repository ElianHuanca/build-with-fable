import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { playElimination } from '../systems/EliminationFX.js';

const SIZE = 64;

// Color del fallback (cuando aún no existe la textura del tipo).
const FALLBACK_COLOR = {
  llanta: PALETTE.gris,
  tanque: PALETTE.aguaSucia,
  balde: PALETTE.amarillo,
  botella: PALETTE.verde,
  florero: PALETTE.teja,
};

/**
 * Criadero de mosquitos en el patio. Estados: agua → detectado → limpiando → limpio.
 * Usa las texturas `<tipo>_agua`, `<tipo>_vacio` y `<tipo>_limpio` (64×64); si no existen,
 * genera un círculo de color con el nombre del tipo como fallback.
 * Emite 'cleaned' (this) al terminar de limpiarse.
 */
export class Criadero extends Phaser.Physics.Arcade.Sprite {
  static RADIO_DETECCION = 72;

  constructor(scene, x, y, type) {
    const key = Criadero.textureFor(scene, type, 'agua');
    super(scene, x, y, key);
    this.type = type;
    this.state = 'agua';
    this.detected = false;
    this.waterKey = 'agua_' + type; // capa de agua usada por EliminationFX
    this.cleanPromise = null;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // cuerpo estático: no bloquea al jugador (sin collider)
    this.body.setSize(SIZE * 0.6, SIZE * 0.4).setOffset(SIZE * 0.2, SIZE * 0.55);
    this.setDepth(y + 20);

    this.halo = scene.add.circle(x, y + SIZE * 0.3, Criadero.RADIO_DETECCION * 0.55, hex(PALETTE.celeste), 0.3)
      .setStrokeStyle(2, hex(PALETTE.celeste), 0.8)
      .setDepth(this.depth - 1)
      .setVisible(false);
    this.pulseTween = null;
    this.haloTween = null;

    this.on(Phaser.GameObjects.Events.DESTROY, () => {
      this.stopPulse();
      this.halo.destroy();
    });
  }

  /** Devuelve la clave de textura para un estado, creando un fallback si no existe. */
  static textureFor(scene, type, state) {
    const key = `${type}_${state}`;
    if (scene.textures.exists(key)) return key;
    const fb = `fb_${key}`;
    if (!scene.textures.exists(fb)) {
      const color = state === 'agua' ? (FALLBACK_COLOR[type] || PALETTE.grisClaro)
        : state === 'vacio' ? PALETTE.grisClaro : PALETTE.verde;
      const rt = scene.add.renderTexture(0, 0, SIZE, SIZE).setVisible(false);
      const g = scene.add.graphics();
      g.fillStyle(hex(color), 1).fillCircle(SIZE / 2, SIZE / 2, SIZE * 0.42);
      g.lineStyle(3, hex(PALETTE.linea), 1).strokeCircle(SIZE / 2, SIZE / 2, SIZE * 0.42);
      if (state === 'agua') g.fillStyle(hex(PALETTE.aguaSucia), 0.9).fillCircle(SIZE / 2, SIZE / 2, SIZE * 0.22);
      const t = scene.add.text(SIZE / 2, SIZE / 2, type, {
        fontFamily: 'Arial, sans-serif', fontSize: 11, fontStyle: 'bold', color: PALETTE.blanco,
        stroke: PALETTE.linea, strokeThickness: 3,
      }).setOrigin(0.5);
      rt.draw(g).draw(t).saveTexture(fb);
      g.destroy(); t.destroy(); rt.destroy();
    }
    return fb;
  }

  setDetected(on) {
    on = !!on;
    if (this.state === 'limpio' || this.state === 'limpiando' || on === this.detected) return;
    this.detected = on;
    if (on) {
      this.state = 'detectado';
      this.halo.setVisible(true).setAlpha(0);
      this.haloTween = this.scene.tweens.add({ targets: this.halo, alpha: 1, duration: 150 });
      this.pulseTween = this.scene.tweens.add({
        targets: this, scale: 1.08, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else {
      this.state = 'agua';
      this.stopPulse();
    }
  }

  stopPulse() {
    if (this.pulseTween) { this.pulseTween.stop(); this.pulseTween = null; }
    if (this.haloTween) { this.haloTween.stop(); this.haloTween = null; }
    this.setScale(1);
    this.halo.setVisible(false);
  }

  /**
   * Limpieza con la animación estrella (EliminationFX, ~3.3 s).
   * state: 'limpiando' → 'limpio'; emite 'cleaned' (this) al terminar. Reentrada bloqueada.
   * Si algo falla (texturas ausentes, escena cerrada), termina en 'limpio' igualmente.
   */
  clean() {
    if (this.cleanPromise) return this.cleanPromise;
    if (this.state === 'limpio') return Promise.resolve(this);
    this.state = 'limpiando';
    this.detected = false;
    this.stopPulse();
    const scene = this.scene;
    this.cleanPromise = playElimination(scene, this)
      .catch((err) => {
        console.warn('[Criadero] EliminationFX falló, aplicando estado limpio directo', err);
        if (this.scene) this.setTexture(Criadero.textureFor(scene, this.type, 'limpio'));
      })
      .then(() => {
        if (this.scene) this.setScale(1);
        this.state = 'limpio';
        this.emit('cleaned', this);
        return this;
      });
    return this.cleanPromise;
  }
}
