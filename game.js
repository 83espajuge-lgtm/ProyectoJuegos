// ============================================================
// VIDEODROME — Integración Nivel 1 + Nivel 3
// Nivel 1: Bosque de Niebla  |  Nivel 3: El Espejismo de Otoño
// ============================================================
// Phaser 3.60 | Arcade Physics
// ============================================================

// ── Nivel 3 physics constants ────────────────────────────────
const CAM_ZOOM    = 3.5;
const GRAVITY     = 500;
const P_ACCEL     = 600;
const P_MAX_SPD   = 120;
const P_DRAG      = 600;
const P_JUMP_VEL  = -220;
const P_JUMP_CUT  = -60;
const COYOTE_MS   = 100;
const JUMP_BUFFER = 100;
const DASH_SPD    = 300;
const DASH_MS     = 150;
const DASH_CD     = 800;

// ── Shared audio (piano synth for level 3) ───────────────────
class PianoSynth {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.15;
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 800;
        this.masterGain.connect(this.filter);
        this.filter.connect(this.ctx.destination);
        this.isPlaying = false;
        this.chords = [
            [261.63, 329.63, 392.00, 493.88],
            [220.00, 261.63, 329.63, 493.88],
            [174.61, 261.63, 329.63, 440.00],
            [196.00, 246.94, 293.66, 392.00]
        ];
        this.chordIdx = 0;
        this.noteIdx  = 0;
    }
    playNote(freq, time, duration) {
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.start(time); osc.stop(time + duration);
    }
    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this._scheduleNext();
    }
    _scheduleNext() {
        if (!this.isPlaying) return;
        const now   = this.ctx.currentTime;
        const chord = this.chords[this.chordIdx];
        const freq  = chord[this.noteIdx];
        this.playNote(freq, now, 3.0);
        if (this.noteIdx === 0) this.playNote(chord[0] / 2, now, 4.0);
        this.noteIdx++;
        if (this.noteIdx >= chord.length) {
            this.noteIdx = 0;
            this.chordIdx = (this.chordIdx + 1) % this.chords.length;
        }
        setTimeout(() => this._scheduleNext(), 600);
    }
}
let gameMusic = null;

// ════════════════════════════════════════════════════════════
//  BOOT SCENE — genera todas las texturas compartidas
// ════════════════════════════════════════════════════════════
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    preload() {
        this.load.image('bg_cabin', 'assets/cozy_cabin_bg.png');
        this.load.image('ekaterina', 'assets/ekaterina.png');
        this.load.tilemapTiledJSON('mapa_escenario1', 'assets/mapa_escenario1.json');
        this.load.audio('ambient_song', 'assets/song.mp3');
    }

    create() {
        this._generateAllTextures();
        this.scene.start('MenuScene');
    }

    // ── helper: make canvas texture ──────────────────────────
    _make(key, w, h, drawFn) {
        if (this.textures.exists(key)) return;
        const tex = this.textures.createCanvas(key, w, h);
        drawFn(tex.context);
        tex.refresh();
    }

    _generateAllTextures() {
        // ── Player "El Niño" spritesheet (6 frames × 48px) ───
        if (!this.textures.exists('player_procedural')) {
            const playerTex = this.textures.createCanvas('player_procedural', 288, 48);
            const pc = playerTex.context;
            for (let f = 0; f < 6; f++) {
                drawBoyFrame(pc, f, f * 48);
                playerTex.add(f.toString(), 0, f * 48, 0, 48, 48);
            }
            playerTex.refresh();
        }

        // ── Spider spritesheet (4 frames × 64px) ─────────────
        if (!this.textures.exists('spider_procedural')) {
            const spiderTex = this.textures.createCanvas('spider_procedural', 256, 48);
            const sc = spiderTex.context;
            for (let f = 0; f < 4; f++) {
                drawSpiderFrame(sc, f, f * 64);
                spiderTex.add(f.toString(), 0, f * 64, 0, 64, 48);
            }
            spiderTex.refresh();
        }

        // ── Crate (Level 1 dark version) ─────────────────────
        this._make('crate_dark', 64, 64, ctx => {
            ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#050505'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 60, 60);
            ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 2; ctx.strokeRect(6, 6, 52, 52);
            ctx.strokeStyle = '#050505'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(56, 56);
            ctx.moveTo(56, 8); ctx.lineTo(8, 56); ctx.stroke();
        });

        // ── Level-3 pixel crate ───────────────────────────────
        this._make('crate', 12, 12, ctx => {
            ctx.fillStyle = '#8b6914'; ctx.fillRect(0, 0, 12, 12);
            ctx.fillStyle = '#5a4010';
            ctx.fillRect(0, 0, 12, 1); ctx.fillRect(0, 0, 1, 12);
            ctx.fillRect(11, 0, 1, 12); ctx.fillRect(0, 11, 12, 1);
            ctx.fillStyle = '#a07828'; ctx.fillRect(2, 2, 8, 8);
        });

        // ── Lift ──────────────────────────────────────────────
        this._make('lift', 96, 16, ctx => {
            ctx.fillStyle = '#151515'; ctx.fillRect(0, 0, 96, 16);
            ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, 0, 96, 4);
            ctx.fillStyle = '#222222';
            for (let i = 0; i < 96; i += 16) {
                ctx.beginPath(); ctx.moveTo(i, 4); ctx.lineTo(i + 8, 4);
                ctx.lineTo(i + 16, 16); ctx.lineTo(i + 8, 16); ctx.closePath(); ctx.fill();
            }
            ctx.strokeStyle = '#050505'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 94, 14);
        });

        // ── Iron gate ─────────────────────────────────────────
        this._make('gate', 32, 128, ctx => {
            ctx.fillStyle = '#0f0f0f'; ctx.fillRect(0, 0, 32, 128);
            ctx.fillStyle = '#222222';
            ctx.fillRect(4, 0, 5, 128); ctx.fillRect(13, 0, 5, 128); ctx.fillRect(23, 0, 5, 128);
            ctx.fillStyle = '#151515';
            ctx.fillRect(0, 12, 32, 8); ctx.fillRect(0, 60, 32, 8); ctx.fillRect(0, 108, 32, 8);
        });

        // ── Exit door ─────────────────────────────────────────
        this._make('exit', 64, 96, ctx => {
            ctx.fillStyle = '#050505';
            ctx.beginPath(); ctx.moveTo(8, 96); ctx.lineTo(8, 36);
            ctx.arc(32, 36, 24, Math.PI, 0); ctx.lineTo(56, 96); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(8, 96); ctx.lineTo(8, 36);
            ctx.arc(32, 36, 24, Math.PI, 0); ctx.lineTo(56, 96); ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center'; ctx.fillText('SALIDA', 32, 48);
        });

        // ── Fog ───────────────────────────────────────────────
        this._make('fog', 128, 128, ctx => {
            const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(230,230,230,0.16)');
            g.addColorStop(0.5, 'rgba(230,230,230,0.05)');
            g.addColorStop(1, 'rgba(230,230,230,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill();
        });

        // ── Tileset (5 tiles) ─────────────────────────────────
        this._make('tileset_procedural', 320, 64, ctx => {
            // Tile 1: Grass
            ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, 64, 64);
            ctx.fillStyle = '#2d2d2d'; ctx.fillRect(0, 0, 64, 8);
            ctx.fillStyle = '#181818';
            for (let i = 0; i < 64; i += 8) {
                ctx.beginPath(); ctx.moveTo(i, 8); ctx.lineTo(i + 4, 2); ctx.lineTo(i + 8, 8); ctx.fill();
            }
            // Tile 2: Dirt
            ctx.fillStyle = '#111111'; ctx.fillRect(64, 0, 64, 64);
            ctx.fillStyle = '#1b1b1b';
            for (let i = 0; i < 15; i++) ctx.fillRect(64 + Math.random() * 60, Math.random() * 60, 2, 2);
            ctx.strokeStyle = '#080808'; ctx.lineWidth = 1; ctx.strokeRect(64.5, 0.5, 63, 63);
            // Tile 3: Spikes
            ctx.fillStyle = '#0a0a0a';
            for (let i = 0; i < 4; i++) {
                const sx = 128 + i * 16;
                ctx.beginPath(); ctx.moveTo(sx, 64); ctx.lineTo(sx + 8, 18); ctx.lineTo(sx + 16, 64); ctx.closePath(); ctx.fill();
            }
            // Tile 4: Stone wall
            ctx.fillStyle = '#1c1c1c'; ctx.fillRect(192, 0, 64, 64);
            ctx.strokeStyle = '#0c0c0c'; ctx.lineWidth = 2;
            ctx.strokeRect(193, 1, 62, 62);
            ctx.beginPath();
            ctx.moveTo(192, 32); ctx.lineTo(256, 32);
            ctx.moveTo(224, 0);  ctx.lineTo(224, 32);
            ctx.moveTo(208, 32); ctx.lineTo(208, 64);
            ctx.moveTo(240, 32); ctx.lineTo(240, 64); ctx.stroke();
            // Tile 5: Crumbling logs
            ctx.fillStyle = '#141414'; ctx.fillRect(256, 0, 64, 64);
            ctx.strokeStyle = '#222222'; ctx.lineWidth = 2; ctx.strokeRect(257, 1, 62, 62);
            ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(256, 16); ctx.lineTo(320, 16);
            ctx.moveTo(256, 32); ctx.lineTo(320, 32);
            ctx.moveTo(256, 48); ctx.lineTo(320, 48); ctx.stroke();
        });

        // ── Lever spritesheet (2 frames) ─────────────────────
        if (!this.textures.exists('lever')) {
            const lt  = this.textures.createCanvas('lever', 64, 32);
            const lc  = lt.context;
            lc.fillStyle = '#141414'; lc.fillRect(4, 24, 24, 8);
            lc.strokeStyle = '#2d2d2d'; lc.lineWidth = 3;
            lc.beginPath(); lc.moveTo(16, 24); lc.lineTo(8, 10); lc.stroke();
            lc.fillStyle = '#cc2222'; lc.beginPath(); lc.arc(8, 10, 4, 0, Math.PI * 2); lc.fill();
            lt.add('0', 0, 0, 0, 32, 32);
            lc.fillStyle = '#141414'; lc.fillRect(36, 24, 24, 8);
            lc.strokeStyle = '#2d2d2d'; lc.lineWidth = 3;
            lc.beginPath(); lc.moveTo(48, 24); lc.lineTo(56, 10); lc.stroke();
            lc.fillStyle = '#22cc22'; lc.beginPath(); lc.arc(56, 10, 4, 0, Math.PI * 2); lc.fill();
            lt.add('1', 0, 32, 0, 32, 32);
            lt.refresh();
        }

        // ── Button spritesheet (2 frames) ─────────────────────
        if (!this.textures.exists('button')) {
            const bt  = this.textures.createCanvas('button', 128, 32);
            const bc  = bt.context;
            bc.fillStyle = '#141414'; bc.fillRect(8, 24, 48, 8);
            bc.fillStyle = '#aa2222'; bc.fillRect(16, 16, 32, 8);
            bt.add('0', 0, 0, 0, 64, 32);
            bc.fillStyle = '#141414'; bc.fillRect(72, 24, 48, 8);
            bc.fillStyle = '#22aa22'; bc.fillRect(80, 22, 32, 2);
            bt.add('1', 0, 64, 0, 64, 32);
            bt.refresh();
        }

        // ── Trees ─────────────────────────────────────────────
        this._make('tree_pine', 128, 256, ctx => {
            ctx.fillStyle = '#080808'; ctx.fillRect(58, 180, 12, 76);
            ctx.beginPath();
            ctx.moveTo(64, 20); ctx.lineTo(120, 100); ctx.lineTo(80, 100);
            ctx.lineTo(110, 140); ctx.lineTo(70, 140); ctx.lineTo(116, 192);
            ctx.lineTo(12, 192); ctx.lineTo(58, 140); ctx.lineTo(18, 140);
            ctx.lineTo(48, 100); ctx.lineTo(8, 100); ctx.closePath(); ctx.fill();
        });

        this._make('tree_deciduous', 128, 256, ctx => {
            ctx.fillStyle = '#080808'; ctx.fillRect(56, 130, 16, 126);
            ctx.beginPath();
            ctx.arc(42, 90, 32, 0, Math.PI * 2);
            ctx.arc(86, 82, 36, 0, Math.PI * 2);
            ctx.arc(64, 55, 42, 0, Math.PI * 2); ctx.fill();
        });

        // ── Vine ─────────────────────────────────────────────
        this._make('vine', 16, 64, ctx => {
            ctx.strokeStyle = '#080808'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(8, 0);
            ctx.bezierCurveTo(4, 20, 12, 40, 8, 64); ctx.stroke();
            ctx.fillStyle = '#0b0b0b';
            ctx.beginPath();
            ctx.ellipse(5, 16, 4, 2, -0.4, 0, Math.PI * 2);
            ctx.ellipse(11, 32, 4, 2, 0.4, 0, Math.PI * 2);
            ctx.ellipse(5, 48, 4, 2, -0.4, 0, Math.PI * 2); ctx.fill();
        });

        // ── Leaf ─────────────────────────────────────────────
        this._make('leaf', 8, 8, ctx => {
            ctx.fillStyle = '#1e1e1e';
            ctx.beginPath(); ctx.ellipse(4, 4, 4, 2, 0.5, 0, Math.PI * 2); ctx.fill();
        });

        // ── Grass tuft ───────────────────────────────────────
        this._make('grass_tuft', 16, 16, ctx => {
            ctx.strokeStyle = '#121212'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(8, 16); ctx.lineTo(2, 4);
            ctx.moveTo(8, 16); ctx.lineTo(5, 2);
            ctx.moveTo(8, 16); ctx.lineTo(8, 1);
            ctx.moveTo(8, 16); ctx.lineTo(11, 2);
            ctx.moveTo(8, 16); ctx.lineTo(14, 4); ctx.stroke();
        });

        // ── Level-3 utility textures ──────────────────────────
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff); g.fillRect(0, 0, 2, 2);
        g.generateTexture('particle', 2, 2);
        g.clear();
        g.fillStyle(0x55aaff); g.fillTriangle(0, 0, 8, 4, 0, 8);
        g.fillStyle(0x88ccff); g.fillTriangle(2, 1, 7, 4, 2, 7);
        g.generateTexture('dash_icon', 8, 8);
        g.clear();
        g.fillStyle(0xaa2222); g.fillTriangle(4, 0, 0, 8, 8, 8);
        g.fillStyle(0x661111); g.fillTriangle(4, 2, 2, 8, 6, 8);
        g.generateTexture('spike', 8, 8);
        g.destroy();
    }
}

