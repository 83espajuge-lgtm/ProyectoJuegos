// ==========================================
// ESCENARIO 2: ZONA INDUSTRIAL ASFIXIANTE
// ==========================================

class Scene2 extends Phaser.Scene {
  constructor() {
    super({ key: 'Scene2' });
  }

  init() {
    this.valve1Active = false;
    this.sensorPressed = false;
    this.sensorGateOpen = false;
    this.plate2Pressed = false;
    this.gate2Open = false;
    this.isDead = false;
    this.levelComplete = false;
    this.currentCheckpoint = { x: 150, y: 400 };
    this.conveyorTiles = [];
  }

  preload() {
    // NOTE: filename is case-sensitive on Linux servers — use exact filename
    this.load.tilemapTiledJSON('mapa_escenario2', './mapa_Escenario2.json');
    this.load.audio('ambient_song2', './OnceUponATime.mp3');
  }

  create() {
    this.createProceduralTextures();

    const tileWidth = 64;
    const tileHeight = 64;
    const mapCols = 80;
    const mapRows = 10;
    const mapWidth = mapCols * tileWidth;
    const mapHeight = mapRows * tileHeight;

    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

    // --- Background ---
    this.createIndustrialBackground(mapWidth, mapHeight);

    // --- Tilemap ---
    const map = this.make.tilemap({ key: 'mapa_escenario2' });
    const tileset = map.addTilesetImage('background', 'tileset_industrial', 64, 64, 0, 0);
    if (!tileset) throw new Error('Tileset no encontrado. Revisa que createProceduralTextures crea tileset_industrial.');
    const layer = map.createLayer('Capa de patrones 1', tileset, 0, 0);
    if (!layer) throw new Error('Layer Capa de patrones 1 no encontrado en el JSON.');
    this.layer = layer;

    // Build map grid
    // Tile indices:
    // 1 = Metal floor (top, walkable)
    // 2 = Metal block (filler/wall)
    // 3 = Spikes / Gas vent (deadly)
    // 4 = Reinforced wall
    // 5 = Conveyor belt (right-moving)
    let g = Array(mapRows).fill(null).map(() => Array(mapCols).fill(0));

    // --- Ground ---
    for (let x = 0; x < mapCols; x++) {
      // Pit 1: cols 12-16 (valve puzzle)
      if (x >= 12 && x <= 16) {
        g[9][x] = 2;
        g[8][x] = 3; // gas vents
        continue;
      }
      // Pit 2: cols 36-40 (robot zone)
      if (x >= 36 && x <= 40) {
        g[9][x] = 2;
        g[8][x] = 3;
        continue;
      }
      // Bottomless chasm: cols 59-71 (conveyor jump puzzle)
      // Lava/acid floor: deadly if player falls in
      if (x >= 59 && x <= 71) {
        g[9][x] = 2; // solid filler block below
        g[8][x] = 3; // deadly gas vent / lava on top (player lands here → dies)
        continue;
      }
      g[8][x] = 1; // metal floor top
      g[9][x] = 2; // metal block
    }

    // Wall at start
    g[7][10] = 4; g[6][10] = 4;
    g[7][11] = 4; g[6][11] = 4;

    // High platform for valve (x=8,9, y=5)
    g[5][8] = 1; g[5][9] = 1;

    // Ceiling tunnel puzzle 1 (x=20..32, y=4)
    for (let x = 20; x <= 32; x++) {
      g[4][x] = 4; g[3][x] = 2; g[2][x] = 2;
    }

    // Puzzle 3: Robot patrol corridor with ceiling (x=43..57, y=5)
    for (let x = 43; x <= 57; x++) {
      g[5][x] = 4; g[4][x] = 2; g[3][x] = 2;
    }

    // Conveyor platforms over the chasm
    g[7][60] = 5; // conveyor
    g[6][63] = 5;
    g[6][66] = 5;
    g[7][69] = 5;
    g[6][71] = 5; // landing pad edge

    // Right wall / end block
    for (let y = 0; y < 8; y++) g[y][79] = 4;

    // Write grid to tilemap
    for (let y = 0; y < mapRows; y++) {
      for (let x = 0; x < mapCols; x++) {
        let v = g[y][x];
        if (v !== 0) {
          layer.putTileAt(v, x, y);

          // Spawn pipe rivets on metal floor
          if (v === 1 && Math.random() < 0.3) {
            let rivet = this.add.image(x * 64 + 12 + Math.random() * 40, y * 64 + 4, 'rivet');
            rivet.setOrigin(0.5, 0.5).setDepth(7);
          }

          // Track conveyor tiles for update loop
          if (v === 5) {
            this.conveyorTiles.push({ wx: x * 64, wy: y * 64 });
          }
        }
      }
    }

    layer.setCollision([1, 2, 4, 5]);

    // Gas vent callback (deadly) — also triggers on lava pit floor (tile 3)
    layer.setTileIndexCallback(3, (sprite) => {
      if (sprite === this.player) this.playerDie();
    }, this);

    // --- Lava pit visual overlay (chasm cols 59-71, row 8) ---
    this.lavaOverlays = [];
    for (let lx = 59; lx <= 71; lx++) {
      let lavaGlow = this.add.graphics();
      lavaGlow.fillStyle(0xff3300, 0.55);
      lavaGlow.fillRect(lx * 64, 8 * 64, 64, 64);
      lavaGlow.setDepth(9);
      this.lavaOverlays.push({ gfx: lavaGlow, baseX: lx * 64, phase: Math.random() * Math.PI * 2 });

      // Lava surface cracks / streaks
      let streak = this.add.graphics();
      streak.lineStyle(2, 0xff9900, 0.6);
      streak.beginPath();
      streak.moveTo(lx * 64 + 10 + Math.random() * 10, 8 * 64 + 8);
      streak.lineTo(lx * 64 + 30 + Math.random() * 10, 8 * 64 + 40);
      streak.lineTo(lx * 64 + 50, 8 * 64 + 20 + Math.random() * 20);
      streak.strokePath();
      streak.setDepth(10);
    }

    // Warning text above the lava pit
    this.add.text(65 * 64, 7 * 64 - 30, '⚠ LAVA', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ff6600',
      backgroundColor: '#1a0000',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5, 1).setDepth(15);

    // --- Smoke layer (behind objects) ---
    this.createSmokeLayer(10, 0.04, 0.25, 0xcc6600);

    // --- Physics groups ---
    this.crates = this.physics.add.group();

    // Crate 1 — for sensor puzzle
    this.crate1 = this.physics.add.sprite(5 * 64 + 32, 7 * 64, 'crate_metal');
    this.crate1.setCollideWorldBounds(true).setDragX(5000).setBounce(0).setMass(4);
    this.crates.add(this.crate1);

    // Crate 2 — for tunnel pressure plate
    this.crate2 = this.physics.add.sprite(22 * 64 + 32, 7 * 64, 'crate_metal');
    this.crate2.setCollideWorldBounds(true).setDragX(5000).setBounce(0).setMass(4);
    this.crates.add(this.crate2);

    // --- Puzzle 1: Valve + Steam Trap ---
    this.valve1 = this.physics.add.sprite(9 * 64, 5 * 64 - 16, 'valve', '0');
    this.valve1.body.setAllowGravity(false).setImmovable(true);

    // Steam jet blocker over pit 1 — slides away when valve is activated
    this.steamBlock = this.physics.add.sprite(14 * 64, 6 * 64 + 16, 'steam_block');
    this.steamBlock.body.setAllowGravity(false).setImmovable(true);
    this.steamBlock.setDisplaySize(320, 16);
    this.steamStartX = 14 * 64;

    // --- Puzzle 2: Sensor + Bridge (gate) ---
    this.sensor1 = this.physics.add.sprite(28 * 64 + 32, 8 * 64 - 8, 'sensor', '0');
    this.sensor1.body.setAllowGravity(false).setImmovable(true);

    this.bridge1 = this.physics.add.sprite(32 * 64 + 16, 7 * 64 - 64, 'gate_industrial');
    this.bridge1.body.setAllowGravity(false).setImmovable(true);

    // --- Puzzle 3: Gas vent cover (same as trapdoor mechanic) ---
    this.valve2 = this.physics.add.sprite(35 * 64 + 32, 8 * 64 - 16, 'valve', '0');
    this.valve2.body.setAllowGravity(false).setImmovable(true);

    this.gasCover = this.physics.add.sprite(38.5 * 64, 8 * 64 - 8, 'steam_block');
    this.gasCover.body.setAllowGravity(false).setImmovable(true);
    this.gasCover.setDisplaySize(192, 16);
    this.valve2Active = false;
    this.gasCoverRetracted = false;

    this.crate3 = this.physics.add.sprite(38.5 * 64, 7 * 64, 'crate_metal');
    this.crate3.setCollideWorldBounds(true).setDragX(5000).setBounce(0).setMass(4);
    this.crates.add(this.crate3);

    // --- Puzzle 4: Robot herding through sensor ---
    this.sensor2 = this.physics.add.sprite(55 * 64 + 32, 8 * 64 - 8, 'sensor', '0');
    this.sensor2.body.setAllowGravity(false).setImmovable(true);

    this.bridge2 = this.physics.add.sprite(57 * 64 + 16, 7 * 64 - 64, 'gate_industrial');
    this.bridge2.body.setAllowGravity(false).setImmovable(true);

    // --- Exit door ---
    this.exitDoor = this.physics.add.sprite(76 * 64 + 32, 8 * 64 - 48, 'exit_industrial');
    this.exitDoor.body.setAllowGravity(false).setImmovable(true);

    // Colliders
    this.physics.add.collider(this.crates, layer);
    this.physics.add.collider(this.crates, this.gasCover);

    // --- Player ---
    this.player = this.physics.add.sprite(
      this.currentCheckpoint.x, this.currentCheckpoint.y, 'player_procedural', '0'
    );
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(24, 44).setOffset(12, 4);

    this.physics.add.collider(this.player, layer);
    this.physics.add.overlap(this.player, layer);
    this.physics.add.collider(this.player, this.gasCover);
    this.physics.add.collider(this.player, this.crates, (player, crate) => {
      if (player.body.touching.down && crate.body.touching.up) return;
      if (player.body.touching.right && crate.body.touching.left) {
        crate.setVelocityX(player.body.velocity.x * 0.75);
      } else if (player.body.touching.left && crate.body.touching.right) {
        crate.setVelocityX(player.body.velocity.x * 0.75);
      }
    });
    this.physics.add.collider(this.player, this.steamBlock);
    this.physics.add.collider(this.player, this.bridge1);
    this.physics.add.collider(this.crates, this.bridge1);
    this.physics.add.collider(this.player, this.bridge2);
    this.physics.add.collider(this.crates, this.bridge2);

    // --- Animations (player & robot) ---
    if (!this.anims.exists('walk')) {
      this.anims.create({
        key: 'walk',
        frames: [
          { key: 'player_procedural', frame: '0' }, { key: 'player_procedural', frame: '1' },
          { key: 'player_procedural', frame: '2' }, { key: 'player_procedural', frame: '3' },
          { key: 'player_procedural', frame: '4' }, { key: 'player_procedural', frame: '5' }
        ],
        frameRate: 10, repeat: -1
      });
    }
    if (!this.anims.exists('idle')) {
      this.anims.create({
        key: 'idle',
        frames: [{ key: 'player_procedural', frame: '0' }],
        frameRate: 1
      });
    }
    if (!this.anims.exists('robot_walk')) {
      this.anims.create({
        key: 'robot_walk',
        frames: [
          { key: 'robot_procedural', frame: '0' }, { key: 'robot_procedural', frame: '1' },
          { key: 'robot_procedural', frame: '2' }, { key: 'robot_procedural', frame: '3' }
        ],
        frameRate: 6, repeat: -1
      });
    }

    // --- Robots ---
    this.robots = this.physics.add.group();

    let robot1 = this.physics.add.sprite(8.5 * 64, 4 * 64, 'robot_procedural', '0');
    robot1.setData({ startX: 8.5 * 64, range: 60, dir: -1, alerted: false, alertTimer: 0 });
    this.robots.add(robot1);

    let robot2 = this.physics.add.sprite(25 * 64, 7 * 64, 'robot_procedural', '0');
    robot2.setData({ startX: 25 * 64, range: 180, dir: -1, alerted: false, alertTimer: 0 });
    this.robots.add(robot2);

    // Herd robot (puzzle 4 — needs to step on sensor2)
    this.herdRobot = this.physics.add.sprite(45 * 64, 7 * 64, 'robot_procedural', '0');
    this.herdRobot.setData({ startX: 45 * 64, range: 40, dir: 1, alerted: false, alertTimer: 0 });
    this.robots.add(this.herdRobot);

    this.physics.add.collider(this.robots, layer);
    this.physics.add.collider(this.robots, this.crates);
    this.physics.add.overlap(this.player, this.robots, this.playerDie, null, this);

    // --- Smoke pipes decoration ---
    this.smokePipes = [];
    [3 * 64, 15 * 64, 28 * 64, 42 * 64, 55 * 64, 68 * 64].forEach(px => {
      this.smokePipes.push(this.add.image(px, 8 * 64, 'pipe').setOrigin(0.5, 1).setDepth(7));
    });

    // Gear decorations
    this.gears = [];
    [7 * 64, 20 * 64, 33 * 64, 50 * 64, 65 * 64].forEach((px, i) => {
      let gear = this.add.image(px, 7 * 64 - 16, 'gear').setDepth(6).setScale(0.8 + (i % 2) * 0.3);
      this.gears.push({ img: gear, speed: (i % 2 === 0 ? 1 : -1) * 0.6 });
    });

    // --- Smoke emitters ---
    this.smokeEmitter = this.add.particles(0, 0, 'smoke_puff', {
      x: { min: 0, max: mapWidth },
      y: { min: 300, max: 500 },
      quantity: 1,
      frequency: 500,
      lifespan: 6000,
      scale: { min: 1, max: 3 },
      alpha: { start: 0, end: 0.18 },
      speedX: { min: 10, max: 30 },
      speedY: { min: -20, max: -5 },
      tint: [0x663300, 0x442200, 0x884400]
    });
    this.smokeEmitter.setScrollFactor(1).setDepth(8);

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor('#0a0500'); // Deep dark orange-black

    // --- Foreground smoke ---
    this.createSmokeLayer(90, 0.1, 0.45, 0x884400);

    // --- Input ---
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

    // --- UI ---
    this.titleText = this.add.text(400, 250, 'ESCENARIO 2: ZONA INDUSTRIAL', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '28px', color: '#ff9900', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.subtitleText = this.add.text(400, 310, 'El calor te aplasta. Las máquinas no sienten piedad.', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '14px', color: '#cc6600', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.tweens.add({
      targets: [this.titleText, this.subtitleText],
      alpha: 0, delay: 3500, duration: 1500,
      onComplete: () => { this.titleText.destroy(); this.subtitleText.destroy(); }
    });

    this.hintText = this.add.text(400, 50, '', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '16px', color: '#ffaa00',
      backgroundColor: '#1a0800', padding: { x: 10, y: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);

    this.victoryText = this.add.text(400, 300,
      'ESCENARIO 2 COMPLETADO\n\nHas cruzado la zona industrial.', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '24px', color: '#ff9900', align: 'center',
      backgroundColor: '#000000', padding: { x: 20, y: 20 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setVisible(false);

    this.resetRobots();

    // Music
    let music = this.sound.get('ambient_song2');
    if (!music) {
      // fallback to song.mp3 if song2.mp3 not available
      try {
        music = this.sound.add('ambient_song2', { loop: true, volume: 0.35 });
        music.play();
      } catch(e) {
        let fallback = this.sound.get('ambient_song');
        if (fallback && !fallback.isPlaying) fallback.play();
      }
    } else if (!music.isPlaying) {
      music.play();
    }
  }

  update(time, delta) {
    if (Phaser.Input.Keyboard.JustDown(this.wasd.reset)) {
      this.scene.restart();
      return;
    }

    if (this.isDead || this.levelComplete) return;

    // --- Controls ---
    let speed = 160;
    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      this.player.setVelocityX(-speed);
      this.player.anims.play('walk', true);
      this.player.flipX = true;
      if (this.player.body.blocked.down && Math.random() < 0.1)
        this.createSpark(this.player.x + 8, this.player.y + 20);
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      this.player.setVelocityX(speed);
      this.player.anims.play('walk', true);
      this.player.flipX = false;
      if (this.player.body.blocked.down && Math.random() < 0.1)
        this.createSpark(this.player.x - 8, this.player.y + 20);
    } else {
      this.player.setVelocityX(0);
      this.player.anims.play('idle', true);
    }

    if ((this.cursors.up.isDown || this.wasd.up.isDown) && this.player.body.blocked.down) {
      this.player.setVelocityY(-580);
    }

    // Out of bounds
    if (this.player.y > 640) this.playerDie();

    // Conveyor belt effect: push player sideways if standing on conveyor tile
    if (this.player.body.blocked.down) {
      let tile = this.layer.getTileAtWorldXY(this.player.x, this.player.y + 24);
      if (tile && tile.index === 5) {
        this.player.setVelocityX((this.player.body.velocity.x || 0) + 120);
      }
    }

    // Checkpoints
    if (this.player.x > 1200 && this.currentCheckpoint.x < 1200) {
      this.currentCheckpoint = { x: 1250, y: 400 };
      this.showTemporaryHint('☑ Punto de control 1.');
    }
    if (this.player.x > 2600 && this.currentCheckpoint.x < 2600) {
      this.currentCheckpoint = { x: 2650, y: 400 };
      this.showTemporaryHint('☑ Punto de control 2.');
    }
    // Checkpoint before lava/conveyor pit
    if (this.player.x > 3700 && this.currentCheckpoint.x < 3700) {
      this.currentCheckpoint = { x: 3760, y: 400 };
      this.showTemporaryHint('☑ Punto de control 3. ¡Cuidado con la lava!');
    }

    // Rotate gear decorations
    this.gears.forEach(g => { g.img.rotation += g.speed * 0.02; });

    // Lava pit flicker animation
    if (this.lavaOverlays) {
      this.lavaOverlays.forEach(lv => {
        let flicker = 0.4 + 0.2 * Math.sin(time * 0.004 + lv.phase);
        lv.gfx.setAlpha(flicker);
      });
    }

    // --- Puzzle 1: Valve 1 → Steam Block slides away ---
    let distV1 = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.valve1.x, this.valve1.y);
    if (distV1 < 50) {
      if (!this.valve1Active) {
        this.hintText.setText('[ENTER] Girar válvula de vapor');
        this.hintText.setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.wasd.enter) || Phaser.Input.Keyboard.JustDown(this.wasd.space)) {
          this.valve1Active = true;
          this.valve1.setFrame('1');
          this.cameras.main.shake(300, 0.009);
          this.cameras.main.flash(200, 255, 120, 0);
          this.showTemporaryHint('¡Vapor desviado! Cruza el foso.');

          this.tweens.add({
            targets: this.steamBlock,
            x: this.steamStartX - 350,
            duration: 900,
            ease: 'Cubic.easeInOut',
            onComplete: () => { this.steamBlock.body.enable = false; }
          });
        }
      } else {
        this.hintText.setText('Válvula activa');
        this.hintText.setVisible(true);
      }
    } else if (
      this.hintText.visible &&
      !this.hintText.text.includes('Punto') &&
      !this.hintText.text.includes('activa') &&
      !this.hintText.text.includes('Cruza') &&
      !this.hintText.text.includes('Sensor') &&
      !this.hintText.text.includes('abierto')
    ) {
      this.hintText.setVisible(false);
    }

    // --- Puzzle 2: Sensor 1 + Bridge 1 ---
    let crateOnSensor1 = false;
    this.crates.getChildren().forEach(c => {
      if (Phaser.Geom.Intersects.RectangleToRectangle(c.getBounds(), this.sensor1.getBounds()))
        crateOnSensor1 = true;
    });

    if (crateOnSensor1) {
      if (!this.sensorPressed) {
        this.sensorPressed = true;
        this.sensor1.setFrame('1');
        this.cameras.main.shake(150, 0.005);
        this.showTemporaryHint('Puente de acceso abriéndose...');
        this.tweens.add({
          targets: this.bridge1,
          y: 7 * 64 - 180,
          duration: 1000,
          ease: 'Cubic.easeOut',
          onComplete: () => { this.bridge1.body.enable = false; }
        });
      }
    } else if (this.sensorPressed) {
      this.sensorPressed = false;
      this.sensor1.setFrame('0');
      this.bridge1.body.enable = true;
      this.tweens.add({
        targets: this.bridge1, y: 7 * 64 - 64,
        duration: 600, ease: 'Bounce.easeOut'
      });
    }

    // --- Puzzle 3: Valve 2 → Gas cover retracts ---
    let distV2 = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.valve2.x, this.valve2.y);
    if (distV2 < 50) {
      if (!this.gasCoverRetracted) {
        this.hintText.setText('[ENTER] Girar válvula de ventilación');
        this.hintText.setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.wasd.enter) || Phaser.Input.Keyboard.JustDown(this.wasd.space)) {
          this.gasCoverRetracted = true;
          this.valve2.setFrame('1');
          this.cameras.main.shake(300, 0.008);
          this.showTemporaryHint('Cubierta de gas abriéndose...');
          this.tweens.add({
            targets: this.gasCover,
            x: this.gasCover.x - 220,
            duration: 1000,
            ease: 'Cubic.easeInOut',
            onComplete: () => { this.gasCover.body.enable = false; }
          });
        }
      } else {
        this.hintText.setText('Ventilación abierta');
        this.hintText.setVisible(true);
      }
    }

    // --- Puzzle 4: Sensor 2 activated by robot ---
    let robotOnSensor2 = false;
    this.robots.getChildren().forEach(r => {
      if (Phaser.Geom.Intersects.RectangleToRectangle(r.getBounds(), this.sensor2.getBounds()))
        robotOnSensor2 = true;
    });

    if (robotOnSensor2) {
      if (!this.plate2Pressed) {
        this.plate2Pressed = true;
        this.sensor2.setFrame('1');
        this.cameras.main.shake(150, 0.005);
        this.showTemporaryHint('Sensor activado — puerta abierta.');
        this.tweens.add({
          targets: this.bridge2, y: 7 * 64 - 180,
          duration: 1000, ease: 'Cubic.easeOut',
          onComplete: () => { this.bridge2.body.enable = false; }
        });
      }
    } else if (this.plate2Pressed) {
      this.plate2Pressed = false;
      this.sensor2.setFrame('0');
      this.bridge2.body.enable = true;
      this.tweens.add({
        targets: this.bridge2, y: 7 * 64 - 64,
        duration: 600, ease: 'Bounce.easeOut'
      });
    }

    // --- Robot AI ---
    this.robots.getChildren().forEach(robot => {
      // Alert if player is within range and unshielded
      let dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, robot.x, robot.y);
      let alerted = robot.getData('alerted');
      let alertTimer = robot.getData('alertTimer') || 0;

      if (dist < 200) {
        robot.setData('alerted', true);
        robot.setData('alertTimer', 60);
        let dir = robot.x < this.player.x ? 1 : -1;
        robot.setVelocityX(dir * 130);
        robot.flipX = dir < 0;
        robot.anims.play('robot_walk', true);
        robot.setTint(0xff4400);
      } else {
        if (alertTimer > 0) robot.setData('alertTimer', alertTimer - 1);
        else {
          robot.setData('alerted', false);
          robot.clearTint();

          let vx = robot.body.velocity.x;
          if (Math.abs(vx) < 5) vx = robot.getData('dir') * 70;

          let startX = robot.getData('startX');
          let range = robot.getData('range');
          if (robot.x <= startX - range) { robot.setData('dir', 1); robot.flipX = false; }
          else if (robot.x >= startX + range) { robot.setData('dir', -1); robot.flipX = true; }
          if (robot.body.blocked.left) { robot.setData('dir', 1); robot.flipX = false; }
          else if (robot.body.blocked.right) { robot.setData('dir', -1); robot.flipX = true; }

          robot.setVelocityX(robot.getData('dir') * 70);
          robot.anims.play('robot_walk', true);
        }
      }
    });

    // --- Victory check ---
    let distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitDoor.x, this.exitDoor.y);
    if (distExit < 40) this.triggerVictory();
  }

  // ---- HELPERS ----

  playerDie() {
    if (this.isDead) return;
    this.isDead = true;
    this.cameras.main.shake(250, 0.015);
    this.cameras.main.flash(200, 255, 80, 0);
    this.player.setVelocity(0, 0);
    this.player.body.enable = false;

    this.tweens.add({
      targets: this.player, alpha: 0, duration: 400,
      onComplete: () => {
        this.player.setPosition(this.currentCheckpoint.x, this.currentCheckpoint.y);
        this.time.delayedCall(400, () => {
          this.player.alpha = 1;
          this.player.body.enable = true;
          this.isDead = false;
          this.resetRobots();
        });
      }
    });
  }

  resetRobots() {
    this.robots.getChildren().forEach(robot => {
      let startX = robot.getData('startX');
      robot.setPosition(startX, 7 * 64);
      robot.setVelocityX(robot.getData('dir') * 70);
      robot.setAlpha(1).clearTint();
      robot.setData('alerted', false).setData('alertTimer', 0);
    });

    // Reset puzzle 3
    if (this.gasCover) {
      this.gasCoverRetracted = false;
      if (this.valve2) this.valve2.setFrame('0');
      this.gasCover.setPosition(38.5 * 64, 8 * 64 - 8);
      this.gasCover.body.enable = true;
    }
    if (this.crate3) {
      this.crate3.setPosition(38.5 * 64, 7 * 64);
      this.crate3.setVelocity(0, 0);
    }
  }

  triggerVictory() {
    if (this.levelComplete) return;
    this.levelComplete = true;

    this.player.setVelocity(0, 0).body.enable = false;
    this.player.anims.play('idle', true);
    this.victoryText.setVisible(true).setAlpha(0);

    this.tweens.add({ targets: this.victoryText, alpha: 1, duration: 800 });
    this.tweens.add({ targets: this.cameras.main, zoom: 1.1, duration: 2000, ease: 'Quad.easeInOut' });

    this.time.delayedCall(4000, () => {
      this.cameras.main.fade(1500, 0, 0, 0, false, (camera, progress) => {
        if (progress === 1) {
          // To go to scenario 3, replace with: window.location.href = 'escenario3.html'
          this.scene.restart();
        }
      });
    });
  }

  showTemporaryHint(text) {
    this.hintText.setText(text).setVisible(true);
    if (this.hintTimer) this.hintTimer.remove();
    this.hintTimer = this.time.delayedCall(3000, () => { this.hintText.setVisible(false); });
  }

  createSpark(x, y) {
    let spark = this.physics.add.sprite(x, y, 'smoke_puff');
    spark.body.setAllowGravity(false);
    spark.setScale(0.08).setAlpha(0.7).setTint(0xff8800);
    this.tweens.add({
      targets: spark, scale: 0.2, alpha: 0, y: y - 12,
      x: x + (Math.random() - 0.5) * 24,
      duration: 300,
      onComplete: () => spark.destroy()
    });
  }

  createIndustrialBackground(width, height) {
    // 3 parallax layers: distant factory silhouettes, mid pipes, close girders
    const layers = [
      { scrollFactor: 0.1, count: 10, alpha: 0.10, depth: 2, type: 'factory_far' },
      { scrollFactor: 0.35, count: 14, alpha: 0.22, depth: 4, type: 'factory_mid' },
      { scrollFactor: 0.65, count: 10, alpha: 0.45, depth: 6, type: 'factory_close' }
    ];

    layers.forEach(layerDef => {
      for (let i = 0; i < layerDef.count; i++) {
        let tx = (width / layerDef.count) * i + Math.random() * 80;
        let ty = height - 60 - Math.random() * 200;
        let img = this.add.image(tx, ty, 'factory_silhouette');
        img.setOrigin(0.5, 1).setScrollFactor(layerDef.scrollFactor)
           .setDepth(layerDef.depth).setAlpha(layerDef.alpha)
           .setScale(0.8 + Math.random() * 0.8)
           .setTint(0x331100);
      }
    });
  }

  createSmokeLayer(depth, speedXFactor, alphaMax, tintColor) {
    const emitter = this.add.particles(0, 0, 'smoke_puff', {
      x: { min: -100, max: 900 },
      y: { min: 200, max: 550 },
      quantity: 1, frequency: 350,
      lifespan: 10000,
      scale: { min: 2, max: 5 },
      alpha: { start: 0, end: alphaMax, ease: 'Sine.easeInOut' },
      speedX: { min: 12 * speedXFactor, max: 28 * speedXFactor },
      speedY: { min: -6, max: 2 },
      rotate: { min: -15, max: 15 },
      tint: tintColor
    });
    emitter.setScrollFactor(0).setDepth(depth);
  }

  // ---- TEXTURE GENERATION ----

  createProceduralTextures() {
    if (this.textures.exists('crate_metal')) return;

    const makeTexture = (key, w, h, drawFn) => {
      let tex = this.textures.createCanvas(key, w, h);
      drawFn(tex.context);
      tex.refresh();
    };

    // Player (reuse if exists from scene 1, else create)
    if (!this.textures.exists('player_procedural')) {
      let playerTex = this.textures.createCanvas('player_procedural', 288, 48);
      let playerCtx = playerTex.context;
      for (let f = 0; f < 6; f++) {
        this.drawBoyFrame(playerCtx, f, f * 48);
        playerTex.add(f.toString(), 0, f * 48, 0, 48, 48);
      }
      playerTex.refresh();
    }

    // Crate (metal variant — orange rivets)
    makeTexture('crate_metal', 64, 64, ctx => {
      ctx.fillStyle = '#2a1800'; ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#1a0e00'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 60, 60);
      ctx.strokeStyle = '#4a2e00'; ctx.lineWidth = 2; ctx.strokeRect(6, 6, 52, 52);
      ctx.strokeStyle = '#1a0e00'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(56, 56); ctx.moveTo(56, 8); ctx.lineTo(8, 56); ctx.stroke();
      // Rivets
      ctx.fillStyle = '#885500';
      [[8,8],[56,8],[8,56],[56,56],[32,32]].forEach(([rx,ry]) => {
        ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
      });
    });

    // Industrial tileset (320x64, 5 tiles)
    makeTexture('tileset_industrial', 320, 64, ctx => {
      // Tile 1: Metal floor grating
      ctx.fillStyle = '#1a1000'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#331a00'; ctx.fillRect(0, 0, 64, 6); // top edge highlight
      ctx.strokeStyle = '#0a0800'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 64; i += 8) { // vertical grate lines
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, 16); ctx.lineTo(64, 16);
      ctx.moveTo(0, 32); ctx.lineTo(64, 32);
      ctx.moveTo(0, 48); ctx.lineTo(64, 48);
      ctx.stroke();
      // Rivets on corners
      ctx.fillStyle = '#664400';
      [[4,4],[60,4],[4,60],[60,60]].forEach(([rx,ry]) => {
        ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill();
      });

      // Tile 2: Rusted metal block
      ctx.fillStyle = '#150d00'; ctx.fillRect(64, 0, 64, 64);
      ctx.fillStyle = '#1e1200';
      for (let i = 0; i < 12; i++) {
        ctx.fillRect(64 + Math.random() * 58, Math.random() * 58, 3, 2);
      }
      ctx.strokeStyle = '#0a0800'; ctx.lineWidth = 1; ctx.strokeRect(64.5, 0.5, 63, 63);

      // Tile 3: Gas vent (deadly)
      ctx.fillStyle = '#1a0800'; ctx.fillRect(128, 32, 64, 32); // base
      ctx.fillStyle = '#442200';
      for (let i = 0; i < 4; i++) {
        let sx = 132 + i * 14;
        // Vent hole + rising gas visual
        ctx.beginPath(); ctx.ellipse(sx + 5, 50, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(180,100,0,0.4)';
      ctx.beginPath(); ctx.moveTo(128, 32); ctx.lineTo(192, 32); ctx.lineTo(192, 0); ctx.lineTo(128, 0); ctx.fill();
      // Skull warning
      ctx.fillStyle = '#ff6600'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('☠', 160, 22);

      // Tile 4: Reinforced steel wall
      ctx.fillStyle = '#221200'; ctx.fillRect(192, 0, 64, 64);
      ctx.strokeStyle = '#0a0800'; ctx.lineWidth = 2;
      ctx.strokeRect(193, 1, 62, 62);
      ctx.beginPath();
      ctx.moveTo(192, 32); ctx.lineTo(256, 32);
      ctx.moveTo(224, 0); ctx.lineTo(224, 32);
      ctx.moveTo(208, 32); ctx.lineTo(208, 64);
      ctx.moveTo(240, 32); ctx.lineTo(240, 64);
      ctx.stroke();
      ctx.fillStyle = '#664400';
      [[196,4],[252,4],[196,60],[252,60],[196,36],[252,36]].forEach(([rx,ry]) => {
        ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill();
      });

      // Tile 5: Conveyor belt (right-moving orange arrows)
      ctx.fillStyle = '#1e0f00'; ctx.fillRect(256, 0, 64, 64);
      ctx.strokeStyle = '#442200'; ctx.lineWidth = 2;
      ctx.strokeRect(257, 1, 62, 62);
      ctx.fillStyle = '#884400';
      // Arrow chevrons
      for (let i = 0; i < 3; i++) {
        let ax = 268 + i * 18;
        ctx.beginPath();
        ctx.moveTo(ax, 20); ctx.lineTo(ax + 9, 32); ctx.lineTo(ax, 44);
        ctx.lineTo(ax + 3, 44); ctx.lineTo(ax + 12, 32); ctx.lineTo(ax + 3, 20);
        ctx.closePath(); ctx.fill();
      }
    });

    // Smoke puff
    makeTexture('smoke_puff', 128, 128, ctx => {
      let grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(180, 80, 0, 0.18)');
      grad.addColorStop(0.5, 'rgba(100, 40, 0, 0.07)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill();
    });

    // Valve spritesheet (2 frames)
    let vTex = this.textures.createCanvas('valve', 64, 32);
    let vCtx = vTex.context;
    // Frame 0 — closed (red indicator)
    vCtx.fillStyle = '#2a1400'; vCtx.fillRect(2, 18, 24, 12);
    vCtx.strokeStyle = '#664400'; vCtx.lineWidth = 2;
    vCtx.beginPath(); vCtx.moveTo(14, 18); vCtx.lineTo(8, 8); vCtx.stroke();
    vCtx.fillStyle = '#cc2200'; vCtx.beginPath(); vCtx.arc(8, 8, 4, 0, Math.PI * 2); vCtx.fill();
    // Wheel spokes
    vCtx.strokeStyle = '#885500'; vCtx.lineWidth = 1.5;
    vCtx.beginPath();
    vCtx.moveTo(14, 18); vCtx.lineTo(22, 8);
    vCtx.moveTo(14, 18); vCtx.lineTo(14, 5);
    vCtx.stroke();
    vTex.add('0', 0, 0, 0, 32, 32);
    // Frame 1 — open (orange indicator)
    vCtx.fillStyle = '#2a1400'; vCtx.fillRect(34, 18, 24, 12);
    vCtx.strokeStyle = '#664400'; vCtx.lineWidth = 2;
    vCtx.beginPath(); vCtx.moveTo(46, 18); vCtx.lineTo(56, 8); vCtx.stroke();
    vCtx.fillStyle = '#ff8800'; vCtx.beginPath(); vCtx.arc(56, 8, 4, 0, Math.PI * 2); vCtx.fill();
    vCtx.strokeStyle = '#885500'; vCtx.lineWidth = 1.5;
    vCtx.beginPath();
    vCtx.moveTo(46, 18); vCtx.lineTo(38, 8);
    vCtx.moveTo(46, 18); vCtx.lineTo(46, 5);
    vCtx.stroke();
    vTex.add('1', 0, 32, 0, 32, 32);
    vTex.refresh();

    // Steam block (horizontal blocker)
    makeTexture('steam_block', 96, 16, ctx => {
      ctx.fillStyle = '#331800'; ctx.fillRect(0, 0, 96, 16);
      ctx.fillStyle = '#553300'; ctx.fillRect(0, 0, 96, 4);
      ctx.strokeStyle = '#1a0800'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 94, 14);
      // Steam effect dashes
      ctx.strokeStyle = '#cc6600'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(96, 8); ctx.stroke();
      ctx.setLineDash([]);
    });

    // Sensor (pressure plate variant, orange themed)
    let sTex = this.textures.createCanvas('sensor', 128, 32);
    let sCtx = sTex.context;
    // Frame 0 — inactive
    sCtx.fillStyle = '#1e1000'; sCtx.fillRect(8, 24, 48, 8);
    sCtx.fillStyle = '#883300'; sCtx.fillRect(16, 16, 32, 8);
    sTex.add('0', 0, 0, 0, 64, 32);
    // Frame 1 — active
    sCtx.fillStyle = '#1e1000'; sCtx.fillRect(72, 24, 48, 8);
    sCtx.fillStyle = '#1a0a00'; sCtx.fillRect(80, 22, 32, 2);
    sCtx.fillStyle = '#ff8800'; sCtx.fillRect(80, 16, 32, 8);
    sTex.add('1', 0, 64, 0, 64, 32);
    sTex.refresh();

    // Industrial gate
    makeTexture('gate_industrial', 32, 128, ctx => {
      ctx.fillStyle = '#1a0a00'; ctx.fillRect(0, 0, 32, 128);
      ctx.fillStyle = '#331800';
      ctx.fillRect(4, 0, 5, 128); ctx.fillRect(13, 0, 5, 128); ctx.fillRect(23, 0, 5, 128);
      ctx.fillStyle = '#221200';
      ctx.fillRect(0, 12, 32, 6); ctx.fillRect(0, 60, 32, 6); ctx.fillRect(0, 108, 32, 6);
      // Warning stripes
      ctx.fillStyle = '#ff8800';
      for (let y = 0; y < 128; y += 16) {
        ctx.fillRect(0, y, 4, 8);
        ctx.fillRect(28, y + 8, 4, 8);
      }
    });

    // Exit industrial
    makeTexture('exit_industrial', 64, 96, ctx => {
      ctx.fillStyle = '#1a0a00';
      ctx.beginPath(); ctx.moveTo(8, 96); ctx.lineTo(8, 36); ctx.arc(32, 36, 24, Math.PI, 0); ctx.lineTo(56, 96); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(8, 96); ctx.lineTo(8, 36); ctx.arc(32, 36, 24, Math.PI, 0); ctx.lineTo(56, 96); ctx.stroke();
      ctx.fillStyle = '#ff8800'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('SALIDA', 32, 48);
    });

    // Robot spritesheet (4 frames of 48x48)
    let rTex = this.textures.createCanvas('robot_procedural', 192, 48);
    let rCtx = rTex.context;
    for (let f = 0; f < 4; f++) {
      this.drawRobotFrame(rCtx, f, f * 48);
      rTex.add(f.toString(), 0, f * 48, 0, 48, 48);
    }
    rTex.refresh();

    // Factory silhouette for background
    makeTexture('factory_silhouette', 128, 256, ctx => {
      ctx.fillStyle = '#0a0500';
      // Main building block
      ctx.fillRect(20, 100, 88, 156);
      // Chimney stacks
      ctx.fillRect(28, 40, 14, 65);
      ctx.fillRect(50, 60, 12, 45);
      ctx.fillRect(82, 30, 16, 75);
      // Top caps
      ctx.fillRect(24, 36, 22, 6);
      ctx.fillRect(46, 56, 20, 6);
      ctx.fillRect(78, 26, 24, 6);
      // Window-like shapes
      ctx.fillStyle = '#1a0800';
      for (let wy = 120; wy < 230; wy += 24) {
        for (let wx = 30; wx < 98; wx += 20) {
          ctx.fillRect(wx, wy, 10, 12);
        }
      }
    });

    // Pipe decoration
    makeTexture('pipe', 16, 80, ctx => {
      ctx.fillStyle = '#221100'; ctx.fillRect(4, 0, 8, 80);
      ctx.strokeStyle = '#441e00'; ctx.lineWidth = 1;
      ctx.strokeRect(4, 0, 8, 80);
      // Pipe joints
      ctx.fillStyle = '#553300';
      [20, 48, 72].forEach(py => { ctx.fillRect(2, py, 12, 5); });
    });

    // Gear decoration
    makeTexture('gear', 48, 48, ctx => {
      ctx.fillStyle = '#331800';
      // Inner circle
      ctx.beginPath(); ctx.arc(24, 24, 10, 0, Math.PI * 2); ctx.fill();
      // Teeth
      ctx.fillStyle = '#4a2200';
      for (let i = 0; i < 8; i++) {
        let angle = (i / 8) * Math.PI * 2;
        let tx = 24 + Math.cos(angle) * 17;
        let ty = 24 + Math.sin(angle) * 17;
        ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#221100';
      ctx.beginPath(); ctx.arc(24, 24, 5, 0, Math.PI * 2); ctx.fill();
    });

    // Rivet decoration (small dot)
    makeTexture('rivet', 8, 8, ctx => {
      ctx.fillStyle = '#553300';
      ctx.beginPath(); ctx.arc(4, 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#884400';
      ctx.beginPath(); ctx.arc(3, 3, 1.5, 0, Math.PI * 2); ctx.fill();
    });
  }

  drawBoyFrame(ctx, frameIdx, xOffset) {
    // Exact copy from Scene 1 to keep the player consistent
    let hx = xOffset + 24, hy = 13;
    ctx.fillStyle = '#5c4033';
    ctx.beginPath();
    ctx.moveTo(hx-7,hy-4); ctx.lineTo(hx-13,hy-5); ctx.lineTo(hx-7,hy+1);
    ctx.moveTo(hx-5,hy-6); ctx.lineTo(hx-10,hy-11); ctx.lineTo(hx-2,hy-7);
    ctx.moveTo(hx-2,hy-8); ctx.lineTo(hx-4,hy-13); ctx.lineTo(hx+2,hy-8);
    ctx.moveTo(hx+2,hy-8); ctx.lineTo(hx+4,hy-11); ctx.lineTo(hx+6,hy-7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#5c4033';
    ctx.beginPath(); ctx.arc(hx, hy-1, 8, Math.PI, 0); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx-2,hy-4); ctx.lineTo(hx+3,hy-2); ctx.lineTo(hx+6,hy-4); ctx.lineTo(hx+1,hy-6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(hx+2,hy-2,2,3); ctx.fillRect(hx+5,hy-2,2,3);
    ctx.fillStyle = '#111111'; ctx.fillRect(hx+3,hy-1,1,2); ctx.fillRect(hx+6,hy-1,1,2);
    ctx.fillStyle = 'rgba(255,120,120,0.4)';
    ctx.beginPath(); ctx.arc(hx+1,hy+2,1.5,0,Math.PI*2); ctx.arc(hx+6,hy+2,1.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#c68642'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hx+4,hy+1,1.8,0,Math.PI); ctx.stroke();
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.roundRect(hx-5,hy+6,10,3.5,1.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx-3,hy+7);
    let wave = Math.sin(frameIdx*1.3)*3;
    ctx.lineTo(hx-12,hy+9+wave); ctx.lineTo(hx-11,hy+13+wave); ctx.lineTo(hx-2,hy+9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a75d3';
    ctx.beginPath();
    ctx.moveTo(hx-5,hy+9); ctx.lineTo(hx+5,hy+9); ctx.lineTo(hx+7,34); ctx.lineTo(hx-7,34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1d5aa8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hx-3,hy+15); ctx.lineTo(hx+1,hy+22); ctx.stroke();
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(hx+1,hy+22,1.5,0,Math.PI*2); ctx.fill();
    let la = 0, ra = 0;
    if (frameIdx > 0) { la = Math.sin(frameIdx*1.15)*0.45; ra = -Math.sin(frameIdx*1.15)*0.45; }
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    let lx = hx-3+Math.sin(la)*9, ly = 34+Math.cos(la)*9;
    ctx.beginPath(); ctx.moveTo(hx-3,34); ctx.lineTo(lx,ly); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(lx,ly+1.5,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cc2222'; ctx.fillRect(lx-2.2,ly+0.5,4.4,1.5);
    let rx = hx+3+Math.sin(ra)*9, ry = 34+Math.cos(ra)*9;
    ctx.beginPath(); ctx.moveTo(hx+3,34); ctx.lineTo(rx,ry); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(rx,ry+1.5,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cc2222'; ctx.fillRect(rx-2.2,ry+0.5,4.4,1.5);
  }

  drawRobotFrame(ctx, frameIdx, xOffset) {
    let cx = xOffset + 24;
    let cy = 10;

    // Head (boxy)
    ctx.fillStyle = '#442200';
    ctx.fillRect(cx - 8, cy, 16, 12);
    ctx.strokeStyle = '#220e00'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 8, cy, 16, 12);

    // Visor (glowing orange eye)
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(cx - 4, cy + 3, 8, 4);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(cx - 2, cy + 4, 4, 2);

    // Antenna
    ctx.strokeStyle = '#885500'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 6); ctx.stroke();
    ctx.fillStyle = '#ff4400'; ctx.beginPath(); ctx.arc(cx, cy - 7, 2, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = '#331500';
    ctx.fillRect(cx - 9, cy + 12, 18, 16);
    ctx.strokeStyle = '#220e00'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 9, cy + 12, 18, 16);

    // Chest panel
    ctx.fillStyle = '#1a0900'; ctx.fillRect(cx - 5, cy + 15, 10, 6);
    ctx.fillStyle = frameIdx < 2 ? '#ff2200' : '#ff8800';
    ctx.beginPath(); ctx.arc(cx, cy + 18, 2, 0, Math.PI * 2); ctx.fill();

    // Arms with animation
    let armSwing = Math.sin(frameIdx * (Math.PI / 2)) * 4;
    ctx.strokeStyle = '#442200'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 9, cy + 15); ctx.lineTo(cx - 14, cy + 22 + armSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 9, cy + 15); ctx.lineTo(cx + 14, cy + 22 - armSwing); ctx.stroke();

    // Legs with walk cycle
    let legSwing = Math.sin(frameIdx * (Math.PI / 2)) * 5;
    ctx.strokeStyle = '#331500'; ctx.lineWidth = 5;
    let llx = cx - 4 + legSwing * 0.3;
    let lly = cy + 28 + Math.cos(frameIdx * (Math.PI / 2)) * 5;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy + 28); ctx.lineTo(llx, lly + 8); ctx.stroke();
    ctx.fillStyle = '#553300'; ctx.fillRect(llx - 4, lly + 6, 8, 4);

    let rlx = cx + 4 - legSwing * 0.3;
    let rly = cy + 28 - Math.cos(frameIdx * (Math.PI / 2)) * 5;
    ctx.beginPath(); ctx.moveTo(cx + 4, cy + 28); ctx.lineTo(rlx, rly + 8); ctx.stroke();
    ctx.fillStyle = '#553300'; ctx.fillRect(rlx - 4, rly + 6, 8, 4);
  }
}

// Config
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scale: { mode: Phaser.Scale.FIT },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 1000 }, debug: false }
  },
  scene: [Scene2]
};

const game = new Phaser.Game(config);