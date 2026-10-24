/* ==========================================================================
   GALACTIC INVASION — HTML5 Canvas arcade (Vanilla JS, không thư viện)
   Ghi chú cân bằng:
   - Các giá trị "pixel/frame" của GDD được quy đổi sang pixel/giây bằng REF_FPS = 60.
   - Tốc độ formation (25, 30, ...) là đơn vị cân bằng; nhân với enemy.speedScale
     để ra pixel/giây thực tế (xem CONFIG.enemy.speedScale).
   ========================================================================== */
(() => {
    'use strict';

    /* ======================================================================
       CONFIG
       ====================================================================== */
    const CONFIG = {
        refFps: 60,
        canvas: { width: 700, height: 700 },
        player: {
            width: 32, height: 24, y: 625, margin: 10,
            speed: 5,              // px/frame @60FPS
            bulletSpeed: 8,        // px/frame @60FPS
            bulletWidth: 3, bulletHeight: 12,
            cooldown: 250,         // ms
            lives: 3,
            respawnDelay: 1000,    // ms
            invulnerable: 1500     // ms sau khi hồi sinh
        },
        enemy: {
            width: 32, height: 24,
            cellW: 44, cellH: 34,  // khoảng cách ô lưới formation
            startY: 80, wallMargin: 12,
            dropDistance: 18,
            baseSpeed: 25, speedPerLevel: 5, speedPerKill: 0.5,
            speedScale: 2.2,       // quy đổi đơn vị cân bằng -> px/giây
            bullet: { width: 4, height: 10, speed: 4 },   // speed: px/frame @60FPS
            fireMin: 700, fireMax: 1800,                  // ms
            baseMaxBullets: 3, maxBulletsCap: 6,
            aimChance: 0.35        // xác suất chọn enemy gần người chơi nhất
        },
        levels: [
            null,
            { rows: 5, cols: 11 }, { rows: 5, cols: 11 }, { rows: 5, cols: 11 },
            { rows: 5, cols: 12 }, { rows: 6, cols: 12 }, { rows: 6, cols: 13 }
        ],
        shield: {
            count: 4, hp: 20, cell: 5, y: 510,
            // mẫu bunker 14 x 8 cell = 70 x 40 px
            shape: [
                '00011111111000',
                '00111111111100',
                '01111111111110',
                '11111111111111',
                '11111111111111',
                '11111111111111',
                '11111000011111',
                '11110000001111'
            ]
        },
        score: { levelBonus: 500 },
        timing: { levelCompleteDelay: 1500 },
        fx: {
            particleMin: 8, particleMax: 15,
            particleLifeMin: 0.3, particleLifeMax: 0.5,
            maxParticles: 400,
            starCount: 90
        },
        storageKey: 'galactic_invasion_highscore'
    };

    const W = CONFIG.canvas.width;
    const H = CONFIG.canvas.height;
    const REF = CONFIG.refFps;

    const STATE = {
        MENU: 'MENU', PLAYING: 'PLAYING', PLAYER_HIT: 'PLAYER_HIT',
        LEVEL_COMPLETE: 'LEVEL_COMPLETE', GAME_OVER: 'GAME_OVER', PAUSED: 'PAUSED'
    };

    const ENEMY_TYPES = {
        scout:   { key: 'scout',   color: '#FF2020', score: 30, hp: 1 },
        soldier: { key: 'soldier', color: '#20FF40', score: 20, hp: 1 },
        grunt:   { key: 'grunt',   color: '#2090FF', score: 10, hp: 1 }
    };

    const COLORS = {
        player: '#39FF14', playerAccent: '#CFFFFF', ui: '#FFFFFF',
        cyan: '#19E6FF', special: '#FF20FF'
    };

    /* ======================================================================
       UTILS
       ====================================================================== */
    const rand = (a, b) => a + Math.random() * (b - a);
    const randInt = (a, b) => Math.floor(rand(a, b + 1));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');

    function overlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // Rect quét (swept) của viên đạn trong frame này để tránh xuyên qua vật thể mỏng.
    const SWEPT = { x: 0, y: 0, w: 0, h: 0 };
    function sweptRect(b) {
        const top = Math.min(b.y, b.prevY);
        const bottom = Math.max(b.y, b.prevY) + b.h;
        SWEPT.x = b.x; SWEPT.y = top; SWEPT.w = b.w; SWEPT.h = bottom - top;
        return SWEPT;
    }

    /* ======================================================================
       STORAGE (high score)
       ====================================================================== */
    const HighScore = {
        load() {
            try {
                const v = parseInt(localStorage.getItem(CONFIG.storageKey), 10);
                return Number.isFinite(v) && v > 0 ? v : 0;
            } catch (e) { return 0; }
        },
        save(v) {
            try { localStorage.setItem(CONFIG.storageKey, String(v)); } catch (e) { /* bỏ qua */ }
        }
    };

    /* ======================================================================
       GAME STATE
       ====================================================================== */
    const Game = {
        state: STATE.MENU,
        prevState: STATE.MENU,   // state trước khi pause
        score: 0,
        hi: 0,
        newHigh: false,
        level: 1,
        lives: CONFIG.player.lives,
        time: 0,                 // đồng hồ game (giây), dừng khi pause
        stateTimer: 0,
        enemyFireIn: 1
    };

    /* ======================================================================
       AUDIO (Web Audio API, tổng hợp 100%)
       ====================================================================== */
    const Sound = {
        ctx: null, master: null, noiseBuf: null, ok: true,

        init() {
            if (!this.ok) return;
            try {
                if (!this.ctx) {
                    const AC = window.AudioContext || window.webkitAudioContext;
                    if (!AC) { this.ok = false; return; }
                    this.ctx = new AC();
                    this.master = this.ctx.createGain();
                    this.master.gain.value = 0.22;
                    this.master.connect(this.ctx.destination);
                    const len = Math.floor(this.ctx.sampleRate * 0.8);
                    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                    const data = this.noiseBuf.getChannelData(0);
                    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
                }
                if (this.ctx.state === 'suspended') this.ctx.resume();
            } catch (e) { this.ok = false; }
        },

        ready() { return this.ok && this.ctx && this.ctx.state === 'running'; },

        tone(freq, freqEnd, dur, type, vol, delay = 0) {
            if (!this.ready()) return;
            try {
                const c = this.ctx, t = c.currentTime + delay;
                const o = c.createOscillator(), g = c.createGain();
                o.type = type;
                o.frequency.setValueAtTime(freq, t);
                if (freqEnd && freqEnd !== freq) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
                g.gain.setValueAtTime(vol, t);
                g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                o.connect(g); g.connect(this.master);
                o.start(t); o.stop(t + dur + 0.03);
            } catch (e) { /* bỏ qua lỗi audio */ }
        },

        noise(dur, vol, f0, f1, delay = 0) {
            if (!this.ready()) return;
            try {
                const c = this.ctx, t = c.currentTime + delay;
                const src = c.createBufferSource();
                src.buffer = this.noiseBuf;
                const filt = c.createBiquadFilter();
                filt.type = 'lowpass';
                filt.frequency.setValueAtTime(f0, t);
                filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
                const g = c.createGain();
                g.gain.setValueAtTime(vol, t);
                g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                src.connect(filt); filt.connect(g); g.connect(this.master);
                src.start(t); src.stop(t + dur + 0.03);
            } catch (e) { /* bỏ qua lỗi audio */ }
        },

        shoot()         { this.tone(900, 200, 0.12, 'square', 0.32); },
        enemyHit()      { this.tone(660, 990, 0.06, 'square', 0.22); },
        enemyDestroy()  { this.noise(0.25, 0.45, 2400, 200); this.tone(220, 50, 0.2, 'sawtooth', 0.22); },
        playerHit()     { this.noise(0.6, 0.7, 900, 60); this.tone(110, 30, 0.5, 'sawtooth', 0.4); },
        shieldHit()     { this.tone(160, 90, 0.08, 'square', 0.22); this.noise(0.07, 0.25, 1500, 500); },
        levelComplete() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.25, i * 0.12)); },
        gameOver()      { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.22, 'triangle', 0.35, i * 0.2)); }
    };

    /* ======================================================================
       SPRITES (pixel art vẽ bằng code, cache vào canvas offscreen)
       ====================================================================== */
    // Mỗi hàng là nửa trái (8 ký tự), được phản chiếu thành sprite 16 cột x 12 hàng.
    const SPRITE_DATA = {
        player: [
            '00000001', '00000001', '00000011', '00000011', '00000122', '01000122',
            '01101111', '01111111', '01111111', '11111111', '11111001', '11100000'
        ],
        scout: [[
            '00000001', '00000011', '00000111', '00001111', '00011111', '00011211',
            '00011111', '00001111', '00000110', '00001001', '00010010', '00100001'
        ], [
            '00000001', '00000011', '00000111', '00001111', '00011111', '00011211',
            '00011111', '00001111', '00000110', '00010001', '00100010', '00010001'
        ]],
        soldier: [[
            '00100000', '00010001', '00011111', '00111111', '01121111', '11111111',
            '11111111', '10111111', '10100000', '10100111', '00011000', '00000000'
        ], [
            '00100010', '10010001', '10011111', '10111111', '11121111', '11111111',
            '01111111', '00111111', '00100000', '01000111', '10000000', '00000000'
        ]],
        grunt: [[
            '00000111', '00011111', '00111111', '01111111', '11112211', '11111111',
            '11111111', '00011100', '00110011', '01100000', '11000011', '00000000'
        ], [
            '00000111', '00011111', '00111111', '01111111', '11112211', '11111111',
            '11111111', '00011100', '01100011', '11000000', '00011000', '00000000'
        ]]
    };
    const HEART_DATA = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];

    function buildSprite(rows, colors, scale, mirror) {
        const cols = mirror ? rows[0].length * 2 : rows[0].length;
        const cv = document.createElement('canvas');
        cv.width = cols * scale;
        cv.height = rows.length * scale;
        const c = cv.getContext('2d');
        rows.forEach((row, y) => {
            const full = mirror ? row + row.split('').reverse().join('') : row;
            for (let x = 0; x < full.length; x++) {
                const ch = full[x];
                if (ch === '0') continue;
                c.fillStyle = colors[ch] || colors['1'];
                c.fillRect(x * scale, y * scale, scale, scale);
            }
        });
        return cv;
    }

    const Sprites = {
        player: null, heart: null,
        enemy: { scout: [], soldier: [], grunt: [] },
        build() {
            this.player = buildSprite(SPRITE_DATA.player,
                { '1': COLORS.player, '2': COLORS.playerAccent }, 2, true);
            this.heart = buildSprite(HEART_DATA, { '1': '#FF3050' }, 3, false);
            Object.keys(ENEMY_TYPES).forEach((k) => {
                const color = ENEMY_TYPES[k].color;
                this.enemy[k] = SPRITE_DATA[k].map((rows) =>
                    buildSprite(rows, { '1': color, '2': '#FFFFFF' }, 2, true));
            });
        }
    };

    /* ======================================================================
       INPUT (trừu tượng hoá để dễ thêm touch sau này)
       ====================================================================== */
    const Input = {
        keys: new Set(),
        left()  { return this.keys.has('ArrowLeft') || this.keys.has('KeyA'); },
        right() { return this.keys.has('ArrowRight') || this.keys.has('KeyD'); },
        fire()  { return this.keys.has('Space'); },

        init() {
            const prevent = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
            window.addEventListener('keydown', (e) => {
                if (prevent.has(e.code)) e.preventDefault();
                Sound.init(); // kích hoạt audio sau tương tác người dùng
                if (!e.repeat) {
                    if (e.code === 'Enter' || e.code === 'NumpadEnter') onEnter();
                    else if (e.code === 'KeyP') togglePause();
                }
                this.keys.add(e.code);
            });
            window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
            window.addEventListener('blur', () => {
                this.keys.clear();
                if (Game.state === STATE.PLAYING) togglePause();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && Game.state === STATE.PLAYING) togglePause();
            });
        }
    };

    /* ======================================================================
       EFFECTS: particles, popups, shake, flash, stars
       ====================================================================== */
    const FX = {
        particles: [],
        popups: [],
        shakeTime: 0, shakeDur: 0.0001, shakeMag: 0,
        flashAlpha: 0, flashColor: '#FFFFFF', flashDecay: 2,

        reset() {
            this.particles.length = 0;
            this.popups.length = 0;
            this.shakeTime = 0; this.flashAlpha = 0;
        },

        burst(x, y, colors, count, speedMin, speedMax, size) {
            const room = CONFIG.fx.maxParticles - this.particles.length;
            const n = Math.min(count, room);
            for (let i = 0; i < n; i++) {
                const a = rand(0, Math.PI * 2), s = rand(speedMin, speedMax);
                const life = rand(CONFIG.fx.particleLifeMin, CONFIG.fx.particleLifeMax);
                this.particles.push({
                    x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                    life, maxLife: life, size: size || (Math.random() < 0.5 ? 2 : 3),
                    color: colors[randInt(0, colors.length - 1)]
                });
            }
        },

        explosion(x, y, colors, count) {
            this.burst(x, y, colors, count || randInt(CONFIG.fx.particleMin, CONFIG.fx.particleMax), 40, 190);
        },

        popup(x, y, text, color) {
            this.popups.push({ x, y, text, color, life: 0.7, maxLife: 0.7 });
        },

        shake(mag, dur) {
            this.shakeMag = mag; this.shakeDur = dur; this.shakeTime = dur;
        },

        flash(color, alpha, decay) {
            this.flashColor = color; this.flashAlpha = alpha; this.flashDecay = decay || 2.5;
        },

        update(dt) {
            const ps = this.particles;
            for (let i = ps.length - 1; i >= 0; i--) {
                const p = ps[i];
                p.life -= dt;
                if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.vx *= 0.97; p.vy *= 0.97;
            }
            const pp = this.popups;
            for (let i = pp.length - 1; i >= 0; i--) {
                const p = pp[i];
                p.life -= dt; p.y -= 30 * dt;
                if (p.life <= 0) { pp[i] = pp[pp.length - 1]; pp.pop(); }
            }
            if (this.shakeTime > 0) this.shakeTime -= dt;
            if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - this.flashDecay * dt);
        },

        shakeOffset() {
            if (this.shakeTime <= 0) return { x: 0, y: 0 };
            const k = this.shakeMag * (this.shakeTime / this.shakeDur);
            return { x: (Math.random() * 2 - 1) * k, y: (Math.random() * 2 - 1) * k };
        }
    };

    const Stars = {
        list: [],
        init() {
            this.list.length = 0;
            for (let i = 0; i < CONFIG.fx.starCount; i++) {
                this.list.push({
                    x: rand(0, W), y: rand(0, H),
                    size: Math.random() < 0.8 ? 1 : 2,
                    v: rand(6, 28), b: rand(0.25, 0.9), t: rand(0, 6.28)
                });
            }
        },
        update(dt) {
            for (const s of this.list) {
                s.y += s.v * dt;
                if (s.y > H) { s.y = 0; s.x = rand(0, W); }
            }
        },
        render(ctx) {
            for (const s of this.list) {
                const a = s.b * (0.75 + 0.25 * Math.sin(Game.time * 2 + s.t));
                ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
                ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
            }
        }
    };

    /* ======================================================================
       PLAYER
       ====================================================================== */
    const Player = {
        x: 0, y: CONFIG.player.y, w: CONFIG.player.width, h: CONFIG.player.height,
        lastShot: -Infinity, invuln: 0, muzzle: 0, visible: true,
        bullet: null,

        resetPosition() {
            this.x = (W - this.w) / 2;
            this.y = CONFIG.player.y;
        },

        reset() {
            this.resetPosition();
            this.lastShot = -Infinity;
            this.invuln = 0; this.muzzle = 0; this.visible = true;
            this.bullet = null;
        },

        update(dt) {
            if (Game.state === STATE.PLAYING) {
                const dir = (Input.right() ? 1 : 0) - (Input.left() ? 1 : 0);
                this.x += dir * CONFIG.player.speed * REF * dt;
                this.x = clamp(this.x, CONFIG.player.margin, W - this.w - CONFIG.player.margin);
                if (Input.fire()) this.tryShoot();
                if (this.invuln > 0) this.invuln -= dt;
            }
            if (this.muzzle > 0) this.muzzle -= dt;
        },

        tryShoot() {
            if (this.bullet) return;                                   // tối đa 1 đạn
            if (Game.time - this.lastShot < CONFIG.player.cooldown / 1000) return;
            const c = CONFIG.player;
            this.bullet = {
                x: this.x + this.w / 2 - c.bulletWidth / 2,
                y: this.y - c.bulletHeight, prevY: this.y - c.bulletHeight,
                w: c.bulletWidth, h: c.bulletHeight, speed: c.bulletSpeed * REF
            };
            this.lastShot = Game.time;
            this.muzzle = 0.06;
            Sound.shoot();
        },

        updateBullet(dt) {
            const b = this.bullet;
            if (!b) return;
            b.prevY = b.y;
            b.y -= b.speed * dt;
            if (b.y + b.h < 0) this.bullet = null;
        },

        render(ctx) {
            if (!this.visible) return;
            if (this.invuln > 0 && Math.floor(Game.time * 14) % 2 === 0) return; // nhấp nháy khi bất tử
            ctx.drawImage(Sprites.player, Math.round(this.x), Math.round(this.y));
            if (this.muzzle > 0) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(Math.round(this.x + this.w / 2 - 3), Math.round(this.y - 5), 6, 5);
            }
        }
    };

    /* ======================================================================
       ENEMY FORMATION
       ====================================================================== */
    function getLayout(level) {
        if (level < CONFIG.levels.length) return CONFIG.levels[level];
        return { rows: Math.min(7, 6 + Math.floor((level - 6) / 3)), cols: 13 };
    }

    function enemyTypeForRow(row) {
        if (row === 0) return ENEMY_TYPES.scout;
        if (row <= 2) return ENEMY_TYPES.soldier;
        return ENEMY_TYPES.grunt;
    }

    const Formation = {
        enemies: [], x: 0, y: 0, dir: 1, rows: 0, cols: 0,
        destroyed: 0, total: 0, animFrame: 0, animAccum: 0, _best: [],

        init(level) {
            const L = getLayout(level);
            const E = CONFIG.enemy;
            this.rows = L.rows; this.cols = L.cols;
            this.enemies.length = 0;
            for (let r = 0; r < L.rows; r++) {
                for (let c = 0; c < L.cols; c++) {
                    this.enemies.push({
                        row: r, col: c, type: enemyTypeForRow(r),
                        x: 0, y: 0, w: E.width, h: E.height
                    });
                }
            }
            this.total = this.enemies.length;
            this.destroyed = 0;
            this.dir = 1;
            this.animFrame = 0; this.animAccum = 0;
            const totalW = (L.cols - 1) * E.cellW + E.width;
            this.x = (W - totalW) / 2;       // căn giữa
            this.y = E.startY;
            this.layout();
        },

        get count() { return this.enemies.length; },

        layout() {
            const E = CONFIG.enemy;
            for (const e of this.enemies) {
                e.x = this.x + e.col * E.cellW;
                e.y = this.y + e.row * E.cellH;
            }
        },

        baseSpeed(level) {
            return CONFIG.enemy.baseSpeed + CONFIG.enemy.speedPerLevel * (level - 1);
        },

        // formationSpeed = baseSpeed + destroyedCount * 0.5 (rồi quy đổi sang px/s)
        currentSpeed() {
            const s = this.baseSpeed(Game.level) + this.destroyed * CONFIG.enemy.speedPerKill;
            return s * CONFIG.enemy.speedScale;
        },

        bounds() {
            let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const e of this.enemies) {
                if (e.x < minX) minX = e.x;
                if (e.x + e.w > maxX) maxX = e.x + e.w;
                if (e.y + e.h > maxY) maxY = e.y + e.h;
            }
            return { minX, maxX, maxY };
        },

        drop() {
            this.y += CONFIG.enemy.dropDistance;
            this.animFrame ^= 1;
            this.layout();
        },

        update(dt) {
            if (!this.enemies.length) return;
            const move = this.dir * this.currentSpeed() * dt;
            this.x += move;
            this.animAccum += Math.abs(move);
            if (this.animAccum >= 14) { this.animAccum = 0; this.animFrame ^= 1; }
            this.layout();
            const m = CONFIG.enemy.wallMargin;
            const b = this.bounds();
            if (b.maxX > W - m) {
                this.x -= b.maxX - (W - m);
                this.dir = -1; this.drop();
            } else if (b.minX < m) {
                this.x += m - b.minX;
                this.dir = 1; this.drop();
            }
        },

        maxY() { return this.enemies.length ? this.bounds().maxY : 0; },

        pullBack() { this.y = CONFIG.enemy.startY; this.layout(); },

        remove(e) {
            const i = this.enemies.indexOf(e);
            if (i >= 0) this.enemies.splice(i, 1);
        },

        // Enemy thấp nhất của mỗi cột là ứng viên bắn
        shooters() {
            const best = this._best;
            best.length = this.cols;
            for (let i = 0; i < this.cols; i++) best[i] = null;
            for (const e of this.enemies) {
                if (!best[e.col] || e.row > best[e.col].row) best[e.col] = e;
            }
            return best.filter(Boolean);
        },

        render(ctx) {
            const f = this.animFrame;
            for (const e of this.enemies) {
                ctx.drawImage(Sprites.enemy[e.type.key][f], Math.round(e.x), Math.round(e.y));
            }
        }
    };

    /* ======================================================================
       ENEMY BULLETS + FIRING
       ====================================================================== */
    const EnemyBullets = {
        list: [],

        reset() { this.list.length = 0; },

        maxActive() {
            const E = CONFIG.enemy;
            return Math.min(E.maxBulletsCap, E.baseMaxBullets + Math.floor((Game.level - 1) / 2));
        },

        fireFactor() { return Math.max(0.45, 1 - 0.07 * (Game.level - 1)); },

        scheduleNext() {
            const E = CONFIG.enemy;
            Game.enemyFireIn = rand(E.fireMin, E.fireMax) * this.fireFactor() / 1000;
        },

        tryFire() {
            if (this.list.length >= this.maxActive()) { Game.enemyFireIn = 0.2; return; }
            const cands = Formation.shooters();
            if (!cands.length) return;
            let shooter;
            if (Math.random() < CONFIG.enemy.aimChance) {
                // chọn enemy gần player nhất theo trục ngang để tạo áp lực công bằng
                const px = Player.x + Player.w / 2;
                shooter = cands[0];
                for (const e of cands) {
                    if (Math.abs(e.x + e.w / 2 - px) < Math.abs(shooter.x + shooter.w / 2 - px)) shooter = e;
                }
            } else {
                shooter = cands[randInt(0, cands.length - 1)];
            }
            const B = CONFIG.enemy.bullet;
            const speed = B.speed * (1 + Math.min(Game.level - 1, 10) * 0.03) * REF;
            this.list.push({
                x: shooter.x + shooter.w / 2 - B.width / 2,
                y: shooter.y + shooter.h, prevY: shooter.y + shooter.h,
                w: B.width, h: B.height, speed, color: shooter.type.color, dead: false
            });
            this.scheduleNext();
        },

        update(dt) {
            Game.enemyFireIn -= dt;
            if (Game.enemyFireIn <= 0) this.tryFire();
            for (const b of this.list) {
                b.prevY = b.y;
                b.y += b.speed * dt;
                if (b.y > H) b.dead = true;
            }
            this.compact();
        },

        compact() {
            const l = this.list;
            let j = 0;
            for (let i = 0; i < l.length; i++) if (!l[i].dead) l[j++] = l[i];
            l.length = j;
        },

        render(ctx) {
            for (const b of this.list) {
                ctx.fillStyle = b.color;
                const alt = Math.floor(Game.time * 20 + b.y / 6) % 2 ? 1 : -1; // zig-zag
                ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, 5);
                ctx.fillRect(Math.round(b.x + alt), Math.round(b.y + 5), b.w, 5);
            }
        }
    };

    /* ======================================================================
       SHIELDS (pixel damage)
       ====================================================================== */
    const Shields = {
        list: [],

        init() {
            const S = CONFIG.shield;
            const rows = S.shape.length, cols = S.shape[0].length;
            this.list.length = 0;
            for (let i = 0; i < S.count; i++) {
                const cells = new Uint8Array(rows * cols);
                let count = 0;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        if (S.shape[r][c] === '1') { cells[r * cols + c] = 1; count++; }
                    }
                }
                const w = cols * S.cell, h = rows * S.cell;
                const cx = W * (i + 0.5) / S.count;
                this.list.push({
                    x: Math.round(cx - w / 2), y: S.y, w, h,
                    rows, cols, cells, count, hp: S.hp, alive: true
                });
            }
        },

        top() { return CONFIG.shield.y; },

        // Phá cụm cell quanh điểm va chạm
        damageAt(s, hr, hc, goingDown) {
            const dirR = goingDown ? 1 : -1;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if ((dr === 0 && dc === 0) || Math.random() < 0.5) this.killCell(s, hr + dr, hc + dc);
                }
            }
            // xuyên sâu thêm một lớp theo hướng đạn
            if (Math.random() < 0.7) this.killCell(s, hr + dirR * 2, hc);
            s.hp--;
            if (s.hp <= 0 || s.count <= 0) this.destroy(s);
        },

        killCell(s, r, c) {
            if (r < 0 || c < 0 || r >= s.rows || c >= s.cols) return;
            const i = r * s.cols + c;
            if (s.cells[i]) { s.cells[i] = 0; s.count--; }
        },

        destroy(s) {
            s.alive = false;
            FX.burst(s.x + s.w / 2, s.y + s.h / 2, ['#33FF55', '#C8E03A'], 14, 30, 120, 2);
        },

        // Kiểm tra đạn (rect quét) với 1 bunker. Trả về true nếu có va chạm.
        hit(s, rect, goingDown) {
            if (!s.alive || !overlap(s, rect)) return false;
            const cs = CONFIG.shield.cell;
            const c0 = Math.max(0, Math.floor((rect.x - s.x) / cs));
            const c1 = Math.min(s.cols - 1, Math.floor((rect.x + rect.w - 1 - s.x) / cs));
            const r0 = Math.max(0, Math.floor((rect.y - s.y) / cs));
            const r1 = Math.min(s.rows - 1, Math.floor((rect.y + rect.h - 1 - s.y) / cs));
            let hr = -1, hc = -1;
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    if (!s.cells[r * s.cols + c]) continue;
                    // đạn đi xuống chạm hàng trên cùng trước; đạn đi lên chạm hàng dưới cùng trước
                    if (hr < 0 || (goingDown ? r < hr : r > hr)) { hr = r; hc = c; }
                }
            }
            if (hr < 0) return false;   // đạn bay xuyên qua lỗ khuyết
            FX.burst(s.x + hc * cs + cs / 2, s.y + hr * cs + cs / 2, ['#33FF55'], 4, 20, 90, 2);
            this.damageAt(s, hr, hc, goingDown);
            return true;
        },

        // Enemy chạm bunker: xoá cell bị đè
        trample(s, e) {
            if (!s.alive || !overlap(s, e)) return;
            const cs = CONFIG.shield.cell;
            for (let r = 0; r < s.rows; r++) {
                for (let c = 0; c < s.cols; c++) {
                    if (!s.cells[r * s.cols + c]) continue;
                    const cell = { x: s.x + c * cs, y: s.y + r * cs, w: cs, h: cs };
                    if (overlap(cell, e)) { s.cells[r * s.cols + c] = 0; s.count--; }
                }
            }
            if (s.count <= 0) this.destroy(s);
        },

        render(ctx) {
            const cs = CONFIG.shield.cell;
            for (const s of this.list) {
                if (!s.alive) continue;
                ctx.fillStyle = s.hp > 10 ? '#33FF55' : (s.hp > 5 ? '#C8E03A' : '#FF9A2A');
                for (let r = 0; r < s.rows; r++) {
                    for (let c = 0; c < s.cols; c++) {
                        if (s.cells[r * s.cols + c]) ctx.fillRect(s.x + c * cs, s.y + r * cs, cs, cs);
                    }
                }
            }
        }
    };

    /* ======================================================================
       SCORE
       ====================================================================== */
    const Score = {
        add(n) {
            Game.score += n;
            if (Game.score > Game.hi) {
                Game.hi = Game.score;
                Game.newHigh = true;
                HighScore.save(Game.hi);
            }
        }
    };

    /* ======================================================================
       COMBAT EVENTS
       ====================================================================== */
    function killEnemy(e) {
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        Formation.remove(e);
        Formation.destroyed++;
        Score.add(e.type.score);
        FX.explosion(cx, cy, [e.type.color, '#FFFFFF']);
        FX.popup(cx, cy, '+' + e.type.score, e.type.color);
        Sound.enemyHit();
        Sound.enemyDestroy();
        if (Formation.count === 0) completeLevel();
    }

    function hitPlayer(force) {
        if (Game.state !== STATE.PLAYING) return;
        if (Player.invuln > 0 && !force) return;
        Game.lives--;
        Game.state = STATE.PLAYER_HIT;
        Game.stateTimer = CONFIG.player.respawnDelay / 1000;
        Player.visible = false;
        Player.bullet = null;
        FX.explosion(Player.x + Player.w / 2, Player.y + Player.h / 2,
            [COLORS.player, '#FFFFFF', COLORS.playerAccent], 30);
        FX.flash('#FFFFFF', 0.55, 3);
        FX.shake(5, 0.2);
        Sound.playerHit();
    }

    function completeLevel() {
        Game.state = STATE.LEVEL_COMPLETE;
        Game.stateTimer = CONFIG.timing.levelCompleteDelay / 1000;
        Score.add(CONFIG.score.levelBonus);   // chỉ gọi một lần vì state đã đổi
        Player.bullet = null;
        EnemyBullets.reset();
        FX.flash(COLORS.cyan, 0.35, 1.2);
        FX.shake(3, 0.15);
        Sound.levelComplete();
    }

    function endGame() {
        Game.state = STATE.GAME_OVER;
        if (Game.score >= Game.hi && Game.score > 0) HighScore.save(Game.hi);
        Sound.gameOver();
    }

    function respawnPlayer() {
        Player.resetPosition();
        Player.visible = true;
        Player.invuln = CONFIG.player.invulnerable / 1000;
        Player.bullet = null;
        EnemyBullets.reset();
        Game.state = STATE.PLAYING;
    }

    /* ======================================================================
       COLLISION
       ====================================================================== */
    function resolveCollisions() {
        // 1. Đạn player vs shield, rồi vs enemy
        const pb = Player.bullet;
        if (pb) {
            const rect = sweptRect(pb);
            let consumed = false;
            for (const s of Shields.list) {
                if (Shields.hit(s, rect, false)) { consumed = true; Sound.shieldHit(); break; }
            }
            if (!consumed) {
                for (const e of Formation.enemies) {
                    if (overlap(e, rect)) { Player.bullet = null; consumed = true; killEnemy(e); break; }
                }
            } else {
                Player.bullet = null;
            }
            if (Game.state !== STATE.PLAYING) return;   // level vừa hoàn thành
        }

        // 2. Đạn enemy vs shield, rồi vs player
        for (const b of EnemyBullets.list) {
            if (b.dead) continue;
            const rect = sweptRect(b);
            let consumed = false;
            for (const s of Shields.list) {
                if (Shields.hit(s, rect, true)) { consumed = true; Sound.shieldHit(); break; }
            }
            if (!consumed && Player.visible && Player.invuln <= 0 && overlap(Player, rect)) {
                consumed = true;
                b.dead = true;
                hitPlayer(false);
                break;      // một sự kiện trúng đạn mỗi frame
            }
            if (consumed) b.dead = true;
        }
        EnemyBullets.compact();
        if (Game.state !== STATE.PLAYING) return;

        // 3. Enemy chạm bunker
        if (Formation.maxY() >= Shields.top()) {
            for (const s of Shields.list) {
                if (!s.alive) continue;
                for (const e of Formation.enemies) Shields.trample(s, e);
            }
        }

        // 4. Formation chạm player / tiến vào vùng nguy hiểm (đáy enemy >= đỉnh player)
        if (Formation.maxY() >= Player.y) {
            Formation.pullBack();       // đưa formation về vị trí xuất phát để không lặp mất mạng
            hitPlayer(true);
        }
    }

    /* ======================================================================
       LEVEL / GAME FLOW
       ====================================================================== */
    function setupLevel() {
        Formation.init(Game.level);
        Shields.init();
        EnemyBullets.reset();
        Player.bullet = null;
        EnemyBullets.scheduleNext();
        Game.enemyFireIn = Math.max(Game.enemyFireIn, 0.8);
    }

    function startGame() {
        Game.score = 0;
        Game.newHigh = false;
        Game.level = 1;
        Game.lives = CONFIG.player.lives;
        Game.stateTimer = 0;
        FX.reset();
        Player.reset();
        setupLevel();
        Game.state = STATE.PLAYING;
    }

    function onEnter() {
        if (Game.state === STATE.MENU || Game.state === STATE.GAME_OVER) startGame();
    }

    function togglePause() {
        if (Game.state === STATE.PAUSED) {
            Game.state = Game.prevState;
        } else if (Game.state === STATE.PLAYING || Game.state === STATE.PLAYER_HIT ||
                   Game.state === STATE.LEVEL_COMPLETE) {
            Game.prevState = Game.state;
            Game.state = STATE.PAUSED;
        }
    }

    /* ======================================================================
       UPDATE
       ====================================================================== */
    function updatePlaying(dt) {
        Player.update(dt);              // 1-2. input + movement
        Player.updateBullet(dt);        // 3. player bullet
        Formation.update(dt);           // 4. enemy movement
        EnemyBullets.update(dt);        // 5-6. enemy shooting + bullets
        resolveCollisions();            // 7-8. collision + shield damage
    }

    function update(dt) {
        if (Game.state === STATE.PAUSED) return;   // pause dừng toàn bộ gameplay
        Game.time += dt;
        Stars.update(dt);
        FX.update(dt);                              // 9. particles

        switch (Game.state) {
            case STATE.PLAYING:
                updatePlaying(dt);
                break;
            case STATE.PLAYER_HIT:
                Player.update(dt);
                Game.stateTimer -= dt;
                if (Game.stateTimer <= 0) {
                    if (Game.lives > 0) respawnPlayer(); else endGame();
                }
                break;
            case STATE.LEVEL_COMPLETE:
                Player.update(dt);
                Game.stateTimer -= dt;
                if (Game.stateTimer <= 0) {
                    Game.level++;
                    Player.resetPosition();
                    setupLevel();
                    Game.state = STATE.PLAYING;
                }
                break;
            default:
                break;
        }
    }

    /* ======================================================================
       RENDER
       ====================================================================== */
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let scale = 1;

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = Math.max(1, Math.round((rect.width || W) * dpr));
        if (canvas.width !== size || canvas.height !== size) {
            canvas.width = size; canvas.height = size;
        }
        scale = size / W;
        ctx.imageSmoothingEnabled = false;
    }

    function text(str, x, y, size, color, align) {
        ctx.font = 'bold ' + size + 'px "Courier New", Courier, monospace';
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color || COLORS.ui;
        ctx.fillText(str, x, y);
    }

    function drawHUD() {
        text('SCORE: ' + pad6(Game.score), 16, 28, 18, COLORS.ui, 'left');
        text('HI: ' + pad6(Game.hi), W / 2, 28, 18, COLORS.cyan, 'center');
        text('LEVEL ' + Game.level, W - 16, 28, 18, COLORS.ui, 'right');
        ctx.fillStyle = 'rgba(57,255,20,0.35)';
        ctx.fillRect(0, 656, W, 1);                       // đường mặt đất
        text('LIVES:', 16, 689, 16, COLORS.ui, 'left');
        for (let i = 0; i < Game.lives; i++) ctx.drawImage(Sprites.heart, 84 + i * 26, 674);
    }

    function drawPlayerBullet() {
        const b = Player.bullet;
        if (!b) return;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
        ctx.fillStyle = COLORS.player;
        ctx.fillRect(Math.round(b.x), Math.round(b.y + b.h - 3), b.w, 3);
    }

    function drawParticles() {
        for (const p of FX.particles) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        ctx.globalAlpha = 1;
        for (const p of FX.popups) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            text(p.text, p.x, p.y, 14, p.color, 'center');
        }
        ctx.globalAlpha = 1;
    }

    function drawScene() {
        Shields.render(ctx);
        Formation.render(ctx);
        EnemyBullets.render(ctx);
        drawPlayerBullet();
        Player.render(ctx);
        drawParticles();
        drawHUD();
    }

    function drawMenu() {
        const pulse = 0.85 + 0.15 * Math.sin(Game.time * 3);
        ctx.shadowColor = COLORS.player; ctx.shadowBlur = 16 * pulse;
        text('GALACTIC', W / 2, 150, 64, COLORS.player, 'center');
        ctx.shadowColor = COLORS.cyan;
        text('INVASION', W / 2, 220, 64, COLORS.cyan, 'center');
        ctx.shadowBlur = 0;

        const rows = [['scout', '= 30 PTS'], ['soldier', '= 20 PTS'], ['grunt', '= 10 PTS']];
        rows.forEach((r, i) => {
            const y = 280 + i * 48;
            ctx.drawImage(Sprites.enemy[r[0]][Math.floor(Game.time * 2) % 2], 250, y);
            text(r[1], 310, y + 18, 20, ENEMY_TYPES[r[0]].color, 'left');
        });

        ctx.drawImage(Sprites.player, W / 2 - 16, 450);
        if (Math.floor(Game.time * 2) % 2 === 0) text('PRESS ENTER TO START', W / 2, 540, 26, COLORS.ui, 'center');
        text('HIGH SCORE: ' + pad6(Game.hi), W / 2, 590, 20, COLORS.cyan, 'center');
        text('A/D or ARROWS: MOVE   SPACE: FIRE   P: PAUSE', W / 2, 650, 14, '#889', 'center');
    }

    function dim(alpha) {
        ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
        ctx.fillRect(0, 0, W, H);
    }

    function drawOverlays(state) {
        if (state === STATE.LEVEL_COMPLETE) {
            text('LEVEL CLEAR!', W / 2, 330, 50, COLORS.player, 'center');
            text('BONUS +' + CONFIG.score.levelBonus, W / 2, 375, 24, COLORS.cyan, 'center');
        } else if (state === STATE.GAME_OVER) {
            dim(0.65);
            text('GAME OVER', W / 2, 270, 56, '#FF2020', 'center');
            text('SCORE: ' + pad6(Game.score), W / 2, 335, 24, COLORS.ui, 'center');
            text('HIGH SCORE: ' + pad6(Game.hi), W / 2, 372, 24, COLORS.cyan, 'center');
            if (Game.newHigh) {
                const c = Math.floor(Game.time * 6) % 2 ? COLORS.special : '#FFFF40';
                text('NEW HIGH SCORE!', W / 2, 425, 28, c, 'center');
            }
            if (Math.floor(Game.time * 2) % 2 === 0) text('PRESS ENTER TO RETRY', W / 2, 490, 24, COLORS.ui, 'center');
        }
        if (Game.state === STATE.PAUSED) {
            dim(0.6);
            text('PAUSED', W / 2, 340, 56, COLORS.ui, 'center');
            text('PRESS P TO RESUME', W / 2, 390, 22, COLORS.cyan, 'center');
        }
    }

    function render() {
        const logical = Game.state === STATE.PAUSED ? Game.prevState : Game.state;

        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // Screen shake chỉ là offset khi vẽ, không đụng tới toạ độ gameplay
        const off = Game.state === STATE.PAUSED ? { x: 0, y: 0 } : FX.shakeOffset();
        ctx.setTransform(scale, 0, 0, scale, off.x * scale, off.y * scale);

        Stars.render(ctx);
        if (logical === STATE.MENU) drawMenu(); else drawScene();

        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        if (FX.flashAlpha > 0) {
            ctx.globalAlpha = Math.min(1, FX.flashAlpha);
            ctx.fillStyle = FX.flashColor;
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
        }
        drawOverlays(logical);
    }

    /* ======================================================================
       GAME LOOP (duy nhất một vòng lặp, khởi động một lần)
       ====================================================================== */
    let lastTs = null;
    let loopStarted = false;

    function frame(ts) {
        requestAnimationFrame(frame);
        if (lastTs === null) lastTs = ts;
        const dt = Math.min((ts - lastTs) / 1000, 0.05);   // chặn spike khi tab bị treo
        lastTs = ts;
        try {
            update(dt);
            render();
        } catch (err) {
            console.error('Game error:', err);
        }
    }

    function init() {
        if (loopStarted) return;
        loopStarted = true;
        Game.hi = HighScore.load();
        Sprites.build();
        Stars.init();
        Player.reset();
        Input.init();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        requestAnimationFrame(frame);
    }

    init();
})();
