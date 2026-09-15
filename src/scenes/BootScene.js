import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { AudioManager } from '../systems/AudioManager.js';
import { Layout } from '../systems/Layout.js';
import { t } from '../i18n/index.js';

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

// Vecinos NPC (plan v4 §2): cantidad de variantes generadas por tools/gen-assets.mjs (5 hombres
// + 2 mujeres + 2 niños/as; debe coincidir con `buildVecinos` y con `VARIANTES_SPRITE` en
// Vecinos.js).
const VECINOS_VARIANTES = 9;

// Audio (keys documentadas en systems/AudioManager.js). Los genera tools/gen-sfx.mjs.
const SFX_FILES = ['step', 'detect', 'gluglu', 'pop', 'points', 'win', 'click', 'alert', 'spray', 'motor', 'buzz'];

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const box = this.add.rectangle(0, 0, 320, 24, hex(PALETTE.marino)).setStrokeStyle(2, hex(PALETTE.celeste));
    const bar = this.add.rectangle(0, 0, 0, 16, hex(PALETTE.verde)).setOrigin(0, 0.5);
    const label = this.add.text(0, 0, t('boot.cargando'), { fontFamily: 'Arial, sans-serif', fontSize: 18, color: PALETTE.blanco }).setOrigin(0.5);
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
    // Hospital (plan v4 §6).
    this.load.image('hospital', BASE + 'sprites/hospital.png');
    // Vecinos NPC decorativos (plan v4 §2): N variantes × 2 direcciones (de frente/de
    // espaldas) × 4 cuadros, mismo esquema de animación que el personaje (ver create() abajo).
    for (let n = 1; n <= VECINOS_VARIANTES; n++) {
      for (const dir of ['down', 'up']) {
        for (let f = 0; f <= 3; f++) this.load.image(`vecino_${n}_${dir}_${f}`, BASE + `sprites/vecino_${n}_${dir}_${f}.png`);
      }
    }
    // Basura callejera (plan v4 §2): 3 tipos × 3 estados. Si faltara alguna, Basura.js cae a un
    // dibujo generado en tiempo de ejecución (mismo patrón de fallback que Criadero/Brote).
    for (const tipo of ['bolsa', 'botella', 'llanta']) {
      for (const estado of ['fresca', 'acumulada', 'criadero']) {
        const k = `basura_${tipo}_${estado}`;
        this.load.image(k, BASE + `sprites/${k}.png`);
      }
    }

    for (const k of UI_KEYS) this.load.image(k, BASE + `ui/${k}.png`);
    // v3: especies (biblioteca y cámara IA), rociador y niebla (fumigación), ciclo de vida,
    // insignias, íconos y pestañas. Los genera tools/gen-assets.mjs (buildV3).
    for (const id of ['aegypti', 'albopictus', 'culex', 'anopheles']) {
      for (const k of [`mosq_${id}`, `mosq_${id}_mini`]) this.load.image(k, BASE + `sprites/${k}.png`);
      // Fotos reales (dominio público o CC, ver ATTRIBUTION.md), 2 ángulos por especie, para
      // la ficha de la Biblioteca SEDES.
      for (const k of [`mosq_${id}_foto`, `mosq_${id}_foto2`]) this.load.image(k, BASE + `fotos/${k}.jpg`);
    }
    for (const k of ['rociador', 'niebla']) this.load.image(k, BASE + `sprites/${k}.png`);
    for (const k of ['ciclo_huevo', 'ciclo_larva', 'ciclo_pupa', 'ciclo_adulto',
      'insignia_explorador', 'insignia_detective', 'insignia_guardian', 'insignia_fotografo', 'insignia_bloqueada',
      'icon_camera_big', 'icon_library', 'icon_lang',
      'tab_mosquito', 'tab_ciclo', 'tab_sintomas', 'tab_prevencion', 'tab_mitos']) {
      this.load.image(k, BASE + `ui/${k}.png`);
    }
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
    // Animaciones de los vecinos (plan v4 §2): mismo esquema que el jugador, pero cada variante
    // es una textura distinta (no un atlas con frames nombrados), así que cada cuadro es su
    // propia key `vecino_<n>_<dir>_<i>` — Phaser también acepta eso en `frames`.
    for (let n = 1; n <= VECINOS_VARIANTES; n++) {
      for (const dir of ['down', 'up']) {
        this.anims.create({
          key: `vecino_${n}_walk_${dir}`,
          frames: [1, 2, 3, 2].map((i) => ({ key: `vecino_${n}_${dir}_${i}` })),
          frameRate: 8,
          repeat: -1,
        });
        this.anims.create({ key: `vecino_${n}_idle_${dir}`, frames: [{ key: `vecino_${n}_${dir}_0` }] });
      }
    }
    AudioManager.init(this);
    this.scene.start('Menu');
  }
}