// ════════════════════════════════════════════════════════════
//  SHARED PLAYER / SPIDER DRAWING FUNCTIONS
// ════════════════════════════════════════════════════════════
function drawBoyFrame(ctx, frameIdx, xOffset) {
    const hx = xOffset + 24;
    const hy = 13;

    // Hair (back)
    ctx.fillStyle = '#5c4033';
    ctx.beginPath();
    ctx.moveTo(hx - 7, hy - 4); ctx.lineTo(hx - 13, hy - 5); ctx.lineTo(hx - 7, hy + 1);
    ctx.moveTo(hx - 5, hy - 6); ctx.lineTo(hx - 10, hy - 11); ctx.lineTo(hx - 2, hy - 7);
    ctx.moveTo(hx - 2, hy - 8); ctx.lineTo(hx - 4, hy - 13); ctx.lineTo(hx + 2, hy - 8);
    ctx.moveTo(hx + 2, hy - 8); ctx.lineTo(hx + 4, hy - 11); ctx.lineTo(hx + 6, hy - 7);
    ctx.closePath(); ctx.fill();

    // Face
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();

    // Hair (cap)
    ctx.fillStyle = '#5c4033';
    ctx.beginPath(); ctx.arc(hx, hy - 1, 8, Math.PI, 0); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx - 2, hy - 4); ctx.lineTo(hx + 3, hy - 2);
    ctx.lineTo(hx + 6, hy - 4); ctx.lineTo(hx + 1, hy - 6);
    ctx.closePath(); ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx + 2, hy - 2, 2, 3); ctx.fillRect(hx + 5, hy - 2, 2, 3);
    ctx.fillStyle = '#111111';
    ctx.fillRect(hx + 3, hy - 1, 1, 2); ctx.fillRect(hx + 6, hy - 1, 1, 2);

    // Blush
    ctx.fillStyle = 'rgba(255,120,120,0.4)';
    ctx.beginPath(); ctx.arc(hx + 1, hy + 2, 1.5, 0, Math.PI * 2);
    ctx.arc(hx + 6, hy + 2, 1.5, 0, Math.PI * 2); ctx.fill();

    // Smile
    ctx.strokeStyle = '#c68642'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hx + 4, hy + 1, 1.8, 0, Math.PI); ctx.stroke();

    // Scarf
    ctx.fillStyle = '#cc2222';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hx - 5, hy + 6, 10, 3.5, 1.5);
    else ctx.rect(hx - 5, hy + 6, 10, 3.5);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - 3, hy + 7);
    const wave = Math.sin(frameIdx * 1.3) * 3;
    ctx.lineTo(hx - 12, hy + 9 + wave);
    ctx.lineTo(hx - 11, hy + 13 + wave);
    ctx.lineTo(hx - 2, hy + 9);
    ctx.closePath(); ctx.fill();

    // Body (blue hoodie)
    ctx.fillStyle = '#2a75d3';
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy + 9); ctx.lineTo(hx + 5, hy + 9);
    ctx.lineTo(hx + 7, 34);     ctx.lineTo(hx - 7, 34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1d5aa8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hx - 3, hy + 15); ctx.lineTo(hx + 1, hy + 22); ctx.stroke();
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath(); ctx.arc(hx + 1, hy + 22, 1.5, 0, Math.PI * 2); ctx.fill();

    // Legs & sneakers
    let la = 0, ra = 0;
    if (frameIdx > 0) { la = Math.sin(frameIdx * 1.15) * 0.45; ra = -la; }
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    const lx = hx - 3 + Math.sin(la) * 9, ly = 34 + Math.cos(la) * 9;
    ctx.beginPath(); ctx.moveTo(hx - 3, 34); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(lx, ly + 1.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cc2222'; ctx.fillRect(lx - 2.2, ly + 0.5, 4.4, 1.5);
    const rx = hx + 3 + Math.sin(ra) * 9, ry = 34 + Math.cos(ra) * 9;
    ctx.beginPath(); ctx.moveTo(hx + 3, 34); ctx.lineTo(rx, ry); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(rx, ry + 1.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cc2222'; ctx.fillRect(rx - 2.2, ry + 0.5, 4.4, 1.5);
}

function drawSpiderFrame(ctx, frameIdx, xOffset) {
    const cx = xOffset + 32, cy = 20;
    ctx.fillStyle = '#050505';
    ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy + 1, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff1111';
    ctx.beginPath(); ctx.arc(cx + 9, cy, 2, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#050505'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const phase = frameIdx * (Math.PI / 2);
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 4; i++) {
            let legAngle = (i - 1.5) * 0.4 + side * (Math.PI / 2);
            if (frameIdx > 0) legAngle += Math.sin(phase + i) * 0.22;
            const sx = cx + side * 4, sy = cy + 2;
            const j1x = sx + Math.cos(legAngle) * 8;
            const j1y = sy + Math.sin(legAngle) * 8 - 5;
            const knee = legAngle + side * 0.85;
            const j2x = j1x + Math.cos(knee) * 11;
            const j2y = j1y + Math.sin(knee) * 11 + 9;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(j1x, j1y); ctx.lineTo(j2x, j2y); ctx.stroke();
        }
    }
}

