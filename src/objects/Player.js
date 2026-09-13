import Phaser from 'phaser';

const SPEED = 170;

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
    this.play('idle_down');

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys('W,A,S,D');
  }

  /** @param {{x:number,y:number}} [stick] vector -1..1 del joystick táctil */
  move(stick) {
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    if (stick && (stick.x || stick.y)) { vx = stick.x; vy = stick.y; }

    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 1) v.normalize();
    this.setVelocity(v.x * SPEED, v.y * SPEED);

    if (v.length() > 0.05) {
      // En diagonal prioriza la dirección horizontal para la animación.
      if (Math.abs(v.x) >= Math.abs(v.y)) this.dir = v.x < 0 ? 'left' : 'right';
      else this.dir = v.y < 0 ? 'up' : 'down';
      this.play(`walk_${this.dir}`, true);
    } else {
      this.play(`idle_${this.dir}`, true);
    }
    this.setDepth(this.y);
  }
}
