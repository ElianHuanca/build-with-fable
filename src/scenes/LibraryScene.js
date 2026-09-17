import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';
import { Badges } from '../systems/Badges.js';
import { LIBRARY_TABS, INSIGNIAS } from '../data/library.js';
import { t, tx, txList } from '../i18n/index.js';
import { makeButton, sfx } from './MenuScene.js';

const FONT = 'Arial, sans-serif';
const ROJO = '#e74c3c';
const ROJO_OSCURO = '#b03a2e';
const PAPEL = '#f4fbff';
const RAYA = '#cfe6f2';
const CARD_R = 18;
const SWIPE = 50;

/**
 * Biblioteca SEDES (v3): tarjetas de aprendizaje con pestañas, carrusel (flechas, teclado
 * y deslizar), mitos que se voltean e insignias.
 *
 *   scene.launch('Library', { desde: 'menu' | 'estacion' })
 *
 * Al cerrar emite `game.events 'library:cerrar'` (y también en la escena 'Game' si viene de
 * la estación) y se detiene. Texturas opcionales: 'icon_book', 'mosq_*', 'ciclo_*',
 * 'insignia_*' y los sprites de criaderos; todas tienen fallback dibujado.
 */
export class LibraryScene extends Phaser.Scene {
  constructor() { super('Library'); }

  init(data = {}) {
    this.desde = data.desde === 'estacion' ? 'estacion' : 'menu';
    this.tabIdx = Math.max(0, LIBRARY_TABS.findIndex((tb) => tb.id === data.tab));
    this.cardIdx = LIBRARY_TABS.map(() => 0);
    this.busy = false;
    this.cerrando = false;
    this.drag = null;
    this.card = null;
    this.mitoLado = 'mito';
    /** Foto activa por tarjeta de especie (índice en `carta.fotos`), para el selector de ángulos. */
    this.fotoIdx = {};
  }

  get tab() { return LIBRARY_TABS[this.tabIdx]; }
  get carta() { return this.tab.tarjetas[this.cardIdx[this.tabIdx]]; }

  create() {
    Layout.onResize(this, (w, h) => this.layout(w, h));

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.cerrar());
    kb?.on('keydown-LEFT', () => this.mover(-1));
    kb?.on('keydown-RIGHT', () => this.mover(1));
    kb?.on('keydown-SPACE', () => this.voltear());
    kb?.on('keydown-ENTER', () => this.voltear());

    // Deslizar horizontal sobre la tarjeta (táctil o ratón); un toque corto voltea los mitos.
    this.input.on('pointerdown', (p) => {
      if (this.busy || !this.cardBounds || !Phaser.Geom.Rectangle.Contains(this.cardBounds, p.x, p.y)) return;
      this.drag = { x0: p.x, moved: false };
    });
    this.input.on('pointermove', (p) => {
      if (!this.drag || !this.card) return;
      const dx = p.x - this.drag.x0;
      if (Math.abs(dx) > 6) this.drag.moved = true;
      this.card.x = this.cardX + dx * 0.9;
      this.card.angle = dx * 0.01;
    });
    const soltar = (p) => {
      if (!this.drag) return;
      const d = this.drag; this.drag = null;
      const dx = p.x - d.x0;
      if (dx < -SWIPE) this.mover(1);
      else if (dx > SWIPE) this.mover(-1);
      else {
        if (this.card) this.tweens.add({ targets: this.card, x: this.cardX, angle: 0, duration: 160, ease: 'Back.easeOut' });
        if (!d.moved) this.voltear();
      }
    };
    this.input.on('pointerup', soltar);
    this.input.on('pointerupoutside', soltar);

    const onLang = () => this.layout(this.scale.width, this.scale.height);
    this.game.events.on('lang', onLang);
    this.events.once('shutdown', () => this.game.events.off('lang', onLang));

