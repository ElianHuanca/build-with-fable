import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { Criadero } from '../objects/Criadero.js';
import { Joystick } from '../systems/Joystick.js';
import { InteractionPrompt } from '../systems/InteractionPrompt.js';
import { TouchControls, PauseMenu } from '../systems/TouchControls.js';
import { buildLevel, zoneAt } from '../systems/LevelLoader.js';
import { ScoreManager } from '../systems/ScoreManager.js';
import { MissionManager } from '../systems/MissionManager.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { AudioManager } from '../systems/AudioManager.js';
import { PALETTE } from '../data/palette.js';
import { FACTS } from '../data/facts.js';
import { esModoTactil } from '../data/ui.js';
import { getLevel, LEVELS } from '../data/levels.js';

const FOTO_SIZE = 256;
const FOTO_ANTES = 'foto_antes';
const FOTO_DESPUES = 'foto_despues';

/**
 * Escena de juego: el barrio con criaderos detectables y eliminables.
 *   scene.start('Game', { levelId })   (default 'equipetrol'; datos en cache json level.data)
 *
 * Escribe en registry (lee HUDScene): puntos, estrellas, limpios, total, progreso, zona, misiones, tiempo.
 * Escucha en this.events: 'sfx' (AudioManager.bind), 'foto:antes' / 'foto:despues' (EliminationFX),
 *   'popup:cerrado' (Popup), 'nivel:continuar' / 'nivel:foto' (LevelEnd), 'foto:cerrar' (Photo).
 * Lanza en paralelo: HUD, Popup, LevelEnd, Photo. Esc → menú de pausa (PauseMenu).
 * En modo táctil (esModoTactil) añade el joystick fijo y los botones de TouchControls.
 */
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data = {}) {
    this.levelId = data.levelId || 'equipetrol';
    this.level = getLevel(this.levelId) || LEVELS[0];
    this.levelData = this.cache.json.get(this.level.data || `level_${this.levelId}`)
      || this.cache.json.get('level_equipetrol');
  }

  create() {
    const data = this.levelData;
    const level = buildLevel(this, data);
    this.zones = level.zones;

    this.physics.world.setBounds(0, 0, level.widthPx, level.heightPx);
    this.player = new Player(this, level.spawn.x, level.spawn.y);
    this.physics.add.collider(this.player, level.solids);

    this.cameras.main.setBounds(0, 0, level.widthPx, level.heightPx).startFollow(this.player, true, 0.12, 0.12);

    this.tactil = esModoTactil(this.sys.game);
    this.joystick = new Joystick(this, { modo: this.tactil ? 'fijo' : 'flotante' });

    // Criaderos
    this.criaderos = (data.criaderos || []).map((c) => new Criadero(this, c.x, c.y, c.type));
    this.total = this.criaderos.length;
    this.activo = null;      // criadero detectado actualmente
    this.limpiando = false;  // hay una limpieza en curso
    this.limpios = 0;
    this.terminado = false;

    this.prompt = new InteractionPrompt(this, { sinBoton: this.tactil });
    this.prompt.onPress(() => this.intentarLimpiar());
    this.pausa = new PauseMenu(this, { onSalir: () => this.salirAlMenu() });
    this.touch = this.tactil
      ? new TouchControls(this, { onAccion: () => this.intentarLimpiar(), onPausa: () => this.togglePausa() })
      : null;
    this.keyE = this.input.keyboard.addKey('E');
    this.keyEsc = this.input.keyboard.addKey('ESC');

    // Puntaje, misiones y reloj
    this.score = new ScoreManager();
    this.missions = new MissionManager({ total: this.total, misionFamilia: data.mision_familia || null });
    this.tiempoInicio = this.time.now;
    this.segundos = 0;
    this.currentZone = null;

    this.registry.set('puntos', 0);
    this.registry.set('estrellas', 0);
    this.registry.set('limpios', 0);
    this.registry.set('total', this.total);
    this.registry.set('progreso', 0);
    this.registry.set('zona', '');
    this.registry.set('misiones', this.missions.lista());
    this.registry.set('tiempo', 0);
    this.missions.onChange((lista) => this.registry.set('misiones', lista));

    AudioManager.bind(this);
    AudioManager.playMusic();

    this.registrarEventos();
    this.scene.launch('HUD');
  }

  /** Listeners en this.events (se retiran en shutdown para no duplicarlos al volver a entrar). */
  registrarEventos() {
    const on = (evt, fn) => { this.events.on(evt, fn); return () => this.events.off(evt, fn); };
    const offs = [
      // 'antes' se captura explícitamente antes de clean() (ver intentarLimpiar): al emitirse
      // 'foto:antes' el criadero ya cambió a la textura vacía. Aquí solo cubrimos limpiezas externas.
      on('foto:antes', (c) => { if (this.fotoAntesDe !== c) this.capturar(FOTO_ANTES, c); }),
      on('foto:despues', (c) => {
        this.fotoDespuesPromise = new Promise((res) => {
          this.time.delayedCall(100, () => this.capturar(FOTO_DESPUES, c).then(res));
        });
      }),
      on('popup:cerrado', () => this.alCerrarPopup()),
      on('nivel:continuar', () => { this.scene.stop('HUD'); this.scene.start('LevelSelect'); }),
      on('nivel:foto', () => this.scene.launch('Photo', { antes: FOTO_ANTES, despues: FOTO_DESPUES })),
      on('foto:cerrar', () => this.scene.launch('LevelEnd', this.resultado)),
    ];
    this.events.once('shutdown', () => {
      offs.forEach((off) => off());
      AudioManager.stopMusic();
      this.prompt?.destroy();
      this.touch?.destroy();
      this.pausa?.destroy();
    });
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) this.togglePausa();
    if (this.pausa.abierta) {
      // Pausa suave: el reloj no avanza y el jugador no se mueve; el resto de la escena sigue viva.
      this.tiempoInicio += this.game.loop.delta;
      this.joystick.update();
      return;
    }
    this.player.move(this.joystick.update());

    const zone = zoneAt(this.zones, this.player.x, this.player.y);
    if (zone !== this.currentZone) {
      this.currentZone = zone;
      this.registry.set('zona', zone ? zone.name : '');
      if (zone) this.missions.onZona(zone.name);
    }

    const seg = Math.floor((this.time.now - this.tiempoInicio) / 1000);
    if (seg !== this.segundos) {
      this.segundos = seg;
      this.registry.set('tiempo', seg);
    }

    this.actualizarDeteccion();

    this.touch?.update({ activo: this.activo, limpiando: this.limpiando });

    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.intentarLimpiar();
  }

  /** Esc o botón PAUSA: abre/cierra el menú de pausa (no durante la limpieza ni al terminar). */
  togglePausa() {
    if (this.pausa.abierta) { this.pausa.cerrar(); return; }
    if (this.limpiando || this.terminado) return;
    this.pausa.abrir();
  }

  /** Criadero no limpio más cercano al jugador (sin límite de distancia) o null. */
  criaderoMasCercano() {
    const { x, y } = this.player.body.center;
    let nearest = null, best = Infinity;
    for (const c of this.criaderos) {
      if (c.state === 'limpio') continue;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d < best) { best = d; nearest = c; }
    }
    return nearest;
  }

  /** Busca el criadero no limpio más cercano dentro del radio de detección y actualiza el activo. */
  actualizarDeteccion() {
    if (this.limpiando) return; // durante la limpieza el activo se mantiene fijo
    const { x, y } = this.player.body.center;
    let nearest = null, best = Criadero.RADIO_DETECCION;
    for (const c of this.criaderos) {
      if (c.state === 'limpio') continue;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d <= best) { best = d; nearest = c; }
    }
    if (nearest === this.activo) return;
    if (this.activo) this.activo.setDetected(false);
    this.activo = nearest;
    if (nearest) {
      nearest.setDetected(true);
      this.events.emit('sfx', 'detect');
      this.prompt.show();
      this.prompt.showLabelAt(nearest.x, nearest.y - 40);
    } else {
      this.prompt.hide();
      this.prompt.hideLabel();
    }
  }

  async intentarLimpiar() {
    const c = this.activo;
    if (!c || this.limpiando || this.terminado || this.pausa.abierta || c.state === 'limpiando' || c.state === 'limpio') return;
    this.limpiando = true;

    // Bloquear al jugador durante la animación.
    this.player.bloqueado = true;
    this.player.setVelocity(0);
    this.player.play(`idle_${this.player.dir}`, true);
    this.prompt.setBusy(true);
    this.prompt.hideLabel();

    // Foto "antes": sin halo ni pulso, con el criadero aún lleno de agua.
    c.stopPulse();
    this.fotoAntesDe = c;
    await this.capturar(FOTO_ANTES, c);

    this.fotoDespuesPromise = null;
    try {
      await c.clean();
      // Esperar la foto "después" (sin textos flotantes encima) antes de sumar puntos.
      if (this.fotoDespuesPromise) await this.fotoDespuesPromise;
    } finally {
      if (!this.sys.settings.active && !this.sys.isPaused()) return; // la escena se cerró durante la animación
      const r = this.score.addCriadero(this.time.now);
      this.limpios = this.criaderos.filter((k) => k.state === 'limpio').length;
      this.textoFlotante(c.x, c.y - 24, `+${r.puntos}`, PALETTE.amarillo);
      if (r.bonus) this.textoFlotante(c.x, c.y - 52, `+${r.bonus} combo`, PALETTE.teja);

      this.registry.set('puntos', r.total);
      this.registry.set('limpios', this.limpios);
      this.registry.set('progreso', this.score.progreso(this.limpios, this.total));
      this.missions.onCriaderoLimpio(c);
      this.scene.get('HUD')?.flashPuntos?.();
      const fact = FACTS[c.type];
      if (fact) console.log(`[Dengue] ${fact.nombre}: ${fact.dato} (${fact.fuente})`);

      // Popup educativo: el juego se pausa hasta 'popup:cerrado'.
      this.scene.launch('Popup', { type: c.type });
      this.scene.pause();
    }
  }

  alCerrarPopup() {
    this.scene.resume();
    this.player.bloqueado = false;
    this.prompt.setBusy(false);
    this.prompt.hide();
    this.activo = null;
    this.limpiando = false;
    if (this.limpios >= this.total) this.finDeNivel();
  }

  /** Fin de nivel: estrellas, guardado y pantalla LevelEnd (el juego queda pausado). */
  finDeNivel() {
    if (this.terminado) return;
    this.terminado = true;
    const tiempo = this.segundos;
    const estrellas = this.score.calcularEstrellas(tiempo);
    this.registry.set('estrellas', estrellas);
    // El tween de hide() quedaría congelado por la pausa: ocultar el cartel de inmediato.
    this.prompt.container.setVisible(false);
    this.prompt.hideLabel();
    (this.flotantes || []).forEach((t) => t.active && t.destroy());
    saveSystem.guardarNivel(this.levelId, { estrellas, tiempo, puntos: this.score.puntos });
    AudioManager.stopMusic();
    this.resultado = {
      puntos: this.score.puntos, limpios: this.limpios, total: this.total, tiempo, estrellas,
      nivelId: this.levelId, nivelNombre: this.level?.nombre || '',
    };
    // El HUD ya no aporta en el resumen: se duerme para no tapar la pantalla de fin de nivel.
    this.scene.sleep('HUD');
    this.scene.launch('LevelEnd', this.resultado);
    this.scene.pause();
  }

  salirAlMenu() {
    this.pausa?.cerrar();
    AudioManager.stopMusic();
    this.scene.stop('HUD');
    this.scene.start('Menu');
  }

  /**
   * Captura 256×256 px del canvas alrededor del criadero y la guarda como textura `key`.
   * snapshotArea trabaja en píxeles del canvas del juego (960×540, la escala FIT es solo CSS).
   * @returns {Promise<void>} resuelve cuando la textura está disponible (o si no se pudo capturar).
   */
  capturar(key, c) {
    return new Promise((resolve) => {
      const cam = this.cameras.main;
      const W = this.scale.width, H = this.scale.height;
      const sx = Phaser.Math.Clamp(Math.round((c.x - cam.scrollX) * cam.zoom - FOTO_SIZE / 2), 0, Math.max(0, W - FOTO_SIZE));
      const sy = Phaser.Math.Clamp(Math.round((c.y - cam.scrollY) * cam.zoom - FOTO_SIZE / 2), 0, Math.max(0, H - FOTO_SIZE));
      // Ocultar overlays (HUD, cartel, joystick) para que la foto muestre solo el barrio.
      const hud = this.scene.get('HUD');
      const hudVisible = !!hud?.sys?.settings?.visible;
      if (hudVisible) hud.sys.setVisible(false);
      const overlays = [this.prompt?.container, this.prompt?.worldLabel, this.joystick?.base, this.joystick?.knob,
        ...(this.touch?.overlays() || [])].filter((o) => o && o.visible);
      overlays.forEach((o) => o.setVisible(false));
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (hudVisible && hud.sys) hud.sys.setVisible(true);
        overlays.forEach((o) => o.active && o.setVisible(true));
        resolve();
      };
      try {
        this.renderer.snapshotArea(sx, sy, FOTO_SIZE, FOTO_SIZE, (img) => {
          try {
            if (img && this.textures) {
              if (this.textures.exists(key)) this.textures.remove(key);
              this.textures.addImage(key, img);
            }
          } catch (e) { console.warn('[Game] no se pudo guardar la captura', key, e); }
          finish();
        });
      } catch (e) {
        console.warn('[Game] snapshotArea falló', e);
        finish();
      }
      // Si el renderer no llega a dibujar (pestaña oculta), no bloquear la limpieza.
      this.time.delayedCall(500, finish);
    });
  }

  /** Texto que sube 40 px y se desvanece en 900 ms. */
  textoFlotante(x, y, msg, color = PALETTE.amarillo) {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'Arial, sans-serif', fontSize: 24, fontStyle: 'bold', color,
      stroke: PALETTE.marino, strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200000);
    (this.flotantes ||= []).push(t);
    this.tweens.add({
      targets: t, y: y - 40, alpha: 0, duration: 900, ease: 'Sine.easeOut',
      onComplete: () => { t.destroy(); this.flotantes = this.flotantes.filter((k) => k !== t); },
    });
  }

  /** Teletransporte para pruebas: window.__game.scene.getScene('Game').debugTeleport(x, y). */
  debugTeleport(x, y) {
    this.player.setPosition(x, y);
    this.player.body.reset(x, y);
    this.player.setDepth(y);
    this.cameras.main.centerOn(x, y);
  }
}
