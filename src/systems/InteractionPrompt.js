import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from './Layout.js';
import { HUD_KEY_LIBRE } from '../scenes/HUDScene.js';
import { t } from '../i18n/index.js';

const PANEL_W = 260;
const PANEL_H = 100;
/** Centro del cartel en vertical: borde superior en 165, bajo la línea de misión y el minimapa (56..156). */
const Y_VERTICAL = 165 + PANEL_H / 2;
/** Centro del cartel sin datos de la HUD (horizontal antes de que publique `hudLibre`). */
const Y_SIN_HUD = 70;
const BTN_W = 200;
const BTN_H = 44;
const DEPTH = 9000;
/** Lado 'abajo': espacio libre sobre el borde inferior (vertical táctil: joystick + botones). */
const RESERVA_ABAJO_TACTIL = 280;
const RESERVA_ABAJO = 24;

/**
 * Cartel "¡Criadero detectado!" con botón "E · Eliminar agua" (fiel al mockup).
 * Fijo a la cámara, anclado arriba al centro. Construido solo con Graphics/Text.
 * También ofrece una etiqueta flotante en coordenadas de mundo ("Presiona E").
 */
export class InteractionPrompt {
  /**
   * @param {{ sinBoton?: boolean }} [opts] `sinBoton`: modo táctil con botón de acción propio;
   *   el cartel muestra "Toca el botón de acción" en lugar del botón "Eliminar agua".
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.callback = null;
    this.busy = false;
    this.visible = false;
    this.tween = null;
    this.sinBoton = !!opts.sinBoton;
    this.isTouch = this.sinBoton || !!scene.sys.game.device.input.touch;

    const cx = scene.scale.width / 2;
    this.container = scene.add.container(cx, Y_SIN_HUD).setScrollFactor(0).setDepth(DEPTH).setVisible(false);

    // Panel
    const panel = scene.add.graphics();
    panel.fillStyle(hex(PALETTE.marino), 0.92).fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 14);
    panel.lineStyle(3, hex(PALETTE.celeste), 1).strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 14);

    // Ícono de alerta
    const iconX = -PANEL_W / 2 + 30, iconY = -PANEL_H / 2 + 26;
    const icon = scene.add.graphics();
    icon.fillStyle(0xe74c3c, 1).fillCircle(iconX, iconY, 13);
    icon.lineStyle(2, hex(PALETTE.blanco), 1).strokeCircle(iconX, iconY, 13);
    const bang = scene.add.text(iconX, iconY, '!', {
      fontFamily: 'Arial, sans-serif', fontSize: 20, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5, 0.55);

    this.title = scene.add.text(iconX + 22, iconY, t('prompt.criadero'), {
      fontFamily: 'Arial, sans-serif', fontSize: 18, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0, 0.5);
    const title = this.title;

    // Botón
    const btnY = PANEL_H / 2 - 8 - BTN_H / 2;
    this.button = scene.add.container(0, btnY);
    this.btnBg = scene.add.graphics();
    this.drawButton(PALETTE.verde);
    const keyBox = scene.add.graphics();
    keyBox.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(-BTN_W / 2 + 10, -12, 24, 24, 5);
    const keyText = scene.add.text(-BTN_W / 2 + 22, 0, 'E', {
      fontFamily: 'Arial, sans-serif', fontSize: 15, fontStyle: 'bold', color: PALETTE.verdeOscuro,
    }).setOrigin(0.5);
    this.label = scene.add.text(-BTN_W / 2 + 44, 0, t('prompt.eliminar'), {
      fontFamily: 'Arial, sans-serif', fontSize: 16, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0, 0.5);
    this.button.add([this.btnBg, keyBox, keyText, this.label]);
    // Área táctil mayor que el dibujo (≥ 44 CSS px en teléfonos con Scale.FIT).
    this.button.setSize(...touchSize(BTN_W, BTN_H))
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => { if (!this.busy) this.drawButton(PALETTE.verdeOscuro); })
      .on('pointerout', () => { if (!this.busy) this.drawButton(PALETTE.verde); })
      .on('pointerdown', (p, lx, ly, ev) => {
        ev?.stopPropagation?.();
        if (!this.busy && this.visible && this.callback) this.callback();
      });

    this.container.add([panel, icon, bang, title, this.button]);
    if (this.sinBoton) {
      // El botón de acción vive en TouchControls: aquí solo una pista de texto.
      this.button.setVisible(false).disableInteractive();
      this.hint = scene.add.text(0, btnY, t('prompt.tocaBoton'), {
        fontFamily: 'Arial, sans-serif', fontSize: 15, fontStyle: 'bold', color: PALETTE.amarillo,
      }).setOrigin(0.5);
      this.container.add(this.hint);
    }
    // El hit test de Phaser usa el scrollFactor del propio objeto (no el del contenedor padre):
    // sin esto el botón solo respondía con la cámara en (0,0). Se propaga a todos los hijos.
    this.container.setScrollFactor(0, 0, true);
    this.button.setScrollFactor(0, 0, true);

    // Etiqueta flotante en el mundo
    this.worldLabel = scene.add.container(0, 0).setDepth(DEPTH - 1).setVisible(false);
    this.worldText = scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif', fontSize: 14, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    this.worldBg = scene.add.graphics();
    this.worldLabel.add([this.worldBg, this.worldText]);
    this.modo = null;
    /** 'arriba' (bajo la HUD) o 'abajo' (sobre los controles): el lado opuesto al objetivo. */
    this.lado = 'arriba';
    this.setModo('criadero');

