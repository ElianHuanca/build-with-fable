import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { FACTS } from '../data/facts.js';
import { AudioManager } from './AudioManager.js';
import { Layout } from './Layout.js';

const FONT = 'Arial, sans-serif';
const DEPTH = 10000;
const DEPTH_MODAL = 20000;
const ROJO = 0xe74c3c;

/**
 * Geometría de los botones: ancla de Layout.anchor + desplazamiento, por orientación.
 * Todos cuelgan de la esquina inferior derecha (ACCIÓN grande; LUPA, CORRER y VEHÍCULO alrededor,
 * sin solaparse entre sí ni con el joystick fijo de abajo-izquierda) salvo PAUSA (arriba-derecha).
 * En horizontal CORRER va a la columna izquierda para no chocar con el minimapa (x ≥ w−160).
 */
const BTN = {
  vertical: {
    accion:   { ancla: 'br', dx: -100, dy: -100, r: 46 },
    lupa:     { ancla: 'br', dx: -190, dy: -130, r: 30 },
    correr:   { ancla: 'br', dx: -100, dy: -200, r: 30 },
    vehiculo: { ancla: 'br', dx: -170, dy: -60,  r: 30 },
  },
  horizontal: {
    accion:   { ancla: 'br', dx: -100, dy: -100, r: 46 },
    lupa:     { ancla: 'br', dx: -190, dy: -130, r: 30 },
    correr:   { ancla: 'br', dx: -200, dy: -210, r: 30 },
    vehiculo: { ancla: 'br', dx: -170, dy: -60,  r: 30 },
  },
};
const PAUSA = { ancla: 'tr', dx: -30, dy: 30, r: 22 };
/** Radios de dibujo (iguales en ambas orientaciones). */
const R = { accion: 46, lupa: 30, correr: 30, vehiculo: 30 };
const LUPA_RECARGA_MS = 3000;
const FLECHA_MS = 2000;
const PRESS_SCALE = 0.92;

/** Botón circular: Graphics + ícono, hit area circular ≥ MIN_TOUCH, animación de "press" y sfx click. */
function crearBoton(scene, x, y, r, color, dibujarIcono) {
  const c = scene.add.container(x, y).setDepth(DEPTH);
  const bg = scene.add.graphics();
  const icono = scene.add.graphics();
  dibujarIcono(icono);
  c.add([bg, icono]);
  c.bg = bg;
  c.icono = icono;
  c.radio = r;
  c.pintar = (fill, alphaFill = 1, borde = PALETTE.marino, grosor = 4) => {
    bg.clear();
    bg.fillStyle(hex(fill), alphaFill).fillCircle(0, 0, r);
    bg.lineStyle(grosor, hex(borde), 1).strokeCircle(0, 0, r);
  };
  c.pintar(color);
  const hr = Math.max(r, touchSize(0, 0)[0] / 2);
  c.setInteractive(new Phaser.Geom.Circle(0, 0, hr), Phaser.Geom.Circle.Contains);
  c.setScrollFactor(0, 0, true);
  c.habilitado = true;
  c.setHabilitado = (on) => {
    c.habilitado = !!on;
    if (c.habilitado) c.setInteractive(); else c.disableInteractive();
  };
  const soltar = () => { if (c.active) c.setScale(1); };
  c.on('pointerdown', (p, lx, ly, ev) => {
    ev?.stopPropagation?.();
    c.setScale(PRESS_SCALE);
    scene.events.emit('sfx', 'click');
  });
  c.on('pointerup', soltar);
  c.on('pointerout', soltar);
  return c;
}

/** Gota celeste tachada con una línea roja diagonal (ícono del botón ACCIÓN). */
function iconoGota(g) {
  g.fillStyle(hex(PALETTE.celeste), 1);
  g.fillCircle(0, 7, 13);
  g.fillTriangle(-12, 3, 12, 3, 0, -18);
  g.lineStyle(2, hex(PALETTE.marino), 1).strokeCircle(0, 7, 13);
  g.fillStyle(hex(PALETTE.blanco), 0.7).fillCircle(-5, 8, 3);
  g.lineStyle(5, ROJO, 1).beginPath();
  g.moveTo(-18, 18); g.lineTo(18, -18);
  g.strokePath();
}

