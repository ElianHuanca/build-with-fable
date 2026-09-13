import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const BASE = import.meta.env.BASE_URL + 'assets/';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const { width, height } = this.scale;
    const box = this.add.rectangle(width / 2, height / 2, 320, 24, hex(PALETTE.marino)).setStrokeStyle(2, hex(PALETTE.celeste));
    const bar = this.add.rectangle(width / 2 - 156, height / 2, 0, 16, hex(PALETTE.verde)).setOrigin(0, 0.5);
    this.add.text(width / 2, height / 2 - 30, 'Cargando el barrio...', { fontFamily: 'Arial, sans-serif', fontSize: 18, color: PALETTE.blanco }).setOrigin(0.5);
    this.load.on('progress', (v) => { bar.width = 312 * v; });
    this.load.on('complete', () => { box.destroy(); bar.destroy(); });

    this.load.atlas('player', BASE + 'anim/player.png', BASE + 'anim/player.json');
    this.load.spritesheet('tiles', BASE + 'tiles/tileset.png', { frameWidth: 64, frameHeight: 64 });
    this.load.json('tilesMeta', BASE + 'tiles/tileset.json');
    this.load.image('arbol', BASE + 'sprites/arbol.png');
    this.load.image('planta', BASE + 'sprites/planta.png');
    for (const k of ['casa_a', 'casa_b', 'arbusto', 'muro_h', 'muro_v', 'porton', 'tanque_techo']) {
      this.load.image(k, BASE + `sprites/${k}.png`);
    }
    // Fase 3: criaderos (3 estados + capa de agua), partículas y kit de UI. Los genera tools/gen-assets.mjs.
    for (const t of ['llanta', 'tanque', 'balde', 'botella', 'florero']) {
      for (const k of [`${t}_agua`, `${t}_vacio`, `${t}_limpio`, `agua_${t}`]) this.load.image(k, BASE + `sprites/${k}.png`);
    }
    for (const k of ['drop', 'spark', 'noise']) this.load.image(k, BASE + `sprites/${k}.png`);
    for (const k of ['alert', 'key_e', 'panel', 'btn_green']) this.load.image(k, BASE + `ui/${k}.png`);
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
    this.scene.start('Game');
  }
}
