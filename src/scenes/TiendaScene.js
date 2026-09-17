import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';
import { saveSystem, MEJORAS } from '../systems/SaveSystem.js';
import { t } from '../i18n/index.js';
import { makeButton, sfx } from './MenuScene.js';

const FONT = 'Arial, sans-serif';
const CARD_R = 16;

/**
 * Tienda SEDES (v4 §4.2): pantalla superpuesta a GameScene donde el jugador gasta los Bs
 * ganados (v4 §1) en 3 mejoras permanentes (`MEJORAS` en SaveSystem.js). La cartera y la
 * lógica de compra ya existen en SaveSystem; esta escena solo la muestra y la invoca.
 *
 *   scene.launch('Tienda')
 *
 * Al cerrar emite `game.events 'tienda:cerrar'` (y también en la escena 'Game' si está activa,
 * igual que Library/Camera) y se detiene con `scene.stop()`.
 */
export class TiendaScene extends Phaser.Scene {
  constructor() { super('Tienda'); }

  init() {
    this.cerrando = false;
    this.toast = null;
    this.cards = {};
  }

  create() {
    Layout.onResize(this, (w, h) => this.layout(w, h));
    this.input.keyboard?.on('keydown-ESC', () => this.cerrar());

    const onLang = () => this.layout(this.scale.width, this.scale.height);
    this.game.events.on('lang', onLang);
    this.events.once('shutdown', () => this.game.events.off('lang', onLang));
  }

  layout(W, H) {
    this.root?.destroy();
    this.toast?.destroy(); this.toast = null;
    const root = this.add.container(0, 0);
    this.root = root;
    const safe = Layout.safe(this);
    const ui = Layout.ui(this);
    this.ui = ui;

    // Fondo + bloqueo de toques a la escena de abajo.
    const bg = this.add.graphics();
    bg.fillStyle(hex(PALETTE.blanco), 1).fillRect(0, 0, W, H);
    const bloqueo = this.add.rectangle(W / 2, H / 2, W, H, 0, 0).setInteractive();
    root.add([bg, bloqueo]);

    // Cabecera
    const HEAD = 56;
    const head = this.add.graphics();
    head.fillStyle(hex(PALETTE.marino), 1).fillRect(0, 0, W, HEAD);
    head.fillStyle(hex(PALETTE.amarillo), 1).fillRect(0, HEAD - 4, W, 4);
    root.add(head);
    root.add(this.add.text(W / 2, HEAD / 2, t('tienda.titulo'), {
      fontFamily: FONT, fontSize: Math.round(24 * ui), fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.linea, strokeThickness: 4,
    }).setOrigin(0.5));
    root.add(makeButton(this, {
      x: W - safe.right - 24, y: HEAD / 2, w: 44, h: 40, label: '✕', fontSize: 20,
      color: PALETTE.teja, colorHover: PALETTE.tejaOscura, radius: 12, onClick: () => this.cerrar(),
    }));

    // Saldo
    const saldoY = HEAD + 44;
    this.saldoText = this.add.text(W / 2, saldoY, '', {
      fontFamily: FONT, fontSize: Math.round(22 * ui), fontStyle: 'bold', color: PALETTE.verdeOscuro,
    }).setOrigin(0.5);
    root.add(this.saldoText);
    this.actualizarSaldo();

    // Tarjetas de mejoras
    const areaTop = saldoY + 30;
    const portrait = Layout.isPortrait(this);
    const cardW = Math.min(W - safe.left - safe.right, portrait ? 420 : 460);
    const cardH = portrait ? 108 : 96;
    const gap = 16;
    const totalH = MEJORAS.length * cardH + (MEJORAS.length - 1) * gap;
    const startY = Math.max(areaTop, (H - totalH) / 2 - 10);
    this.cards = {};
    MEJORAS.forEach((def, i) => {
      const cy = startY + i * (cardH + gap) + cardH / 2;
      const card = this.construirTarjeta(def, cardW, cardH).setPosition(W / 2, cy);
      root.add(card);
      this.cards[def.id] = card;
    });
  }

  actualizarSaldo() {
    if (!this.saldoText?.active) return;
    this.saldoText.setText(t('tienda.saldo', { n: saveSystem.saldoBs() }));
  }

  /** Nombre/descripción kid-friendly de una mejora, tomados del diccionario i18n. */
  textoMejora(id) {
    return { nombre: t(`tienda.mejora.${id}`), desc: t(`tienda.mejora.${id}.desc`) };
  }

