import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { Criadero } from '../objects/Criadero.js';
import { Estacion } from '../objects/Estacion.js';
import { Vehiculo } from '../objects/Vehiculo.js';
import { Joystick } from '../systems/Joystick.js';
import { InteractionPrompt } from '../systems/InteractionPrompt.js';
import { TouchControls, PauseMenu } from '../systems/TouchControls.js';
import { buildLevel, zoneAt } from '../systems/LevelLoader.js';
import { ScoreManager } from '../systems/ScoreManager.js';
import { MissionManager } from '../systems/MissionManager.js';
import { OutbreakManager } from '../systems/OutbreakManager.js';
import { EpidemicMeter } from '../systems/EpidemicMeter.js';
import { Minimap } from '../systems/Minimap.js';
import { Compass } from '../systems/Compass.js';
import { AlertToast } from '../systems/AlertToast.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { AudioManager } from '../systems/AudioManager.js';
import { PALETTE } from '../data/palette.js';
import { FACTS } from '../data/facts.js';
import { TIPS } from '../data/tips.js';
import { esModoTactil } from '../data/ui.js';
import { getLevel, LEVELS } from '../data/levels.js';

const FOTO_SIZE = 256;
const FOTO_ANTES = 'foto_antes';
const FOTO_DESPUES = 'foto_despues';

/** Duración de la jornada (v2, mockup sección 1.2): cuenta atrás en segundos. */
const JORNADA_SEG = 240;
/** Radio de detección de un brote activo (análogo a Criadero.RADIO_DETECCION). */
const RADIO_DETECCION_BROTE = 90;
/** Umbral (0..100) del medidor de epidemia a partir del cual ya no se puede sacar 2/3 estrellas. */
const UMBRAL_RIESGO = 60;
/** Puntos por fumigar un brote, según su nivel (mockup sección 1.3/1.6). */
const PUNTOS_BROTE = { pequeno: 75, medio: 90, grande: 100 };

