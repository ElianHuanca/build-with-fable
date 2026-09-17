import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

// Cantidad de vecinos por defecto si no se especifica `cantidad`, y tope duro para no
// desmadrar el rendimiento (cada vecino es un Container + Graphics, barato pero no gratis).
const CANTIDAD_DEFAULT = 4;
const MAX_VECINOS = 8;

// Velocidad de caminata, más lenta que el jugador (mundo decorativo, no hay urgencia).
const VELOCIDAD_MIN = 25;
const VELOCIDAD_MAX = 35;
// Tiempo parado en un punto antes de elegir el próximo destino.
const ESPERA_MIN_MS = 2000;
const ESPERA_MAX_MS = 6000;
// Cada cuánto un vecino "bota" basura (delegado por callback, ver `onBotar`).
const BOTAR_MIN_MS = 15000;
const BOTAR_MAX_MS = 30000;
// Distancia a la que se considera "llegado" al punto destino.
const LLEGADA_PX = 4;

// Combinaciones de color de ropa para el dibujo de respaldo (si las texturas `vecino_N` no
// cargaron) — mismos 5 colores que usa `tools/gen-assets.mjs` para los sprites reales.
const COLORES_ROPA = [
  PALETTE.teja,
  PALETTE.azulGorra,
  PALETTE.verdeOscuro,
  PALETTE.amarillo,
  PALETTE.gris,
];
/** Cantidad de variantes de sprite `vecino_1..vecino_N` generadas por tools/gen-assets.mjs
 *  (5 hombres + 2 mujeres + 2 niños/as, ver `buildVecinos`). */
const VARIANTES_SPRITE = 9;

// --- Comportamiento en grupo (caminar juntos de tanto en tanto) ---
// Probabilidad de que, al elegir nuevo destino, un vecino "arrastre" con él a otros vecinos
// cercanos hacia el mismo punto (simula que van juntos un tramo, sin formación ni despedida).
const PROB_ARRASTRAR_GRUPO = 0.25;
// Radio dentro del cual se buscan compañeros de grupo, y cuántos como máximo se suman.
const RADIO_ARRASTRE_PX = 60;
const MAX_ARRASTRADOS = 2;

// --- "Vecino enfermo" (plan v4: hacer visible el riesgo de epidemia, no solo un número) ---
// Bandas del `EpidemicMeter` (0..100) que, al cruzarse HACIA ARRIBA, pueden enfermar a un
// vecino. Coincide a grandes rasgos con cómo escala la gravedad en `OutbreakManager`/`Brote`
// (más riesgo acumulado = consecuencia más visible), sin acoplarse a esos sistemas.
const BANDAS_ENFERMEDAD = [25, 50, 75, 100];
// Una banda ya usada solo vuelve a estar disponible si el riesgo baja al menos esto por debajo
// de ella (histéresis: evita reenfermar en bucle si el valor oscila justo en el límite).
const HISTERESIS_BANDA = 10;
// Aunque se crucen varias bandas de golpe (ej. un brote grande que dispara el riesgo), como
// mucho un vecino nuevo enferma cada COOLDOWN_ENFERMEDAD_MS: no queremos "spamear" el barrio.
const COOLDOWN_ENFERMEDAD_MS = 20000;
// Un vecino enfermo camina más lento que uno sano (no pathfinding: línea recta al hospital,
// mismo esquema que el resto de esta clase).
const VELOCIDAD_ENFERMO = 18;
// Distancia a la que se considera "llegó al hospital" (más chica que el radio que usa
// `Hospital.cerca` para el jugador: acá es solo un punto de destino, no una interacción).
const LLEGADA_HOSPITAL_PX = 20;
// Cuánto descansa "internado" (invisible) antes de volver sano al pool normal.
const RECUPERACION_MIN_MS = 8000;
const RECUPERACION_MAX_MS = 15000;

/** Dibuja el ícono de síntoma (gota de sudor, mismo estilo flat/chibi del resto del juego) en
 * coordenadas locales del container del vecino, justo arriba de la cabeza (cabeza en y=-8). */
