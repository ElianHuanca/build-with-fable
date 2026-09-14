import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { PopupScene } from './scenes/PopupScene.js';
import { LevelEndScene } from './scenes/LevelEndScene.js';
import { PhotoScene } from './scenes/PhotoScene.js';
import { LibraryScene } from './scenes/LibraryScene.js';
import { CameraScene } from './scenes/CameraScene.js';
import { PALETTE } from './data/palette.js';

export const GAME_W = 960;
export const GAME_H = 540;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  // v2: el lienzo ocupa toda la ventana (mobile first); GAME_W/GAME_H quedan como referencia.
  width: '100%',
  height: '100%',
  backgroundColor: PALETTE.marino,
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  // Orden: Boot arranca; Menu → LevelSelect → Game (+HUD, Popup, LevelEnd y Photo en paralelo).
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, HUDScene, PopupScene, LevelEndScene, PhotoScene, CameraScene, LibraryScene],
});

// Acceso para pruebas automatizadas y depuración en consola.
window.__game = game;
