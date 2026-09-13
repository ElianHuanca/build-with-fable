import { PALETTE, hex } from '../data/palette.js';
import { Layout } from './Layout.js';

const FONT = 'Arial, sans-serif';
const DEPTH = 15000;
const RADIO = 14;
const ICONO = 34;
const PADDING = 16;
const GAP_ICONO = 12;
const DUR_IN = 220;
const DUR_OUT = 200;
const DESPLAZAMIENTO = 30; // px que baja el banner al aparecer (tween "desde arriba")
const ROJO = 0xe74c3c;

/**
 * Banner de alerta arriba de la pantalla (avisos de brote, más vistoso que hud.mostrarDato):
 * panel ancho con ícono ('alert' si existe, si no un signo de exclamación dibujado con
 * Graphics) + texto, aparece con un tween desde arriba. Emite 'sfx' 'alert' al mostrarse.
 * Cola simple: `.mostrar()` mientras ya hay un mensaje visible reemplaza el texto y
 * reinicia el timer, sin acumular mensajes.
 */
export class AlertToast {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.timer = null;
    this.anchoW = 0;
    this.topY = 0;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH).setVisible(false).setAlpha(0);
    this.bg = scene.add.graphics();
    this.usaTextura = scene.textures.exists('alert');
    this.icono = this.usaTextura
      ? scene.add.image(0, 0, 'alert').setDisplaySize(ICONO, ICONO)
      : scene.add.graphics();
    this.texto = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.blanco, align: 'left',
    }).setOrigin(0, 0.5);
    this.container.add([this.bg, this.icono, this.texto]);
    if (!this.usaTextura) this.dibujarIcono();

    this.onResize = (w) => this.reposicionar(w);
    Layout.onResize(scene, this.onResize);
    scene.events.once('shutdown', () => { if (this.timer) this.timer.remove(); });
  }

  /** Signo de exclamación en un círculo rojo, fallback cuando no hay textura 'alert'. */
  dibujarIcono() {
    const r = ICONO / 2;
    const g = this.icono.clear();
    g.fillStyle(ROJO, 1).fillCircle(0, 0, r);
    g.lineStyle(2, hex(PALETTE.blanco), 1).strokeCircle(0, 0, r);
    g.fillStyle(hex(PALETTE.blanco), 1);
    g.fillRoundedRect(-2.5, -r * 0.55, 5, r * 0.7, 2.5);
    g.fillCircle(0, r * 0.42, 3);
  }

  reposicionar(w) {
    this.anchoW = typeof Layout.panelWidth === 'function'
      ? Layout.panelWidth(this.scene, 520)
      : Math.min(w - 32, 520);
    this.topY = Layout.safe(this.scene).top;
    this.container.setX(w / 2);
    if (this.visible) {
      this.redibujar();
      this.container.setY(this.topY);
    }
  }

  /** Redibuja el panel según el ancho actual y el alto del texto ya asignado. */
  redibujar() {
    const w = this.anchoW;
    const wrapW = w - PADDING * 2 - ICONO - GAP_ICONO;
    this.texto.setWordWrapWidth(Math.max(10, wrapW), true);
    const h = Math.max(ICONO + PADDING, this.texto.height + PADDING * 1.4);

    this.bg.clear();
    this.bg.fillStyle(hex(PALETTE.marino), 0.96).fillRoundedRect(-w / 2, 0, w, h, RADIO);
    this.bg.lineStyle(3, hex(PALETTE.amarillo), 1).strokeRoundedRect(-w / 2, 0, w, h, RADIO);
    this.icono.setPosition(-w / 2 + PADDING + ICONO / 2, h / 2);
    this.texto.setPosition(-w / 2 + PADDING + ICONO + GAP_ICONO, h / 2);
  }

  /**
   * @param {string} texto
   * @param {number} ms duración visible (por defecto 3000)
   */
  mostrar(texto, ms = 3000) {
    if (this.timer) { this.timer.remove(); this.timer = null; }
    this.texto.setText(texto || '');
    this.redibujar();
    this.scene.events.emit('sfx', 'alert');

    if (!this.visible) {
      this.visible = true;
      this.scene.tweens.killTweensOf(this.container);
      this.container.setVisible(true).setAlpha(0).setY(this.topY - DESPLAZAMIENTO);
      this.scene.tweens.add({
        targets: this.container, y: this.topY, alpha: 1, duration: DUR_IN, ease: 'Back.easeOut',
      });
    }
    this.timer = this.scene.time.delayedCall(ms, () => this.ocultar());
  }

  ocultar() {
    if (!this.visible) return;
    this.visible = false;
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container, y: this.topY - DESPLAZAMIENTO, alpha: 0, duration: DUR_OUT, ease: 'Sine.easeIn',
      onComplete: () => this.container.setVisible(false),
    });
  }

  destroy() {
    if (this.timer) this.timer.remove();
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}
