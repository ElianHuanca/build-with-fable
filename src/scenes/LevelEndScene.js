import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';

const FONT = 'Arial, sans-serif';
const MENSAJES = {
  3: '¡Excelente! Un barrio limpio es un barrio más sano.',
  2: '¡Muy bien! Cada criadero menos cuenta.',
  1: '¡Lo lograste! La próxima vez, más rápido.',
  0: '¡Lo lograste! La próxima vez, más rápido.',
};

const fmtTiempo = (s) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Pantalla de fin de nivel.
 * scene.launch('LevelEnd', { puntos, limpios, total, tiempo, estrellas, nivelId, nivelNombre })
 * Emite en 'Game': 'sfx' ('win', 'points'), 'nivel:continuar', 'nivel:foto'.
 */
export class LevelEndScene extends Phaser.Scene {
  constructor() { super({ key: 'LevelEnd' }); }

  init(data = {}) {
    this.data_ = {
      puntos: data.puntos ?? 0,
      limpios: data.limpios ?? 0,
      total: data.total ?? data.limpios ?? 0,
      tiempo: data.tiempo ?? 0,
      estrellas: Phaser.Math.Clamp(data.estrellas ?? 0, 0, 3),
      nivelId: data.nivelId ?? null,
      nivelNombre: data.nivelNombre ?? '',
    };
    this.done = false;
  }

  sfx(name) { this.scene.get('Game')?.events.emit('sfx', name); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const cx = W / 2;
    const d = this.data_;

    this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.55).setInteractive();
    this.sfx('win');

    // Cinta azul
    const ribbonW = 460, ribbonH = 64, ry = 62;
    const rib = this.add.graphics();
    rib.fillStyle(hex(PALETTE.azulGorraOscuro), 1);
    rib.fillTriangle(cx - ribbonW / 2 - 30, ry - ribbonH / 2 + 8, cx - ribbonW / 2 + 10, ry, cx - ribbonW / 2 - 30, ry + ribbonH / 2 + 8);
    rib.fillTriangle(cx + ribbonW / 2 + 30, ry - ribbonH / 2 + 8, cx + ribbonW / 2 - 10, ry, cx + ribbonW / 2 + 30, ry + ribbonH / 2 + 8);
    rib.fillStyle(hex(PALETTE.azulGorra), 1).fillRoundedRect(cx - ribbonW / 2, ry - ribbonH / 2, ribbonW, ribbonH, 10);
    rib.lineStyle(4, hex(PALETTE.marino), 1).strokeRoundedRect(cx - ribbonW / 2, ry - ribbonH / 2, ribbonW, ribbonH, 10);
    this.add.text(cx, ry, '¡Barrio protegido!', {
      fontFamily: FONT, fontSize: 34, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.marino, strokeThickness: 6,
    }).setOrigin(0.5);
    if (d.nivelNombre) {
      this.add.text(cx, ry + ribbonH / 2 + 14, d.nivelNombre, {
        fontFamily: FONT, fontSize: 15, fontStyle: 'bold', color: PALETTE.celeste,
      }).setOrigin(0.5);
    }

