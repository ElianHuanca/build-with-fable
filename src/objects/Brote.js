import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { playFumigation } from '../systems/FumigationFX.js';

// Tamaño del fallback dibujado (px) por nivel; crece con el brote.
const SIZE_BY_NIVEL = { pequeno: 40, medio: 56, grande: 72 };
const ROJO = '#e5383b';
const DEPTH_OFFSET = 18;

// Tiempo desde que aparece hasta pasar a 'medio', y desde 'medio' hasta 'grande'.
const TIEMPO_A_MEDIO = 20000;
const TIEMPO_A_GRANDE = 40000;

/**
 * Brote de mosquitos en el barrio (mockup, sección 1.3). Estados: activo → fumigando → fumigado.
 * Niveles: pequeño → medio (20 s) → grande (40 s más), cada uno más grande y más lento de
 * fumigar. Usa las texturas `mosquito_<nivel>` (pequeno|medio|grande); si no existen, genera un
 * círculo rojo semitransparente con "!" como fallback, análogo al fallback de Criadero.textureFor.
 * Emite 'crecio' (this) al subir de nivel y 'fumigado' (this) al terminar de fumigarse.
 */
export class Brote extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    const key = Brote.textureFor(scene, 'pequeno');
    super(scene, x, y, key);
    this.nivel = 'pequeno';
    this.state = 'activo';
    this.fumigarPromise = null;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // cuerpo estático: no bloquea al jugador (sin collider)
    this.setDepth(y + DEPTH_OFFSET);

    this.growTimer = scene.time.delayedCall(TIEMPO_A_MEDIO, () => this.crecer('medio'));

    this.on(Phaser.GameObjects.Events.DESTROY, () => this.detenerCrecimiento());
  }

  /** Devuelve la clave de textura para un nivel, creando un fallback si no existe. */
  static textureFor(scene, nivel) {
    const key = `mosquito_${nivel}`;
    if (scene.textures.exists(key)) return key;
    const fb = `fb_${key}`;
    if (!scene.textures.exists(fb)) {
      const size = SIZE_BY_NIVEL[nivel] || SIZE_BY_NIVEL.pequeno;
      const rt = scene.add.renderTexture(0, 0, size, size).setVisible(false);
      const g = scene.add.graphics();
      g.fillStyle(hex(ROJO), 0.55).fillCircle(size / 2, size / 2, size * 0.44);
      g.lineStyle(3, hex(PALETTE.linea), 0.9).strokeCircle(size / 2, size / 2, size * 0.44);
      const t = scene.add.text(size / 2, size / 2, '!', {
        fontFamily: 'Arial, sans-serif', fontSize: Math.round(size * 0.5), fontStyle: 'bold',
        color: PALETTE.blanco, stroke: PALETTE.linea, strokeThickness: 3,
      }).setOrigin(0.5);
      rt.draw(g).draw(t).saveTexture(fb);
      g.destroy(); t.destroy(); rt.destroy();
    }
    return fb;
  }

  /** Avanza de nivel (llamado por el propio timer de crecimiento). */
  crecer(nivel) {
    if (this.state !== 'activo' || this.nivel === nivel || !this.scene) return;
    this.nivel = nivel;
    this.setTexture(Brote.textureFor(this.scene, nivel));
    this.setDepth(this.y + DEPTH_OFFSET);
    this.scene.events.emit('sfx', 'buzz');
    this.scene.tweens.add({ targets: this, scale: 1.4, duration: 180, yoyo: true, ease: 'Back.easeOut' });
    this.emit('crecio', this);
    if (nivel === 'medio') {
      this.growTimer = this.scene.time.delayedCall(TIEMPO_A_GRANDE, () => this.crecer('grande'));
    }
  }

  /** Cancela el crecimiento automático (se llama al empezar a fumigar o al destruirse). */
  detenerCrecimiento() {
    if (this.growTimer) { this.growTimer.remove(); this.growTimer = null; }
  }

  /**
   * Fumigación con FumigationFX (~2.5 s a pie, ~1.5 s con `rapido` desde la camioneta).
   * state: 'fumigando' → 'fumigado' (lo marca FumigationFX, que también emite 'fumigado').
   * Reentrada bloqueada. Si la FX fallara, igual queda en 'fumigado' y emite el evento.
   * @param {{ rapido?: boolean }} [opts]
   * @returns {Promise<Brote>}
   */
  fumigar(opts = {}) {
    if (this.fumigarPromise) return this.fumigarPromise;
    if (this.state === 'fumigado') return Promise.resolve(this);
    this.state = 'fumigando';
    this.detenerCrecimiento();
    const scene = this.scene;
    this.fumigarPromise = playFumigation(scene, this, opts)
      .catch((err) => {
        console.warn('[Brote] FumigationFX falló, aplicando estado fumigado directo', err);
        if (this.scene) this.setAlpha(0);
        this.state = 'fumigado';
        this.emit('fumigado', this);
      })
      .then(() => this);
    return this.fumigarPromise;
  }
}
