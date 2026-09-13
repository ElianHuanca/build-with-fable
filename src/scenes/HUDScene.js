import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { esModoTactil } from '../data/ui.js';

const FONT = 'Arial, sans-serif';
const MARGEN = 12;
const PANEL_W = 250;
const RADIO = 12;
const RETRATO = 44;
const STAR_R = 11;
const DEPTH_PANEL = 10;
const DEPTH_DATO = 20;
const TWEEN_BARRA_MS = 450;
/** En modo táctil el panel "Barrio protegido" se corre a la izquierda para dejar sitio al botón PAUSA. */
const OFFSET_PAUSA_TACTIL = 60;

/**
 * Claves del registry que la HUD lee (las escribe GameScene):
 *   puntos (number) · estrellas (0..3) · limpios (number) · total (number)
 *   progreso (0..1) · zona (string) · misiones ({id,texto,hecho,progreso}[]) · tiempo (segundos)
 */
export const HUD_KEYS = ['puntos', 'estrellas', 'limpios', 'total', 'progreso', 'zona', 'misiones', 'tiempo'];

/**
 * Overlay de información (mockup): retrato + puntos + estrellas, misiones con
 * casillas, barra "Barrio protegido" y dato educativo abajo al centro.
 * Se lanza en paralelo: `this.scene.launch('HUD')` desde GameScene.
 * Deja libre el centro superior (x 350–610, y 20–120) para el cartel de detección.
 */
export class HUDScene extends Phaser.Scene {
  constructor() { super({ key: 'HUD' }); }

