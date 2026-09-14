import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';
import { CameraFX, mulberry } from '../systems/CameraFX.js';
import { SPECIES, speciesById, especieAleatoria } from '../data/species.js';
import { t, tx, txList } from '../i18n/index.js';

const FONT = 'Arial, sans-serif';
const ROJO = '#e74c3c';
const SNAP = 256;
const ALBUM_KEY = 'dengue.album';
const ANALISIS_MS = 2200;

/**
 * Cámara con IA (demo simulada, v3 §1.2).
 *
 *   scene.launch('Camera', { brote: Brote|null, especieId: string|null, snapshotKey: 'cam_snap'|null })
 *
 * Fases: visor → (disparo: flash + click) → análisis (~2,2 s: escáner, puntos, barra, consola)
 * → resultado (tarjeta de especie, confianza 87–98 % estable por foto, chips, recomendación).
 * Emite en 'Game': 'camera:especie' { id, confianza } al guardar en el álbum y 'camera:cerrar' al cerrar.
 * Álbum: localStorage 'dengue.album' (array JSON de ids de especie).
 * Si no existe la textura del snapshot dibuja un fondo verde con un enjambre de muestra.
 */
export class CameraScene extends Phaser.Scene {
  constructor() { super({ key: 'Camera' }); }

  init(data = {}) {
    this.brote = data.brote ?? null;
    this.especieId = data.especieId ?? this.brote?.especieId ?? null;
    this.snapKey = data.snapshotKey && this.textures.exists(data.snapshotKey) ? data.snapshotKey : null;
    this.fase = 'visor';
    this.done = false;
    this.busy = false;
    this.saved = false;
    this.especie = null;
    this.confianza = 0;
    this.seed = 1;
  }

  sfx(name) { this.game.events.emit('sfx', name); }

  create() {
    if (!this.snapKey) this.snapKey = this.crearMuestra();
    Layout.onResize(this, (w, h) => this.layout(w, h));
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-SPACE', () => { if (this.fase === 'visor') this.disparar(); });
    this.input.keyboard?.on('keydown-ENTER', () => { if (this.fase === 'visor') this.disparar(); });
  }

