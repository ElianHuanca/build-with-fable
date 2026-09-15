import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const SIZE = 48;
const TIPOS = ['bolsa', 'botella', 'llanta'];

// Tiempos de maduración (plan v4, sección 2): fresca → acumulada → criadero (60 s en total).
const TIEMPO_A_ACUMULADA = 30000;
const TIEMPO_A_CRIADERO = 30000;

// Color base de cada tipo, usado solo en el dibujo de fallback.
const COLOR_TIPO = {
  bolsa: PALETTE.oliva,
  botella: PALETTE.verde,
  llanta: PALETTE.gris,
};

/**
 * Basura callejera que un vecino bota (ver `src/systems/Vecinos.js`) y que, si nadie la
 * recoge, madura sola hasta convertirse en un criadero de mosquitos. Es la "causa visible"
 * de un brote (plan v4, sección 2): antes los brotes aparecían solos; ahora también pueden
 * nacer de basura acumulada.
 *
 * Ciclo de estados:
 *   'fresca' → (30 s) → 'acumulada' → (30 s más, 60 s en total) → 'criadero'
 * En 'criadero' se ve como un charquito de agua sucia bajo la basura (mismo lenguaje visual
 * que `Criadero.js`) y se emite 'maduro' (this) una única vez, para que quien la creó decida
 * qué hacer (p. ej. convertirla en un Brote o en un Criadero real — eso no es parte de esta
 * clase).
 *
 * El jugador puede llamar a `recoger()` en cualquier momento antes de que se destruya:
 *  - En 'fresca' o 'acumulada': la recoge a tiempo, emite 'recogida' (this, { tarde: false }).
 *  - En 'criadero': igual se puede recoger (tarde), emite 'recogida' (this, { tarde: true }) y
 *    además 'recogidaTarde' (this) por si quien integra prefiere un evento aparte para dar
 *    menos puntaje.
 * Tras `recoger()` la basura se destruye sola (tween corto de escala/alpha a 0).
 *
 * Usa las texturas `basura_<tipo>_<estado>` (fresca/acumulada/criadero, 9 en total) si existen;
 * si no, dibuja un ícono simple con Graphics como fallback (mismo patrón que Criadero/Brote).
 */
