// ==========================================
// SCENARIO 1: MONOCHROMATIC FOG FOREST
// ==========================================

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  init() {
    this.liftActive = false;
    this.platePressed = false;
    this.trapdoorRetracted = false;
    this.plate2Pressed = false;
    this.isDead = false;
    this.levelComplete = false;
    this.currentCheckpoint = { x: 150, y: 400 };
  }

  preload() {
    // Load the empty tilemap JSON
    this.load.tilemapTiledJSON('mapa_escenario1', './mapa_escenario1.json');
    // Load the ambient background music
    this.load.audio('ambient_song', './song.mp3');
  }

  create() {
    // Generate all game textures procedurally
    this.createProceduralTextures();
    // 1. Level Dimensions
    const tileWidth = 64;
    const tileHeight = 64;
    const mapCols = 80;
    const mapRows = 10;
    const mapWidth = mapCols * tileWidth;
    const mapHeight = mapRows * tileHeight;

    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

    // 2. Parallax Background Layers (Monochromatic Forest Silhouettes)
    this.createParallaxBackground(mapWidth, mapHeight);

    // 3. Dynamic Tilemap Layer
    const map = this.make.tilemap({ key: 'mapa_escenario1' });
    const tileset = map.addTilesetImage('background', 'tileset_procedural', 64, 64, 0, 0);
    const layer = map.createLayer('Capa de patrones 1', tileset, 0, 0);
    this.layer = layer;

    // Build map grid
    let levelGrid = Array(mapRows).fill(null).map(() => Array(mapCols).fill(0));

    // Ground & Pit
    for (let x = 0; x < mapCols; x++) {
      if (x >= 12 && x <= 17) {
        levelGrid[9][x] = 2; // Deep dirt
        levelGrid[8][x] = 3; // Spikes at the bottom of the pit
        continue;
      }
      levelGrid[8][x] = 1; // Grass top
      levelGrid[9][x] = 2; // Deep dirt
    }

    // First Obstacle (2-tile high wall at x=10, 11)
    levelGrid[7][10] = 4;
    levelGrid[6][10] = 4;
    levelGrid[7][11] = 4;
    levelGrid[6][11] = 4;

    // High platform for the lever (x=8, 9, y=5)
    levelGrid[5][8] = 1;
    levelGrid[5][9] = 1;

    // Tunnel / ceiling for the second crate/spider puzzle (x=20 to 32, y=4)
    for (let x = 20; x <= 32; x++) {
      levelGrid[4][x] = 4;
      levelGrid[3][x] = 2;
      levelGrid[2][x] = 2;
    }

    // Puzzle 3: Second Spike Pit (cols 37-39)
    for (let x = 37; x <= 39; x++) {
      levelGrid[8][x] = 3; // Spikes
      levelGrid[9][x] = 2; // Dirt
    }

    // Puzzle 4: Second Tunnel roof (cols 43-57, y=5)
    for (let x = 43; x <= 57; x++) {
      levelGrid[5][x] = 4;
      levelGrid[4][x] = 2;
      levelGrid[3][x] = 2;
    }
    // Pressure plate at col 55 has no grass on top (y=8 is empty)
    levelGrid[8][55] = 0;

    // Puzzle 5: Crumbling platforms (cols 60-70)
    // We clear y=8 & 9 for the bottomless chasm
    for (let x = 59; x <= 71; x++) {
      levelGrid[8][x] = 0;
      levelGrid[9][x] = 0;
    }
    // Crumbling tiles (index 5)
    levelGrid[7][60] = 5;
    levelGrid[6][62] = 5;
    levelGrid[6][64] = 5;
    levelGrid[7][66] = 5;
    levelGrid[6][68] = 5;
    levelGrid[7][70] = 5;

    // Block right side to force door exit (col 79)
    for (let y = 0; y < 8; y++) {
      levelGrid[y][79] = 4;
    }

    // Write grid to Phaser tilemap and spawn grass tufts
    for (let y = 0; y < mapRows; y++) {
      for (let x = 0; x < mapCols; x++) {
        let tileVal = levelGrid[y][x];
        if (tileVal !== 0) {
          layer.putTileAt(tileVal, x, y);

          // Spawn grass tuft on top of grass tiles (tileVal 1)
          if (tileVal === 1 && Math.random() < 0.45) {
            let tuft = this.add.image(x * 64 + 16 + Math.random() * 32, y * 64, 'grass_tuft');
            tuft.setOrigin(0.5, 1);
            tuft.setDepth(7);
            tuft.setTint(0x181818);
          }
        }
      }
    }

    // Enable collisions for Ground (1), Dirt (2), Stone Wall (4), and Crumbling logs (5)
    layer.setCollision([1, 2, 4, 5]);

    // Deadly spikes callback
    layer.setTileIndexCallback(3, (sprite, tile) => {
      if (sprite === this.player) {
        if (tile.x >= 37 && tile.x <= 39) {
          if (this.crate3 && this.crate3.y > 500) {
            return;
          }
        }
        this.playerDie();
      }
    }, this);


    // 4. Background Fog (Behind platforms, slow scroll)
    this.createFogLayer(10, 0.05, 0.3);

    // 5. Interactive Puzzle Objects
    this.crates = this.physics.add.group();
    
    // Crate 1 (First obstacle helper)
    this.crate1 = this.physics.add.sprite(5 * 64 + 32, 7 * 64, 'crate');
    this.crate1.setCollideWorldBounds(true);
    this.crate1.setDragX(5000);
    this.crate1.setBounce(0);
    this.crate1.setMass(4);
    this.crates.add(this.crate1);

    // Crate 2 (Tunnel puzzle gate opener)
    this.crate2 = this.physics.add.sprite(22 * 64 + 32, 7 * 64, 'crate');
    this.crate2.setCollideWorldBounds(true);
    this.crate2.setDragX(5000);
    this.crate2.setBounce(0);
    this.crate2.setMass(4);
    this.crates.add(this.crate2);

    // Lever 1 (Flipped to activate moving platform)
    this.lever = this.physics.add.sprite(9 * 64, 5 * 64 - 16, 'lever', '0');
    this.lever.body.setAllowGravity(false);
    this.lever.body.setImmovable(true);

    // Moving Platform (Lift over the first pit)
    this.liftStartX = 12 * 64 + 48;
    this.liftEndX = 17 * 64 + 16;
    this.lift = this.physics.add.sprite(this.liftStartX, 6 * 64 + 16, 'lift');
    this.lift.body.setAllowGravity(false);
    this.lift.body.setImmovable(true);
    this.lift.body.setFriction(1, 0);

    // Pressure Plate 1 (Triggers first gate)
    this.plate = this.physics.add.sprite(28 * 64 + 32, 8 * 64 - 8, 'button', '0');
    this.plate.body.setAllowGravity(false);
    this.plate.body.setImmovable(true);

    // Iron Gate 1 (Blocks first exit tunnel)
    this.gate = this.physics.add.sprite(32 * 64 + 16, 7 * 64 - 64, 'gate');
    this.gate.body.setAllowGravity(false);
    this.gate.body.setImmovable(true);

    // Puzzle 3: Spike Cover objects
    this.lever2 = this.physics.add.sprite(35 * 64 + 32, 8 * 64 - 16, 'lever', '0');
    this.lever2.body.setAllowGravity(false);
    this.lever2.body.setImmovable(true);

    this.trapdoor = this.physics.add.sprite(38.5 * 64, 8 * 64 - 8, 'lift');
    this.trapdoor.body.setAllowGravity(false);
    this.trapdoor.body.setImmovable(true);
    this.trapdoor.setDisplaySize(192, 16); // spans 3 tiles (cols 37, 38, 39)

    this.crate3 = this.physics.add.sprite(38.5 * 64, 7 * 64, 'crate');
    this.crate3.setCollideWorldBounds(true);
    this.crate3.setDragX(5000);
    this.crate3.setBounce(0);
    this.crate3.setMass(4);
    this.crates.add(this.crate3);

    // Puzzle 4: Spider Herding objects
    this.plate2 = this.physics.add.sprite(55 * 64 + 32, 8 * 64 - 8, 'button', '0');
    this.plate2.body.setAllowGravity(false);
    this.plate2.body.setImmovable(true);

    this.gate2 = this.physics.add.sprite(57 * 64 + 16, 7 * 64 - 64, 'gate');
    this.gate2.body.setAllowGravity(false);
    this.gate2.body.setImmovable(true);

    // Exit Door
    this.exitDoor = this.physics.add.sprite(76 * 64 + 32, 8 * 64 - 48, 'exit');
    this.exitDoor.body.setAllowGravity(false);
    this.exitDoor.body.setImmovable(true);

    // Colliders for items
    this.physics.add.collider(this.crates, layer);
    this.physics.add.collider(this.crates, this.trapdoor);

    // 6. Player (El Niño)
    this.player = this.physics.add.sprite(this.currentCheckpoint.x, this.currentCheckpoint.y, 'player_procedural', '0');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(24, 44);
    this.player.body.setOffset(12, 4);
    
    // Colliders for player
    this.physics.add.collider(this.player, layer);
    this.physics.add.overlap(this.player, layer);
    this.physics.add.collider(this.player, this.trapdoor);
    this.physics.add.collider(this.player, this.crates, (player, crate) => {
      if (player.body.touching.down && crate.body.touching.up) {
        return;
      }
      if (player.body.touching.right && crate.body.touching.left) {
        crate.setVelocityX(player.body.velocity.x * 0.75);
      } else if (player.body.touching.left && crate.body.touching.right) {
        crate.setVelocityX(player.body.velocity.x * 0.75);
      }
    });
    this.physics.add.collider(this.player, this.lift);
    this.physics.add.collider(this.player, this.gate);
    this.physics.add.collider(this.crates, this.gate);
    this.physics.add.collider(this.player, this.gate2);
    this.physics.add.collider(this.crates, this.gate2);

    // 7. Animations using explicit frames to ensure compat
    if (!this.anims.exists('walk')) {
      this.anims.create({
        key: 'walk',
        frames: [
          { key: 'player_procedural', frame: '0' },
          { key: 'player_procedural', frame: '1' },
          { key: 'player_procedural', frame: '2' },
          { key: 'player_procedural', frame: '3' },
          { key: 'player_procedural', frame: '4' },
          { key: 'player_procedural', frame: '5' }
        ],
        frameRate: 10,
        repeat: -1
      });
    }
    if (!this.anims.exists('idle')) {
      this.anims.create({
        key: 'idle',
        frames: [{ key: 'player_procedural', frame: '0' }],
        frameRate: 1
      });
    }
    if (!this.anims.exists('spider_walk')) {
      this.anims.create({
        key: 'spider_walk',
        frames: [
          { key: 'spider_procedural', frame: '0' },
          { key: 'spider_procedural', frame: '1' },
          { key: 'spider_procedural', frame: '2' },
          { key: 'spider_procedural', frame: '3' }
        ],
        frameRate: 8,
        repeat: -1
      });
    }

    // 8. Spiders (Esperpentos Arácnidos)
    this.spiders = this.physics.add.group();

    // Spider 1: Patrolling near the lever platform
    let spider1 = this.physics.add.sprite(8.5 * 64, 4 * 64, 'spider_procedural', '0');
    spider1.setData({ startX: 8.5 * 64, startY: 4 * 64, range: 60, dir: -1, fleeing: false, fleeTimer: 0 });
    this.spiders.add(spider1);

    // Spider 2: Patrolling tunnel
    let spider2 = this.physics.add.sprite(25 * 64, 7 * 64, 'spider_procedural', '0');
    spider2.setData({ startX: 25 * 64, startY: 7 * 64, range: 180, dir: -1, fleeing: false, fleeTimer: 0 });
    this.spiders.add(spider2);

    // Spider 3: Hanging Spider (Drops down dynamically)
    this.hangingSpider = this.physics.add.sprite(22 * 64 + 32, 4 * 64, 'spider_procedural', '0');
    this.hangingSpider.setData({ startY: 4 * 64, dropY: 7 * 64 + 16, state: 'hanging' });
    this.hangingSpider.body.setAllowGravity(false);
    this.hangingSpider.body.setSize(48, 32);

    // Spider 4: Herd Spider in the herding tunnel (Puzzle 4)
    this.herdSpider = this.physics.add.sprite(45 * 64, 7 * 64, 'spider_procedural', '0');
    this.herdSpider.setData({ startX: 45 * 64, startY: 7 * 64, range: 40, dir: 1, fleeing: false, fleeTimer: 0 });
    this.spiders.add(this.herdSpider);

    // Spider Colliders
    this.physics.add.collider(this.spiders, layer);
    this.physics.add.collider(this.spiders, this.crates);
    
    // Death overlaps
    this.physics.add.overlap(this.player, this.spiders, this.playerDie, null, this);
    this.physics.add.overlap(this.player, this.hangingSpider, this.playerDie, null, this);

    // Web graphics drawer for hanging spider
    this.webGraphics = this.add.graphics();
    this.webGraphics.setDepth(15);

    // 9. Ceiling Vines decoration
    this.vines = this.add.group();
    const vinePlacements = [
      { x: 21 * 64 + 32, y: 4 * 64 + 16, scale: 0.8 },
      { x: 24 * 64 + 16, y: 4 * 64 + 16, scale: 1.1 },
      { x: 27 * 64 + 48, y: 4 * 64 + 16, scale: 0.9 },
      { x: 30 * 64 + 32, y: 4 * 64 + 16, scale: 1.0 },
      { x: 44 * 64 + 32, y: 5 * 64 + 16, scale: 1.0 },
      { x: 47 * 64 + 16, y: 5 * 64 + 16, scale: 0.9 },
      { x: 50 * 64 + 48, y: 5 * 64 + 16, scale: 1.2 },
      { x: 53 * 64 + 32, y: 5 * 64 + 16, scale: 0.8 },
      { x: 56 * 64 + 16, y: 5 * 64 + 16, scale: 1.1 }
    ];
    vinePlacements.forEach(pos => {
      let vine = this.add.image(pos.x, pos.y, 'vine');
      vine.setOrigin(0.5, 0);
      vine.setScale(pos.scale);
      vine.setDepth(7);
      vine.setTint(0x1a1a1a);
      this.vines.add(vine);
    });

    // 10. Leaf particles falling from canopy
    this.leafEmitter = this.add.particles(0, 0, 'leaf', {
      x: { min: 0, max: mapWidth },
      y: -10,
      quantity: 1,
      frequency: 180,
      lifespan: 8000,
      scale: { min: 0.6, max: 1.3 },
      alpha: { start: 0.6, end: 0, ease: 'Sine.easeIn' },
      speedY: { min: 40, max: 80 },
      speedX: { min: -15, max: 15 },
      rotate: { min: 0, max: 360 },
      gravityY: 8
    });
    this.leafEmitter.setDepth(7);

    // 11. Camera setup
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor('#050505');

    // 12. Foreground Fog (Over platforms, faster scroll)
    this.createFogLayer(90, 0.12, 0.6);



    // 14. Input keyboard keys
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      reset: Phaser.Input.Keyboard.KeyCodes.R
    });

    // 15. UI overlays (Typewriter font)
    this.titleText = this.add.text(400, 250, 'ESCENARIO 1: EL BOSQUE DE NIEBLA', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '28px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.subtitleText = this.add.text(400, 310, 'La linterna ahuyenta a los esperpentos arácnidos.', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '14px',
      color: '#aaaaaa',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // Title card fade out
    this.tweens.add({
      targets: [this.titleText, this.subtitleText],
      alpha: 0,
      delay: 3500,
      duration: 1500,
      onComplete: () => {
        this.titleText.destroy();
        this.subtitleText.destroy();
      }
    });

    // Floating hints
    this.hintText = this.add.text(400, 50, '', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#0a0a0a',
      padding: { x: 10, y: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);

    // Victory Screen Overlay
    this.victoryText = this.add.text(400, 300, 'ESCENARIO 1 COMPLETADO\n\nHas cruzado el bosque monocromático.', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
      backgroundColor: '#000000',
      padding: { x: 20, y: 20 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setVisible(false);

    // Spiders and puzzles reset/setup
    this.resetSpiders();

    // Start background music loop if not already playing (survives scene restarts)
    let music = this.sound.get('ambient_song');
    if (!music) {
      music = this.sound.add('ambient_song', { loop: true, volume: 0.35 });
      music.play();
    } else if (!music.isPlaying) {
      music.play();
    }
  }

  update(time, delta) {
    // Quick level reset key (in case crate gets stuck)
    if (Phaser.Input.Keyboard.JustDown(this.wasd.reset)) {
      this.scene.restart();
      return;
    }

    if (this.isDead || this.levelComplete) return;

    // 1. Controls & Player Movement
    let speed = 160;
    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      this.player.setVelocityX(-speed);
      this.player.anims.play('walk', true);
      this.player.flipX = true;
      if (this.player.body.blocked.down && Math.random() < 0.15) {
        this.createRunningDust(this.player.x + 8, this.player.y + 20);
      }
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      this.player.setVelocityX(speed);
      this.player.anims.play('walk', true);
      this.player.flipX = false;
      if (this.player.body.blocked.down && Math.random() < 0.15) {
        this.createRunningDust(this.player.x - 8, this.player.y + 20);
      }
    } else {
      this.player.setVelocityX(0);
      this.player.anims.play('idle', true);
    }

    // Jump
    if ((this.cursors.up.isDown || this.wasd.up.isDown) && this.player.body.blocked.down) {
      this.player.setVelocityY(-580);
      this.createRunningDust(this.player.x, this.player.y + 20);
    }

    // 2. Out of bounds (falling in pits)
    if (this.player.y > 600) {
      this.playerDie();
    }

    // Checkpoints updater
    if (this.player.x > 1200 && this.currentCheckpoint.x < 1200) {
      this.currentCheckpoint = { x: 1250, y: 400 };
      this.showTemporaryHint('Punto de control 1 alcanzado.');
    }
    if (this.player.x > 2600 && this.currentCheckpoint.x < 2600) {
      this.currentCheckpoint = { x: 2650, y: 400 };
      this.showTemporaryHint('Punto de control 2 alcanzado.');
    }

    // 3. Lever 1 & Moving Lift Mechanical Interaction (Puzzle 2)
    let distToLever = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lever.x, this.lever.y);
    if (distToLever < 50) {
      if (!this.liftActive) {
        this.hintText.setText('[Presiona ENTER para activar palanca]');
        this.hintText.setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.wasd.enter) || Phaser.Input.Keyboard.JustDown(this.wasd.space)) {
          this.liftActive = true;
          this.lever.setFrame('1'); // green knob
          this.lift.setVelocityX(80); // start moving lift
          this.cameras.main.flash(200, 200, 200, 200);
          this.showTemporaryHint('Mecanismo de elevador activado.');
        }
      } else {
        this.hintText.setText('Mecanismo activo');
        this.hintText.setVisible(true);
      }
    } else {
      // Clear hint text unless it's a checkpoint or other puzzle hint
      if (this.hintText.visible && !this.hintText.text.includes('Punto') && !this.hintText.text.includes('Portón') && !this.hintText.text.includes('Mecanismo') && !this.hintText.text.includes('trampilla') && !this.hintText.text.includes('Trampilla')) {
        this.hintText.setVisible(false);
      }
    }

    // Moving Platform patrol loop
    if (this.liftActive) {
      if (this.lift.x >= this.liftEndX) {
        this.lift.setVelocityX(-80);
      } else if (this.lift.x <= this.liftStartX) {
        this.lift.setVelocityX(80);
      }
    }

    // 4. Puzzle 3: Lever 2 & Trapdoor mechanical interaction (Spike Cover)
    let distToLever2 = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lever2.x, this.lever2.y);
    if (distToLever2 < 50) {
      if (!this.trapdoorRetracted) {
        this.hintText.setText('[Presiona ENTER para abrir trampilla]');
        this.hintText.setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.wasd.enter) || Phaser.Input.Keyboard.JustDown(this.wasd.space)) {
          this.trapdoorRetracted = true;
          this.lever2.setFrame('1');
          this.cameras.main.flash(200, 200, 200, 200);
          this.cameras.main.shake(300, 0.008);
          this.showTemporaryHint('Trampilla abriéndose...');
          
          this.tweens.add({
            targets: this.trapdoor,
            x: this.trapdoor.x - 220, // Slide left
            duration: 1000,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
              this.trapdoor.body.enable = false;
            }
          });
        }
      } else {
        this.hintText.setText('Trampilla abierta');
        this.hintText.setVisible(true);
      }
    }

    // 5. Pressure Plate 1 & Gate 1 Mechanics
    let crateOnPlate = false;
    this.crates.getChildren().forEach(crate => {
      let overlap = Phaser.Geom.Intersects.RectangleToRectangle(crate.getBounds(), this.plate.getBounds());
      if (overlap) crateOnPlate = true;
    });

    if (crateOnPlate) {
      if (!this.platePressed) {
        this.platePressed = true;
        this.plate.setFrame('1');
        this.cameras.main.shake(150, 0.005);
        this.showTemporaryHint('Portón de hierro 1 abriéndose...');
        
        this.tweens.add({
          targets: this.gate,
          y: 7 * 64 - 180,
          duration: 1000,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            this.gate.body.enable = false;
          }
        });
      }
    } else {
      if (this.platePressed) {
        this.platePressed = false;
        this.plate.setFrame('0');
        this.gate.body.enable = true;
        this.cameras.main.shake(100, 0.004);
        
        this.tweens.add({
          targets: this.gate,
          y: 7 * 64 - 64,
          duration: 600,
          ease: 'Bounce.easeOut'
        });
      }
    }

    // 6. Puzzle 4: Pressure Plate 2 & Gate 2 Mechanics (Spider Herding)
    let spiderOnPlate2 = false;
    this.spiders.getChildren().forEach(spider => {
      let overlap = Phaser.Geom.Intersects.RectangleToRectangle(spider.getBounds(), this.plate2.getBounds());
      if (overlap) spiderOnPlate2 = true;
    });

    if (spiderOnPlate2) {
      if (!this.plate2Pressed) {
        this.plate2Pressed = true;
        this.plate2.setFrame('1');
        this.cameras.main.shake(150, 0.005);
        this.showTemporaryHint('Portón de hierro 2 abriéndose...');
        
        this.tweens.add({
          targets: this.gate2,
          y: 7 * 64 - 180,
          duration: 1000,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            this.gate2.body.enable = false;
          }
        });
      }
    } else {
      if (this.plate2Pressed) {
        this.plate2Pressed = false;
        this.plate2.setFrame('0');
        this.gate2.body.enable = true;
        this.cameras.main.shake(100, 0.004);
        
        this.tweens.add({
          targets: this.gate2,
          y: 7 * 64 - 64,
          duration: 600,
          ease: 'Bounce.easeOut'
        });
      }
    }

    // 7. Patrolling Spiders AI (fear light cone)
    this.spiders.getChildren().forEach(spider => {
      let isLit = this.checkIfLit(spider);
      let fleeing = spider.getData('fleeing');
      
      if (isLit) {
        spider.setData('fleeing', true);
        spider.setData('fleeTimer', 80);
        
        let dir = spider.x > this.player.x ? 1 : -1;
        spider.setVelocityX(dir * 180);
        spider.anims.play('spider_walk', true);
        spider.setTint(0xff6666);
        spider.flipX = dir < 0;
        
        if (Math.random() < 0.25) {
          this.createRunningDust(spider.x, spider.y + 12, 0xff7777);
        }
      } else {
        let timer = spider.getData('fleeTimer') || 0;
        if (timer > 0) {
          spider.setData('fleeTimer', timer - 1);
        } else {
          spider.setData('fleeing', false);
          spider.clearTint();
          
          let vx = spider.body.velocity.x;
          if (Math.abs(vx) !== 80) {
            vx = spider.getData('dir') * 80;
            spider.setVelocityX(vx);
          }
          
          let startX = spider.getData('startX');
          let range = spider.getData('range');
          if (spider.x <= startX - range) {
            spider.setVelocityX(80);
            spider.setData('dir', 1);
            spider.flipX = false;
          } else if (spider.x >= startX + range) {
            spider.setVelocityX(-80);
            spider.setData('dir', -1);
            spider.flipX = true;
          }
          
          if (spider.body.blocked.left) {
            spider.setVelocityX(80);
            spider.setData('dir', 1);
            spider.flipX = false;
          } else if (spider.body.blocked.right) {
            spider.setVelocityX(-80);
            spider.setData('dir', -1);
            spider.flipX = true;
          }

          spider.anims.play('spider_walk', true);
        }
      }
    });

    // 8. Hanging Spider AI
    let hangSpider = this.hangingSpider;
    let hangState = hangSpider.getData('state');
    let startY = hangSpider.getData('startY');
    let dropY = hangSpider.getData('dropY');
    let isHangSpiderLit = this.checkIfLit(hangSpider);

    this.webGraphics.clear();
    this.webGraphics.lineStyle(1.5, 0xbbbbbb, 0.45);
    this.webGraphics.beginPath();
    this.webGraphics.moveTo(hangSpider.x, startY - 32);
    this.webGraphics.lineTo(hangSpider.x, hangSpider.y);
    this.webGraphics.strokePath();

    if (isHangSpiderLit) {
      hangSpider.setData('state', 'climbing');
      hangSpider.setVelocityY(-160);
      hangSpider.setTint(0xff6666);
      hangSpider.anims.play('spider_walk', true);

      if (hangSpider.y <= startY) {
        hangSpider.y = startY;
        hangSpider.setVelocityY(0);
        hangSpider.setData('state', 'hanging');
        hangSpider.clearTint();
        hangSpider.anims.stop();
      }
    } else {
      hangSpider.clearTint();
      if (hangState === 'hanging') {
        hangSpider.setVelocityY(0);
        if (Math.abs(this.player.x - hangSpider.x) < 140 && this.player.y > hangSpider.y) {
          hangSpider.setData('state', 'dropping');
          hangSpider.setVelocityY(220);
        }
      } else if (hangState === 'dropping') {
        hangSpider.anims.play('spider_walk', true);
        if (hangSpider.y >= dropY) {
          hangSpider.y = dropY;
          hangSpider.setVelocityY(0);
          hangSpider.setData('state', 'at_bottom');
          
          this.time.delayedCall(1200, () => {
            if (hangSpider.getData('state') === 'at_bottom') {
              hangSpider.setData('state', 'climbing');
              hangSpider.setVelocityY(-60);
            }
          });
        }
      } else if (hangState === 'climbing') {
        hangSpider.anims.play('spider_walk', true);
        if (hangSpider.y <= startY) {
          hangSpider.y = startY;
          hangSpider.setVelocityY(0);
          hangSpider.setData('state', 'hanging');
          hangSpider.anims.stop();
        }
      }
    }

    // 9. Puzzle 5: Crumbling Logs Checker
    if (this.player.body.blocked.down) {
      let tile = this.layer.getTileAtWorldXY(this.player.x, this.player.y + 24);
      if (tile && tile.index === 5) {
        this.startCrumble(tile);
      }
    }

    // 10. Victory exit check
    let distToExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitDoor.x, this.exitDoor.y);
    if (distToExit < 40) {
      this.triggerVictory();
    }
  }

  // Flashlight cone intersection calculator
  checkIfLit(target) {
    let px = this.player.x;
    let py = this.player.y;
    let tx = target.x;
    let ty = target.y;

    let dist = Phaser.Math.Distance.Between(px, py, tx, ty);
    if (dist > 250) return false;

    let facingRight = !this.player.flipX;
    
    // Target must be in the facing direction
    if (facingRight && tx < px) return false;
    if (!facingRight && tx > px) return false;

    // Math check for cone height relative to horizontal distance
    let dx = Math.abs(tx - px);
    let maxDy = Math.tan(0.32) * dx; // 0.32 radians is ~18 degrees cone half-angle

    return Math.abs(ty - py) < maxDy + 32; // 32px vertical offset tolerance
  }



  // Player death sequence
  playerDie() {
    if (this.isDead) return;
    this.isDead = true;

    this.cameras.main.shake(250, 0.015);
    this.player.setVelocity(0, 0);
    this.player.body.enable = false;

    this.tweens.add({
      targets: this.player,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        // Move back to active checkpoint
        this.player.setPosition(this.currentCheckpoint.x, this.currentCheckpoint.y);
        
        this.time.delayedCall(400, () => {
          this.player.alpha = 1;
          this.player.body.enable = true;
          this.isDead = false;
          this.resetSpiders();
        });
      }
    });
  }

  // Restore spider patrol states on reset
  resetSpiders() {
    this.spiders.getChildren().forEach(spider => {
      let startX = spider.getData('startX');
      let startY = spider.getData('startY');
      spider.setPosition(startX, startY);
      spider.setVelocityX(spider.getData('dir') * 80);
      spider.setAlpha(1);
      spider.setData('fleeing', false);
      spider.setData('fleeTimer', 0);
      spider.clearTint();
    });

    if (this.hangingSpider) {
      let startY = this.hangingSpider.getData('startY');
      this.hangingSpider.setPosition(22 * 64 + 32, startY);
      this.hangingSpider.setVelocity(0, 0);
      this.hangingSpider.setData('state', 'hanging');
      this.hangingSpider.clearTint();
      this.hangingSpider.anims.stop();
    }

    // Reset Puzzle 3 (Trapdoor & Crate 3)
    if (this.trapdoor) {
      this.trapdoorRetracted = false;
      if (this.lever2) this.lever2.setFrame('0');
      this.trapdoor.setPosition(38.5 * 64, 8 * 64 - 8);
      this.trapdoor.body.enable = true;
    }
    if (this.crate3) {
      this.crate3.setPosition(38.5 * 64, 7 * 64);
      this.crate3.setVelocity(0, 0);
    }

    // Restore any crumbled log tiles
    this.restoreCrumblingTiles();
  }

  startCrumble(tile) {
    if (!tile.properties) tile.properties = {};
    if (tile.properties.crumbling) return;
    tile.properties.crumbling = true;

    // Shake visual effect: spawn dust particles repeatedly
    let dustTimer = this.time.addEvent({
      delay: 60,
      repeat: 12,
      callback: () => {
        if (!tile || tile.index === -1) return;
        this.createRunningDust(
          tile.pixelX + Math.random() * 64,
          tile.pixelY + Math.random() * 16,
          0x444444
        );
      }
    });

    // Camera micro shake
    this.cameras.main.shake(150, 0.001);

    // After 800ms, remove the tile
    this.time.delayedCall(800, () => {
      this.layer.removeTileAt(tile.x, tile.y);
      this.cameras.main.shake(150, 0.003);
      
      // Spawn bigger dust burst
      for (let i = 0; i < 8; i++) {
        this.createRunningDust(
          tile.pixelX + Math.random() * 64,
          tile.pixelY + 8 + Math.random() * 24,
          0x222222
        );
      }
    });
  }

  restoreCrumblingTiles() {
    const logs = [
      { x: 60, y: 7 },
      { x: 62, y: 6 },
      { x: 64, y: 6 },
      { x: 66, y: 7 },
      { x: 68, y: 6 },
      { x: 70, y: 7 }
    ];
    if (this.layer) {
      logs.forEach(log => {
        let tile = this.layer.getTileAt(log.x, log.y);
        if (!tile || tile.index !== 5) {
          this.layer.putTileAt(5, log.x, log.y);
        }
      });
    }
  }

  // Victory sequence
  triggerVictory() {
    if (this.levelComplete) return;
    this.levelComplete = true;

    this.player.setVelocity(0, 0);
    this.player.body.enable = false;
    this.player.anims.play('idle', true);

    this.victoryText.setVisible(true);
    this.victoryText.setAlpha(0);

    this.tweens.add({
      targets: this.victoryText,
      alpha: 1,
      duration: 800
    });

    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.1,
      duration: 2000,
      ease: 'Quad.easeInOut'
    });

    // Slowly fade the level to black and reload
    this.time.delayedCall(4000, () => {
      this.cameras.main.fade(1500, 0, 0, 0, false, (camera, progress) => {
        if (progress === 1) {
          this.scene.restart();
        }
      });
    });
  }

  // Creates soft running/fear dust procedurally using Phaser sprites & tweens
  createRunningDust(x, y, tint = 0x555555) {
    let dust = this.physics.add.sprite(x, y, 'fog');
    dust.body.setAllowGravity(false);
    dust.setScale(0.12);
    dust.setAlpha(0.4);
    dust.setTint(tint);

    this.tweens.add({
      targets: dust,
      scale: 0.3,
      alpha: 0,
      y: y - 16,
      x: x + (Math.random() - 0.5) * 20,
      duration: 350,
      onComplete: () => {
        dust.destroy();
      }
    });
  }

  showTemporaryHint(text) {
    this.hintText.setText(text);
    this.hintText.setVisible(true);
    
    // Clear hint after 3 seconds
    if (this.hintTimer) this.hintTimer.remove();
    this.hintTimer = this.time.delayedCall(3000, () => {
      this.hintText.setVisible(false);
    });
  }

  // Create Parallax trees
  createParallaxBackground(width, height) {
    // 3 parallax layers of silhouetted trees
    const layers = [
      { scrollFactor: 0.1, count: 12, alpha: 0.12, tint: 0x1a1a1a, scaleMin: 1.4, scaleMax: 2.2, depth: 2 },
      { scrollFactor: 0.35, count: 18, alpha: 0.28, tint: 0x111111, scaleMin: 1.0, scaleMax: 1.6, depth: 4 },
      { scrollFactor: 0.65, count: 14, alpha: 0.50, tint: 0x090909, scaleMin: 0.8, scaleMax: 1.2, depth: 6 }
    ];

    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        // Distribute trees evenly along length of level
        let tx = (width / layer.count) * i + Math.random() * 80;
        let ty = 512 - 256 * (layer.scaleMin + Math.random() * (layer.scaleMax - layer.scaleMin));
        let scale = layer.scaleMin + Math.random() * (layer.scaleMax - layer.scaleMin);
        let key = Math.random() > 0.5 ? 'tree_pine' : 'tree_deciduous';

        let treeImg = this.add.image(tx, ty, key);
        treeImg.setOrigin(0.5, 0);
        treeImg.setScrollFactor(layer.scrollFactor);
        treeImg.setDepth(layer.depth);
        treeImg.setAlpha(layer.alpha);
        treeImg.setTint(layer.tint);
        treeImg.setScale(scale);
      }
    });
  }

  // Create fog particle layer
  createFogLayer(depth, speedXFactor, alphaMax) {
    const emitter = this.add.particles(0, 0, 'fog', {
      x: { min: -100, max: 900 },
      y: { min: 200, max: 550 },
      quantity: 1,
      frequency: 400,
      lifespan: 12000,
      scale: { min: 3, max: 6 },
      alpha: { start: 0, end: alphaMax, ease: 'Sine.easeInOut' },
      speedX: { min: 12 * speedXFactor, max: 28 * speedXFactor },
      speedY: { min: -4, max: 4 },
      rotate: { min: -20, max: 20 }
    });
    emitter.setScrollFactor(0); // Lock on screen viewport for continuous atmospheric fog
    emitter.setDepth(depth);
  }

  // Generator of all textures procedurally using HTML5 canvas
  createProceduralTextures() {
    // If textures are already generated (e.g. after scene restart), skip creation to prevent crash
    if (this.textures.exists('crate')) {
      return;
    }

    const makeTexture = (key, w, h, drawFn) => {
      let tex = this.textures.createCanvas(key, w, h);
      drawFn(tex.context);
      tex.refresh();
    };

    // 1. Crate
    makeTexture('crate', 64, 64, ctx => {
      ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#050505'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 60, 60);
      ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 2; ctx.strokeRect(6, 6, 52, 52);
      ctx.strokeStyle = '#050505'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(56, 56); ctx.moveTo(56, 8); ctx.lineTo(8, 56); ctx.stroke();
    });

    // 2. Lift
    makeTexture('lift', 96, 16, ctx => {
      ctx.fillStyle = '#151515'; ctx.fillRect(0, 0, 96, 16);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, 0, 96, 4);
      ctx.fillStyle = '#222222';
      for (let i = 0; i < 96; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 4); ctx.lineTo(i + 8, 4); ctx.lineTo(i + 16, 16); ctx.lineTo(i + 8, 16); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = '#050505'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 94, 14);
    });

    // 3. Gate
    makeTexture('gate', 32, 128, ctx => {
      ctx.fillStyle = '#0f0f0f'; ctx.fillRect(0, 0, 32, 128);
      ctx.fillStyle = '#222222';
      ctx.fillRect(4, 0, 5, 128); ctx.fillRect(13, 0, 5, 128); ctx.fillRect(23, 0, 5, 128);
      ctx.fillStyle = '#151515';
      ctx.fillRect(0, 12, 32, 8); ctx.fillRect(0, 60, 32, 8); ctx.fillRect(0, 108, 32, 8);
    });

    // 4. Exit
    makeTexture('exit', 64, 96, ctx => {
      ctx.fillStyle = '#050505';
      ctx.beginPath(); ctx.moveTo(8, 96); ctx.lineTo(8, 36); ctx.arc(32, 36, 24, Math.PI, 0); ctx.lineTo(56, 96); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(8, 96); ctx.lineTo(8, 36); ctx.arc(32, 36, 24, Math.PI, 0); ctx.lineTo(56, 96); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('SALIDA', 32, 48);
    });

    // 5. Fog
    makeTexture('fog', 128, 128, ctx => {
      let grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(230, 230, 230, 0.16)');
      grad.addColorStop(0.5, 'rgba(230, 230, 230, 0.05)');
      grad.addColorStop(1, 'rgba(230, 230, 230, 0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill();
    });

    // 6. Tileset (Width 320 to support Tile 5)
    makeTexture('tileset_procedural', 320, 64, ctx => {
      // Tile 1: Grass Top
      ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#2d2d2d'; ctx.fillRect(0, 0, 64, 8);
      ctx.fillStyle = '#181818';
      for (let i = 0; i < 64; i += 8) {
        ctx.beginPath(); ctx.moveTo(i, 8); ctx.lineTo(i + 4, 2); ctx.lineTo(i + 8, 8); ctx.fill();
      }
      // Tile 2: Dirt Block
      ctx.fillStyle = '#111111'; ctx.fillRect(64, 0, 64, 64);
      ctx.fillStyle = '#1b1b1b';
      for (let i = 0; i < 15; i++) ctx.fillRect(64 + Math.random() * 60, Math.random() * 60, 2, 2);
      ctx.strokeStyle = '#080808'; ctx.lineWidth = 1; ctx.strokeRect(64.5, 0.5, 63, 63);
      // Tile 3: Spikes
      ctx.fillStyle = '#0a0a0a';
      for (let i = 0; i < 4; i++) {
        let sx = 128 + i * 16;
        ctx.beginPath(); ctx.moveTo(sx, 64); ctx.lineTo(sx + 8, 18); ctx.lineTo(sx + 16, 64); ctx.closePath(); ctx.fill();
      }
      // Tile 4: Stone Bricks Wall
      ctx.fillStyle = '#1c1c1c'; ctx.fillRect(192, 0, 64, 64);
      ctx.strokeStyle = '#0c0c0c'; ctx.lineWidth = 2;
      ctx.strokeRect(193, 1, 62, 62);
      ctx.beginPath(); ctx.moveTo(192, 32); ctx.lineTo(256, 32); ctx.moveTo(224, 0); ctx.lineTo(224, 32); ctx.moveTo(208, 32); ctx.lineTo(208, 64); ctx.moveTo(240, 32); ctx.lineTo(240, 64); ctx.stroke();
      // Tile 5: Crumbling Logs
      ctx.fillStyle = '#141414'; ctx.fillRect(256, 0, 64, 64);
      ctx.strokeStyle = '#222222'; ctx.lineWidth = 2;
      ctx.strokeRect(257, 1, 62, 62);
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(256, 16); ctx.lineTo(320, 16);
      ctx.moveTo(256, 32); ctx.lineTo(320, 32);
      ctx.moveTo(256, 48); ctx.lineTo(320, 48);
      ctx.stroke();
      ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(270, 4); ctx.lineTo(275, 12);
      ctx.moveTo(300, 20); ctx.lineTo(295, 28);
      ctx.moveTo(280, 36); ctx.lineTo(285, 44);
      ctx.stroke();
    });

    // 7. Tree Pine
    makeTexture('tree_pine', 128, 256, ctx => {
      ctx.fillStyle = '#080808'; ctx.fillRect(58, 180, 12, 76);
      ctx.beginPath(); ctx.moveTo(64, 20); ctx.lineTo(120, 100); ctx.lineTo(80, 100); ctx.lineTo(110, 140); ctx.lineTo(70, 140); ctx.lineTo(116, 192); ctx.lineTo(12, 192); ctx.lineTo(58, 140); ctx.lineTo(18, 140); ctx.lineTo(48, 100); ctx.lineTo(8, 100); ctx.closePath(); ctx.fill();
    });

    // 8. Tree Deciduous
    makeTexture('tree_deciduous', 128, 256, ctx => {
      ctx.fillStyle = '#080808'; ctx.fillRect(56, 130, 16, 126);
      ctx.beginPath(); ctx.arc(42, 90, 32, 0, Math.PI * 2); ctx.arc(86, 82, 36, 0, Math.PI * 2); ctx.arc(64, 55, 42, 0, Math.PI * 2); ctx.fill();
    });

    // 9. Lever Spritesheet (2 frames of 32x32)
    let leverTex = this.textures.createCanvas('lever', 64, 32);
    let leverCtx = leverTex.context;
    // Frame 0 (Off)
    leverCtx.fillStyle = '#141414'; leverCtx.fillRect(4, 24, 24, 8);
    leverCtx.strokeStyle = '#2d2d2d'; leverCtx.lineWidth = 3;
    leverCtx.beginPath(); leverCtx.moveTo(16, 24); leverCtx.lineTo(8, 10); leverCtx.stroke();
    leverCtx.fillStyle = '#cc2222'; leverCtx.beginPath(); leverCtx.arc(8, 10, 4, 0, Math.PI * 2); leverCtx.fill();
    leverTex.add('0', 0, 0, 0, 32, 32);
    // Frame 1 (On)
    leverCtx.fillStyle = '#141414'; leverCtx.fillRect(36, 24, 24, 8);
    leverCtx.strokeStyle = '#2d2d2d'; leverCtx.lineWidth = 3;
    leverCtx.beginPath(); leverCtx.moveTo(48, 24); leverCtx.lineTo(56, 10); leverCtx.stroke();
    leverCtx.fillStyle = '#22cc22'; leverCtx.beginPath(); leverCtx.arc(56, 10, 4, 0, Math.PI * 2); leverCtx.fill();
    leverTex.add('1', 0, 32, 0, 32, 32);
    leverTex.refresh();

    // 10. Button Spritesheet (2 frames of 64x32)
    let buttonTex = this.textures.createCanvas('button', 128, 32);
    let buttonCtx = buttonTex.context;
    // Frame 0 (Unpressed)
    buttonCtx.fillStyle = '#141414'; buttonCtx.fillRect(8, 24, 48, 8);
    buttonCtx.fillStyle = '#aa2222'; buttonCtx.fillRect(16, 16, 32, 8);
    buttonTex.add('0', 0, 0, 0, 64, 32);
    // Frame 1 (Pressed)
    buttonCtx.fillStyle = '#141414'; buttonCtx.fillRect(72, 24, 48, 8);
    buttonCtx.fillStyle = '#22aa22'; buttonCtx.fillRect(80, 22, 32, 2);
    buttonTex.add('1', 0, 64, 0, 64, 32);
    buttonTex.refresh();

    // 11. Player Spritesheet (6 frames of 48x48)
    let playerTex = this.textures.createCanvas('player_procedural', 288, 48);
    let playerCtx = playerTex.context;
    for (let f = 0; f < 6; f++) {
      this.drawBoyFrame(playerCtx, f, f * 48);
      playerTex.add(f.toString(), 0, f * 48, 0, 48, 48);
    }
    playerTex.refresh();

    // 12. Spider Spritesheet (4 frames of 64x48)
    let spiderTex = this.textures.createCanvas('spider_procedural', 256, 48);
    let spiderCtx = spiderTex.context;
    for (let f = 0; f < 4; f++) {
      this.drawSpiderFrame(spiderCtx, f, f * 64);
      spiderTex.add(f.toString(), 0, f * 64, 0, 64, 48);
    }
    spiderTex.refresh();

    // 13. Vine decoration texture
    makeTexture('vine', 16, 64, ctx => {
      ctx.strokeStyle = '#080808'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.bezierCurveTo(4, 20, 12, 40, 8, 64);
      ctx.stroke();
      ctx.fillStyle = '#0b0b0b';
      ctx.beginPath();
      ctx.ellipse(5, 16, 4, 2, -0.4, 0, Math.PI * 2);
      ctx.ellipse(11, 32, 4, 2, 0.4, 0, Math.PI * 2);
      ctx.ellipse(5, 48, 4, 2, -0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 14. Leaf particle texture
    makeTexture('leaf', 8, 8, ctx => {
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.ellipse(4, 4, 4, 2, 0.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 15. Grass Tuft decoration texture
    makeTexture('grass_tuft', 16, 16, ctx => {
      ctx.strokeStyle = '#121212'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, 16); ctx.lineTo(2, 4);
      ctx.moveTo(8, 16); ctx.lineTo(5, 2);
      ctx.moveTo(8, 16); ctx.lineTo(8, 1);
      ctx.moveTo(8, 16); ctx.lineTo(11, 2);
      ctx.moveTo(8, 16); ctx.lineTo(14, 4);
      ctx.stroke();
    });
  }

  // Draw a frame of the boy (El Niño)
  drawBoyFrame(ctx, frameIdx, xOffset) {
    let hx = xOffset + 24;
    let hy = 14;
    
    ctx.fillStyle = '#0f0f0f'; // Dark silhouette body
    
    // Head circle
    ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill();
    
    // Glowing eyes facing forward-right
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx + 1, hy - 1, 2, 2);
    ctx.fillRect(hx + 4, hy - 1, 2, 2);
    
    // Red/White Scarf for visual contrast in monochrome
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(hx - 4, hy + 5, 8, 3);
    
    // Scarf tail waving
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.moveTo(hx - 3, hy + 7);
    let wave = Math.sin(frameIdx * 1.3) * 3;
    ctx.lineTo(hx - 11, hy + 10 + wave);
    ctx.lineTo(hx - 3, hy + 12);
    ctx.closePath(); ctx.fill();
    
    // Body Coat
    ctx.fillStyle = '#0f0f0f';
    ctx.beginPath();
    ctx.moveTo(hx - 6, 20); ctx.lineTo(hx + 6, 20);
    ctx.lineTo(hx + 8, 34); ctx.lineTo(hx - 8, 34);
    ctx.closePath(); ctx.fill();
    
    // Legs walking movement
    ctx.strokeStyle = '#0f0f0f'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    
    let la = 0, ra = 0;
    if (frameIdx > 0) {
      la = Math.sin(frameIdx * 1.15) * 0.45;
      ra = -Math.sin(frameIdx * 1.15) * 0.45;
    }
    
    // Left leg
    ctx.beginPath(); ctx.moveTo(hx - 3, 34);
    ctx.lineTo(hx - 3 + Math.sin(la) * 11, 34 + Math.cos(la) * 11);
    ctx.stroke();
    
    // Right leg
    ctx.beginPath(); ctx.moveTo(hx + 3, 34);
    ctx.lineTo(hx + 3 + Math.sin(ra) * 11, 34 + Math.cos(ra) * 11);
    ctx.stroke();
  }

  // Draw a frame of the spider (Esperpento Arácnido)
  drawSpiderFrame(ctx, frameIdx, xOffset) {
    let cx = xOffset + 32;
    let cy = 20;

    ctx.fillStyle = '#050505'; // Black spider silhouette

    // Abdomen & Head
    ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy + 1, 5, 0, Math.PI * 2); ctx.fill();

    // Glowing red eyes
    ctx.fillStyle = '#ff1111';
    ctx.beginPath(); ctx.arc(cx + 9, cy, 2, 0, Math.PI * 2); ctx.arc(cx + 7, cy - 2, 1.5, 0, Math.PI * 2); ctx.fill();

    // Legs drawing with jointed shapes
    ctx.strokeStyle = '#050505'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    let phase = frameIdx * (Math.PI / 2);

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        let legAngle = (i - 1.5) * 0.4 + side * (Math.PI / 2);
        if (frameIdx > 0) {
          legAngle += Math.sin(phase + i) * 0.22;
        }

        let sx = cx + side * 4;
        let sy = cy + 2;

        let j1x = sx + Math.cos(legAngle) * 8;
        let j1y = sy + Math.sin(legAngle) * 8 - 5; // Joint 1 bent up

        let knee = legAngle + side * 0.85;
        let j2x = j1x + Math.cos(knee) * 11;
        let j2y = j1y + Math.sin(knee) * 11 + 9; // Knee bent down

        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(j1x, j1y); ctx.lineTo(j2x, j2y);
        ctx.stroke();
      }
    }
  }
}

// Config
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1000 },
      debug: false
    }
  },
  scene: [MainScene]
};

const game = new Phaser.Game(config);
