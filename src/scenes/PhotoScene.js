import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { touchSize } from '../data/ui.js';
import { Layout } from '../systems/Layout.js';

const FONT = 'Arial, sans-serif';
const ROJO = '#e74c3c';
const FRAME = 256;
const SHARE_TEXT = '¡Eliminé criaderos de dengue en mi barrio! Juega Dengue Invaders y protege tu comunidad. #SinCriaderosNoHayDengue';

/**
 * Modo foto: antes/después del último criadero.
 * scene.launch('Photo', { antes: 'foto_antes', despues: 'foto_despues' })
 * Emite en 'Game': 'sfx' ('click'), 'foto:cerrar'.
 */
export class PhotoScene extends Phaser.Scene {
  constructor() { super({ key: 'Photo' }); }

  init(data = {}) {
    this.antesKey = data.antes ?? 'foto_antes';
    this.despuesKey = data.despues ?? 'foto_despues';
    this.done = false;
    this.busy = false;
  }

  sfx(name) { this.scene.get('Game')?.events.emit('sfx', name); }

  create() {
    Layout.onResize(this, (w, h) => this.layout(w, h));
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  /** Reconstruye la pantalla (marcos + botones) para el tamaño actual del lienzo. */
  layout(W, H) {
    this.root?.destroy();
    const root = this.add.container(0, 0);
    this.root = root;
    const cx = W / 2;

    root.add(this.add.rectangle(cx, H / 2, W, H, hex(PALETTE.marino), 0.96).setInteractive());
    root.add(this.add.text(cx, 40, 'Modo foto', {
      fontFamily: FONT, fontSize: 34, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.linea, strokeThickness: 5,
    }).setOrigin(0.5));

    // Los marcos se dimensionan según el espacio disponible: en vertical se apilan,
    // en horizontal quedan lado a lado (como el diseño original a 960×540).
    const portrait = Layout.isPortrait(this);
    const safe = Layout.safe(this);
    const topY = 90;
    const bottomReserve = 170; // botón cámara + estado + botones inferiores
    const availW = W - safe.left - safe.right;
    const availH = Math.max(200, H - topY - bottomReserve);

    let frame, fyAntes, fyDespues, gap = 0;
    if (portrait) {
      frame = Phaser.Math.Clamp(Math.min(availW - 32, availH / 2 - 30), 90, FRAME);
      fyAntes = topY + frame / 2;
      fyDespues = fyAntes + frame + 50;
    } else {
      frame = Phaser.Math.Clamp(Math.min((availW - 80) / 2, availH), 110, FRAME);
      gap = frame / 2 + 40;
      fyAntes = topY + frame / 2;
      fyDespues = fyAntes;
    }
    root.add(this.addFrame(portrait ? cx : cx - gap, fyAntes, this.antesKey, 'Antes', ROJO, frame));
    root.add(this.addFrame(portrait ? cx : cx + gap, fyDespues, this.despuesKey, 'Después', PALETTE.verde, frame));
    const frameBottom = Math.max(fyAntes, fyDespues) + frame / 2;

    if (this.textures.exists('spark')) {
      root.add(this.add.particles(portrait ? cx : cx + gap, fyDespues, 'spark', {
        x: { min: -frame / 2, max: frame / 2 }, y: { min: -frame / 2, max: frame / 2 },
        lifespan: 900, speed: { min: 5, max: 30 }, scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 }, frequency: 120, blendMode: 'ADD',
      }));
    }

    // Botón cámara circular blanco
    const camY = frameBottom + 46;
    const cam = this.add.container(cx, camY);
    const cg = this.add.graphics();
    const drawCam = (col) => {
      cg.clear();
      cg.fillStyle(0x000000, 0.3).fillCircle(0, 4, 34);
      cg.fillStyle(hex(col), 1).fillCircle(0, 0, 34);
      cg.lineStyle(3, hex(PALETTE.marino), 1).strokeCircle(0, 0, 34);
      cg.fillStyle(hex(PALETTE.marino), 1);
      cg.fillRoundedRect(-18, -9, 36, 26, 5);
      cg.fillRoundedRect(-7, -15, 14, 8, 2);
      cg.fillStyle(hex(col), 1).fillCircle(0, 4, 8);
      cg.fillStyle(hex(PALETTE.marino), 1).fillCircle(0, 4, 4);
    };
    drawCam(PALETTE.blanco);
    cam.add(cg).setSize(...touchSize(80, 80)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => drawCam(PALETTE.celeste))
      .on('pointerout', () => drawCam(PALETTE.blanco))
      .on('pointerdown', () => this.download());
    root.add(cam);

    this.status = this.add.text(cx, H - 110, '', {
      fontFamily: FONT, fontSize: 15, fontStyle: 'bold', color: PALETTE.amarillo,
    }).setOrigin(0.5);
    root.add(this.status);

    root.add(this.makeButton(cx - 150, H - 50, 190, 52, 'Volver', PALETTE.grisClaro, PALETTE.gris, () => this.close()));
    root.add(this.makeButton(cx + 150, H - 50, 190, 52, 'Compartir', PALETTE.azulGorra, PALETTE.azulGorraOscuro, () => this.share()));
  }