export class Basura extends Phaser.GameObjects.Container {
  constructor(scene, x, y, { tipo } = {}) {
    super(scene, x, y);
    this.tipo = TIPOS.includes(tipo) ? tipo : TIPOS[Math.floor(Math.random() * TIPOS.length)];
    this.state = 'fresca';
    this.recogiendo = false;
    this.maduroEmitido = false;

    this.icono = scene.add.image(0, 0, Basura.textureFor(scene, this.tipo, this.state));
    this.add(this.icono);

    scene.add.existing(this);
    this.setDepth(y);

    // Timer hacia 'acumulada'; el de 'criadero' se programa al llegar a 'acumulada'.
    this.acumuladaTimer = scene.time.delayedCall(TIEMPO_A_ACUMULADA, () => this.avanzar('acumulada'));
    this.criaderoTimer = null;

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (this.acumuladaTimer) { this.acumuladaTimer.remove(); this.acumuladaTimer = null; }
      if (this.criaderoTimer) { this.criaderoTimer.remove(); this.criaderoTimer = null; }
    });
  }

  /** Devuelve la clave de textura para tipo+estado, creando un fallback dibujado si no existe. */
  static textureFor(scene, tipo, estado) {
    const key = `basura_${tipo}_${estado}`;
    if (scene.textures.exists(key)) return key;
    const fb = `fb_${key}`;
    if (!scene.textures.exists(fb)) {
      const c = SIZE / 2;
      const escala = estado === 'fresca' ? 0.65 : estado === 'acumulada' ? 0.85 : 1;
      const rt = scene.add.renderTexture(0, 0, SIZE, SIZE).setVisible(false);
      const g = scene.add.graphics();

      if (estado === 'criadero') {
        // Charquito de agua sucia debajo: mismo lenguaje visual que los criaderos de agua.
        g.fillStyle(hex(PALETTE.aguaSucia), 0.85).fillEllipse(c, c + SIZE * 0.3, SIZE * 0.85, SIZE * 0.34);
        g.lineStyle(2, hex(PALETTE.linea), 0.6).strokeEllipse(c, c + SIZE * 0.3, SIZE * 0.85, SIZE * 0.34);
      }

      Basura.dibujarIcono(g, tipo, c, escala, estado === 'fresca' ? 0.75 : 1);

      if (estado === 'acumulada' || estado === 'criadero') {
        // Manchas de suciedad alrededor: refuerzan que ya lleva tiempo tirada.
        g.fillStyle(hex(PALETTE.gris), 0.4);
        g.fillCircle(c - SIZE * 0.3, c + SIZE * 0.22, 3);
        g.fillCircle(c + SIZE * 0.28, c + SIZE * 0.18, 2.5);
        g.fillCircle(c + SIZE * 0.05, c + SIZE * 0.32, 2);
      }

      rt.draw(g).saveTexture(fb);
      g.destroy(); rt.destroy();
    }
    return fb;
  }

  /** Dibuja el ícono del tipo (bolsa/botella/llanta) centrado en (c, c), escalado. */
  static dibujarIcono(g, tipo, c, escala, alpha) {
    const color = COLOR_TIPO[tipo] || PALETTE.grisClaro;
    if (tipo === 'bolsa') {
      const w = 24 * escala, h = 20 * escala;
      g.fillStyle(hex(color), alpha).fillRoundedRect(c - w / 2, c - h / 2, w, h, 5 * escala);
      g.lineStyle(2, hex(PALETTE.linea), 0.7).strokeRoundedRect(c - w / 2, c - h / 2, w, h, 5 * escala);
      g.lineStyle(2, hex(PALETTE.linea), 0.5);
      g.lineBetween(c - w * 0.2, c - h / 2, c - w * 0.2, c - h / 2 - 5 * escala);
      g.lineBetween(c + w * 0.2, c - h / 2, c + w * 0.2, c - h / 2 - 5 * escala);
    } else if (tipo === 'botella') {
      const bw = 12 * escala, bh = 16 * escala, nw = 6 * escala, nh = 10 * escala;
      g.fillStyle(hex(color), alpha).fillRect(c - bw / 2, c - bh / 2 + nh / 2, bw, bh);
      g.fillRect(c - nw / 2, c - bh / 2 - nh / 2, nw, nh);
      g.lineStyle(2, hex(PALETTE.linea), 0.7);
      g.strokeRect(c - bw / 2, c - bh / 2 + nh / 2, bw, bh).strokeRect(c - nw / 2, c - bh / 2 - nh / 2, nw, nh);
    } else {
      const rExt = 12 * escala, rInt = 6 * escala;
      g.lineStyle(6 * escala, hex(color), alpha).strokeCircle(c, c, rExt);
      g.lineStyle(2, hex(PALETTE.linea), 0.7).strokeCircle(c, c, rExt).strokeCircle(c, c, rInt);
    }
  }

  /** Pasa a `nuevoEstado`, redibuja y programa el siguiente timer o emite 'maduro'. */
  avanzar(nuevoEstado) {
    if (!this.scene || this.state === 'recogida') return;
    this.state = nuevoEstado;
    this.icono.setTexture(Basura.textureFor(this.scene, this.tipo, this.state));
    if (nuevoEstado === 'acumulada') {
      this.criaderoTimer = this.scene.time.delayedCall(TIEMPO_A_CRIADERO, () => this.avanzar('criadero'));
    } else if (nuevoEstado === 'criadero' && !this.maduroEmitido) {
      this.maduroEmitido = true;
      this.emit('maduro', this);
    }
  }

  /**
   * El jugador recoge la basura (a tiempo o tarde). Reentrada bloqueada. Tween corto de
   * escala/alpha a 0 (200-300 ms, sin la animación larga de EliminationFX) y luego se destruye.
   * Emite 'recogida' (this, { tarde }) siempre, y además 'recogidaTarde' (this) si ya había
   * madurado a criadero, para que GameScene pueda dar menos puntaje en ese caso.
   */
  recoger() {
    if (this.recogiendo || this.state === 'recogida') return;
    this.recogiendo = true;
    const tarde = this.state === 'criadero';
    if (this.acumuladaTimer) { this.acumuladaTimer.remove(); this.acumuladaTimer = null; }
    if (this.criaderoTimer) { this.criaderoTimer.remove(); this.criaderoTimer = null; }
    const scene = this.scene;
    if (!scene) {
      this.state = 'recogida';
      this.emit('recogida', this, { tarde });
      if (tarde) this.emit('recogidaTarde', this);
      return;
    }
    scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 250,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.state = 'recogida';
        this.emit('recogida', this, { tarde });
        if (tarde) this.emit('recogidaTarde', this);
        this.destroy();
      },
    });
  }
}