    // Posición según la HUD (ver reposicionar). `Layout.onResize` se limpia solo en shutdown; el
    // listener del registry se quita en destroy() (la HUD arranca después y publica su franja libre).
    this.offResize = Layout.onResize(scene, (w) => this.reposicionar(w));
    this.onRegistry = (parent, key) => { if (key === HUD_KEY_LIBRE) this.reposicionar(scene.scale.width); };
    scene.registry.events.on('setdata', this.onRegistry);
    scene.registry.events.on('changedata', this.onRegistry);
  }

  /**
   * Vertical: bajo la línea de misión y el minimapa de la HUD (borde superior en 165, como el AlertToast).
   * Horizontal/escritorio: centrado en la franja libre entre el panel de jugador/misiones y los
   * paneles de la derecha (`hudLibre`, la publica la HUD) si el cartel cabe; si no, bajo la fila de
   * paneles. Sin HUD todavía: arriba al centro (y 70).
   */
  reposicionar(w) {
    let cx = w / 2, cy = Y_SIN_HUD;
    const portrait = Layout.isPortrait(this.scene);
    if (portrait) {
      cy = Y_VERTICAL;
    } else {
      const libre = this.scene.registry.get(HUD_KEY_LIBRE);
      if (libre && libre.x1 - libre.x0 >= PANEL_W + 24) {
        cx = (libre.x0 + libre.x1) / 2;
        cy = Layout.safe(this.scene).top + PANEL_H / 2;
      } else if (libre) {
        cy = libre.y1 + 8 + PANEL_H / 2;
      }
    }
    if (this.lado === 'abajo') {
      // Sobre los controles táctiles (vertical: joystick y botones ocupan ~250 px) o el borde inferior.
      const h = this.scene.scale.height;
      const reserva = this.isTouch ? (portrait ? RESERVA_ABAJO_TACTIL : RESERVA_ABAJO) : RESERVA_ABAJO;
      cy = Math.max(cy, h - reserva - PANEL_H / 2);
    }
    this.container.setPosition(Math.round(cx), Math.round(cy));
  }

  /**
   * Lado de la pantalla donde se coloca el cartel, para no tapar al objetivo: 'arriba' (bajo la
   * HUD, por defecto) o 'abajo' (sobre los controles). GameScene lo decide según dónde quede el
   * criadero/brote en pantalla.
   * @param {'arriba'|'abajo'} lado
   */
  setLado(lado) {
    const l = lado === 'abajo' ? 'abajo' : 'arriba';
    if (l === this.lado) return;
    this.lado = l;
    this.reposicionar(this.scene.scale.width);
  }

  /**
   * Textos según el objetivo: 'criadero' ("¡Criadero detectado!", "E · Eliminar agua", "Presiona E")
   * o 'brote' ("¡Brote de mosquitos!", "E · Fumigar", "Mantén E").
   * o 'estacion' ("Estación SEDES", "E · Biblioteca", "Presiona E").
   * @param {'criadero'|'brote'|'estacion'} modo
   */
  setModo(modo) {
    if (modo === this.modo) return;
    this.modo = modo;
    const brote = modo === 'brote';
    const estacion = modo === 'estacion';
    this.title.setText(t(estacion ? 'prompt.estacion' : brote ? 'prompt.brote' : 'prompt.criadero'));
    this.label.setText(t(estacion ? 'prompt.biblioteca' : brote ? 'prompt.fumigar' : 'prompt.eliminar'));
    const etiqueta = t(this.sinBoton ? 'prompt.tocaBotonCorto'
      : this.isTouch ? (estacion ? 'prompt.tocaBiblioteca' : brote ? 'prompt.tocaFumigar' : 'prompt.tocaEliminar')
        : (brote ? 'prompt.mantenE' : 'prompt.presionaE'));
    this.worldText.setText(etiqueta);
    const lw = this.worldText.width + 14, lh = this.worldText.height + 8;
    this.worldBg.clear();
    this.worldBg.fillStyle(hex(PALETTE.marino), 0.9).fillRoundedRect(-lw / 2, -lh / 2, lw, lh, 6);
    this.worldBg.lineStyle(2, hex(PALETTE.celeste), 1).strokeRoundedRect(-lw / 2, -lh / 2, lw, lh, 6);
  }

  drawButton(color) {
    this.btnBg.clear();
    this.btnBg.fillStyle(hex(color), 1).fillRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 10);
    this.btnBg.lineStyle(2, hex(PALETTE.blanco), 0.6).strokeRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 10);
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    if (this.tween) this.tween.stop();
    this.container.setVisible(true).setScale(0.8).setAlpha(0);
    this.tween = this.scene.tweens.add({
      targets: this.container, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut',
    });
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    if (this.tween) this.tween.stop();
    this.tween = this.scene.tweens.add({
      targets: this.container, scale: 0.85, alpha: 0, duration: 120, ease: 'Sine.easeIn',
      onComplete: () => { if (!this.visible) this.container.setVisible(false); },
    });
    this.hideLabel();
  }

  isVisible() { return this.visible; }

  /** Atenúa el botón mientras se limpia el criadero. */
  setBusy(busy) {
    this.busy = !!busy;
    this.button.setAlpha(this.busy ? 0.45 : 1);
    this.drawButton(PALETTE.verde);
    if (this.sinBoton) { this.hint?.setAlpha(this.busy ? 0.45 : 1); return; }
    if (this.busy) this.button.disableInteractive(); else this.button.setInteractive({ useHandCursor: true });
  }

  /** @param {() => void} cb */
  onPress(cb) { this.callback = cb; }

  /** Etiqueta pequeña sobre el criadero (coordenadas de mundo). */
  showLabelAt(x, y) { this.worldLabel.setPosition(x, y).setVisible(true); }
  hideLabel() { this.worldLabel.setVisible(false); }

  destroy() {
    this.offResize?.();
    this.scene.registry.events.off('setdata', this.onRegistry);
    this.scene.registry.events.off('changedata', this.onRegistry);
    if (this.tween) this.tween.stop();
    this.container.destroy();
    this.worldLabel.destroy();
  }
}