function dibujarIconoEnfermo(g) {
  const cx = 7, cy = -21;
  g.fillStyle(hex(PALETTE.celeste), 1);
  g.fillTriangle(cx - 4, cy + 3, cx + 4, cy + 3, cx, cy - 5);
  g.fillCircle(cx, cy + 4, 4);
  g.lineStyle(1, hex(PALETTE.linea), 1);
  g.strokeCircle(cx, cy + 4, 4);
}

/**
 * Vecinos — puebla el barrio con NPCs decorativos que caminan entre puntos fijos (frente a
 * casas, veredas) a paso lento y de tanto en tanto "botan" basura. Es un manager plano, no una
 * Scene ni un GameObject: crea/destruye los Container de cada vecino y avisa por callback,
 * siguiendo el mismo patrón que `OutbreakManager` (sección 2 del plan v4).
 *
 * Esta clase NO conoce `Basura`: cuando un vecino decide botar algo solo llama a
 * `onBotar(x, y)` con su posición actual; quien instancie `Vecinos` decide qué crear ahí.
 *
 * No hay pathfinding ni colisión con sólidos del mapa: los vecinos caminan en línea recta
 * entre puntos candidatos dentro de `bounds`. Es decoración ambiental, no simulación.
 *
 * "Vecino enfermo" (plan v4): además del wander decorativo, `consumirRiesgo()` puede hacer que
 * un vecino sano se enferme y camine al hospital cuando el riesgo de epidemia cruza ciertas
 * bandas — ver el JSDoc de `consumirRiesgo` para el detalle de bandas/histéresis/cooldown.
 *
 * API pública:
 *   new Vecinos(scene, { puntos, bounds, cantidad, onBotar })
 *   .update(deltaMs)                          — llamar cada frame desde GameScene.update()
 *   .consumirRiesgo(epidemiaValor, hospital)  — llamar periódicamente (ej. 1 vez/seg) con
 *                                                EpidemicMeter.valor y el Hospital del nivel
 *   .destroy()                                — llamar desde el shutdown de la escena
 */
