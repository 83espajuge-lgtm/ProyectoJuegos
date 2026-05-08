class Tema03Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Tema03Scene' });
  }

  preload() {
    this.load.spritesheet('player', './image.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#16324f');

    this.add
      .text(20, 20, 'Tema 03: escena + render de sprite', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setDepth(1);

    this.add.sprite(400, 320, 'player', 0).setScale(2);
    console.log('[Tema 03] Sprite renderizado en el centro');
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: [Tema03Scene],
};

new Phaser.Game(config);