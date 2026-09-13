import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { AudioManager } from '../systems/AudioManager.js';
import { Layout } from '../systems/Layout.js';

const BASE = import.meta.env.BASE_URL + 'assets/';

// Kit de UI (public/assets/ui/*.png) e imágenes de menú/selección (public/assets/img/*.png).
// Key = nombre de archivo sin extensión. Las escenas tienen fallback si alguna falta.
const UI_KEYS = [
  'alert', 'bar_bg', 'bar_fill', 'btn_gray', 'btn_green', 'btn_red_x', 'icon_back', 'icon_book',
  'icon_camera', 'icon_gear', 'icon_lock', 'icon_share', 'icon_sound_off', 'icon_sound_on', 'key_e',
  'panel', 'retrato', 'retrato_pulgar', 'star_off', 'star_on',
];
const IMG_KEYS = ['level_equipetrol', 'level_plan3000', 'logo', 'menu_bg'];

// Fase v2: vehículo (4 direcciones), estación SEDES y brotes de mosquitos (3 niveles) + espray.
const SPRITES_V2 = [
  'vehiculo_down', 'vehiculo_up', 'vehiculo_left', 'vehiculo_right', 'estacion',
  'mosquito_pequeno', 'mosquito_medio', 'mosquito_grande', 'spray',
];

// Audio (keys documentadas en systems/AudioManager.js). Los genera tools/gen-sfx.mjs.
const SFX_FILES = ['step', 'detect', 'gluglu', 'pop', 'points', 'win', 'click', 'alert', 'spray', 'motor', 'buzz'];

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const box = this.add.rectangle(0, 0, 320, 24, hex(PALETTE.marino)).setStrokeStyle(2, hex(PALETTE.celeste));
    const bar = this.add.rectangle(0, 0, 0, 16, hex(PALETTE.verde)).setOrigin(0, 0.5);
    const label = this.add.text(0, 0, 'Cargando el barrio...', { fontFamily: 'Arial, sans-serif', fontSize: 18, color: PALETTE.blanco }).setOrigin(0.5);
    let progreso = 0;
    const reflow = (width, height) => {
      box.setPosition(width / 2, height / 2);
      bar.setPosition(width / 2 - 156, height / 2).width = 312 * progreso;
      label.setPosition(width / 2, height / 2 - 30);
    };
    Layout.onResize(this, reflow);
    this.load.on('progress', (v) => { progreso = v; bar.width = 312 * v; });
    this.load.on('complete', () => { box.destroy(); bar.destroy(); label.destroy(); });
    // Un asset ausente no debe frenar el arranque: las escenas tienen fallbacks.
    this.load.on('loaderror', (file) => console.warn('[Boot] no se pudo cargar', file?.key));

    this.load.atlas('player', BASE + 'anim/player.png', BASE + 'anim/player.json');
    this.load.spritesheet('tiles', BASE + 'tiles/tileset.png', { frameWidth: 64, frameHeight: 64 });
    this.load.json('tilesMeta', BASE + 'tiles/tileset.json');
    this.load.image('arbol', BASE + 'sprites/arbol.png');
    this.load.image('planta', BASE + 'sprites/planta.png');
    for (const k of ['casa_a', 'casa_b', 'arbusto', 'muro_h', 'muro_v', 'porton', 'tanque_techo']) {
      this.load.image(k, BASE + `sprites/${k}.png`);
    }
    // Fase 3: criaderos (3 estados + capa de agua), partículas. Los genera tools/gen-assets.mjs.
    for (const t of ['llanta', 'tanque', 'balde', 'botella', 'florero']) {
      for (const k of [`${t}_agua`, `${t}_vacio`, `${t}_limpio`, `agua_${t}`]) this.load.image(k, BASE + `sprites/${k}.png`);
    }
    for (const k of ['drop', 'spark', 'noise']) this.load.image(k, BASE + `sprites/${k}.png`);
    for (const k of SPRITES_V2) this.load.image(k, BASE + `sprites/${k}.png`);

    for (const k of UI_KEYS) this.load.image(k, BASE + `ui/${k}.png`);
    for (const k of IMG_KEYS) this.load.image(k, BASE + `img/${k}.png`);

    for (const s of SFX_FILES) this.load.audio(`sfx_${s}`, BASE + `audio/${s}.wav`);
    this.load.audio('music', BASE + 'audio/music.wav');

    // Nivel generado por tools/gen-level.mjs (src/levels/equipetrol.json), servido como asset de Vite.
    this.load.json('level_equipetrol', new URL('../levels/equipetrol.json', import.meta.url).href);
  }

  create() {
    // Animaciones del personaje: idle (frame 0) y caminar (1,2,3,2) por dirección.
    for (const dir of ['down', 'up', 'left', 'right']) {
      this.anims.create({
        key: `walk_${dir}`,
        frames: [1, 2, 3, 2].map((i) => ({ key: 'player', frame: `${dir}_${i}` })),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({ key: `idle_${dir}`, frames: [{ key: 'player', frame: `${dir}_0` }] });
    }
    AudioManager.init(this);
    this.scene.start('Menu');
  }
}
