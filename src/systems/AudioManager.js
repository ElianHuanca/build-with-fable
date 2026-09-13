/**
 * AudioManager — sonido del juego (SFX + música), singleton por juego.
 *
 * Archivos (los genera `npm run gen:sfx` → tools/gen-sfx.mjs) y keys de carga.
 * BootScene debe cargarlos así (BASE = import.meta.env.BASE_URL + 'assets/'):
 *
 *   this.load.audio('sfx_step',   BASE + 'audio/step.wav');    // paso corto (ruido filtrado)
 *   this.load.audio('sfx_detect', BASE + 'audio/detect.wav');  // criadero detectado (2 notas)
 *   this.load.audio('sfx_gluglu', BASE + 'audio/gluglu.wav');  // vaciar agua (burbujeo 1,2 s)
 *   this.load.audio('sfx_pop',    BASE + 'audio/pop.wav');     // disolución / pop
 *   this.load.audio('sfx_points', BASE + 'audio/points.wav');  // puntos (+50)
 *   this.load.audio('sfx_win',    BASE + 'audio/win.wav');     // fanfarria fin de nivel
 *   this.load.audio('sfx_click',  BASE + 'audio/click.wav');   // click de UI
 *   this.load.audio('music',      BASE + 'audio/music.wav');   // música de fondo (loop)
 *
 * API:
 *   AudioManager.init(scene)        crea los sonidos (una sola vez por Game) y gestiona el desbloqueo en móviles
 *   AudioManager.bind(scene)        escucha scene.events 'sfx' (name) → AudioManager.play(name)
 *   AudioManager.play('gluglu')     reproduce sfx_gluglu (name sin prefijo)
 *   AudioManager.playMusic()        inicia la música en loop (idempotente)
 *   AudioManager.stopMusic()
 *   AudioManager.setEnabled(bool)   activa/desactiva todo; persiste en localStorage 'dengue.sonido'
 *   AudioManager.enabled            estado actual (getter)
 */

const STORAGE_KEY = 'dengue.sonido';
const SFX = ['step', 'detect', 'gluglu', 'pop', 'points', 'win', 'click'];
const MUSIC_KEY = 'music';
const SFX_VOLUME = 0.9;
const MUSIC_VOLUME = 0.6;

function readEnabled() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === '1';
  } catch { return true; }
}

export class AudioManager {
  static game = null;
  static sounds = {};
  static music = null;
  static _enabled = readEnabled();
  static _musicWanted = false;
  static _globalHandler = null;

  static get enabled() { return AudioManager._enabled; }

  /** Crea los sonidos con scene.sound.add (una sola vez por instancia de Phaser.Game). */
  static init(scene) {
    const game = scene.sys.game;
    if (AudioManager.game === game) return;
    AudioManager.game = game;
    AudioManager.sounds = {};
    AudioManager.music = null;

    const sm = scene.sound;
    for (const name of SFX) {
      const key = `sfx_${name}`;
      if (scene.cache.audio.exists(key)) AudioManager.sounds[name] = sm.add(key, { volume: SFX_VOLUME });
    }
    if (scene.cache.audio.exists(MUSIC_KEY)) AudioManager.music = sm.add(MUSIC_KEY, { loop: true, volume: MUSIC_VOLUME });

    // Canal global: las escenas de menú emiten `game.events.emit('sfx', name)` (una sola vez por Game).
    if (AudioManager._globalHandler) game.events.off('sfx', AudioManager._globalHandler);
    AudioManager._globalHandler = (name) => AudioManager.play(name);
    game.events.on('sfx', AudioManager._globalHandler);

    AudioManager._setupUnlock(scene);
  }

  /** Desbloqueo de audio en móviles: Phaser lo intenta solo, pero reforzamos en el primer toque. */
  static _setupUnlock(scene) {
    const sm = scene.sound;
    const resume = () => {
      if (sm.locked && typeof sm.unlock === 'function') sm.unlock();
      const ctx = sm.context;
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (AudioManager._musicWanted) AudioManager.playMusic();
    };
    sm.once('unlocked', resume);
    scene.input.once('pointerdown', resume);
    // Volver a la pestaña: algunos navegadores suspenden el contexto.
    scene.game.events.on('resume', resume);
  }

  /** Enlaza el evento 'sfx' de la escena: scene.events.emit('sfx', 'gluglu'). */
  static bind(scene) {
    if (!AudioManager.game) AudioManager.init(scene);
    const handler = (name) => AudioManager.play(name);
    scene.events.on('sfx', handler);
    scene.events.once('shutdown', () => scene.events.off('sfx', handler));
  }

  /** Reproduce un efecto por nombre sin prefijo ('gluglu' → sfx_gluglu). */
  static play(name) {
    if (!AudioManager._enabled) return;
    const s = AudioManager.sounds[name];
    if (!s) return;
    try { s.play(); } catch { /* audio aún bloqueado */ }
  }

  static playMusic() {
    AudioManager._musicWanted = true;
    const m = AudioManager.music;
    if (!m || !AudioManager._enabled || m.isPlaying) return;
    try { m.play(); } catch { /* audio aún bloqueado */ }
  }

  static stopMusic() {
    AudioManager._musicWanted = false;
    const m = AudioManager.music;
    if (m && m.isPlaying) m.stop();
  }

  static setEnabled(value) {
    const on = !!value;
    AudioManager._enabled = on;
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* sin storage */ }
    const m = AudioManager.music;
    if (!on) {
      if (m && m.isPlaying) m.stop();
      for (const s of Object.values(AudioManager.sounds)) if (s.isPlaying) s.stop();
    } else if (AudioManager._musicWanted) {
      AudioManager.playMusic();
    }
  }
}
