class Tema05Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Tema05Scene' });
  }

  preload() {
    this.load.spritesheet('player', './image.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#3a2b48');

    this.physics.world.setBounds(0, 0, 800, 600);
    this.player = this.physics.add.sprite(400, 300, 'player');
    this.player.body.setCollideWorldBounds(true);

    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: 'idle',
      frames: [{ key: 'player', frame: 0 }],
      frameRate: 10,
      repeat: -1,
    });

    this.player.play('idle');
    this.cursors = this.input.keyboard.createCursorKeys();

    this.add.text(20, 20, 'Tema 05: animaciones + input', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
    });
  }

  update() {
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-200);
      this.player.flipX = true;
      this.player.play('walk', true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(200);
      this.player.flipX = false;
      this.player.play('walk', true);
    } else {
      this.player.setVelocityX(0);
      this.player.play('idle', true);
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
  scene: [Tema05Scene],
};

new Phaser.Game(config);