    // Estrellas
    const starY = 150, gap = 90;
    this.stars = [];
    for (let i = 0; i < 3; i++) {
      const on = i < d.estrellas;
      const sx = cx - gap + i * gap;
      const s = this.makeStar(sx, starY, on).setScale(0).setAlpha(0);
      this.stars.push(s);
      this.time.delayedCall(350 + i * 250, () => {
        if (on) this.sfx('points');
        this.tweens.add({ targets: s, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
      });
    }

    // Barra verde
    const barW = 380, barH = 22, by = 210;
    const barBg = this.add.graphics();
    barBg.fillStyle(hex(PALETTE.marino), 1).fillRoundedRect(cx - barW / 2, by - barH / 2, barW, barH, 11);
    const barFill = this.add.graphics();
    const pct = { v: 0 };
    const pctText = this.add.text(cx, by, '0 %', {
      fontFamily: FONT, fontSize: 14, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5).setDepth(1);
    const drawBar = () => {
      barFill.clear();
      const w = Math.max(barH, (barW - 4) * pct.v);
      barFill.fillStyle(hex(PALETTE.verde), 1).fillRoundedRect(cx - barW / 2 + 2, by - barH / 2 + 2, w, barH - 4, 9);
      pctText.setText(`${Math.round(pct.v * 100)} %`);
    };
    drawBar();
    this.tweens.add({ targets: pct, v: 1, duration: 800, delay: 300, ease: 'Sine.easeOut', onUpdate: drawBar });

    // Panel resumen (izquierda)
    const pw = 300, ph = 150, px = cx - 200, py = 330;
    const panel = this.add.graphics();
    panel.fillStyle(hex(PALETTE.marino), 0.95).fillRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 14);
    panel.lineStyle(3, hex(PALETTE.celeste), 1).strokeRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 14);
    const lines = [
      `Puntos: ${d.puntos}`,
      `Criaderos eliminados: ${d.limpios}${d.total ? ' / ' + d.total : ''}`,
      `Tiempo: ${fmtTiempo(d.tiempo)}`,
    ];
    lines.forEach((l, i) => {
      this.add.text(px - pw / 2 + 22, py - ph / 2 + 28 + i * 42, l, {
        fontFamily: FONT, fontSize: 20, fontStyle: 'bold', color: i === 0 ? PALETTE.amarillo : PALETTE.blanco,
      }).setOrigin(0, 0.5);
    });

    // Bocadillo + retrato (derecha)
    const bw = 250, bh = 110, bx = cx + 170, byy = 320;
    const bub = this.add.graphics();
    bub.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(bx - bw / 2, byy - bh / 2, bw, bh, 14);
    bub.fillTriangle(bx + bw / 2 - 4, byy + 10, bx + bw / 2 + 18, byy + 22, bx + bw / 2 - 4, byy + 34);
    bub.lineStyle(3, hex(PALETTE.marino), 1).strokeRoundedRect(bx - bw / 2, byy - bh / 2, bw, bh, 14);
    this.add.text(bx, byy, MENSAJES[d.estrellas], {
      fontFamily: FONT, fontSize: 16, fontStyle: 'bold', color: PALETTE.marino,
      wordWrap: { width: bw - 28 }, align: 'center',
    }).setOrigin(0.5);

    const rx = bx + bw / 2 + 62, rY = byy + 30;
    if (this.textures.exists('retrato_pulgar')) {
      this.add.image(rx, rY, 'retrato_pulgar');
    } else if (this.textures.exists('player')) {
      this.add.image(rx, rY, 'player', 'down_0').setScale(2);
    }

    // Botones
    this.add.existing(this.makeButton(cx + 100, 470, 230, 56, 'Continuar', PALETTE.verde, PALETTE.verdeOscuro, 22, () => this.finish('nivel:continuar')));
    this.add.existing(this.makeButton(cx - 125, 470, 190, 52, 'Modo foto', PALETTE.grisClaro, PALETTE.gris, 18, () => this.finish('nivel:foto')));

    this.input.keyboard?.on('keydown-ENTER', () => this.finish('nivel:continuar'));
    this.input.keyboard?.on('keydown-SPACE', () => this.finish('nivel:continuar'));
  }

  makeStar(x, y, on) {
    const key = on ? 'star_on' : 'star_off';
    if (this.textures.exists(key)) return this.add.image(x, y, key);
    const g = this.add.graphics({ x, y });
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 34 : 15;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    g.fillStyle(on ? hex(PALETTE.amarillo) : hex(PALETTE.gris), 1).fillPoints(pts, true);
    g.lineStyle(4, on ? hex(PALETTE.teja) : hex(PALETTE.linea), 1).strokePoints(pts, true);
    return g;
  }

  makeButton(x, y, w, h, label, color, hover, size, cb) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const draw = (col) => {
      g.clear();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
      g.fillStyle(hex(col), 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      g.lineStyle(2, hex(PALETTE.blanco), 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    draw(color);
    const t = this.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: size, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    c.add([g, t]).setSize(...touchSize(w, h)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(hover))
      .on('pointerout', () => draw(color))
      .on('pointerdown', cb);
    return c;
  }

  finish(evt) {
    if (this.done) return;
    this.done = true;
    const game = this.scene.get('Game');
    game?.events.emit('sfx', 'click');
    game?.events.emit(evt, this.data_);
    this.scene.stop();
  }
}