/**
 * Escena de juego: el barrio con criaderos detectables y eliminables, más la jornada v2
 * (brotes, medidor de epidemia, estación y camioneta).
 *   scene.start('Game', { levelId })   (default 'equipetrol'; datos en cache json level.data)
 *
 * Escribe en registry (lee HUDScene): puntos, estrellas, limpios, total, progreso, zona, misiones,
 *   tiempo (segundos RESTANTES de la jornada), epidemia (0..100).
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
    this.broteActivo = null; // brote activo detectado actualmente (solo si no hay criadero cerca)
    this.limpiando = false;  // hay una limpieza o fumigación en curso
    this.limpios = 0;
    this.terminado = false;

    // Estación SEDES y camioneta (mockup sección 1.1): nacen en level.estacion, o en el spawn
    // si el nivel todavía no trae ese campo.
    const puntoEstacion = data.estacion || level.spawn;
    this.estacion = new Estacion(this, puntoEstacion.x, puntoEstacion.y);
    this.vehiculo = new Vehiculo(this, puntoEstacion.x, puntoEstacion.y);
    this.enVehiculo = false;
    this.saliDeEstacion = false;
    this.tipEstacionMostrado = false;

    this.prompt = new InteractionPrompt(this, { sinBoton: this.tactil });
    this.prompt.onPress(() => this.intentarLimpiar());
    this.pausa = new PauseMenu(this, { onSalir: () => this.salirAlMenu() });
    this.touch = this.tactil
      ? new TouchControls(this, {
        onAccion: () => this.intentarLimpiar(),
        onPausa: () => this.togglePausa(),
        onVehiculo: () => this.toggleVehiculo(),
      })
      : null;
    this.keyE = this.input.keyboard.addKey('E');
    this.keyEsc = this.input.keyboard.addKey('ESC');
    this.keyV = this.input.keyboard.addKey('V');

    // Puntaje, misiones y reloj
    this.score = new ScoreManager();
    this.missions = new MissionManager({ total: this.total, misionFamilia: data.mision_familia || null });
    this.tiempoInicio = this.time.now;
    this.segundos = JORNADA_SEG;
    this.currentZone = null;

    // Brotes y medidor de epidemia (mockup secciones 1.3/1.4)
    this.outbreakManager = new OutbreakManager(this, {
      criaderos: this.criaderos,
      bounds: { x: 0, y: 0, w: level.widthPx, h: level.heightPx },
    });
    this.brotesConocidos = new WeakSet();
    this.brotesVistos = false;
    this.outbreakManager.onChange((activos) => {
      for (const b of activos) {
        if (!this.brotesConocidos.has(b)) {
          this.brotesConocidos.add(b);
          this.onBroteNuevo(b);
        }
      }
    });
    this.epidemicMeter = new EpidemicMeter();
    this.superoUmbral = false;

    // Minimapa y brújula
    this.minimap = new Minimap(this, {
      getEntities: () => ({
        player: this.player,
        estacion: this.estacion,
        criaderos: this.criaderos.filter((c) => c.state !== 'limpio'),
        brotes: this.outbreakManager.activos,
        vehiculo: this.vehiculo,
      }),
    });
    this.compass = new Compass(this);
    this.alertToast = new AlertToast(this);

    this.registry.set('puntos', 0);
    this.registry.set('estrellas', 0);
    this.registry.set('limpios', 0);
    this.registry.set('total', this.total);
    this.registry.set('progreso', 0);
    this.registry.set('zona', '');
    this.registry.set('misiones', this.missions.lista());
    this.registry.set('tiempo', JORNADA_SEG);
    this.registry.set('epidemia', 0);
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
      this.outbreakManager?.destroy?.();
      this.minimap?.destroy?.();
      this.compass?.destroy?.();
      this.alertToast?.destroy?.();
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
    this.vehiculo.update();

    const zone = zoneAt(this.zones, this.player.x, this.player.y);
    if (zone !== this.currentZone) {
      this.currentZone = zone;
      this.registry.set('zona', zone ? zone.name : '');
      if (zone) this.missions.onZona(zone.name);
    }

    // Jornada de 4 minutos: 'tiempo' en el registry son los segundos RESTANTES.
    const transcurridos = Math.floor((this.time.now - this.tiempoInicio) / 1000);
    const restante = Math.max(0, JORNADA_SEG - transcurridos);
    if (restante !== this.segundos) {
      this.segundos = restante;
      this.registry.set('tiempo', restante);
    }
    if (restante <= 0) { this.finDeNivel('tiempo'); return; }

    // Brotes y medidor de epidemia
    this.outbreakManager.update(this.time.now, this.game.loop.delta);
    this.epidemicMeter.tick(this.game.loop.delta, {
      brotesActivos: this.outbreakManager.activos,
      criaderosSucios: Math.max(0, this.total - this.limpios),
    });
    this.registry.set('epidemia', this.epidemicMeter.valor);
    if (this.epidemicMeter.valor >= UMBRAL_RIESGO) this.superoUmbral = true;
    if (this.epidemicMeter.valor >= 100) { this.finDeNivel('epidemia'); return; }

    this.actualizarDeteccion();
    this.actualizarEstacionTip();

    this.minimap.update();
    this.compass.update(this.broteMasCercano());

    this.touch?.update({ activo: this.activo || this.broteActivo, limpiando: this.limpiando });

    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.intentarLimpiar();
    if (Phaser.Input.Keyboard.JustDown(this.keyV)) this.toggleVehiculo();
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

  /** Brote activo (no fumigado) más cercano al jugador, sin límite de distancia, o null. */
  broteMasCercano() {
    const { x, y } = this.player.body.center;
    let nearest = null, best = Infinity;
    for (const b of this.outbreakManager.activos) {
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < best) { best = d; nearest = b; }
    }
    return nearest;
  }

  /**
   * Busca el criadero no limpio más cercano dentro del radio de detección y actualiza el activo;
   * si no hay ninguno, busca un brote activo dentro de su propio radio (el criadero tiene
   * prioridad si ambos están en rango). El cartel de interacción sigue al que esté disponible.
   */
  actualizarDeteccion() {
    if (this.limpiando) return; // durante la limpieza/fumigación el objetivo se mantiene fijo
    const { x, y } = this.player.body.center;

    let nearestC = null, bestC = Criadero.RADIO_DETECCION;
    for (const c of this.criaderos) {
      if (c.state === 'limpio') continue;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d <= bestC) { bestC = d; nearestC = c; }
    }

    let nearestB = null;
    if (!nearestC) {
      let bestB = RADIO_DETECCION_BROTE;
      for (const b of this.outbreakManager.activos) {
        if (b.state !== 'activo') continue;
        const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
        if (d <= bestB) { bestB = d; nearestB = b; }
      }
    }

    if (nearestC !== this.activo) {
      if (this.activo) this.activo.setDetected(false);
      this.activo = nearestC;
      if (nearestC) nearestC.setDetected(true);
    }
    this.broteActivo = nearestB;

    const objetivo = this.activo || this.broteActivo;
    if (objetivo === this._objetivoPrompt) return;
    this._objetivoPrompt = objetivo;
    if (objetivo) {
      this.events.emit('sfx', 'detect');
      this.prompt.show();
      this.prompt.showLabelAt(objetivo.x, objetivo.y - 40);
    } else {
      this.prompt.hide();
      this.prompt.hideLabel();
    }
  }

  /** Muestra un tip de TIPS.estacion (una sola vez) al volver a la estación tras haber salido. */
  actualizarEstacionTip() {
    if (!this.estacion.cerca(this.player)) { this.saliDeEstacion = true; return; }
    if (this.saliDeEstacion && !this.tipEstacionMostrado) {
      this.tipEstacionMostrado = true;
      this.mostrarTip('estacion');
    }
  }

  /** Sube/baja de la camioneta si el jugador está cerca de la estación o de ella misma. */
  toggleVehiculo() {
    if (this.limpiando || this.terminado || this.pausa.abierta) return;
    if (this.enVehiculo) {
      this.vehiculo.bajar(this.player.x, this.player.y);
      this.player.setVehiculoFactor(1);
      this.enVehiculo = false;
      return;
    }
    if (!(this.estacion.cerca(this.player) || this.vehiculo.cerca(this.player))) return;
    this.vehiculo.subir(this.player);
    this.player.setVehiculoFactor(2);
    this.enVehiculo = true;
    this.events.emit('sfx', 'motor');
  }

  /** Muestra un mensaje aleatorio de TIPS[categoria] en el HUD (sin romper si no hay HUD activo). */
  mostrarTip(categoria, ms) {
    const lista = TIPS[categoria];
    if (!Array.isArray(lista) || !lista.length) return;
    const texto = Phaser.Utils.Array.GetRandom(lista);
    this.scene.get('HUD')?.mostrarDato?.(texto, ms);
  }

  /** Nuevo brote detectado por el OutbreakManager: aviso (y tip tutorial la primera vez). */
  onBroteNuevo(b) {
    const zona = zoneAt(this.zones, b.x, b.y);
    const aviso = `¡Brote en ${zona ? zona.name : 'el barrio'}! Fumígalo antes de que crezca.`;
    if (!this.brotesVistos) {
      this.brotesVistos = true;
      const tutorial = TIPS.brote?.[0];
      this.alertToast.mostrar(tutorial ? `${tutorial} ${aviso}` : aviso, 5000);
    } else {
      this.alertToast.mostrar(aviso);
    }
  }

  /** Punto de entrada de la tecla E / botón ACCIÓN: el criadero cercano tiene prioridad sobre el brote. */
  intentarLimpiar() {
    if (this.activo) return this.limpiarCriadero(this.activo);
    if (this.broteActivo) return this.fumigarBrote(this.broteActivo);
  }

  async limpiarCriadero(c) {
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
      this.epidemicMeter.registrarLimpieza();
      this.scene.get('HUD')?.flashPuntos?.();
      const fact = FACTS[c.type];
      if (fact) console.log(`[Dengue] ${fact.nombre}: ${fact.dato} (${fact.fuente})`);

      // Popup educativo: el juego se pausa hasta 'popup:cerrado'.
      this.scene.launch('Popup', { type: c.type });
      this.scene.pause();
    }
  }

  /**
   * Fumigar un brote (mockup sección 1.3): FumigationFX ya se ocupa de la duración (2,5 s a pie,
   * 1,5 s con `enVehiculo`), acá solo bloqueamos al jugador mientras corre y sumamos puntos/tip
   * al terminar. Sin popup educativo (a diferencia de los criaderos): el aviso ya lo dio AlertToast.
   */
  async fumigarBrote(b) {
    if (!b || this.limpiando || this.terminado || this.pausa.abierta || b.state !== 'activo') return;
    this.limpiando = true;
    this.broteActivo = null;
    this.prompt.hide();
    this.prompt.hideLabel();

    this.player.bloqueado = true;
    this.player.setVelocity(0);
    this.player.play(`idle_${this.player.dir}`, true);
    this.prompt.setBusy(true);

    const nivel = b.nivel;
    try {
      await b.fumigar({ rapido: this.enVehiculo });
    } finally {
      if (!this.sys.settings.active && !this.sys.isPaused()) return; // la escena se cerró durante la animación
      const puntos = PUNTOS_BROTE[nivel] ?? PUNTOS_BROTE.pequeno;
      this.sumarPuntos(puntos);
      this.textoFlotante(b.x, b.y - 24, `+${puntos}`, PALETTE.amarillo);
      this.epidemicMeter.registrarFumigado(nivel);
      this.mostrarTip('fumigar');

      this.player.bloqueado = false;
      this.prompt.setBusy(false);
      this.limpiando = false;
    }
  }

  /** Suma puntos fuera del flujo de ScoreManager.addCriadero (brotes) y refresca el registry/HUD. */
  sumarPuntos(cant) {
    this.score.puntos += cant;
    this.registry.set('puntos', this.score.puntos);
    this.scene.get('HUD')?.flashPuntos?.();
  }

  alCerrarPopup() {
    this.scene.resume();
    this.player.bloqueado = false;
    this.prompt.setBusy(false);
    this.prompt.hide();
    this.activo = null;
    this._objetivoPrompt = null;
    this.limpiando = false;
    if (this.limpios >= this.total) this.finDeNivel('completo');
  }

  /**
   * Fin de jornada (mockup secciones 1.4/1.6): 'completo' (todos los criaderos limpios),
   * 'tiempo' (se acabaron los 240 s sin epidemia) o 'epidemia' (el medidor llegó a 100).
   * Estrellas: 0 si hubo epidemia; si no, 1 por terminar, 2 si el medidor nunca superó el
   * umbral de riesgo, 3 si además se limpiaron todos los criaderos.
   * @param {'completo'|'tiempo'|'epidemia'} [resultado]
   */
  finDeNivel(resultado = 'completo') {
    if (this.terminado) return;
    this.terminado = true;
    const tiempo = Math.min(JORNADA_SEG, Math.floor((this.time.now - this.tiempoInicio) / 1000));

    let estrellas = 0;
    if (resultado !== 'epidemia') {
      estrellas = 1;
      if (!this.superoUmbral) {
        estrellas = 2;
        if (this.limpios >= this.total) estrellas = 3;
      }
    }
    this.registry.set('estrellas', estrellas);
    // El tween de hide() quedaría congelado por la pausa: ocultar el cartel de inmediato.
    this.prompt.container.setVisible(false);
    this.prompt.hideLabel();
    (this.flotantes || []).forEach((t) => t.active && t.destroy());
    saveSystem.guardarNivel(this.levelId, { estrellas, tiempo, puntos: this.score.puntos });
    AudioManager.stopMusic();
    this.resultado = {
      puntos: this.score.puntos, limpios: this.limpios, total: this.total, tiempo, estrellas,
      nivelId: this.levelId, nivelNombre: this.level?.nombre || '', resultado,
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
        this.minimap?.container, this.compass?.flecha, this.alertToast?.container,
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