    // Contador de reportes a SEDES (cámara IA): registry global, se actualiza aunque la
    // Biblioteca ya esté abierta.
    this.onReportes = (parent, key) => { if (key === 'reportesEnviados') this.actualizarReportes(); };
    this.registry.events.on('setdata', this.onReportes);
    this.registry.events.on('changedata', this.onReportes);
    this.events.once('shutdown', () => {
      this.registry.events.off('setdata', this.onReportes);
      this.registry.events.off('changedata', this.onReportes);
    });
  }

  // ───────────────────────────── layout ─────────────────────────────

  /** Reconstruye toda la pantalla para el tamaño actual (RESIZE) y muestra la tarjeta actual. */
  layout(W, H) {
    this.root?.destroy();
    this.card?.destroy(); this.card = null;
    this.toast?.destroy(); this.toast = null;
    const root = this.add.container(0, 0);
    this.root = root;
    const portrait = Layout.isPortrait(this);
    const safe = Layout.safe(this);
    const ui = Layout.ui(this);
    this.ui = ui;

    root.add(this.drawCuaderno(W, H));

    // Cabecera
    const HEAD = 56;
    const head = this.add.graphics();
    head.fillStyle(hex(PALETTE.marino), 1).fillRect(0, 0, W, HEAD);
    head.fillStyle(hex(PALETTE.celeste), 1).fillRect(0, HEAD - 4, W, 4);
    root.add(head);
    const titulo = this.add.text(W / 2, HEAD / 2, t('lib.titulo'), {
      fontFamily: FONT, fontSize: Math.round(24 * ui), fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.linea, strokeThickness: 4,
    }).setOrigin(0.5);
    root.add(titulo);
    const headIcon = ['icon_library', 'icon_book'].find((k) => this.textures.exists(k));
    if (headIcon) {
      const ic = this.add.image(W / 2 - titulo.width / 2 - 24, HEAD / 2, headIcon);
      ic.setScale(Math.min(34 / ic.height, 1));
      root.add(ic);
    }
    root.add(makeButton(this, {
      x: W - safe.right - 24, y: HEAD / 2, w: 44, h: 40, label: '✕', fontSize: 20,
      color: PALETTE.teja, colorHover: PALETTE.tejaOscura, radius: 12, onClick: () => this.cerrar(),
    }));
    // Tienda SEDES (plan v4 §4.2): botón chico junto al cierre, abre TiendaScene por encima.
    root.add(makeButton(this, {
      x: W - safe.right - 24 - 44 - 8, y: HEAD / 2, w: 76, h: 40, label: t('tienda.titulo'), fontSize: 13,
      color: PALETTE.verde, colorHover: PALETTE.verdeOscuro, radius: 12, onClick: () => this.scene.launch('Tienda'),
    }));

    // Pestañas
    const TAB_Y = HEAD + 10;
    const TAB_H = 50;
    root.add(this.drawTabs(W, TAB_Y, TAB_H, safe));

    // Pie: flechas + progreso + reportes SEDES + insignias
    const FOOT_H = portrait ? 144 : 130;
    const footTop = H - safe.bottom - FOOT_H;
    root.add(this.drawFooter(W, footTop, FOOT_H, portrait));

    // Zona de tarjeta
    const areaTop = TAB_Y + TAB_H + 12;
    const areaH = footTop - 10 - areaTop;
    const cardW = portrait ? Math.min(W - safe.left - safe.right, 560) : Math.min(560, W - 160);
    const cardH = Math.max(240, Math.min(areaH, portrait ? 640 : 480));
    this.cardW = cardW; this.cardH = cardH;
    this.cardX = W / 2; this.cardY = areaTop + areaH / 2;
    this.cardBounds = new Phaser.Geom.Rectangle(this.cardX - cardW / 2, this.cardY - cardH / 2, cardW, cardH);

    // Flechas laterales en horizontal (en vertical van junto al progreso).
    if (!portrait) {
      root.add(this.drawArrow(this.cardX - cardW / 2 - 44, this.cardY, -1));
      root.add(this.drawArrow(this.cardX + cardW / 2 + 44, this.cardY, 1));
    }

    this.mostrarCarta(0);
  }

  drawCuaderno(W, H) {
    const g = this.add.graphics();
    g.fillStyle(hex(PAPEL), 1).fillRect(0, 0, W, H);
    g.lineStyle(1, hex(RAYA), 1);
    for (let y = 70; y < H; y += 28) g.lineBetween(0, y, W, y);
    g.lineStyle(2, hex('#f2b8b8'), 0.9).lineBetween(46, 0, 46, H);
    // Perforaciones del cuaderno
    g.fillStyle(hex(RAYA), 1);
    for (let y = 90; y < H; y += 90) g.fillCircle(22, y, 5);
    // Fondo interactivo: evita que los toques lleguen a la escena de abajo.
    const bloqueo = this.add.rectangle(W / 2, H / 2, W, H, 0, 0).setInteractive();
    return [g, bloqueo];
  }

  drawTabs(W, y, h, safe) {
    const c = this.add.container(0, 0);
    const n = LIBRARY_TABS.length;
    const gap = 6;
    const availW = W - safe.left - safe.right;
    const tabW = Math.min(130, (availW - gap * (n - 1)) / n);
    const totalW = tabW * n + gap * (n - 1);
    const x0 = W / 2 - totalW / 2 + tabW / 2;
    const compacto = tabW < 112;
    LIBRARY_TABS.forEach((tab, i) => {
      const activo = i === this.tabIdx;
      const tc = this.add.container(x0 + i * (tabW + gap), y + h / 2);
      const g = this.add.graphics();
      if (activo) {
        g.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(-tabW / 2, -h / 2, tabW, h + 6, { tl: 12, tr: 12, bl: 0, br: 0 });
        g.lineStyle(3, hex(PALETTE.marino), 1).strokeRoundedRect(-tabW / 2, -h / 2, tabW, h + 6, { tl: 12, tr: 12, bl: 0, br: 0 });
      } else {
        g.fillStyle(hex(PALETTE.marino), 0.85).fillRoundedRect(-tabW / 2, -h / 2 + 4, tabW, h - 4, { tl: 12, tr: 12, bl: 0, br: 0 });
      }
      const color = activo ? PALETTE.marino : PALETTE.blanco;
      const label = this.add.text(0, 0, t(`lib.tab.${tab.id}`), {
        fontFamily: FONT, fontSize: compacto ? 11 : 14, fontStyle: 'bold', color,
      }).setOrigin(0.5);
      const icon = this.drawTabIcon(tab.icono, color);
      if (compacto) { icon.setPosition(0, -11); label.setPosition(0, 12); }
      else {
        const total = 22 + 6 + label.width;
        icon.setPosition(-total / 2 + 11, 0); label.setPosition(-total / 2 + 28 + label.width / 2, 0);
      }
      // Etiqueta muy larga en pestaña estrecha: la reducimos.
      if (label.width > tabW - 8) label.setScale((tabW - 8) / label.width);
      tc.add([g, icon, label]);
      tc.setSize(...touchSize(tabW, h)).setInteractive({ useHandCursor: true })
        .on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); this.irPestana(i); });
      c.add(tc);
    });
    return c;
  }

  /** Ícono pequeño (≈20 px) de una pestaña, dibujado. */
  drawTabIcon(kind, color) {
    const c = this.add.container(0, 0);
    const texKey = `tab_${kind === 'mosquito' ? 'mosquito' : kind}`;
    if (this.textures.exists(texKey)) {
      const img = this.add.image(0, 0, texKey);
      img.setScale(22 / Math.max(img.width, img.height));
      img.setTint(hex(color)); // el ícono es blanco: se tiñe de marino en la pestaña activa
      c.add(img);
      return c;
    }
    const g = this.add.graphics();
    const col = hex(color);
    switch (kind) {
      case 'mosquito':
        g.fillStyle(col, 0.5).fillEllipse(-5, -3, 12, 6).fillEllipse(5, -3, 12, 6);
        g.fillStyle(col, 1).fillEllipse(0, 2, 6, 14).fillCircle(0, -6, 3);
        g.lineStyle(1.5, col, 1);
        for (const s of [-1, 1]) { g.lineBetween(0, 0, s * 9, -4); g.lineBetween(0, 3, s * 9, 4); g.lineBetween(0, 6, s * 8, 10); }
        break;
      case 'ciclo':
        g.lineStyle(3, col, 1).strokeCircle(0, 0, 8);
        g.fillStyle(col, 1).fillTriangle(8, -6, 13, 1, 4, 1);
        break;
      case 'sintomas':
        g.lineStyle(2.5, col, 1).strokeRoundedRect(-3, -10, 6, 15, 3);
        g.fillStyle(col, 1).fillCircle(0, 7, 4).fillRect(-1, -6, 2, 12);
        break;
      case 'prevencion':
        g.fillStyle(col, 1).fillPoints([{ x: 0, y: -10 }, { x: 9, y: -6 }, { x: 8, y: 3 }, { x: 0, y: 10 }, { x: -8, y: 3 }, { x: -9, y: -6 }], true);
        g.lineStyle(2, hex(color === PALETTE.blanco ? PALETTE.marino : PALETTE.blanco), 1).lineBetween(-4, 0, -1, 3).lineBetween(-1, 3, 5, -4);
        break;
      default:
        c.add(this.add.text(0, 0, '?', { fontFamily: FONT, fontSize: 22, fontStyle: 'bold', color }).setOrigin(0.5));
    }
    c.add(g);
    return c;
  }

  drawArrow(x, y, dir, w = 48, h = 64) {
    return makeButton(this, {
      x, y, w, h, label: dir < 0 ? '◀' : '▶', fontSize: 22, radius: 14,
      color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro, onClick: () => this.mover(dir),
    });
  }

  drawFooter(W, top, h, portrait) {
    const c = this.add.container(0, 0);
    const cx = W / 2;
    // Progreso "n/total" + puntos
    const progY = top + 20;
    this.progText = this.add.text(cx, progY, '', {
      fontFamily: FONT, fontSize: 16, fontStyle: 'bold', color: PALETTE.marino,
    }).setOrigin(0.5);
    this.dots = this.add.graphics();
    c.add([this.dots, this.progText]);
    if (portrait) {
      c.add(this.drawArrow(cx - 120, progY + 8, -1, 56, 44));
      c.add(this.drawArrow(cx + 120, progY + 8, 1, 56, 44));
    }

    // Reportes enviados a SEDES (cámara IA): contador acumulado de la sesión, en su propia
    // fila bajo el progreso/flechas (el pie tiene FOOT_H extra para esto).
    this.reportesText = this.add.text(cx, progY + (portrait ? 40 : 26), '', {
      fontFamily: FONT, fontSize: 12, fontStyle: 'bold', color: PALETTE.verdeOscuro,
    }).setOrigin(0.5);
    c.add(this.reportesText);
    this.actualizarReportes();

    // Insignias
    const badgeY = top + h - 30;
    const r = 19;
    const gap = portrait ? 56 : Math.min(200, (W - 60) / INSIGNIAS.length);
    const conEtiqueta = !portrait && gap >= 170;
    const x0 = cx - ((INSIGNIAS.length - 1) * gap) / 2;
    this.badgeIcons = {};
    INSIGNIAS.forEach((def, i) => {
      const ganada = Badges.tiene(def.id);
      const b = this.drawBadge(def, r, ganada).setPosition(x0 + i * gap, badgeY);
      this.badgeIcons[def.id] = b;
      c.add(b);
      if (conEtiqueta) {
        c.add(this.add.text(x0 + i * gap + r + 6, badgeY, t(`lib.insignia.${def.id}`), {
          fontFamily: FONT, fontSize: 12, fontStyle: 'bold', color: ganada ? PALETTE.marino : PALETTE.grisClaro,
        }).setOrigin(0, 0.5));
      }
    });
    this.infoText = this.add.text(cx, badgeY - r - 8, '', {
      fontFamily: FONT, fontSize: 12, color: PALETTE.gris,
    }).setOrigin(0.5);
    c.add(this.infoText);
    this.infoInsignia(null);
    return c;
  }

  /** Muestra en el pie el nombre/descripción de una insignia (o el estado general). */
  infoInsignia(def) {
    if (!this.infoText?.active) return;
    if (def) {
      const g = Badges.tiene(def.id);
      this.infoText.setText(`${t(`lib.insignia.${def.id}`)}: ${t(`lib.insignia.${def.id}.desc`)}${g ? ' ✓' : ''}`)
        .setColor(g ? PALETTE.verdeOscuro : PALETTE.gris);
    } else {
      const bonus = Badges.bonusPendiente();
      this.infoText.setText(bonus ? t('lib.bonus') : `${t('lib.insignias')} · ${Badges.lista().length}/${INSIGNIAS.length}`)
        .setColor(bonus ? PALETTE.verdeOscuro : PALETTE.gris);
    }
  }

  drawBadge(def, r, ganada) {
    const c = this.add.container(0, 0);
    c.setSize(...touchSize(r * 2, r * 2)).setInteractive({ useHandCursor: true })
      .on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); this.infoInsignia(def); });
    if (this.textures.exists(def.icono)) {
      const key = !ganada && this.textures.exists('insignia_bloqueada') ? 'insignia_bloqueada' : def.icono;
      const img = this.add.image(0, 0, key);
      img.setScale((r * 2) / Math.max(img.width, img.height));
      if (!ganada && key === def.icono) img.setTint(0x9a9a9a).setAlpha(0.55);
      c.add(img);
      return c;
    }
    const g = this.add.graphics();
    if (ganada) {
      g.fillStyle(hex(PALETTE.linea), 0.2).fillCircle(2, 3, r);
      g.fillStyle(hex(def.color), 1).fillCircle(0, 0, r);
      g.lineStyle(3, hex(PALETTE.blanco), 1).strokeCircle(0, 0, r - 3);
    } else {
      g.fillStyle(hex('#dfe4e8'), 1).fillCircle(0, 0, r);
      g.lineStyle(2, hex(PALETTE.grisClaro), 0.8).strokeCircle(0, 0, r - 3);
    }
    c.add(g);
    c.add(this.add.text(0, 0, def.glifo, {
      fontFamily: FONT, fontSize: r, fontStyle: 'bold', color: ganada ? PALETTE.blanco : PALETTE.grisClaro,
      stroke: ganada ? PALETTE.linea : undefined, strokeThickness: ganada ? 3 : 0,
    }).setOrigin(0.5));
    return c;
  }

  /** Refresca el contador de reportes a SEDES (0 si aún no se identificó ninguna especie). */
  actualizarReportes() {
    if (!this.reportesText?.active) return;
    const n = this.registry.get('reportesEnviados') || 0;
    this.reportesText.setText(t('lib.reportes', { n }));
  }

  actualizarProgreso() {
    if (!this.progText?.active) return;
    const ids = this.tab.tarjetas.map((k) => k.id);
    const leidas = ids.filter((id) => Badges.tarjetasLeidas.has(id)).length;
    this.progText.setText(t('lib.progreso', { n: leidas, total: ids.length }));
    const g = this.dots;
    g.clear();
    const gap = 16, x0 = this.progText.x - ((ids.length - 1) * gap) / 2, y = this.progText.y + 18;
    ids.forEach((id, i) => {
      const cur = i === this.cardIdx[this.tabIdx];
      if (Badges.tarjetasLeidas.has(id)) g.fillStyle(hex(PALETTE.verde), 1).fillCircle(x0 + i * gap, y, cur ? 6 : 4);
      else g.fillStyle(hex('#c9d3dc'), 1).fillCircle(x0 + i * gap, y, cur ? 6 : 4);
      if (cur) g.lineStyle(2, hex(PALETTE.marino), 1).strokeCircle(x0 + i * gap, y, 7);
    });
  }

  // ───────────────────────────── navegación ─────────────────────────────

  irPestana(i) {
    if (this.busy || i === this.tabIdx) return;
    sfx(this, 'click');
    const dir = i > this.tabIdx ? 1 : -1;
    this.tabIdx = i;
    this.layout(this.scale.width, this.scale.height); // redibuja pestañas; muestra sin animación
    this.card.x = this.cardX + dir * 40; this.card.alpha = 0;
    this.tweens.add({ targets: this.card, x: this.cardX, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
  }

  /** Avanza (dir=1) o retrocede (dir=-1); al borde de la pestaña pasa a la siguiente/anterior. */
  mover(dir) {
    if (this.busy) return;
    const n = this.tab.tarjetas.length;
    let ci = this.cardIdx[this.tabIdx] + dir;
    if (ci < 0 || ci >= n) {
      const ti = this.tabIdx + dir;
      if (ti < 0 || ti >= LIBRARY_TABS.length) { // rebote en el extremo
        this.tweens.add({ targets: this.card, x: this.cardX - dir * 24, duration: 90, yoyo: true, ease: 'Sine.easeInOut' });
        return;
      }
      this.tabIdx = ti;
      this.cardIdx[ti] = dir > 0 ? 0 : LIBRARY_TABS[ti].tarjetas.length - 1;
      sfx(this, 'click');
      this.layout(this.scale.width, this.scale.height);
      this.card.x = this.cardX + dir * this.scale.width * 0.6;
      this.busy = true;
      this.tweens.add({ targets: this.card, x: this.cardX, duration: 260, ease: 'Cubic.easeOut', onComplete: () => { this.busy = false; } });
      return;
    }
    this.cardIdx[this.tabIdx] = ci;
    sfx(this, 'click');
    this.mostrarCarta(dir);
  }

  /** Construye y muestra la tarjeta actual; dir 0 = sin animación, ±1 = desliza. */
  mostrarCarta(dir) {
    const W = this.scale.width;
    const vieja = this.card;
    this.mitoLado = 'mito';
    const carta = this.carta;
    const nueva = this.construirCarta(carta, this.cardW, this.cardH).setPosition(this.cardX, this.cardY).setDepth(10);
    this.card = nueva;
    if (carta.tipo !== 'mito') this.registrarLectura(carta.id);
    this.actualizarProgreso();
    if (!dir || !vieja) { vieja?.destroy(); return; }
    this.busy = true;
    nueva.x = this.cardX + dir * W * 0.7;
    nueva.angle = dir * 4;
    this.tweens.add({ targets: vieja, x: this.cardX - dir * W * 0.7, angle: -dir * 4, alpha: 0.6, duration: 260, ease: 'Cubic.easeIn', onComplete: () => vieja.destroy() });
    this.tweens.add({ targets: nueva, x: this.cardX, angle: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => { this.busy = false; } });
  }

  /** Voltea la tarjeta de mito (scaleX 1→0→1 cambiando el contenido). */
  voltear() {
    const carta = this.carta;
    if (this.busy || !this.card || carta.tipo !== 'mito') return;
    this.busy = true;
    sfx(this, 'click');
    this.tweens.add({
      targets: this.card, scaleX: 0, duration: 150, ease: 'Sine.easeIn',
      onComplete: () => {
        this.mitoLado = this.mitoLado === 'mito' ? 'verdad' : 'mito';
        this.card.removeAll(true);
        this.llenarMito(this.card, carta, this.cardW, this.cardH, this.mitoLado);
        this.tweens.add({
          targets: this.card, scaleX: 1, duration: 170, ease: 'Sine.easeOut',
          onComplete: () => {
            this.busy = false;
            if (this.mitoLado === 'verdad' && !Badges.tarjetasLeidas.has(carta.id)) {
              this.registrarLectura(carta.id); this.actualizarProgreso();
              const sello = this.selloLeida(this.cardW, this.cardH, Phaser.Math.Clamp(this.cardW / 520, 0.8, 1.05)).setScale(0);
              this.card.add(sello);
              this.tweens.add({ targets: sello, scale: 1, duration: 250, ease: 'Back.easeOut' });
            }
          },
        });
      },
    });
  }

  registrarLectura(id) {
    const { ganadas } = Badges.marcarLeida(id);
    this.infoInsignia(null);
    if (ganadas.length) this.celebrar(ganadas);
  }

  /** Animación al ganar insignias: pop del ícono, sonido 'points' y aviso arriba. */
  celebrar(ids) {
    ids.forEach((id, i) => {
      this.time.delayedCall(i * 900, () => {
        if (!this.scene.isActive()) return;
        sfx(this, 'points');
        this.game.events.emit('insignia', id);
        const def = INSIGNIAS.find((b) => b.id === id);
        const viejo = this.badgeIcons?.[id];
        if (viejo?.active) {
          const nuevo = this.drawBadge(def, 19, true).setPosition(viejo.x, viejo.y);
          viejo.parentContainer?.add(nuevo);
          viejo.destroy();
          this.badgeIcons[id] = nuevo;
          nuevo.setScale(0);
          this.tweens.add({ targets: nuevo, scale: 1.5, duration: 260, ease: 'Back.easeOut', yoyo: true, hold: 120, onComplete: () => nuevo.setScale(1) });
          this.infoInsignia(def);
        }
        this.mostrarToast(`${t('lib.insigniaGanada')} ${t(`lib.insignia.${id}`)}`, def.color);
      });
    });
  }

  mostrarToast(texto, color) {
    this.toast?.destroy();
    const W = this.scale.width;
    const tc = this.add.container(W / 2, 140).setDepth(50);
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
    this.tweens.add({ targets: tc, alpha: 0, y: 110, delay: 1900, duration: 300, onComplete: () => { if (this.toast === tc) this.toast = null; tc.destroy(); } });
  }

  cerrar() {
    if (this.cerrando) return;
    this.cerrando = true;
    sfx(this, 'click');
    this.game.events.emit('library:cerrar');
    if (this.desde === 'estacion') this.scene.get('Game')?.events.emit('library:cerrar');
    this.scene.stop();
  }

  // ───────────────────────────── tarjetas ─────────────────────────────

  /** Base blanca con borde marino y sombra. */
  dibujarBase(g, cw, ch, borde = PALETTE.marino) {
    g.fillStyle(hex(PALETTE.linea), 0.22).fillRoundedRect(-cw / 2 + 5, -ch / 2 + 7, cw, ch, CARD_R);
    g.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, CARD_R);
    g.lineStyle(4, hex(borde), 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, CARD_R);
  }

  construirCarta(carta, cw, ch) {
    const c = this.add.container(0, 0);
    if (carta.tipo === 'mito') { this.llenarMito(c, carta, cw, ch, 'mito'); return c; }

    const g = this.add.graphics();
    this.dibujarBase(g, cw, ch);
    c.add(g);
    const k = Phaser.Math.Clamp(cw / 520, 0.8, 1.05);
    const fs = (b) => Math.round(b * k);
    const pad = 20, innerW = cw - pad * 2, x0 = -cw / 2 + pad;

    // 1) Cuerpo apilado (se mide primero para repartir el alto con la ilustración).
    const body = this.add.container(0, 0);
    let y = 0;
    const add = (obj, gapAfter = 6) => { body.add(obj); y += obj.height * (obj.scaleY || 1) + gapAfter; return obj; };
    add(this.add.text(x0, y, tx(carta.titulo), { fontFamily: FONT, fontSize: fs(24), fontStyle: 'bold', color: PALETTE.azulGorra, wordWrap: { width: innerW } }), 2);
    const sub = [tx(carta.subtitulo), carta.cientifico].filter(Boolean).join(' · ');
    if (sub) add(this.add.text(x0, y, sub, { fontFamily: FONT, fontSize: fs(15), fontStyle: 'italic', color: PALETTE.gris, wordWrap: { width: innerW } }), 8);
    const chips = txList(carta.chips);
    if (chips.length) {
      if (carta.tipo === 'especie') add(this.add.text(x0, y, t('lib.reconocelo').toUpperCase(), { fontFamily: FONT, fontSize: fs(12), fontStyle: 'bold', color: PALETTE.marino }), 4);
      add(this.chips(chips, innerW, fs(13), carta.color).setPosition(x0, y), 8);
    }
    for (const l of carta.lineas || []) {
      const et = this.add.text(x0, y, `${tx(l.etiqueta)}:`, { fontFamily: FONT, fontSize: fs(14), fontStyle: 'bold', color: PALETTE.marino });
      const val = this.add.text(x0 + et.width + 6, y, tx(l.valor), { fontFamily: FONT, fontSize: fs(14), color: PALETTE.gris, wordWrap: { width: innerW - et.width - 6 } });
      body.add(et); add(val, 4);
    }
    if (carta.texto) add(this.add.text(x0, y, tx(carta.texto), { fontFamily: FONT, fontSize: fs(15), color: PALETTE.gris, wordWrap: { width: innerW }, lineSpacing: 2 }), 8);
    const caja = carta.dato ? { etiqueta: t('lib.dato'), texto: tx(carta.dato), color: PALETTE.amarillo, borde: PALETTE.teja }
      : carta.corte ? { etiqueta: t('lib.corte'), texto: tx(carta.corte), color: '#dff5d0', borde: PALETTE.verdeOscuro } : null;
    if (caja) add(this.cajaDato(caja, innerW, fs).setPosition(x0, y), 0);

    // 2) Ilustración: ocupa el alto que el cuerpo deja libre (entre 26 % y 48 % de la tarjeta).
    const bodyH = y;
    let illH = Math.round(Phaser.Math.Clamp(ch - bodyH - 28, ch * 0.26, ch * 0.48));
    g.fillStyle(hex(carta.color || PALETTE.celeste), 0.14).fillRoundedRect(-cw / 2 + 3, -ch / 2 + 3, cw - 6, illH, { tl: 15, tr: 15, bl: 0, br: 0 });
    g.lineStyle(2, hex(carta.color || PALETTE.celeste), 0.35).lineBetween(-cw / 2 + 3, -ch / 2 + 3 + illH, cw / 2 - 3, -ch / 2 + 3 + illH);
    c.add(this.ilustracion(carta, innerW, illH - 16).setPosition(0, -ch / 2 + 3 + illH / 2));
    if (Badges.tarjetasLeidas.has(carta.id)) c.add(this.selloLeida(cw, ch, k));

    // 3) Colocar el cuerpo; si aun así no entra, se reduce a escala (alrededor del centro-superior).
    const bodyTop = -ch / 2 + illH + 14;
    body.setPosition(0, bodyTop);
    const avail = ch / 2 - 14 - bodyTop;
    if (bodyH > avail) body.setScale(avail / bodyH);
    c.add(body);
    return c;
  }

  selloLeida(cw, ch, k) {
    const c = this.add.container(cw / 2 - 30, -ch / 2 + 22).setAngle(12);
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.verde), 1).fillRoundedRect(-30, -11, 60, 22, 8);
    c.add([g, this.add.text(0, 0, `✓ ${t('lib.leida')}`, { fontFamily: FONT, fontSize: Math.round(11 * k), fontStyle: 'bold', color: PALETTE.blanco }).setOrigin(0.5)]);
    return c;
  }

  /** Chips de "reconócelo": píldoras que fluyen en varias filas. Devuelve un Container con .height. */
  chips(items, maxW, fontSize, color = PALETTE.marino) {
    const c = this.add.container(0, 0);
    let x = 0, y = 0, rowH = 0;
    const gap = 6;
    for (const it of items) {
      const txt = this.add.text(0, 0, it, { fontFamily: FONT, fontSize, fontStyle: 'bold', color: PALETTE.blanco, wordWrap: { width: maxW - 24 } });
      const w = txt.width + 20, h = txt.height + 10;
      if (x + w > maxW && x > 0) { x = 0; y += rowH + gap; rowH = 0; }
      const g = this.add.graphics();
      g.fillStyle(hex(color || PALETTE.marino), 1).fillRoundedRect(x, y, w, h, h / 2);
      g.lineStyle(2, hex(PALETTE.blanco), 0.35).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, h / 2);
      txt.setPosition(x + 10, y + 5);
      c.add([g, txt]);
      x += w + gap; rowH = Math.max(rowH, h);
    }
    c.height = y + rowH;
    c.width = maxW;
    return c;
  }

  cajaDato({ etiqueta, texto, color, borde }, w, fs) {
    const c = this.add.container(0, 0);
    const et = this.add.text(12, 8, etiqueta.toUpperCase(), { fontFamily: FONT, fontSize: fs(11), fontStyle: 'bold', color: borde });
    const tx1 = this.add.text(12, 8 + et.height + 2, texto, { fontFamily: FONT, fontSize: fs(14), color: PALETTE.marino, wordWrap: { width: w - 24 } });
    const h = tx1.y + tx1.height + 10;
    const g = this.add.graphics();
    g.fillStyle(hex(color), 1).fillRoundedRect(0, 0, w, h, 10);
    g.lineStyle(2, hex(borde), 0.8).strokeRoundedRect(0, 0, w, h, 10);
    c.add([g, et, tx1]);
    c.height = h; c.width = w;
    return c;
  }

  /** Frente (rojo, MITO) o dorso (verde, VERDAD) de una tarjeta de mitos. */
  llenarMito(c, carta, cw, ch, lado) {
    const verdad = lado === 'verdad';
    const colA = verdad ? PALETTE.verde : ROJO, colB = verdad ? PALETTE.verdeOscuro : ROJO_OSCURO;
    const k = Phaser.Math.Clamp(cw / 520, 0.8, 1.05);
    const g = this.add.graphics();
    this.dibujarBase(g, cw, ch, colB);
    const STRIP = 58;
    g.fillStyle(hex(colA), 1).fillRoundedRect(-cw / 2, -ch / 2, cw, STRIP, { tl: CARD_R, tr: CARD_R, bl: 0, br: 0 });
    g.fillStyle(hex(colA), 0.08).fillRoundedRect(-cw / 2 + 4, -ch / 2 + STRIP, cw - 8, ch - STRIP - 4, { tl: 0, tr: 0, bl: CARD_R, br: CARD_R });
    c.add(g);
    c.add(this.add.text(0, -ch / 2 + STRIP / 2, t(verdad ? 'lib.verdad' : 'lib.mito'), {
      fontFamily: FONT, fontSize: Math.round(28 * k), fontStyle: 'bold', color: PALETTE.blanco, stroke: colB, strokeThickness: 5, letterSpacing: 4,
    }).setOrigin(0.5));
    // Símbolo grande
    const r = Math.round(44 * k);
    const texto = this.add.text(0, 0, tx(verdad ? carta.verdad : carta.mito), {
      fontFamily: FONT, fontSize: Math.round(20 * k), fontStyle: verdad ? 'normal' : 'italic', color: PALETTE.marino,
      align: 'center', wordWrap: { width: cw - 56 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);
    // Símbolo + texto centrados verticalmente en el espacio bajo la franja.
    const zonaTop = -ch / 2 + STRIP + 16, zonaBot = ch / 2 - 44;
    const maxH = zonaBot - zonaTop - r * 2 - 24;
    if (texto.height > maxH) texto.setScale(maxH / texto.height);
    const bloqueH = r * 2 + 24 + texto.height * texto.scaleY;
    const symY = zonaTop + (zonaBot - zonaTop - bloqueH) / 2 + r;
    texto.setY(symY + r + 24);
    g.fillStyle(hex(colA), 1).fillCircle(0, symY, r);
    g.lineStyle(5, hex(PALETTE.blanco), 1).strokeCircle(0, symY, r - 5);
    c.add(this.add.text(0, symY, verdad ? '✓' : '?', {
      fontFamily: FONT, fontSize: Math.round(r * 1.3), fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5));
    c.add(texto);
    const hint = this.add.text(0, ch / 2 - 24, `↻ ${t('lib.voltear')}`, {
      fontFamily: FONT, fontSize: Math.round(13 * k), color: colB, fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
    if (Badges.tarjetasLeidas.has(carta.id)) c.add(this.selloLeida(cw, ch, k));
  }

  // ───────────────────────────── ilustraciones ─────────────────────────────

  /**
   * Ficha de especie con 1-2 fotos reales (ángulos distintos, ver `species.js` → `fotos`):
   * imagen + rótulo del ángulo + flechas para alternar si hay más de una (persiste en
   * `this.fotoIdx` por id de tarjeta). Si la textura no cargó, cae al dibujo de `dibujarMosquito`.
   */
  ilustracionEspecie(carta, w, h) {
    const fotos = carta.fotos;
    const idx = Phaser.Math.Wrap(this.fotoIdx[carta.id] || 0, 0, fotos.length);
    this.fotoIdx[carta.id] = idx;
    const foto = fotos[idx];
    const c = this.add.container(0, 0);
    const labelH = 24;
    const imgH = h - labelH;
    if (foto.key && this.textures.exists(foto.key)) {
      const img = this.add.image(0, -labelH / 2, foto.key);
      img.setScale(Math.min((w * 0.82) / img.width, (imgH * 0.94) / img.height));
      c.add(img);
    } else {
      const g = this.add.graphics();
      c.add(g);
      const s = Math.min(w / 220, imgH / 120);
      const id = carta.id.replace('esp_', '');
      this.dibujarMosquito(g, hex(carta.color || PALETTE.marino), {
        rayas: id === 'aegypti' || id === 'albopictus', lira: id === 'aegypti', linea: id === 'albopictus',
        inclinado: id === 'anopheles', manchas: id === 'anopheles',
      }, s * 1.1, 0, -labelH / 2);
    }
    const labelY = h / 2 - labelH / 2 + 3;
    c.add(this.add.text(0, labelY, tx(foto.angulo), {
      fontFamily: FONT, fontSize: 12, fontStyle: 'bold', color: PALETTE.marino,
    }).setOrigin(0.5));
    if (fotos.length > 1) {
      const bx = Math.min(w / 2 - 16, 76);
      c.add(makeButton(this, {
        x: -bx, y: labelY, w: 26, h: 26, label: '◀', fontSize: 13, radius: 8,
        color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro,
        onClick: () => this.cambiarFoto(carta.id, -1, fotos.length),
      }));
      c.add(makeButton(this, {
        x: bx, y: labelY, w: 26, h: 26, label: '▶', fontSize: 13, radius: 8,
        color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro,
        onClick: () => this.cambiarFoto(carta.id, 1, fotos.length),
      }));
      const dotsY = labelY - 18, dotsW = (fotos.length - 1) * 10;
      for (let i = 0; i < fotos.length; i++) {
        c.add(this.add.circle(-dotsW / 2 + i * 10, dotsY, 3, hex(i === idx ? PALETTE.azulGorra : PALETTE.grisClaro), 1));
      }
    }
    return c;
  }

  /** Cambia la foto activa de una ficha de especie (dir ±1, envuelve) y redibuja la tarjeta. */
  cambiarFoto(id, dir, total) {
    if (this.busy) return;
    sfx(this, 'click');
    this.fotoIdx[id] = Phaser.Math.Wrap((this.fotoIdx[id] || 0) + dir, 0, total);
    this.mostrarCarta(0);
  }

  /** Imagen de la textura si existe; si no, un dibujo según `icono`. Ajustada a w×h. */
  ilustracion(carta, w, h) {
    if (carta.tipo === 'especie' && carta.fotos?.length) return this.ilustracionEspecie(carta, w, h);
    const key = carta.icono;
    if (key && this.textures.exists(key)) {
      const img = this.add.image(0, 0, key);
      img.setScale(Math.min((w * 0.8) / img.width, (h * 0.9) / img.height));
      return img;
    }
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    c.add(g);
    const s = Math.min(w / 220, h / 120);
    const col = hex(carta.color || PALETTE.marino);
    if (carta.tipo === 'especie') {
      const id = carta.id.replace('esp_', '');
      this.dibujarMosquito(g, col, { rayas: id === 'aegypti' || id === 'albopictus', lira: id === 'aegypti', linea: id === 'albopictus', inclinado: id === 'anopheles', manchas: id === 'anopheles' }, s * 1.1);
    } else if (key === 'ciclo_huevo') {
      g.fillStyle(hex(PALETTE.aguaSucia), 0.5).fillRect(-90 * s, 10 * s, 180 * s, 40 * s);
      g.lineStyle(6 * s, hex(PALETTE.grisClaro), 1).lineBetween(-90 * s, -50 * s, -90 * s, 50 * s).lineBetween(90 * s, -50 * s, 90 * s, 50 * s).lineBetween(-90 * s, 50 * s, 90 * s, 50 * s);
      g.fillStyle(hex(PALETTE.linea), 1);
      for (let i = 0; i < 7; i++) g.fillEllipse(-75 * s + i * 8 * s, -2 * s - (i % 2) * 6 * s, 5 * s, 9 * s);
      for (let i = 0; i < 6; i++) g.fillEllipse(35 * s + i * 8 * s, -4 * s - (i % 2) * 5 * s, 5 * s, 9 * s);
      this.dibujarMosquito(g, hex(PALETTE.marino), { rayas: true, lira: true }, s * 0.45, 0, -30 * s);
    } else if (key === 'ciclo_larva') {
      g.fillStyle(hex(PALETTE.aguaSucia), 0.35).fillRoundedRect(-100 * s, -50 * s, 200 * s, 100 * s, 12 * s);
      g.lineStyle(9 * s, hex(PALETTE.oliva), 1);
      const pts = [];
      for (let i = 0; i <= 20; i++) pts.push({ x: -60 * s + i * 6 * s, y: Math.sin(i * 0.6) * 12 * s });
      g.strokePoints(pts);
      g.lineStyle(4 * s, hex(PALETTE.linea), 1);
      for (let i = 1; i < 20; i += 2) g.lineBetween(-60 * s + i * 6 * s, Math.sin(i * 0.6) * 12 * s - 5 * s, -60 * s + i * 6 * s, Math.sin(i * 0.6) * 12 * s + 5 * s);
      g.fillStyle(hex(PALETTE.linea), 1).fillCircle(-62 * s, 0, 8 * s);
      g.lineStyle(4 * s, hex(PALETTE.oliva), 1).lineBetween(60 * s, Math.sin(12) * 12 * s, 78 * s, -48 * s);
    } else if (key === 'ciclo_pupa') {
      g.fillStyle(hex(PALETTE.aguaSucia), 0.35).fillRoundedRect(-100 * s, -50 * s, 200 * s, 100 * s, 12 * s);
      g.fillStyle(hex('#8a6d3b'), 1).fillCircle(-10 * s, -12 * s, 26 * s);
      g.lineStyle(12 * s, hex('#8a6d3b'), 1);
      g.strokePoints([{ x: 10 * s, y: 5 * s }, { x: 22 * s, y: 22 * s }, { x: 20 * s, y: 40 * s }, { x: 6 * s, y: 44 * s }]);
      g.fillStyle(hex(PALETTE.linea), 1).fillCircle(-20 * s, -18 * s, 4 * s);
      g.lineStyle(3 * s, hex(PALETTE.linea), 1).lineBetween(-4 * s, -36 * s, 0, -48 * s).lineBetween(2 * s, -36 * s, 8 * s, -48 * s);
    } else if (key === 'ciclo_adulto') {
      this.dibujarMosquito(g, hex(PALETTE.marino), { rayas: true, lira: true }, s * 1.1);
    } else if (key === 'termometro') {
      g.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(-14 * s, -55 * s, 28 * s, 80 * s, 14 * s);
      g.lineStyle(4 * s, hex(PALETTE.marino), 1).strokeRoundedRect(-14 * s, -55 * s, 28 * s, 80 * s, 14 * s);
      g.fillStyle(hex(ROJO), 1).fillCircle(0, 36 * s, 22 * s).fillRect(-6 * s, -30 * s, 12 * s, 66 * s);
      g.lineStyle(4 * s, hex(PALETTE.marino), 1).strokeCircle(0, 36 * s, 22 * s);
      for (let i = 0; i < 5; i++) g.lineBetween(16 * s, -45 * s + i * 14 * s, 26 * s, -45 * s + i * 14 * s);
    } else if (key === 'alerta') {
      g.fillStyle(hex(PALETTE.amarillo), 1).fillTriangle(0, -55 * s, 62 * s, 50 * s, -62 * s, 50 * s);
      g.lineStyle(5 * s, hex(PALETTE.linea), 1).strokeTriangle(0, -55 * s, 62 * s, 50 * s, -62 * s, 50 * s);
      c.add(this.add.text(0, 6 * s, '!', { fontFamily: FONT, fontSize: Math.round(70 * s), fontStyle: 'bold', color: PALETTE.linea }).setOrigin(0.5));
    } else if (key === 'cruz') {
      g.fillStyle(hex(PALETTE.verde), 1).fillCircle(0, 0, 54 * s);
      g.lineStyle(5 * s, hex(PALETTE.verdeOscuro), 1).strokeCircle(0, 0, 54 * s);
      g.fillStyle(hex(PALETTE.blanco), 1).fillRect(-11 * s, -34 * s, 22 * s, 68 * s).fillRect(-34 * s, -11 * s, 68 * s, 22 * s);
    } else if (key === 'basura') {
      g.fillStyle(hex(PALETTE.gris), 1).fillRoundedRect(-36 * s, -30 * s, 72 * s, 80 * s, 6 * s);
      g.fillStyle(hex(PALETTE.marino), 1).fillRoundedRect(-44 * s, -44 * s, 88 * s, 14 * s, 4 * s).fillRect(-12 * s, -52 * s, 24 * s, 8 * s);
      g.lineStyle(4 * s, hex(PALETTE.grisClaro), 1);
      for (const x of [-18, 0, 18]) g.lineBetween(x * s, -18 * s, x * s, 38 * s);
      g.fillStyle(hex(PALETTE.aguaSucia), 1).fillRoundedRect(46 * s, -10 * s, 24 * s, 50 * s, 6 * s); // botella
      g.fillStyle(hex(PALETTE.linea), 1).fillCircle(-62 * s, 30 * s, 22 * s); g.fillStyle(hex(PALETTE.gris), 1).fillCircle(-62 * s, 30 * s, 10 * s); // llanta
    } else if (key === 'escudo') {
      const p = [{ x: 0, y: -58 }, { x: 52, y: -40 }, { x: 46, y: 16 }, { x: 0, y: 56 }, { x: -46, y: 16 }, { x: -52, y: -40 }].map((q) => ({ x: q.x * s, y: q.y * s }));
      g.fillStyle(hex(PALETTE.azulGorra), 1).fillPoints(p, true);
      g.lineStyle(5 * s, hex(PALETTE.azulGorraOscuro), 1).strokePoints(p, true);
      g.lineStyle(10 * s, hex(PALETTE.blanco), 1).strokePoints([{ x: -24 * s, y: -2 * s }, { x: -6 * s, y: 18 * s }, { x: 28 * s, y: -24 * s }]);
    } else {
      g.fillStyle(col, 0.3).fillCircle(0, 0, 50 * s);
    }
    return c;
  }

  /** Mosquito dibujado (fallback de las fichas). `s` escala; opciones de rayas/lira/línea/inclinado. */
  dibujarMosquito(g, col, o = {}, s = 1, ox = 0, oy = 0) {
    g.save();
    g.translateCanvas(ox, oy);
    if (o.inclinado) g.rotateCanvas(-0.5);
    // Patas
    g.lineStyle(3 * s, hex(PALETTE.linea), 1);
    for (const d of [-1, 1]) {
      g.strokePoints([{ x: 0, y: -8 * s }, { x: d * 34 * s, y: -30 * s }, { x: d * 62 * s, y: -12 * s }]);
      g.strokePoints([{ x: 0, y: 2 * s }, { x: d * 40 * s, y: 6 * s }, { x: d * 66 * s, y: 30 * s }]);
      g.strokePoints([{ x: 0, y: 10 * s }, { x: d * 26 * s, y: 34 * s }, { x: d * 48 * s, y: 52 * s }]);
    }
    if (o.rayas) { g.lineStyle(3 * s, hex(PALETTE.blanco), 1); for (const d of [-1, 1]) { g.lineBetween(d * 17 * s, -19 * s, d * 20 * s, -17 * s); g.lineBetween(d * 48 * s, -21 * s, d * 50 * s, -18 * s); g.lineBetween(d * 20 * s, 4 * s, d * 20 * s, 8 * s); g.lineBetween(d * 53 * s, 18 * s, d * 55 * s, 22 * s); } }
    // Alas
    g.fillStyle(hex(PALETTE.blanco), 0.55).lineStyle(2 * s, hex(PALETTE.linea), 0.6);
    for (const d of [-1, 1]) {
      g.save(); g.translateCanvas(d * 34 * s, -6 * s); g.rotateCanvas(d * 0.35);
      g.fillEllipse(0, 0, 66 * s, 24 * s).strokeEllipse(0, 0, 66 * s, 24 * s);
      if (o.manchas) { g.fillStyle(hex(PALETTE.linea), 0.5); g.fillEllipse(-14 * s, 0, 10 * s, 6 * s).fillEllipse(12 * s, 2 * s, 10 * s, 6 * s); g.fillStyle(hex(PALETTE.blanco), 0.55); }
      g.restore();
    }
    // Cuerpo: tórax, abdomen, cabeza y trompa
    g.fillStyle(col, 1).fillEllipse(0, 22 * s, 22 * s, 56 * s); // abdomen
    g.fillEllipse(0, -6 * s, 26 * s, 30 * s); // tórax
    g.fillCircle(0, -28 * s, 10 * s); // cabeza
    g.lineStyle(3 * s, col, 1).lineBetween(0, -36 * s, 0, -60 * s); // trompa
    g.lineStyle(2 * s, col, 1).lineBetween(-4 * s, -34 * s, -16 * s, -50 * s).lineBetween(4 * s, -34 * s, 16 * s, -50 * s); // antenas
    if (o.rayas) { g.fillStyle(hex(PALETTE.blanco), 0.9); for (let i = 0; i < 4; i++) g.fillRect(-9 * s, (6 + i * 11) * s, 18 * s, 3 * s); }
    if (o.lira) { g.lineStyle(2 * s, hex(PALETTE.blanco), 0.9); g.strokePoints([{ x: -8 * s, y: -18 * s }, { x: -5 * s, y: -2 * s }]); g.strokePoints([{ x: 8 * s, y: -18 * s }, { x: 5 * s, y: -2 * s }]); g.lineBetween(-3 * s, -14 * s, -3 * s, 2 * s).lineBetween(3 * s, -14 * s, 3 * s, 2 * s); }
    if (o.linea) g.lineStyle(3 * s, hex(PALETTE.blanco), 1).lineBetween(0, -20 * s, 0, 6 * s);
    g.fillStyle(hex(PALETTE.blanco), 0.9).fillCircle(-4 * s, -30 * s, 2.5 * s).fillCircle(4 * s, -30 * s, 2.5 * s); // ojos
    g.restore();
  }
}
