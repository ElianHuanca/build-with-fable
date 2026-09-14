import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { especieAleatoria, speciesById } from '../data/species.js';
import { playFumigation, cancelFumigation, fumigationProgress } from '../systems/FumigationFX.js';

// Mosquitos individuales por nivel (plan v3, sección 1.4) y radio de la órbita del enjambre.
const MOSQUITOS_POR_NIVEL = { pequeno: 8, medio: 14, grande: 22 };
const RADIO_POR_NIVEL = { pequeno: 22, medio: 32, grande: 44 };
// Tope global de sprites de mosquito en pantalla (rendimiento); si se alcanza, el enjambre
// se crea con menos individuos (nunca menos de MIN_MOSQUITOS).
const MAX_MOSQUITOS_TOTAL = 70;
const MIN_MOSQUITOS = 4;
const MINI_SIZE = 24;
const NUBE_TEX = 64;
const ROJO = '#e5383b';
const DEPTH_OFFSET = 18;

// Tiempo desde que aparece hasta pasar a 'medio', y desde 'medio' hasta 'grande'.
const TIEMPO_A_MEDIO = 20000;
const TIEMPO_A_GRANDE = 40000;
// Un brote grande tarda más en fumigarse (GDD: ×1,5).
const FACTOR_FUMIGACION = { pequeno: 1, medio: 1, grande: 1.5 };
const NIVELES = ['pequeno', 'medio', 'grande'];

/**
 * Brote de mosquitos en el barrio (mockup, sección 1.3; plan v3, sección 1.4). Estados:
 * activo → fumigando → fumigado. Niveles: pequeño (8 mosquitos) → medio (14, a los 20 s) →
 * grande (22, 40 s más), cada uno más grande y más lento de fumigar.
 *
 * Es un Container: una nube gris translúcida (halo rojo en nivel grande) y N mosquitos
 * individuales (`mosq_<especie>_mini`, 24×24; fallback dibujado con Graphics) que orbitan el
 * centro con radio y velocidad propios, vibran y miran hacia donde vuelan. `agitacion` (0..1,
 * lo sube FumigationFX) multiplica la vibración. Los mosquitos que FumigationFX derriba no
 * vuelven aunque se cancele: el enjambre queda reducido.
 *
 * `especieId` (species.js) se elige al azar si no se pasa; lo lee la cámara IA.
 * Emite 'crecio' (this) al subir de nivel y 'fumigado' (this) al terminar de fumigarse.
 */
export class Brote extends Phaser.GameObjects.Container {
  /** Radio de detección de un brote activo (GameScene usa el mismo valor). */
  static RADIO_DETECCION = 90;
  /** Sprites de mosquito vivos en toda la escena (tope de rendimiento). */
  static totalMosquitos = 0;

