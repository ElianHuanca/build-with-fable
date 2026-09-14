import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { esModoTactil, touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';
import { t } from '../i18n/index.js';

const FONT = 'Arial, sans-serif';
const MARGEN = 12;
const PANEL_W = 250;
const RADIO = 12;
const DEPTH_PANEL = 10;
const DEPTH_DATO = 20;
const TWEEN_BARRA_MS = 450;
const ROJO_EPIDEMIA = '#e74c3c';
/** Umbral (0..100) a partir del cual la barra de epidemia pulsa. */
const UMBRAL_RIESGO = 60;
/** En modo táctil el panel "Barrio protegido" se corre a la izquierda para dejar sitio al botón PAUSA. */
const OFFSET_PAUSA_TACTIL = 60;
/** Separación entre el panel "Barrio protegido" y el de "Riesgo de epidemia". */
const GAP_PANELES = 8;
/** Ancho mínimo de los paneles de la derecha cuando se encogen para caber lado a lado (horizontal). */
const PANEL_MIN_W = 200;
/** Tiempo que la lista de misiones queda desplegada en vertical al tocar "?". */
const MISIONES_DESPLEGADAS_MS = 3000;
/** Paneles que se apartan (v3 §1.3): alpha normal y atenuada cuando tapan al jugador/brote/criadero. */
const ALPHA_PANEL = 0.9;
const ALPHA_EVITAR = 0.25;
const EVITAR_MS = 150;
/** Lado 'arriba' del dato educativo: borde superior bajo la HUD (vertical) o bajo la fila de paneles. */
const DATO_TOP_VERTICAL = 170;
const DATO_TOP_HORIZONTAL = 100;

/** Panel de jugador: horizontal (como v1) y vertical (compacto). */
const JUGADOR = {
  horizontal: { w: PANEL_W, h: 68, retrato: 44, star: 11, puntos: 18 },
  vertical: { w: 136, h: 56, retrato: 34, star: 7, puntos: 14 },
};

/** Reserva para el minimapa (arriba-derecha; lo dibuja GameScene). Lo comparte Minimap.js. */
export const MINIMAPA = { margen: 12, top: 56, vertical: 100, horizontal: 148 };
/** Clave del registry: y (px) a partir de la cual la columna derecha queda libre para el minimapa. */
export const HUD_KEY_DERECHA_Y = 'hudDerechaY';
/**
 * Clave del registry (horizontal): `{ x0, x1, y1 }` = franja libre arriba entre el panel de
 * misiones (x0) y el primer panel de la derecha (x1); y1 = borde inferior de la fila de paneles.
 * La usa AlertToast para no tapar los paneles.
 */
export const HUD_KEY_LIBRE = 'hudLibre';

/**
 * Claves del registry que la HUD lee (las escribe GameScene):
 *   puntos (number) · estrellas (0..3) · limpios (number) · total (number)
 *   progreso (0..1) · zona (string) · misiones ({id,texto,hecho,progreso}[]) · tiempo (segundos)
 *   epidemia (0..100)
 */
export const HUD_KEYS = ['puntos', 'estrellas', 'limpios', 'total', 'progreso', 'zona', 'misiones', 'tiempo', 'epidemia'];

/**
 * Overlay de información. Se lanza en paralelo: `this.scene.launch('HUD')` desde GameScene.
 *
 * Horizontal / escritorio (como v1): retrato + puntos + estrellas y lista de misiones a la
 * izquierda; "Barrio protegido" (con reloj) y "Riesgo de epidemia" arriba a la derecha (lado a
 * lado si caben, si no apilados); dato educativo abajo al centro.
 *
 * Vertical (Layout.isPortrait): panel compacto de jugador arriba-izquierda; arriba-centro el
 * reloj y dos barras finas (verde barrio, roja riesgo) con %; una sola línea "Misión: … n/m" con
 * botón "?" que despliega la lista 3 s; la esquina superior derecha queda libre para el minimapa
 * (MINIMAPA) y el botón de pausa. Todo se reacomoda con Layout.onResize.
 */
export class HUDScene extends Phaser.Scene {
  constructor() { super({ key: 'HUD' }); }

  /** Rectángulo reservado para el minimapa según orientación (útil para quien lo dibuje). */
  static rectMinimapa(scene) {
    const { w } = Layout.size(scene);
    const s = Layout.isPortrait(scene) ? MINIMAPA.vertical : MINIMAPA.horizontal;
    return { x: w - MINIMAPA.margen - s, y: MINIMAPA.top, w: s, h: s };
  }

  create() {
    this.estado = {
      puntos: 0, estrellas: 0, limpios: 0, total: 0, progreso: 0, zona: '', misiones: [], tiempo: 0, epidemia: 0,
    };
    for (const k of HUD_KEYS) {
      const v = this.registry.get(k);
      if (v !== undefined) this.estado[k] = v;
    }
    this.tactil = esModoTactil(this.sys.game);
    this.barraValor = this.estado.progreso || 0;                 // valor animado 0..1
    this.epiValor = (this.estado.epidemia || 0) / 100;           // valor animado 0..1
    this.misionesDesplegadas = false;
    this.misionesTimer = null;
    this.misionesPlegado = false;   // horizontal: al tocar el panel solo se ve la misión activa
    this.evitados = new Map();      // panel → ¿atenuado por evitar()?
    this.datoLado = 'abajo';

    this.crearPanelJugador(Layout.isPortrait(this));
    this.crearPanelMisiones();
    this.crearMisionLinea();
    this.barrio = this.crearPanelBarra(t('hud.barrio'), PALETTE.celeste, PALETTE.verde, true);
    this.epidemia = this.crearPanelBarra(t('hud.riesgo'), ROJO_EPIDEMIA, null, false);
    this.crearPanelCentro();
    this.crearDato();

    // Un restart de Game puede relanzar el HUD antes de que el anterior termine de cerrarse:
    // quitar cualquier listener previo antes de registrar el nuevo.
    if (this.onChange) this.registry.events.off('changedata', this.onChange);
    this.onChange = (parent, key, value) => this.aplicar(key, value);
    this.registry.events.on('changedata', this.onChange);
    // Cambio de idioma: etiquetas estáticas (GameScene republica zona y misiones por su cuenta).
    this.onLang = () => this.aplicarIdioma();
    this.game.events.on('lang', this.onLang);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata', this.onChange);
      this.game.events.off('lang', this.onLang);
      if (this.datoTimer) this.datoTimer.remove();
      if (this.misionesTimer) this.misionesTimer.remove();
    });

    Layout.onResize(this, (w, h) => this.reposicionar(w, h));
    this.refrescarTodo();
  }

  // ---------- helpers de dibujo ----------

  panel(g, w, h, alpha = 0.9) {
    g.clear();
    g.fillStyle(hex(PALETTE.marino), alpha).fillRoundedRect(0, 0, w, h, RADIO);
    g.lineStyle(3, hex(PALETTE.celeste), 1).strokeRoundedRect(0, 0, w, h, RADIO);
    return g;
  }

  texto(x, y, str, size, opts = {}) {
    return this.add.text(x, y, str, {
      fontFamily: FONT, fontSize: size, fontStyle: opts.bold === false ? 'normal' : 'bold',
      color: opts.color || PALETTE.blanco, align: opts.align || 'left',
      ...(opts.wrap ? { wordWrap: { width: opts.wrap } } : {}),
    });
  }

  /** Estrella de 5 puntas dibujada con Graphics (fallback si no hay textura). */
  dibujarEstrella(g, cx, cy, r, color) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.48;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad));
    }
    g.fillStyle(hex(color), 1).fillPoints(pts, true);
    g.lineStyle(r > 8 ? 2 : 1.5, hex(PALETTE.linea), 0.8).strokePoints(pts, true);
  }

  /** Retrato circular: textura 'retrato' si existe; si no, cara con gorra azul. */
  crearRetrato(cx, cy, tam) {
    const r = tam / 2;
    const c = this.add.container(cx, cy);
    if (this.textures.exists('retrato')) {
      const img = this.add.image(0, 0, 'retrato').setDisplaySize(tam, tam);
      // La máscara geométrica usa coordenadas absolutas (el panel vive en MARGEN, MARGEN).
      const mask = this.make.graphics({ x: MARGEN + cx, y: MARGEN + cy, add: false });
      mask.fillStyle(0xffffff).fillCircle(0, 0, r);
      img.setMask(mask.createGeometryMask());
      const ring = this.add.graphics().lineStyle(3, hex(PALETTE.celeste), 1).strokeCircle(0, 0, r);
      c.add([img, ring]);
      this.retratoMask = mask;
      return c;
    }
    const k = tam / 44; // proporciones dibujadas para 44 px
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.celeste), 1).fillCircle(0, 0, r);           // fondo
    g.fillStyle(hex(PALETTE.piel), 1).fillCircle(0, 4 * k, r * 0.62);   // cara
    g.fillStyle(hex(PALETTE.azulGorra), 1);                               // gorra
    g.slice(0, 2 * k, r * 0.68, Phaser.Math.DegToRad(190), Phaser.Math.DegToRad(350), false).fillPath();
    g.fillRoundedRect(-r * 0.75, -3 * k, r * 1.5, 6 * k, 3 * k);          // visera
    g.fillStyle(hex(PALETTE.azulGorraOscuro), 1).fillRoundedRect(-r * 0.75, 1 * k, r * 1.5, 3 * k, 1.5 * k);
    g.fillStyle(hex(PALETTE.linea), 1).fillCircle(-5 * k, 8 * k, 2 * k).fillCircle(5 * k, 8 * k, 2 * k); // ojos
    g.lineStyle(2, hex(PALETTE.linea), 1).beginPath();
    g.arc(0, 11 * k, 5 * k, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false).strokePath(); // sonrisa
    g.lineStyle(3, hex(PALETTE.blanco), 1).strokeCircle(0, 0, r);       // aro
    c.add(g);
    return c;
  }

  // ---------- panel de jugador ----------

  /** Crea (o recrea, al cambiar de orientación) el panel de retrato + puntos + estrellas. */
  crearPanelJugador(compacto) {
    if (this.jugador) {
      this.tweens.killTweensOf(this.puntosText);
      this.jugador.destroy();
      this.retratoMask?.destroy();
      this.retratoMask = null;
    }
    const cfg = compacto ? JUGADOR.vertical : JUGADOR.horizontal;
    const pad = compacto ? 6 : 12;
    const { h, retrato: RETRATO, star: STAR_R } = cfg;
    this.jugadorCompacto = compacto;
    this.jugadorW = cfg.w; this.jugadorH = h;
    this.jugador = this.add.container(MARGEN, MARGEN).setDepth(DEPTH_PANEL);
    const bg = this.panel(this.add.graphics(), cfg.w, h);
    const retrato = this.crearRetrato(pad + RETRATO / 2, h / 2, RETRATO);
    const tx = pad + RETRATO + (compacto ? 8 : 12);
    this.puntosText = this.texto(tx, compacto ? 7 : 12, t('hud.puntos', { n: this.estado.puntos ?? 0 }), cfg.puntos);

    this.estrellas = [];
    this.starR = STAR_R;
    const usarTex = this.textures.exists('star_on') && this.textures.exists('star_off');
    for (let i = 0; i < 3; i++) {
      const cx = tx + STAR_R + i * (STAR_R * 2 + (compacto ? 5 : 6));
      const cy = h - (compacto ? 9 : 12) - STAR_R;
      let obj;
      if (usarTex) {
        obj = this.add.image(cx, cy, 'star_off').setDisplaySize(STAR_R * 2 + 2, STAR_R * 2 + 2);
      } else {
        obj = this.add.graphics();
        obj.cx = cx; obj.cy = cy;
        this.dibujarEstrella(obj, cx, cy, STAR_R, PALETTE.grisClaro);
      }
      this.estrellas.push(obj);
    }
    this.jugador.add([bg, retrato, this.puntosText, ...this.estrellas]);
    this.renderEstrellas();
  }

  // ---------- misiones ----------

  crearPanelMisiones() {
    this.misionesPanel = this.add.container(MARGEN, MARGEN + this.jugadorH + 8).setDepth(DEPTH_PANEL + 1);
    this.misionesBg = this.add.graphics();
    this.misionesTitulo = this.texto(12, 8, t('hud.misiones'), 16, { color: PALETTE.celeste });
    this.misionesFlecha = this.texto(0, 8, '▾', 16, { color: PALETTE.celeste }).setOrigin(1, 0);
    this.misionesPanel.add([this.misionesBg, this.misionesTitulo, this.misionesFlecha]);
    this.misionesItems = []; // {check, texto, progreso}
    // Horizontal: tocar el panel lo pliega (solo la misión activa) o lo despliega.
    this.misionesPanel.setInteractive(new Phaser.Geom.Rectangle(0, 0, PANEL_W, 60), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', (p, lx, ly, ev) => {
        ev?.stopPropagation?.();
        if (Layout.isPortrait(this)) return;
        this.misionesPlegado = !this.misionesPlegado;
        this.renderMisiones();
      });
    this.renderMisiones();
  }

  /** Vertical: "Misión: <activa> n/m" en una línea + botón "?" que despliega la lista. */
  crearMisionLinea() {
    this.misionLinea = this.add.container(MARGEN, 0).setDepth(DEPTH_PANEL).setVisible(false);
    this.misionLineaBg = this.add.graphics();
    this.misionLineaText = this.texto(10, 0, '', 12).setOrigin(0, 0.5);
    this.misionBtn = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(hex(PALETTE.celeste), 1).fillCircle(0, 0, 12);
    bg.lineStyle(2, hex(PALETTE.blanco), 1).strokeCircle(0, 0, 12);
    const q = this.texto(0, 0, '?', 15, { color: PALETTE.marino }).setOrigin(0.5);
    this.misionBtn.add([bg, q]).setSize(...touchSize(28, 28)).setInteractive({ useHandCursor: true })
      .on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); this.desplegarMisiones(); });
    this.misionLinea.add([this.misionLineaBg, this.misionLineaText, this.misionBtn]);
    this.misionLineaH = 28;
  }

  misionesW() { return Layout.isPortrait(this) ? Math.min(PANEL_W, this.scale.width - MARGEN * 2) : PANEL_W; }

  renderMisiones() {
    const todasLista = Array.isArray(this.estado.misiones) ? this.estado.misiones : [];
    const plegado = this.misionesPlegado && !Layout.isPortrait(this);
    // Plegado: solo la misión activa (la primera sin hacer) o, si están todas hechas, la última.
    const activaIdx = todasLista.findIndex((m) => !m.hecho);
    const lista = !plegado ? todasLista
      : todasLista.length ? [todasLista[activaIdx >= 0 ? activaIdx : todasLista.length - 1]] : [];
    const filaH = 26, top = 34;
    const w = this.misionesW();
    const h = top + Math.max(1, lista.length) * filaH + 4;
    this.panel(this.misionesBg, w, h);
    this.misionesFlecha.setPosition(w - 12, 8).setText(plegado ? '▸' : '▾');
    if (this.misionesPanel.input) this.misionesPanel.input.hitArea.setSize(w, h);

    // Crear o reciclar filas
    while (this.misionesItems.length < lista.length) {
      const check = this.add.graphics();
      const texto = this.texto(0, 0, '', 15).setOrigin(0, 0.5);
      const progreso = this.texto(w - 12, 0, '', 14, { color: PALETTE.celeste }).setOrigin(1, 0.5);
      this.misionesPanel.add([check, texto, progreso]);
      this.misionesItems.push({ check, texto, progreso });
    }
    let activaVista = false;
    let activaM = null;
    this.misionesItems.forEach((it, i) => {
      const m = lista[i];
      const visible = !!m;
      it.check.setVisible(visible); it.texto.setVisible(visible); it.progreso.setVisible(visible);
      if (!m) return;
      const y = top + i * filaH + filaH / 2;
      const activa = !m.hecho && !activaVista;
      if (activa) { activaVista = true; activaM = m; }
      const alpha = m.hecho || activa ? 1 : 0.6;

      // Casilla 16×16
      const g = it.check.clear();
      const bx = 12, by = y - 8, s = 16;
      if (m.hecho) {
        g.fillStyle(hex(PALETTE.verde), 1).fillRoundedRect(bx, by, s, s, 4);
        g.lineStyle(2, hex(PALETTE.blanco), 1).strokeRoundedRect(bx, by, s, s, 4);
        g.lineStyle(3, hex(PALETTE.blanco), 1).beginPath();
        g.moveTo(bx + 3.5, by + 8.5); g.lineTo(bx + 7, by + 12); g.lineTo(bx + 13, by + 4.5);
        g.strokePath();
      } else {
        g.fillStyle(hex(PALETTE.gris), alpha).fillRoundedRect(bx, by, s, s, 4);
        g.lineStyle(2, hex(activa ? PALETTE.blanco : PALETTE.grisClaro), alpha).strokeRoundedRect(bx, by, s, s, 4);
      }
      it.texto.setPosition(bx + s + 8, y).setText(m.texto)
        .setColor(m.hecho ? PALETTE.verde : PALETTE.blanco).setAlpha(alpha);
      it.progreso.setPosition(w - 12, y).setText(m.hecho ? '' : (m.progreso || '')).setAlpha(alpha);
    });
    this.misionesH = h;

    // Línea compacta (vertical)
    if (this.misionLineaText) {
      const todas = todasLista.length > 0 && todasLista.every((m) => m.hecho);
      let linea = '';
      if (activaM) linea = t('hud.mision', { texto: activaM.texto }) + (activaM.progreso ? ' ' + activaM.progreso : '');
      else if (todas) linea = t('hud.misionesCompletas');
      this.misionLineaText.setText(linea);
      this.renderMisionLinea();
    }
  }

  renderMisionLinea() {
    if (!this.viva()) return;
    const portrait = Layout.isPortrait(this);
    const mini = HUDScene.rectMinimapa(this);
    // No invadir la columna del minimapa (arranca en mini.x).
    const maxW = Math.max(120, mini.x - 8 - MARGEN);
    const hayTexto = this.misionLineaText.text.length > 0;
    this.misionLineaText.setWordWrapWidth(maxW - 10 - 36, true);
    const h = Math.max(28, this.misionLineaText.height + 10);
    const lw = Math.min(maxW, 10 + this.misionLineaText.width + 36);
    this.misionLineaText.setY(h / 2);
    this.misionLineaBg.clear();
    this.misionLineaBg.fillStyle(hex(PALETTE.marino), 0.88).fillRoundedRect(0, 0, lw, h, Math.min(14, h / 2));
    this.misionLineaBg.lineStyle(2, hex(PALETTE.celeste), 1).strokeRoundedRect(0, 0, lw, h, Math.min(14, h / 2));
    this.misionBtn.setPosition(lw - 16, h / 2);
    this.misionLinea.setVisible(portrait && hayTexto);
    this.misionLineaH = h;
    this.misionLineaW = lw;
  }

  /** Vertical: muestra la lista completa 3 s (bajo la línea de misión). */
  desplegarMisiones() {
    if (!Layout.isPortrait(this)) return;
    if (this.misionesTimer) this.misionesTimer.remove();
    this.misionesDesplegadas = true;
    this.tweens.killTweensOf(this.misionesPanel);
    this.misionesPanel.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.misionesPanel, alpha: ALPHA_PANEL, duration: 150 });
    this.misionesTimer = this.time.delayedCall(MISIONES_DESPLEGADAS_MS, () => this.plegarMisiones());
  }

  plegarMisiones() {
    this.misionesDesplegadas = false;
    if (!Layout.isPortrait(this)) return;
    this.tweens.killTweensOf(this.misionesPanel);
    this.tweens.add({
      targets: this.misionesPanel, alpha: 0, duration: 200,
      onComplete: () => { if (!this.misionesDesplegadas) this.misionesPanel.setVisible(false); },
    });
  }

  // ---------- paneles de la derecha (horizontal): barrio protegido y riesgo de epidemia ----------

  /**
   * Panel con título, % a la derecha, barra y una línea de pie (zona + reloj para el barrio,
   * aviso para la epidemia). Su ancho se fija en `dibujarPanelBarra` (se encoge en pantallas
   * horizontales estrechas para caber lado a lado).
   */
  crearPanelBarra(titulo, colorTitulo, colorBarra, conReloj) {
    const p = { c: this.add.container(0, 0).setDepth(DEPTH_PANEL), w: PANEL_W, h: 74, conReloj, colorBarra };
    p.bg = this.add.graphics();
    p.titulo = this.texto(12, 8, titulo, 15, { color: colorTitulo });
    p.pct = this.texto(PANEL_W - 12, 8, '0%', 16).setOrigin(1, 0);
    p.fondo = this.add.graphics();
    p.fill = this.add.graphics();
    p.pieIzq = this.texto(12, p.h - 21, '', 13, { bold: !conReloj, color: conReloj ? PALETTE.celeste : PALETTE.amarillo }).setOrigin(0, 0);
    p.pieDer = this.texto(PANEL_W - 12, p.h - 21, conReloj ? '00:00' : '', 13, { color: PALETTE.blanco }).setOrigin(1, 0);
    p.c.add([p.bg, p.titulo, p.pct, p.fondo, p.fill, p.pieIzq, p.pieDer]);
    this.dibujarPanelBarra(p, PANEL_W);
    return p;
  }

  dibujarPanelBarra(p, w) {
    p.w = w;
    p.barraX = 12; p.barraY = 32; p.barraW = w - 24; p.barraH = 14;
    this.panel(p.bg, w, p.h);
    p.pct.setX(w - 12);
    p.pieDer.setX(w - 12);
    p.fondo.clear().fillStyle(hex(PALETTE.linea), 0.9).fillRoundedRect(p.barraX, p.barraY, p.barraW, p.barraH, 7);
  }

  /** Rellena la barra grande de un panel de la derecha (color fijo o por nivel de riesgo). */
  rellenarPanelBarra(p, v) {
    const g = p.fill.clear();
    const w = Math.round(p.barraW * Phaser.Math.Clamp(v, 0, 1));
    if (w < 4) return;
    const r = Math.min(7, w / 2);
    const color = p.colorBarra || (v >= 0.85 ? PALETTE.tejaOscura : v >= 0.6 ? PALETTE.teja : PALETTE.amarillo);
    g.fillStyle(hex(color), 1).fillRoundedRect(p.barraX, p.barraY, w, p.barraH, r);
    g.fillStyle(hex(PALETTE.blanco), 0.35).fillRoundedRect(p.barraX + 2, p.barraY + 2, Math.max(0, w - 4), p.barraH * 0.35, 3);
  }

  // ---------- panel central (vertical): reloj + barras finas ----------

  crearPanelCentro() {
    this.centro = this.add.container(0, MARGEN).setDepth(DEPTH_PANEL).setVisible(false);
    this.centroBg = this.add.graphics();
    this.relojText = this.texto(0, 6, '00:00', 20, { align: 'center' }).setOrigin(0.5, 0);
    this.finas = {
      protegido: this.crearBarraFina(t('hud.barrio'), PALETTE.verde, t('hud.barrioCorto')),
      riesgo: this.crearBarraFina(t('hud.riesgo'), ROJO_EPIDEMIA, t('hud.riesgoCorto')),
    };
    this.centro.add([this.centroBg, this.relojText, this.finas.protegido.c, this.finas.riesgo.c]);
    this.centroW = 0; this.centroH = 0;
  }

  crearBarraFina(label, color, labelCorto) {
    const c = this.add.container(0, 0);
    const labelText = this.texto(0, 0, label, 12, { bold: false });
    const pct = this.texto(0, 0, '0%', 12).setOrigin(1, 0.5);
    const fondo = this.add.graphics();
    const fill = this.add.graphics();
    c.add([labelText, fondo, fill, pct]);
    return { c, labelText, pct, fondo, fill, color, label, labelCorto, w: 100, h: 6, y: 15 };
  }

  /** Barra fina: etiqueta arriba; debajo la barra con el % a su derecha. */
  dibujarBarraFina(b, v) {
    const val = Phaser.Math.Clamp(Number(v) || 0, 0, 1);
    const pctW = 32;
    const bw = Math.max(20, b.w - pctW - 4);
    b.fondo.clear().fillStyle(hex(PALETTE.linea), 0.9).fillRoundedRect(0, b.y, bw, b.h, b.h / 2);
    b.fill.clear();
    const w = Math.round(bw * val);
    if (w >= 3) {
      b.fill.fillStyle(hex(b.color), 1).fillRoundedRect(0, b.y, w, b.h, Math.min(b.h / 2, w / 2));
      b.fill.fillStyle(hex(PALETTE.blanco), 0.3).fillRoundedRect(1, b.y + 1, Math.max(0, w - 2), b.h * 0.4, 1.5);
    }
    b.pct.setPosition(b.w, b.y + b.h / 2).setText(`${Math.round(val * 100)}%`);
  }

  // ---------- dato educativo ----------

  crearDato() {
    this.dato = this.add.container(this.scale.width / 2, this.scale.height - MARGEN).setDepth(DEPTH_DATO).setVisible(false).setAlpha(0);
    this.datoBg = this.add.graphics();
    this.datoText = this.texto(0, 0, '', 14, { align: 'center', bold: false, wrap: 480 }).setOrigin(0.5, 1);
    this.dato.add([this.datoBg, this.datoText]);
    this.datoW = 520;
    this.datoTimer = null;
  }

  /**
   * Ancho y línea base (y, borde inferior) del dato educativo. Lado 'abajo' (por defecto): sobre
   * los botones táctiles, sin tocar el joystick. Lado 'arriba' (ver setLadoDato): bajo la HUD,
   * cuando el objetivo está en la mitad inferior de la pantalla.
   */
  datoGeom(w, h) {
    const portrait = Layout.isPortrait(this);
    let g;
    if (this.tactil && portrait) g = { w: w - 2 * MARGEN, y: h - 270 };
    else if (this.tactil) g = { w: Math.min(520, w - 420), y: h - MARGEN };
    else g = { w: Math.min(520, w - 2 * MARGEN), y: h - MARGEN };
    if (this.datoLado === 'arriba') {
      const libre = this.registry.get(HUD_KEY_LIBRE);
      const top = portrait ? DATO_TOP_VERTICAL : Math.max(DATO_TOP_HORIZONTAL, (libre?.y1 ?? 0) + 8);
      const alto = (this.datoText?.height || 20) + 20;
      g.y = Math.min(g.y, top + alto);
    } else if (this.datoTope) {
      // Abajo también está el cartel de detección: el banner se apoya encima de él.
      g.y = Math.min(g.y, this.datoTope);
    }
    return g;
  }

  /**
   * Lado del dato educativo (banner de tips): el opuesto al objetivo para no taparlo.
   * @param {'arriba'|'abajo'} lado
   * @param {number|null} [topeAbajo] y (px) máxima del borde inferior del banner cuando va abajo
   *   (borde superior del cartel de detección si también está abajo); null = sin tope.
   */
  setLadoDato(lado, topeAbajo = null) {
    const l = lado === 'arriba' ? 'arriba' : 'abajo';
    const tope = Number.isFinite(topeAbajo) ? Math.round(topeAbajo) : null;
    if (l === this.datoLado && tope === this.datoTope) return;
    this.datoLado = l;
    this.datoTope = tope;
    if (this.dato?.visible && this.viva()) {
      const y = this.datoGeom(this.scale.width, this.scale.height).y;
      this.tweens.killTweensOf(this.dato);
      this.tweens.add({ targets: this.dato, y, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
    }
  }

  // ---------- paneles que se apartan (v3 §1.3) ----------

  /** Paneles visibles con su rectángulo en píxeles de pantalla. */
  panelesRect() {
    const out = [];
    const add = (obj, w, h) => { if (obj?.visible && w > 0 && h > 0) out.push({ obj, r: { x: obj.x, y: obj.y, w, h } }); };
    add(this.jugador, this.jugadorW, this.jugadorH);
    // En vertical la lista de misiones es efímera (3 s con tween propio): no se atenúa.
    if (!Layout.isPortrait(this)) add(this.misionesPanel, this.misionesW(), this.misionesH);
    add(this.misionLinea, this.misionLineaW || 0, this.misionLineaH);
    add(this.barrio.c, this.barrio.w, this.barrio.h);
    add(this.epidemia.c, this.epidemia.w, this.epidemia.h);
    add(this.centro, this.centroW, this.centroH);
    return out;
  }

  /**
   * Atenúa (alpha 0.25, tween 150 ms) los paneles que tapan alguno de `rects` (jugador, brotes,
   * criaderos activos, en píxeles de pantalla; los calcula GameScene con worldToScreen cada
   * 100 ms) y restaura a 0.9 los que ya no tapan nada.
   * @param {Array<{x:number,y:number,w:number,h:number}>} rects
   */
  evitar(rects) {
    if (!this.viva()) return;
    const lista = Array.isArray(rects) ? rects : [];
    const cruza = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const vistos = new Set();
    for (const { obj, r } of this.panelesRect()) {
      vistos.add(obj);
      const tapa = lista.some((k) => cruza(r, k));
      if (this.evitados.get(obj) === tapa) continue;
      this.evitados.set(obj, tapa);
      this.atenuarPanel(obj, tapa);
    }
    // Paneles que se ocultaron (cambio de orientación): olvidar su estado y dejarlos normales.
    for (const [obj, tapa] of this.evitados) {
      if (!vistos.has(obj)) { this.evitados.delete(obj); if (tapa && obj.active) obj.setAlpha(ALPHA_PANEL); }
    }
  }

  atenuarPanel(obj, tapa) {
    this.tweens.killTweensOf(obj);
    const esEpidemia = obj === this.epidemia.c;
    if (esEpidemia && this.epiPulso) { this.epiPulso.stop(); this.epiPulso = null; }
    this.tweens.add({
      targets: obj, alpha: tapa ? ALPHA_EVITAR : ALPHA_PANEL, duration: EVITAR_MS, ease: 'Sine.easeOut',
      onComplete: () => { if (!tapa && esEpidemia) this.manejarPulsoEpidemia(this.estado.epidemia); },
    });
  }

  // ---------- layout ----------

  reposicionar(w, h) {
    if (!this.viva()) return;
    const portrait = Layout.isPortrait(this);
    if (portrait !== this.jugadorCompacto) this.crearPanelJugador(portrait);
    const mini = HUDScene.rectMinimapa(this);

    if (portrait) {
      // Derecha: libre para minimapa + pausa. Paneles grandes ocultos.
      this.barrio.c.setVisible(false);
      this.epidemia.c.setVisible(false);
      this.registry.set(HUD_KEY_DERECHA_Y, MINIMAPA.top);

      // Centro: entre el panel de jugador y la columna del minimapa.
      const zx0 = MARGEN + this.jugadorW + 6;
      const zx1 = mini.x - 6;
      const centroW = Math.max(96, zx1 - zx0);
      const pad = 6;
      const relojH = this.relojText.height;
      const filaH = 24;
      const centroH = pad + relojH + 2 + filaH * 2 + 2;
      this.panel(this.centroBg, centroW, centroH, 0.88);
      this.centro.setPosition(Math.round(zx0), MARGEN).setVisible(true);
      this.relojText.setPosition(centroW / 2, pad);
      Object.values(this.finas).forEach((b, i) => {
        b.w = centroW - 12;
        b.c.setPosition(6, pad + relojH + 2 + i * filaH);
        // Etiqueta corta si la larga no cabe (siempre ≥ 12 px).
        b.labelText.setText(b.label);
        if (b.labelCorto && b.labelText.width > b.w) b.labelText.setText(b.labelCorto);
      });
      this.dibujarBarraFina(this.finas.protegido, this.barraValor);
      this.dibujarBarraFina(this.finas.riesgo, this.epiValor);
      this.centroW = centroW; this.centroH = centroH;

      // Misiones: una línea bajo los paneles de arriba; lista completa solo desplegada.
      this.renderMisiones();
      const lineaY = MARGEN + Math.max(this.jugadorH, centroH) + 6;
      this.misionLinea.setPosition(MARGEN, lineaY);
      this.misionesPanel.setPosition(MARGEN, lineaY + this.misionLineaH + 6);
      if (!this.misionesDesplegadas) this.misionesPanel.setVisible(false).setAlpha(0);
    } else {
      this.centro.setVisible(false);
      this.misionLinea.setVisible(false);
      this.tweens.killTweensOf(this.misionesPanel);
      this.misionesDesplegadas = false;
      if (this.misionesTimer) { this.misionesTimer.remove(); this.misionesTimer = null; }
      this.renderMisiones();
      this.misionesPanel.setPosition(MARGEN, MARGEN + this.jugadorH + 8).setVisible(true).setAlpha(1);

      // Derecha: barrio (+ offset para PAUSA en táctil) y epidemia al lado si cabe; si el ancho
      // no alcanza con 250 px, los dos paneles se encogen hasta PANEL_MIN_W antes de apilarse.
      const offset = this.tactil ? OFFSET_PAUSA_TACTIL : 0;
      const derecha = w - MARGEN - offset;
      const libre = derecha - (MARGEN + this.jugadorW + 24);
      let pw = PANEL_W;
      let alLado = libre >= 2 * PANEL_W + MARGEN;
      if (!alLado && (libre - MARGEN) / 2 >= PANEL_MIN_W) { pw = Math.floor((libre - MARGEN) / 2); alLado = true; }
      if (pw !== this.barrio.w) { this.dibujarPanelBarra(this.barrio, pw); this.dibujarPanelBarra(this.epidemia, pw); }
      this.rellenarPanelBarra(this.barrio, this.barraValor);
      this.rellenarPanelBarra(this.epidemia, this.epiValor);
      this.barrio.c.setPosition(derecha - pw, MARGEN).setVisible(true);
      if (alLado) {
        this.epidemia.c.setPosition(derecha - pw - MARGEN - pw, MARGEN).setVisible(true);
      } else {
        this.epidemia.c.setPosition(derecha - pw, MARGEN + this.barrio.h + GAP_PANELES).setVisible(true);
      }
      const derechaY = this.epidemia.c.y + this.epidemia.h + 10;
      this.registry.set(HUD_KEY_DERECHA_Y, derechaY);
      this.registry.set(HUD_KEY_LIBRE, {
        x0: MARGEN + this.jugadorW, x1: this.epidemia.c.x, y1: MARGEN + this.barrio.h,
      });
    }

    // Al reacomodar, los paneles vuelven a su alpha: evitar() los reevalúa en la próxima llamada.
    this.evitados.clear();

    // Dato educativo
    const g = this.datoGeom(w, h);
    this.datoW = g.w;
    this.datoText.setWordWrapWidth(g.w - 40, true);
    this.dato.setPosition(w / 2, g.y);
    if (this.dato.visible) this.dibujarDato();
  }

  // ---------- actualización ----------

  /** ¿La escena sigue viva y con sus objetos? (evita usar Text destruidos tras un restart). */
  viva() {
    // En create() el estado es CREATING (isActive() aún es false) y ahí corre el primer reposicionar().
    const st = this.sys?.settings?.status;
    const activa = this.sys && (this.sys.isActive() || st === Phaser.Scenes.CREATING);
    return !!activa && !!this.misionLineaText && this.misionLineaText.active;
  }

  aplicar(key, value) {
    if (!HUD_KEYS.includes(key) || !this.viva()) return;
    const prev = this.estado[key];
    this.estado[key] = value;
    switch (key) {
      case 'puntos':
        this.puntosText.setText(t('hud.puntos', { n: value ?? 0 }));
        if (prev !== undefined && value > prev) this.flashPuntos();
        break;
      case 'estrellas': this.renderEstrellas(); break;
      case 'progreso': this.animarBarra(value); break;
      case 'limpios': case 'total':
        if (this.registry.get('progreso') === undefined && this.estado.total) {
          this.animarBarra(this.estado.limpios / this.estado.total);
        }
        break;
      case 'zona': this.barrio.pieIzq.setText(value || ''); break;
      case 'tiempo': this.setReloj(value); break;
      case 'misiones': this.renderMisiones(); break;
      case 'epidemia': this.animarBarraEpidemia(value); break;
      default: break;
    }
  }

  /** Vuelve a escribir las etiquetas estáticas en el idioma actual (game.events 'lang'). */
  aplicarIdioma() {
    if (!this.viva()) return;
    this.puntosText.setText(t('hud.puntos', { n: this.estado.puntos ?? 0 }));
    this.misionesTitulo.setText(t('hud.misiones'));
    this.barrio.titulo.setText(t('hud.barrio'));
    this.epidemia.titulo.setText(t('hud.riesgo'));
    this.finas.protegido.label = t('hud.barrio'); this.finas.protegido.labelCorto = t('hud.barrioCorto');
    this.finas.riesgo.label = t('hud.riesgo'); this.finas.riesgo.labelCorto = t('hud.riesgoCorto');
    const e = Phaser.Math.Clamp(Number(this.estado.epidemia) || 0, 0, 100);
    this.epidemia.pieIzq.setText(e >= UMBRAL_RIESGO ? t('hud.enRiesgo') : '');
    this.reposicionar(this.scale.width, this.scale.height);
  }

  setReloj(seg) {
    const t = HUDScene.formatoTiempo(seg);
    this.barrio.pieDer.setText(t);
    this.relojText.setText(t);
  }

  /** Aplica el valor 0..1 del barrio a ambas vistas (panel grande y barra fina). */
  pintarBarrio(v) {
    this.barraValor = v;
    this.rellenarPanelBarra(this.barrio, v);
    this.barrio.pct.setText(`${Math.round(v * 100)}%`);
    this.dibujarBarraFina(this.finas.protegido, v);
  }

  /** Aplica el valor 0..1 de riesgo a ambas vistas. */
  pintarEpidemia(v) {
    this.epiValor = v;
    this.rellenarPanelBarra(this.epidemia, v);
    this.epidemia.pct.setText(`${Math.round(v * 100)}%`);
    this.dibujarBarraFina(this.finas.riesgo, v);
  }

  refrescarTodo() {
    this.puntosText.setText(t('hud.puntos', { n: this.estado.puntos ?? 0 }));
    this.renderEstrellas();
    this.renderMisiones();
    const p = this.estado.progreso ?? (this.estado.total ? this.estado.limpios / this.estado.total : 0);
    this.pintarBarrio(p);
    this.barrio.pieIzq.setText(this.estado.zona || '');
    this.setReloj(this.estado.tiempo);

    const e = Phaser.Math.Clamp(Number(this.estado.epidemia) || 0, 0, 100);
    this.pintarEpidemia(e / 100);
    this.epidemia.pieIzq.setText(e >= UMBRAL_RIESGO ? t('hud.enRiesgo') : '');
    this.manejarPulsoEpidemia(e);
  }

  /** Pulso continuo (alpha en loop) cuando el riesgo supera UMBRAL_RIESGO. */
  manejarPulsoEpidemia(valor100) {
    const riesgo = valor100 >= UMBRAL_RIESGO;
    const targets = [this.epidemia.c, this.finas.riesgo.c];
    // Panel atenuado por evitar(): el pulso arranca cuando se restaure (atenuarPanel).
    if (riesgo && !this.epiPulso && !this.evitados?.get(this.epidemia.c)) {
      this.epiPulso = this.tweens.add({
        targets, alpha: 0.55, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if (!riesgo && this.epiPulso) {
      this.epiPulso.stop();
      this.epiPulso = null;
      targets.forEach((t) => t.setAlpha(this.evitados?.get(t) ? ALPHA_EVITAR : 1));
    }
  }

  animarBarraEpidemia(objetivo) {
    const dest = Phaser.Math.Clamp(Number(objetivo) || 0, 0, 100);
    this.manejarPulsoEpidemia(dest);
    this.epidemia.pieIzq.setText(dest >= UMBRAL_RIESGO ? t('hud.enRiesgo') : '');
    if (this.epiBarraTween) this.epiBarraTween.stop();
    const from = { v: this.epiValor * 100 };
    this.epiBarraTween = this.tweens.add({
      targets: from, v: dest, duration: TWEEN_BARRA_MS, ease: 'Sine.easeOut',
      onUpdate: () => this.pintarEpidemia(from.v / 100),
      onComplete: () => this.pintarEpidemia(dest / 100),
    });
  }

  renderEstrellas() {
    const n = Phaser.Math.Clamp(Number(this.estado.estrellas) || 0, 0, 3);
    this.estrellas.forEach((s, i) => {
      const on = i < n;
      if (s.setTexture) {
        s.setTexture(on ? 'star_on' : 'star_off');
      } else {
        s.clear();
        this.dibujarEstrella(s, s.cx, s.cy, this.starR, on ? PALETTE.amarillo : PALETTE.grisClaro);
      }
    });
  }

  animarBarra(objetivo) {
    const dest = Phaser.Math.Clamp(Number(objetivo) || 0, 0, 1);
    if (this.barraTween) this.barraTween.stop();
    const from = { v: this.barraValor };
    this.barraTween = this.tweens.add({
      targets: from, v: dest, duration: TWEEN_BARRA_MS, ease: 'Sine.easeOut',
      onUpdate: () => this.pintarBarrio(from.v),
      onComplete: () => {
        this.pintarBarrio(dest);
        if (dest >= 1) this.pulso(Layout.isPortrait(this) ? this.finas.protegido.pct : this.barrio.pct, 1.3);
      },
    });
  }

  pulso(target, escala = 1.2) {
    this.tweens.add({ targets: target, scale: escala, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Pequeño pulso al sumar puntos (llamable desde GameScene). */
  flashPuntos() {
    if (!this.puntosText) return;
    this.tweens.killTweensOf(this.puntosText);
    const ox = this.puntosText.x, oy = this.puntosText.y;
    this.puntosText.setOrigin(0, 0).setScale(1).setColor(PALETTE.amarillo);
    this.tweens.add({
      targets: this.puntosText, scale: 1.18, duration: 110, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => this.puntosText.setPosition(ox, oy).setScale(1).setColor(PALETTE.blanco),
    });
  }

  /** Redibuja el fondo del dato según el texto y el ancho actuales. */
  dibujarDato() {
    const w = Math.min(this.datoW, this.datoText.width + 40);
    const h = this.datoText.height + 20;
    this.datoBg.clear();
    this.datoBg.fillStyle(hex(PALETTE.marino), 0.92).fillRoundedRect(-w / 2, -h, w, h, RADIO);
    this.datoBg.lineStyle(2, hex(PALETTE.amarillo), 1).strokeRoundedRect(-w / 2, -h, w, h, RADIO);
    this.datoText.setY(-10);
  }

  /**
   * Dato educativo breve (abajo al centro; en táctil, por encima de los botones).
   * @param {string} texto
   * @param {number} ms duración visible (por defecto 4000)
   */
  mostrarDato(texto, ms = 4000) {
    if (!this.dato) return;
    if (this.datoTimer) { this.datoTimer.remove(); this.datoTimer = null; }
    this.tweens.killTweensOf(this.dato);

    this.datoText.setWordWrapWidth(this.datoW - 40, true).setText(texto || '');
    this.dibujarDato();

    const y = this.datoGeom(this.scale.width, this.scale.height).y;
    this.dato.setVisible(true).setY(y + 16);
    this.tweens.add({ targets: this.dato, alpha: 1, y, duration: 200, ease: 'Sine.easeOut' });
    this.datoTimer = this.time.delayedCall(ms, () => this.ocultarDato());
  }

  ocultarDato() {
    if (!this.dato || !this.dato.visible) return;
    const y = this.datoGeom(this.scale.width, this.scale.height).y;
    this.tweens.add({
      targets: this.dato, alpha: 0, y: y + 16, duration: 200, ease: 'Sine.easeIn',
      onComplete: () => this.dato.setVisible(false),
    });
  }

  static formatoTiempo(seg) {
    const s = Math.max(0, Math.floor(Number(seg) || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }
}
