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
 * API pública:
 *   new Vecinos(scene, { puntos, bounds, cantidad, onBotar })
 *   .update(deltaMs)  — llamar cada frame desde GameScene.update()
 *   .destroy()        — llamar desde el shutdown de la escena
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

    for (const vecino of this.vecinos) {
      const { container } = vecino;

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
