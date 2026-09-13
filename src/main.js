import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { PopupScene } from './scenes/PopupScene.js';
import { LevelEndScene } from './scenes/LevelEndScene.js';
import { PhotoScene } from './scenes/PhotoScene.js';
import { PALETTE } from './data/palette.js';

export const GAME_W = 960;
export const GAME_H = 540;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: PALETTE.marino,
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  // Orden: Boot arranca; Menu → LevelSelect → Game (+HUD, Popup, LevelEnd y Photo en paralelo).
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, HUDScene, PopupScene, LevelEndScene, PhotoScene],
});

// Acceso para pruebas automatizadas y depuración en consola.
window.__game = game;

/**
 * Aviso "Gira tu dispositivo": en un teléfono en vertical la escena 960×540 queda en ~390×220 px
 * y los botones bajan de 20 px, así que se muestra el overlay #rotate (index.html) hasta que el
 * usuario gire el equipo o pulse "Jugar así de todos modos". Solo en dispositivos táctiles.
 * La orientación se calcula con el tamaño de la ventana (screen.orientation no es fiable en
 * navegadores embebidos ni en emuladores); scale.orientation queda como respaldo.
 */
function instalarAvisoRotacion() {
  const overlay = document.getElementById('rotate');
  const skip = document.getElementById('rotate-skip');
  if (!overlay || !game.device.input.touch) return;
  let omitido = false;
  const esVertical = () => (window.innerWidth && window.innerHeight)
    ? window.innerHeight > window.innerWidth
    : game.scale.orientation === Phaser.Scale.PORTRAIT;
  const actualizar = () => { overlay.hidden = omitido || !esVertical(); };
  skip?.addEventListener('click', () => { omitido = true; actualizar(); });
  game.scale.on(Phaser.Scale.Events.ORIENTATION_CHANGE, actualizar);
  game.scale.on(Phaser.Scale.Events.RESIZE, actualizar);
  window.addEventListener('resize', actualizar);
  actualizar();
}
instalarAvisoRotacion();
