import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { FACTS } from '../data/facts.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';

const CARD_W = 560;
const CARD_H = 300;
const FONT = 'Arial, sans-serif';
const ROJO = '#e74c3c';

/**
 * Popup educativo. Uso: scene.launch('Popup', { type: 'llanta' }).
 * Emite en la escena 'Game': 'sfx' ('click') y 'popup:cerrado' al cerrar.
 */
export class PopupScene extends Phaser.Scene {
  constructor() { super({ key: 'Popup' }); }

  init(data) {
    this.type = data?.type ?? 'llanta';
    this.fact = FACTS[this.type] ?? FACTS.llanta;
    this.closing = false;
  }

  create() {
    Layout.onResize(this, (w, h) => this.layout(w, h));

    this.input.keyboard?.on('keydown-E', () => this.close());
    this.input.keyboard?.on('keydown-ENTER', () => this.close());
    this.input.keyboard?.on('keydown-SPACE', () => this.close());
  }

  /** Reconstruye la tarjeta para el tamaño actual del lienzo (RESIZE): llamado al crear y en cada resize. */
  layout(W, H) {
    // Si un resize llega mientras se cierra (tween en close()), no la reconstruyas: se vería "reabrir".
    if (this.closing) return;
    this.root?.destroy();
    const root = this.add.container(0, 0);
    this.root = root;
    const cx = W / 2, cy = H / 2;

    // Fondo oscurecido que bloquea clics
    root.add(this.add.rectangle(cx, cy, W, H, 0x000000, 0.45).setInteractive());

    // Ancho relativo: min(ancho − márgenes, CARD_W). El resto de la maqueta se deriva de este valor,
    // así el diseño se achica sin romperse en pantallas angostas (vertical) en vez de desbordar.
    const cardW = Layout.panelWidth(this, CARD_W);
    const cardH = Math.min(CARD_H, H - 2 * Layout.MARGIN * 2);

    this.card = this.add.container(cx, cy).setScale(0.8).setAlpha(0);
    root.add(this.card);

    // Tarjeta
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.25).fillRoundedRect(-cardW / 2 + 6, -cardH / 2 + 8, cardW, cardH, 18);
    bg.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
    bg.lineStyle(5, hex(PALETTE.marino), 1).strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
    this.card.add(bg);

    // Cuadro con el sprite del criadero
    const boxX = -cardW / 2 + 26, boxY = -cardH / 2 + 40, boxS = 150;
    const box = this.add.graphics();
    box.fillStyle(hex(PALETTE.celeste), 0.35).fillRoundedRect(boxX, boxY, boxS, boxS, 12);
    box.lineStyle(3, hex(PALETTE.marino), 1).strokeRoundedRect(boxX, boxY, boxS, boxS, 12);
    this.card.add(box);
    const imgKey = `${this.type}_agua`;
    if (this.textures.exists(imgKey)) {
      const img = this.add.image(boxX + boxS / 2, boxY + boxS / 2, imgKey).setScale(1.6);
      const maxS = boxS - 16;
      if (img.displayWidth > maxS || img.displayHeight > maxS) {
        img.setScale(Math.min(maxS / img.width, maxS / img.height));
      }
      this.card.add(img);
    } else {
      this.card.add(this.add.text(boxX + boxS / 2, boxY + boxS / 2, '?', {
        fontFamily: FONT, fontSize: 48, fontStyle: 'bold', color: PALETTE.marino,
      }).setOrigin(0.5));
    }

    // Texto a la derecha (o abajo si el cuadro no deja sitio en pantallas muy angostas)
    const tx = boxX + boxS + 22;
    const textW = cardW / 2 - 24 - tx;
    let y = -cardH / 2 + 34;
    const title = this.add.text(tx, y, this.fact.nombre, {
      fontFamily: FONT, fontSize: 30, fontStyle: 'bold', color: ROJO,
    });
    this.card.add(title);
    y += title.height + 8;

    y = this.addRichText(this.fact.dato, tx, y, textW, 17, PALETTE.marino) + 8;
    const consejo = this.add.text(tx, y, this.fact.consejo, {
      fontFamily: FONT, fontSize: 15, color: PALETTE.gris, wordWrap: { width: textW },
    });
    this.card.add(consejo);
    y += consejo.height + 6;
    this.card.add(this.add.text(tx, y, `Fuente: ${this.fact.fuente}`, {
      fontFamily: FONT, fontSize: 13, color: PALETTE.grisClaro,
    }));

    // Botón ¡Genial!
    this.card.add(this.makeButton(0, cardH / 2 - 40, 220, 52, '¡Genial!', PALETTE.verde, PALETTE.verdeOscuro, () => this.close()));

    // Botón X
    const xBtn = this.add.container(cardW / 2 - 6, -cardH / 2 + 6);
    const xg = this.add.graphics();
    xg.fillStyle(hex(PALETTE.blanco), 1).fillCircle(0, 0, 20);
    xg.fillStyle(hex(ROJO), 1).fillCircle(0, 0, 17);
    xg.lineStyle(3, hex(PALETTE.blanco), 1);
    xg.lineBetween(-6, -6, 6, 6).lineBetween(-6, 6, 6, -6);
    xBtn.add(xg);
    xBtn.setSize(...touchSize(40, 40)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => xBtn.setScale(1.1))
      .on('pointerout', () => xBtn.setScale(1))
      .on('pointerdown', () => this.close());
    this.card.add(xBtn);

    this.tweens.add({ targets: this.card, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /** Texto con las palabras que contienen dígitos en negrita (token a token, con salto de línea). */
  addRichText(text, x, y, maxW, size, color) {
    const tokens = text.split(' ');
    let cx = x, cy = y, lineH = 0;
    for (const tok of tokens) {
      const bold = /\d/.test(tok);
      const t = this.add.text(0, 0, tok + ' ', {
        fontFamily: FONT, fontSize: size, fontStyle: bold ? 'bold' : 'normal', color,
      });
      if (cx + t.width > x + maxW && cx > x) { cx = x; cy += lineH; }
      t.setPosition(cx, cy);
      cx += t.width;
      lineH = Math.max(lineH, t.height);
      this.card.add(t);
    }
    return cy + lineH;
  }

  makeButton(x, y, w, h, label, color, hover, cb) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const draw = (col) => {
      g.clear();
      g.fillStyle(hex(PALETTE.marino), 0.25).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
      g.fillStyle(hex(col), 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      g.lineStyle(2, hex(PALETTE.blanco), 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    draw(color);
    const t = this.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: 20, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    c.add([g, t]).setSize(...touchSize(w, h)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(hover))
      .on('pointerout', () => draw(color))
      .on('pointerdown', cb);
    return c;
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    const game = this.scene.get('Game');
    game?.events.emit('sfx', 'click');
    this.tweens.add({
      targets: this.card, scale: 0.8, alpha: 0, duration: 160, ease: 'Sine.easeIn',
      onComplete: () => {
        game?.events.emit('popup:cerrado', this.type);
        this.scene.stop();
      },
    });
  }
}