function iconoLupa(g) {
  g.lineStyle(4, hex(PALETTE.marino), 1).strokeCircle(-3, -3, 9);
  g.fillStyle(hex(PALETTE.blanco), 0.5).fillCircle(-3, -3, 7);
  g.lineStyle(5, hex(PALETTE.marino), 1).beginPath();
  g.moveTo(4, 4); g.lineTo(13, 13);
  g.strokePath();
}

function iconoCorrer(g) {
  g.lineStyle(4, hex(PALETTE.marino), 1);
  for (const ox of [-9, 3]) {
    g.beginPath();
    g.moveTo(ox, -10); g.lineTo(ox + 8, 0); g.lineTo(ox, 10);
    g.strokePath();
  }
}

/** Camioneta vista de 3/4 (carrocería + ruedas), ícono del botón VEHÍCULO. */
function iconoVehiculo(g) {
  g.fillStyle(hex(PALETTE.blanco), 1);
  g.fillRoundedRect(-15, -6, 30, 13, 3);
  g.fillRoundedRect(-15, -14, 17, 9, 2);
  g.lineStyle(2, hex(PALETTE.marino), 1);
  g.strokeRoundedRect(-15, -6, 30, 13, 3);
  g.strokeRoundedRect(-15, -14, 17, 9, 2);
  g.fillStyle(hex(PALETTE.marino), 1);
  g.fillCircle(-8, 8, 4);
  g.fillCircle(8, 8, 4);
}

function iconoPausa(g) {
  g.fillStyle(hex(PALETTE.blanco), 1);
  g.fillRoundedRect(-8, -9, 6, 18, 2);
  g.fillRoundedRect(2, -9, 6, 18, 2);
}

/**
 * Controles táctiles estilo Brawl Stars (solo en modo táctil; ver `esModoTactil` en data/ui.js):
 *  - ACCIÓN (grande, abajo-derecha): igual que la tecla E. Estados apagado / activo (anillo
 *    pulsante) / ocupado según `{ activo, limpiando }` que GameScene pasa en `update()`.
 *  - LUPA: con criadero activo muestra el dato educativo en el HUD; sin criadero, una flecha
 *    alrededor del jugador hacia el criadero no limpio más cercano y "Criadero a N m" (2 s).
 *    Recarga 3 s.
 *  - CORRER: sprint mientras se mantiene presionado (`player.setSprint`), con anillo de energía.
 *  - VEHÍCULO: sube/baja de la camioneta. Solo expone el botón y el callback; GameScene decide
 *    si el jugador está cerca del vehículo o de la estación.
 *  - PAUSA (arriba-derecha): abre el `PauseMenu`.
 * Todo con Graphics/Text, `scrollFactor 0` (también en los hijos interactivos) y depth alto.
 */
