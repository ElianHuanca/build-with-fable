import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';
import { t, getLang, setLang } from '../i18n/index.js';

const FONT = 'Arial, sans-serif';
const SONIDO_KEY = 'dengue.sonido';
const PROGRESO_KEY = 'dengue.progreso';

/**
 * Evento de sonido de UI entre escenas.
 * `scene.events.emit('sfx')` solo llega al AudioManager si fue enlazado a ESA escena
 * (AudioManager.bind(scene)), por eso las escenas de menú emiten en `game.events`:
 *   this.game.events.emit('sfx', 'click')
 * Contrato: AudioManager.init (llamado en BootScene.create, antes del menú) registra
 * `game.events.on('sfx', name => play(name))`. Única vía: no llamar a play() directo,
 * para no reproducir el click dos veces.
 */
export function sfx(scene, name = 'click') {
  scene.game.events.emit('sfx', name);
}

let audioPromise = null;
/** Carga perezosa del AudioManager (tolera que el módulo no exista). Usado por escribirSonido. */
function cargarAudio() {
  if (!audioPromise) {
    audioPromise = import('../systems/AudioManager.js')
      .then((m) => m.AudioManager || m.default || null)
      .catch(() => null);
  }
  return audioPromise;
}

export function leerSonido() {
  try {
    const v = localStorage.getItem(SONIDO_KEY);
    return v === null ? true : v === '1';
  } catch { return true; }
}

export function escribirSonido(on) {
  try { localStorage.setItem(SONIDO_KEY, on ? '1' : '0'); } catch { /* sin storage */ }
  if (window.__audio && typeof window.__audio.setEnabled === 'function') window.__audio.setEnabled(on);
  cargarAudio().then((am) => { if (am && typeof am.setEnabled === 'function') am.setEnabled(on); });
}

/** Reduce la fuente de `txt` hasta que quepa en `maxW` (los textos en inglés pueden ser más largos). */
export function fitText(txt, maxW, fontSize, min = 11) {
  if (txt.width <= maxW) return;
  txt.setFontSize(Math.max(min, Math.floor(fontSize * maxW / txt.width)));
}

/**
 * Botón redondeado con Graphics + Text (+ ícono opcional). Devuelve un Container interactivo.
 * @param {Phaser.Scene} scene
 * @param {object} o  {x,y,w,h,label,color,colorHover,fontSize,icon,onClick,textColor,radius,disabled}
 */
export function makeButton(scene, o) {
  const {
    x, y, w, h, label, color = PALETTE.verde, colorHover = PALETTE.verdeOscuro, fontSize = 20,
    icon = null, onClick = null, textColor = PALETTE.blanco, radius = 14, disabled = false,
  } = o;
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const draw = (col) => {
    bg.clear();
    bg.fillStyle(hex(PALETTE.linea), 0.25).fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, radius); // sombra
    bg.fillStyle(hex(col), 1).fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    bg.lineStyle(3, hex(PALETTE.blanco), 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  };
  draw(color);
  const txt = scene.add.text(0, 0, label, {
    fontFamily: FONT, fontSize, fontStyle: 'bold', color: textColor,
    stroke: PALETTE.linea, strokeThickness: 3,
  }).setOrigin(0.5);
  c.add([bg, txt]);

  let img = null;
  if (icon && scene.textures.exists(icon)) {
    img = scene.add.image(0, 0, icon);
    const s = Math.min((h - 14) / img.height, 1);
    img.setScale(s);
    const gap = 8;
    fitText(txt, w - 24 - img.displayWidth - gap, fontSize);
    const total = img.displayWidth + gap + txt.width;
    img.setPosition(-total / 2 + img.displayWidth / 2, 0);
    txt.setPosition(-total / 2 + img.displayWidth + gap + txt.width / 2, 0);
    c.add(img);
  } else {
    fitText(txt, w - 24, fontSize);
  }

  c.setSize(...touchSize(w, h)); // área táctil ≥ MIN_TOUCH aunque el dibujo sea menor
  if (!disabled) {
    c.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { draw(colorHover); scene.tweens.add({ targets: c, scale: 1.04, duration: 100 }); })
      .on('pointerout', () => { draw(color); scene.tweens.add({ targets: c, scale: 1, duration: 100 }); })
      .on('pointerdown', (p, lx, ly, ev) => {
        ev?.stopPropagation?.();
        sfx(scene, 'click');
        if (onClick) onClick();
      });
  } else {
    c.setAlpha(0.9);
  }
  c.redraw = draw;
  c.label = txt;
  return c;
}

