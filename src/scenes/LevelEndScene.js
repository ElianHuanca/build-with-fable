import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';
import * as Facts from '../data/facts.js';
import * as Quiz from '../data/quiz.js';
import * as Levels from '../data/levels.js';
import * as Tips from '../data/tips.js';
import { t, tx, getLang } from '../i18n/index.js';

const FONT = 'Arial, sans-serif';
/** Ancho de referencia de la maqueta; todo se arma a esta escala y luego se achica para caber. */
const REF_W = 560;

/** Colores de cinta según cómo terminó la jornada; título y mensaje salen del diccionario ('end.*'). */
const RESULTADOS = {
  completo: { cinta: PALETTE.azulGorra, cintaOscura: PALETTE.azulGorraOscuro, conMensaje: false },
  tiempo: { cinta: PALETTE.amarillo, cintaOscura: PALETTE.teja, conMensaje: true },
  epidemia: { cinta: PALETTE.teja, cintaOscura: PALETTE.tejaOscura, conMensaje: true },
};

const fmtTiempo = (s) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Índices (estables ante cambios de idioma) de 3 frases para "Lo que aprendiste hoy":
 * de aprendidoL() (tips.js) si existe; si no, de los datos (.dato) de facts.js.
 */
function elegirHechos(n = 3) {
  const usaTips = typeof Tips.aprendidoL === 'function' && Tips.aprendidoL()?.length;
  const claves = usaTips ? Tips.aprendidoL().map((_, i) => i) : Object.keys(Facts.FACTS);
  return { usaTips, claves: Phaser.Utils.Array.Shuffle(claves.slice()).slice(0, n) };
}

/** Frase de "aprendiste" en el idioma actual (clave = índice de aprendidoL() o tipo de criadero). */
function fraseDe(hechos, clave) {
  if (hechos.usaTips) return Tips.aprendidoL()[clave] ?? '';
  return datoDe(clave);
}

/** Dato (.dato) del tipo en el idioma actual: factsL() si existe; si no, FACTS (con tx por si es {es,en}). */
function datoDe(tipo) {
  const facts = (typeof Facts.factsL === 'function' ? Facts.factsL() : null) || Facts.FACTS;
  return tx(facts[tipo]?.dato ?? Facts.FACTS[tipo]?.dato ?? '');
}

/** Pregunta del quiz en el idioma actual (preguntaAleatoria de quiz.js si existe; si no, QUIZ al azar). */
function elegirPregunta() {
  if (typeof Quiz.preguntaAleatoria === 'function') return Quiz.preguntaAleatoria() || null;
  const lista = Array.isArray(Quiz.QUIZ) ? Quiz.QUIZ : [];
  if (!lista.length) return null;
  const q = Phaser.Utils.Array.GetRandom(lista);
  return { ...q, pregunta: tx(q.pregunta), opciones: q.opciones?.[getLang()] ?? q.opciones?.es ?? q.opciones, explicacion: tx(q.explicacion) };
}

/** Nombre localizado del nivel (nombreNivel de levels.js si existe); cae al nombre recibido. */
function nombreDeNivel(id, fallback) {
  const lvl = id && typeof Levels.getLevel === 'function' ? Levels.getLevel(id) : null;
  if (lvl && typeof Levels.nombreNivel === 'function') return Levels.nombreNivel(lvl);
  return tx(fallback) || (lvl ? tx(lvl.nombre) : '');
}

