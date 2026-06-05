// ==========================================
// SCENARIO 2: ZONA INDUSTRIAL ASFIXIANTE
// ==========================================
// Paleta: naranjas tóxicos, grises metálicos, humo denso, luces eléctricas parpadeantes
// Enemigos: drones de vigilancia (en lugar de arañas)
// Mecánicas nuevas: gas tóxico, plataformas eléctricas, válvulas de vapor
// ==========================================

class Scene2 extends Phaser.Scene {
  constructor() {
    super({ key: 'Scene2' });
  }

  init() {
    this.liftActive       = false;
    this.platePressed     = false;
    this.plate2Pressed    = false;
    this.valveOpen        = false;   // Valve 1 (steam vent cover)
    this.isDead           = false;
    this.levelComplete    = false;
    this.gasWarningShown  = false;
    this.currentCheckpoint = { x: 150, y: 400 };

    // Electric-platform flash state
    this._electricTimer   = 0;
    this._electricOn      = true;   // Electric platform is lethal when true
  }

  preload() {
    this.load.tilemapTiledJSON('mapa_escenario2', './mapa_escenario2.json');
    // Use same song key as scene 1 to avoid double-loading; operator can swap file
    this.load.audio('ambient_song2', './song.mp3');
  }

  create() {
    this.createProceduralTextures();

    // ── 1. Map dimensions ──────────────────────────────────────────────────
    const TW = 64, TH = 64, COLS = 80, ROWS = 10;
    const mapW = COLS * TW, mapH = ROWS * TH;
    this.physics.world.setBounds(0, 0, mapW, mapH);

    // ── 2. Parallax background: factory silhouettes ────────────────────────
    this.createParallaxBackground(mapW, mapH);

    // ── 3. Tilemap ─────────────────────────────────────────────────────────
    const map    = this.make.tilemap({ key: 'mapa_escenario2' });
    const tileset = map.addTilesetImage('background', 'tileset_s2', 64, 64, 0, 0);
    const layer  = map.createLayer('Capa de patrones 1', tileset, 0, 0);
    this.layer   = layer;

    // Build grid
    let grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));

    // ── Ground baseline (row 8 = surface, row 9 = metal floor) ────────────
    for (let x = 0; x < COLS; x++) {
      // Pit 1: cols 10-15 (toxic gas pit)
      if (x >= 10 && x <= 15) {
        grid[8][x] = 3;  // Gas tile (orange grate)
        grid[9][x] = 2;
        continue;
      }
      // Pit 2: cols 38-42 (bottomless shaft)
      if (x >= 38 && x <= 42) {
        grid[8][x] = 0;
        grid[9][x] = 0;
        continue;
      }
      // Pit 3: cols 60-68 (electric floor pit)
      if (x >= 60 && x <= 68) {
        grid[8][x] = 0;
        grid[9][x] = 0;
        continue;
      }
      grid[8][x] = 1;  // Metal floor top
      grid[9][x] = 2;  // Metal floor fill
    }

    // ── Wall / obstacle before gas pit ────────────────────────────────────
    grid[7][8]  = 4; grid[6][8]  = 4;
    grid[7][9]  = 4; grid[6][9]  = 4;

    // ── Elevated platform for valve (cols 5-7, row 5) ─────────────────────
    grid[5][5] = 1; grid[5][6] = 1; grid[5][7] = 1;

    // ── Tunnel section 1 (ceiling cols 18-32, rows 3-4) ───────────────────
    for (let x = 18; x <= 32; x++) {
      grid[4][x] = 4;
      grid[3][x] = 2;
      grid[2][x] = 2;
    }

    // ── Mid platforms for shaft jump (cols 35-36 and 43-44) ───────────────
    grid[7][35] = 1; grid[7][36] = 1;
    grid[6][43] = 1; grid[6][44] = 1;

    // ── Tunnel section 2 (ceiling cols 45-57, rows 4-5) ───────────────────
    for (let x = 45; x <= 57; x++) {
      grid[5][x] = 4;
      grid[4][x] = 2;
      grid[3][x] = 2;
    }
    // Pressure plate alcove (clear row 8 at col 53)
    grid[8][53] = 0;

    // ── Electric platforms over pit (cols 60-68, staggered heights) ───────
    grid[7][61] = 5;  // Electric (deadly when on)
    grid[6][63] = 5;
    grid[6][65] = 5;
    grid[7][67] = 5;

    // ── Right-side wall forcing exit through door ─────────────────────────
    for (let y = 0; y < 8; y++) grid[y][79] = 4;

    // Write to tilemap + spawn pipe/rivet decorations
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] !== 0) {
          layer.putTileAt(grid[y][x], x, y);

          // Random rivets on metal floor
          if (grid[y][x] === 1 && Math.random() < 0.3) {
            let rivet = this.add.image(x * TW + 8 + Math.random() * 48, y * TH + 4, 'rivet');
            rivet.setOrigin(0.5, 0);
            rivet.setDepth(7);
          }
        }
      }
    }

    layer.setCollision([1, 2, 4]);

    // Gas tile callback (row 8, cols 10-15)
    layer.setTileIndexCallback(3, (sprite) => {
      if (sprite === this.player) this.playerDie();
    }, this);

    // Electric platforms (tile index 5)
    // Comportamiento deseado:
    // - Si están ON: puedes pisarlas sin morir.
    // - Si están OFF: si estás encima (tocar tile), mueres.
    //   (El movimiento/caída ya se maneja con colisiones y out-of-bounds.)
    layer.setTileIndexCallback(5, (sprite) => {
      if (sprite === this.player && !this._electricOn) this.playerDie();
    }, this);



    // ── 4. Background smoke ────────────────────────────────────────────────
    this.createSmokeLayer(10, 0.04, 0.35);

    // ── 5. Puzzle objects ──────────────────────────────────────────────────
    this.crates = this.physics.add.group();

    // Crate 1 (push over gas pit via lift)
    this.crate1 = this.physics.add.sprite(3 * TW + 32, 7 * TH, 'crate');
    this.crate1.setCollideWorldBounds(true);
    this.crate1.setDragX(4500);
    this.crate1.setBounce(0);
    this.crate1.setMass(4);
    this.crates.add(this.crate1);

    // Crate 2 (inside first tunnel, used for gate 1)
    this.crate2 = this.physics.add.sprite(22 * TW + 32, 7 * TH, 'crate');
    this.crate2.setCollideWorldBounds(true);
    this.crate2.setDragX(4500);
    this.crate2.setBounce(0);
    this.crate2.setMass(4);
    this.crates.add(this.crate2);

    // Crate 3 (left side of shaft, used for plate 2 later)
    this.crate3 = this.physics.add.sprite(34 * TW + 32, 7 * TH, 'crate');
    this.crate3.setCollideWorldBounds(true);
    this.crate3.setDragX(4500);
    this.crate3.setBounce(0);
    this.crate3.setMass(4);
    this.crates.add(this.crate3);

    // Valve (replaces lever 1) - opens steam vent cover over gas pit
    this.valve = this.physics.add.sprite(6 * TW, 5 * TH - 16, 'valve', '0');
    this.valve.body.setAllowGravity(false);
    this.valve.body.setImmovable(true);

    // Steam vent cover (acts like trapdoor but over gas pit as a bridge)
    this.ventCover = this.physics.add.sprite(12.5 * TW, 8 * TH - 8, 'lift');
    this.ventCover.body.setAllowGravity(false);
    this.ventCover.body.setImmovable(true);
    this.ventCover.setDisplaySize(TW * 6, 16);  // Cover all gas tiles

    // Lift (moving platform over gas pit)
    this.liftStartX = 10 * TW + 32;
    this.liftEndX   = 15 * TW + 32;
    this.lift = this.physics.add.sprite(this.liftStartX, 6 * TH + 16, 'lift');
    this.lift.body.setAllowGravity(false);
    this.lift.body.setImmovable(true);

    // Gate 1 (end of tunnel 1)
    this.gate = this.physics.add.sprite(32 * TW + 16, 7 * TH - 64, 'gate');
    this.gate.body.setAllowGravity(false);
    this.gate.body.setImmovable(true);

    // Pressure plate 1 (inside tunnel 1, triggers gate 1)
    this.plate = this.physics.add.sprite(27 * TW + 32, 8 * TH - 8, 'button', '0');
    this.plate.body.setAllowGravity(false);
    this.plate.body.setImmovable(true);

    // Lever 2 (left of shaft, activates lift over shaft)
    this.lever2 = this.physics.add.sprite(35 * TW + 32, 7 * TH - 16, 'valve', '0');
    this.lever2.body.setAllowGravity(false);
    this.lever2.body.setImmovable(true);
    this._lever2Active = false;

    // Shaft lift (moves over pit cols 38-42)
    this.shaftLiftStartX = 38 * TW + 32;
    this.shaftLiftEndX   = 42 * TW + 32;
    this.shaftLift = this.physics.add.sprite(this.shaftLiftStartX, 7 * TH - 8, 'lift');
    this.shaftLift.body.setAllowGravity(false);
    this.shaftLift.body.setImmovable(true);
    this.shaftLift.setDisplaySize(TW * 2, 16);

    // Pressure plate 2 (inside tunnel 2, triggers gate 2)
    this.plate2 = this.physics.add.sprite(53 * TW + 32, 8 * TH - 8, 'button', '0');
    this.plate2.body.setAllowGravity(false);
    this.plate2.body.setImmovable(true);

    // Gate 2 (end of tunnel 2)
    this.gate2 = this.physics.add.sprite(57 * TW + 16, 7 * TH - 64, 'gate');
    this.gate2.body.setAllowGravity(false);
    this.gate2.body.setImmovable(true);

    // Exit door
    this.exitDoor = this.physics.add.sprite(76 * TW + 32, 8 * TH - 48, 'exit');
    this.exitDoor.body.setAllowGravity(false);
    this.exitDoor.body.setImmovable(true);

    // Colliders
    this.physics.add.collider(this.crates, layer);
    this.physics.add.collider(this.crates, this.ventCover);
    this.physics.add.collider(this.crates, this.shaftLift);

    // ── 6. Player ──────────────────────────────────────────────────────────
    this.player = this.physics.add.sprite(
      this.currentCheckpoint.x, this.currentCheckpoint.y, 'player_procedural', '0'
    );
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(24, 44);
    this.player.body.setOffset(12, 4);

    this.physics.add.collider(this.player, layer);
    this.physics.add.overlap(this.player, layer);
    this.physics.add.collider(this.player, this.ventCover);
    this.physics.add.collider(this.player, this.lift);
    this.physics.add.collider(this.player, this.shaftLift);
    this.physics.add.collider(this.player, this.gate);
    this.physics.add.collider(this.player, this.gate2);
    this.physics.add.collider(this.crates, this.gate);
    this.physics.add.collider(this.crates, this.gate2);
    this.physics.add.collider(this.player, this.crates, (player, crate) => {
      if (player.body.touching.down && crate.body.touching.up) return;
      if (player.body.touching.right && crate.body.touching.left)
        crate.setVelocityX(player.body.velocity.x * 0.75);
      else if (player.body.touching.left && crate.body.touching.right)
        crate.setVelocityX(player.body.velocity.x * 0.75);
    });

    // ── 7. Animations ──────────────────────────────────────────────────────
    if (!this.anims.exists('walk')) {
      this.anims.create({
        key: 'walk',
        frames: [0,1,2,3,4,5].map(f => ({ key: 'player_procedural', frame: String(f) })),
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
    if (!this.anims.exists('drone_fly')) {
      this.anims.create({
        key: 'drone_fly',
        frames: [0,1,2,3].map(f => ({ key: 'drone_procedural', frame: String(f) })),
        frameRate: 12,
        repeat: -1
      });
    }

    // ── 8. Drones (surveillance enemies) ──────────────────────────────────
    this.drones = this.physics.add.group();

    // Drone 1: patrols near valve platform
    let d1 = this.physics.add.sprite(7 * TW, 4 * TH, 'drone_procedural', '0');
    d1.setData({ startX: 7 * TW, startY: 4 * TH, range: 80, dir: 1, alerted: false, alertTimer: 0 });
    d1.body.setAllowGravity(false);
    this.drones.add(d1);

    // Drone 2: patrols inside first tunnel
    let d2 = this.physics.add.sprite(24 * TW, 6 * TH, 'drone_procedural', '0');
    d2.setData({ startX: 24 * TW, startY: 6 * TH, range: 200, dir: -1, alerted: false, alertTimer: 0 });
    d2.body.setAllowGravity(false);
    this.drones.add(d2);

    // Drone 3: hovering near shaft (intimidation)
    let d3 = this.physics.add.sprite(40 * TW, 5 * TH, 'drone_procedural', '0');
    d3.setData({ startX: 40 * TW, startY: 5 * TH, range: 60, dir: 1, alerted: false, alertTimer: 0 });
    d3.body.setAllowGravity(false);
    this.drones.add(d3);

    // Drone 4: herding drone in second tunnel
    this.herdDrone = this.physics.add.sprite(47 * TW, 6 * TH, 'drone_procedural', '0');
    this.herdDrone.setData({ startX: 47 * TW, startY: 6 * TH, range: 60, dir: 1, alerted: false, alertTimer: 0 });
    this.herdDrone.body.setAllowGravity(false);
    this.drones.add(this.herdDrone);

    this.physics.add.overlap(this.player, this.drones, this.playerDie, null, this);

    // ── 9. Electric sparks particle graphics (reused as sprite emitter) ───
    this.sparkGraphics = this.add.graphics();
    this.sparkGraphics.setDepth(20);
    this._sparkTimer = 0;

    // ── 10. Pipe decorations ───────────────────────────────────────────────
    this.createPipeDecorations(mapW);

    // ── 11. Camera ────────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor('#0d0a05');

    // Foreground smoke
    this.createSmokeLayer(90, 0.10, 0.5);

    // ── 12. Input ─────────────────────────────────────────────────────────
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

    // ── 13. UI ────────────────────────────────────────────────────────────
    this.titleText = this.add.text(400, 250,
      'ESCENARIO 2: ZONA INDUSTRIAL', {
        fontFamily: '"Special Elite", "Courier New", Courier, monospace',
        fontSize: '28px', color: '#ff7700', align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.subtitleText = this.add.text(400, 310,
      'El humo lo ciega. Las máquinas no duermen.', {
        fontFamily: '"Special Elite", "Courier New", Courier, monospace',
        fontSize: '14px', color: '#aa5500', align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.tweens.add({
      targets: [this.titleText, this.subtitleText],
      alpha: 0, delay: 3500, duration: 1500,
      onComplete: () => { this.titleText.destroy(); this.subtitleText.destroy(); }
    });

    this.hintText = this.add.text(400, 50, '', {
      fontFamily: '"Special Elite", "Courier New", Courier, monospace',
      fontSize: '16px', color: '#ffaa00',
      backgroundColor: '#1a0a00', padding: { x: 10, y: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);

    this.victoryText = this.add.text(400, 300,
      'ESCENARIO 2 COMPLETADO\n\nHas sobrevivido la zona industrial.', {
        fontFamily: '"Special Elite", "Courier New", Courier, monospace',
        fontSize: '24px', color: '#ff9900', align: 'center',
        backgroundColor: '#0a0500', padding: { x: 20, y: 20 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setVisible(false);

    // Gas warning overlay
    this.gasOverlay = this.add.rectangle(400, 300, 800, 600, 0xff5500, 0)
      .setScrollFactor(0).setDepth(150);

    // ── 14. Music ─────────────────────────────────────────────────────────
    let music = this.sound.get('ambient_song2');
    if (!music) {
      music = this.sound.add('ambient_song2', { loop: true, volume: 0.35 });
      music.play();
    } else if (!music.isPlaying) {
      music.play();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE LOOP
  // ══════════════════════════════════════════════════════════════════════════
  update(time, delta) {
    if (Phaser.Input.Keyboard.JustDown(this.wasd.reset)) {
      this.scene.restart();
      return;
    }
    if (this.isDead || this.levelComplete) return;

    // ── 1. Player movement ────────────────────────────────────────────────
    const speed = 160;
    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      this.player.setVelocityX(-speed);
      this.player.anims.play('walk', true);
      this.player.flipX = true;
      if (this.player.body.blocked.down && Math.random() < 0.12)
        this.createMetalSpark(this.player.x + 8, this.player.y + 20, 0x884400);
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      this.player.setVelocityX(speed);
      this.player.anims.play('walk', true);
      this.player.flipX = false;
      if (this.player.body.blocked.down && Math.random() < 0.12)
        this.createMetalSpark(this.player.x - 8, this.player.y + 20, 0x884400);
    } else {
      this.player.setVelocityX(0);
      this.player.anims.play('idle', true);
    }

    if ((this.cursors.up.isDown || this.wasd.up.isDown) && this.player.body.blocked.down) {
      this.player.setVelocityY(-580);
      this.createMetalSpark(this.player.x, this.player.y + 20, 0x886600);
    }

    // ── 2. Out of bounds ──────────────────────────────────────────────────
    if (this.player.y > 640) this.playerDie();

    // ── 3. Checkpoints ────────────────────────────────────────────────────
    if (this.player.x > 1200 && this.currentCheckpoint.x < 1200) {
      this.currentCheckpoint = { x: 1250, y: 400 };
      this.showTemporaryHint('Punto de control 1 alcanzado.');
    }
    if (this.player.x > 2600 && this.currentCheckpoint.x < 2600) {
      this.currentCheckpoint = { x: 2650, y: 400 };
      this.showTemporaryHint('Punto de control 2 alcanzado.');
    }

    // ── 4. Valve 1 (puzzle 1: require hold-to-start) ─────────────────────
    let dV = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.valve.x, this.valve.y
    );

    // Init hold timer state once
    if (this._valveHoldMs === undefined) this._valveHoldMs = 0;

    const withinValve = dV < 55;
    const isHolding = withinValve && (this.wasd.enter.isDown || this.wasd.space.isDown);

    if (!this.liftActive) {
      if (withinValve) {
        this.hintText.setText('[ENTER] Mantén 1.2s para abrir el vapor');
        this.hintText.setVisible(true);

        if (isHolding) {
          this._valveHoldMs += delta;
          // progress feedback using alpha pulse
          let t = Phaser.Math.Clamp(this._valveHoldMs / 1200, 0, 1);
          this.valve.setAlpha(0.6 + t * 0.4);
          if (t >= 1) {
            this.liftActive = true;
            this.valve.setFrame('1');
            this.valve.setAlpha(1);
            this.cameras.main.flash(200, 255, 100, 0);
            this.showTemporaryHint('Válvula abierta — elevador en marcha.');
            this.lift.setVelocityX(70);

            // Vent steam visual
            for (let i = 0; i < 6; i++) {
              this.time.delayedCall(i * 80, () => {
                this.createMetalSpark(12 * 64 + Math.random() * 64, 8 * 64, 0xffaa00);
              });
            }
          }
        } else {
          // stopped holding
          if (this._valveHoldMs > 0) {
            this._valveHoldMs = 0;
            this.valve.setAlpha(1);
          }
        }
      } else {
        // out of range: reset hold and clear hint
        this._valveHoldMs = 0;
        this.valve.setAlpha(1);

        if (this.hintText.visible &&
            !this.hintText.text.includes('Punto') &&
            !this.hintText.text.includes('Portón') &&
            !this.hintText.text.includes('activa') &&
            !this.hintText.text.includes('válvula') &&
            !this.hintText.text.includes('shaft')) {
          this.hintText.setVisible(false);
        }
      }
    } else {
      // already active
      if (withinValve) {
        this.hintText.setText('Válvula activa');
        this.hintText.setVisible(true);
      }
      this._valveHoldMs = 0;
      this.valve.setAlpha(1);
    }


    // Moving lift patrol
    if (this.liftActive) {
      if (this.lift.x >= this.liftEndX) this.lift.setVelocityX(-70);
      else if (this.lift.x <= this.liftStartX) this.lift.setVelocityX(70);
    }

    // ── 5. Gas zone warning (near gas tiles) ──────────────────────────────
    let nearGas = (this.player.x > 9 * 64 && this.player.x < 16 * 64 &&
                   this.player.y > 5 * 64);
    if (nearGas) {
      this.tweens.add({
        targets: this.gasOverlay,
        alpha: 0.08 + Math.sin(time * 0.005) * 0.04,
        duration: 200,
        overwrite: true
      });
      if (!this.gasWarningShown) {
        this.gasWarningShown = true;
        this.showTemporaryHint('⚠ Gas tóxico — ¡no toques el suelo!');
      }
    } else {
      this.gasOverlay.setAlpha(0);
    }

    // ── 6. Pressure plate 1 & Gate 1 ─────────────────────────────────────
    let crateOnPlate = false;
    this.crates.getChildren().forEach(c => {
      if (Phaser.Geom.Intersects.RectangleToRectangle(c.getBounds(), this.plate.getBounds()))
        crateOnPlate = true;
    });
    if (crateOnPlate) {
      if (!this.platePressed) {
        this.platePressed = true;
        this.plate.setFrame('1');
        this.cameras.main.shake(150, 0.005);
        this.showTemporaryHint('Compuerta industrial 1 abriéndose...');
        this.tweens.add({
          targets: this.gate, y: 7 * 64 - 180, duration: 1000, ease: 'Cubic.easeOut',
          onComplete: () => { this.gate.body.enable = false; }
        });
      }
    } else {
      if (this.platePressed) {
        this.platePressed = false;
        this.plate.setFrame('0');
        this.gate.body.enable = true;
        this.cameras.main.shake(100, 0.004);
        this.tweens.add({
          targets: this.gate, y: 7 * 64 - 64, duration: 600, ease: 'Bounce.easeOut'
        });
      }
    }

    // ── 7. Lever 2 replaced: shaft lift activates automatically when Gate 1 is open ──
    // (Gate 1 becomes disabled (body.enable=false) when plate 1 is pressed)
    if (this.platePressed && !this._lever2Active) {
      this._lever2Active = true;
      this.lever2.setFrame('1');
      this.cameras.main.flash(200, 255, 100, 0);
      this.showTemporaryHint('Puente del eje activado (por compuerta 1).');
      this.shaftLift.setVelocityX(60);
    }

    // Shaft lift patrol
    if (this._lever2Active) {
      if (this.shaftLift.x >= this.shaftLiftEndX)
        this.shaftLift.setVelocityX(-60);
      else if (this.shaftLift.x <= this.shaftLiftStartX)
        this.shaftLift.setVelocityX(60);
    }


    // ── 8. Pressure plate 2 (drone herding) & Gate 2 ──────────────────────
    let droneOnPlate2 = false;
    this.drones.getChildren().forEach(d => {
      if (Phaser.Geom.Intersects.RectangleToRectangle(d.getBounds(), this.plate2.getBounds()))
        droneOnPlate2 = true;
    });
    if (droneOnPlate2) {
      if (!this.plate2Pressed) {
        this.plate2Pressed = true;
        this.plate2.setFrame('1');
        this.cameras.main.shake(150, 0.005);
        this.showTemporaryHint('Compuerta industrial 2 abriéndose...');
        this.tweens.add({
          targets: this.gate2, y: 7 * 64 - 180, duration: 1000, ease: 'Cubic.easeOut',
          onComplete: () => { this.gate2.body.enable = false; }
        });
      }
    } else {
      if (this.plate2Pressed) {
        this.plate2Pressed = false;
        this.plate2.setFrame('0');
        this.gate2.body.enable = true;
        this.cameras.main.shake(100, 0.004);
        this.tweens.add({
          targets: this.gate2, y: 7 * 64 - 64, duration: 600, ease: 'Bounce.easeOut'
        });
      }
    }

    // ── 9. Drone AI ───────────────────────────────────────────────────────
    this.drones.getChildren().forEach(drone => {
      let spotted = this.checkIfSpotted(drone);
      let alerted = drone.getData('alerted');

      drone.anims.play('drone_fly', true);

      // Hover bob
      drone.y = drone.getData('startY') + Math.sin(time * 0.002 + drone.getData('startX')) * 8;

      if (spotted) {
        drone.setData('alerted', true);
        drone.setData('alertTimer', 90);
        let dir = drone.x > this.player.x ? 1 : -1;
        drone.setVelocityX(dir * 220);
        drone.setTint(0xff4400);
        drone.flipX = dir < 0;
        if (Math.random() < 0.2)
          this.createMetalSpark(drone.x, drone.y + 12, 0xff6600);
      } else {
        let timer = (drone.getData('alertTimer') || 0);
        if (timer > 0) {
          drone.setData('alertTimer', timer - 1);
        } else {
          drone.setData('alerted', false);
          drone.clearTint();
          let vx = drone.body.velocity.x;
          if (Math.abs(vx) !== 60) vx = drone.getData('dir') * 60;
          let sx = drone.getData('startX'), r = drone.getData('range');
          if (drone.x <= sx - r) { drone.setVelocityX(60); drone.setData('dir', 1); drone.flipX = false; }
          else if (drone.x >= sx + r) { drone.setVelocityX(-60); drone.setData('dir', -1); drone.flipX = true; }
          else drone.setVelocityX(vx);
        }
      }
    });

    // ── 10. Electric platform flicker ─────────────────────────────────────
    this._electricTimer += delta;
    // Cycle: 1800ms ON, 700ms OFF
    const cycle = 2500;
    const onTime = 1800;
    let phase = this._electricTimer % cycle;
    let wasOn = this._electricOn;
    this._electricOn = phase < onTime;
    if (this._electricOn !== wasOn) {
      // Visual feedback: tint electric tiles
      let tint = this._electricOn ? 0xffcc00 : 0x224422;
      [61, 63, 65, 67].forEach(tx => {
        let row = (tx === 61 || tx === 67) ? 7 : 6;
        let tile = this.layer.getTileAt(tx, row);
        if (tile) tile.tint = tint;
      });
      this.cameras.main.flash(80, 255, 200, 0, false);
    }

    // ── 11. Spark emitter on electric platforms (when ON) ─────────────────
    if (this._electricOn) {
      this._sparkTimer += delta;
      if (this._sparkTimer > 180) {
        this._sparkTimer = 0;
        [61, 63, 65, 67].forEach(tx => {
          this.createMetalSpark(tx * 64 + Math.random() * 64, 6 * 64, 0xffee00);
        });
      }
    }

    // ── 12. Victory check ─────────────────────────────────────────────────
    let distExit = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.exitDoor.x, this.exitDoor.y
    );
    if (distExit < 40) this.triggerVictory();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  // Drone detection cone (shorter, cone-shaped, uses searchlight metaphor)
  checkIfSpotted(drone) {
    let dx = this.player.x - drone.x;
    let dy = this.player.y - drone.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 200) return false;
    // Drones look downward — mostly detect players below them
    let angle = Math.atan2(dy, dx); // positive y = downward
    // Downward cone: ±60° from straight down (Math.PI/2)
    let downAngle = Math.PI / 2;
    let diff = Math.abs(angle - downAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    return diff < 1.1; // ~63°
  }

  playerDie() {
    if (this.isDead) return;
    this.isDead = true;
    this.cameras.main.shake(250, 0.015);
    this.cameras.main.flash(150, 255, 80, 0);
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
          this.resetDrones();
        });
      }
    });
  }

  resetDrones() {
    this.drones.getChildren().forEach(d => {
      d.setPosition(d.getData('startX'), d.getData('startY'));
      d.setVelocity(d.getData('dir') * 60, 0);
      d.setAlpha(1);
      d.setData('alerted', false);
      d.setData('alertTimer', 0);
      d.clearTint();
    });
  }

  triggerVictory() {
    if (this.levelComplete) return;
    this.levelComplete = true;
    this.player.setVelocity(0, 0);
    this.player.body.enable = false;
    this.player.anims.play('idle', true);
    this.victoryText.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.victoryText, alpha: 1, duration: 800 });
    this.tweens.add({ targets: this.cameras.main, zoom: 1.1, duration: 2000, ease: 'Quad.easeInOut' });
    this.time.delayedCall(4000, () => {
      this.cameras.main.fade(1500, 0, 0, 0, false, (cam, prog) => {
        // → Swap for: window.location.href = 'escenario3.html'; when ready
        if (prog === 1) this.scene.restart();
      });
    });
  }

  showTemporaryHint(text) {
    this.hintText.setText(text).setVisible(true);
    if (this.hintTimer) this.hintTimer.remove();
    this.hintTimer = this.time.delayedCall(3000, () => this.hintText.setVisible(false));
  }

  createMetalSpark(x, y, tint = 0xff8800) {
    let spark = this.add.image(x, y, 'spark');
    spark.setTint(tint);
    spark.setAlpha(0.9);
    spark.setScale(0.4 + Math.random() * 0.4);
    spark.setDepth(25);
    this.tweens.add({
      targets: spark,
      x: x + (Math.random() - 0.5) * 24,
      y: y - 12 - Math.random() * 16,
      alpha: 0,
      scale: 0.1,
      duration: 280 + Math.random() * 150,
      onComplete: () => spark.destroy()
    });
  }

  // ── Background: factory silhouettes ───────────────────────────────────────
  createParallaxBackground(width, height) {
    const layers = [
      { scrollFactor: 0.1, count: 8,  alpha: 0.14, depth: 2 },
      { scrollFactor: 0.35,count: 12, alpha: 0.30, depth: 4 },
      { scrollFactor: 0.65,count: 10, alpha: 0.55, depth: 6 }
    ];
    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        let tx = (width / layer.count) * i + Math.random() * 80;
        let img = this.add.image(tx, 480, 'factory_silhouette');
        img.setOrigin(0.5, 1);
        img.setScrollFactor(layer.scrollFactor);
        img.setDepth(layer.depth);
        img.setAlpha(layer.alpha);
        img.setScale(0.9 + Math.random() * 0.6);
        img.setTint(0x1a0d00);
      }
    });
  }

  // ── Smoke instead of fog ───────────────────────────────────────────────────
  createSmokeLayer(depth, speedXFactor, alphaMax) {
    const emitter = this.add.particles(0, 0, 'smoke', {
      x: { min: -100, max: 900 },
      y: { min: 150, max: 560 },
      quantity: 1,
      frequency: 320,
      lifespan: 10000,
      scale: { min: 2.5, max: 5.5 },
      alpha: { start: 0, end: alphaMax, ease: 'Sine.easeInOut' },
      speedX: { min: 15 * speedXFactor, max: 30 * speedXFactor },
      speedY: { min: -6, max: -2 },
      tint: [0x331a00, 0x221100, 0x442200],
      rotate: { min: -30, max: 30 }
    });
    emitter.setScrollFactor(0);
    emitter.setDepth(depth);
  }

  // ── Pipe decorations on walls ─────────────────────────────────────────────
  createPipeDecorations(mapW) {
    const pipePositions = [
      { x: 18 * 64, y: 5 * 64 }, { x: 22 * 64, y: 5 * 64 },
      { x: 28 * 64, y: 5 * 64 }, { x: 45 * 64, y: 6 * 64 },
      { x: 50 * 64, y: 6 * 64 }, { x: 55 * 64, y: 6 * 64 }
    ];
    pipePositions.forEach(p => {
      let pipe = this.add.image(p.x, p.y, 'pipe');
      pipe.setOrigin(0.5, 1);
      pipe.setDepth(7);
      pipe.setTint(0x331100);

      // Occasional steam puff from each pipe
      if (Math.random() < 0.5) {
        this.time.addEvent({
          delay: 2000 + Math.random() * 3000,
          loop: true,
          callback: () => {
            for (let i = 0; i < 4; i++) {
              this.time.delayedCall(i * 60, () => {
                this.createMetalSpark(p.x + Math.random() * 16, p.y - 8, 0xddaa66);
              });
            }
          }
        });
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROCEDURAL TEXTURES
  // ══════════════════════════════════════════════════════════════════════════
  createProceduralTextures() {
    if (this.textures.exists('crate')) return; // shared textures already exist

    const make = (key, w, h, fn) => {
      let t = this.textures.createCanvas(key, w, h);
      fn(t.context);
      t.refresh();
    };

    // ── Reused from S1 (same keys, Phaser won't re-create) ─────────────────
    make('crate', 64, 64, ctx => {
      ctx.fillStyle = '#1a1000'; ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#050200'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 60, 60);
      ctx.strokeStyle = '#332200'; ctx.lineWidth = 2; ctx.strokeRect(6, 6, 52, 52);
      ctx.strokeStyle = '#050200'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(8,8); ctx.lineTo(56,56);
      ctx.moveTo(56,8); ctx.lineTo(8,56); ctx.stroke();
    });

    make('lift', 96, 16, ctx => {
      ctx.fillStyle = '#1a0a00'; ctx.fillRect(0, 0, 96, 16);
      ctx.fillStyle = '#4a2a00'; ctx.fillRect(0, 0, 96, 4);
      ctx.fillStyle = '#2a1500';
      for (let i = 0; i < 96; i += 16) {
        ctx.beginPath(); ctx.moveTo(i,4); ctx.lineTo(i+8,4);
        ctx.lineTo(i+16,16); ctx.lineTo(i+8,16); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = '#050200'; ctx.lineWidth = 2; ctx.strokeRect(1,1,94,14);
    });

    make('gate', 32, 128, ctx => {
      ctx.fillStyle = '#100800'; ctx.fillRect(0, 0, 32, 128);
      ctx.fillStyle = '#2a1800';
      ctx.fillRect(4,0,5,128); ctx.fillRect(13,0,5,128); ctx.fillRect(23,0,5,128);
      ctx.fillStyle = '#1a0d00';
      ctx.fillRect(0,12,32,8); ctx.fillRect(0,60,32,8); ctx.fillRect(0,108,32,8);
    });

    make('exit', 64, 96, ctx => {
      ctx.fillStyle = '#100800';
      ctx.beginPath(); ctx.moveTo(8,96); ctx.lineTo(8,36);
      ctx.arc(32,36,24,Math.PI,0); ctx.lineTo(56,96); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff7700'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(8,96); ctx.lineTo(8,36);
      ctx.arc(32,36,24,Math.PI,0); ctx.lineTo(56,96); ctx.stroke();
      ctx.fillStyle = '#ff9900'; ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center'; ctx.fillText('SALIDA', 32, 50);
    });

    // ── S2-specific fog/smoke texture ──────────────────────────────────────
    make('smoke', 128, 128, ctx => {
      let g = ctx.createRadialGradient(64,64,0,64,64,64);
      g.addColorStop(0, 'rgba(80,40,0,0.18)');
      g.addColorStop(0.5, 'rgba(60,30,0,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(64,64,64,0,Math.PI*2); ctx.fill();
    });

    // ── Industrial tileset ──────────────────────────────────────────────────
    // Tile 1: Metal grating floor top
    // Tile 2: Solid metal fill
    // Tile 3: Gas vent (orange glow)
    // Tile 4: Concrete wall
    // Tile 5: Electric platform (yellow pulse)
    make('tileset_s2', 320, 64, ctx => {
      // Tile 1: Metal grating
      ctx.fillStyle = '#1a1000'; ctx.fillRect(0,0,64,64);
      ctx.strokeStyle = '#3a2000'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 64; i += 8) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,64); ctx.stroke();
      }
      ctx.fillStyle = '#4a3000'; ctx.fillRect(0,0,64,5);
      ctx.strokeStyle = '#5a4000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0,5); ctx.lineTo(64,5); ctx.stroke();

      // Tile 2: Solid metal fill
      ctx.fillStyle = '#100c00'; ctx.fillRect(64,0,64,64);
      ctx.strokeStyle = '#1e1600'; ctx.lineWidth = 1;
      ctx.strokeRect(64.5,0.5,63,63);
      ctx.fillStyle = '#1a1200';
      for (let i = 0; i < 12; i++)
        ctx.fillRect(64 + Math.random()*60, Math.random()*60, 2, 2);

      // Tile 3: Gas vent (deadly orange)
      ctx.fillStyle = '#200a00'; ctx.fillRect(128,0,64,64);
      ctx.fillStyle = '#ff5500';
      for (let i = 0; i < 4; i++) {
        let sx = 128 + i * 16;
        ctx.beginPath(); ctx.moveTo(sx,64); ctx.lineTo(sx+8,18); ctx.lineTo(sx+16,64);
        ctx.closePath(); ctx.fill();
      }
      // Glow overlay
      let gGas = ctx.createRadialGradient(160,64,0,160,48,32);
      gGas.addColorStop(0,'rgba(255,80,0,0.4)');
      gGas.addColorStop(1,'rgba(255,80,0,0)');
      ctx.fillStyle = gGas; ctx.fillRect(128,0,64,64);

      // Tile 4: Concrete wall bricks
      ctx.fillStyle = '#1c1200'; ctx.fillRect(192,0,64,64);
      ctx.strokeStyle = '#0c0800'; ctx.lineWidth = 2;
      ctx.strokeRect(193,1,62,62);
      ctx.beginPath();
      ctx.moveTo(192,32); ctx.lineTo(256,32);
      ctx.moveTo(224,0);  ctx.lineTo(224,32);
      ctx.moveTo(208,32); ctx.lineTo(208,64);
      ctx.moveTo(240,32); ctx.lineTo(240,64);
      ctx.stroke();

      // Tile 5: Electric platform
      ctx.fillStyle = '#101a00'; ctx.fillRect(256,0,64,64);
      ctx.strokeStyle = '#aacc00'; ctx.lineWidth = 2;
      ctx.strokeRect(257,1,62,62);
      ctx.fillStyle = '#ccff00';
      for (let i = 0; i < 64; i += 12) {
        ctx.fillRect(256 + i, 2, 6, 4);
      }
      // Lightning bolt
      ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(288,8); ctx.lineTo(280,32); ctx.lineTo(286,32);
      ctx.lineTo(278,56); ctx.lineTo(296,30); ctx.lineTo(290,30);
      ctx.lineTo(298,8); ctx.closePath(); ctx.stroke();
    });

    // ── Valve spritesheet (2 frames of 32x32) ──────────────────────────────
    let valveTex = this.textures.createCanvas('valve', 64, 32);
    let vCtx = valveTex.context;
    // Frame 0 (closed)
    vCtx.fillStyle = '#2a1500'; vCtx.beginPath();
    vCtx.arc(16, 16, 12, 0, Math.PI*2); vCtx.fill();
    vCtx.strokeStyle = '#ff6600'; vCtx.lineWidth = 2;
    vCtx.beginPath(); vCtx.moveTo(16,4); vCtx.lineTo(16,28);
    vCtx.moveTo(4,16);  vCtx.lineTo(28,16); vCtx.stroke();
    vCtx.fillStyle = '#cc3300'; vCtx.beginPath();
    vCtx.arc(16,16,5,0,Math.PI*2); vCtx.fill();
    valveTex.add('0', 0, 0,0, 32,32);
    // Frame 1 (open)
    vCtx.fillStyle = '#1a3300'; vCtx.beginPath();
    vCtx.arc(48, 16, 12, 0, Math.PI*2); vCtx.fill();
    vCtx.strokeStyle = '#88ff00'; vCtx.lineWidth = 2;
    vCtx.beginPath(); vCtx.moveTo(48,4); vCtx.lineTo(48,28);
    vCtx.moveTo(36,16); vCtx.lineTo(60,16); vCtx.stroke();
    vCtx.fillStyle = '#33cc00'; vCtx.beginPath();
    vCtx.arc(48,16,5,0,Math.PI*2); vCtx.fill();
    valveTex.add('1', 0, 32,0, 32,32);
    valveTex.refresh();

    // ── Button spritesheet (same as S1) ────────────────────────────────────
    let btnTex = this.textures.createCanvas('button', 128, 32);
    let bCtx = btnTex.context;
    bCtx.fillStyle = '#141414'; bCtx.fillRect(8,24,48,8);
    bCtx.fillStyle = '#aa4400'; bCtx.fillRect(16,16,32,8);
    btnTex.add('0', 0, 0,0, 64,32);
    bCtx.fillStyle = '#141414'; bCtx.fillRect(72,24,48,8);
    bCtx.fillStyle = '#22aa22'; bCtx.fillRect(80,22,32,2);
    btnTex.add('1', 0, 64,0, 64,32);
    btnTex.refresh();

    // ── Player (reuse from S1 — identical sprite) ──────────────────────────
    let pTex = this.textures.createCanvas('player_procedural', 288, 48);
    for (let f = 0; f < 6; f++) {
      this.drawBoyFrame(pTex.context, f, f * 48);
      pTex.add(String(f), 0, f*48,0, 48,48);
    }
    pTex.refresh();

    // ── Drone spritesheet (4 frames 64x48) ─────────────────────────────────
    let droneTex = this.textures.createCanvas('drone_procedural', 256, 48);
    for (let f = 0; f < 4; f++) {
      this.drawDroneFrame(droneTex.context, f, f * 64);
      droneTex.add(String(f), 0, f*64,0, 64,48);
    }
    droneTex.refresh();

    // ── Factory silhouette ─────────────────────────────────────────────────
    make('factory_silhouette', 128, 256, ctx => {
      ctx.fillStyle = '#100800';
      // Main building block
      ctx.fillRect(10, 100, 108, 156);
      // Chimney 1
      ctx.fillRect(20, 30, 20, 90);
      // Chimney 2
      ctx.fillRect(55, 50, 18, 70);
      // Chimney 3
      ctx.fillRect(90, 20, 22, 100);
      // Roof details
      ctx.fillRect(10, 96, 108, 8);
      // Windows (dark cutouts)
      ctx.fillStyle = '#1a0d00';
      for (let wy = 120; wy < 240; wy += 28) {
        for (let wx = 18; wx < 110; wx += 24) {
          ctx.fillRect(wx, wy, 12, 16);
        }
      }
    });

    // ── Pipe decoration ────────────────────────────────────────────────────
    make('pipe', 16, 64, ctx => {
      ctx.fillStyle = '#2a1800';
      ctx.fillRect(4, 0, 8, 64);
      ctx.fillStyle = '#4a3000';
      ctx.fillRect(0, 0, 16, 8);
      ctx.fillRect(0, 56, 16, 8);
      ctx.strokeStyle = '#663300'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 63);
    });

    // ── Rivet decoration ───────────────────────────────────────────────────
    make('rivet', 8, 8, ctx => {
      ctx.fillStyle = '#554433';
      ctx.beginPath(); ctx.arc(4,4,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#887755';
      ctx.beginPath(); ctx.arc(3,3,1,0,Math.PI*2); ctx.fill();
    });

    // ── Spark particle ─────────────────────────────────────────────────────
    make('spark', 8, 8, ctx => {
      let g = ctx.createRadialGradient(4,4,0,4,4,4);
      g.addColorStop(0,'rgba(255,220,0,0.9)');
      g.addColorStop(1,'rgba(255,100,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,8,8);
    });
  }

  // ── Draw player (identical to S1) ─────────────────────────────────────────
  drawBoyFrame(ctx, frameIdx, xOffset) {
    let hx = xOffset + 24, hy = 13;
    ctx.fillStyle = '#5c4033';
    ctx.beginPath();
    ctx.moveTo(hx-7,hy-4); ctx.lineTo(hx-13,hy-5); ctx.lineTo(hx-7,hy+1);
    ctx.moveTo(hx-5,hy-6); ctx.lineTo(hx-10,hy-11); ctx.lineTo(hx-2,hy-7);
    ctx.moveTo(hx-2,hy-8); ctx.lineTo(hx-4,hy-13); ctx.lineTo(hx+2,hy-8);
    ctx.moveTo(hx+2,hy-8); ctx.lineTo(hx+4,hy-11); ctx.lineTo(hx+6,hy-7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(hx,hy,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#5c4033';
    ctx.beginPath(); ctx.arc(hx,hy-1,8,Math.PI,0); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx-2,hy-4); ctx.lineTo(hx+3,hy-2);
    ctx.lineTo(hx+6,hy-4); ctx.lineTo(hx+1,hy-6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx+2,hy-2,2,3); ctx.fillRect(hx+5,hy-2,2,3);
    ctx.fillStyle = '#111111';
    ctx.fillRect(hx+3,hy-1,1,2); ctx.fillRect(hx+6,hy-1,1,2);
    ctx.fillStyle = 'rgba(255,120,120,0.4)';
    ctx.beginPath(); ctx.arc(hx+1,hy+2,1.5,0,Math.PI*2);
    ctx.arc(hx+6,hy+2,1.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#c68642'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hx+4,hy+1,1.8,0,Math.PI); ctx.stroke();
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.roundRect(hx-5,hy+6,10,3.5,1.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx-3,hy+7);
    let wave = Math.sin(frameIdx*1.3)*3;
    ctx.lineTo(hx-12,hy+9+wave); ctx.lineTo(hx-11,hy+13+wave);
    ctx.lineTo(hx-2,hy+9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a75d3';
    ctx.beginPath();
    ctx.moveTo(hx-5,hy+9); ctx.lineTo(hx+5,hy+9);
    ctx.lineTo(hx+7,34); ctx.lineTo(hx-7,34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1d5aa8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hx-3,hy+15); ctx.lineTo(hx+1,hy+22); ctx.stroke();
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(hx+1,hy+22,1.5,0,Math.PI*2); ctx.fill();
    let la=0, ra=0;
    if (frameIdx>0) { la=Math.sin(frameIdx*1.15)*0.45; ra=-Math.sin(frameIdx*1.15)*0.45; }
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    let lx=hx-3+Math.sin(la)*9, ly=34+Math.cos(la)*9;
    ctx.beginPath(); ctx.moveTo(hx-3,34); ctx.lineTo(lx,ly); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(lx,ly+1.5,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cc2222'; ctx.fillRect(lx-2.2,ly+0.5,4.4,1.5);
    let rx=hx+3+Math.sin(ra)*9, ry=34+Math.cos(ra)*9;
    ctx.beginPath(); ctx.moveTo(hx+3,34); ctx.lineTo(rx,ry); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(rx,ry+1.5,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cc2222'; ctx.fillRect(rx-2.2,ry+0.5,4.4,1.5);
  }

  // ── Draw drone frame ───────────────────────────────────────────────────────
  drawDroneFrame(ctx, frameIdx, xOffset) {
    let cx = xOffset + 32, cy = 24;
    let rotorOffset = Math.sin(frameIdx * 0.9) * 2;

    // Body hexagon
    ctx.fillStyle = '#1a1000';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      let a = (i / 6) * Math.PI * 2 - Math.PI/6;
      let px = cx + Math.cos(a) * 14;
      let py = cy + Math.sin(a) * 10;
      i === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }
    ctx.closePath(); ctx.fill();

    // Orange visor eye
    ctx.fillStyle = '#ff6600';
    ctx.beginPath(); ctx.ellipse(cx, cy-2, 8, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff9900';
    ctx.beginPath(); ctx.ellipse(cx-1, cy-3, 4, 2, 0, 0, Math.PI*2); ctx.fill();

    // Arms
    ctx.strokeStyle = '#3a2000'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx-14, cy); ctx.lineTo(cx-26, cy-4+rotorOffset);
    ctx.moveTo(cx+14, cy); ctx.lineTo(cx+26, cy-4-rotorOffset);
    ctx.stroke();

    // Rotors
    ctx.fillStyle = '#554400';
    ctx.beginPath(); ctx.ellipse(cx-26, cy-4+rotorOffset, 10, 3, frameIdx*0.5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+26, cy-4-rotorOffset, 10, 3, -frameIdx*0.5, 0, Math.PI*2);
    ctx.fill();

    // Bottom scanner light
    ctx.fillStyle = 'rgba(255,100,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(cx-4, cy+10);
    ctx.lineTo(cx+4, cy+10);
    ctx.lineTo(cx+10, cy+36);
    ctx.lineTo(cx-10, cy+36);
    ctx.closePath(); ctx.fill();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASER CONFIG
// ══════════════════════════════════════════════════════════════════════════════
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