export class TouchControls {
  /**
   * @param {Phaser.Scene} scene GameScene (usa `player`, `criaderoMasCercano()`)
   * @param {{ onAccion: () => void, onPausa: () => void, onVehiculo?: () => void }} opts
   */
  constructor(scene, opts) {
    this.scene = scene;
    this.onAccion = opts.onAccion;
    this.onPausa = opts.onPausa;
    this.onVehiculo = opts.onVehiculo;
    this.estado = 'apagado';
    this.lupaHasta = 0;
    this.flechaHasta = 0;
    this.flechaObjetivo = null;
    this.energiaDibujada = -1;

    // ---- ACCIÓN ----
    this.anillo = scene.add.circle(0, 0, R.accion, 0x000000, 0)
      .setStrokeStyle(4, hex(PALETTE.amarillo), 0.9).setScrollFactor(0).setDepth(DEPTH - 1).setVisible(false);
    this.accion = crearBoton(scene, 0, 0, R.accion, PALETTE.amarillo, iconoGota);
    this.accion.on('pointerdown', () => { if (this.estado === 'activo') this.onAccion?.(); });
    this.anilloTween = scene.tweens.add({
      targets: this.anillo, scale: 1.45, alpha: 0, duration: 900, repeat: -1, ease: 'Sine.easeOut', paused: true,
    });

    // ---- LUPA ----
    this.lupa = crearBoton(scene, 0, 0, R.lupa, PALETTE.celeste, iconoLupa);
    this.lupa.on('pointerdown', () => this.usarLupa());

    // ---- CORRER ----
    this.correr = crearBoton(scene, 0, 0, R.correr, PALETTE.verde, iconoCorrer);
    this.energiaArco = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.correrPointerId = null;
    this.correr.on('pointerdown', (p) => { this.correrPointerId = p.id; scene.player?.setSprint(true); });
    const soltarCorrer = (p) => {
      if (this.correrPointerId !== null && (!p || p.id === this.correrPointerId)) {
        this.correrPointerId = null;
        scene.player?.setSprint(false);
      }
    };
    this.correr.on('pointerup', soltarCorrer);
    this.correr.on('pointerout', soltarCorrer);
    scene.input.on('pointerup', soltarCorrer);
    scene.input.on('pointerupoutside', soltarCorrer);

    // ---- VEHÍCULO ----
    this.vehiculo = crearBoton(scene, 0, 0, R.vehiculo, PALETTE.azulGorra, iconoVehiculo);
    this.vehiculo.on('pointerdown', () => this.onVehiculo?.());

    // ---- PAUSA ----
    this.pausa = crearBoton(scene, 0, 0, PAUSA.r, PALETTE.marino, iconoPausa);
    this.pausa.pintar(PALETTE.marino, 0.85, PALETTE.celeste, 3);
    this.pausa.on('pointerdown', () => this.onPausa?.());

    // ---- Flecha + texto de la lupa (coordenadas de mundo) ----
    this.flecha = scene.add.graphics().setDepth(DEPTH - 2).setVisible(false);
    this.flecha.fillStyle(hex(PALETTE.amarillo), 1).fillTriangle(18, 0, -8, -11, -8, 11);
    this.flecha.lineStyle(2, hex(PALETTE.marino), 1).strokeTriangle(18, 0, -8, -11, -8, 11);
    this.flechaTexto = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: 15, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.marino, strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH - 2).setVisible(false);

    this.todos = [this.accion, this.lupa, this.correr, this.vehiculo, this.pausa, this.anillo, this.energiaArco];
    this.setEstado('apagado');

