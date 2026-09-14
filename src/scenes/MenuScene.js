import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';
import { t } from '../i18n/index.js';

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
    const total = img.displayWidth + gap + txt.width;
    img.setPosition(-total / 2 + img.displayWidth / 2, 0);
    txt.setPosition(-total / 2 + img.displayWidth + gap + txt.width / 2, 0);
    c.add(img);
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
  const { title, w = 520, h = 320, build } = o;
  const W = scene.scale.width, H = scene.scale.height;
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
      x: W / 2, y: jugarY, w: Math.min(W - safe.left - safe.right, 280), h: 64 * ui, label: 'JUGAR', fontSize: 28 * ui,
      color: PALETTE.verde, colorHover: PALETTE.verdeOscuro, radius: 18,
      onClick: () => this.scene.start('LevelSelect'),
    }));

    // CRÉDITOS / CONFIGURACIÓN: en columna en vertical, lado a lado en horizontal.
    const smallY = jugarY + 66 * ui;
    if (portrait) {
      const w = Math.min(W - safe.left - safe.right, 260);
      root.add(makeButton(this, {
        x: W / 2, y: smallY, w, h: 46, label: 'CRÉDITOS', fontSize: 16,
        color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_book',
        onClick: () => this.abrirCreditos(),
      }));
      root.add(makeButton(this, {
        x: W / 2, y: smallY + 56, w, h: 46, label: 'CONFIGURACIÓN', fontSize: 16,
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
        x: W / 2 - bw - 12, y: smallY, w: bw, h: 48, label: 'CRÉDITOS', fontSize: 16,
        color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_book',
        onClick: () => this.abrirCreditos(),
      }));
      root.add(makeButton(this, {
        x: W / 2, y: smallY, w: bw, h: 48, label: t('menu.biblioteca'), fontSize: 16,
        color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_book',
        onClick: () => this.abrirBiblioteca(),
      }));
      root.add(makeButton(this, {
        x: W / 2 + bw + 12, y: smallY, w: bw, h: 48, label: 'CONFIGURACIÓN', fontSize: 16,
        color: PALETTE.marino, colorHover: PALETTE.azulGorraOscuro, icon: 'icon_gear',
        onClick: () => this.abrirConfiguracion(),
      }));
    }

    // Subtítulo
    root.add(this.add.text(W / 2, H - safe.bottom - 18, '¡Juntos contra el dengue!', {
      fontFamily: FONT, fontSize: 24 * ui, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.marino, strokeThickness: 5,
    }).setOrigin(0.5));
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
    const lineas = [
      'Dengue Invaders 2D — prototipo educativo',
      'Datos: SEDES Santa Cruz',
      'Gráficos y sonidos generados para este proyecto',
      'Motor: Phaser 3',
      'Hecho con Claude Code',
    ];
    openModal(this, {
      title: 'Créditos', w: 560, h: 340,
      build: (panel, close) => {
        lineas.forEach((l, i) => {
          panel.add(this.add.text(0, -95 + i * 34, l, {
            fontFamily: FONT, fontSize: i === 0 ? 20 : 18, fontStyle: i === 0 ? 'bold' : 'normal',
            color: i === 0 ? PALETTE.azulGorra : PALETTE.marino,
          }).setOrigin(0.5));
        });
        panel.add(makeButton(this, {
          x: 0, y: 340 / 2 - 44, w: 180, h: 46, label: 'Cerrar', fontSize: 18,
          color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro, onClick: close,
        }));
      },
    });
  }

  abrirConfiguracion() {
    openModal(this, {
      title: 'Configuración', w: 520, h: 320,
      build: (panel, close) => {
        let on = leerSonido();
        panel.add(this.add.text(-190, -50, 'Sonido', {
          fontFamily: FONT, fontSize: 22, fontStyle: 'bold', color: PALETTE.marino,
        }).setOrigin(0, 0.5));
        const btnSonido = makeButton(this, {
          x: 130, y: -50, w: 160, h: 46, label: on ? 'ON' : 'OFF', fontSize: 20,
          color: on ? PALETTE.verde : PALETTE.grisClaro,
          colorHover: on ? PALETTE.verdeOscuro : PALETTE.gris,
          onClick: () => {
            on = !on;
            escribirSonido(on);
            btnSonido.label.setText(on ? 'ON' : 'OFF');
            btnSonido.redraw(on ? PALETTE.verde : PALETTE.grisClaro);
          },
        });
        panel.add(btnSonido);

        panel.add(this.add.text(-190, 20, 'Progreso', {
          fontFamily: FONT, fontSize: 22, fontStyle: 'bold', color: PALETTE.marino,
        }).setOrigin(0, 0.5));
        const info = this.add.text(-190, 48, 'Estrellas y mejores tiempos guardados', {
          fontFamily: FONT, fontSize: 14, color: PALETTE.grisClaro,
        }).setOrigin(0, 0.5);
        panel.add(info);
        const btnBorrar = makeButton(this, {
          x: 130, y: 20, w: 160, h: 46, label: 'Borrar', fontSize: 18,
          color: PALETTE.teja, colorHover: PALETTE.tejaOscura,
          onClick: () => {
            try { localStorage.removeItem(PROGRESO_KEY); } catch { /* sin storage */ }
            import('../systems/SaveSystem.js').then((m) => m.saveSystem?.reset?.()).catch(() => {});
            info.setText('Progreso borrado').setColor(PALETTE.tejaOscura);
            btnBorrar.label.setText('Listo');
          },
        });
        panel.add(btnBorrar);

        panel.add(makeButton(this, {
          x: 0, y: 320 / 2 - 44, w: 180, h: 46, label: 'Cerrar', fontSize: 18,
          color: PALETTE.azulGorra, colorHover: PALETTE.azulGorraOscuro, onClick: close,
        }));
      },
    });
  }
}
