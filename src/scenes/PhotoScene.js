import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';
import { t } from '../i18n/index.js';

const FONT = 'Arial, sans-serif';
const FRAME = 256;

/**
 * Modo foto (v4): el jugador toma una foto REAL con la cámara del dispositivo, o sube una de la
 * galería, y la "procesa" — lo que en este prototipo significa mandarla a la identificación
 * simulada de especies (`CameraScene`, la misma demo "DEMO" que ya usa la cámara IA del juego;
 * ver su JSDoc). No hay análisis real de la imagen: es la misma simulación, aplicada a una foto
 * real en vez de una captura del propio juego — coherente con la regla del proyecto de nunca
 * presentar la demo de IA como un modelo real.
 *
 *   scene.launch('Photo')
 *
 * Emite en 'Game': 'sfx' ('click'), 'foto:cerrar'. Al procesar, lanza 'Camera' con
 * `{ snapshotKey }` (la foto real cargada como textura) y cierra esta escena.
 */
export class PhotoScene extends Phaser.Scene {
  constructor() { super({ key: 'Photo' }); }

  init() {
    this.done = false;
    this.fotoKey = null;
    this.inputs = [];
  }

  sfx(name) { this.scene.get('Game')?.events.emit('sfx', name); }

  create() {
    Layout.onResize(this, (w, h) => this.layout(w, h));
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.events.once('shutdown', () => this.limpiarInputs());
  }

  /** Reconstruye la pantalla (marco + botones) para el tamaño actual del lienzo. */
  layout(W, H) {
    this.root?.destroy();
    const root = this.add.container(0, 0);
    this.root = root;
    const cx = W / 2;

    root.add(this.add.rectangle(cx, H / 2, W, H, hex(PALETTE.marino), 0.96).setInteractive());
    root.add(this.add.text(cx, 40, t('photo.titulo'), {
      fontFamily: FONT, fontSize: 34, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.linea, strokeThickness: 5,
    }).setOrigin(0.5));
    root.add(this.add.text(cx, 74, t('photo.subtitulo'), {
      fontFamily: FONT, fontSize: 14, fontStyle: 'bold', color: PALETTE.celeste,
      align: 'center', wordWrap: { width: W - 40 },
    }).setOrigin(0.5));

    const safe = Layout.safe(this);
    const availW = W - safe.left - safe.right;
    const availH = Math.max(200, H - 100 - 210);
    const frame = Phaser.Math.Clamp(Math.min(availW - 32, availH), 140, FRAME);
    const fy = 100 + frame / 2;
    root.add(this.addFrame(cx, fy, frame));

    let y = fy + frame / 2 + 30;
    const bw = Math.min(220, availW - 24);
    root.add(this.makeButton(cx, y, bw, 52, t('photo.tomar'), PALETTE.azulGorra, PALETTE.azulGorraOscuro, () => this.elegirArchivo(true)));
    y += 62;
    root.add(this.makeButton(cx, y, bw, 52, t('photo.subir'), PALETTE.grisClaro, PALETTE.gris, () => this.elegirArchivo(false)));
    y += 62;

    this.status = this.add.text(cx, y + 6, this.fotoKey ? '' : t('photo.sinCaptura'), {
      fontFamily: FONT, fontSize: 14, fontStyle: 'bold', color: PALETTE.amarillo,
      align: 'center', wordWrap: { width: W - 32 },
    }).setOrigin(0.5, 0);
    root.add(this.status);
    y += 34;

    const procesarW = Math.min(260, availW - 24);
    root.add(this.makeButton(cx, y, procesarW, 56, t('photo.procesar'), PALETTE.verde, PALETTE.verdeOscuro, () => this.procesar(), !this.fotoKey));
    y += 66;
    root.add(this.makeButton(cx, y, 190, 46, t('photo.volver'), PALETTE.grisClaro, PALETTE.gris, () => this.close()));
  }

  /** Marco cuadrado con la foto elegida, o un placeholder si todavía no se eligió ninguna. */
  addFrame(x, y, frame) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - frame / 2 + 6, y - frame / 2 + 8, frame, frame, 12);
    g.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(x - frame / 2 - 6, y - frame / 2 - 6, frame + 12, frame + 12, 12);
    c.add(g);
    if (this.fotoKey && this.textures.exists(this.fotoKey)) {
      c.add(this.add.image(x, y, this.fotoKey).setDisplaySize(frame, frame));
    } else {
      g.fillStyle(hex(PALETTE.gris), 1).fillRect(x - frame / 2, y - frame / 2, frame, frame);
      c.add(this.add.text(x, y, t('photo.sinCaptura'), {
        fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.grisClaro,
        align: 'center', wordWrap: { width: frame - 20 },
      }).setOrigin(0.5));
    }
    return c;
  }

  /**
   * Abre el selector de archivos del sistema: `camara=true` sugiere al navegador abrir la cámara
   * trasera del dispositivo directamente (atributo `capture`, soportado en navegadores móviles;
   * en escritorio simplemente abre el explorador de archivos, que es la degradación esperada).
   */
  elegirArchivo(camara) {
    this.sfx('click');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camara) input.capture = 'environment';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    this.inputs.push(input);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) this.cargarFoto(file);
      input.remove();
      this.inputs = this.inputs.filter((i) => i !== input);
    });
    input.click();
  }

  /** Lee el archivo elegido y lo carga como textura de Phaser para previsualizarlo. */
  cargarFoto(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const key = `foto_real_${Date.now()}`;
      const anterior = this.fotoKey;
      const onReady = () => {
        if (anterior && this.textures.exists(anterior)) this.textures.remove(anterior);
        this.fotoKey = key;
        this.layout(this.scale.width, this.scale.height);
      };
      this.textures.once('addtexture-' + key, onReady);
      this.textures.once('onerror', () => this.setStatus(t('photo.errorCarga')));
      this.textures.addBase64(key, dataUrl);
    };
    reader.onerror = () => this.setStatus(t('photo.errorCarga'));
    reader.readAsDataURL(file);
  }

  limpiarInputs() {
    this.inputs.forEach((i) => i.remove());
    this.inputs = [];
  }

  /** Manda la foto real a la identificación simulada de especies (ver JSDoc de la clase). */
  procesar() {
    if (!this.fotoKey || this.done) return;
    this.sfx('click');
    this.scene.launch('Camera', { snapshotKey: this.fotoKey });
    this.close();
  }

  makeButton(x, y, w, h, label, color, hover, cb, disabled = false) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const draw = (col) => {
      g.clear();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
      g.fillStyle(hex(col), 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      g.lineStyle(2, hex(PALETTE.blanco), 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    draw(disabled ? PALETTE.grisClaro : color);
    const txt = this.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: disabled ? PALETTE.gris : PALETTE.blanco,
    }).setOrigin(0.5);
    if (txt.width > w - 24) txt.setFontSize(Math.max(12, Math.floor(18 * (w - 24) / txt.width)));
    c.add([g, txt]).setSize(...touchSize(w, h));
    if (!disabled) {
      c.setInteractive({ useHandCursor: true })
        .on('pointerover', () => draw(hover))
        .on('pointerout', () => draw(color))
        .on('pointerdown', cb);
    }
    return c;
  }

  setStatus(msg) {
    if (!this.status?.active) return;
    this.status.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.status);
    this.tweens.add({ targets: this.status, alpha: 0, delay: 2200, duration: 400 });
  }

  close() {
    if (this.done) return;
    this.done = true;
    this.sfx('click');
    this.scene.get('Game')?.events.emit('foto:cerrar');
    this.scene.stop();
  }
}
