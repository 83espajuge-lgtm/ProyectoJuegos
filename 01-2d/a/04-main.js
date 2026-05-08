class Tema04Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Tema04Scene' });
  }

  preload() {
    this.load.spritesheet('player', './image.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#1c3b2f');

    this.physics.world.setBounds(0, 0, 800, 600);

    this.player = this.physics.add.sprite(400, 300, 'player', 0);
    this.player.body.setCollideWorldBounds(true);

    this.cursors = this.input.keyboard.createCursorKeys();

    this.add.text(20, 20, 'Tema 04: fisica arcade + movimiento X', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
    });
  }

  update() {
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-200);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(200);
    } else {
      this.player.setVelocityX(0);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: true,
    },
  },
  scene: [Tema04Scene],
};

new Phaser.Game(config);