// ════════════════════════════════════════════════════════════
//  MENU SCENE
// ════════════════════════════════════════════════════════════
class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }
    create() {
        const cx = this.cameras.main.centerX;
        const cy = this.cameras.main.centerY;
        this.cameras.main.setBackgroundColor('#0a0805');

        const title = this.add.text(cx, cy - 90, 'VIDEODROME', {
            fontFamily: '"Press Start 2P"', fontSize: '36px',
            color: '#ffcc88', stroke: '#331100', strokeThickness: 6
        }).setOrigin(0.5);
        this.tweens.add({ targets: title, y: title.y - 6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        this.add.text(cx, cy - 38, '2 Niveles · 1 Aventura', {
            fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#cc9966'
        }).setOrigin(0.5);

        this.add.text(cx, cy - 10, 'Nivel 1 · Bosque de Niebla\nNivel 3 · El Espejismo de Otoño', {
            fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#aa8866', lineSpacing: 10, align: 'center'
        }).setOrigin(0.5);

        const controls = 'WASD / Flechas - Mover  |  Saltar - W / ↑\nSHIFT - Dash (Nivel 3)  |  E/ENTER - Interactuar\n(Nivel 1) Empuja cajas, activa palancas, evita arañas';
        this.add.text(cx, cy + 55, controls, {
            fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#aa8866', lineSpacing: 10, align: 'center'
        }).setOrigin(0.5);

        const start = this.add.text(cx, cy + 120, '[ ENTER / CLIC para empezar ]', {
            fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#ffddaa'
        }).setOrigin(0.5);
        this.tweens.add({ targets: start, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

        const startFunc = () => {
            focusGameCanvas();
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.time.delayedCall(400, () => this.scene.start('MainScene'));
        };
        this.input.keyboard.once('keydown-ENTER', startFunc);
        this.input.once('pointerdown', startFunc);
        this.input.keyboard.once('keydown-SPACE', startFunc);
    }
}

// ════════════════════════════════════════════════════════════
//  MAIN SCENE — NIVEL 1: BOSQUE DE NIEBLA
// ════════════════════════════════════════════════════════════
class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }

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
        // Assets already loaded in BootScene — nothing to do
    }

    create() {
        const tileWidth = 64, tileHeight = 64;
        const mapCols = 80, mapRows = 10;
        const mapWidth  = mapCols * tileWidth;
        const mapHeight = mapRows * tileHeight;

        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        this._createParallaxBackground(mapWidth, mapHeight);

        // Tilemap
        const map     = this.make.tilemap({ key: 'mapa_escenario1' });
        const tileset = map.addTilesetImage('background', 'tileset_procedural', 64, 64, 0, 0);
        const layer   = map.createLayer('Capa de patrones 1', tileset, 0, 0);
        this.layer = layer;

        // Build grid
        let grid = Array(mapRows).fill(null).map(() => Array(mapCols).fill(0));
        for (let x = 0; x < mapCols; x++) {
            if (x >= 12 && x <= 17) { grid[9][x] = 2; grid[8][x] = 3; continue; }
            grid[8][x] = 1; grid[9][x] = 2;
        }
        grid[7][10] = 4; grid[6][10] = 4; grid[7][11] = 4; grid[6][11] = 4;
        grid[5][8]  = 1; grid[5][9]  = 1;
        for (let x = 20; x <= 32; x++) { grid[4][x] = 4; grid[3][x] = 2; grid[2][x] = 2; }
        for (let x = 37; x <= 39; x++) { grid[8][x] = 3; grid[9][x] = 2; }
        for (let x = 43; x <= 57; x++) { grid[5][x] = 4; grid[4][x] = 2; grid[3][x] = 2; }
        grid[8][55] = 0;
        for (let x = 59; x <= 71; x++) { grid[8][x] = 0; grid[9][x] = 0; }
        grid[7][60] = 5; grid[6][62] = 5; grid[6][64] = 5;
        grid[7][66] = 5; grid[6][68] = 5; grid[7][70] = 5;
        for (let y = 0; y < 8; y++) grid[y][79] = 4;

        for (let y = 0; y < mapRows; y++) {
            for (let x = 0; x < mapCols; x++) {
                const v = grid[y][x];
                if (v !== 0) {
                    layer.putTileAt(v, x, y);
                    if (v === 1 && Math.random() < 0.45) {
                        const tuft = this.add.image(x * 64 + 16 + Math.random() * 32, y * 64, 'grass_tuft');
                        tuft.setOrigin(0.5, 1).setDepth(7).setTint(0x181818);
                    }
                }
            }
        }
        layer.setCollision([1, 2, 4, 5]);
        layer.setTileIndexCallback(3, (sprite, tile) => {
            if (sprite === this.player) {
                if (tile.x >= 37 && tile.x <= 39 && this.crate3 && this.crate3.y > 500) return;
                this.playerDie();
            }
        }, this);

        this._createFogLayer(10, 0.05, 0.3);

        // Crates
        this.crates = this.physics.add.group();
        this.crate1 = this._makeCrate(5 * 64 + 32, 7 * 64);
        this.crate2 = this._makeCrate(22 * 64 + 32, 7 * 64);

        // Lever 1
        this.lever = this.physics.add.sprite(9 * 64, 5 * 64 - 16, 'lever', '0');
        this.lever.body.setAllowGravity(false).setImmovable(true);

        // Lift
        this.liftStartX = 12 * 64 + 48; this.liftEndX = 17 * 64 + 16;
        this.lift = this.physics.add.sprite(this.liftStartX, 6 * 64 + 16, 'lift');
        this.lift.body.setAllowGravity(false).setImmovable(true).setFriction(1, 0);

        // Pressure plate 1 & gate 1
        this.plate = this.physics.add.sprite(28 * 64 + 32, 8 * 64 - 8, 'button', '0');
        this.plate.body.setAllowGravity(false).setImmovable(true);
        this.gate = this.physics.add.sprite(32 * 64 + 16, 7 * 64 - 64, 'gate');
        this.gate.body.setAllowGravity(false).setImmovable(true);

        // Lever 2 & trapdoor
        this.lever2 = this.physics.add.sprite(35 * 64 + 32, 8 * 64 - 16, 'lever', '0');
        this.lever2.body.setAllowGravity(false).setImmovable(true);
        this.trapdoor = this.physics.add.sprite(38.5 * 64, 8 * 64 - 8, 'lift');
        this.trapdoor.body.setAllowGravity(false).setImmovable(true);
        this.trapdoor.setDisplaySize(192, 16);
        this.crate3 = this._makeCrate(38.5 * 64, 7 * 64);

        // Pressure plate 2 & gate 2
        this.plate2 = this.physics.add.sprite(55 * 64 + 32, 8 * 64 - 8, 'button', '0');
        this.plate2.body.setAllowGravity(false).setImmovable(true);
        this.gate2 = this.physics.add.sprite(57 * 64 + 16, 7 * 64 - 64, 'gate');
        this.gate2.body.setAllowGravity(false).setImmovable(true);

        // Exit door
        this.exitDoor = this.physics.add.sprite(76 * 64 + 32, 8 * 64 - 48, 'exit');
        this.exitDoor.body.setAllowGravity(false).setImmovable(true);

        // Crate colliders
        this.physics.add.collider(this.crates, layer);
        this.physics.add.collider(this.crates, this.trapdoor);

        // Player — "El Niño"
        this.player = this.physics.add.sprite(
            this.currentCheckpoint.x, this.currentCheckpoint.y, 'player_procedural', '0'
        );
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(24, 44).setOffset(12, 4);

        this.physics.add.collider(this.player, layer);
        this.physics.add.overlap(this.player, layer);
        this.physics.add.collider(this.player, this.trapdoor);
        this.physics.add.collider(this.player, this.crates, (player, crate) => {
            if (player.body.touching.down && crate.body.touching.up) return;
            if (player.body.touching.right && crate.body.touching.left) crate.setVelocityX(player.body.velocity.x * 0.75);
            else if (player.body.touching.left && crate.body.touching.right) crate.setVelocityX(player.body.velocity.x * 0.75);
        });
        this.physics.add.collider(this.player, this.lift);
        this.physics.add.collider(this.player, this.gate);
        this.physics.add.collider(this.crates, this.gate);
        this.physics.add.collider(this.player, this.gate2);
        this.physics.add.collider(this.crates, this.gate2);

        // Animations
        if (!this.anims.exists('walk')) {
            this.anims.create({ key: 'walk', frames: [0,1,2,3,4,5].map(f => ({ key:'player_procedural', frame: f.toString() })), frameRate: 10, repeat: -1 });
        }
        if (!this.anims.exists('idle')) {
            this.anims.create({ key: 'idle', frames: [{ key:'player_procedural', frame:'0' }], frameRate: 1 });
        }
        if (!this.anims.exists('spider_walk')) {
            this.anims.create({ key: 'spider_walk', frames: [0,1,2,3].map(f => ({ key:'spider_procedural', frame: f.toString() })), frameRate: 8, repeat: -1 });
        }

        // Spiders
        this.spiders = this.physics.add.group();
        const sp1 = this.physics.add.sprite(8.5 * 64, 4 * 64, 'spider_procedural', '0');
        sp1.setData({ startX: 8.5 * 64, startY: 4 * 64, range: 60, dir: -1, fleeing: false, fleeTimer: 0 });
        this.spiders.add(sp1);
        const sp2 = this.physics.add.sprite(25 * 64, 7 * 64, 'spider_procedural', '0');
        sp2.setData({ startX: 25 * 64, startY: 7 * 64, range: 180, dir: -1, fleeing: false, fleeTimer: 0 });
        this.spiders.add(sp2);
        this.hangingSpider = this.physics.add.sprite(22 * 64 + 32, 4 * 64, 'spider_procedural', '0');
        this.hangingSpider.setData({ startY: 4 * 64, dropY: 7 * 64 + 16, state: 'hanging' });
        this.hangingSpider.body.setAllowGravity(false).setSize(48, 32);
        this.herdSpider = this.physics.add.sprite(45 * 64, 7 * 64, 'spider_procedural', '0');
        this.herdSpider.setData({ startX: 45 * 64, startY: 7 * 64, range: 40, dir: 1, fleeing: false, fleeTimer: 0 });
        this.spiders.add(this.herdSpider);

        this.physics.add.collider(this.spiders, layer);
        this.physics.add.collider(this.spiders, this.crates);
        this.physics.add.overlap(this.player, this.spiders, this.playerDie, null, this);
        this.physics.add.overlap(this.player, this.hangingSpider, this.playerDie, null, this);

        this.webGraphics = this.add.graphics().setDepth(15);

        // Vines
        [
            { x: 21*64+32, y: 4*64+16, s: 0.8 }, { x: 24*64+16, y: 4*64+16, s: 1.1 },
            { x: 27*64+48, y: 4*64+16, s: 0.9 }, { x: 30*64+32, y: 4*64+16, s: 1.0 },
            { x: 44*64+32, y: 5*64+16, s: 1.0 }, { x: 47*64+16, y: 5*64+16, s: 0.9 },
            { x: 50*64+48, y: 5*64+16, s: 1.2 }, { x: 53*64+32, y: 5*64+16, s: 0.8 },
            { x: 56*64+16, y: 5*64+16, s: 1.1 }
        ].forEach(p => {
            const v = this.add.image(p.x, p.y, 'vine').setOrigin(0.5, 0).setScale(p.s).setDepth(7).setTint(0x1a1a1a);
        });

        // Leaves
        this.add.particles(0, 0, 'leaf', {
            x: { min: 0, max: mapWidth }, y: -10, quantity: 1, frequency: 180, lifespan: 8000,
            scale: { min: 0.6, max: 1.3 }, alpha: { start: 0.6, end: 0, ease: 'Sine.easeIn' },
            speedY: { min: 40, max: 80 }, speedX: { min: -15, max: 15 },
            rotate: { min: 0, max: 360 }, gravityY: 8
        }).setDepth(7);

        // Camera
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBackgroundColor('#050505');
        this.cameras.main.fadeIn(600);

        this._createFogLayer(90, 0.12, 0.6);

        // Input
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

        // Title card Nivel 1
        const titleText = this.add.text(400, 240, 'NIVEL 1: EL BOSQUE DE NIEBLA', {
            fontFamily: '"Special Elite","Courier New",Courier,monospace',
            fontSize: '28px', color: '#ffffff', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
        const subText = this.add.text(400, 300, 'La linterna ahuyenta a los esperpentos arácnidos.', {
            fontFamily: '"Special Elite","Courier New",Courier,monospace',
            fontSize: '14px', color: '#aaaaaa', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
        this.tweens.add({ targets: [titleText, subText], alpha: 0, delay: 3500, duration: 1500, onComplete: () => { titleText.destroy(); subText.destroy(); } });

        // Hint text
        this.hintText = this.add.text(400, 50, '', {
            fontFamily: '"Special Elite","Courier New",Courier,monospace',
            fontSize: '16px', color: '#ffffff', backgroundColor: '#0a0a0a', padding: { x: 10, y: 6 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);

        // Victory text
        this.victoryText = this.add.text(400, 250, 'NIVEL 1 COMPLETADO\n\n¡Adelante al siguiente nivel!', {
            fontFamily: '"Special Elite","Courier New",Courier,monospace',
            fontSize: '24px', color: '#ffffff', align: 'center',
            backgroundColor: '#000000', padding: { x: 20, y: 20 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setVisible(false);

        this.resetSpiders();

        // Music
        let music = this.sound.get('ambient_song');
        if (!music) { music = this.sound.add('ambient_song', { loop: true, volume: 0.35 }); music.play(); }
        else if (!music.isPlaying) { music.play(); }

        focusGameCanvas();
    }

    _makeCrate(x, y) {
        const c = this.physics.add.sprite(x, y, 'crate_dark');
        c.setCollideWorldBounds(true).setDragX(5000).setBounce(0).setMass(4);
        this.crates.add(c);
        return c;
    }

    update(time, delta) {
        if (Phaser.Input.Keyboard.JustDown(this.wasd.reset)) { this.scene.restart(); return; }
        if (this.isDead || this.levelComplete) return;

        const speed = 160;
        if (this.cursors.left.isDown || this.wasd.left.isDown) {
            this.player.setVelocityX(-speed);
            this.player.anims.play('walk', true);
            this.player.flipX = true;
            if (this.player.body.blocked.down && Math.random() < 0.15) this._runDust(this.player.x + 8, this.player.y + 20);
        } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.anims.play('walk', true);
            this.player.flipX = false;
            if (this.player.body.blocked.down && Math.random() < 0.15) this._runDust(this.player.x - 8, this.player.y + 20);
        } else {
            this.player.setVelocityX(0);
            this.player.anims.play('idle', true);
        }
        if ((this.cursors.up.isDown || this.wasd.up.isDown) && this.player.body.blocked.down) {
            this.player.setVelocityY(-580);
            this._runDust(this.player.x, this.player.y + 20);
        }
        if (this.player.y > 600) this.playerDie();

        // Checkpoints
        if (this.player.x > 1200 && this.currentCheckpoint.x < 1200) { this.currentCheckpoint = { x: 1250, y: 400 }; this._hint('Punto de control 1 alcanzado.'); }
        if (this.player.x > 2600 && this.currentCheckpoint.x < 2600) { this.currentCheckpoint = { x: 2650, y: 400 }; this._hint('Punto de control 2 alcanzado.'); }

        // Lever 1
        const d1 = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lever.x, this.lever.y);
        if (d1 < 50) {
            if (!this.liftActive) {
                this.hintText.setText('[ENTER para activar palanca]').setVisible(true);
                if (Phaser.Input.Keyboard.JustDown(this.wasd.enter) || Phaser.Input.Keyboard.JustDown(this.wasd.space)) {
                    this.liftActive = true;
                    this.lever.setFrame('1');
                    this.lift.setVelocityX(80);
                    this.cameras.main.flash(200, 200, 200, 200);
                    this._hint('Mecanismo de elevador activado.');
                }
            } else { this.hintText.setText('Mecanismo activo').setVisible(true); }
        } else {
            if (this.hintText.visible && !['Punto','Portón','Mecanismo','trampilla','Trampilla'].some(w => this.hintText.text.includes(w))) this.hintText.setVisible(false);
        }
        if (this.liftActive) {
            if (this.lift.x >= this.liftEndX) this.lift.setVelocityX(-80);
            else if (this.lift.x <= this.liftStartX) this.lift.setVelocityX(80);
        }

        // Lever 2 / trapdoor
        const d2 = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lever2.x, this.lever2.y);
        if (d2 < 50) {
            if (!this.trapdoorRetracted) {
                this.hintText.setText('[ENTER para abrir trampilla]').setVisible(true);
                if (Phaser.Input.Keyboard.JustDown(this.wasd.enter) || Phaser.Input.Keyboard.JustDown(this.wasd.space)) {
                    this.trapdoorRetracted = true;
                    this.lever2.setFrame('1');
                    this.cameras.main.flash(200, 200, 200, 200).shake(300, 0.008);
                    this._hint('Trampilla abriéndose...');
                    this.tweens.add({ targets: this.trapdoor, x: this.trapdoor.x - 220, duration: 1000, ease: 'Cubic.easeInOut', onComplete: () => { this.trapdoor.body.enable = false; } });
                }
            } else { this.hintText.setText('Trampilla abierta').setVisible(true); }
        }

        // Plate 1 / gate 1
        let crateOnPlate = false;
        this.crates.getChildren().forEach(c => { if (Phaser.Geom.Intersects.RectangleToRectangle(c.getBounds(), this.plate.getBounds())) crateOnPlate = true; });
        if (crateOnPlate && !this.platePressed) {
            this.platePressed = true; this.plate.setFrame('1');
            this.cameras.main.shake(150, 0.005);
            this._hint('Portón de hierro 1 abriéndose...');
            this.tweens.add({ targets: this.gate, y: 7*64-180, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => { this.gate.body.enable = false; } });
        } else if (!crateOnPlate && this.platePressed) {
            this.platePressed = false; this.plate.setFrame('0'); this.gate.body.enable = true;
            this.cameras.main.shake(100, 0.004);
            this.tweens.add({ targets: this.gate, y: 7*64-64, duration: 600, ease: 'Bounce.easeOut' });
        }

        // Plate 2 / gate 2 (spider)
        let spiderOnPlate2 = false;
        this.spiders.getChildren().forEach(sp => { if (Phaser.Geom.Intersects.RectangleToRectangle(sp.getBounds(), this.plate2.getBounds())) spiderOnPlate2 = true; });
        if (spiderOnPlate2 && !this.plate2Pressed) {
            this.plate2Pressed = true; this.plate2.setFrame('1');
            this.cameras.main.shake(150, 0.005);
            this._hint('Portón de hierro 2 abriéndose...');
            this.tweens.add({ targets: this.gate2, y: 7*64-180, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => { this.gate2.body.enable = false; } });
        } else if (!spiderOnPlate2 && this.plate2Pressed) {
            this.plate2Pressed = false; this.plate2.setFrame('0'); this.gate2.body.enable = true;
            this.cameras.main.shake(100, 0.004);
            this.tweens.add({ targets: this.gate2, y: 7*64-64, duration: 600, ease: 'Bounce.easeOut' });
        }

        // Spiders AI
        this.spiders.getChildren().forEach(sp => {
            const lit = this._checkIfLit(sp);
            if (lit) {
                sp.setData('fleeing', true); sp.setData('fleeTimer', 80);
                const dir = sp.x > this.player.x ? 1 : -1;
                sp.setVelocityX(dir * 180); sp.anims.play('spider_walk', true);
                sp.setTint(0xff6666); sp.flipX = dir < 0;
                if (Math.random() < 0.25) this._runDust(sp.x, sp.y + 12, 0xff7777);
            } else {
                let timer = sp.getData('fleeTimer') || 0;
                if (timer > 0) { sp.setData('fleeTimer', timer - 1); }
                else {
                    sp.setData('fleeing', false); sp.clearTint();
                    let vx = sp.body.velocity.x;
                    if (Math.abs(vx) !== 80) { vx = sp.getData('dir') * 80; sp.setVelocityX(vx); }
                    const sX = sp.getData('startX'), rng = sp.getData('range');
                    if (sp.x <= sX - rng) { sp.setVelocityX(80); sp.setData('dir', 1); sp.flipX = false; }
                    else if (sp.x >= sX + rng) { sp.setVelocityX(-80); sp.setData('dir', -1); sp.flipX = true; }
                    if (sp.body.blocked.left) { sp.setVelocityX(80); sp.setData('dir', 1); sp.flipX = false; }
                    else if (sp.body.blocked.right) { sp.setVelocityX(-80); sp.setData('dir', -1); sp.flipX = true; }
                    sp.anims.play('spider_walk', true);
                }
            }
        });

        // Hanging spider
        const hs = this.hangingSpider;
        const hsState = hs.getData('state'), hsStartY = hs.getData('startY'), hsDropY = hs.getData('dropY');
        const hsLit = this._checkIfLit(hs);
        this.webGraphics.clear();
        this.webGraphics.lineStyle(1.5, 0xbbbbbb, 0.45);
        this.webGraphics.beginPath(); this.webGraphics.moveTo(hs.x, hsStartY - 32); this.webGraphics.lineTo(hs.x, hs.y); this.webGraphics.strokePath();
        if (hsLit) {
            hs.setData('state', 'climbing'); hs.setVelocityY(-160); hs.setTint(0xff6666); hs.anims.play('spider_walk', true);
            if (hs.y <= hsStartY) { hs.y = hsStartY; hs.setVelocityY(0); hs.setData('state','hanging'); hs.clearTint(); hs.anims.stop(); }
        } else {
            hs.clearTint();
            if (hsState === 'hanging') {
                hs.setVelocityY(0);
                if (Math.abs(this.player.x - hs.x) < 140 && this.player.y > hs.y) { hs.setData('state','dropping'); hs.setVelocityY(220); }
            } else if (hsState === 'dropping') {
                hs.anims.play('spider_walk', true);
                if (hs.y >= hsDropY) { hs.y = hsDropY; hs.setVelocityY(0); hs.setData('state','at_bottom'); this.time.delayedCall(1200, () => { if (hs.getData('state')==='at_bottom') { hs.setData('state','climbing'); hs.setVelocityY(-60); } }); }
            } else if (hsState === 'climbing') {
                hs.anims.play('spider_walk', true);
                if (hs.y <= hsStartY) { hs.y = hsStartY; hs.setVelocityY(0); hs.setData('state','hanging'); hs.anims.stop(); }
            }
        }

        // Crumbling logs
        if (this.player.body.blocked.down) {
            const tile = this.layer.getTileAtWorldXY(this.player.x, this.player.y + 24);
            if (tile && tile.index === 5) this._startCrumble(tile);
        }

        // Exit
        const dExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitDoor.x, this.exitDoor.y);
        if (dExit < 40) this._triggerVictory();
    }

    _checkIfLit(target) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
        if (dist > 250) return false;
        const fR = !this.player.flipX;
        if (fR && target.x < this.player.x) return false;
        if (!fR && target.x > this.player.x) return false;
        const dx = Math.abs(target.x - this.player.x);
        return Math.abs(target.y - this.player.y) < Math.tan(0.32) * dx + 32;
    }

    playerDie() {
        if (this.isDead) return;
        this.isDead = true;
        this.cameras.main.shake(250, 0.015);
        this.player.setVelocity(0, 0); this.player.body.enable = false;
        this.tweens.add({ targets: this.player, alpha: 0, duration: 400, onComplete: () => {
            this.player.setPosition(this.currentCheckpoint.x, this.currentCheckpoint.y);
            this.time.delayedCall(400, () => { this.player.alpha = 1; this.player.body.enable = true; this.isDead = false; this.resetSpiders(); });
        }});
    }

    resetSpiders() {
        this.spiders.getChildren().forEach(sp => {
            sp.setPosition(sp.getData('startX'), sp.getData('startY'));
            sp.setVelocityX(sp.getData('dir') * 80);
            sp.setAlpha(1); sp.setData('fleeing', false); sp.setData('fleeTimer', 0); sp.clearTint();
        });
        if (this.hangingSpider) {
            this.hangingSpider.setPosition(22 * 64 + 32, this.hangingSpider.getData('startY'));
            this.hangingSpider.setVelocity(0, 0); this.hangingSpider.setData('state','hanging'); this.hangingSpider.clearTint(); this.hangingSpider.anims.stop();
        }
        if (this.trapdoor) {
            this.trapdoorRetracted = false;
            if (this.lever2) this.lever2.setFrame('0');
            this.trapdoor.setPosition(38.5 * 64, 8 * 64 - 8); this.trapdoor.body.enable = true;
        }
        if (this.crate3) { this.crate3.setPosition(38.5 * 64, 7 * 64); this.crate3.setVelocity(0, 0); }
        this._restoreCrumblingTiles();
    }

    _startCrumble(tile) {
        if (!tile.properties) tile.properties = {};
        if (tile.properties.crumbling) return;
        tile.properties.crumbling = true;
        this.time.addEvent({ delay: 60, repeat: 12, callback: () => { if (!tile || tile.index === -1) return; this._runDust(tile.pixelX + Math.random() * 64, tile.pixelY + Math.random() * 16, 0x444444); } });
        this.cameras.main.shake(150, 0.001);
        this.time.delayedCall(800, () => { this.layer.removeTileAt(tile.x, tile.y); this.cameras.main.shake(150, 0.003); for (let i = 0; i < 8; i++) this._runDust(tile.pixelX + Math.random() * 64, tile.pixelY + 8 + Math.random() * 24, 0x222222); });
    }

    _restoreCrumblingTiles() {
        [[60,7],[62,6],[64,6],[66,7],[68,6],[70,7]].forEach(([x,y]) => {
            if (this.layer) { const t = this.layer.getTileAt(x, y); if (!t || t.index !== 5) this.layer.putTileAt(5, x, y); }
        });
    }

    _triggerVictory() {
        if (this.levelComplete) return;
        this.levelComplete = true;
        this.player.setVelocity(0, 0); this.player.body.enable = false; this.player.anims.play('idle', true);
        this.victoryText.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: this.victoryText, alpha: 1, duration: 800 });
        this.tweens.add({ targets: this.cameras.main, zoom: 1.1, duration: 2000, ease: 'Quad.easeInOut' });

        // Stop level 1 music before transitioning
        const music = this.sound.get('ambient_song');
        if (music && music.isPlaying) music.stop();

        this.time.delayedCall(4000, () => {
            this.cameras.main.fade(1500, 0, 0, 0, false, (camera, progress) => {
                if (progress === 1) {
                    // ── Transition to Level 3 ──
                    this.scene.start('GameScene');
                }
            });
        });
    }

    _runDust(x, y, tint = 0x555555) {
        const d = this.physics.add.sprite(x, y, 'fog');
        d.body.setAllowGravity(false); d.setScale(0.12).setAlpha(0.4).setTint(tint);
        this.tweens.add({ targets: d, scale: 0.3, alpha: 0, y: y - 16, x: x + (Math.random() - 0.5) * 20, duration: 350, onComplete: () => d.destroy() });
    }

    _hint(text) {
        this.hintText.setText(text).setVisible(true);
        if (this.hintTimer) this.hintTimer.remove();
        this.hintTimer = this.time.delayedCall(3000, () => this.hintText.setVisible(false));
    }

    _createParallaxBackground(width, height) {
        [
            { sf: 0.1,  count: 12, alpha: 0.12, tint: 0x1a1a1a, sMin: 1.4, sMax: 2.2, depth: 2 },
            { sf: 0.35, count: 18, alpha: 0.28, tint: 0x111111, sMin: 1.0, sMax: 1.6, depth: 4 },
            { sf: 0.65, count: 14, alpha: 0.50, tint: 0x090909, sMin: 0.8, sMax: 1.2, depth: 6 }
        ].forEach(l => {
            for (let i = 0; i < l.count; i++) {
                const tx = (width / l.count) * i + Math.random() * 80;
                const scale = l.sMin + Math.random() * (l.sMax - l.sMin);
                const ty = 512 - 256 * scale;
                const key = Math.random() > 0.5 ? 'tree_pine' : 'tree_deciduous';
                this.add.image(tx, ty, key).setOrigin(0.5, 0).setScrollFactor(l.sf).setDepth(l.depth).setAlpha(l.alpha).setTint(l.tint).setScale(scale);
            }
        });
    }

    _createFogLayer(depth, speedXFactor, alphaMax) {
        this.add.particles(0, 0, 'fog', {
            x: { min: -100, max: 900 }, y: { min: 200, max: 550 }, quantity: 1, frequency: 400, lifespan: 12000,
            scale: { min: 3, max: 6 }, alpha: { start: 0, end: alphaMax, ease: 'Sine.easeInOut' },
            speedX: { min: 12 * speedXFactor, max: 28 * speedXFactor }, speedY: { min: -4, max: 4 }, rotate: { min: -20, max: 20 }
        }).setScrollFactor(0).setDepth(depth);
    }
}

// ════════════════════════════════════════════════════════════
//  GAME SCENE — NIVEL 3: EL ESPEJISMO DE OTOÑO
// ════════════════════════════════════════════════════════════
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        this.canDash       = true;
        this.isDashing     = false;
        this.dashTimer     = 0;
        this.coyoteTimer   = 0;
        this.jumpBufferTimer = 0;
        this.dialogActive  = false;
        this.lastGrounded  = false;
        this.isDead        = false;

        const mapW = 1080, mapH = 160;
        this.mapW = mapW; this.mapH = mapH;
        this.spawnPoint = { x: 30, y: 120 };

        this.cameras.main.setBackgroundColor('#1a100a');

        // Background
        const tex   = this.textures.get('bg_cabin');
        const imgW  = tex.getSourceImage().width;
        const bgScale = (mapH / 500) * 1.15;
        const tileW = imgW * bgScale;
        const tileCount = Math.ceil(mapW / tileW) + 1;
        this.add.rectangle(mapW / 2, mapH / 2, mapW + 60, mapH + 40, 0x1a100a).setDepth(-11);
        for (let i = 0; i < tileCount; i++) {
            this.add.image(i * tileW + tileW / 2, mapH / 2, 'bg_cabin').setDepth(-10).setScale(bgScale).setScrollFactor(0.85, 0.9);
        }

        // Platforms
        this.platforms = this.physics.add.staticGroup();
        const createShelf = (x, y, width) => {
            const r = this.add.rectangle(x, y, width, 6, 0x6e432a).setStrokeStyle(1, 0x472816);
            this.physics.add.existing(r, true); this.platforms.add(r);
        };
        const createCrate3 = (x, y) => {
            const c = this.add.image(x, y, 'crate').setDepth(3);
            this.physics.add.existing(c, true); c.body.setSize(12, 12); this.platforms.add(c);
        };
        this.hazards = this.physics.add.staticGroup();
        const createSpikeRow = (x, y, count) => {
            for (let i = 0; i < count; i++) {
                const sp = this.add.image(x + i * 8, y, 'spike').setDepth(3);
                this.physics.add.existing(sp, true); sp.body.setSize(6, 6).setOffset(1, 2); this.hazards.add(sp);
            }
        };
        const createFloor = (x, width) => {
            const f = this.add.rectangle(x, mapH - 10, width, 20, 0x331c12).setStrokeStyle(2, 0x1f110a);
            this.physics.add.existing(f, true); this.platforms.add(f);
        };

        createFloor(272, 545); createFloor(649, 142); createFloor(877, 165); createFloor(1035, 90);
        createShelf(120, 115, 60); createShelf(220, 95, 80); createShelf(320, 75, 60); createShelf(80, 70, 50);
        createShelf(400, 115, 50); createShelf(470, 100, 45); createShelf(540, 85, 55); createShelf(650, 70, 45);
        createShelf(720, 110, 45); createShelf(810, 88, 50); createShelf(900, 72, 55); createShelf(980, 92, 45); createShelf(1040, 58, 40);
        createCrate3(350, 144); createCrate3(362, 144); createCrate3(430, 144); createCrate3(500, 132); createCrate3(512, 132);
        createCrate3(580, 144); createCrate3(630, 120); createCrate3(642, 120); createCrate3(760, 144);
        createCrate3(850, 120); createCrate3(851, 120); createCrate3(940, 144);
        createSpikeRow(688, 144, 4); createSpikeRow(830, 144, 5); createSpikeRow(808, 84, 3);
        createSpikeRow(960, 144, 3); createSpikeRow(770, 152, 4);

        const leftWall  = this.add.zone(0, mapH / 2, 10, mapH); this.physics.add.existing(leftWall, true); this.platforms.add(leftWall);
        const rightWall = this.add.zone(mapW, mapH / 2, 10, mapH); this.physics.add.existing(rightWall, true); this.platforms.add(rightWall);

        // Player — El Niño (procedural)
        this.setupPlayer();
        this.setupNPC();
        this.setupLeverPuzzle(createShelf);
        this.setupMovingPuzzles();

        // Goal
        this.goal = this.add.rectangle(mapW - 25, 52, 14, 18, 0xffcc44, 0.3).setStrokeStyle(1, 0xffaa22).setDepth(2);
        this.goalGlow = this.add.rectangle(mapW - 25, 52, 8, 10, 0xffee88, 0.6).setDepth(2);
        this.tweens.add({ targets: this.goalGlow, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
        this.goalReached = false;

        // Physics
        this.physics.world.setBounds(0, 0, mapW, mapH + 120);
        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.npc, this.platforms);
        this.physics.add.collider(this.player, this.movingPlatsGroup);
        this.physics.add.overlap(this.player, this.hazards, () => this._killPlayer(), null, this);

        // Camera
        this.cameras.main.setBounds(0, 0, mapW, mapH);
        this.cameras.main.setZoom(CAM_ZOOM);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.fadeIn(600);

        // Controls
        focusGameCanvas();
        this.input.keyboard.enabled = true;
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W, A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S, D: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.keyE     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.input.on('pointerdown', focusGameCanvas);

        // Particles
        this.dustEmitter = this.add.particles(0, 0, 'particle', { speed: { min:10, max:30 }, scale: { start:1, end:0 }, alpha: { start:0.6, end:0 }, lifespan: 300, gravityY: 60, emitting: false, tint: 0xaa9988 }).setDepth(6);
        this.dashEmitter = this.add.particles(0, 0, 'particle', { speed: { min:5, max:20 }, scale: { start:0.8, end:0 }, alpha: { start:0.7, end:0 }, lifespan: 200, emitting: false, tint: 0x88ccff }).setDepth(6);
        this.ambientDust = this.add.particles(0, 0, 'particle', { x: { min:0, max:mapW }, y: { min:0, max:mapH }, speed: { min:1, max:5 }, scale: { start:0.4, end:0 }, alpha: { start:0.25, end:0 }, lifespan: 4000, frequency: 800, tint: 0xffddaa, gravityY: -3 }).setDepth(3);

        if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');

        // Dialogues
        this.npcDialogues = [
            'Bienvenido al Espejismo\nde Otoño, viajero.',
            'Este lugar es mucho más\nsereno que el bosque.',
            'Hay cajas y estantes\nmás adelante. Explora.',
            'Usa la palanca con [E]\npara abrir el paso.',
            'Hay otra palanca que\nactiva una plataforma.',
            'Salta a las plataformas\nque se mueven solas.',
            'Cuidado con los pinchos\ny los huecos vacíos.',
            'Hay una tercera palanca\nmás adelante.',
            '¡Llega hasta el final!'
        ];
        this.introDialogShown = false;

        // ── TÍTULO "El Espejismo de Otoño" ───────────────────
        this._showLevelTitle();

        // Start piano music for level 3
        if (!gameMusic) { gameMusic = new PianoSynth(); gameMusic.start(); }
    }

    _showLevelTitle() {
        const cam = this.cameras.main;
        const cx  = cam.centerX;
        const cy  = cam.centerY;

        // Dark overlay
        const overlay = this.add.rectangle(cx, cy, 800, 600, 0x000000, 0.75).setScrollFactor(0).setDepth(300);

        const mainTitle = this.add.text(cx, cy - 40, 'El Espejismo de Otoño', {
            fontFamily: '"Press Start 2P"', fontSize: '18px',
            color: '#ffcc88', stroke: '#331100', strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0);

        const subTitle = this.add.text(cx, cy + 8, 'NIVEL 3', {
            fontFamily: '"Press Start 2P"', fontSize: '10px',
            color: '#cc9966', stroke: '#221100', strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0);

        const hint = this.add.text(cx, cy + 35, 'WASD / Flechas · SHIFT para Dash · E para Interactuar', {
            fontFamily: '"Press Start 2P"', fontSize: '5px',
            color: '#886644', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0);

        // Fade in
        this.tweens.add({ targets: [mainTitle, subTitle, hint], alpha: 1, duration: 800, ease: 'Sine.easeOut' });
        // Fade out after 3.5s
        this.tweens.add({
            targets: [overlay, mainTitle, subTitle, hint],
            alpha: 0, delay: 3500, duration: 1200, ease: 'Sine.easeIn',
            onComplete: () => { overlay.destroy(); mainTitle.destroy(); subTitle.destroy(); hint.destroy(); }
        });
    }

    setupPlayer() {
        this.player = this.physics.add.sprite(this.spawnPoint.x, this.spawnPoint.y, 'player_procedural', '0');
        this.player.setDepth(5);
        // Scale down the 48px sprite to fit the cozy cabin level (original pixel sprite was 12×16)
        this.player.setScale(0.35);
        this.player.body.setSize(24, 44).setOffset(12, 4);
        this.player.body.setMaxVelocityX(P_MAX_SPD);
        this.player.body.setMaxVelocityY(450);
        this.player.body.setDragX(P_DRAG);
        this.player.setCollideWorldBounds(true);

        if (!this.anims.exists('walk')) {
            this.anims.create({ key: 'walk', frames: [0,1,2,3,4,5].map(f => ({ key:'player_procedural', frame: f.toString() })), frameRate: 10, repeat: -1 });
        }
        if (!this.anims.exists('idle')) {
            this.anims.create({ key: 'idle', frames: [{ key:'player_procedural', frame:'0' }], frameRate: 1 });
        }
        // Map level-3 anim keys to level-1 equivalents
        if (!this.anims.exists('p_idle'))  this.anims.create({ key: 'p_idle', frames: [{ key:'player_procedural', frame:'0' }], frameRate: 3, repeat: -1 });
        if (!this.anims.exists('p_run'))   this.anims.create({ key: 'p_run',  frames: [0,1,2,3,4,5].map(f => ({ key:'player_procedural', frame: f.toString() })), frameRate: 10, repeat: -1 });
        if (!this.anims.exists('p_jump'))  this.anims.create({ key: 'p_jump', frames: [{ key:'player_procedural', frame:'4' }], frameRate: 1 });
        if (!this.anims.exists('p_fall'))  this.anims.create({ key: 'p_fall', frames: [{ key:'player_procedural', frame:'5' }], frameRate: 1 });
        if (!this.anims.exists('p_dash'))  this.anims.create({ key: 'p_dash', frames: [{ key:'player_procedural', frame:'2' }], frameRate: 1 });
    }

    setupNPC() {
        this.npc = this.physics.add.sprite(200, 120, 'ekaterina');
        this.npc.setScale(0.35).setDepth(4);
        this.npc.body.setAllowGravity(false).setImmovable(true);
        this.npc.setCollideWorldBounds(true);
        this.npcPrompt = this.add.text(200, 80, '[E]', { fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#ffcc44', stroke: '#331100', strokeThickness: 1 }).setOrigin(0.5).setDepth(10).setVisible(false);
        this.tweens.add({ targets: this.npcPrompt, y: this.npcPrompt.y - 3, duration: 800, yoyo: true, repeat: -1 });
    }

    setupLeverPuzzle(createShelf) {
        this.leverPulled = false;
        this.leverX = 455; this.leverY = 143;
        this.gate3 = this.add.rectangle(520, 125, 8, 46, 0x442211).setStrokeStyle(1, 0x221100).setDepth(4);
        this.physics.add.existing(this.gate3, true); this.platforms.add(this.gate3);
        this.leverBase   = this.add.rectangle(this.leverX, this.leverY, 6, 4, 0x555555).setDepth(4);
        this.leverHandle = this.add.rectangle(this.leverX, this.leverY - 6, 3, 10, 0xffaa44).setDepth(4);
        this.leverPrompt = this.add.text(this.leverX, this.leverY - 18, '[E]', { fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#ffcc44', stroke: '#331100', strokeThickness: 1 }).setOrigin(0.5).setDepth(10).setVisible(false);
        this.tweens.add({ targets: this.leverPrompt, y: this.leverY - 21, duration: 800, yoyo: true, repeat: -1 });
        createShelf(this.leverX, 128, 30);
    }

    setupMovingPuzzles() {
        this.movingPlatforms = [];
        this.movingPlatsGroup = this.physics.add.group({ immovable: true, allowGravity: false });
        this.gapPlatform  = this._createMovingPlatform(562, 138, 30, 6, 'x', 552, 572, 1800, false);
        this._createMovingPlatform(620, 115, 28, 6, 'y', 108, 132, 2200, true);
        this.gap2Platform = this._createMovingPlatform(777, 138, 28, 6, 'x', 762, 792, 1600, false);
        this._createMovingPlatform(972, 138, 26, 6, 'x', 958, 986, 1400, true);
        this._createMovingPlatform(1040, 108, 26, 6, 'y', 88, 118, 2000, true);

        this.lever2Pulled = false; this.lever2X = 535; this.lever2Y = 143;
        this.lever2Base   = this.add.rectangle(this.lever2X, this.lever2Y, 6, 4, 0x555555).setDepth(4);
        this.lever2Handle = this.add.rectangle(this.lever2X, this.lever2Y - 6, 3, 10, 0xff6644).setDepth(4);
        this.lever2Prompt = this.add.text(this.lever2X, this.lever2Y - 18, '[E]', { fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#ffcc44', stroke: '#331100', strokeThickness: 1 }).setOrigin(0.5).setDepth(10).setVisible(false);
        this.tweens.add({ targets: this.lever2Prompt, y: this.lever2Y - 21, duration: 800, yoyo: true, repeat: -1 });

        this.lever3Pulled = false; this.lever3X = 745; this.lever3Y = 143;
        this.lever3Base   = this.add.rectangle(this.lever3X, this.lever3Y, 6, 4, 0x555555).setDepth(4);
        this.lever3Handle = this.add.rectangle(this.lever3X, this.lever3Y - 6, 3, 10, 0x44ff88).setDepth(4);
        this.lever3Prompt = this.add.text(this.lever3X, this.lever3Y - 18, '[E]', { fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#ffcc44', stroke: '#331100', strokeThickness: 1 }).setOrigin(0.5).setDepth(10).setVisible(false);
        this.tweens.add({ targets: this.lever3Prompt, y: this.lever3Y - 21, duration: 800, yoyo: true, repeat: -1 });
    }

    _createMovingPlatform(x, y, w, h, axis, from, to, duration, active) {
        const plat = this.add.rectangle(x, y, w, h, 0x7a5230).setStrokeStyle(1, 0x472816).setDepth(2);
        this.physics.add.existing(plat);
        plat.body.setImmovable(true).setAllowGravity(false);
        if (!active) { plat.setAlpha(0.35); plat.body.checkCollision.none = true; }
        this.movingPlatsGroup.add(plat);
        const data = { plat, axis, prevX: x, prevY: y, active, tween: null };
        this.movingPlatforms.push(data);
        if (active) this._startPlatformTween(data, from, to, duration);
        return data;
    }

    _startPlatformTween(data, from, to, duration) {
        const prop = data.axis;
        data.plat[prop] = from; data.plat.body.updateFromGameObject();
        data.prevX = data.plat.x; data.prevY = data.plat.y;
        data.tween = this.tweens.add({ targets: data.plat, [prop]: to, duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onUpdate: () => data.plat.body.updateFromGameObject() });
    }

    _pullLever() {
        if (this.leverPulled) return;
        this.leverPulled = true; this.leverPrompt.setVisible(false);
        this.tweens.add({ targets: this.leverHandle, angle: -50, duration: 250, ease: 'Back.easeOut' });
        this.platforms.remove(this.gate3); this.physics.world.disableBody(this.gate3.body);
        this.tweens.add({ targets: this.gate3, y: 85, alpha: 0.15, duration: 400, ease: 'Sine.easeInOut' });
    }

    _pullLever2() {
        if (this.lever2Pulled) return;
        this.lever2Pulled = true; this.lever2Prompt.setVisible(false);
        this.tweens.add({ targets: this.lever2Handle, angle: -50, duration: 250, ease: 'Back.easeOut' });
        this.gapPlatform.active = true; this.gapPlatform.plat.setAlpha(1);
        this.gapPlatform.plat.body.enable = true; this.gapPlatform.plat.body.checkCollision.none = false;
        this.gapPlatform.plat.body.updateFromGameObject();
        this._startPlatformTween(this.gapPlatform, 552, 572, 1800);
    }

    _pullLever3() {
        if (this.lever3Pulled) return;
        this.lever3Pulled = true; this.lever3Prompt.setVisible(false);
        this.tweens.add({ targets: this.lever3Handle, angle: -50, duration: 250, ease: 'Back.easeOut' });
        this.gap2Platform.active = true; this.gap2Platform.plat.setAlpha(1);
        this.gap2Platform.plat.body.enable = true; this.gap2Platform.plat.body.checkCollision.none = false;
        this.gap2Platform.plat.body.updateFromGameObject();
        this._startPlatformTween(this.gap2Platform, 762, 792, 1600);
    }

    _updateMovingPlatforms() {
        const p = this.player;
        for (const mp of this.movingPlatforms) {
            if (!mp.active) continue;
            const plat = mp.plat;
            const dx = plat.x - mp.prevX, dy = plat.y - mp.prevY;
            if ((dx !== 0 || dy !== 0) && p.body.blocked.down) {
                const onPlat = Math.abs(p.x - plat.x) < plat.width / 2 + 4 && p.y <= plat.y + 2 && p.y >= plat.y - 14;
                if (onPlat) { p.x += dx; p.y += dy; }
            }
            mp.prevX = plat.x; mp.prevY = plat.y;
        }
    }

    _killPlayer() {
        if (this.isDead) return;
        this.isDead = true;
        this.player.body.setVelocity(0, 0).setAllowGravity(false);
        this.dustEmitter.setPosition(this.player.x, this.player.y).explode(8);
        this.cameras.main.fadeOut(350, 180, 30, 30);
        this.time.delayedCall(450, () => this.scene.restart());
    }

    _checkVoid() {
        if (this.isDead || this.dialogActive) return;
        if (this.player.y > 148) this._killPlayer();
    }

    _nearPoint(x, y) { return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < 32; }

    _tryInteract() {
        if (!this.leverPulled && this._nearPoint(this.leverX, this.leverY)) { this._pullLever(); return; }
        if (this.leverPulled && !this.lever2Pulled && this._nearPoint(this.lever2X, this.lever2Y)) { this._pullLever2(); return; }
        if (this.lever2Pulled && !this.lever3Pulled && this._nearPoint(this.lever3X, this.lever3Y)) { this._pullLever3(); return; }
        if (this.npcPrompt.visible) this._openDialogSequence();
    }

    _updateLeverProximity() {
        if (this.dialogActive) return;
        this.leverPrompt.setVisible(!this.leverPulled && this._nearPoint(this.leverX, this.leverY));
        this.lever2Prompt.setVisible(this.leverPulled && !this.lever2Pulled && this._nearPoint(this.lever2X, this.lever2Y));
        this.lever3Prompt.setVisible(this.lever2Pulled && !this.lever3Pulled && this._nearPoint(this.lever3X, this.lever3Y));
    }

    _updateGoal() {
        if (this.goalReached || !this.goal) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.goal.x, this.goal.y);
        if (dist < 20) {
            this.goalReached = true;
            this.tweens.add({ targets: [this.goal, this.goalGlow], scaleX: 1.5, scaleY: 1.5, alpha: 1, duration: 400, yoyo: true });
            // Show victory and return to menu
            this.time.delayedCall(1000, () => {
                const cx = this.cameras.main.scrollX + this.cameras.main.width / (2 * CAM_ZOOM);
                const cy = this.cameras.main.scrollY + this.cameras.main.height / (2 * CAM_ZOOM) - 10;
                this.add.text(cx, cy, '¡Nivel 3 Completado!\n¡Bien hecho!', {
                    fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#ffcc88',
                    align: 'center', stroke: '#331100', strokeThickness: 2
                }).setOrigin(0.5).setDepth(100);
                this.cameras.main.fadeOut(3000, 0, 0, 0);
                this.time.delayedCall(3200, () => {
                    if (gameMusic) { gameMusic.isPlaying = false; }
                    this.scene.stop('UIScene');
                    this.scene.start('MenuScene');
                });
            });
        }
    }

    _openDialogSequence() {
        this.dialogActive = true; this.currentDialogIndex = 0;
        this.player.body.setVelocity(0, 0).setAccelerationX(0);
        this._showDialogBox(this.npcDialogues[0], 'Ekaterina');
    }

    _showDialogBox(text, speakerName) {
        const cam = this.cameras.main;
        const cx = cam.scrollX + cam.width / (2 * CAM_ZOOM);
        const cy = cam.scrollY + cam.height / (2 * CAM_ZOOM) + 20;
        this._destroyDialogElements();
        this.dialogBox = this.add.rectangle(cx, cy, 100, 30, 0x22130b, 0.95).setStrokeStyle(1, 0xaa6633).setDepth(50);
        if (speakerName) {
            this.dialogName = this.add.text(cx - 46, cy - 12, speakerName, { fontFamily: '"Press Start 2P"', fontSize: '3px', color: '#ffaa44', stroke: '#221100', strokeThickness: 1 }).setDepth(51);
        }
        this.dialogText = this.add.text(cx - 46, cy - 5, text, { fontFamily: '"Press Start 2P"', fontSize: '3.5px', color: '#ffddaa', wordWrap: { width: 90 }, lineSpacing: 3 }).setDepth(51);
        this.dialogAdvance = this.add.text(cx + 42, cy + 10, '▶ (E/Enter)', { fontFamily: '"Press Start 2P"', fontSize: '3px', color: '#ffcc44' }).setDepth(51).setInteractive({ useHandCursor: true });
        this.dialogAdvance.on('pointerdown', () => { this.dialogClickAdvance = true; });
        this.tweens.add({ targets: this.dialogAdvance, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    }

    _destroyDialogElements() {
        if (this.dialogBox)     { this.dialogBox.destroy();     this.dialogBox = null; }
        if (this.dialogName)    { this.dialogName.destroy();    this.dialogName = null; }
        if (this.dialogText)    { this.dialogText.destroy();    this.dialogText = null; }
        if (this.dialogAdvance) { this.dialogAdvance.destroy(); this.dialogAdvance = null; }
    }

    _updateDialog() {
        const advance = Phaser.Input.Keyboard.JustDown(this.keyE) || Phaser.Input.Keyboard.JustDown(this.cursors.space)
            || Phaser.Input.Keyboard.JustDown(this.keyEnter) || Phaser.Input.Keyboard.JustDown(this.cursors.down)
            || Phaser.Input.Keyboard.JustDown(this.wasd.S) || this.dialogClickAdvance;
        this.dialogClickAdvance = false;
        if (!advance) return;
        this.currentDialogIndex++;
        if (this.currentDialogIndex >= this.npcDialogues.length) { this._destroyDialogElements(); this.dialogActive = false; }
        else this._showDialogBox(this.npcDialogues[this.currentDialogIndex], 'Ekaterina');
    }

    update(time, delta) {
        if (this.isDead) return;
        if (this.dialogActive) {
            this.player.body.setVelocityX(0).setAccelerationX(0);
            this.player.anims.play('p_idle', true);
            this._updateDialog(); return;
        }
        const dt = delta;
        const p = this.player, body = p.body;
        const onGround = body.blocked.down;
        const left  = this.cursors.left.isDown  || this.wasd.A.isDown;
        const right = this.cursors.right.isDown || this.wasd.D.isDown;
        const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.space) || Phaser.Input.Keyboard.JustDown(this.wasd.W);
        const jumpHeld    = this.cursors.up.isDown || this.cursors.space.isDown || this.wasd.W.isDown;
        const dashPressed = Phaser.Input.Keyboard.JustDown(this.keyShift);

        if (onGround) this.coyoteTimer = COYOTE_MS; else this.coyoteTimer -= dt;
        if (jumpPressed) this.jumpBufferTimer = JUMP_BUFFER; else this.jumpBufferTimer -= dt;

        if (onGround && !this.lastGrounded) { this.dustEmitter.setPosition(p.x, p.y + 7).explode(4); }
        this.lastGrounded = onGround;

        // Dash
        if (this.isDashing) {
            this.dashTimer -= dt;
            this.dashEmitter.setPosition(p.x, p.y).emitParticle(1);
            if (this.dashTimer <= 0) { this.isDashing = false; body.setAllowGravity(true); body.setMaxVelocityX(P_MAX_SPD); body.setVelocityX(body.velocity.x * 0.3); }
            this._updateAnimation(onGround); this._updateNPCProximity(); this._updateLeverProximity(); return;
        }
        if (dashPressed && this.canDash && !this.isDashing) {
            this.isDashing = true; this.canDash = false; this.dashTimer = DASH_MS;
            body.setAllowGravity(false).setVelocityY(0).setMaxVelocityX(DASH_SPD);
            const dir = p.flipX ? -1 : 1; body.setVelocityX(DASH_SPD * dir);
            this.time.delayedCall(DASH_CD, () => { this.canDash = true; });
            this.dashEmitter.setPosition(p.x, p.y).explode(6);
            this.events.emit('dashUsed');
        }

        // Movement
        if (left)       { body.setAccelerationX(-P_ACCEL); p.setFlipX(true); }
        else if (right) { body.setAccelerationX(P_ACCEL);  p.setFlipX(false); }
        else            { body.setAccelerationX(0); }

        // Jump
        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.isDashing) {
            body.setVelocityY(P_JUMP_VEL); this.coyoteTimer = 0; this.jumpBufferTimer = 0;
            this.dustEmitter.setPosition(p.x, p.y + 7).explode(3);
        }
        if (!jumpHeld && body.velocity.y < P_JUMP_CUT) body.setVelocityY(P_JUMP_CUT);

        this._updateAnimation(onGround);
        this._updateNPCProximity();
        this._updateLeverProximity();
        this._updateMovingPlatforms();
        this._checkVoid();
        this._updateGoal();

        if ((Phaser.Input.Keyboard.JustDown(this.keyE) || Phaser.Input.Keyboard.JustDown(this.keyEnter)) && !this.dialogActive) {
            this._tryInteract();
        }
    }

    _updateAnimation(onGround) {
        const p = this.player;
        if (this.isDashing) p.anims.play('p_dash', true);
        else if (onGround) { if (Math.abs(p.body.velocity.x) > 10) p.anims.play('p_run', true); else p.anims.play('p_idle', true); }
        else { if (p.body.velocity.y < 0) p.anims.play('p_jump', true); else p.anims.play('p_fall', true); }
    }

    _updateNPCProximity() {
        if (!this.npc || !this.player) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y);
        const near = dist < 30 && !this.dialogActive;
        this.npcPrompt.setVisible(near);
        if (this.npcPrompt.visible) this.npcPrompt.setPosition(this.npc.x, this.npc.y - 20);
        if (near && !this.introDialogShown) { this.introDialogShown = true; this._openDialogSequence(); }
    }
}

// ════════════════════════════════════════════════════════════
//  UI SCENE (nivel 3 HUD)
// ════════════════════════════════════════════════════════════
class UIScene extends Phaser.Scene {
    constructor() { super('UIScene'); }
    create() {
        this.dashIcon = this.add.image(16, 16, 'dash_icon').setScale(2).setScrollFactor(0);
        this.dashLabel = this.add.text(30, 12, 'DASH', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#55aaff', stroke: '#000', strokeThickness: 2 }).setScrollFactor(0);
        this.dashCooldownOverlay = this.add.rectangle(16, 16, 16, 16, 0x000000, 0.7).setScrollFactor(0).setVisible(false);
        const gameScene = this.scene.get('GameScene');
        gameScene.events.on('dashUsed', () => {
            this.dashCooldownOverlay.setVisible(true);
            this.dashLabel.setColor('#555555'); this.dashIcon.setAlpha(0.3);
            this.time.delayedCall(DASH_CD, () => {
                this.dashCooldownOverlay.setVisible(false);
                this.dashLabel.setColor('#55aaff'); this.dashIcon.setAlpha(1);
                this.tweens.add({ targets: this.dashIcon, scaleX: 3, scaleY: 3, duration: 150, yoyo: true });
            });
        });
        this.add.rectangle(400, 300, 800, 600, 0xff8822, 0.05).setScrollFactor(0).setDepth(100);
        const vg = this.add.graphics().setScrollFactor(0).setDepth(99);
        vg.fillStyle(0x000000, 0.25);
        vg.fillRect(0, 0, 800, 40); vg.fillRect(0, 560, 800, 40);
        vg.fillRect(0, 0, 40, 600); vg.fillRect(760, 0, 40, 600);
    }
}

// ════════════════════════════════════════════════════════════
//  PHASER CONFIG
// ════════════════════════════════════════════════════════════
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#000000',
    pixelArt: true,
    input: { keyboard: { target: window } },
    physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY }, debug: false } },
    scene: [BootScene, MenuScene, MainScene, GameScene, UIScene]
};

const game = new Phaser.Game(config);

function focusGameCanvas() {
    const canvas = game.canvas;
    if (!canvas) return;
    canvas.setAttribute('tabindex', '1');
    canvas.style.outline = 'none';
    canvas.focus();
}

game.events.once('ready', focusGameCanvas);
document.getElementById('game-container').addEventListener('pointerdown', focusGameCanvas);