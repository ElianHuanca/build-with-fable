import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';
import { saveSystem } from './SaveSystem.js';

// Costo de contratar UN brigadista (v4 §4.3): gasto puntual de una sola jornada, no una mejora
// permanente (por eso usa `saveSystem.gastar`, no `comprarMejora`). Se eligió bastante más barato
// que la mejora más barata de la tienda (mochila, 150 Bs, ver SaveSystem.MEJORAS): contratar ayuda
// para UN brote no debería competir con ahorrar para una mejora permanente, pero tampoco ser gratis
// — el jugador sigue teniendo que decidir si vale la pena gastarlo.
const COSTO_CONTRATACION = 70;

// Velocidad a pie del brigadista, notablemente más lenta que el jugador (SPEED=170 en Player.js):
// el mensaje pedagógico es "ayuda extra con recursos limitados", no "un segundo jugador gratis".
const VELOCIDAD_BRIGADISTA = 45;
// Distancia a la que se considera "llegó" a destino (mismo criterio que Vecinos.LLEGADA_PX/HOSPITAL_PX).
const LLEGADA_PX = 6;
// Variantes de sprite de vecino reutilizables como brigadista (mismas texturas que Vecinos.js,
// tools/gen-assets.mjs → vecinoSVG); se tiñen de azul SEDES para distinguirlos de los vecinos comunes.
const VARIANTES_SPRITE = 9;
const TINTE_BRIGADISTA = hex(PALETTE.azulGorra);

/** Dibuja una pequeña insignia (chaleco/cruz SEDES) sobre la cabeza del brigadista, mismo estilo
 * flat/chibi y misma técnica que `dibujarIconoEnfermo` en Vecinos.js: un Graphics chico agregado
 * al Container, sin asset nuevo. Sirve para diferenciarlo a simple vista de un vecino común. */
function dibujarInsigniaBrigadista(g) {
  const cx = 0, cy = -20;
  g.fillStyle(hex(PALETTE.amarillo), 1);
  g.fillCircle(cx, cy, 5.5);
  g.lineStyle(1, hex(PALETTE.linea), 1);
  g.strokeCircle(cx, cy, 5.5);
  g.fillStyle(hex(PALETTE.linea), 1);
  g.fillRect(cx - 2.5, cy - 0.75, 5, 1.5);
  g.fillRect(cx - 0.75, cy - 2.5, 1.5, 5);
}

/**
 * Cuadrilla — brigadistas de SEDES que el jugador puede contratar con Bs cuando ya no puede cubrir
 * todos los brotes activos a tiempo (plan v4 §4.3, "qué pasa cuando el jugador ya no puede").
 * Manager plano (no Scene, no GameObject), mismo patrón que `Vecinos`/`OutbreakManager`.
 *
 * Un brigadista contratado camina en línea recta desde `origen` (normalmente la Estación SEDES)
 * hasta el brote asignado, lo fumiga con `Brote.fumigar({ rapido: false })` (la misma duración que
 * el jugador a pie: la ayuda es real pero no mágica ni más rápida que el jugador) y vuelve a
 * `origen`, donde desaparece. No crea ni destruye entradas en `OutbreakManager.activos` — eso ya lo
 * maneja `Brote` internamente al fumigarse.
 *
 * Mensaje pedagógico (importante, ver contexto del plan): esto NO es "las autoridades no sirven",
 * es "los recursos son limitados para todos, incluido SEDES" — por eso cuesta Bs, tarda en llegar
 * caminando, y fumiga a la misma velocidad que el jugador a pie, nunca más rápido.
 *
 * API pública:
 *   new Cuadrilla(scene, { origen: {x,y} })
 *   .costoContratacion()      → Bs que cuesta contratar UN brigadista
 *   .puedeContratar()         → boolean, ¿el saldo alcanza?
 *   .contratar(broteObjetivo) → intenta pagar y, si alcanza, despacha un brigadista a `broteObjetivo`
 *   .update(deltaMs)          — llamar cada frame desde GameScene.update()
 *   .destroy()                — llamar desde el shutdown de la escena
 *
 * Eventos (Phaser.Events.EventEmitter):
 *   'llegó' (brigadista, brote)   — el brigadista llegó al brote y va a empezar a fumigar
 *   'terminó' (brigadista, brote) — terminó de fumigar (o el brote ya no estaba disponible) y vuelve a origen
 *
 * Condición de disparo sugerida para GameScene (NO implementada acá, es decisión de GameScene):
 * ofrecer la contratación cuando el jugador está objetivamente desbordado, por ejemplo:
 *   - `outbreakManager.activos.length >= 2` (o === MAX_ACTIVOS) Y
 *   - queda poco tiempo de jornada (p. ej. menos de 60s) O el jugador está lejos de TODOS los
 *     brotes activos a la vez (ninguno dentro de, digamos, 250px) Y
 *   - `cuadrilla.puedeContratar()` es true.
 * Mostrar la oferta una vez por "racha" de desborde (con su propio cooldown, igual que
 * `Vecinos.consumirRiesgo`) para no interrumpir todo el tiempo con el mismo aviso.
 */
