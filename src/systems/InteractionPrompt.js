import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const PANEL_W = 260;
const PANEL_H = 96;
const BTN_W = 190;
const BTN_H = 36;
const DEPTH = 9000;

/**
 * Cartel "¡Criadero detectado!" con botón "E · Eliminar agua" (fiel al mockup).
 * Fijo a la cámara, anclado arriba al centro. Construido solo con Graphics/Text.
 * También ofrece una etiqueta flotante en coordenadas de mundo ("Presiona E").
 */
export class InteractionPrompt {
  constructor(scene) {
    this.scene = scene;
    this.callback = null;
    this.busy = false;
    this.visible = false;
    this.tween = null;
    this.isTouch = !!scene.sys.game.device.input.touch;

    const cx = scene.scale.width / 2;
    this.container = scene.add.container(cx, 70).setScrollFactor(0).setDepth(DEPTH).setVisible(false);

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

    const title = scene.add.text(iconX + 22, iconY, '¡Criadero detectado!', {
      fontFamily: 'Arial, sans-serif', fontSize: 18, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0, 0.5);

    // Botón
    const btnY = PANEL_H / 2 - 12 - BTN_H / 2;
    this.button = scene.add.container(0, btnY);
    this.btnBg = scene.add.graphics();
    this.drawButton(PALETTE.verde);
    const keyBox = scene.add.graphics();
    keyBox.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(-BTN_W / 2 + 10, -12, 24, 24, 5);
    const keyText = scene.add.text(-BTN_W / 2 + 22, 0, 'E', {
      fontFamily: 'Arial, sans-serif', fontSize: 15, fontStyle: 'bold', color: PALETTE.verdeOscuro,
    }).setOrigin(0.5);
    const label = scene.add.text(-BTN_W / 2 + 44, 0, 'Eliminar agua', {
      fontFamily: 'Arial, sans-serif', fontSize: 16, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0, 0.5);
    this.button.add([this.btnBg, keyBox, keyText, label]);
    this.button.setSize(BTN_W, BTN_H)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => { if (!this.busy) this.drawButton(PALETTE.verdeOscuro); })
      .on('pointerout', () => { if (!this.busy) this.drawButton(PALETTE.verde); })
      .on('pointerdown', (p, lx, ly, ev) => {
        ev?.stopPropagation?.();
        if (!this.busy && this.visible && this.callback) this.callback();
      });

    this.container.add([panel, icon, bang, title, this.button]);

    // Etiqueta flotante en el mundo
    const labelText = this.isTouch ? 'Toca Eliminar' : 'Presiona E';
    this.worldLabel = scene.add.container(0, 0).setDepth(DEPTH - 1).setVisible(false);
    const lt = scene.add.text(0, 0, labelText, {
      fontFamily: 'Arial, sans-serif', fontSize: 12, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    const lw = lt.width + 14, lh = lt.height + 8;
    const lbg = scene.add.graphics();
    lbg.fillStyle(hex(PALETTE.marino), 0.9).fillRoundedRect(-lw / 2, -lh / 2, lw, lh, 6);
    lbg.lineStyle(2, hex(PALETTE.celeste), 1).strokeRoundedRect(-lw / 2, -lh / 2, lw, lh, 6);
    this.worldLabel.add([lbg, lt]);

    scene.scale.on('resize', (size) => this.container.setX(size.width / 2));
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
    if (this.busy) this.button.disableInteractive(); else this.button.setInteractive({ useHandCursor: true });
  }

  /** @param {() => void} cb */
  onPress(cb) { this.callback = cb; }

  /** Etiqueta pequeña sobre el criadero (coordenadas de mundo). */
  showLabelAt(x, y) { this.worldLabel.setPosition(x, y).setVisible(true); }
  hideLabel() { this.worldLabel.setVisible(false); }

  destroy() {
    if (this.tween) this.tween.stop();
    this.container.destroy();
    this.worldLabel.destroy();
  }
}
