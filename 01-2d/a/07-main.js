class Tema07Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Tema07Scene' });
  }

  preload() {
    this.load.image('imagen_terreno', './spritesheet-tiles-default.png');
    this.load.tilemapTiledJSON('mi_mapa', './a.json');
    this.load.spritesheet('player', './image.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create() {
    const mapa = this.make.tilemap({ key: 'mi_mapa' });
    const tileset = mapa.addTilesetImage('background', 'imagen_terreno', 64, 64, 0, 1);
    const capa = mapa.createLayer(mapa.layers[0].name, tileset, 0, 0);

    capa.setCollisionByExclusion([-1, 1]);

    this.physics.world.setBounds(0, 0, mapa.widthInPixels, mapa.heightInPixels);
    this.player = this.physics.add.sprite(200, 100, 'player', 0);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(32, 44);
    this.player.body.setOffset(8, 4);

    this.physics.add.collider(this.player, capa);

    this.cameras.main.setBounds(0, 0, mapa.widthInPixels, mapa.heightInPixels);
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBackgroundColor('#87ceeb');

    this.cursors = this.input.keyboard.createCursorKeys();

    this.add.text(16, 16, 'Tema 07: colision + salto + camara', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0);
  }

  update() {
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-200);
      this.player.flipX = true;
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(200);
      this.player.flipX = false;
    } else {
      this.player.setVelocityX(0);
    }

    if (this.cursors.up.isDown && this.player.body.onFloor()) {
      this.player.setVelocityY(-450);
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
      gravity: { y: 800 },
      debug: true,
    },
  },
  scene: [Tema07Scene],
};

new Phaser.Game(config);