export class Vecinos {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ puntos: Array<{x:number,y:number}>, bounds: {x:number,y:number,w:number,h:number},
   *   cantidad?: number, onBotar?: (x:number, y:number) => void }} opts
   *   puntos: posiciones candidatas donde un vecino puede pararse (ej. frente a casas); cada
   *   vecino nace en un punto al azar y elige el próximo destino entre los mismos puntos;
   *   bounds: rectángulo del mapa, mismo formato que recibe `OutbreakManager` (se usa solo
   *   para tener un punto de respaldo si no hay `puntos`, y para no dibujar fuera del mapa);
   *   cantidad: cuántos vecinos crear (default CANTIDAD_DEFAULT, tope MAX_VECINOS);
   *   onBotar: se dispara con la posición (x, y) del vecino cuando bota basura; no crea nada,
   *   delega en quien escuche.
   */
  constructor(scene, { puntos = [], bounds, cantidad = CANTIDAD_DEFAULT, onBotar = null } = {}) {
    this.scene = scene;
    this.bounds = bounds || { x: 0, y: 0, w: scene.scale.width, h: scene.scale.height };
    this.puntos = puntos.length > 0 ? puntos : [{ x: this.bounds.x + this.bounds.w / 2, y: this.bounds.y + this.bounds.h / 2 }];
    this.onBotarCb = onBotar;
    this.destruido = false;
    this.vecinos = [];
    // Estado del mecanismo "vecino enfermo" (ver consumirRiesgo/enfermar más abajo).
    this.relojMs = 0;
    this.ultimaBandaUsada = 0;
    this.ultimoEnfermarMs = -Infinity;

    const total = Phaser.Math.Clamp(Math.floor(cantidad), 0, MAX_VECINOS);
    for (let i = 0; i < total; i++) {
      this.vecinos.push(this.crearVecino());
    }

    scene.events.once('shutdown', () => this.destroy());
  }

  /**
   * Crea el Container del vecino y su estado de movimiento/temporizadores. Usa el sprite
   * animado `vecino_<variante>_<dir>_<frame>` (mismo estilo y esquema de animación que el
   * personaje principal, `tools/gen-assets.mjs` → `vecinoSVG`, anims creadas en
   * `BootScene.create()`) si la textura cargó; si no, cae al dibujo simple y estático con
   * Graphics (mismo patrón de fallback que el resto del proyecto: Criadero, Brote, Basura...).
   */
  crearVecino() {
    const inicio = Phaser.Utils.Array.GetRandom(this.puntos);
    const variante = Phaser.Math.Between(1, VARIANTES_SPRITE);
    const animado = this.scene.textures.exists(`vecino_${variante}_down_0`);

    let visual;
    if (animado) {
      visual = this.scene.add.sprite(0, 0, `vecino_${variante}_down_0`);
      visual.play(`vecino_${variante}_idle_down`);
    } else {
      const g = this.scene.add.graphics();
      const colorRopa = hex(Phaser.Utils.Array.GetRandom(COLORES_ROPA));
      // Cuerpo: rectángulo redondeado, centrado en (0, 0) del container.
      g.fillStyle(colorRopa, 1);
      g.fillRoundedRect(-5, -4, 10, 14, 3);
      // Cabeza: óvalo de piel, apenas arriba del cuerpo.
      g.fillStyle(hex(PALETTE.piel), 1);
      g.fillEllipse(0, -8, 8, 9);
      visual = g;
    }

    const container = this.scene.add.container(inicio.x, inicio.y, [visual]);
    container.setDepth(inicio.y);

    const vecino = {
      container,
      sprite: animado ? visual : null,
      variante,
      dir: 'down',
      destino: null,
      velocidad: Phaser.Math.FloatBetween(VELOCIDAD_MIN, VELOCIDAD_MAX),
      esperaMs: 0,
      proximoBotarMs: Phaser.Math.Between(BOTAR_MIN_MS, BOTAR_MAX_MS),
      // Estado del mecanismo "vecino enfermo": ver enfermar()/actualizarEnfermo()/internar().
      enfermo: false,
      enHospital: false,
      iconoEnfermo: null,
    };
    this.elegirDestino(vecino);
    return vecino;
  }

  /** Cambia a la animación 'walk'/'idle' de la dirección dada, sin reiniciarla si ya es la activa. */
  reproducirAnim(vecino, dir, caminando) {
    if (!vecino.sprite) return;
    vecino.dir = dir;
    const key = `vecino_${vecino.variante}_${caminando ? 'walk' : 'idle'}_${dir}`;
    vecino.sprite.play(key, true);
  }

  /**
   * Elige un punto candidato distinto del actual como próximo destino.
   * @param {object} vecino
   * @param {boolean} permitirArrastre si true (solo se pasa al elegir destino "en vivo", no al
   *   crear el vecino), con baja probabilidad (`PROB_ARRASTRAR_GRUPO`) arrastra a 1-2 vecinos
   *   cercanos (`RADIO_ARRASTRE_PX`) hacia el mismo punto — simula que un par se va junto un
   *   tramo. No es flocking ni pathfinding: solo les copia el destino y los saca de la espera si
   *   estaban parados; cada uno sigue caminando en línea recta de forma independiente.
   */
  elegirDestino(vecino, permitirArrastre = false) {
    const { x, y } = vecino.container;
    let candidato = Phaser.Utils.Array.GetRandom(this.puntos);
    // Si hay más de un punto, evitar elegir el mismo donde ya está parado.
    if (this.puntos.length > 1) {
      let intentos = 5;
      while (Phaser.Math.Distance.Between(x, y, candidato.x, candidato.y) < LLEGADA_PX && intentos-- > 0) {
        candidato = Phaser.Utils.Array.GetRandom(this.puntos);
      }
    }
    vecino.destino = candidato;

    if (permitirArrastre && this.puntos.length > 1 && Math.random() < PROB_ARRASTRAR_GRUPO) {
      let arrastrados = 0;
      for (const otro of this.vecinos) {
        if (arrastrados >= MAX_ARRASTRADOS) break;
        if (otro === vecino || !otro.container) continue;
        const dist = Phaser.Math.Distance.Between(x, y, otro.container.x, otro.container.y);
        if (dist <= RADIO_ARRASTRE_PX) {
          otro.destino = candidato;
          otro.esperaMs = 0; // si estaba esperando, arranca a caminar ya junto al otro.
          arrastrados++;
        }
      }
    }
  }

  /**
   * Llamar cada frame desde GameScene.update().
   * @param {number} deltaMs ms transcurridos desde el frame anterior
   */
  update(deltaMs) {
    if (this.destruido) return;
    const deltaS = deltaMs / 1000;
    this.relojMs += deltaMs;

    for (const vecino of this.vecinos) {
      const { container } = vecino;

      if (vecino.enHospital) continue; // "internado": invisible y fuera de la simulación hasta recuperar()

      if (vecino.enfermo) {
        this.actualizarEnfermo(vecino, deltaS);
        continue; // mientras está enfermo no vaga ni bota basura
      }

      if (vecino.esperaMs > 0) {
        vecino.esperaMs -= deltaMs;
        this.reproducirAnim(vecino, vecino.dir, false);
      } else if (vecino.destino) {
        const dist = Phaser.Math.Distance.Between(container.x, container.y, vecino.destino.x, vecino.destino.y);
        if (dist <= LLEGADA_PX) {
          vecino.esperaMs = Phaser.Math.Between(ESPERA_MIN_MS, ESPERA_MAX_MS);
          this.elegirDestino(vecino, true);
          this.reproducirAnim(vecino, vecino.dir, false);
        } else {
          const paso = vecino.velocidad * deltaS;
          const ang = Phaser.Math.Angle.Between(container.x, container.y, vecino.destino.x, vecino.destino.y);
          const dx = Math.cos(ang), dy = Math.sin(ang);
          container.x += dx * paso;
          container.y += dy * paso;
          container.setDepth(container.y);
          // Solo hay arte "de frente" y "de espaldas": si el paso es más vertical que horizontal
          // se usa esa dirección; si no, se vuelve a 'down' volteado en X (mismo truco que usa
          // characterSVG para 'right' = 'left' volteado).
          const dir = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'up' : 'down') : 'down';
          container.scaleX = dx < 0 ? -1 : 1;
          this.reproducirAnim(vecino, dir, true);
        }
      }

      vecino.proximoBotarMs -= deltaMs;
      if (vecino.proximoBotarMs <= 0) {
        vecino.proximoBotarMs = Phaser.Math.Between(BOTAR_MIN_MS, BOTAR_MAX_MS);
        this.onBotarCb?.(container.x, container.y);
      }
    }
  }

  /**
   * Hace que un vecino sano (no ya enfermo ni internado) "se enferme": deja de vagar/botar
   * basura, se le pone el ícono de síntoma (gota de sudor, ver `dibujarIconoEnfermo`) y un tinte
   * pálido, y arranca a caminar en línea recta hacia el hospital, más lento que lo normal.
   * Pensado para no asustar: no hay muerte ni imagen gráfica, solo "se sintió mal y va a que lo
   * atiendan" — ver `internar()`/`recuperar()` para el resto del ciclo.
   * @param {{x:number,y:number}} hospital instancia de Hospital (o cualquier objeto con x/y)
   * @returns {boolean} true si había un vecino sano disponible y se lo enfermó
   */
  enfermar(hospital) {
    if (!hospital) return false;
    const candidatos = this.vecinos.filter((v) => !v.enfermo && !v.enHospital);
    if (candidatos.length === 0) return false;

    const vecino = Phaser.Utils.Array.GetRandom(candidatos);
    vecino.enfermo = true;
    vecino.destino = { x: hospital.x, y: hospital.y };
    vecino.esperaMs = 0;
    vecino.velocidad = VELOCIDAD_ENFERMO;

    const icono = this.scene.add.graphics();
    dibujarIconoEnfermo(icono);
    vecino.container.add(icono);
    vecino.iconoEnfermo = icono;
    vecino.sprite?.setTint(0xbfe6c9);

    return true;
  }

  /** Movimiento de un vecino enfermo: igual que el wander normal pero en línea recta fija hacia
   * `vecino.destino` (la posición del hospital al momento de enfermar), sin espera ni arrastre. */
  actualizarEnfermo(vecino, deltaS) {
    const { container, destino } = vecino;
    const dist = Phaser.Math.Distance.Between(container.x, container.y, destino.x, destino.y);
    if (dist <= LLEGADA_HOSPITAL_PX) {
      this.internar(vecino);
      return;
    }
    const paso = vecino.velocidad * deltaS;
    const ang = Phaser.Math.Angle.Between(container.x, container.y, destino.x, destino.y);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    container.x += dx * paso;
    container.y += dy * paso;
    container.setDepth(container.y);
    const dir = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'up' : 'down') : 'down';
    container.scaleX = dx < 0 ? -1 : 1;
    this.reproducirAnim(vecino, dir, true);
  }

  /** El vecino enfermo llegó al hospital: se oculta (representa que quedó internado/atendido) y
   * se programa su regreso sano al pool tras un descanso al azar (RECUPERACION_MIN/MAX_MS). */
  internar(vecino) {
    vecino.container.setVisible(false);
    vecino.iconoEnfermo?.destroy();
    vecino.iconoEnfermo = null;
    vecino.sprite?.clearTint();
    vecino.enHospital = true;
    const recuperacionMs = Phaser.Math.Between(RECUPERACION_MIN_MS, RECUPERACION_MAX_MS);
    this.scene.time.delayedCall(recuperacionMs, () => this.recuperar(vecino));
  }

  /** El vecino se recuperó: reaparece sano en un punto al azar y retoma el wander normal. */
  recuperar(vecino) {
    if (this.destruido || !this.vecinos.includes(vecino)) return;
    const punto = Phaser.Utils.Array.GetRandom(this.puntos);
    vecino.container.setPosition(punto.x, punto.y);
    vecino.container.setVisible(true);
    vecino.container.setDepth(punto.y);
    vecino.enfermo = false;
    vecino.enHospital = false;
    vecino.velocidad = Phaser.Math.FloatBetween(VELOCIDAD_MIN, VELOCIDAD_MAX);
    vecino.esperaMs = 0;
    this.elegirDestino(vecino);
  }

  /**
   * Llamar periódicamente desde GameScene (alcanza con una vez por segundo, no hace falta cada
   * frame) con el valor actual de `EpidemicMeter.valor` (0..100) y el hospital del nivel. Decide
   * internamente si corresponde enfermar a un vecino:
   *
   *  - Bandas: BANDAS_ENFERMEDAD = [25, 50, 75, 100]. Cada vez que `epidemiaValor` cruza hacia
   *    arriba una banda todavía no usada, es candidato a disparar `enfermar()`.
   *  - Histéresis: una banda ya usada vuelve a quedar disponible solo si el riesgo baja al menos
   *    HISTERESIS_BANDA (10 puntos) por debajo de ella — si no, un valor que oscila justo en el
   *    límite reenfermaría vecinos sin parar.
   *  - Cooldown: aunque se crucen varias bandas de golpe (ej. un brote grande dispara el riesgo
   *    de un salto), como mucho un vecino nuevo enferma cada COOLDOWN_ENFERMEDAD_MS (20s).
   *
   * No hace nada (y no consume la banda) si no hay ningún vecino sano disponible para enfermar.
   * @param {number} epidemiaValor `EpidemicMeter.valor`, 0..100
   * @param {{x:number,y:number}} hospital instancia de Hospital (o cualquier objeto con x/y)
   * @returns {boolean} true si esta llamada disparó `enfermar()`
   */
  consumirRiesgo(epidemiaValor, hospital) {
    if (this.destruido || !hospital) return false;

    // Si el riesgo bajó lo suficiente, libera bandas para que puedan volver a dispararse.
    if (epidemiaValor < this.ultimaBandaUsada - HISTERESIS_BANDA) {
      this.ultimaBandaUsada = BANDAS_ENFERMEDAD.filter((b) => b <= epidemiaValor).pop() ?? 0;
    }

    const bandaCruzada = BANDAS_ENFERMEDAD.find((b) => epidemiaValor >= b && b > this.ultimaBandaUsada);
    if (!bandaCruzada) return false;
    if (this.relojMs - this.ultimoEnfermarMs < COOLDOWN_ENFERMEDAD_MS) return false;

    const ok = this.enfermar(hospital);
    if (ok) {
      this.ultimaBandaUsada = bandaCruzada;
      this.ultimoEnfermarMs = this.relojMs;
    }
    return ok;
  }

  /** Destruye todos los Container y detiene el manager, para llamar desde el shutdown de la escena. */
  destroy() {
    this.destruido = true;
    for (const vecino of this.vecinos) {
      vecino.container.destroy();
    }
    this.vecinos = [];
    this.onBotarCb = null;
  }
}