  addFrame(x, y, key, label, color, frame = FRAME) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - frame / 2 + 6, y - frame / 2 + 8, frame, frame, 12);
    g.fillStyle(hex(PALETTE.blanco), 1).fillRoundedRect(x - frame / 2 - 6, y - frame / 2 - 6, frame + 12, frame + 12, 12);
    c.add(g);
    if (this.textures.exists(key)) {
      c.add(this.add.image(x, y, key).setDisplaySize(frame, frame));
    } else {
      g.fillStyle(hex(PALETTE.gris), 1).fillRect(x - frame / 2, y - frame / 2, frame, frame);
      c.add(this.add.text(x, y, 'Sin captura', {
        fontFamily: FONT, fontSize: 20, fontStyle: 'bold', color: PALETTE.grisClaro,
      }).setOrigin(0.5));
    }
    const tag = this.add.text(x, y - frame / 2 - 2, label, {
      fontFamily: FONT, fontSize: 20, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    const tw = tag.width + 28, th = tag.height + 8;
    const tg = this.add.graphics();
    tg.fillStyle(hex(color), 1).fillRoundedRect(x - tw / 2, y - frame / 2 - 2 - th / 2, tw, th, 9);
    tg.lineStyle(2, hex(PALETTE.blanco), 1).strokeRoundedRect(x - tw / 2, y - frame / 2 - 2 - th / 2, tw, th, 9);
    c.add([tg, tag]);
    tag.setDepth(1);
    return c;
  }

  makeButton(x, y, w, h, label, color, hover, cb) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const draw = (col) => {
      g.clear();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
      g.fillStyle(hex(col), 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      g.lineStyle(2, hex(PALETTE.blanco), 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    draw(color);
    const t = this.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: 20, fontStyle: 'bold', color: PALETTE.blanco,
    }).setOrigin(0.5);
    c.add([g, t]).setSize(...touchSize(w, h)).setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(hover))
      .on('pointerout', () => draw(color))
      .on('pointerdown', cb);
    return c;
  }

  /** Compone antes/después en un RenderTexture y devuelve el snapshot (HTMLImageElement) por callback. */
  compose(cb) {
    const M = 16, LBL = 40;
    const w = FRAME * 2 + M * 3, h = FRAME + LBL + M * 2;
    const rt = this.add.renderTexture(0, 0, w, h).setOrigin(0).setVisible(false);
    const bg = this.add.graphics().setVisible(false);
    bg.fillStyle(hex(PALETTE.marino), 1).fillRect(0, 0, w, h);
    bg.fillStyle(hex(PALETTE.gris), 1).fillRect(M, LBL + M, FRAME, FRAME).fillRect(M * 2 + FRAME, LBL + M, FRAME, FRAME);
    rt.draw(bg, 0, 0);
    const temps = [bg];
    const drawSide = (key, label, color, x) => {
      if (this.textures.exists(key)) {
        const im = this.add.image(0, 0, key).setOrigin(0).setDisplaySize(FRAME, FRAME).setVisible(false);
        rt.draw(im, x, LBL + M); temps.push(im);
      }
      const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: 26, fontStyle: 'bold', color }).setVisible(false);
      rt.draw(t, x, M / 2 + 4); temps.push(t);
    };
    drawSide(this.antesKey, 'Antes', ROJO, M);
    drawSide(this.despuesKey, 'Después', PALETTE.verde, M * 2 + FRAME);
    rt.snapshot((img) => {
      temps.forEach((o) => o.destroy());
      rt.destroy();
      cb(img);
    });
  }

  download() {
    if (this.busy) return;
    this.busy = true;
    this.sfx('click');
    this.compose((img) => {
      this.busy = false;
      const url = img.src;
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dengue-antes-despues.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.setStatus('Imagen descargada: dengue-antes-despues.png');
      } catch (e) {
        this.showBig(url);
        return;
      }
      // En iframes/artefactos la descarga puede bloquearse en silencio y en móvil conviene la vista grande.
      if (this.sys.game.device.input.touch || window.self !== window.top) this.showBig(url);
    });
  }

  showBig(url) {
    const key = `foto_compuesta_${Date.now()}`;
    const W = this.scale.width, H = this.scale.height;
    const onLoad = () => {
      const overlay = this.add.container(0, 0).setDepth(50);
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setInteractive();
      const im = this.add.image(W / 2, H / 2 - 30, key);
      const s = Math.min((W - 60) / im.width, (H - 130) / im.height, 1.5);
      im.setScale(s);
      const t = this.add.text(W / 2, H - 40, 'Mantén presionado para guardar  ·  toca fuera para cerrar', {
        fontFamily: FONT, fontSize: 18, fontStyle: 'bold', color: PALETTE.amarillo,
      }).setOrigin(0.5);
      overlay.add([dim, im, t]);
      dim.on('pointerdown', () => { overlay.destroy(); this.textures.remove(key); });
      // Imagen DOM sobre el canvas para permitir "guardar imagen" nativo en móvil.
      try {
        const canvas = this.sys.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const el = document.createElement('img');
        el.src = url;
        el.alt = 'Antes y después';
        const sx = rect.width / W, sy = rect.height / H;
        Object.assign(el.style, {
          position: 'fixed', zIndex: 1000, pointerEvents: 'auto',
          left: `${rect.left + (W / 2 - (im.width * s) / 2) * sx}px`,
          top: `${rect.top + (H / 2 - 30 - (im.height * s) / 2) * sy}px`,
          width: `${im.width * s * sx}px`, height: `${im.height * s * sy}px`,
        });
        document.body.appendChild(el);
        const cleanup = () => el.remove();
        overlay.once('destroy', cleanup);
        this.events.once('shutdown', cleanup);
      } catch (_) { /* sin DOM */ }
    };
    if (this.textures.exists(key)) onLoad();
    else {
      this.textures.once('addtexture-' + key, onLoad);
      this.textures.addBase64(key, url);
    }
  }

  share() {
    if (this.busy) return;
    this.busy = true;
    this.sfx('click');
    const fallbackCopy = async () => {
      try {
        await navigator.clipboard.writeText(SHARE_TEXT);
        this.setStatus('¡Copiado!');
      } catch (_) {
        this.setStatus('No se pudo compartir en este dispositivo.');
      }
    };
    if (!navigator.share) { this.busy = false; return fallbackCopy(); }
    this.compose(async (img) => {
      this.busy = false;
      try {
        const blob = await (await fetch(img.src)).blob();
        const file = new File([blob], 'dengue-antes-despues.png', { type: 'image/png' });
        const data = { title: 'Dengue Invaders', text: SHARE_TEXT, files: [file] };
        if (navigator.canShare && navigator.canShare(data)) await navigator.share(data);
        else await navigator.share({ title: 'Dengue Invaders', text: SHARE_TEXT });
        this.setStatus('¡Compartido!');
      } catch (e) {
        if (e?.name !== 'AbortError') await fallbackCopy();
      }
    });
  }

  setStatus(msg) {
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
