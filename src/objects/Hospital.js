import Phaser from 'phaser';
import { PALETTE, hex } from '../data/palette.js';

const W = 128, H = 128;

/** Tamaño de cada icono de cama en la barra de capacidad (dibujado, sin asset nuevo). */
const CAMA_W = 14, CAMA_H = 9, CAMA_GAP = 3;

/**
 * Hospital: edificio fijo en el mapa (plan v4 §6), consecuencia visible del riesgo de epidemia.
 * Mismo patrón que `Estacion.js` (textura o fallback dibujado con Graphics, sin cuerpo físico de
 * colisión). A diferencia de la estación SEDES (naranja/teja, cartel "SEDES"), este edificio usa
 * blanco + techo celeste y una cruz de salud, para distinguirse a simple vista. Se ubica lejos de
 * la estación (ver `GameScene.elegirPosicionHospital`) — no tiene sentido que ambas cosas estén
 * pegadas, un hospital es otra institución.
 *
 * Mapea el valor de `EpidemicMeter` (0..100) a una ocupación de camas (0..`capacidad`), mostrada
 * como una fila de iconos de cama (llenas en rojo, vacías en gris) + texto "N/6". No simula
 * pacientes ni traslados individuales (eso es una feature aparte, más grande). Cuando llega a la
 * capacidad emite `'saturado'` (una vez, no en cada frame) y `'desaturado'` al bajar de nuevo, para
 * que `GameScene` reaccione (aviso, impacto en la reputación del barrio, etc.) sin que Hospital
 * necesite saber nada de esos sistemas.
 */
export class Hospital extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, Hospital.textureFor(scene));
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // cuerpo estático: no bloquea al jugador (sin collider)
    this.body.setSize(W * 0.7, H * 0.35).setOffset(W * 0.15, H * 0.55);
    this.setDepth(y + H / 2);

    this.capacidad = 6;
    this.ocupacion = 0;

    this.texto = scene.add.text(x, y - H / 2 - 20, '0/6', {
      fontFamily: 'Arial, sans-serif', fontSize: 13, fontStyle: 'bold', color: PALETTE.blanco,
      stroke: PALETTE.linea, strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(this.depth + 1);

    // Barra de camas: se redibuja solo cuando cambia la ocupación (ver actualizar()).
    this.barraCamas = scene.add.graphics().setDepth(this.depth + 1);
    this.dibujarCamas();

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.texto?.destroy();
      this.barraCamas?.destroy();
    });
  }

  /** Fila de `capacidad` iconos de cama centrada sobre el edificio; llenas = ocupadas. */
  dibujarCamas() {
    const g = this.barraCamas.clear();
    const total = this.capacidad;
    const anchoFila = total * CAMA_W + (total - 1) * CAMA_GAP;
    const x0 = this.x - anchoFila / 2;
    const y0 = this.y - H / 2 - 12;
    for (let i = 0; i < total; i++) {
      const cx = x0 + i * (CAMA_W + CAMA_GAP);
      const ocupada = i < this.ocupacion;
      g.fillStyle(ocupada ? 0xe0453f : hex(PALETTE.grisClaro), 1)
        .fillRoundedRect(cx, y0, CAMA_W, CAMA_H, 2);
      g.lineStyle(1.2, hex(PALETTE.linea), 1).strokeRoundedRect(cx, y0, CAMA_W, CAMA_H, 2);
      // "Almohada": un cuadradito más claro en el extremo izquierdo de la cama.
      g.fillStyle(ocupada ? 0xffffff : hex(PALETTE.blanco), ocupada ? 0.55 : 0.4)
        .fillRect(cx + 1.5, y0 + 1.5, CAMA_W * 0.28, CAMA_H - 3);
    }
  }

  /** Devuelve la clave de textura del edificio, creando un fallback (una sola vez) si no existe. */
  static textureFor(scene) {
    const key = 'hospital';
    if (scene.textures.exists(key)) return key;
    const fb = 'fb_hospital';
    if (!scene.textures.exists(fb)) {
      const rt = scene.add.renderTexture(0, 0, W, H).setVisible(false);
      const g = scene.add.graphics();
      g.fillStyle(hex(PALETTE.blanco), 1).fillRect(6, 30, W - 12, H - 36);
      g.lineStyle(3, hex(PALETTE.linea), 1).strokeRect(6, 30, W - 12, H - 36);
      g.fillStyle(hex(PALETTE.celeste), 1).fillTriangle(0, 30, W, 30, W / 2, 4);
      g.lineStyle(3, hex(PALETTE.linea), 1).strokeTriangle(0, 30, W, 30, W / 2, 4);
      g.fillStyle(hex(PALETTE.grisClaro), 1).fillRect(W / 2 - 28, H - 42, 56, 42);
      g.lineStyle(2, hex(PALETTE.linea), 1).strokeRect(W / 2 - 28, H - 42, 56, 42);
      // Cruz de salud roja, bien visible.
      g.fillStyle(0xe0453f, 1);
      g.fillRect(W / 2 - 6, 44, 12, 32);
      g.fillRect(W / 2 - 20, 56, 40, 12);
      g.lineStyle(2, hex(PALETTE.linea), 1);
      g.strokeRect(W / 2 - 6, 44, 12, 32);
      g.strokeRect(W / 2 - 20, 56, 40, 12);
      rt.draw(g).saveTexture(fb);
      g.destroy(); rt.destroy();
    }
    return fb;
  }

  /**
   * Mapea el valor del medidor de epidemia (0..100) a una ocupación aproximada de camas
   * (sin simulación de pacientes aparte, ver plan v4 §6). Actualiza el texto, la barra de camas
   * y el tinte; emite `'saturado'`/`'desaturado'` solo al cruzar el límite (no en cada frame).
   */
  actualizar(epidemiaValor) {
    const nueva = Math.round((this.capacidad * Phaser.Math.Clamp(epidemiaValor, 0, 100)) / 100);
    if (nueva === this.ocupacion) return;
    const saturadoAntes = this.estaSaturado();
    this.ocupacion = nueva;
    this.texto?.setText(`${this.ocupacion}/${this.capacidad}`);
    this.dibujarCamas();
    const saturadoAhora = this.estaSaturado();
    this.setTint(saturadoAhora ? 0xffb3ab : 0xffffff);
    if (saturadoAhora && !saturadoAntes) this.emit('saturado', this);
    else if (!saturadoAhora && saturadoAntes) this.emit('desaturado', this);
  }

  /** ¿El hospital llegó a su capacidad de camas? */
  estaSaturado() {
    return this.ocupacion >= this.capacidad;
  }

  /** ¿El jugador está a `radio` px del centro del hospital? */
  cerca(player, radio = 90) {
    return !!player && Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y) <= radio;
  }
}