/**
 * Panel modal centrado con título, cuerpo y botones. Devuelve {container, close}.
 * @param {Phaser.Scene} scene
 * @param {{title:string, w?:number, h?:number, build:(c:Phaser.GameObjects.Container, close:()=>void)=>void}} o
 */
export function openModal(scene, o) {
  const { title, h = 320, build } = o;
  const W = scene.scale.width, H = scene.scale.height;
  const w = Math.min(o.w ?? 520, W - 2 * Layout.MARGIN);
  const root = scene.add.container(0, 0).setDepth(5000);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, hex(PALETTE.linea), 0.6).setInteractive();
  dim.on('pointerdown', (p, lx, ly, ev) => ev?.stopPropagation?.());
  const panel = scene.add.container(W / 2, H / 2);
  const g = scene.add.graphics();
  g.fillStyle(hex(PALETTE.linea), 0.3).fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 18);
  g.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  g.lineStyle(4, hex(PALETTE.marino), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
  g.fillStyle(hex(PALETTE.marino), 1).fillRoundedRect(-w / 2, -h / 2, w, 54, { tl: 18, tr: 18, bl: 0, br: 0 });
  const t = scene.add.text(0, -h / 2 + 27, title, {
    fontFamily: FONT, fontSize: 24, fontStyle: 'bold', color: PALETTE.blanco,
  }).setOrigin(0.5);
  fitText(t, w - 40, 24);
  panel.add([g, t]);
  root.add([dim, panel]);

  const close = () => {
    scene.tweens.add({
      targets: panel, scale: 0.85, alpha: 0, duration: 120, ease: 'Sine.easeIn',
      onComplete: () => root.destroy(),
    });
  };
  build(panel, close);
  panel.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  return { container: root, close };
}

/**
 * Menú principal: fondo del barrio, logo, JUGAR, CRÉDITOS y CONFIGURACIÓN.
 * Texturas opcionales: 'menu_bg', 'logo', 'icon_book', 'icon_gear'.
 */
