import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { Joystick } from '../systems/Joystick.js';
import { PALETTE } from '../data/palette.js';

const TILE = 64;
const MAP_W = 24; // tiles
const MAP_H = 16;

/**
 * Fase 1: campo de prueba. Un prado con una calle y árboles para validar
 * el estilo, el movimiento en 8 direcciones y el joystick táctil.
 * En la fase 2 se reemplaza por el tilemap del barrio (levels/equipetrol.json).
 */
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const names = this.cache.json.get('tilesMeta').names;
    const id = (n) => names.indexOf(n);

    // Suelo
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const r = ((x * 73856093) ^ (y * 19349663)) % 11;
        let frame = id(r === 0 ? 'pasto_oscuro' : r === 5 ? 'pasto_seco' : 'pasto');
        if (y === 7) frame = id('vereda');
        if (y === 8 || y === 9) frame = id(x % 2 === 0 ? 'calle_linea' : 'calle');
        if (y === 10) frame = id('vereda');
        if ((y === 8 || y === 9) && x === 12) frame = id('cruce');
        this.add.image(x * TILE, y * TILE, 'tiles', frame).setOrigin(0);
      }
    }

    // Árboles y plantas con colisión
    const solids = this.physics.add.staticGroup();
    const tree = (tx, ty) => {
      const s = solids.create(tx * TILE + 32, ty * TILE + 32, 'arbol');
      s.setDepth(s.y).body.setSize(30, 18).setOffset(17, 40);
    };
    [[2, 2], [5, 1], [9, 3], [15, 2], [20, 1], [22, 4], [3, 13], [8, 14], [14, 12], [19, 13], [21, 11]].forEach(([x, y]) => tree(x, y));
    [[7, 5], [17, 4], [12, 12], [6, 11]].forEach(([x, y]) => this.add.image(x * TILE + 32, y * TILE + 32, 'planta').setDepth(y * TILE + 32));

    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.player = new Player(this, 6 * TILE, 5 * TILE);
    this.physics.add.collider(this.player, solids);

    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE).startFollow(this.player, true, 0.12, 0.12);

    this.joystick = new Joystick(this);

    this.add.text(12, 12, 'Fase 1 · Muévete con WASD / flechas o arrastrando en la pantalla', {
      fontFamily: 'Arial, sans-serif', fontSize: 16, color: PALETTE.blanco,
      backgroundColor: 'rgba(44,62,80,0.8)', padding: { x: 10, y: 6 },
    }).setScrollFactor(0).setDepth(10000);
  }

  update() {
    this.player.move(this.joystick.update());
  }
}
