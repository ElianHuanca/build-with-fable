import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { Criadero } from '../objects/Criadero.js';
import { Joystick } from '../systems/Joystick.js';
import { InteractionPrompt } from '../systems/InteractionPrompt.js';
import { buildLevel, zoneAt } from '../systems/LevelLoader.js';
import { PALETTE } from '../data/palette.js';
import { FACTS, PUNTOS_POR_CRIADERO } from '../data/facts.js';

/**
 * Fase 3: el barrio Equipetrol con 5 criaderos detectables y eliminables.
 * El nivel viene de src/levels/equipetrol.json (generado por tools/gen-level.mjs).
 */
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const data = this.cache.json.get('level_equipetrol');
    const level = buildLevel(this, data);
    this.zones = level.zones;

    this.physics.world.setBounds(0, 0, level.widthPx, level.heightPx);
    this.player = new Player(this, level.spawn.x, level.spawn.y);
    this.physics.add.collider(this.player, level.solids);

    this.cameras.main.setBounds(0, 0, level.widthPx, level.heightPx).startFollow(this.player, true, 0.12, 0.12);

    this.joystick = new Joystick(this);

    // Criaderos
    this.criaderos = (data.criaderos || []).map((c) => new Criadero(this, c.x, c.y, c.type));
    this.activo = null;      // criadero detectado actualmente
    this.limpiando = false;  // hay una limpieza en curso
    this.puntos = 0;
    this.limpios = 0;

    this.prompt = new InteractionPrompt(this);
    this.prompt.onPress(() => this.intentarLimpiar());
    this.keyE = this.input.keyboard.addKey('E');

    // --- UI provisional (la HUD completa es de la fase 5) ---
    const font = { fontFamily: 'Arial, sans-serif', color: PALETTE.blanco, backgroundColor: 'rgba(44,62,80,0.8)' };
    this.add.text(12, 12, 'Fase 3 · Encuentra los 5 criaderos y presiona E', { ...font, fontSize: 16, padding: { x: 10, y: 6 } })
      .setScrollFactor(0).setDepth(10000);

    // Contador (arriba a la derecha) y nombre de la zona actual debajo.
    this.scoreText = this.add.text(this.scale.width - 12, 12, '', { ...font, fontSize: 13, padding: { x: 8, y: 4 } })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(10000);
    this.zoneText = this.add.text(this.scale.width - 12, 40, '', { ...font, fontSize: 13, padding: { x: 8, y: 4 } })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(10000).setVisible(false);
    this.currentZone = null;
    this.actualizarContador();

    // Dato educativo (abajo al centro, 4 s). El popup completo es de la fase 5.
    this.factText = this.add.text(this.scale.width / 2, this.scale.height - 16, '', {
      ...font, fontSize: 14, padding: { x: 12, y: 8 }, align: 'center', wordWrap: { width: this.scale.width - 80 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(10000).setVisible(false);
    this.factTimer = null;
  }

  update() {
    this.player.move(this.joystick.update());

    const zone = zoneAt(this.zones, this.player.x, this.player.y);
    if (zone !== this.currentZone) {
      this.currentZone = zone;
      this.zoneText.setText(zone ? zone.name : '').setVisible(!!zone);
    }

    this.actualizarDeteccion();

    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.intentarLimpiar();
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
      this.prompt.show();
      this.prompt.showLabelAt(nearest.x, nearest.y - 40);
    } else {
      this.prompt.hide();
      this.prompt.hideLabel();
    }
  }

  async intentarLimpiar() {
    const c = this.activo;
    if (!c || this.limpiando || c.state === 'limpiando' || c.state === 'limpio') return;
    this.limpiando = true;

    // Bloquear al jugador durante la animación.
    this.player.bloqueado = true;
    this.player.setVelocity(0);
    this.player.play(`idle_${this.player.dir}`, true);
    this.prompt.setBusy(true);
    this.prompt.hideLabel();

    try {
      await c.clean();
    } finally {
      this.puntos += PUNTOS_POR_CRIADERO;
      this.limpios = this.criaderos.filter((k) => k.state === 'limpio').length;
      this.actualizarContador();
      this.textoFlotante(c.x, c.y - 24, `+${PUNTOS_POR_CRIADERO}`);
      this.mostrarDato(c.type);

      this.player.bloqueado = false;
      this.prompt.setBusy(false);
      this.prompt.hide();
      this.activo = null;
      this.limpiando = false;

      if (this.limpios >= this.criaderos.length) this.barrioProtegido();
    }
  }

  actualizarContador() {
    this.scoreText.setText(`Criaderos: ${this.limpios}/${this.criaderos.length} · Puntos: ${this.puntos}`);
  }

  /** Texto amarillo que sube 40 px y se desvanece en 900 ms. */
  textoFlotante(x, y, msg) {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'Arial, sans-serif', fontSize: 24, fontStyle: 'bold', color: PALETTE.amarillo,
      stroke: PALETTE.marino, strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200000);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  /** Muestra el dato educativo abajo al centro durante 4 s. */
  mostrarDato(type) {
    const fact = FACTS[type];
    if (!fact) return;
    console.log(`[Dengue] ${fact.nombre}: ${fact.dato} (${fact.fuente})`);
    this.factText.setText(`${fact.nombre}: ${fact.dato}`).setVisible(true);
    if (this.factTimer) this.factTimer.remove(false);
    this.factTimer = this.time.delayedCall(4000, () => this.factText.setVisible(false));
  }

  /** Mensaje provisional de fin de nivel (la pantalla completa es de la fase 5). */
  barrioProtegido() {
    const t = this.add.text(this.scale.width / 2, this.scale.height / 2, '¡Barrio protegido!', {
      fontFamily: 'Arial, sans-serif', fontSize: 56, fontStyle: 'bold', color: PALETTE.amarillo,
      stroke: PALETTE.marino, strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200000).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });
  }
}