    this.offResize = Layout.onResize(scene, () => this.reposicionar());
    scene.events.once('shutdown', () => {
      this.offResize?.();
      scene.input.off('pointerup', soltarCorrer);
      scene.input.off('pointerupoutside', soltarCorrer);
    });
  }

  /** Geometría vigente según orientación (Layout.isPortrait). */
  geometria() { return Layout.isPortrait(this.scene) ? BTN.vertical : BTN.horizontal; }

  reposicionar() {
    const scene = this.scene;
    const g = this.geometria();
    for (const k of Object.keys(g)) {
      const { ancla, dx, dy } = g[k];
      const { x, y } = Layout.anchor(scene, ancla, dx, dy);
      this[k].setPosition(Math.round(x), Math.round(y));
    }
    this.anillo.setPosition(this.accion.x, this.accion.y);
    const p = Layout.anchor(scene, PAUSA.ancla, PAUSA.dx, PAUSA.dy);
    this.pausa.setPosition(Math.round(p.x), Math.round(p.y));
    this.energiaDibujada = -1;
  }

  /** @param {'apagado'|'activo'|'ocupado'} estado */
  setEstado(estado) {
    if (estado === this.estado) return;
    this.estado = estado;
    const b = this.accion;
    if (estado === 'activo') {
      b.pintar(PALETTE.amarillo, 1);
      b.setAlpha(1).setHabilitado(true);
      this.anillo.setPosition(b.x, b.y).setVisible(true).setScale(1).setAlpha(0.9);
      this.anilloTween.restart();
      this.anilloTween.resume();
    } else {
      this.anilloTween.pause();
      this.anillo.setVisible(false);
      if (estado === 'ocupado') {
        b.pintar(PALETTE.amarillo, 1);
        b.setAlpha(0.6).setHabilitado(false);
      } else {
        b.pintar(PALETTE.grisClaro, 1);
        b.setAlpha(0.4).setHabilitado(false);
      }
    }
  }

  /** Bloquea lupa/correr/pausa durante la limpieza. */
  setBloqueados(bloq) {
    if (this._bloq === bloq) return;
    this._bloq = bloq;
    for (const b of [this.lupa, this.correr, this.pausa]) {
      b.setHabilitado(!bloq);
      b.setAlpha(bloq ? 0.6 : 1);
    }
    if (bloq) { this.correrPointerId = null; this.scene.player?.setSprint(false); }
    this.pintarLupa();
  }

  pintarLupa() {
    const enRecarga = this.scene.time.now < this.lupaHasta;
    this.lupa.pintar(enRecarga ? PALETTE.grisClaro : PALETTE.celeste, 1);
    if (!this._bloq) this.lupa.setHabilitado(!enRecarga);
  }

  usarLupa() {
    const scene = this.scene;
    if (scene.time.now < this.lupaHasta) return;
    this.lupaHasta = scene.time.now + LUPA_RECARGA_MS;
    this.pintarLupa();
    scene.time.delayedCall(LUPA_RECARGA_MS, () => this.pintarLupa());

    const activo = scene.activo;
    if (activo && FACTS[activo.type]) {
      scene.scene.get('HUD')?.mostrarDato?.(FACTS[activo.type].dato);
      return;
    }
    const objetivo = scene.criaderoMasCercano?.();
    if (!objetivo) {
      scene.scene.get('HUD')?.mostrarDato?.('¡No quedan criaderos en el barrio!', 2000);
      return;
    }
    this.flechaObjetivo = objetivo;
    this.flechaHasta = scene.time.now + FLECHA_MS;
    this.flecha.setVisible(true);
    this.flechaTexto.setVisible(true);
    this.actualizarFlecha();
  }

  actualizarFlecha() {
    const { player } = this.scene;
    const c = this.flechaObjetivo;
    if (!c || !player) return;
    const ang = Phaser.Math.Angle.Between(player.x, player.y, c.x, c.y);
    const R = 56;
    this.flecha.setPosition(player.x + Math.cos(ang) * R, player.y + Math.sin(ang) * R).setRotation(ang);
    const metros = Math.round(Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y) / 64);
    this.flechaTexto.setPosition(player.x, player.y - 58).setText(`Criadero a ${metros} m`);
  }

  /** Dibuja el anillo de energía alrededor de CORRER. */
  dibujarEnergia(e) {
    const v = Phaser.Math.Clamp(e, 0, 1);
    if (Math.abs(v - this.energiaDibujada) < 0.01) return;
    this.energiaDibujada = v;
    const g = this.energiaArco.clear();
    const r = R.correr + 6, x = this.correr.x, y = this.correr.y;
    g.lineStyle(5, hex(PALETTE.linea), 0.5).strokeCircle(x, y, r);
    if (v <= 0) return;
    const inicio = -Math.PI / 2;
    g.lineStyle(5, hex(v < 0.3 ? PALETTE.teja : PALETTE.verde), 1).beginPath();
    g.arc(x, y, r, inicio, inicio + Math.PI * 2 * v, false);
    g.strokePath();
  }

  /** Llamar cada frame desde GameScene.update(). */
  update({ activo, limpiando }) {
    this.setEstado(limpiando ? 'ocupado' : activo ? 'activo' : 'apagado');
    this.setBloqueados(!!limpiando);
    if (this.scene.player) this.dibujarEnergia(this.scene.player.energia);
    if (this.flechaObjetivo) {
      if (this.scene.time.now >= this.flechaHasta || this.flechaObjetivo.state === 'limpio') {
        this.flechaObjetivo = null;
        this.flecha.setVisible(false);
        this.flechaTexto.setVisible(false);
      } else {
        this.actualizarFlecha();
      }
    }
  }

  /** Objetos a ocultar en las fotos (snapshot) del juego. */
  overlays() { return [...this.todos, this.flecha, this.flechaTexto]; }

  setVisible(v) { for (const o of this.todos) o.setVisible(v && (o !== this.anillo || this.estado === 'activo')); }

  destroy() {
    this.anilloTween?.stop();
    for (const o of [...this.todos, this.flecha, this.flechaTexto]) o.destroy();
  }
}

/**
 * Menú de pausa (Graphics/Text en la propia GameScene): "Continuar", "Sonido ON/OFF" y
 * "Salir al menú". Lo abren el botón PAUSA (táctil) y Esc (escritorio; Esc también lo cierra).
 * Al abrir pausa la física, oculta el HUD y congela el reloj (GameScene lo consulta con `abierta`).
 */
