class Tema02Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Tema02Scene' });
    this.frameCount = 0;
  }

  preload() {
    console.log('[Tema 02] preload(): cargar recursos');
    this.load.image('imagen_terreno', './spritesheet-tiles-default.png');
  }

  create() {
    console.log('[Tema 02] create(): crear objetos iniciales');
    this.cameras.main.setBackgroundColor('#1f2a44');

    this.add
      .text(20, 20, 'Tema 02: ciclo preload/create/update', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setDepth(1);
  }

  update() {
    this.frameCount += 1;

    // Evita saturar la consola: muestra un log cada 120 frames aprox.
    if (this.frameCount % 120 === 0) {
      console.log(`[Tema 02] update(): frame ${this.frameCount}`);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: [Tema02Scene],
};

new Phaser.Game(config);