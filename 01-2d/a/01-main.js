class Tema01Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Tema01Scene' });
  }

  preload() {
    console.log('[Tema 01] preload() inicio');

    this.load.on('filecomplete', (key, type) => {
      console.log(`[Tema 01] Archivo cargado -> key: ${key}, tipo: ${type}`);
    });

    this.load.on('complete', () => {
      console.log('[Tema 01] Todos los archivos terminaron de cargar');
    });

    this.load.image('imagen_terreno', './spritesheet-tiles-default.png');
    this.load.tilemapTiledJSON('mi_mapa', './a.json');
    this.load.spritesheet('player', './image.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create() {
    console.log('[Tema 01] create() ejecutado');
    console.log('[Tema 01] Claves en cache de imagenes:', this.textures.getTextureKeys());
    console.log('[Tema 01] Sin renderizar objetos, solo verificando carga');
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: [Tema01Scene],
};

new Phaser.Game(config);