  constructor(scene, x, y, { especieId } = {}) {
    super(scene, x, y);
    this.nivel = 'pequeno';
    this.state = 'activo';
    this.fumigarPromise = null;
    this.especieId = especieId || especieAleatoria().id;
    this.agitacion = 0;
    this.mosquitos = [];
    this.tiempo = Math.random() * 1000;

    // Nube base y halo (el halo se enciende en nivel grande).
    // Nube y halo como imágenes (una textura suave generada) para no romper el batch de sprites.
    this.halo = scene.add.image(0, 4, Brote.nubeTexture(scene)).setTint(hex(ROJO)).setAlpha(0.22).setVisible(false);
    this.nube = scene.add.image(0, 4, Brote.nubeTexture(scene)).setTint(hex(PALETTE.gris)).setAlpha(0.35);
    this.add([this.halo, this.nube]);

    scene.add.existing(this);
    this.setDepth(y + DEPTH_OFFSET);
    this.aplicarNivel();

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.actualizar, this);
    this.programarCrecimiento();

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.detenerCrecimiento();
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.actualizar, this);
      Brote.totalMosquitos = Math.max(0, Brote.totalMosquitos - this.mosquitos.length);
      this.mosquitos = [];
    });
  }

  /** Programa (o reprograma, tras una fumigación cancelada) el paso al siguiente nivel. */
  programarCrecimiento() {
    this.detenerCrecimiento();
    if (!this.scene || this.nivel === 'grande') return;
    const ms = this.nivel === 'pequeno' ? TIEMPO_A_MEDIO : TIEMPO_A_GRANDE;
    const siguiente = this.nivel === 'pequeno' ? 'medio' : 'grande';
    this.growTimer = this.scene.time.delayedCall(ms, () => this.crecer(siguiente));
  }

  /**
   * Textura del mosquito pequeño para una especie: `mosq_<id>_mini` si está cargada; si no,
   * `mosquitos_1`; si no, un mosquito dibujado (cuerpo oscuro, alas celestes translúcidas).
   */
  static miniTextureFor(scene, especieId) {
    const sp = speciesById(especieId);
    if (scene.textures.exists(sp.spriteMini)) return sp.spriteMini;
    if (scene.textures.exists('mosquitos_1')) return 'mosquitos_1';
    const fb = 'fb_mosq_mini';
    if (!scene.textures.exists(fb)) {
      const S = MINI_SIZE, c = S / 2;
      const rt = scene.add.renderTexture(0, 0, S, S).setVisible(false);
      const g = scene.add.graphics();
      g.fillStyle(hex(PALETTE.celeste), 0.55).fillEllipse(c - 5, c - 4, 12, 6).fillEllipse(c + 5, c - 4, 12, 6);
      g.lineStyle(1, hex(PALETTE.linea), 0.7);
      for (const k of [-1, 0, 1]) g.lineBetween(c, c + 1, c + k * 6 - 2, c + 9).lineBetween(c, c + 1, c + k * 6 + 2, c + 9);
      g.fillStyle(hex(PALETTE.linea), 1).fillEllipse(c, c + 1, 12, 5).fillCircle(c + 6, c, 2.5);
      g.fillStyle(hex(PALETTE.blanco), 0.9).fillRect(c - 3, c, 1.5, 3).fillRect(c + 1, c, 1.5, 3);
      rt.draw(g).saveTexture(fb);
      g.destroy(); rt.destroy();
    }
    return fb;
  }

  /** Disco blanco suave de 64 px (se tiñe para nube gris y halo rojo). */
  static nubeTexture(scene) {
    const key = 'fb_nube_brote';
    if (!scene.textures.exists(key)) {
      const rt = scene.add.renderTexture(0, 0, NUBE_TEX, NUBE_TEX).setVisible(false);
      const g = scene.add.graphics();
      for (let r = NUBE_TEX / 2, a = 0.1; r > 6; r -= 4, a += 0.08) g.fillStyle(0xffffff, a).fillCircle(NUBE_TEX / 2, NUBE_TEX / 2, r);
      rt.draw(g).saveTexture(key);
      g.destroy(); rt.destroy();
    }
    return key;
  }

  /** Cantidad objetivo de mosquitos según nivel y tope global. */
  cantidadObjetivo() {
    const deseados = MOSQUITOS_POR_NIVEL[this.nivel] ?? MOSQUITOS_POR_NIVEL.pequeno;
    const libres = MAX_MOSQUITOS_TOTAL - (Brote.totalMosquitos - this.mosquitos.length);
    return Math.max(MIN_MOSQUITOS, Math.min(deseados, libres));
  }

  /** Ajusta nube, halo, tamaño y cantidad de mosquitos al nivel actual. */
  aplicarNivel() {
    const r = RADIO_POR_NIVEL[this.nivel] ?? RADIO_POR_NIVEL.pequeno;
    this.radioOrbita = r;
    this.setSize(r * 2 + MINI_SIZE, r * 2 + MINI_SIZE);
    this.scene.tweens.add({ targets: this.nube, scaleX: r * 2.3 / NUBE_TEX, scaleY: r * 1.7 / NUBE_TEX, duration: 300, ease: 'Sine.easeOut' });
    this.halo.setVisible(this.nivel === 'grande').setScale(r * 2.9 / NUBE_TEX, r * 2.2 / NUBE_TEX);
    if (this.nivel === 'grande' && !this.haloTween) {
      this.haloTween = this.scene.tweens.add({ targets: this.halo, alpha: 0.5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const faltan = this.cantidadObjetivo() - this.mosquitos.length;
    for (let i = 0; i < faltan; i++) this.agregarMosquito();
  }

  /** Crea un mosquito con su órbita propia y lo suma al enjambre. */
  agregarMosquito() {
    const key = Brote.miniTextureFor(this.scene, this.especieId);
    const m = this.scene.add.image(0, 0, key).setScale(0.85 + Math.random() * 0.3);
    m.orbita = {
      ang: Math.random() * Math.PI * 2,
      radio: this.radioOrbita * (0.45 + Math.random() * 0.65),
      vel: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.6),
      vib: 1.5 + Math.random() * 2,
      fase: Math.random() * Math.PI * 2,
      alt: 0.35 + Math.random() * 0.4, // aplastamiento vertical de la órbita (vista 3/4)
    };
    m.caido = false;
    this.add(m);
    this.mosquitos.push(m);
    Brote.totalMosquitos++;
    return m;
  }

  /** Mosquitos que siguen volando (los que FumigationFX puede derribar). */
  mosquitosVivos() { return this.mosquitos.filter((m) => !m.caido); }

  /**
   * Saca un mosquito de la órbita (FumigationFX anima su caída). No vuelve al cancelar.
   * Devuelve las coordenadas locales actuales para que la caída arranque donde estaba.
   */
  derribar(m) {
    if (!m || m.caido) return;
    m.caido = true;
    this.mosquitos = this.mosquitos.filter((k) => k !== m);
    Brote.totalMosquitos = Math.max(0, Brote.totalMosquitos - 1);
  }

  /** Órbita + vibración de cada mosquito (cada frame). */
  actualizar(_t, delta) {
    if (!this.scene || !this.visible) return;
    const dt = delta / 1000;
    this.tiempo += dt;
    const agit = 1 + this.agitacion * 3;
    const t = this.tiempo;
    for (const m of this.mosquitos) {
      const o = m.orbita;
      o.ang += o.vel * agit * dt;
      const vx = Math.sin(t * 17 + o.fase) * o.vib * agit;
      const vy = Math.cos(t * 23 + o.fase) * o.vib * agit;
      const nx = Math.cos(o.ang) * o.radio + vx;
      const ny = Math.sin(o.ang) * o.radio * o.alt + vy;
      m.setFlipX(nx < m.x); // mira hacia donde vuela
      m.setPosition(nx, ny);
      m.setRotation(Math.sin(t * 29 + o.fase) * 0.12 * agit);
    }
  }

  /** Avanza de nivel (llamado por el propio timer de crecimiento). */
  crecer(nivel) {
    if (this.state !== 'activo' || this.nivel === nivel || !this.scene) return;
    this.nivel = nivel;
    this.aplicarNivel();
    this.setDepth(this.y + DEPTH_OFFSET);
    this.scene.events.emit('sfx', 'buzz');
    this.scene.tweens.add({ targets: this, scale: 1.25, duration: 180, yoyo: true, ease: 'Back.easeOut' });
    this.emit('crecio', this);
    this.programarCrecimiento();
  }

  /** Sube un nivel de inmediato (pruebas/depuración). Devuelve el nivel resultante. */
  subirNivel() {
    const i = NIVELES.indexOf(this.nivel);
    if (i >= 0 && i < NIVELES.length - 1) this.crecer(NIVELES[i + 1]);
    return this.nivel;
  }

  /** Cancela el crecimiento automático (se llama al empezar a fumigar o al destruirse). */
  detenerCrecimiento() {
    if (this.growTimer) { this.growTimer.remove(); this.growTimer = null; }
  }

  /**
   * Fumigación con FumigationFX (~2.5 s a pie, ~1.5 s con `rapido` desde la camioneta; ×1,5 si
   * el brote es grande). state: 'fumigando' → 'fumigado' (lo marca FumigationFX, que también
   * emite 'fumigado'). Reentrada bloqueada. Si la FX fallara, igual queda en 'fumigado' y emite
   * el evento. Si se cancela con `cancelarFumigacion()` (el jugador soltó el botón), vuelve a
   * 'activo', reanuda el crecimiento y resuelve `false`.
   * @param {{ rapido?: boolean }} [opts]
   * @returns {Promise<boolean>} true si quedó fumigado
   */
  fumigar(opts = {}) {
    if (this.fumigarPromise) return this.fumigarPromise;
    if (this.state === 'fumigado') return Promise.resolve(true);
    this.state = 'fumigando';
    this.detenerCrecimiento();
    const scene = this.scene;
    this.fumigarPromise = playFumigation(scene, this, { ...opts, factor: FACTOR_FUMIGACION[this.nivel] ?? 1 })
      .catch((err) => {
        console.warn('[Brote] FumigationFX falló, aplicando estado fumigado directo', err);
        if (this.scene) this.setAlpha(0);
        this.state = 'fumigado';
        this.emit('fumigado', this);
        return true;
      })
      .then((completado) => {
        this.fumigarPromise = null;
        if (!completado && this.state === 'fumigando') {
          this.state = 'activo';
          this.programarCrecimiento();
        }
        return completado;
      });
    return this.fumigarPromise;
  }

  /** Interrumpe la fumigación en curso (si la hay); la Promise de `fumigar()` resuelve `false`. */
  cancelarFumigacion() {
    if (this.state !== 'fumigando') return false;
    return cancelFumigation(this);
  }

  /** Progreso 0..1 de la fumigación en curso. */
  get progresoFumigacion() { return fumigationProgress(this); }
}
