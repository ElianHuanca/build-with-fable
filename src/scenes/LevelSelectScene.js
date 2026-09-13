import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { LEVELS } from '../data/levels.js';
import * as Save from '../systems/SaveSystem.js';
import { makeButton, sfx } from './MenuScene.js';

const FONT = 'Arial, sans-serif';
const CARD_W = 300;
const CARD_H = 340;
const CARD_R = 16;

/**
 * Lee el progreso de un nivel tolerando ambas formas de SaveSystem:
 * métodos estáticos (SaveSystem.getNivel) o instancia compartida (saveSystem.getNivel).
 * @returns {{estrellas:number, mejorTiempo:number|null, mejorPuntos:number}|null}
 */
function getProgreso(id) {
  try {
    const S = Save.SaveSystem;
    if (S && typeof S.getNivel === 'function') return S.getNivel(id) || null;
    if (Save.saveSystem && typeof Save.saveSystem.getNivel === 'function') return Save.saveSystem.getNivel(id) || null;
    if (typeof S === 'function') return new S().getNivel(id) || null;
  } catch { /* progreso ilegible */ }
  return null;
}

/** Formatea segundos (o ms si > 1000*60*60) como mm:ss. */
function fmtTiempo(t) {
  if (t == null || !Number.isFinite(t)) return null;
  let s = t > 36000 ? Math.round(t / 1000) : Math.round(t); // heurística: ms vs s
  const m = Math.floor(s / 60); s %= 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Selección de nivel: tarjetas con miniatura, estrellas y botón Jugar / Bloqueado.
 * Texturas opcionales: `level.thumb`, 'star_on', 'star_off', 'icon_lock'.
 * Inicia 'Game' con { levelId }.
 */
export class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelect'); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // Fondo degradado
    const bg = this.add.graphics();
    bg.fillGradientStyle(hex(PALETTE.celeste), hex(PALETTE.celeste), hex(PALETTE.azulGorra), hex(PALETTE.azulGorra), 1);
    bg.fillRect(0, 0, W, H);

    // Franja de título
    bg.fillStyle(hex(PALETTE.marino), 0.85).fillRect(0, 0, W, 70);
    this.add.text(W / 2, 35, 'Selecciona un nivel', {
      fontFamily: FONT, fontSize: 30, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.linea, strokeThickness: 5,
    }).setOrigin(0.5);

    // Tarjetas centradas
    const gap = 40;
    const totalW = LEVELS.length * CARD_W + (LEVELS.length - 1) * gap;
    const startX = W / 2 - totalW / 2 + CARD_W / 2;
    const cy = 70 + (H - 70) / 2;
    LEVELS.forEach((lvl, i) => {
      const card = this.crearTarjeta(lvl, startX + i * (CARD_W + gap), cy);
      card.setAlpha(0).setY(cy + 30);
      this.tweens.add({ targets: card, alpha: lvl.bloqueado ? 0.85 : 1, y: cy, duration: 300, delay: 80 * i, ease: 'Back.easeOut' });
    });

    // Volver
    makeButton(this, {
      x: 90, y: H - 40, w: 150, h: 50, label: '◀ Volver', fontSize: 18,
      color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro,
      onClick: () => this.scene.start('Menu'),
    });
    this.input.keyboard?.once('keydown-ESC', () => { sfx(this, 'click'); this.scene.start('Menu'); });
  }

  crearTarjeta(lvl, x, y) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.linea), 0.25).fillRoundedRect(-CARD_W / 2 + 4, -CARD_H / 2 + 6, CARD_W, CARD_H, CARD_R);
    g.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, CARD_R);
    g.lineStyle(4, hex(PALETTE.marino), 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, CARD_R);
    c.add(g);

    // Miniatura
    const thumbW = CARD_W - 32, thumbH = 150, thumbY = -CARD_H / 2 + 16 + thumbH / 2;
    c.add(this.crearMiniatura(lvl, thumbW, thumbH, thumbY));

    // Nombre
    c.add(this.add.text(0, thumbY + thumbH / 2 + 26, lvl.nombre, {
      fontFamily: FONT, fontSize: 26, fontStyle: 'bold', color: PALETTE.azulGorra,
    }).setOrigin(0.5));

    // Estrellas y mejor tiempo
    const prog = lvl.bloqueado ? null : getProgreso(lvl.id);
    const estrellas = Phaser.Math.Clamp(prog?.estrellas ?? 0, 0, 4);
    const starY = thumbY + thumbH / 2 + 62;
    for (let i = 0; i < 4; i++) c.add(this.crearEstrella(-45 + i * 30, starY, i < estrellas));
    const mejor = fmtTiempo(prog?.mejorTiempo);
    if (mejor) {
      c.add(this.add.text(0, starY + 24, `Mejor: ${mejor}`, {
        fontFamily: FONT, fontSize: 14, color: PALETTE.gris,
      }).setOrigin(0.5));
    }

    // Botón
    const btnY = CARD_H / 2 - 40;
    if (lvl.bloqueado) {
      const btn = makeButton(this, {
        x: 0, y: btnY, w: 200, h: 48, label: 'Bloqueado', fontSize: 20, icon: 'icon_lock',
        color: PALETTE.grisClaro, colorHover: PALETTE.grisClaro, disabled: true,
      });
      if (!this.textures.exists('icon_lock')) { btn.label.setX(12); btn.add(this.crearCandado(-68, 0)); }
      c.add(btn);
    } else {
      c.add(makeButton(this, {
        x: 0, y: btnY, w: 200, h: 52, label: 'Jugar', fontSize: 22,
        color: PALETTE.verde, colorHover: PALETTE.verdeOscuro,
        onClick: () => this.scene.start('Game', { levelId: lvl.id }),
      }));
    }
    return c;
  }

  crearMiniatura(lvl, w, h, y) {
    if (lvl.thumb && this.textures.exists(lvl.thumb)) {
      const img = this.add.image(0, y, lvl.thumb);
      img.setScale(Math.min(w / img.width, h / img.height));
      return img;
    }
    // Miniatura dibujada: césped, calle y casas
    const g = this.add.graphics();
    const x0 = -w / 2, y0 = y - h / 2;
    g.fillStyle(hex(PALETTE.verde), 1).fillRoundedRect(x0, y0, w, h, 10);
    g.fillStyle(hex(PALETTE.gris), 1).fillRect(x0, y0 + h / 2 - 12, w, 24).fillRect(x0 + w / 2 - 12, y0, 24, h);
    g.fillStyle(hex(PALETTE.amarillo), 1);
    for (let i = 0; i < 6; i++) g.fillRect(x0 + 8 + i * 46, y0 + h / 2 - 1.5, 20, 3);
    const casas = [[-90, -45], [-40, -45], [45, -45], [95, -45], [-90, 45], [-40, 45], [45, 45], [95, 45]];
    for (const [cx, cy] of casas) {
      g.fillStyle(hex(PALETTE.blanco), 1).fillRect(cx - 14, y + cy - 6, 28, 22);
      g.fillStyle(hex(lvl.bloqueado ? PALETTE.tejaOscura : PALETTE.teja), 1)
        .fillTriangle(cx - 18, y + cy - 6, cx + 18, y + cy - 6, cx, y + cy - 22);
      g.fillStyle(hex(PALETTE.verdeOscuro), 1).fillCircle(cx + 22, y + cy + 8, 6);
    }
    g.lineStyle(3, hex(PALETTE.marino), 0.6).strokeRoundedRect(x0, y0, w, h, 10);
    return g;
  }

  crearEstrella(x, y, llena) {
    const key = llena ? 'star_on' : 'star_off';
    if (this.textures.exists(key)) {
      const img = this.add.image(x, y, key);
      img.setScale(Math.min(26 / img.height, 1));
      return img;
    }
    const g = this.add.graphics();
    g.fillStyle(hex(llena ? PALETTE.amarillo : '#d5d9de'), 1);
    g.lineStyle(2, hex(llena ? PALETTE.teja : PALETTE.grisClaro), 1);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 12 : 5.5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(new Phaser.Geom.Point(x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
    g.fillPoints(pts, true).strokePoints(pts, true);
    return g;
  }

  crearCandado(x, y) {
    const g = this.add.graphics();
    g.lineStyle(3, hex(PALETTE.blanco), 1).strokeRoundedRect(x - 6, y - 12, 12, 10, 5);
    g.fillStyle(hex(PALETTE.gris), 1).fillRect(x - 6, y - 8, 12, 6); // tapa el borde inferior del arco
    g.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(x - 9, y - 4, 18, 14, 3);
    g.fillStyle(hex(PALETTE.gris), 1).fillCircle(x, y + 2, 2);
    return g;
  }
}