export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    Layout.onResize(this, (w, h) => this.layout(w, h));
    // Cambio de idioma (setLang → game.events 'lang'): redibuja el menú.
    const onLang = () => this.layout(this.scale.width, this.scale.height);
    this.game.events.on('lang', onLang);
    this.events.once('shutdown', () => this.game.events.off('lang', onLang));
    // Atajo de teclado
    this.input.keyboard?.once('keydown-ENTER', () => { sfx(this, 'click'); this.scene.start('LevelSelect'); });
  }

  /** Reconstruye todo el menú para el tamaño actual del lienzo (RESIZE): llamado al crear y en cada resize. */
  layout(W, H) {
    this.root?.destroy();
    const root = this.add.container(0, 0);
    this.root = root;
    const portrait = Layout.isPortrait(this);
    const ui = Layout.ui(this);
    const safe = Layout.safe(this);

    root.add(this.drawBackground(W, H));
    root.add(this.drawLogo(W, H, portrait));

    // JUGAR
    const jugarY = portrait ? H * 0.5 : H * 0.56;
    root.add(makeButton(this, {
      x: W / 2, y: jugarY, w: Math.min(W - safe.left - safe.right, 280), h: 64 * ui, label: t('menu.jugar'), fontSize: 28 * ui,
      color: PALETTE.verde, colorHover: PALETTE.verdeOscuro, radius: 18,
      onClick: () => this.scene.start('LevelSelect'),
    }));

    // CRÉDITOS / CONFIGURACIÓN: en columna en vertical, lado a lado en horizontal.
    const smallY = jugarY + 66 * ui;
    if (portrait) {
      const w = Math.min(W - safe.left - safe.right, 260);
      root.add(makeButton(this, {
        x: W / 2, y: smallY, w, h: 46, label: t('menu.creditos'), fontSize: 16,
        color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_book',
        onClick: () => this.abrirCreditos(),
      }));
      root.add(makeButton(this, {
        x: W / 2, y: smallY + 56, w, h: 46, label: t('menu.configuracion'), fontSize: 16,
        color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_gear',
        onClick: () => this.abrirConfiguracion(),
      }));
      root.add(makeButton(this, {
        x: W / 2, y: smallY + 112, w, h: 46, label: t('menu.biblioteca'), fontSize: 16,
        color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_book',
        onClick: () => this.abrirBiblioteca(),
      }));
    } else {
      const bw = Math.min(200, (W - 40 - 24) / 3);
      root.add(makeButton(this, {
        x: W / 2 - bw - 12, y: smallY, w: bw, h: 48, label: t('menu.creditos'), fontSize: 16,
        color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_book',
        onClick: () => this.abrirCreditos(),
      }));
      root.add(makeButton(this, {
        x: W / 2, y: smallY, w: bw, h: 48, label: t('menu.biblioteca'), fontSize: 16,
        color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_book',
        onClick: () => this.abrirBiblioteca(),
      }));
      root.add(makeButton(this, {
        x: W / 2 + bw + 12, y: smallY, w: bw, h: 48, label: t('menu.configuracion'), fontSize: 16,
        color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_gear',
        onClick: () => this.abrirConfiguracion(),
      }));
    }

    // Subtítulo
    root.add(this.add.text(W / 2, H - safe.bottom - 18, t('menu.lema'), {
      fontFamily: FONT, fontSize: 24 * ui, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.marino, strokeThickness: 5,
    }).setOrigin(0.5));

    // Botón pequeño de idioma (ES/EN) en la esquina superior derecha.
    root.add(this.crearBotonIdioma(W - safe.right - 34, safe.top + 24));
  }

  /** Botón compacto que alterna es ↔ en (ícono 'icon_lang' si existe + etiqueta ES/EN). */
  crearBotonIdioma(x, y) {
    const otro = getLang() === 'en' ? 'es' : 'en';
    const btn = makeButton(this, {
      x, y, w: 68, h: 36, label: t('menu.idiomaBtn'), fontSize: 15, radius: 10,
      color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro,
      icon: this.textures.exists('icon_lang') ? 'icon_lang' : null,
      onClick: () => setLang(otro),
    });
    btn.setName('btn_lang');
    return btn;
  }

  drawBackground(W, H) {
    const objs = [];
    if (this.textures.exists('menu_bg')) {
      const bg = this.add.image(W / 2, H / 2, 'menu_bg');
      const s = Math.max(W / bg.width, H / bg.height);
      bg.setScale(s);
      // Velo suave para que resalten los botones.
      objs.push(bg, this.add.rectangle(W / 2, H / 2, W, H, hex(PALETTE.marino), 0.18));
      return objs;
    }
    // Degradado celeste → verde con manzanas de barrio.
    const g = this.add.graphics();
    g.fillGradientStyle(hex(PALETTE.celeste), hex(PALETTE.celeste), hex('#bfe8a0'), hex('#bfe8a0'), 1);
    g.fillRect(0, 0, W, H);
    // Césped
    g.fillStyle(hex(PALETTE.verde), 1).fillRect(0, H * 0.45, W, H * 0.55);
    // Calles (gris) en cuadrícula
    g.fillStyle(hex(PALETTE.gris), 1);
    for (let y = H * 0.5; y < H; y += 150) g.fillRect(0, y, W, 34);
    for (let x = 80; x < W; x += 260) g.fillRect(x, H * 0.45, 34, H);
    // Casas
    const casas = [[130, 300], [230, 300], [400, 300], [500, 300], [660, 300], [760, 300], [860, 300],
      [130, 450], [260, 450], [400, 450], [560, 450], [700, 450], [850, 450]];
    for (const [cx, cy] of casas) this.drawCasa(g, cx, cy);
    objs.push(g, this.add.rectangle(W / 2, H / 2, W, H, hex(PALETTE.marino), 0.12));
    return objs;
  }

  drawCasa(g, x, y) {
    g.fillStyle(hex(PALETTE.blanco), 1).fillRect(x - 28, y - 10, 56, 42);
    g.fillStyle(hex(PALETTE.teja), 1).fillTriangle(x - 34, y - 10, x + 34, y - 10, x, y - 36);
    g.fillStyle(hex(PALETTE.aguaSucia), 1).fillRect(x - 18, y + 2, 12, 12).fillRect(x + 6, y + 2, 12, 12);
    g.fillStyle(hex(PALETTE.verdeOscuro), 1).fillCircle(x + 44, y + 10, 12);
  }

  drawLogo(W, H, portrait) {
    const y = portrait ? H * 0.2 : H * 0.26;
    let logo;
    if (this.textures.exists('logo')) {
      logo = this.add.image(W / 2, y, 'logo');
      logo.setScale((440 / logo.width) * (portrait ? 0.8 : 1));
    } else {
      logo = this.add.container(W / 2, y);
      const t1 = this.add.text(0, -18, 'DENGUE INVADERS', {
        fontFamily: FONT, fontSize: 56, fontStyle: 'bold', color: PALETTE.amarillo,
        stroke: PALETTE.marino, strokeThickness: 10,
      }).setOrigin(0.5);
      const t2 = this.add.text(0, 34, '2D', {
        fontFamily: FONT, fontSize: 40, fontStyle: 'bold', color: PALETTE.blanco,
        stroke: PALETTE.azulGorra, strokeThickness: 8,
      }).setOrigin(0.5);
      logo.add([t1, t2]);
      if (portrait) logo.setScale(0.8);
    }
    this.tweens.add({ targets: logo, y: y - 8, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return logo;
  }

  /** Abre la Biblioteca SEDES encima del menú (el menú queda pausado y vuelve al cerrarla). */
  abrirBiblioteca() {
    if (this.scene.isActive('Library')) return;
    this.scene.launch('Library', { desde: 'menu' });
    this.scene.pause();
    this.game.events.once('library:cerrar', () => { if (this.scene.isPaused()) this.scene.resume(); });
  }

  abrirCreditos() {
    const lineas = [1, 2, 3, 4, 5].map((i) => t(`menu.creditos.l${i}`));
    const w = Math.min(560, this.scale.width - 2 * Layout.MARGIN);
    openModal(this, {
      title: t('menu.creditos.titulo'), w, h: 340,
      build: (panel, close) => {
        lineas.forEach((l, i) => {
          const txt = this.add.text(0, -95 + i * 34, l, {
            fontFamily: FONT, fontSize: i === 0 ? 20 : 18, fontStyle: i === 0 ? 'bold' : 'normal',
            color: i === 0 ? PALETTE.azulGorra : PALETTE.marino, align: 'center',
          }).setOrigin(0.5);
          fitText(txt, w - 40, i === 0 ? 20 : 18);
          panel.add(txt);
        });
        panel.add(makeButton(this, {
          x: 0, y: 340 / 2 - 44, w: 180, h: 46, label: t('menu.cerrar'), fontSize: 18,
          color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro, onClick: close,
        }));
      },
    });
  }

  abrirConfiguracion() {
    const w = Math.min(520, this.scale.width - 2 * Layout.MARGIN);
    const lx = -w / 2 + 24;          // columna de etiquetas
    const compacto = w < 440;        // en pantallas angostas los controles van bajo la etiqueta
    const H_MODAL = compacto ? 470 : 400;
    const bw = compacto ? Math.min(150, (w - 60) / 2) : 160;
    const rx = compacto ? 0 : w / 2 - 24 - bw / 2; // columna de controles
    const modal = openModal(this, {
      title: t('cfg.titulo'), w, h: H_MODAL,
      build: (panel, close) => {
        const filas = compacto ? [-158, -66, 32] : [-125, -40, 45];
        const etiqueta = (y, key) => this.add.text(lx, y, t(key), {
          fontFamily: FONT, fontSize: 22, fontStyle: 'bold', color: PALETTE.marino,
        }).setOrigin(0, 0.5);
        const cy = (y) => (compacto ? y + 40 : y);

        // Sonido
        let on = leerSonido();
        panel.add(etiqueta(filas[0], 'cfg.sonido'));
        const btnSonido = makeButton(this, {
          x: rx, y: cy(filas[0]), w: bw, h: 42, label: t(on ? 'cfg.on' : 'cfg.off'), fontSize: 20,
          color: on ? PALETTE.verde : PALETTE.grisClaro,
          colorHover: on ? PALETTE.verdeOscuro : PALETTE.gris,
          onClick: () => {
            on = !on;
            escribirSonido(on);
            btnSonido.label.setText(t(on ? 'cfg.on' : 'cfg.off'));
            btnSonido.redraw(on ? PALETTE.verde : PALETTE.grisClaro);
          },
        });
        panel.add(btnSonido);

        // Idioma: [Español] [English]
        panel.add(etiqueta(filas[1], 'cfg.idioma'));
        const lw = compacto ? bw : 118;
        const opciones = [['es', 'Español'], ['en', 'English']];
        opciones.forEach(([code, nombre], i) => {
          const activo = getLang() === code;
          const bx = compacto ? (i === 0 ? -lw / 2 - 5 : lw / 2 + 5) : (w / 2 - 24 - lw / 2 - (1 - i) * (lw + 8));
          panel.add(makeButton(this, {
            x: bx, y: cy(filas[1]), w: lw, h: 42, label: nombre, fontSize: 17,
            color: activo ? PALETTE.verde : PALETTE.grisClaro,
            colorHover: activo ? PALETTE.verdeOscuro : PALETTE.gris,
            onClick: () => {
              if (getLang() === code) return;
              // setLang emite 'lang' → el menú se redibuja; reabrimos el modal traducido.
              modal.close();
              setLang(code);
              this.time.delayedCall(140, () => this.abrirConfiguracion());
            },
          }));
        });

        // Progreso
        panel.add(etiqueta(filas[2], 'cfg.progreso'));
        const info = this.add.text(lx, filas[2] + 26, t('cfg.progresoInfo'), {
          fontFamily: FONT, fontSize: 14, color: PALETTE.grisClaro, wordWrap: { width: compacto ? w - 48 : w - 48 - bw - 16 },
        }).setOrigin(0, 0.5);
        panel.add(info);
        const btnBorrar = makeButton(this, {
          x: rx, y: cy(filas[2]) + (compacto ? 22 : 0), w: bw, h: 42, label: t('cfg.borrar'), fontSize: 18,
          color: PALETTE.teja, colorHover: PALETTE.tejaOscura,
          onClick: () => {
            try { localStorage.removeItem(PROGRESO_KEY); } catch { /* sin storage */ }
            import('../systems/SaveSystem.js').then((m) => m.saveSystem?.reset?.()).catch(() => {});
            info.setText(t('cfg.progresoBorrado')).setColor(PALETTE.tejaOscura);
            btnBorrar.label.setText(t('cfg.listo'));
          },
        });
        panel.add(btnBorrar);

        panel.add(makeButton(this, {
          x: 0, y: H_MODAL / 2 - 40, w: 180, h: 46, label: t('cfg.cerrar'), fontSize: 18,
          color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro, onClick: close,
        }));
      },
    });
  }
}