/**
 * Pantalla de fin de jornada: cinta según el resultado, estrellas, resumen, bocadillo,
 * "Aprendiste hoy" (3 datos de facts.js) y una pregunta de quiz.js con bonus visual +100.
 * scene.launch('LevelEnd', { puntos, limpios, total, tiempo, estrellas, nivelId, nivelNombre, resultado })
 * `resultado`: 'completo' | 'tiempo' | 'epidemia' (default 'completo', para no romper el flujo de v1).
 * Emite en 'Game': 'sfx' ('win', 'points', 'click'), 'nivel:continuar', 'nivel:foto',
 * 'nivel:reintentar' (botón "Intentar de nuevo", solo si resultado ≠ 'completo').
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
      resultado: RESULTADOS[data.resultado] ? data.resultado : 'completo',
    };
    this.done = false;
    // Bonus del quiz: solo visual/local a esta pantalla, no toca SaveSystem ni el registry.
    this.puntosMostrados = this.data_.puntos;
    this.hechos = elegirHechos(3);
    this.quiz = elegirPregunta();
    this.quizAnswered = false;
    this.respuestaIndex = null;
    this.laidOutOnce = false;
    this.timers = [];
  }

  sfx(name) { this.scene.get('Game')?.events.emit('sfx', name); }

  create() {
    Layout.onResize(this, (w, h) => this.layout(w, h));
    this.input.keyboard?.on('keydown-ENTER', () => this.finish('nivel:continuar'));
    this.input.keyboard?.on('keydown-SPACE', () => this.finish('nivel:continuar'));
  }

  /**
   * Arma todo en un flujo vertical (contenido de referencia REF_W) y lo escala/centra para
   * caber en el lienzo actual (RESIZE) — igual que las tarjetas de LevelSelectScene.
   */
  layout(W, H) {
    this.timers.forEach((t) => t.remove(false));
    this.timers = [];
    this.root?.destroy();
    const root = this.add.container(0, 0);
    this.root = root;
    const d = this.data_;
    const cfg = RESULTADOS[d.resultado];
    const primeraVez = !this.laidOutOnce;
    this.laidOutOnce = true;

    root.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive());

    const content = this.add.container(0, 0);
    this.content = content;
    root.add(content);

    let y = 20;

    // Cinta con el resultado
    const ribbonW = 460, ribbonH = 64;
    const ry = y + ribbonH / 2;
    const rib = this.add.graphics();
    rib.fillStyle(hex(cfg.cintaOscura), 1);
    rib.fillTriangle(-ribbonW / 2 - 30, ry - ribbonH / 2 + 8, -ribbonW / 2 + 10, ry, -ribbonW / 2 - 30, ry + ribbonH / 2 + 8);
    rib.fillTriangle(ribbonW / 2 + 30, ry - ribbonH / 2 + 8, ribbonW / 2 - 10, ry, ribbonW / 2 + 30, ry + ribbonH / 2 + 8);
    rib.fillStyle(hex(cfg.cinta), 1).fillRoundedRect(-ribbonW / 2, ry - ribbonH / 2, ribbonW, ribbonH, 10);
    rib.lineStyle(4, hex(PALETTE.marino), 1).strokeRoundedRect(-ribbonW / 2, ry - ribbonH / 2, ribbonW, ribbonH, 10);
    content.add(rib);
    content.add(this.add.text(0, ry, t(`end.${d.resultado}`), {
      fontFamily: FONT, fontSize: 30, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.marino, strokeThickness: 6, align: 'center', wordWrap: { width: ribbonW - 24 },
    }).setOrigin(0.5));
    if (primeraVez && d.resultado === 'completo') this.sfx('win');
    y = ry + ribbonH / 2 + 16;
    const nivelNombre = nombreDeNivel(d.nivelId, d.nivelNombre);
    if (nivelNombre) {
      content.add(this.add.text(0, y, nivelNombre, {
        fontFamily: FONT, fontSize: 15, fontStyle: 'bold', color: PALETTE.celeste,
      }).setOrigin(0.5, 0));
      y += 26;
    }
    y += 12;

    // Estrellas (la animación de entrada solo corre la primera vez, no en cada resize)
    const starGap = 90;
    const starY = y + 34;
    this.stars = [];
    for (let i = 0; i < 3; i++) {
      const on = i < d.estrellas;
      const sx = -starGap + i * starGap;
      const s = this.makeStar(sx, starY, on);
      content.add(s);
      this.stars.push(s);
      if (primeraVez) {
        s.setScale(0).setAlpha(0);
        const t = this.time.delayedCall(350 + i * 250, () => {
          if (on) this.sfx('points');
          this.tweens.add({ targets: s, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
        });
        this.timers.push(t);
      }
    }
    y = starY + 40;

    // Barra de celebración
    const barW = 380, barH = 22;
    const by = y + barH;
    const barBg = this.add.graphics();
    barBg.fillStyle(hex(PALETTE.marino), 1).fillRoundedRect(-barW / 2, by - barH / 2, barW, barH, 11);
    content.add(barBg);
    const barFill = this.add.graphics();
    content.add(barFill);
    const pct = { v: primeraVez ? 0 : 1 };
    const pctText = this.add.text(0, by, '0 %', {
      fontFamily: FONT, fontSize: 14, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5).setDepth(1);
    content.add(pctText);
    const drawBar = () => {
      barFill.clear();
      const w = Math.max(barH, (barW - 4) * pct.v);
      barFill.fillStyle(hex(PALETTE.verde), 1).fillRoundedRect(-barW / 2 + 2, by - barH / 2 + 2, w, barH - 4, 9);
      pctText.setText(`${Math.round(pct.v * 100)} %`);
    };
    if (primeraVez) {
      this.tweens.add({ targets: pct, v: 1, duration: 800, delay: 300, ease: 'Sine.easeOut', onUpdate: drawBar });
    } else {
      drawBar();
    }
    y = by + barH / 2 + 26;

    // Panel resumen
    const pw = 320, ph = 118;
    const py = y + ph / 2;
    const panel = this.add.graphics();
    panel.fillStyle(hex(PALETTE.marino), 0.95).fillRoundedRect(-pw / 2, py - ph / 2, pw, ph, 14);
    panel.lineStyle(3, hex(PALETTE.celeste), 1).strokeRoundedRect(-pw / 2, py - ph / 2, pw, ph, 14);
    content.add(panel);
    this.puntosLineText = this.add.text(-pw / 2 + 22, py - ph / 2 + 28, t('end.puntos', { n: this.puntosMostrados }), {
      fontFamily: FONT, fontSize: 20, fontStyle: 'bold', color: PALETTE.amarillo,
    }).setOrigin(0, 0.5);
    content.add(this.puntosLineText);
    [t('end.criaderos', { n: `${d.limpios}${d.total ? ' / ' + d.total : ''}` }), t('end.tiempoLinea', { t: fmtTiempo(d.tiempo) })]
      .forEach((l, i) => {
        const txt = this.add.text(-pw / 2 + 22, py - ph / 2 + 28 + (i + 1) * 42, l, {
          fontFamily: FONT, fontSize: 20, fontStyle: 'bold', color: PALETTE.blanco,
        }).setOrigin(0, 0.5);
        if (txt.width > pw - 44) txt.setFontSize(Math.max(13, Math.floor(20 * (pw - 44) / txt.width)));
        content.add(txt);
      });
    y = py + ph / 2 + 22;

    // Bocadillo + retrato
    const bw = 250, bh = 110;
    const bx = -60, byy = y + bh / 2;
    const bub = this.add.graphics();
    bub.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(bx - bw / 2, byy - bh / 2, bw, bh, 14);
    bub.fillTriangle(bx + bw / 2 - 4, byy + 10, bx + bw / 2 + 18, byy + 22, bx + bw / 2 - 4, byy + 34);
    bub.lineStyle(3, hex(PALETTE.marino), 1).strokeRoundedRect(bx - bw / 2, byy - bh / 2, bw, bh, 14);
    content.add(bub);
    content.add(this.add.text(bx, byy, cfg.conMensaje ? t(`end.msg.${d.resultado}`) : t(`end.msg.${d.estrellas}`), {
      fontFamily: FONT, fontSize: 16, fontStyle: 'bold', color: PALETTE.marino,
      wordWrap: { width: bw - 28 }, align: 'center',
    }).setOrigin(0.5));
    const rx = bx + bw / 2 + 62, rY = byy + 30;
    if (this.textures.exists('retrato_pulgar')) {
      content.add(this.add.image(rx, rY, 'retrato_pulgar'));
    } else if (this.textures.exists('player')) {
      content.add(this.add.image(rx, rY, 'player', 'down_0').setScale(2));
    }
    y = byy + bh / 2 + 30;

    // Aprendiste hoy
    const anchoTexto = 460;
    content.add(this.add.text(0, y, t('end.aprendiste'), {
      fontFamily: FONT, fontSize: 20, fontStyle: 'bold', color: PALETTE.azulGorra,
    }).setOrigin(0.5, 0));
    y += 30;
    // Panel claro detrás de los bullets: texto marino sobre el fondo oscuro no se leía.
    const padH = 12, padV = 10;
    const hechosBg = this.add.graphics();
    content.add(hechosBg);
    const hechosTop = y;
    y += padV;
    this.hechos.claves.forEach((clave) => {
      const txt = this.add.text(-anchoTexto / 2 + padH, y, `• ${fraseDe(this.hechos, clave)}`, {
        fontFamily: FONT, fontSize: 15, color: PALETTE.marino, wordWrap: { width: anchoTexto - padH * 2 },
      }).setOrigin(0, 0);
      content.add(txt);
      y += txt.height + 6;
    });
    y += padV - 6;
    hechosBg.fillStyle(0x000000, 0.2).fillRoundedRect(-anchoTexto / 2, hechosTop + 3, anchoTexto, y - hechosTop, 12);
    hechosBg.fillStyle(hex(PALETTE.blanco), 0.96).fillRoundedRect(-anchoTexto / 2, hechosTop, anchoTexto, y - hechosTop, 12);
    hechosBg.lineStyle(2, hex(PALETTE.celeste), 1).strokeRoundedRect(-anchoTexto / 2, hechosTop, anchoTexto, y - hechosTop, 12);
    y += 14;

    if (this.quiz) y = this.crearQuiz(y, anchoTexto);
    y += 20;

    // Botones ("Intentar de nuevo" solo si la jornada no terminó completa: epidemia o tiempo)
    let btnY = y + 28;
    if (d.resultado !== 'completo') {
      content.add(this.makeButton(0, btnY, 300, 52, t('end.reintentar'), PALETTE.teja, PALETTE.tejaOscura, 20, () => this.finish('nivel:reintentar')));
      btnY += 66;
    }
    content.add(this.makeButton(100, btnY, 230, 56, t('end.continuar'), PALETTE.verde, PALETTE.verdeOscuro, 22, () => this.finish('nivel:continuar')));
    content.add(this.makeButton(-125, btnY, 190, 52, t('end.foto'), PALETTE.grisClaro, PALETTE.gris, 18, () => this.finish('nivel:foto')));
    const contentH = btnY + 30;

    // Escala todo para que quepa en el lienzo, en vez de reflujar cada sección por separado.
    const safe = Layout.safe(this);
    const availW = Math.max(240, W - safe.left - safe.right);
    const availH = Math.max(240, H - safe.top - safe.bottom);
    const scale = Phaser.Math.Clamp(Math.min(availW / REF_W, availH / contentH), 0.45, 1);
    content.setScale(scale);
    content.setPosition(W / 2, Math.max(safe.top, (H - contentH * scale) / 2));
  }

  /** Pregunta + 4 opciones; si ya se había respondido (por ejemplo tras un resize), reaplica el estado. */
  crearQuiz(yStart, anchoTexto) {
    let y = yStart;
    const pregunta = this.add.text(0, y, this.quiz.pregunta, {
      fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.azulGorra,
      align: 'center', wordWrap: { width: anchoTexto },
    }).setOrigin(0.5, 0);
    this.content.add(pregunta);
    y += pregunta.height + 16;

    const optW = anchoTexto, optH = 44, gap = 10;
    this.quizButtons = [];
    this.quiz.opciones.forEach((texto, i) => {
      const btn = this.crearOpcionQuiz(0, y + optH / 2, optW, optH, texto, () => this.responderQuiz(i));
      this.content.add(btn);
      this.quizButtons.push(btn);
      y += optH + gap;
    });

    this.quizFeedback = this.add.text(0, y, this.quiz.explicacion || '', {
      fontFamily: FONT, fontSize: 14, color: PALETTE.gris, align: 'center', wordWrap: { width: anchoTexto },
    }).setOrigin(0.5, 0).setAlpha(0);
    this.content.add(this.quizFeedback);
    y += this.quizFeedback.height + 8;

    if (this.respuestaIndex !== null) this.aplicarRespuestaVisual(this.respuestaIndex, false);
    return y;
  }

  crearOpcionQuiz(x, y, w, h, texto, onClick) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const draw = (col) => {
      g.clear();
      g.fillStyle(0x000000, 0.2).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 10);
      g.fillStyle(hex(col), 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(2, hex(PALETTE.marino), 0.5).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(PALETTE.blanco);
    const t = this.add.text(0, 0, texto, {
      fontFamily: FONT, fontSize: 15, fontStyle: 'bold', color: PALETTE.marino,
      align: 'center', wordWrap: { width: w - 24 },
    }).setOrigin(0.5);
    c.add([g, t]).setSize(...touchSize(w, h)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => { if (!this.quizAnswered) draw('#eef3f7'); })
      .on('pointerout', () => { if (!this.quizAnswered) draw(PALETTE.blanco); })
      .on('pointerdown', () => onClick());
    c.redraw = draw;
    c.label = t;
    return c;
  }

  responderQuiz(i) {
    if (this.quizAnswered) return;
    this.quizAnswered = true;
    this.respuestaIndex = i;
    this.aplicarRespuestaVisual(i, true);
    if (i === this.quiz.correcta) {
      this.puntosMostrados += 100;
      this.sfx('points');
      this.animarBonus();
    }
  }

  /** Resalta la opción correcta (verde) y la elegida si fue incorrecta (roja); muestra la explicación. */
  aplicarRespuestaVisual(i, animar) {
    const correcta = this.quiz.correcta;
    this.quizButtons.forEach((b, idx) => {
      b.disableInteractive();
      if (idx === correcta) { b.redraw(PALETTE.verde); b.label.setColor(PALETTE.blanco); }
      else if (idx === i) { b.redraw(PALETTE.teja); b.label.setColor(PALETTE.blanco); }
    });
    this.quizFeedback.setText(this.quiz.explicacion || '');
    if (animar) this.tweens.add({ targets: this.quizFeedback, alpha: 1, duration: 250 });
    else this.quizFeedback.setAlpha(1);
  }

  /** "+100" flotante junto al puntaje del resumen (solo visual, no toca SaveSystem ni el registry). */
  animarBonus() {
    this.puntosLineText.setText(t('end.puntos', { n: this.puntosMostrados }));
    this.pulso(this.puntosLineText);
    const bonus = this.add.text(
      this.puntosLineText.x + this.puntosLineText.width + 10, this.puntosLineText.y, t('end.bonus'),
      { fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.amarillo },
    ).setOrigin(0, 0.5).setAlpha(0);
    this.content.add(bonus);
    this.tweens.add({
      targets: bonus, y: bonus.y - 26, alpha: 1, duration: 260, ease: 'Sine.easeOut',
      onComplete: () => this.tweens.add({ targets: bonus, alpha: 0, delay: 450, duration: 300, onComplete: () => bonus.destroy() }),
    });
  }

  pulso(target, escala = 1.15) {
    this.tweens.add({ targets: target, scale: escala, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
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
    const txt = this.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: size, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    if (txt.width > w - 24) txt.setFontSize(Math.max(12, Math.floor(size * (w - 24) / txt.width))); // etiquetas largas (EN)
    c.add([g, txt]).setSize(...touchSize(w, h)).setInteractive({ useHandCursor: true })
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
