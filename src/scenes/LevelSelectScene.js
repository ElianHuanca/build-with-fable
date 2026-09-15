import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import * as Levels from '../data/levels.js';
import * as Save from '../systems/SaveSystem.js';
import { makeButton, sfx, fitText } from './MenuScene.js';
import { Layout } from '../systems/Layout.js';
import { Badges } from '../systems/Badges.js';
import { INSIGNIAS } from '../data/library.js';
import { t } from '../i18n/index.js';

const FONT = 'Arial, sans-serif';
const CARD_W = 300;
const CARD_H = 340;
const CARD_R = 16;
const LEVELS = Levels.LEVELS;

/** Nombre del nivel en el idioma actual (nombreNivel de levels.js si existe; si no, lvl.nombre). */
function nombreDeNivel(lvl) {
  if (typeof Levels.nombreNivel === 'function') return Levels.nombreNivel(lvl);
  return typeof lvl.nombre === 'string' ? lvl.nombre : (lvl.nombre?.es ?? lvl.id);
}

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
    Layout.onResize(this, (w, h) => this.layout(w, h));
    const onLang = () => this.layout(this.scale.width, this.scale.height);
    this.game.events.on('lang', onLang);
    this.events.once('shutdown', () => this.game.events.off('lang', onLang));
    this.input.keyboard?.once('keydown-ESC', () => { sfx(this, 'click'); this.scene.start('Menu'); });
  }

  /** Reconstruye la pantalla para el tamaño actual del lienzo (RESIZE): llamado al crear y en cada resize. */
  layout(W, H) {
    const primeraVez = !this.root;
    this.root?.destroy();
    const root = this.add.container(0, 0);
    this.root = root;

    const TITLE_H = 70;
    const FOOTER_H = 70;

    // Fondo degradado
    const bg = this.add.graphics();
    bg.fillGradientStyle(hex(PALETTE.celeste), hex(PALETTE.celeste), hex(PALETTE.azulGorra), hex(PALETTE.azulGorra), 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(hex(PALETTE.marino), 0.85).fillRect(0, 0, W, TITLE_H);
    root.add(bg);
    const titulo = this.add.text(W / 2, TITLE_H / 2, t('sel.titulo'), {
      fontFamily: FONT, fontSize: 30, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.linea, strokeThickness: 5,
    }).setOrigin(0.5);
    fitText(titulo, W - 40, 30);
    root.add(titulo);

    const safe = Layout.safe(this);
    const availW = W - safe.left - safe.right;
    const availH = H - TITLE_H - FOOTER_H;
    const portrait = Layout.isPortrait(this);
    // Insignias de la biblioteca: bajo el título en horizontal; junto a "Volver" en vertical (las tarjetas ocupan todo el alto).
    root.add(this.crearInsignias(portrait ? W - safe.right - 8 : W / 2, portrait ? H - 40 : TITLE_H + 16, portrait ? 'right' : 'center'));

    if (portrait) {
      // Columna: apila las tarjetas y las escala para que quepan en el alto disponible.
      const gap = 24;
      const neededH = LEVELS.length * CARD_H + (LEVELS.length - 1) * gap;
      const scale = Math.max(0.55, Math.min(1, availW / CARD_W, availH / neededH));
      const cardH = CARD_H * scale, cardGap = gap * scale;
      const totalH = LEVELS.length * cardH + (LEVELS.length - 1) * cardGap;
      let y = TITLE_H + (availH - totalH) / 2 + cardH / 2;
      LEVELS.forEach((lvl, i) => {
        const card = this.crearTarjeta(lvl, W / 2, y).setScale(scale);
        this.animarEntrada(card, y, i, primeraVez, lvl.bloqueado);
        root.add(card);
        y += cardH + cardGap;
      });
    } else {
      // Fila: centrada, escalada si no entra a lo ancho o si no entra al alto (pantallas horizontales
      // bajitas, ej. 640x320): sin el tope de alto la tarjeta a escala 1 (340px) se salía del área
      // disponible (availH) y su botón "Jugar" quedaba tapado por "Volver" del pie de página.
      const gap = 40;
      const totalW = LEVELS.length * CARD_W + (LEVELS.length - 1) * gap;
      const scale = Math.min(1, availW / totalW, availH / CARD_H);
      const cardW = CARD_W * scale, cardGap = gap * scale;
      const scaledTotalW = LEVELS.length * cardW + (LEVELS.length - 1) * cardGap;
      const startX = W / 2 - scaledTotalW / 2 + cardW / 2;
      const cy = TITLE_H + availH / 2;
      LEVELS.forEach((lvl, i) => {
        const card = this.crearTarjeta(lvl, startX + i * (cardW + cardGap), cy).setScale(scale);
        this.animarEntrada(card, cy, i, primeraVez, lvl.bloqueado);
        root.add(card);
      });
    }

    // Volver
    root.add(makeButton(this, {
      x: 90, y: H - 40, w: 150, h: 50, label: t('sel.volver'), fontSize: 18,
      color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro,
      onClick: () => this.scene.start('Menu'),
    }));
  }

  /** Fila pequeña de insignias de la biblioteca (ganadas en color, pendientes en gris) bajo el título. */
  crearInsignias(x, y, align = 'center') {
    const c = this.add.container(x, y);
    const r = 11, gap = 30;
    const n = Badges.lista().length;
    const etiqueta = this.add.text(0, 0, `${t('lib.insignias')} ${n}/${INSIGNIAS.length}`, {
      fontFamily: FONT, fontSize: 12, fontStyle: 'bold', color: PALETTE.blanco, stroke: PALETTE.linea, strokeThickness: 3,
    }).setOrigin(0, 0.5);
    const totalW = INSIGNIAS.length * gap + etiqueta.width;
    const x0 = align === 'right' ? -totalW + r : -totalW / 2 + r;
    INSIGNIAS.forEach((def, i) => {
      const ganada = Badges.tiene(def.id);
      const x = x0 + i * gap;
      if (this.textures.exists(def.icono)) {
        const img = this.add.image(x, 0, def.icono);
        img.setScale((r * 2) / Math.max(img.width, img.height));
        if (!ganada) img.setTint(0x9a9a9a).setAlpha(0.5);
        c.add(img);
      } else {
        const g = this.add.graphics();
        g.fillStyle(hex(ganada ? def.color : '#dfe4e8'), ganada ? 1 : 0.7).fillCircle(x, 0, r);
        g.lineStyle(2, hex(ganada ? PALETTE.blanco : PALETTE.grisClaro), 0.9).strokeCircle(x, 0, r - 2);
        c.add(g);
        c.add(this.add.text(x, 0, def.glifo, {
          fontFamily: FONT, fontSize: 11, fontStyle: 'bold', color: ganada ? PALETTE.blanco : PALETTE.grisClaro,
        }).setOrigin(0.5));
      }
    });
    etiqueta.setPosition(x0 + INSIGNIAS.length * gap - r - 4, 0);
    c.add(etiqueta);
    return c;
  }

  /** Animación de entrada (solo la primera vez; en un resize las tarjetas ya deben verse quietas). */
  animarEntrada(card, destinoY, i, primeraVez, bloqueado) {
    if (!primeraVez) return;
    card.setAlpha(0).setY(destinoY + 30);
    this.tweens.add({ targets: card, alpha: bloqueado ? 0.85 : 1, y: destinoY, duration: 300, delay: 80 * i, ease: 'Back.easeOut' });
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
    const nombre = this.add.text(0, thumbY + thumbH / 2 + 26, nombreDeNivel(lvl), {
      fontFamily: FONT, fontSize: 26, fontStyle: 'bold', color: PALETTE.azulGorra,
    }).setOrigin(0.5);
    fitText(nombre, CARD_W - 32, 26);
    c.add(nombre);

    // Estrellas y mejor tiempo
    const prog = lvl.bloqueado ? null : getProgreso(lvl.id);
    const estrellas = Phaser.Math.Clamp(prog?.estrellas ?? 0, 0, 4);
    const starY = thumbY + thumbH / 2 + 62;
    for (let i = 0; i < 4; i++) c.add(this.crearEstrella(-45 + i * 30, starY, i < estrellas));
    const mejor = fmtTiempo(prog?.mejorTiempo);
    if (mejor) {
      c.add(this.add.text(0, starY + 24, t('sel.mejor', { t: mejor }), {
        fontFamily: FONT, fontSize: 14, color: PALETTE.gris,
      }).setOrigin(0.5));
    }

    // Botón
    const btnY = CARD_H / 2 - 40;
    if (lvl.bloqueado) {
      const btn = makeButton(this, {
        x: 0, y: btnY, w: 200, h: 48, label: t('sel.bloqueado'), fontSize: 20, icon: 'icon_lock',
        color: PALETTE.grisClaro, colorHover: PALETTE.grisClaro, disabled: true,
      });
      if (!this.textures.exists('icon_lock')) { btn.label.setX(12); btn.add(this.crearCandado(-68, 0)); }
      c.add(btn);
    } else {
      c.add(makeButton(this, {
        x: 0, y: btnY, w: 200, h: 52, label: t('sel.jugar'), fontSize: 22,
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