  create() {
    this.estado = {
      puntos: 0, estrellas: 0, limpios: 0, total: 0, progreso: 0, zona: '', misiones: [], tiempo: 0,
    };
    for (const k of HUD_KEYS) {
      const v = this.registry.get(k);
      if (v !== undefined) this.estado[k] = v;
    }

    this.crearPanelJugador();
    this.crearPanelMisiones();
    this.crearPanelBarrio();
    this.crearDato();

    this.onChange = (parent, key, value) => this.aplicar(key, value);
    this.registry.events.on('changedata', this.onChange);
    this.onResize = (size) => this.reposicionar(size.width, size.height);
    this.scale.on('resize', this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata', this.onChange);
      this.scale.off('resize', this.onResize);
      if (this.datoTimer) this.datoTimer.remove();
    });

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
    g.lineStyle(2, hex(PALETTE.linea), 0.8).strokePoints(pts, true);
  }

  /** Retrato circular: textura 'retrato' si existe; si no, cara con gorra azul. */
  crearRetrato(cx, cy) {
    const r = RETRATO / 2;
    const c = this.add.container(cx, cy);
    if (this.textures.exists('retrato')) {
      const img = this.add.image(0, 0, 'retrato').setDisplaySize(RETRATO, RETRATO);
      // La máscara geométrica usa coordenadas absolutas (el panel vive en MARGEN, MARGEN).
      const mask = this.make.graphics({ x: MARGEN + cx, y: MARGEN + cy, add: false });
      mask.fillStyle(0xffffff).fillCircle(0, 0, r);
      img.setMask(mask.createGeometryMask());
      const ring = this.add.graphics().lineStyle(3, hex(PALETTE.celeste), 1).strokeCircle(0, 0, r);
      c.add([img, ring]);
      return c;
    }
    const g = this.add.graphics();
    g.fillStyle(hex(PALETTE.celeste), 1).fillCircle(0, 0, r);           // fondo
    g.fillStyle(hex(PALETTE.piel), 1).fillCircle(0, 4, r * 0.62);       // cara
    g.fillStyle(hex(PALETTE.azulGorra), 1);                               // gorra
    g.slice(0, 2, r * 0.68, Phaser.Math.DegToRad(190), Phaser.Math.DegToRad(350), false).fillPath();
    g.fillRoundedRect(-r * 0.75, -3, r * 1.5, 6, 3);                      // visera
    g.fillStyle(hex(PALETTE.azulGorraOscuro), 1).fillRoundedRect(-r * 0.75, 1, r * 1.5, 3, 1.5);
    g.fillStyle(hex(PALETTE.linea), 1).fillCircle(-5, 8, 2).fillCircle(5, 8, 2); // ojos
    g.lineStyle(2, hex(PALETTE.linea), 1).beginPath();
    g.arc(0, 11, 5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false).strokePath(); // sonrisa
    g.lineStyle(3, hex(PALETTE.blanco), 1).strokeCircle(0, 0, r);       // aro
    c.add(g);
    return c;
  }

  // ---------- paneles ----------

  crearPanelJugador() {
    const h = 68;
    this.jugador = this.add.container(MARGEN, MARGEN).setDepth(DEPTH_PANEL);
    const bg = this.panel(this.add.graphics(), PANEL_W, h);
    const retrato = this.crearRetrato(12 + RETRATO / 2, h / 2);
    this.puntosText = this.texto(12 + RETRATO + 12, 12, 'Puntos: 0', 18);

    this.estrellas = [];
    const usarTex = this.textures.exists('star_on') && this.textures.exists('star_off');
    for (let i = 0; i < 3; i++) {
      const cx = 12 + RETRATO + 12 + STAR_R + i * (STAR_R * 2 + 6);
      const cy = h - 12 - STAR_R;
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
    this.jugadorH = h;
  }

  crearPanelMisiones() {
    this.misionesPanel = this.add.container(MARGEN, MARGEN + this.jugadorH + 8).setDepth(DEPTH_PANEL);
    this.misionesBg = this.add.graphics();
    this.misionesTitulo = this.texto(12, 8, 'Misiones:', 16, { color: PALETTE.celeste });
    this.misionesPanel.add([this.misionesBg, this.misionesTitulo]);
    this.misionesItems = []; // {check, texto, progreso}
    this.renderMisiones();
  }

  renderMisiones() {
    const lista = Array.isArray(this.estado.misiones) ? this.estado.misiones : [];
    const filaH = 26, top = 34;
    const h = top + Math.max(1, lista.length) * filaH + 4;
    this.panel(this.misionesBg, PANEL_W, h);

    // Crear o reciclar filas
    while (this.misionesItems.length < lista.length) {
      const check = this.add.graphics();
      const texto = this.texto(0, 0, '', 15).setOrigin(0, 0.5);
      const progreso = this.texto(PANEL_W - 12, 0, '', 14, { color: PALETTE.celeste }).setOrigin(1, 0.5);
      this.misionesPanel.add([check, texto, progreso]);
      this.misionesItems.push({ check, texto, progreso });
    }
    let activaVista = false;
    this.misionesItems.forEach((it, i) => {
      const m = lista[i];
      const visible = !!m;
      it.check.setVisible(visible); it.texto.setVisible(visible); it.progreso.setVisible(visible);
      if (!m) return;
      const y = top + i * filaH + filaH / 2;
      const activa = !m.hecho && !activaVista;
      if (activa) activaVista = true;
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
      it.progreso.setPosition(PANEL_W - 12, y).setText(m.hecho ? '' : (m.progreso || '')).setAlpha(alpha);
    });
    this.misionesH = h;
  }

  crearPanelBarrio() {
    const h = 74;
    this.barrioW = PANEL_W + (esModoTactil(this.sys.game) ? OFFSET_PAUSA_TACTIL : 0);
    this.barrio = this.add.container(this.scale.width - MARGEN - this.barrioW, MARGEN).setDepth(DEPTH_PANEL);
    const bg = this.panel(this.add.graphics(), PANEL_W, h);
    const titulo = this.texto(12, 8, 'Barrio protegido', 15, { color: PALETTE.celeste });
    this.pctText = this.texto(PANEL_W - 12, 8, '0%', 16).setOrigin(1, 0);

    // Barra
    this.barraX = 12; this.barraY = 32; this.barraW = PANEL_W - 24; this.barraH = 14;
    const fondo = this.add.graphics();
    fondo.fillStyle(hex(PALETTE.linea), 0.9).fillRoundedRect(this.barraX, this.barraY, this.barraW, this.barraH, 7);
    this.barraFill = this.add.graphics();
    this.barraValor = this.estado.progreso || 0; // valor animado 0..1
    this.dibujarBarra(this.barraValor);

    this.zonaText = this.texto(12, h - 21, '', 13, { bold: false, color: PALETTE.celeste }).setOrigin(0, 0);
    this.tiempoText = this.texto(PANEL_W - 12, h - 21, '00:00', 13, { color: PALETTE.blanco }).setOrigin(1, 0);
    this.barrio.add([bg, titulo, this.pctText, fondo, this.barraFill, this.zonaText, this.tiempoText]);
  }

  dibujarBarra(v) {
    const g = this.barraFill.clear();
    const w = Math.round(this.barraW * Phaser.Math.Clamp(v, 0, 1));
    if (w < 4) return;
    const r = Math.min(7, w / 2);
    g.fillStyle(hex(PALETTE.verde), 1).fillRoundedRect(this.barraX, this.barraY, w, this.barraH, r);
    // Brillo superior
    g.fillStyle(hex(PALETTE.blanco), 0.35).fillRoundedRect(this.barraX + 2, this.barraY + 2, Math.max(0, w - 4), this.barraH * 0.35, 3);
  }

  crearDato() {
    const w = Math.min(520, this.scale.width - 2 * MARGEN);
    this.dato = this.add.container(this.scale.width / 2, this.scale.height - MARGEN).setDepth(DEPTH_DATO).setVisible(false).setAlpha(0);
    this.datoBg = this.add.graphics();
    this.datoText = this.texto(0, 0, '', 14, { align: 'center', bold: false, wrap: w - 40 }).setOrigin(0.5, 1);
    this.dato.add([this.datoBg, this.datoText]);
    this.datoW = w;
    this.datoTimer = null;
  }

  // ---------- actualización ----------

  aplicar(key, value) {
    if (!HUD_KEYS.includes(key)) return;
    const prev = this.estado[key];
    this.estado[key] = value;
    switch (key) {
      case 'puntos':
        this.puntosText.setText(`Puntos: ${value ?? 0}`);
        if (prev !== undefined && value > prev) this.flashPuntos();
        break;
      case 'estrellas': this.renderEstrellas(); break;
      case 'progreso': this.animarBarra(value); break;
      case 'limpios': case 'total':
        if (this.registry.get('progreso') === undefined && this.estado.total) {
          this.animarBarra(this.estado.limpios / this.estado.total);
        }
        break;
      case 'zona': this.zonaText.setText(value || ''); break;
      case 'tiempo': this.tiempoText.setText(HUDScene.formatoTiempo(value)); break;
      case 'misiones': this.renderMisiones(); break;
      default: break;
    }
  }

  refrescarTodo() {
    this.puntosText.setText(`Puntos: ${this.estado.puntos ?? 0}`);
    this.renderEstrellas();
    this.renderMisiones();
    const p = this.estado.progreso ?? (this.estado.total ? this.estado.limpios / this.estado.total : 0);
    this.barraValor = p;
    this.dibujarBarra(p);
    this.pctText.setText(`${Math.round(p * 100)}%`);
    this.zonaText.setText(this.estado.zona || '');
    this.tiempoText.setText(HUDScene.formatoTiempo(this.estado.tiempo));
  }

  renderEstrellas() {
    const n = Phaser.Math.Clamp(Number(this.estado.estrellas) || 0, 0, 3);
    this.estrellas.forEach((s, i) => {
      const on = i < n;
      if (s.setTexture) {
        s.setTexture(on ? 'star_on' : 'star_off');
      } else {
        s.clear();
        this.dibujarEstrella(s, s.cx, s.cy, STAR_R, on ? PALETTE.amarillo : PALETTE.grisClaro);
      }
    });
  }

  animarBarra(objetivo) {
    const dest = Phaser.Math.Clamp(Number(objetivo) || 0, 0, 1);
    if (this.barraTween) this.barraTween.stop();
    const from = { v: this.barraValor };
    this.barraTween = this.tweens.add({
      targets: from, v: dest, duration: TWEEN_BARRA_MS, ease: 'Sine.easeOut',
      onUpdate: () => {
        this.barraValor = from.v;
        this.dibujarBarra(from.v);
        this.pctText.setText(`${Math.round(from.v * 100)}%`);
      },
      onComplete: () => {
        this.barraValor = dest;
        this.dibujarBarra(dest);
        this.pctText.setText(`${Math.round(dest * 100)}%`);
        if (dest >= 1) this.pulso(this.pctText, 1.3);
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

  /**
   * Dato educativo breve abajo al centro.
   * @param {string} texto
   * @param {number} ms duración visible (por defecto 4000)
   */
  mostrarDato(texto, ms = 4000) {
    if (!this.dato) return;
    if (this.datoTimer) { this.datoTimer.remove(); this.datoTimer = null; }
    this.tweens.killTweensOf(this.dato);

    this.datoText.setText(texto || '');
    const w = Math.min(this.datoW, this.datoText.width + 40);
    const h = this.datoText.height + 20;
    this.datoBg.clear();
    this.datoBg.fillStyle(hex(PALETTE.marino), 0.92).fillRoundedRect(-w / 2, -h, w, h, RADIO);
    this.datoBg.lineStyle(2, hex(PALETTE.amarillo), 1).strokeRoundedRect(-w / 2, -h, w, h, RADIO);
    this.datoText.setY(-10);

    this.dato.setVisible(true).setY(this.scale.height - MARGEN + 16);
    this.tweens.add({ targets: this.dato, alpha: 1, y: this.scale.height - MARGEN, duration: 200, ease: 'Sine.easeOut' });
    this.datoTimer = this.time.delayedCall(ms, () => this.ocultarDato());
  }

  ocultarDato() {
    if (!this.dato || !this.dato.visible) return;
    this.tweens.add({
      targets: this.dato, alpha: 0, y: this.scale.height - MARGEN + 16, duration: 200, ease: 'Sine.easeIn',
      onComplete: () => this.dato.setVisible(false),
    });
  }

  reposicionar(width, height) {
    this.barrio.setX(width - MARGEN - this.barrioW);
    this.dato.setPosition(width / 2, height - MARGEN);
  }

  static formatoTiempo(seg) {
    const s = Math.max(0, Math.floor(Number(seg) || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }
}
