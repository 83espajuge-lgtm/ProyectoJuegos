class Tema06Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Tema06Scene' });
  }

  preload() {
    this.load.image('imagen_terreno', './spritesheet-tiles-default.png');
    this.load.tilemapTiledJSON('mi_mapa', './a.json');
  }

  create() {
    const mapa = this.make.tilemap({ key: 'mi_mapa' });

    const tileset = mapa.addTilesetImage('background', 'imagen_terreno', 64, 64, 0, 1);
    const nombreCapa = mapa.layers[0].name;
    const capa = mapa.createLayer(nombreCapa, tileset, 0, 0);

    this.add.text(20, 20, 'Tema 06: tilemap + tileset + capa', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 6, y: 4 },
    });

    if (capa) {
      console.log('[Tema 06] Capa cargada:', nombreCapa);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: [Tema06Scene],
};

new Phaser.Game(config);