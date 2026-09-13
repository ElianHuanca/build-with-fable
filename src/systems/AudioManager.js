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
 *   this.load.audio('sfx_alert',  BASE + 'audio/alert.wav');   // aviso de brote (2 tonos ascendentes)
 *   this.load.audio('sfx_spray',  BASE + 'audio/spray.wav');   // fumigación (silbido/niebla ~1 s)
 *   this.load.audio('sfx_motor',  BASE + 'audio/motor.wav');   // arranque de la camioneta
 *   this.load.audio('sfx_buzz',   BASE + 'audio/buzz.wav');    // zumbido de mosquitos (~0.6 s)
 *   this.load.audio('music',      BASE + 'audio/music.wav');   // música de fondo (loop)
 *
 * API:
 *   AudioManager.init(scene)        crea los sonidos (una sola vez por Game) y gestiona el desbloqueo en móviles
 *   AudioManager.bind(scene)        escucha scene.events 'sfx' (name) → AudioManager.play(name),
 *                                   'sfx:loop' (name) → playLoop(name) y 'sfx:stop' (name) → stopLoop(name);
 *                                   al cerrar la escena corta todos los loops
 *   AudioManager.play('gluglu')     reproduce sfx_gluglu (name sin prefijo); volumen por key;
 *                                   gluglu/win no se reinician si ya están sonando
 *   AudioManager.playLoop('motor')  reproduce en loop (idempotente) / stopLoop('motor') lo corta
 *   AudioManager.playMusic()        inicia la música en loop (idempotente)
 *   AudioManager.stopMusic()
 *   AudioManager.setEnabled(bool)   activa/desactiva todo; persiste en localStorage 'dengue.sonido'
 *   AudioManager.enabled            estado actual (getter)
 */

const STORAGE_KEY = 'dengue.sonido';
const SFX = ['step', 'detect', 'gluglu', 'pop', 'points', 'win', 'click', 'alert', 'spray', 'motor', 'buzz'];
const MUSIC_KEY = 'music';
const MUSIC_VOLUME = 0.6;
const DEFAULT_VOLUME = 0.8;
/** Volumen por key (el resto usa DEFAULT_VOLUME). */
const VOLUMES = { step: 0.35, click: 0.6, buzz: 0.4, music: MUSIC_VOLUME };
/** Sonidos largos que no deben reiniciarse si ya están sonando. */
const NO_OVERLAP = new Set(['gluglu', 'win']);
const volumeFor = (name) => VOLUMES[name] ?? DEFAULT_VOLUME;

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
  static _resuming = false;

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
      if (scene.cache.audio.exists(key)) AudioManager.sounds[name] = sm.add(key, { volume: volumeFor(name) });
    }
    if (scene.cache.audio.exists(MUSIC_KEY)) AudioManager.music = sm.add(MUSIC_KEY, { loop: true, volume: volumeFor(MUSIC_KEY) });

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
    const loop = (name) => AudioManager.playLoop(name);
    const stop = (name) => AudioManager.stopLoop(name);
    scene.events.on('sfx', handler);
    scene.events.on('sfx:loop', loop);
    scene.events.on('sfx:stop', stop);
    scene.events.once('shutdown', () => {
      scene.events.off('sfx', handler);
      scene.events.off('sfx:loop', loop);
      scene.events.off('sfx:stop', stop);
      AudioManager.stopAllLoops();
    });
  }

  /** Reproduce un efecto en loop (p. ej. 'motor' mientras la camioneta se mueve). Idempotente. */
  static playLoop(name) {
    if (!AudioManager._enabled) return;
    const s = AudioManager.sounds[name];
    if (!s || (s.isPlaying && s.loop)) return;
    AudioManager._resumeContext();
    try { s.play({ volume: volumeFor(name), loop: true }); } catch { /* audio aún bloqueado */ }
  }

  /** Corta un loop iniciado con playLoop (no hace nada si no está sonando). */
  static stopLoop(name) {
    const s = AudioManager.sounds[name];
    if (s && s.isPlaying && s.loop) s.stop();
  }

  static stopAllLoops() {
    for (const s of Object.values(AudioManager.sounds)) if (s.isPlaying && s.loop) s.stop();
  }

  /** Reproduce un efecto por nombre sin prefijo ('gluglu' → sfx_gluglu). */
  static play(name) {
    if (!AudioManager._enabled) return;
    const s = AudioManager.sounds[name];
    if (!s) return;
    if (NO_OVERLAP.has(name) && s.isPlaying) return;
    AudioManager._resumeContext();
    try { s.play({ volume: volumeFor(name) }); } catch { /* audio aún bloqueado */ }
  }

  /** Si el AudioContext quedó suspendido (autoplay), intenta reanudarlo una vez por llamada. */
  static _resumeContext() {
    const ctx = AudioManager.game?.sound?.context;
    if (ctx && ctx.state === 'suspended' && !AudioManager._resuming) {
      AudioManager._resuming = true;
      try {
        ctx.resume().catch(() => {}).finally(() => { AudioManager._resuming = false; });
      } catch { AudioManager._resuming = false; }
    }
  }

  static playMusic() {
    AudioManager._musicWanted = true;
    const m = AudioManager.music;
    if (!m || !AudioManager._enabled || m.isPlaying) return;
    AudioManager._resumeContext();
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
