import { PALETTE, hex } from '../data/palette.js';
import { Layout } from './Layout.js';
import { HUD_KEY_LIBRE, MINIMAPA } from '../scenes/HUDScene.js';
import { esModoTactil } from '../data/ui.js';

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
/** Vertical: el toast va debajo de la HUD (paneles de arriba + línea de misión + minimapa). */
const TOP_VERTICAL = 160;
/** Horizontal: ancho mínimo de la franja libre entre paneles para poner el toast arriba. */
const MIN_FRANJA = 300;
/** Horizontal sin datos de la HUD: bajo la fila de paneles (12 + 74 + respiro). */
const TOP_HORIZONTAL_FALLBACK = 94;
/** Ancho del panel de jugador/misiones (margen 12 + 250) en horizontal, para el fallback. */
const LATERAL_HORIZONTAL = 262;
/** Táctil horizontal: la columna de botones (CORRER en w−200, r 30 + arco) empieza en w−240. */
const COLUMNA_BOTONES = 240;

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
    this.offResize = Layout.onResize(scene, this.onResize);
    // La HUD arranca después: reubicar cuando publique su franja libre.
    // ('setdata' la primera vez que existe la clave, 'changedata' después.)
    this.onRegistry = (parent, key) => { if (key === HUD_KEY_LIBRE) this.reposicionar(scene.scale.width); };
    scene.registry.events.on('setdata', this.onRegistry);
    scene.registry.events.on('changedata', this.onRegistry);
    scene.events.once('shutdown', () => {
      if (this.timer) this.timer.remove();
      this.quitarRegistry();
    });
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

  /**
   * Vertical: ancho casi completo, bajo la HUD (y 160) para no tapar la línea de misión ni el
   * minimapa. Horizontal: arriba, centrado en la franja libre entre el panel de jugador y los
   * paneles de la derecha (la publica la HUD en el registry); si la franja es estrecha
   * (teléfono), bajo la fila de paneles, entre el panel de misiones y el minimapa.
   */
  reposicionar(w) {
    const portrait = Layout.isPortrait(this.scene);
    let cx = w / 2;
    if (portrait) {
      this.anchoW = Layout.panelWidth(this.scene, 520);
      this.topY = TOP_VERTICAL;
    } else {
      const libre = this.scene.registry.get(HUD_KEY_LIBRE);
      const x0 = libre?.x0 ?? LATERAL_HORIZONTAL;
      if (libre && libre.x1 - libre.x0 >= MIN_FRANJA) {
        this.anchoW = Math.min(520, libre.x1 - libre.x0 - 24);
        cx = (libre.x0 + libre.x1) / 2;
        this.topY = Layout.safe(this.scene).top;
      } else {
        // Bajo la fila de paneles: entre misiones y el minimapa (o la columna de botones táctiles).
        let x1 = w - MINIMAPA.margen - MINIMAPA.horizontal;
        if (esModoTactil(this.scene.sys.game)) x1 = Math.min(x1, w - COLUMNA_BOTONES);
        this.anchoW = Math.max(200, Math.min(520, x1 - x0 - 24));
        cx = (x0 + x1) / 2;
        this.topY = (libre?.y1 ?? TOP_HORIZONTAL_FALLBACK - 8) + 8;
      }
    }
    this.container.setX(Math.round(cx));
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
    this.alto = h; // lo lee GameScene.actualizarEvitar para bajar el cartel de detección debajo del banner

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

  quitarRegistry() {
    this.scene.registry.events.off('setdata', this.onRegistry);
    this.scene.registry.events.off('changedata', this.onRegistry);
  }

  destroy() {
    this.offResize?.();
    this.quitarRegistry();
    if (this.timer) this.timer.remove();
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}
