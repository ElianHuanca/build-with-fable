import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { Joystick } from '../systems/Joystick.js';
import { buildLevel, zoneAt } from '../systems/LevelLoader.js';
import { PALETTE } from '../data/palette.js';

/**
 * Fase 2: el barrio Equipetrol. El nivel viene de src/levels/equipetrol.json
 * (generado por tools/gen-level.mjs) y se construye con LevelLoader.
 */
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const data = this.cache.json.get('level_equipetrol');
    const level = buildLevel(this, data);
    this.zones = level.zones;

    this.physics.world.setBounds(0, 0, level.widthPx, level.heightPx);
    this.player = new Player(this, level.spawn.x, level.spawn.y);
    this.physics.add.collider(this.player, level.solids);

    this.cameras.main.setBounds(0, 0, level.widthPx, level.heightPx).startFollow(this.player, true, 0.12, 0.12);

    this.joystick = new Joystick(this);

    const font = { fontFamily: 'Arial, sans-serif', color: PALETTE.blanco, backgroundColor: 'rgba(44,62,80,0.8)' };
    this.add.text(12, 12, 'Fase 2 · Recorre el barrio Equipetrol', { ...font, fontSize: 16, padding: { x: 10, y: 6 } })
      .setScrollFactor(0).setDepth(10000);

    // Nombre de la zona actual (arriba a la derecha).
    this.zoneText = this.add.text(this.scale.width - 12, 12, '', { ...font, fontSize: 13, padding: { x: 8, y: 4 } })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(10000).setVisible(false);
    this.currentZone = null;
  }

  update() {
    this.player.move(this.joystick.update());

    const zone = zoneAt(this.zones, this.player.x, this.player.y);
    if (zone !== this.currentZone) {
      this.currentZone = zone;
      this.zoneText.setText(zone ? zone.name : '').setVisible(!!zone);
    }
  }
}
