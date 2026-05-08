class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    // Agregamos ./ para asegurar que StackBlitz encuentre los archivos en la raíz
    this.load.image('imagen_terreno', './spritesheet-tiles-default.png');
    this.load.tilemapTiledJSON('mi_mapa', './a.json');
    this.load.spritesheet('player', './image.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create() {
    const mapa = this.make.tilemap({ key: 'mi_mapa' });

    // 1. Vinculamos el tileset.
    // 'background' es el nombre que está DENTRO de tu archivo JSON.
    // Usamos 64, 64, 0, 1 porque esa es la matemática exacta de Kenney.
    const tileset = mapa.addTilesetImage(
      'background',
      'imagen_terreno',
      64,
      64,
      0,
      1
    );

    // 2. Detector dinámico de capas
    const nombreCapa = mapa.layers[0].name;
    const capaSuelo = mapa.createLayer(nombreCapa, tileset, 0, 0);

    if (capaSuelo) {
      // Excluir el tile 1 (tile 0 local) para que sea decorativo y no bloquee al jugador.
      capaSuelo.setCollisionByExclusion([-1, 1]);
      console.log('¡Capa cargada: ' + nombreCapa + '!');
      this.collectibleTileIndex = 1;
      this.startTileX = Math.floor(200 / mapa.tileWidth);
      this.startTileY = Math.floor(100 / mapa.tileHeight);
      this.placeRandomTilesAboveBlocks(capaSuelo, mapa, 2);
      this.capaSuelo = capaSuelo;
      this.mapa = mapa;
    }

    // Ajustar los límites del mundo físico al tamaño del mapa
    this.physics.world.setBounds(0, 0, mapa.widthInPixels, mapa.heightInPixels);

    // 3. Personaje
    this.player = this.physics.add.sprite(200, 100, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.1);
    this.player.body.setSize(32, 44);
    this.player.body.setOffset(8, 4);

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
    });

    this.player.play('idle');

    // 4. Cámara y Fondo
    this.cameras.main.setBounds(0, 0, mapa.widthInPixels, mapa.heightInPixels);
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBackgroundColor('#87CEEB');

    // 5. Física
    this.physics.add.collider(this.player, capaSuelo);

    // Guardamos el input de teclado para update()
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  update() {
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-200);
      this.player.anims.play('walk', true);
      this.player.flipX = true;
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(200);
      this.player.anims.play('walk', true);
      this.player.flipX = false;
    } else {
      this.player.setVelocityX(0);
      this.player.anims.play('idle', true);
    }

    if (this.cursors.up.isDown && this.player.body.onFloor()) {
      this.player.setVelocityY(-450);
    }

    this.checkCollectibleOverlap(this.capaSuelo, this.mapa);
  }

  placeRandomTilesAboveBlocks(layer, map, count = 1, exclude = []) {
    const candidates = [];

    for (let x = 0; x < map.width; x++) {
      for (let y = 0; y < map.height - 1; y++) {
        const tileAbove = layer.getTileAt(x, y);
        const tileBelow = layer.getTileAt(x, y + 1);
        const excluded = exclude.some(pos => pos.x === x && pos.y === y);

        if (
          !tileAbove &&
          tileBelow &&
          tileBelow.index !== -1 &&
          tileBelow.index !== this.collectibleTileIndex &&
          !(x === this.startTileX && y === this.startTileY - 1) &&
          !excluded
        ) {
          candidates.push({ x, y });
        }
      }
    }

    Phaser.Utils.Array.Shuffle(candidates);
    const selection = candidates.slice(0, count);
    selection.forEach(({ x, y }) => {
      layer.putTileAt(this.collectibleTileIndex, x, y);
    });
  }

  checkCollectibleOverlap(layer, map) {
    if (!layer) {
      return;
    }

    const bounds = this.player.getBounds();
    const x1 = map.worldToTileX(bounds.left);
    const y1 = map.worldToTileY(bounds.top);
    const x2 = map.worldToTileX(bounds.right);
    const y2 = map.worldToTileY(bounds.bottom);

    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        const tile = layer.getTileAt(x, y);

        if (tile && tile.index === this.collectibleTileIndex) {
          layer.removeTileAt(x, y);
          this.placeRandomTilesAboveBlocks(layer, map, 1, [{ x, y }]);
          return;
        }
      }
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
    arcade: { gravity: { y: 800 }, debug: true },
  },
  scene: [MainScene],
};

new Phaser.Game(config);