  construirTarjeta(def, w, h) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    const tiene = saveSystem.tieneMejora(def.id);
    const borde = tiene ? PALETTE.verde : PALETTE.azulGorra;
    g.fillStyle(hex(PALETTE.linea), 0.18).fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, CARD_R);
    g.fillStyle(hex(tiene ? '#eafbe3' : PALETTE.blanco), 1).fillRoundedRect(-w / 2, -h / 2, w, h, CARD_R);
    g.lineStyle(3, hex(borde), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, CARD_R);
    c.add(g);

    const { nombre, desc } = this.textoMejora(def.id);
    const pad = 16;
    const textW = w - pad * 2 - 120;
    c.add(this.add.text(-w / 2 + pad, -h / 2 + 14, nombre, {
      fontFamily: FONT, fontSize: 17, fontStyle: 'bold', color: PALETTE.marino, wordWrap: { width: textW },
    }));
    c.add(this.add.text(-w / 2 + pad, -h / 2 + 40, desc, {
      fontFamily: FONT, fontSize: 13, color: PALETTE.gris, wordWrap: { width: textW }, lineSpacing: 2,
    }));
    c.add(this.add.text(-w / 2 + pad, h / 2 - 24, t('tienda.costo', { n: def.costo }), {
      fontFamily: FONT, fontSize: 14, fontStyle: 'bold', color: PALETTE.teja,
    }));

    const btnW = 110, btnH = 44;
    const btnX = w / 2 - pad - btnW / 2;
    const alcanza = saveSystem.saldoBs() >= def.costo;
    let label = t('tienda.comprar');
    let color = PALETTE.verde, colorHover = PALETTE.verdeOscuro;
    if (tiene) { label = t('tienda.yaLaTienes'); color = PALETTE.grisClaro; colorHover = PALETTE.grisClaro; }
    else if (!alcanza) { label = t('tienda.noAlcanza'); color = PALETTE.grisClaro; colorHover = PALETTE.grisClaro; }
    const btn = makeButton(this, {
      x: btnX, y: 0, w: btnW, h: btnH, label, fontSize: 14, radius: 12,
      color, colorHover, disabled: tiene,
      onClick: () => this.comprar(def.id),
    });
    c.add(btn);
    c.setSize(...touchSize(w, h));
    return c;
  }

  comprar(id) {
    if (this.cerrando) return;
    const res = saveSystem.comprarMejora(id);
    if (res.ok) {
      sfx(this, 'points');
      this.actualizarSaldo();
      this.refrescarTarjeta(id);
      this.mostrarToast(t('tienda.comprada'), PALETTE.verde);
      this.game.events.emit('tienda:compra', { id, saldo: res.saldo });
    } else {
      sfx(this, 'click');
      const tiene = saveSystem.tieneMejora(id);
      this.sacudirTarjeta(id);
      if (!tiene) this.mostrarToast(t('tienda.sinFondos'), PALETTE.teja);
    }
  }

  /** Reconstruye una sola tarjeta (tras compra exitosa) sin rehacer todo el layout. */
  refrescarTarjeta(id) {
    const vieja = this.cards[id];
    if (!vieja?.active) return;
    const { x, y } = vieja;
    const def = MEJORAS.find((m) => m.id === id);
    vieja.destroy();
    // Reutilizamos el mismo ancho/alto que ya se usó en layout(): recalculado igual que allí.
    const portrait = Layout.isPortrait(this);
    const safe = Layout.safe(this);
    const cardW = Math.min(this.scale.width - safe.left - safe.right, portrait ? 420 : 460);
    const cardH = portrait ? 108 : 96;
    const nueva = this.construirTarjeta(def, cardW, cardH).setPosition(x, y);
    this.root.add(nueva);
    this.cards[id] = nueva;
  }

  sacudirTarjeta(id) {
    const card = this.cards[id];
    if (!card?.active) return;
    const x0 = card.x;
    this.tweens.add({ targets: card, x: x0 - 8, duration: 60, yoyo: true, repeat: 3, onComplete: () => { if (card.active) card.x = x0; } });
  }

  mostrarToast(texto, color) {
    this.toast?.destroy();
    const W = this.scale.width;
    const tc = this.add.container(W / 2, 130).setDepth(50);
    const txt = this.add.text(0, 0, texto, {
      fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.marino, align: 'center',
      wordWrap: { width: Math.min(W - 60, 460) },
    }).setOrigin(0.5);
    const w = txt.width + 44, h = txt.height + 22;
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.linea), 0.25).fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 14);
    g.fillStyle(hex(PALETTE.amarillo), 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.lineStyle(4, hex(color), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    tc.add([g, txt]);
    tc.setScale(0.6).setAlpha(0);
    this.toast = tc;
    this.tweens.add({ targets: tc, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: tc, alpha: 0, y: 100, delay: 1500, duration: 300, onComplete: () => { if (this.toast === tc) this.toast = null; tc.destroy(); } });
  }

  cerrar() {
    if (this.cerrando) return;
    this.cerrando = true;
    sfx(this, 'click');
    this.game.events.emit('tienda:cerrar');
    this.scene.get('Game')?.events.emit('tienda:cerrar');
    this.scene.stop();
  }
}