  // ---------------------------------------------------------------- muestra de respaldo
  /** Fondo verde con un enjambre: 'mosquitos_2' → 'mosq_<id>' → 'mosquito_grande' → dibujado. */
  crearMuestra() {
    const key = 'cam_snap_demo';
    if (this.textures.exists(key)) return key;
    const rt = this.add.renderTexture(0, 0, SNAP, SNAP).setOrigin(0).setVisible(false);
    const g = this.add.graphics().setVisible(false);
    g.fillStyle(hex(PALETTE.verde), 1).fillRect(0, 0, SNAP, SNAP);
    // Manchas de pasto
    const rnd = mulberry(42);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(hex(rnd() > 0.5 ? PALETTE.verdeOscuro : PALETTE.oliva), 0.35);
      g.fillEllipse(rnd() * SNAP, rnd() * SNAP, 20 + rnd() * 40, 8 + rnd() * 14);
    }
    rt.draw(g, 0, 0);
    const temps = [g];
    const id = this.especieId;
    const swarmKey = ['mosquitos_2', id && `mosq_${id}`, 'mosquito_grande', 'mosquito_medio']
      .find((k) => k && this.textures.exists(k));
    if (swarmKey) {
      const im = this.add.image(0, 0, swarmKey).setVisible(false);
      const s = Math.min((SNAP * 0.6) / im.width, (SNAP * 0.6) / im.height);
      im.setScale(s);
      rt.draw(im, SNAP / 2, SNAP / 2);
      temps.push(im);
    } else {
      // Mosquitos dibujados: cuerpo, alas y patas.
      const m = this.add.graphics().setVisible(false);
      for (let i = 0; i < 7; i++) {
        const x = SNAP * 0.3 + rnd() * SNAP * 0.4, y = SNAP * 0.3 + rnd() * SNAP * 0.4;
        m.fillStyle(0xffffff, 0.55).fillEllipse(x - 7, y - 5, 12, 5).fillEllipse(x + 7, y - 5, 12, 5);
        m.fillStyle(hex(PALETTE.linea), 1).fillEllipse(x, y, 14, 6).fillCircle(x + 8, y, 3);
        m.lineStyle(1, hex(PALETTE.linea), 1);
        for (let k = -1; k <= 1; k++) { m.lineBetween(x + k * 4, y + 2, x + k * 6 - 4, y + 10); m.lineBetween(x + k * 4, y + 2, x + k * 6 + 4, y + 10); }
      }
      rt.draw(m, 0, 0);
      temps.push(m);
    }
    rt.saveTexture(key);
    temps.forEach((o) => o.destroy());
    rt.destroy();
    return key;
  }

  // ---------------------------------------------------------------- maqueta
  /** Geometría de la foto y del panel según orientación. */
  geometria(W, H) {
    const portrait = Layout.isPortrait(this);
    const safe = Layout.safe(this);
    const top = safe.top + 44; // barra superior
    if (portrait) {
      const size = Phaser.Math.Clamp(Math.min(W - safe.left - safe.right, H * 0.42), 120, 420);
      const bottomReserve = this.fase === 'visor' ? 130 : 0;
      const availH = H - top - bottomReserve;
      const ph = this.fase === 'resultado' ? Math.min(size, availH * 0.32) : size;
      const pw = this.fase === 'resultado' ? ph : size;
      return { portrait, safe, photo: { x: (W - pw) / 2, y: top + 6, w: pw, h: ph },
        panel: { x: safe.left, y: top + ph + 18, w: W - safe.left - safe.right, h: H - (top + ph + 18) - safe.bottom } };
    }
    // Visor: consejo (≈40) + etiqueta "Disparar" (≈20) + disparador (84): en pantallas bajas
    // (teléfono horizontal, 393 px) con 110 el consejo caía sobre el disparador.
    const bottomReserve = this.fase === 'visor' ? 150 : 0;
    const availH = H - top - bottomReserve - safe.bottom;
    const side = this.fase === 'visor' ? Math.min(availH, W * 0.6) : Math.min(availH, W * 0.42);
    const size = Phaser.Math.Clamp(side, 120, 440);
    const photoX = this.fase === 'visor' ? (W - size) / 2 : safe.left + 8;
    const panelX = photoX + size + 24;
    // En resultado la tarjeta se acota en alto (≤ 500) y se centra con la foto.
    const panelH = this.fase === 'resultado' ? Math.min(H - top - safe.bottom, 500) : H - top - safe.bottom;
    const panelY = this.fase === 'resultado' ? top + Math.max(0, (H - top - safe.bottom - panelH) / 2) : top;
    return { portrait, safe, photo: { x: photoX, y: top + (availH - size) / 2, w: size, h: size },
      panel: { x: panelX, y: panelY, w: W - panelX - safe.right, h: panelH } };
  }

  layout(W, H) {
    this.root?.destroy();
    this.tweens.killAll();
    this.timers?.forEach((tm) => tm.remove(false));
    this.timers = [];
    const root = this.add.container(0, 0);
    this.root = root;
    const geo = this.geometria(W, H);
    this.geo = geo;

    // Fondo oscuro estilo visor
    root.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0b1218, 1).setInteractive());
    this.barraSuperior(W, geo);

    if (this.fase === 'visor') this.buildVisor(W, H, geo);
    else if (this.fase === 'analisis') this.buildAnalisis(W, H, geo);
    else this.buildResultado(W, H, geo);
  }

  barraSuperior(W, geo) {
    const y = geo.safe.top + 18;
    // Título + etiqueta DEMO
    const title = this.add.text(geo.safe.left + 44, y, t('cam.titulo'), {
      fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0, 0.5);
    const demo = this.add.text(title.x + title.width + 10, y, t('cam.demo'), {
      fontFamily: FONT, fontSize: 11, fontStyle: 'bold', color: PALETTE.linea,
      backgroundColor: PALETTE.amarillo, padding: { x: 6, y: 2 },
    }).setOrigin(0, 0.5);
    // Ícono cámara (decorativo)
    const ic = this.add.graphics();
    ic.fillStyle(0xffffff, 1).fillRoundedRect(geo.safe.left + 4, y - 9, 30, 20, 4).fillRoundedRect(geo.safe.left + 12, y - 14, 14, 6, 2);
    ic.fillStyle(0x0b1218, 1).fillCircle(geo.safe.left + 19, y + 1, 6);
    ic.fillStyle(hex(PALETTE.celeste), 1).fillCircle(geo.safe.left + 19, y + 1, 3);
    // Batería (decorativa)
    const bx = W - geo.safe.right - 74, by = y;
    const bat = this.add.graphics();
    bat.lineStyle(2, 0xffffff, 0.9).strokeRoundedRect(bx, by - 7, 26, 14, 3);
    bat.fillStyle(0xffffff, 0.9).fillRect(bx + 27, by - 3, 3, 6);
    bat.fillStyle(hex(PALETTE.verde), 1).fillRect(bx + 3, by - 4, 17, 8);
    // Punto REC
    const rec = this.add.circle(bx - 16, by, 5, hex(ROJO));
    this.tweens.add({ targets: rec, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
    // Botón cerrar
    const xBtn = this.add.container(W - geo.safe.right - 20, y);
    const xg = this.add.graphics();
    xg.fillStyle(0xffffff, 0.15).fillCircle(0, 0, 18);
    xg.lineStyle(3, 0xffffff, 1).lineBetween(-6, -6, 6, 6).lineBetween(-6, 6, 6, -6);
    xBtn.add(xg).setSize(...touchSize(40, 40)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => xBtn.setScale(1.1)).on('pointerout', () => xBtn.setScale(1))
      .on('pointerdown', () => this.close());
    this.root.add([ic, title, demo, bat, rec, xBtn]);
  }

  /** Imagen del snapshot recortada al rect (con máscara), sobre fondo gris. */
  addFoto(rect, polaroid = false) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    if (polaroid) {
      const b = 10, bb = 30;
      g.fillStyle(0x000000, 0.4).fillRoundedRect(rect.x - b + 6, rect.y - b + 8, rect.w + b * 2, rect.h + b + bb, 6);
      g.fillStyle(0xf6f3ea, 1).fillRoundedRect(rect.x - b, rect.y - b, rect.w + b * 2, rect.h + b + bb, 6);
    }
    g.fillStyle(0x1a2430, 1).fillRect(rect.x, rect.y, rect.w, rect.h);
    c.add(g);
    const img = this.add.image(rect.x + rect.w / 2, rect.y + rect.h / 2, this.snapKey);
    const s = Math.max(rect.w / img.width, rect.h / img.height);
    img.setScale(s);
    const maskG = this.make.graphics({ add: false });
    maskG.fillStyle(0xffffff).fillRect(rect.x, rect.y, rect.w, rect.h);
    img.setMask(maskG.createGeometryMask());
    c.add(img);
    c.once('destroy', () => maskG.destroy());
    c.img = img;
    c.baseScale = s;
    return c;
  }

  // ---------------------------------------------------------------- 1. visor
  buildVisor(W, H, geo) {
    const { photo } = geo;
    const foto = this.addFoto(photo);
    this.root.add(foto);
    // Zoom de enfoque 1.0 → 1.08 (ida y vuelta)
    this.tweens.add({ targets: foto.img, scale: foto.baseScale * 1.08, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Viñeta suave + rejilla de tercios
    const grid = this.add.graphics();
    grid.lineStyle(1, 0xffffff, 0.18);
    for (let i = 1; i < 3; i++) {
      grid.lineBetween(photo.x + (photo.w * i) / 3, photo.y, photo.x + (photo.w * i) / 3, photo.y + photo.h);
      grid.lineBetween(photo.x, photo.y + (photo.h * i) / 3, photo.x + photo.w, photo.y + (photo.h * i) / 3);
    }
    this.root.add(grid);
    this.root.add(CameraFX.frameCorners(this, photo, Math.min(30, photo.w * 0.12), 4));
    this.root.add(CameraFX.reticle(this, photo.x + photo.w / 2, photo.y + photo.h / 2, Math.min(140, photo.w * 0.45)));
    // Info tipo cámara: AF · ISO
    this.root.add(this.add.text(photo.x + 10, photo.y + photo.h - 10, 'AF  ·  ISO 200  ·  1/250', {
      fontFamily: FONT, fontSize: 11, color: PALETTE.celeste,
    }).setOrigin(0, 1));

    // Consejo: bajo la foto, pero nunca sobre la etiqueta "Disparar" ni el disparador (R = 36).
    const hintY = Math.min(photo.y + photo.h + 26, H - geo.safe.bottom - 36 - 12 - 36 - 14 - 16 - 20);
    this.root.add(this.add.text(W / 2, hintY, t('cam.consejo'), {
      fontFamily: FONT, fontSize: 15, fontStyle: 'bold', color: PALETTE.blanco, align: 'center',
      wordWrap: { width: W - geo.safe.left - geo.safe.right - 40 },
    }).setOrigin(0.5, 0));

    // Disparador circular grande (≥ 64 px)
    const R = 36;
    const sy = H - geo.safe.bottom - R - 12;
    const btn = this.add.container(W / 2, sy);
    const bg = this.add.graphics();
    const draw = (inner) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.35).fillCircle(0, 4, R + 4);
      bg.lineStyle(4, 0xffffff, 1).strokeCircle(0, 0, R + 2);
      bg.fillStyle(inner, 1).fillCircle(0, 0, R - 4);
    };
    draw(0xffffff);
    btn.add(bg).setSize(...touchSize(R * 2 + 8, R * 2 + 8)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(hex(PALETTE.celeste)))
      .on('pointerout', () => draw(0xffffff))
      .on('pointerdown', () => { draw(hex(PALETTE.grisClaro)); this.disparar(); });
    this.root.add(btn);
    this.root.add(this.add.text(W / 2, sy - R - 14, t('cam.disparar'), {
      fontFamily: FONT, fontSize: 12, color: PALETTE.grisClaro,
    }).setOrigin(0.5, 1));
  }

  disparar() {
    if (this.busy || this.fase !== 'visor') return;
    this.busy = true;
    this.sfx('click');
    // Especie y confianza estables por foto
    this.seed = (Date.now() % 100000) + 1;
    const rnd = mulberry(this.seed);
    this.especie = this.especieId ? speciesById(this.especieId) : especieAleatoria(rnd);
    this.confianza = 87 + Math.floor(rnd() * 12); // 87..98
    const flash = CameraFX.flash(this, 150);
    this.time.delayedCall(150, () => {
      this.busy = false;
      this.fase = 'analisis';
      this.layout(this.scale.width, this.scale.height);
      // layout() hace tweens.killAll(): en un dispositivo lento el timer llega antes de que el tween
      // del flash avance y el rectángulo blanco quedaba opaco tapando toda la pantalla.
      if (flash.active) this.tweens.add({ targets: flash, alpha: 0, duration: 120, onComplete: () => flash.destroy() });
    });
  }

  // ---------------------------------------------------------------- 3. análisis
  buildAnalisis(W, H, geo) {
    const { photo, panel, portrait } = geo;
    const foto = this.addFoto(photo, true);
    this.root.add(foto);
    const scan = CameraFX.scanner(this, photo, ANALISIS_MS, { passes: 2 });
    this.root.add(scan.obj);
    const labels = txList(this.especie.senales).slice(0, 6);
    // Completa hasta 4 puntos con marcas genéricas (alas, tórax, patas, abdomen)
    const extras = ['cam.pto.alas', 'cam.pto.torax', 'cam.pto.patas', 'cam.pto.abdomen'].map((k) => t(k)).filter((s) => !labels.includes(s));
    while (labels.length < 4 && extras.length) labels.push(extras.shift());
    this.root.add(CameraFX.landmarks(this, photo, labels, { seed: this.seed, delay: 450, gap: 280, fontSize: portrait ? 11 : 12 }));

    // Panel: barra "Analizando…" + consola
    const px = panel.x, pw = panel.w;
    let y = portrait ? panel.y + 24 : panel.y + Math.max(20, panel.h * 0.25);
    const lbl = this.add.text(px, y, t('cam.analizando'), {
      fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.blanco,
    });
    const pct = this.add.text(px + pw, y, '0 %', {
      fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.celeste,
    }).setOrigin(1, 0);
    y += lbl.height + 10;
    const bar = this.add.graphics();
    const barH = 14;
    const drawBar = (p) => {
      bar.clear();
      bar.fillStyle(0xffffff, 0.12).fillRoundedRect(px, y, pw, barH, 7);
      if (p > 0) bar.fillStyle(hex(PALETTE.celeste), 1).fillRoundedRect(px, y, Math.max(barH, pw * p), barH, 7);
    };
    drawBar(0);
    y += barH + 18;
    this.root.add([lbl, pct, bar]);

    // Consola: 3 líneas que aparecen en el tiempo
    const con = this.add.graphics();
    const conH = portrait ? 92 : 100;
    con.fillStyle(0x000000, 0.45).fillRoundedRect(px, y, pw, conH, 8);
    con.lineStyle(1, hex(PALETTE.celeste), 0.4).strokeRoundedRect(px, y, pw, conH, 8);
    this.root.add(con);
    const lines = [t('cam.log1'), t('cam.log2', { n: SPECIES.length }), t('cam.log3')];
    const times = [0, 900, ANALISIS_MS - 150];
    lines.forEach((s, i) => {
      const tt = this.add.text(px + 12, y + 12 + i * 26, `> ${s}`, {
        fontFamily: 'Consolas, Menlo, monospace', fontSize: 13, color: i === 2 ? PALETTE.verde : PALETTE.celeste,
      }).setAlpha(0);
      this.root.add(tt);
      this.timers.push(this.time.delayedCall(times[i], () => tt.setAlpha(1)));
    });
    // Cursor parpadeante
    const cur = this.add.text(px + 12, y + 12 + 3 * 26 - 4, '_', { fontFamily: 'monospace', fontSize: 13, color: PALETTE.celeste });
    this.root.add(cur);
    this.tweens.add({ targets: cur, alpha: 0, duration: 400, yoyo: true, repeat: -1 });

    // Porcentaje con easing y pequeñas pausas (encadenado ≈ 2,2 s)
    const state = { p: 0 };
    const upd = () => { drawBar(state.p); pct.setText(`${Math.round(state.p * 100)} %`); };
    this.tweens.chain({
      targets: state,
      tweens: [
        { p: 0.34, duration: 500, ease: 'Sine.easeOut', onUpdate: upd },
        { p: 0.34, duration: 180 },
        { p: 0.63, duration: 420, ease: 'Sine.easeInOut', onUpdate: upd },
        { p: 0.63, duration: 240 },
        { p: 0.89, duration: 460, ease: 'Sine.easeInOut', onUpdate: upd },
        { p: 0.89, duration: 160 },
        { p: 1, duration: 240, ease: 'Quad.easeOut', onUpdate: upd },
      ],
    });
    this.timers.push(this.time.delayedCall(ANALISIS_MS + 300, () => {
      if (this.fase !== 'analisis') return;
      scan.stop();
      this.sfx('detect');
      this.fase = 'resultado';
      this.layout(this.scale.width, this.scale.height);
    }));
  }

  // ---------------------------------------------------------------- 4. resultado
  buildResultado(W, H, geo) {
    const { photo, panel, portrait } = geo;
    const sp = this.especie;
    const foto = this.addFoto(photo, true);
    this.root.add(foto);
    // Puntos ya "fijados" (sin animación larga)
    const labels = txList(sp.senales).slice(0, 6);
    this.root.add(CameraFX.landmarks(this, photo, labels, { seed: this.seed, delay: 0, gap: 60, fontSize: 10 }));

    // Tarjeta
    const card = this.add.container(panel.x, panel.y).setAlpha(0);
    this.root.add(card);
    const cw = panel.w, ch = panel.h;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(6, 8, cw, ch, 16);
    bg.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(0, 0, cw, ch, 16);
    bg.lineStyle(4, hex(PALETTE.marino), 1).strokeRoundedRect(0, 0, cw, ch, 16);
    card.add(bg);

    const pad = 14;
    const compact = ch < 420;
    const illS = compact ? 84 : 116;
    // Ilustración
    const ib = this.add.graphics();
    ib.fillStyle(hex(PALETTE.celeste), 0.3).fillRoundedRect(pad, pad, illS, illS, 12);
    ib.lineStyle(2, hex(PALETTE.marino), 1).strokeRoundedRect(pad, pad, illS, illS, 12);
    card.add(ib);
    const illKey = [sp.sprite, 'mosquitos_1', 'mosquito_grande', 'mosquito_medio'].find((k) => k && this.textures.exists(k));
    if (illKey) {
      const im = this.add.image(pad + illS / 2, pad + illS / 2, illKey);
      im.setScale(Math.min((illS - 14) / im.width, (illS - 14) / im.height));
      card.add(im);
    } else {
      card.add(this.add.text(pad + illS / 2, pad + illS / 2, '🦟', { fontSize: illS * 0.5 }).setOrigin(0.5));
    }

    // Nombre, apodo, confianza
    const tx0 = pad + illS + 12, tw = cw - tx0 - pad;
    let y = pad;
    const name = this.add.text(tx0, y, tx(sp.nombre), {
      fontFamily: FONT, fontSize: compact ? 20 : 24, fontStyle: 'bold', color: ROJO, wordWrap: { width: tw },
    });
    card.add(name); y += name.height + 2;
    const apodo = this.add.text(tx0, y, tx(sp.apodo), {
      fontFamily: FONT, fontSize: compact ? 13 : 15, fontStyle: 'italic', color: PALETTE.gris, wordWrap: { width: tw },
    });
    card.add(apodo); y += apodo.height + 8;
    // Confianza
    const conf = this.add.text(tx0, y, t('cam.confianza', { p: this.confianza }), {
      fontFamily: FONT, fontSize: compact ? 13 : 14, fontStyle: 'bold', color: PALETTE.blanco,
      backgroundColor: PALETTE.verdeOscuro, padding: { x: 8, y: 3 },
    });
    card.add(conf); y += conf.height + 6;
    const cb = this.add.graphics();
    cb.fillStyle(hex(PALETTE.marino), 0.12).fillRoundedRect(tx0, y, tw, 8, 4);
    cb.fillStyle(hex(PALETTE.verde), 1).fillRoundedRect(tx0, y, tw * this.confianza / 100, 8, 4);
    card.add(cb);

    y = Math.max(y + 16, pad + illS + 12);
    // Chips con señales
    const chipLbl = this.add.text(pad, y, t('cam.senales'), { fontFamily: FONT, fontSize: 12, fontStyle: 'bold', color: PALETTE.grisClaro });
    card.add(chipLbl); y += chipLbl.height + 4;
    let cx = pad, rowH = 0;
    for (const s of labels) {
      const chip = this.add.text(0, 0, '✓ ' + s, {
        fontFamily: FONT, fontSize: compact ? 11 : 12, fontStyle: 'bold', color: PALETTE.marino,
        backgroundColor: '#dff3fc', padding: { x: 8, y: 4 },
      });
      if (cx + chip.width > cw - pad && cx > pad) { cx = pad; y += rowH + 6; }
      chip.setPosition(cx, y); cx += chip.width + 6; rowH = chip.height;
      card.add(chip);
    }
    y += rowH + 10;

    const info = (label, value, color = PALETTE.marino) => {
      const a = this.add.text(pad, y, label, { fontFamily: FONT, fontSize: compact ? 12 : 13, fontStyle: 'bold', color: PALETTE.gris });
      const b = this.add.text(pad + a.width + 4, y, value, {
        fontFamily: FONT, fontSize: compact ? 12 : 13, color, wordWrap: { width: cw - pad * 2 - a.width - 4 },
      });
      card.add([a, b]); y += Math.max(a.height, b.height) + 4;
    };
    info(t('cam.transmite'), txList(sp.transmite).join(', '), ROJO);
    info(t('cam.cria'), tx(sp.cria));
    // Recomendación (1 línea)
    const rec = this.add.text(pad, y + 2, '💡 ' + t(`cam.rec.${sp.id}`), {
      fontFamily: FONT, fontSize: compact ? 12 : 13, fontStyle: 'bold', color: PALETTE.verdeOscuro, wordWrap: { width: cw - pad * 2 },
    });
    card.add(rec);

    // Estado (nueva especie) + botones
    const btnH = 48, bw = Math.min(210, (cw - pad * 3) / 2);
    const by = ch - pad - btnH / 2;
    this.status = this.add.text(cw / 2, by - btnH / 2 - 12, '', {
      fontFamily: FONT, fontSize: 14, fontStyle: 'bold', color: PALETTE.verdeOscuro,
    }).setOrigin(0.5, 1);
    card.add(this.status);
    this.saveBtn = this.makeButton(cw / 2 - bw / 2 - pad / 2, by, bw, btnH, this.saved ? t('cam.guardado') : t('cam.guardar'),
      PALETTE.verde, PALETTE.verdeOscuro, () => this.guardar());
    card.add(this.saveBtn);
    card.add(this.makeButton(cw / 2 + bw / 2 + pad / 2, by, bw, btnH, t('cam.cerrar'), PALETTE.grisClaro, PALETTE.gris, () => this.close()));

    this.tweens.add({ targets: card, alpha: 1, duration: 260, ease: 'Sine.easeOut' });
    // Si la tarjeta no cabe en horizontal muy bajo, escalar contenido: reducir alpha no ayuda; se acepta recorte leve.
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
    const tt = this.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: 16, fontStyle: 'bold', color: PALETTE.blanco, align: 'center', wordWrap: { width: w - 12 },
    }).setOrigin(0.5);
    c.add([g, tt]).setSize(...touchSize(w, h)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(hover))
      .on('pointerout', () => draw(color))
      .on('pointerdown', cb);
    c.label = tt;
    return c;
  }

  // ---------------------------------------------------------------- álbum
  static leerAlbum() {
    try { const a = JSON.parse(localStorage.getItem(ALBUM_KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch { return new Set(); }
  }

  guardar() {
    if (this.saved || !this.especie) return;
    this.saved = true;
    this.sfx('points');
    const album = CameraScene.leerAlbum();
    const nueva = !album.has(this.especie.id);
    album.add(this.especie.id);
    try { localStorage.setItem(ALBUM_KEY, JSON.stringify([...album])); } catch { /* sin storage */ }
    this.scene.get('Game')?.events.emit('camera:especie', { id: this.especie.id, confianza: this.confianza, nueva });
    this.saveBtn?.label.setText(t('cam.guardado'));
    if (this.status) {
      this.status.setText(nueva ? t('cam.nueva') : t('cam.yaEstaba')).setAlpha(0);
      this.tweens.add({ targets: this.status, alpha: 1, duration: 200 });
    }
  }

  close() {
    if (this.done) return;
    this.done = true;
    this.sfx('click');
    this.scene.get('Game')?.events.emit('camera:cerrar');
    this.scene.stop();
  }
}