export class Cuadrilla extends Phaser.Events.EventEmitter {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ origen: {x:number,y:number} }} opts origen: punto donde aparecen y a donde vuelven
   *   los brigadistas (normalmente la Estación SEDES del nivel).
   */
  constructor(scene, { origen } = {}) {
    super();
    this.scene = scene;
    this.origen = origen || { x: 0, y: 0 };
    this.brigadistas = [];
    this.destruido = false;

    scene.events.once('shutdown', () => this.destroy());
  }

  /** Bs que cuesta contratar UN brigadista (gasto puntual, no permanente). */
  costoContratacion() {
    return COSTO_CONTRATACION;
  }

  /** ¿El saldo actual alcanza para contratar un brigadista? */
  puedeContratar() {
    return saveSystem.saldoBs() >= this.costoContratacion();
  }

  /**
   * Intenta contratar un brigadista para que vaya a fumigar `broteObjetivo`. Descuenta
   * `costoContratacion()` Bs vía `saveSystem.gastar` (nada se descuenta si no alcanza).
   * @param {import('../objects/Brote.js').Brote} broteObjetivo
   * @returns {{ok:boolean, saldo:number}} mismo shape que `SaveSystem.gastar`
   */
  contratar(broteObjetivo) {
    const resultado = saveSystem.gastar(this.costoContratacion());
    if (!resultado.ok) return resultado;
    if (!broteObjetivo || this.destruido) return resultado; // pago hecho igual; caso borde defensivo
    this.despachar(broteObjetivo);
    return resultado;
  }

  /** Crea el Container visual del brigadista y lo suma a la lista de despachados. */
  despachar(brote) {
    const variante = Phaser.Math.Between(1, VARIANTES_SPRITE);
    const animado = this.scene.textures.exists(`vecino_${variante}_down_0`);

    let sprite = null;
    let visual;
    if (animado) {
      sprite = this.scene.add.sprite(0, 0, `vecino_${variante}_down_0`);
      sprite.play(`vecino_${variante}_idle_down`);
      sprite.setTint(TINTE_BRIGADISTA);
      visual = sprite;
    } else {
      const g = this.scene.add.graphics();
      g.fillStyle(TINTE_BRIGADISTA, 1).fillRoundedRect(-5, -4, 10, 14, 3);
      g.fillStyle(hex(PALETTE.piel), 1).fillEllipse(0, -8, 8, 9);
      visual = g;
    }

    const insignia = this.scene.add.graphics();
    dibujarInsigniaBrigadista(insignia);

    const container = this.scene.add.container(this.origen.x, this.origen.y, [visual, insignia]);
    container.setDepth(this.origen.y);

    const brigadista = {
      container,
      sprite,
      dir: 'down',
      brote,
      fase: 'yendo', // 'yendo' → 'fumigando' → 'volviendo'
      fumigarIniciado: false,
      abortado: false,
    };

    // Si el brote desaparece (destruido por la escena, p. ej. shutdown) mientras el brigadista
    // va en camino o está fumigando, aborta con calma en vez de romper: vuelve a origen igual.
    brote.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (brigadista.fase !== 'volviendo') brigadista.abortado = true;
    });

    this.brigadistas.push(brigadista);
    return brigadista;
  }

  /** Mueve un brigadista en línea recta hacia `destino`; devuelve true si ya llegó. */
  moverHacia(brigadista, destino, deltaS) {
    const { container } = brigadista;
    const dist = Phaser.Math.Distance.Between(container.x, container.y, destino.x, destino.y);
    if (dist <= LLEGADA_PX) return true;
    const paso = VELOCIDAD_BRIGADISTA * deltaS;
    const ang = Phaser.Math.Angle.Between(container.x, container.y, destino.x, destino.y);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    container.x += dx * paso;
    container.y += dy * paso;
    container.setDepth(container.y);
    container.scaleX = dx < 0 ? -1 : 1;
    const dir = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'up' : 'down') : 'down';
    if (brigadista.sprite && brigadista.dir !== dir) brigadista.dir = dir;
    if (brigadista.sprite) brigadista.sprite.play(`vecino_${this.varianteDe(brigadista)}_walk_${dir}`, true);
    return false;
  }

  /** Extrae el número de variante del nombre de textura actual del sprite (para elegir la anim). */
  varianteDe(brigadista) {
    const key = brigadista.sprite?.texture?.key || '';
    const m = /^vecino_(\d+)_/.exec(key);
    return m ? m[1] : 1;
  }

  /**
   * Llamar cada frame desde GameScene.update().
   * @param {number} deltaMs
   */
  update(deltaMs) {
    if (this.destruido || this.brigadistas.length === 0) return;
    const deltaS = deltaMs / 1000;
    const terminados = [];

    for (const b of this.brigadistas) {
      if (b.fase === 'yendo') {
        const broteValido = b.brote && b.brote.scene && b.brote.state !== 'fumigado';
        if (b.abortado || !broteValido) {
          b.fase = 'volviendo';
          continue;
        }
        const llego = this.moverHacia(b, { x: b.brote.x, y: b.brote.y }, deltaS);
        if (llego) {
          b.fase = 'fumigando';
          b.sprite?.play(`vecino_${this.varianteDe(b)}_idle_${b.dir}`, true);
          this.emit('llegó', b, b.brote);
          if (!b.fumigarIniciado) {
            b.fumigarIniciado = true;
            b.brote.fumigar({ rapido: false })
              .catch(() => false)
              .then(() => {
                this.emit('terminó', b, b.brote);
                b.fase = 'volviendo';
              });
          }
        }
      } else if (b.fase === 'fumigando') {
        // Espera a que resuelva la promesa de fumigar() (ver arriba); no se mueve.
      } else if (b.fase === 'volviendo') {
        const llego = this.moverHacia(b, this.origen, deltaS);
        if (llego) terminados.push(b);
      }
    }

    if (terminados.length > 0) {
      this.brigadistas = this.brigadistas.filter((b) => !terminados.includes(b));
      for (const b of terminados) b.container.destroy();
    }
  }

  /** Destruye todos los brigadistas en curso y detiene el manager (shutdown de la escena). */
  destroy() {
    this.destruido = true;
    for (const b of this.brigadistas) b.container.destroy();
    this.brigadistas = [];
    this.removeAllListeners();
  }
}
