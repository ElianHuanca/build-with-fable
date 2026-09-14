import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { Criadero } from '../objects/Criadero.js';
import { Estacion } from '../objects/Estacion.js';
import { Vehiculo } from '../objects/Vehiculo.js';
import { Joystick } from '../systems/Joystick.js';
import { InteractionPrompt } from '../systems/InteractionPrompt.js';
import { TouchControls, PauseMenu } from '../systems/TouchControls.js';
import { buildLevel, zoneAt, OBJECT_DEFS } from '../systems/LevelLoader.js';
import { ScoreManager } from '../systems/ScoreManager.js';
import { MissionManager } from '../systems/MissionManager.js';
import { OutbreakManager } from '../systems/OutbreakManager.js';
import { EpidemicMeter } from '../systems/EpidemicMeter.js';
import { Minimap } from '../systems/Minimap.js';
import { Compass } from '../systems/Compass.js';
import { AlertToast } from '../systems/AlertToast.js';
import { applyCameraZoom, worldToScreen } from '../systems/CameraZoom.js';
import { Layout } from '../systems/Layout.js';
import { Badges } from '../systems/Badges.js';
import { saveSystem } from '../systems/SaveSystem.js';
import { AudioManager } from '../systems/AudioManager.js';
import { PALETTE } from '../data/palette.js';
import { factsL } from '../data/facts.js';
import { tipsL } from '../data/tips.js';
import { t, tx } from '../i18n/index.js';
import { speciesById } from '../data/species.js';
import { esModoTactil } from '../data/ui.js';
import { getLevel, LEVELS } from '../data/levels.js';

const FOTO_SIZE = 256;
const FOTO_ANTES = 'foto_antes';
const FOTO_DESPUES = 'foto_despues';
/** Textura de la captura para la cámara con IA (v3 §1.2). */
const CAM_SNAP = 'cam_snap';
/** Un brote a menos de esto (px de mundo) sale en la foto de la cámara; si no, se fotografía al jugador. */
const RADIO_FOTO_BROTE = 160;
/**
 * Margen de la cámara (v3 §1.3) en píxeles de PANTALLA: los límites de scroll se amplían para que
 * el jugador nunca quede bajo la HUD (arriba) ni bajo los controles táctiles (abajo).
 */
const MARGEN_CAM = {
  tactilVertical: { top: 150, bottom: 250 },
  tactilHorizontal: { top: 100, bottom: 120 },
  escritorio: { top: 100, bottom: 60 },
};
/** Cada cuánto se recalcula qué paneles de la HUD tapan al jugador/brotes (HUDScene.evitar). */
const EVITAR_MS = 100;
const ALPHA_MINIMAPA_EVITAR = 0.35;

/** Duración de la jornada (v2, mockup sección 1.2): cuenta atrás en segundos. */
const JORNADA_SEG = 240;
/** Radio de detección de un brote activo (análogo a Criadero.RADIO_DETECCION). */
const RADIO_DETECCION_BROTE = 90;
/** Umbral (0..100) del medidor de epidemia a partir del cual ya no se puede sacar 2/3 estrellas. */
const UMBRAL_RIESGO = 60;
/** Puntos por fumigar un brote, según su nivel (mockup sección 1.3/1.6). */
const PUNTOS_BROTE = { pequeno: 75, medio: 90, grande: 100 };
/** Dónde nace la camioneta si el nivel no trae `garaje`: junto a la estación, sobre la calle. */
const GARAJE_OFFSET = { x: 96, y: 56 };
/** Velocidad mínima (px/s) para que suene el motor de la camioneta. */
const MOTOR_MIN_SPEED = 5;

/**
 * Nombre visible de una zona del nivel en el idioma actual. En el JSON las zonas se llaman
 * "Manzana N", "Plaza" o "Estación SEDES" (identificadores para misiones): se traducen al mostrar.
 */
