import Phaser from 'phaser';

const SPEED = 170;
const STEP_MS = 280; // intervalo entre sonidos de paso
/** Sprint: multiplicador de velocidad, tiempo hasta agotar la energía y tiempo de recarga. */
const SPRINT_FACTOR = 1.6;
const SPRINT_DRAIN_MS = 3000;
const SPRINT_RECARGA_MS = 4000;
/** Tras agotarse, el sprint no vuelve hasta recuperar esta fracción de energía. */
const SPRINT_REANUDAR = 0.3;

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player', 'down_0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    // Caja de colisión en los pies para que el personaje pueda pasar "por delante" de objetos.
    this.body.setSize(24, 16).setOffset(20, 42);
    this.setDepth(this.y);
    this.dir = 'down';
    this.ultimoPaso = 0;
    this.play('idle_down');

    // Sprint: botón CORRER (táctil) o Shift (escritorio). `energia` 0..1 la lee el HUD táctil.
    this.sprint = false;
    this.energia = 1;
    this.agotado = false;

    // Multiplicador de velocidad al subirse a la camioneta (ver Vehiculo.subir/bajar).
    this.vehiculoFactor = 1;

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys('W,A,S,D');
    this.shift = scene.input.keyboard.addKey('SHIFT');
  }

  /** Activa/desactiva la petición de sprint (se mantiene mientras el botón esté presionado). */
  setSprint(on) { this.sprint = !!on; }

  /** Multiplicador de velocidad mientras está montado en la camioneta (1 = a pie). */
  setVehiculoFactor(f) { this.vehiculoFactor = f; }

  /** ¿Está corriendo ahora mismo (hay petición y queda energía)? */
  get corriendo() { return this._corriendo; }

  /** @param {{x:number,y:number}} [stick] vector -1..1 del joystick táctil */
  move(stick) {
    // Bloqueado por GameScene mientras dura la limpieza de un criadero.
    if (this.bloqueado) { this.setVelocity(0); return; }
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    if (stick && (stick.x || stick.y)) { vx = stick.x; vy = stick.y; }

    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 1) v.normalize();
    const moviendo = v.length() > 0.05;

    // Energía de sprint: se agota en 3 s corriendo y se recarga en 4 s.
    const dt = this.scene.game.loop.delta;
    const quiereSprint = this.sprint || this.shift.isDown;
    if (this.agotado && this.energia >= SPRINT_REANUDAR) this.agotado = false;
    this._corriendo = quiereSprint && moviendo && !this.agotado && this.energia > 0;
    if (this._corriendo) {
      this.energia = Math.max(0, this.energia - dt / SPRINT_DRAIN_MS);
      if (this.energia <= 0) this.agotado = true;
    } else {
      this.energia = Math.min(1, this.energia + dt / SPRINT_RECARGA_MS);
    }
    const speed = SPEED * (this._corriendo ? SPRINT_FACTOR : 1) * this.vehiculoFactor;
    this.setVelocity(v.x * speed, v.y * speed);

    if (moviendo) {
      // En diagonal prioriza la dirección horizontal para la animación.
      if (Math.abs(v.x) >= Math.abs(v.y)) this.dir = v.x < 0 ? 'left' : 'right';
      else this.dir = v.y < 0 ? 'up' : 'down';
      this.play(`walk_${this.dir}`, true);
      const ahora = this.scene.time.now;
      if (ahora - this.ultimoPaso >= (this._corriendo ? STEP_MS / SPRINT_FACTOR : STEP_MS)) {
        this.ultimoPaso = ahora;
        this.scene.events.emit('sfx', 'step');
      }
    } else {
      this.play(`idle_${this.dir}`, true);
    }
    this.setDepth(this.y);
  }
}