export class PauseMenu {
  /** @param {{ onSalir: () => void }} opts */
  constructor(scene, opts) {
    this.scene = scene;
    this.onSalir = opts.onSalir;
    this.abierta = false;
    const W = scene.scale.width, H = scene.scale.height;

    this.dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(DEPTH_MODAL).setVisible(false).setInteractive();
    this.dim.on('pointerdown', (p, lx, ly, ev) => ev?.stopPropagation?.());

    const PW = 320, PH = 270;
    this.panel = scene.add.container(W / 2, H / 2).setDepth(DEPTH_MODAL + 1).setVisible(false);
    const bg = scene.add.graphics();
    bg.fillStyle(hex(PALETTE.marino), 0.96).fillRoundedRect(-PW / 2, -PH / 2, PW, PH, 16);
    bg.lineStyle(3, hex(PALETTE.celeste), 1).strokeRoundedRect(-PW / 2, -PH / 2, PW, PH, 16);
    const titulo = scene.add.text(0, -PH / 2 + 28, 'Pausa', {
      fontFamily: FONT, fontSize: 26, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    this.panel.add([bg, titulo]);

    const filaY = (i) => -PH / 2 + 78 + i * 60;
    this.btnContinuar = this.boton(0, filaY(0), 'Continuar', PALETTE.verde, () => this.cerrar());
    this.btnSonido = this.boton(0, filaY(1), '', PALETTE.celeste, () => {
      AudioManager.setEnabled(!AudioManager.enabled);
      this.refrescarSonido();
    });
    this.btnSalir = this.boton(0, filaY(2), 'Salir al menú', PALETTE.teja, () => { this.cerrar(); this.onSalir?.(); });
    this.panel.add([this.btnContinuar, this.btnSonido, this.btnSalir]);
    this.panel.setScrollFactor(0, 0, true);
    this.refrescarSonido();

    this.onResize = (size) => {
      this.dim.setPosition(size.width / 2, size.height / 2).setSize(size.width, size.height);
      this.panel.setPosition(size.width / 2, size.height / 2);
    };
    scene.scale.on('resize', this.onResize);
    scene.events.once('shutdown', () => scene.scale.off('resize', this.onResize));
  }

  boton(x, y, texto, color, onPress) {
    const BW = 240, BH = 46;
    const c = this.scene.add.container(x, y);
    const g = this.scene.add.graphics();
    const pintar = (col) => {
      g.clear();
      g.fillStyle(hex(col), 1).fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 12);
      g.lineStyle(2, hex(PALETTE.blanco), 0.6).strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 12);
    };
    pintar(color);
    const t = this.scene.add.text(0, 0, texto, {
      fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    c.add([g, t]);
    c.label = t;
    c.setSize(...touchSize(BW, BH)).setInteractive({ useHandCursor: true });
    c.setScrollFactor(0, 0, true);
    c.on('pointerdown', (p, lx, ly, ev) => {
      ev?.stopPropagation?.();
      c.setScale(PRESS_SCALE);
      this.scene.events.emit('sfx', 'click');
    });
    c.on('pointerup', () => { c.setScale(1); onPress(); });
    c.on('pointerout', () => c.setScale(1));
    return c;
  }

  refrescarSonido() {
    this.btnSonido.label.setText(`Sonido: ${AudioManager.enabled ? 'ON' : 'OFF'}`);
  }

  abrir() {
    if (this.abierta) return;
    this.abierta = true;
    const s = this.scene;
    s.physics.pause();
    s.player?.setVelocity(0);
    s.player?.setSprint?.(false);
    if (s.player) s.player.play(`idle_${s.player.dir}`, true);
    const hud = s.scene.get('HUD');
    this.hudVisible = !!hud?.sys?.settings?.visible;
    if (this.hudVisible) hud.sys.setVisible(false);
    this.refrescarSonido();
    this.dim.setVisible(true);
    this.panel.setVisible(true).setScale(0.85).setAlpha(0);
    s.tweens.add({ targets: this.panel, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
  }

  cerrar() {
    if (!this.abierta) return;
    this.abierta = false;
    const s = this.scene;
    s.physics.resume();
    const hud = s.scene.get('HUD');
    if (this.hudVisible && hud?.sys) hud.sys.setVisible(true);
    this.dim.setVisible(false);
    this.panel.setVisible(false);
  }

  toggle() { if (this.abierta) this.cerrar(); else this.abrir(); }

  destroy() {
    this.dim.destroy();
    this.panel.destroy();
  }
}