export function nombreZona(name) {
  if (!name) return '';
  const m = /^Manzana\s+(\d+)$/i.exec(name);
  if (m) return t('game.manzana', { n: m[1] });
  if (name === 'Plaza') return t('game.plaza');
  if (name === 'Estación SEDES') return t('game.estacion');
  return name;
}

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
    this.nivelW = level.widthPx; this.nivelH = level.heightPx;
    this.player = new Player(this, level.spawn.x, level.spawn.y);
    this.physics.add.collider(this.player, level.solids);

    // Los límites definitivos (con margen) se fijan en aplicarMargenCamara, tras el zoom.
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
    // La camioneta se estaciona al lado del edificio (no encima: el edificio la taparía).
    const puntoGaraje = data.garaje || { x: puntoEstacion.x + GARAJE_OFFSET.x, y: puntoEstacion.y + GARAJE_OFFSET.y };
    this.vehiculo = new Vehiculo(this, puntoGaraje.x, puntoGaraje.y);
    this.enVehiculo = false;
    this.motorOn = false;
    this.fumigando = null;   // brote que se está fumigando (mantener E)
    this.saliDeEstacion = false;
    this.tipEstacionMostrado = false;
    this.estacionActiva = false; // el jugador está en la estación sin otro objetivo: E abre la Biblioteca
    this.overlayAbierto = null;  // 'camara' | 'biblioteca' mientras esa escena está encima (pausa suave)
    this.mensajePendiente = null; // aviso a mostrar al cerrar la cámara (especie identificada)

    this.prompt = new InteractionPrompt(this, { sinBoton: this.tactil });
    this.prompt.onPress(() => this.intentarLimpiar());
    this.pausa = new PauseMenu(this, { onSalir: () => this.salirAlMenu() });
    this.touch = this.tactil
      ? new TouchControls(this, {
        // Toque corto: solo criaderos (un brote soltado antes de tiempo queda cancelado, no se relanza).
        onAccion: () => { if (this.activo) this.intentarLimpiar(); },
        onAccionInicio: () => this.accionInicio(),
        onAccionFin: () => this.accionFin(),
        onPausa: () => this.togglePausa(),
        onVehiculo: () => this.toggleVehiculo(),
        onCamara: () => this.abrirCamara(),
      })
      : null;
    this.keyE = this.input.keyboard.addKey('E');
    this.keyEsc = this.input.keyboard.addKey('ESC');
    this.keyV = this.input.keyboard.addKey('V');
    this.keyF = this.input.keyboard.addKey('F'); // alias de V para subir/bajar de la camioneta
    this.keyC = this.input.keyboard.addKey('C'); // cámara con IA

    // Puntaje, misiones y reloj
    this.score = new ScoreManager();
    this.missions = new MissionManager({ total: this.total, misionFamilia: data.mision_familia || null });
    // `time.now` no se actualiza hasta el primer update de la escena (en create() trae el valor de
    // la última vez que corrió): con él la jornada arrancaría con los segundos del menú ya gastados.
    this.tiempoInicio = this.game.loop.time;
    this.segundos = JORNADA_SEG;
    this.currentZone = null;

    // Brotes y medidor de epidemia (mockup secciones 1.3/1.4)
    this.outbreakManager = new OutbreakManager(this, {
      criaderos: this.criaderos,
      bounds: { x: 0, y: 0, w: level.widthPx, h: level.heightPx },
      solidos: (data.objects || []).filter((o) => OBJECT_DEFS[o.type]?.solid),
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

    // Zoom automático + cámara de UI sin zoom (debe ir con toda la UI de la escena ya creada).
    applyCameraZoom(this);
    // Después del zoom (su handler de resize corre antes): límites de cámara con margen para la HUD.
    Layout.onResize(this, () => this.aplicarMargenCamara());
    this.registrarEventos();
    this.scene.launch('HUD');

    // Paneles que se apartan: cada 100 ms se avisa a la HUD qué queda debajo de sus paneles.
    this.minimapaEvitado = false;
    this.time.addEvent({ delay: EVITAR_MS, loop: true, callback: () => this.actualizarEvitar() });

    // Bonus por estudiar en la Biblioteca (v3 §1.1): +50 en la siguiente jornada tras 5 tarjetas nuevas.
    const bonus = Badges.bonusPendiente();
    if (bonus > 0) {
      Badges.consumirBonus();
      this.time.delayedCall(700, () => {
        if (this.terminado) return;
        this.sumarPuntos(bonus);
        this.alertToast.mostrar(t('game.toast.bonus', { n: bonus }), 3500);
      });
    }
  }

  /**
   * Límites de la cámara con margen (v3 §1.3): se amplían por arriba y por abajo (MARGEN_CAM en px
   * de pantalla → / zoom = px de mundo) para que, en los bordes del mapa, el jugador siga centrado
   * en la franja libre y nunca quede bajo la HUD ni bajo los controles.
   */
  aplicarMargenCamara() {
    const cam = this.cameras.main;
    if (!cam || !this.nivelW) return;
    const z = cam.zoom || 1;
    const portrait = Layout.isPortrait(this);
    const m = this.tactil ? (portrait ? MARGEN_CAM.tactilVertical : MARGEN_CAM.tactilHorizontal) : MARGEN_CAM.escritorio;
    const top = m.top / z, bottom = m.bottom / z;
    cam.setBounds(0, -top, this.nivelW, this.nivelH + top + bottom);
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
      on('nivel:reintentar', () => this.reintentar()),
      on('nivel:foto', () => this.scene.launch('Photo', { antes: FOTO_ANTES, despues: FOTO_DESPUES })),
      on('foto:cerrar', () => this.scene.launch('LevelEnd', this.resultado)),
      // Cámara con IA (CameraScene emite en Game.events) y Biblioteca (v3 §1.1/1.2).
      on('camera:cerrar', () => this.cerrarCamara()),
      on('camera:especie', (d) => this.onEspecieIdentificada(d)),
      on('library:cerrar', () => this.cerrarBiblioteca()),
    ];
    // La Biblioteca puede avisar por game.events (contrato compartido con el menú).
    const onLibGlobal = () => this.cerrarBiblioteca();
    this.game.events.on('library:cerrar', onLibGlobal);
    // Cambio de idioma en plena partida: republicar zona y misiones ya traducidas (el HUD escucha 'lang').
    const onLang = () => {
      if (!this.sys.settings.active) return;
      this.registry.set('zona', nombreZona(this.currentZone?.name));
      this.registry.set('misiones', this.missions.lista());
    };
    this.game.events.on('lang', onLang);
    this.events.once('shutdown', () => {
      offs.forEach((off) => off());
      this.game.events.off('library:cerrar', onLibGlobal);
      this.game.events.off('lang', onLang);
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
    // Tras cerrar la cámara/biblioteca con una tecla (Esc, E), esa misma pulsación llega aquí en el
    // siguiente frame: se ignoran las teclas de acción unos ms para no abrir la pausa o relanzar.
    const teclasOk = !this.overlayAbierto && this.time.now > (this.teclasBloqueadasHasta || 0);
    if (teclasOk && Phaser.Input.Keyboard.JustDown(this.keyEsc)) this.togglePausa();
    if (this.pausa.abierta || this.overlayAbierto) {
      // Pausa suave (menú de pausa, cámara o biblioteca): el reloj no avanza y el jugador no se
      // mueve; el resto de la escena sigue viva.
      this.tiempoInicio += this.game.loop.delta;
      this.joystick.update();
      return;
    }
    this.player.move(this.joystick.update());
    this.vehiculo.update();

    const zone = zoneAt(this.zones, this.player.x, this.player.y);
    if (zone !== this.currentZone) {
      this.currentZone = zone;
      this.registry.set('zona', zone ? nombreZona(zone.name) : '');
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
    this.outbreakManager.update(this.time.now - this.tiempoInicio);
    this.epidemicMeter.tick(this.game.loop.delta, {
      brotesActivos: this.outbreakManager.activos,
      criaderosSucios: Math.max(0, this.total - this.limpios),
    });
    // Solo se publica al cambiar el entero: escribirlo cada frame reinicia el tween de la barra del
    // HUD (450 ms) antes de que avance y la barra se queda visualmente en 0 %.
    const epidemiaEntera = Math.round(this.epidemicMeter.valor);
    if (epidemiaEntera !== this.registry.get('epidemia')) this.registry.set('epidemia', epidemiaEntera);
    if (this.epidemicMeter.valor >= UMBRAL_RIESGO && !this.superoUmbral) {
      this.superoUmbral = true;
      this.alertToast.mostrar(t('game.toast.riesgo'), 4000);
    }
    if (this.epidemicMeter.valor >= 100) { this.finDeNivel('epidemia'); return; }

    this.actualizarDeteccion();
    this.actualizarEstacionTip();
    this.actualizarMotor();

    this.minimap.update();
    this.compass.update(this.broteMasCercano());

    this.touch?.update({
      activo: this.activo || this.broteActivo || this.estacionActiva, limpiando: this.limpiando,
      progreso: this.fumigando ? this.fumigando.progresoFumigacion : 0,
    });

    // E: un toque limpia el criadero; sobre un brote hay que MANTENER la tecla (soltar cancela).
    if (teclasOk && Phaser.Input.Keyboard.JustDown(this.keyE)) this.accionInicio();
    if (Phaser.Input.Keyboard.JustUp(this.keyE)) this.accionFin();
    if (Phaser.Input.Keyboard.JustDown(this.keyV) || Phaser.Input.Keyboard.JustDown(this.keyF)) this.toggleVehiculo();
    if (teclasOk && Phaser.Input.Keyboard.JustDown(this.keyC)) this.abrirCamara();
  }

  // ---------- paneles que se apartan / cartel del lado opuesto (v3 §1.3) ----------

  /**
   * Cada EVITAR_MS: rectángulos en píxeles de pantalla del jugador, los brotes activos y el
   * criadero detectado → HUDScene.evitar (atenúa los paneles que los tapan) y minimapa (alpha
   * 0.35). Además el cartel de detección y el banner de tips se van al lado opuesto del objetivo.
   */
  actualizarEvitar() {
    if (this.terminado || !this.player?.body) return;
    const hud = this.scene.get('HUD');
    const W = this.scale.width, H = this.scale.height;
    const z = this.cameras.main.zoom || 1;
    const rects = [];
    const agregar = (x, y, w, h) => {
      const p = worldToScreen(this, x, y);
      const r = { x: p.x - (w * z) / 2, y: p.y - (h * z) / 2, w: w * z, h: h * z };
      if (r.x < W && r.x + r.w > 0 && r.y < H && r.y + r.h > 0) rects.push(r);
    };
    if (!this.overlayAbierto && !this.pausa.abierta) {
      agregar(this.player.x, this.player.y, 56, 72);
      for (const b of this.outbreakManager.activos) {
        if (b.state === 'fumigado') continue;
        agregar(b.x, b.y, (b.width || 80) + 16, (b.height || 80) + 16);
      }
      if (this.activo) agregar(this.activo.x, this.activo.y, 72, 72);
    }
    hud?.evitar?.(rects);

    // Minimapa: mismo tratamiento (alpha 0.35) si algo queda debajo.
    const mm = this.minimap;
    if (mm?.container) {
      const r = { x: mm.container.x, y: mm.container.y, w: mm.size, h: mm.size };
      const tapa = rects.some((k) => k.x < r.x + r.w && k.x + k.w > r.x && k.y < r.y + r.h && k.y + k.h > r.y);
      if (tapa !== this.minimapaEvitado) {
        this.minimapaEvitado = tapa;
        const a = tapa ? ALPHA_MINIMAPA_EVITAR : 1;
        if (typeof mm.setAlpha === 'function') mm.setAlpha(a);
        else {
          this.tweens.killTweensOf(mm.container);
          this.tweens.add({ targets: mm.container, alpha: a, duration: EVITAR_MS * 1.5 });
        }
      }
    }

    // Cartel y banner en el lado opuesto al objetivo (mitad superior → abajo, y viceversa).
    const objetivo = this.activo || this.broteActivo || (this.estacionActiva ? this.estacion : null);
    let ladoCartel = 'arriba', ladoDato = 'abajo';
    if (objetivo) {
      const p = worldToScreen(this, objetivo.x, objetivo.y);
      ladoCartel = p.y < H / 2 ? 'abajo' : 'arriba';
      ladoDato = ladoCartel;
    }
    // Arriba, el banner de alerta (AlertToast) ocupa la misma franja libre: mientras esté visible el
    // cartel se apoya bajo su borde inferior en vez de quedar tapado por él.
    const toast = this.alertToast;
    let topeArriba = null;
    if (ladoCartel === 'arriba' && toast?.visible && toast.container?.visible) {
      const tope = toast.container.y + (toast.alto || 50) + 8;
      // Solo si el cartel (100 px) sigue cabiendo entre el banner y el objetivo (pantallas bajas en
      // horizontal táctil): si no, se queda en su sitio — el banner es pasajero, tapar el brote no.
      const pObj = objetivo ? worldToScreen(this, objetivo.x, objetivo.y) : null;
      if (!pObj || tope + 100 <= pObj.y - 56) topeArriba = tope;
    }
    this.prompt.setLado?.(ladoCartel, topeArriba);
    // Si el cartel también va abajo, el banner se apoya sobre su borde superior (100 px de alto).
    const cartelAbajo = ladoDato === 'abajo' && this.prompt.isVisible() && this.prompt.lado === 'abajo';
    hud?.setLadoDato?.(ladoDato, cartelAbajo ? this.prompt.container.y - 50 - 8 : null);
  }

  // ---------- cámara con IA y biblioteca (v3 §1.1/1.2) ----------

  /**
   * Pausa suave mientras una escena encima (cámara o biblioteca) tiene el control: física y reloj
   * detenidos, controles táctiles/joystick/cartel/HUD ocultos; el resto de la escena sigue viva.
   * @param {'camara'|'biblioteca'} que
   */
  pausaSuave(que) {
    if (this.overlayAbierto) return;
    this.overlayAbierto = que;
    this.physics.pause();
    this.player.setVelocity(0);
    this.player.setSprint?.(false);
    this.player.play(`idle_${this.player.dir}`, true);
    if (this.motorOn) { this.motorOn = false; this.events.emit('sfx:stop', 'motor'); }
    this.prompt.hide();
    this.prompt.container.setVisible(false);
    this.prompt.hideLabel();
    this._objetivoPrompt = null;
    this.touch?.setVisible(false);
    if (this.tactil) { this.joystick.base?.setVisible(false); this.joystick.knob?.setVisible(false); }
    const hud = this.scene.get('HUD');
    this.hudVisibleAntes = !!hud?.sys?.settings?.visible;
    if (this.hudVisibleAntes) hud.sys.setVisible(false);
  }

  /** Reanuda tras pausaSuave (idempotente). */
  reanudar() {
    if (!this.overlayAbierto) return;
    this.overlayAbierto = null;
    this.teclasBloqueadasHasta = this.time.now + 300;
    if (!this.sys.settings.active) return;
    this.physics.resume();
    this.touch?.setVisible(true);
    if (this.tactil) { this.joystick.base?.setVisible(true); this.joystick.knob?.setVisible(true); }
    const hud = this.scene.get('HUD');
    if (this.hudVisibleAntes && hud?.sys) hud.sys.setVisible(true);
    if (this.mensajePendiente) {
      const msg = this.mensajePendiente;
      this.mensajePendiente = null;
      this.time.delayedCall(150, () => this.alertToast.mostrar(msg, 3500));
    }
  }

  /**
   * Botón CÁMARA / tecla C: captura 256×256 centrada en el brote más cercano (si está a menos de
   * RADIO_FOTO_BROTE px; si no, en el jugador) como textura 'cam_snap' y lanza la escena 'Camera'
   * con pausa suave. Bloqueada mientras se limpia/fumiga; aviso si la escena aún no existe.
   */
  async abrirCamara() {
    if (this.limpiando || this.terminado || this.pausa.abierta || this.overlayAbierto) return;
    if (!this.scene.get('Camera')) {
      this.alertToast.mostrar(t('game.toast.camaraPronto'), 3000);
      return;
    }
    const b = this.broteMasCercano();
    const brote = b && Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y) < RADIO_FOTO_BROTE ? b : null;
    this.pausaSuave('camara');
    const centro = brote || { x: this.player.x, y: this.player.y - 8 };
    await this.capturar(CAM_SNAP, centro);
    if (this.overlayAbierto !== 'camara' || !this.sys.settings.active) return;
    this.events.emit('sfx', 'click');
    this.scene.launch('Camera', {
      brote,
      especieId: brote?.especieId || null,
      snapshotKey: this.textures.exists(CAM_SNAP) ? CAM_SNAP : null,
    });
  }

  cerrarCamara() {
    if (this.overlayAbierto !== 'camara') return;
    if (this.scene.isActive('Camera') || this.scene.isPaused('Camera')) this.scene.stop('Camera');
    this.reanudar();
  }

  /** 'camera:especie' { id, confianza, nueva }: insignia "Fotógrafo" y aviso al volver al juego. */
  onEspecieIdentificada(d = {}) {
    const nombre = d.id ? tx(speciesById(d.id)?.nombre) : '';
    const texto = `${t('game.toast.especie')}${nombre ? ` ${nombre}` : ''}`;
    let nuevaInsignia = false;
    try { nuevaInsignia = !!Badges.otorgar?.('fotografo'); } catch { /* insignias no disponibles */ }
    this.registry.set('mensaje', texto);
    this.mensajePendiente = nuevaInsignia ? t('game.toast.insignia', { texto, insignia: t('lib.insignia.fotografo') }) : texto;
  }

  /**
   * Acción en la estación SEDES (E / botón ACCIÓN con el cartel en modo 'estacion'): abre la
   * Biblioteca ('Library', { desde: 'estacion' }) con pausa suave; si la escena aún no existe,
   * muestra el tip de la estación y un aviso.
   */
  abrirBiblioteca() {
    if (this.limpiando || this.terminado || this.pausa.abierta || this.overlayAbierto) return;
    if (!this.scene.get('Library')) {
      this.mostrarTip('estacion');
      this.alertToast.mostrar(t('game.toast.bibliotecaPronto'), 3000);
      return;
    }
    this.pausaSuave('biblioteca');
    this.events.emit('sfx', 'click');
    this.scene.launch('Library', { desde: 'estacion' });
  }

  cerrarBiblioteca() {
    if (this.overlayAbierto !== 'biblioteca') return;
    if (this.scene.isActive('Library') || this.scene.isPaused('Library')) this.scene.stop('Library');
    this.reanudar();
    this.mostrarTip('estacion');
  }

  /** Loop del motor mientras el agente va en la camioneta y se mueve. */
  actualizarMotor() {
    const on = this.enVehiculo && this.player.body.speed > MOTOR_MIN_SPEED;
    if (on === this.motorOn) return;
    this.motorOn = on;
    this.events.emit(on ? 'sfx:loop' : 'sfx:stop', 'motor');
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

    // Desde la camioneta se fumiga, pero no se limpian criaderos (hay que bajarse).
    let nearestC = null, bestC = Criadero.RADIO_DETECCION;
    if (!this.enVehiculo) {
      for (const c of this.criaderos) {
        if (c.state === 'limpio') continue;
        const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
        if (d <= bestC) { bestC = d; nearestC = c; }
      }
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
    // Sin criadero ni brote a mano y a pie en la estación: la acción abre la Biblioteca.
    this.estacionActiva = !nearestC && !nearestB && !this.enVehiculo && this.estacion.cerca(this.player);

    const objetivo = this.activo || this.broteActivo || (this.estacionActiva ? this.estacion : null);
    if (objetivo === this._objetivoPrompt) return;
    this._objetivoPrompt = objetivo;
    if (objetivo) {
      if (objetivo !== this.estacion) this.events.emit('sfx', 'detect');
      this.prompt.setModo(this.activo ? 'criadero' : this.broteActivo ? 'brote' : 'estacion');
      this.prompt.show();
      this.prompt.showLabelAt(objetivo.x, objetivo.y - (objetivo === this.estacion ? 72 : 40));
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
      this.actualizarMotor();
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
    const lista = tipsL()[categoria];
    if (!Array.isArray(lista) || !lista.length) return;
    const texto = Phaser.Utils.Array.GetRandom(lista);
    this.scene.get('HUD')?.mostrarDato?.(texto, ms);
  }

  /** Nuevo brote detectado por el OutbreakManager: aviso (y tip tutorial la primera vez). */
  onBroteNuevo(b) {
    const zona = zoneAt(this.zones, b.x, b.y);
    const aviso = t('game.toast.brote', { zona: zona ? nombreZona(zona.name) : t('game.elBarrio') });
    if (!this.brotesVistos) {
      this.brotesVistos = true;
      const tutorial = tipsL().brote?.[0];
      this.alertToast.mostrar(tutorial ? `${tutorial} ${aviso}` : aviso, 5000);
    } else {
      this.alertToast.mostrar(aviso);
    }
  }

  /**
   * Botón "Eliminar agua" / "Fumigar" del cartel (ratón): el criadero cercano tiene prioridad
   * sobre el brote; con un clic la fumigación corre sola hasta el final (no hay "mantener").
   * El botón ACCIÓN táctil pasa por accionInicio/accionFin (mantener) y solo llega aquí con un
   * toque corto sobre un criadero.
   */
  intentarLimpiar() {
    if (this.activo) return this.limpiarCriadero(this.activo);
    if (this.broteActivo) return this.fumigarBrote(this.broteActivo, { mantener: false });
    if (this.estacionActiva) return this.abrirBiblioteca();
  }

  /**
   * Tecla E o botón ACCIÓN presionados: limpia el criadero (un toque) o empieza a fumigar el
   * brote (mantener; soltar cancela, ver accionFin).
   */
  accionInicio() {
    if (this.activo) return this.limpiarCriadero(this.activo);
    if (this.broteActivo) return this.fumigarBrote(this.broteActivo, { mantener: true });
    if (this.estacionActiva) return this.abrirBiblioteca();
  }

  /** Tecla E / botón ACCIÓN soltados: si se estaba fumigando "manteniendo", se interrumpe (el brote sigue activo). */
  accionFin() {
    if (this.fumigando) this.fumigando.cancelarFumigacion();
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
      this.textoFlotante(c.x, c.y - 24, t('game.mas', { n: r.puntos }), PALETTE.amarillo);
      if (r.bonus) this.textoFlotante(c.x, c.y - 52, t('game.combo', { n: r.bonus }), PALETTE.teja);

      this.registry.set('puntos', r.total);
      this.registry.set('limpios', this.limpios);
      this.registry.set('progreso', this.score.progreso(this.limpios, this.total));
      this.missions.onCriaderoLimpio(c);
      this.epidemicMeter.registrarLimpieza();
      this.scene.get('HUD')?.flashPuntos?.();
      const fact = factsL()[c.type];
      if (fact) console.log(`[Dengue] ${fact.nombre}: ${fact.dato} (${fact.fuente})`);

      // Popup educativo: el juego se pausa hasta 'popup:cerrado'.
      this.scene.launch('Popup', { type: c.type });
      this.scene.pause();
    }
  }

  /**
   * Fumigar un brote (GDD sección 3): FumigationFX ya se ocupa de la duración (2,5 s a pie,
   * 1,5 s con `enVehiculo`, ×1,5 si es grande), acá solo bloqueamos al jugador mientras corre y
   * sumamos puntos/tip al terminar. Con `mantener` (tecla E) soltar la tecla cancela la
   * fumigación (ver accionFin) y el brote sigue activo; sin `mantener` (botón táctil) corre sola.
   * Sin popup educativo (a diferencia de los criaderos): el aviso ya lo dio AlertToast.
   */
  async fumigarBrote(b, { mantener = false } = {}) {
    if (!b || this.limpiando || this.terminado || this.pausa.abierta || b.state !== 'activo') return;
    this.limpiando = true;
    this.fumigando = mantener ? b : null;
    this.broteActivo = null;
    this.prompt.hide();
    this.prompt.hideLabel();

    this.player.bloqueado = true;
    this.player.setVelocity(0);
    this.player.play(`idle_${this.player.dir}`, true);
    this.prompt.setBusy(true);
    this.actualizarMotor();

    const nivel = b.nivel;
    let completado = false;
    try {
      completado = await b.fumigar({ rapido: this.enVehiculo });
    } finally {
      this.fumigando = null;
      if (this.sys.settings.active || this.sys.isPaused()) { // si no, la escena se cerró durante la animación
        if (completado) {
          const puntos = PUNTOS_BROTE[nivel] ?? PUNTOS_BROTE.pequeno;
          this.sumarPuntos(puntos);
          this.textoFlotante(b.x, b.y - 24, t('game.mas', { n: puntos }), PALETTE.amarillo);
          this.epidemicMeter.registrarFumigado(nivel);
          this.mostrarTip('fumigar');
        }
        this.player.bloqueado = false;
        this.prompt.setBusy(false);
        this._objetivoPrompt = null; // que actualizarDeteccion vuelva a mostrar el cartel si sigue en rango
        this.limpiando = false;
      }
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
    // El banner de alerta tampoco aporta en el resumen (y su tween de salida quedaría congelado).
    this.alertToast.ocultar();
    this.alertToast.container.setVisible(false);
    // Controles táctiles, joystick, minimapa y brújula se verían a través del fondo semitransparente
    // de LevelEnd (en vertical, justo bajo los botones del resumen): fuera también.
    this.touch?.setVisible(false);
    this.joystick?.base?.setVisible(false);
    this.joystick?.knob?.setVisible(false);
    this.minimap?.container?.setVisible(false);
    this.compass?.flecha?.setVisible(false);
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

  /** "Intentar de nuevo" en la pantalla de fin: reinicia la jornada del mismo nivel desde cero. */
  reintentar() {
    this.scene.stop('HUD');
    if (this.sys.isPaused()) this.scene.resume();
    this.scene.restart({ levelId: this.levelId });
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
      const W = this.scale.width, H = this.scale.height;
      // Con zoom ≠ 1 la cámara escala alrededor de su centro: usar la misma fórmula que worldToScreen.
      const p = worldToScreen(this, c.x, c.y);
      const sx = Phaser.Math.Clamp(Math.round(p.x - FOTO_SIZE / 2), 0, Math.max(0, W - FOTO_SIZE));
      const sy = Phaser.Math.Clamp(Math.round(p.y - FOTO_SIZE / 2), 0, Math.max(0, H - FOTO_SIZE));
      // Ocultar overlays (HUD, cartel, joystick) para que la foto muestre solo el barrio.
      const hud = this.scene.get('HUD');
      const hudVisible = !!hud?.sys?.settings?.visible;
      if (hudVisible) hud.sys.setVisible(false);
      const overlays = [this.prompt?.container, this.prompt?.worldLabel, this.joystick?.base, this.joystick?.knob,
        this.minimap?.container, this.alertToast?.container,
        ...(this.compass?.overlays?.() || [this.compass?.flecha]),
        ...(this.touch?.overlays() || [])].filter((o) => o && o.visible);
      overlays.forEach((o) => o.setVisible(false));
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        // Si la jornada terminó mientras se capturaba (foto 'después' del último criadero), los
        // overlays quedan ocultos: si no, reaparecían (banner de alerta incluido) sobre LevelEnd.
        if (hudVisible && hud.sys && !this.terminado) hud.sys.setVisible(true);
        if (!this.terminado) overlays.forEach((o) => o.active && o.setVisible(true));
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

  /** Crea un brote en (x, y) para pruebas (pasa por el OutbreakManager: aviso, minimapa, brújula). */
  debugSpawnBrote(x, y) {
    return this.outbreakManager.spawn({ x, y });
  }

  /** Avanza el reloj de la jornada `seg` segundos (pruebas del fin por tiempo). */
  debugTiempo(seg) {
    this.tiempoInicio -= seg * 1000;
  }
}
