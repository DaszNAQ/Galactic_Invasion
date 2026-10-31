/* ==========================================================================
   GALACTIC INVASION v2 — "Neon Glass"
   HTML5 Canvas arcade, Vanilla JS, không thư viện, chạy trực tiếp từ file://

   Thay đổi so với v1:
   - Sprite vector phát sáng (supersample, cache offscreen) thay cho pixel-art.
   - HUD / menu / pause / game over chuyển sang DOM (kính mờ, truy cập được).
   - Điều khiển: bàn phím + cảm ứng (đa điểm).
   - Tính năng mới: power-up (bắn nhanh / 3 tia / khiên), combo nhân điểm,
     Top 5 điểm cao cục bộ, bật/tắt âm thanh, banner cấp độ.
   - Logic gameplay gốc (formation, swept collision) được giữ nguyên.
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
            minY: 150,             // giới hạn bay lên (tự do 2 chiều như Chicken Invaders)
            speed: 5,              // px/frame @60FPS
            bulletSpeed: 11,       // px/frame @60FPS (v1: 8)
            bulletWidth: 3, bulletHeight: 12,
            cooldown: 170,         // ms (v1: 250)
            maxBullets: 3,         // đạn tối đa trên màn hình (v1: 1)
            rapidCooldown: 85,     // ms (power-up bắn nhanh)
            rapidMaxBullets: 6,
            spreadAngleVx: 150,    // px/s lệch ngang của tia bên (power-up 3 tia)
            lives: 3,
            respawnDelay: 1000,    // ms
            invulnerable: 1500     // ms sau khi hồi sinh
        },
        enemy: {
            width: 32, height: 24,
            cellW: 44, cellH: 34,
            startY: 80, wallMargin: 12,
            dropDistance: 18,
            baseSpeed: 25, speedPerLevel: 5, speedPerKill: 0.5,
            speedScale: 2.2,
            bullet: { width: 4, height: 10, speed: 4 },
            fireMin: 700, fireMax: 1800,
            baseMaxBullets: 3, maxBulletsCap: 6,
            aimChance: 0.35
        },
        levels: [
            null,
            { rows: 5, cols: 11 }, { rows: 5, cols: 11 }, { rows: 5, cols: 11 },
            { rows: 5, cols: 12 }, { rows: 6, cols: 12 }, { rows: 6, cols: 13 }
        ],
        powerup: {
            dropChance: 0.10, scoutBonus: 0.08, fallSpeed: 95, size: 26, maxOnScreen: 2,
            types: {
                rapid:   { color: '#22d3ee', letter: 'R', duration: 8,  label: 'BẮN NHANH', weight: 4 },
                spread:  { color: '#e879f9', letter: '3', duration: 8,  label: '3 TIA',     weight: 4 },
                barrier: { color: '#4ade80', letter: 'B', duration: 12, label: 'KHIÊN',     weight: 3 }
            }
        },
        combo: { window: 1.4, killsPerStep: 4, maxMult: 5 },
        score: { levelBonus: 500 },
        timing: { levelCompleteDelay: 1500, restartLock: 0.8 },
        fx: {
            particleMin: 8, particleMax: 15,
            particleLifeMin: 0.3, particleLifeMax: 0.5,
            maxParticles: 400,
            starCount: 110
        },
        storage: {
            legacyHigh: 'galactic_invasion_highscore',
            scores: 'galactic_invasion_scores_v2',
            mute: 'galactic_invasion_mute'
        },
        topN: 5
    };

    const W = CONFIG.canvas.width;
    const H = CONFIG.canvas.height;
    const REF = CONFIG.refFps;
    const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const STATE = {
        MENU: 'MENU', PLAYING: 'PLAYING', PLAYER_HIT: 'PLAYER_HIT',
        LEVEL_COMPLETE: 'LEVEL_COMPLETE', GAME_OVER: 'GAME_OVER', PAUSED: 'PAUSED'
    };

    const ENEMY_TYPES = {
        scout:   { key: 'scout',   color: '#ff4d6d', score: 30, hp: 1 },
        soldier: { key: 'soldier', color: '#3dff9a', score: 20, hp: 1 },
        grunt:   { key: 'grunt',   color: '#4da3ff', score: 10, hp: 1 }
    };

    const COLORS = {
        player: '#22d3ee', ui: '#e8f1ff', cyan: '#22d3ee',
        magenta: '#e879f9', amber: '#fbbf24', green: '#4ade80'
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

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function rgba(hex, a) {
        const [r, g, b] = hexToRgb(hex);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    // Rect quét (swept) của viên đạn trong frame này (cả hai trục) để không xuyên vật thể mỏng.
    const SWEPT = { x: 0, y: 0, w: 0, h: 0 };
    function sweptRect(b) {
        const x0 = Math.min(b.x, b.prevX), x1 = Math.max(b.x, b.prevX) + b.w;
        const y0 = Math.min(b.y, b.prevY), y1 = Math.max(b.y, b.prevY) + b.h;
        SWEPT.x = x0; SWEPT.y = y0; SWEPT.w = x1 - x0; SWEPT.h = y1 - y0;
        return SWEPT;
    }

    /* ======================================================================
       STORAGE (an toàn khi localStorage bị chặn)
       ====================================================================== */
    const Store = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* bỏ qua */ } }
    };

    const Scores = {
        list: [],
        load() {
            let l = [];
            try { l = JSON.parse(Store.get(CONFIG.storage.scores) || '[]'); } catch (e) { l = []; }
            l = Array.isArray(l) ? l.filter((n) => Number.isFinite(n) && n > 0) : [];
            if (!l.length) {   // chuyển dữ liệu từ v1
                const old = parseInt(Store.get(CONFIG.storage.legacyHigh), 10);
                if (Number.isFinite(old) && old > 0) l = [old];
            }
            this.list = l.sort((a, b) => b - a).slice(0, CONFIG.topN);
        },
        best() { return this.list[0] || 0; },
        // Trả về hạng (0-based) của điểm vừa nộp, hoặc -1 nếu không vào top.
        submit(score) {
            score = Math.floor(score);
            if (score <= 0) return -1;
            this.list.push(score);
            this.list.sort((a, b) => b - a);
            const rank = this.list.indexOf(score);
            this.list.length = Math.min(this.list.length, CONFIG.topN);
            Store.set(CONFIG.storage.scores, JSON.stringify(this.list));
            Store.set(CONFIG.storage.legacyHigh, this.best());   // giữ tương thích v1
            return rank < CONFIG.topN ? rank : -1;
        }
    };

    /* ======================================================================
       GAME STATE
       ====================================================================== */
    const Game = {
        state: STATE.MENU,
        prevState: STATE.MENU,
        score: 0,
        hi: 0,
        newHigh: false,
        submitted: false,
        level: 1,
        lives: CONFIG.player.lives,
        time: 0,
        stateTimer: 0,
        restartLock: 0,
        enemyFireIn: 1,
        menuBaseX: 0
    };

    /* ======================================================================
       AUDIO (Web Audio API, tổng hợp 100%)
       ====================================================================== */
    const Sound = {
        ctx: null, master: null, noiseBuf: null, ok: true,
        muted: Store.get(CONFIG.storage.mute) === '1',

        init() {
            if (!this.ok) return;
            try {
                if (!this.ctx) {
                    const AC = window.AudioContext || window.webkitAudioContext;
                    if (!AC) { this.ok = false; return; }
                    this.ctx = new AC();
                    this.master = this.ctx.createGain();
                    this.master.gain.value = this.muted ? 0 : 0.22;
                    this.master.connect(this.ctx.destination);
                    const len = Math.floor(this.ctx.sampleRate * 0.8);
                    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                    const data = this.noiseBuf.getChannelData(0);
                    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
                }
                if (this.ctx.state === 'suspended') this.ctx.resume();
            } catch (e) { this.ok = false; }
        },

        setMuted(m) {
            this.muted = m;
            Store.set(CONFIG.storage.mute, m ? '1' : '0');
            if (this.master) this.master.gain.value = m ? 0 : 0.22;
        },

        ready() { return this.ok && !this.muted && this.ctx && this.ctx.state === 'running'; },

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

        shoot()         { this.tone(900, 200, 0.12, 'square', 0.28); },
        enemyHit()      { this.tone(660, 990, 0.06, 'square', 0.18); },
        enemyDestroy()  { this.noise(0.25, 0.45, 2400, 200); this.tone(220, 50, 0.2, 'sawtooth', 0.22); },
        playerHit()     { this.noise(0.6, 0.7, 900, 60); this.tone(110, 30, 0.5, 'sawtooth', 0.4); },
        powerUp()       { [660, 880, 1320].forEach((f, i) => this.tone(f, f * 1.02, 0.09, 'triangle', 0.3, i * 0.07)); },
        barrierBreak()  { this.tone(1200, 200, 0.25, 'triangle', 0.35); this.noise(0.18, 0.3, 4000, 400); },
        levelComplete() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.25, i * 0.12)); },
        gameOver()      { [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.22, 'triangle', 0.35, i * 0.2)); }
    };

    /* ======================================================================
       SPRITES — vector neon, vẽ 1 lần vào canvas offscreen (supersample)
       ====================================================================== */
    const SS = 3;      // hệ số supersample
    const PAD = 10;    // viền để chứa glow

    function makeSprite(w, h, draw) {
        const cv = document.createElement('canvas');
        cv.width = (w + PAD * 2) * SS;
        cv.height = (h + PAD * 2) * SS;
        const c = cv.getContext('2d');
        c.scale(SS, SS);
        c.translate(PAD, PAD);
        draw(c);
        return { cv, w, h, dw: w + PAD * 2, dh: h + PAD * 2 };
    }

    function blit(ctx, s, x, y) {
        ctx.drawImage(s.cv, x - PAD, y - PAD, s.dw, s.dh);
    }

    function neon(c, color, fillA, lw, blur) {
        c.lineJoin = 'round'; c.lineCap = 'round';
        c.shadowColor = color; c.shadowBlur = blur * SS;
        c.lineWidth = lw; c.strokeStyle = color;
        c.fillStyle = rgba(color, fillA);
    }

    function fillStroke(c) { c.fill(); c.stroke(); }

    const ENEMY_DRAW = {
        // Tiêm kích tam giác
        scout(c, f, col) {
            c.save();
            c.beginPath();
            c.moveTo(16, 1);
            c.lineTo(f ? 30.5 : 29, f ? 21 : 19);
            c.lineTo(22, 16); c.lineTo(16, 22); c.lineTo(10, 16);
            c.lineTo(f ? 1.5 : 3, f ? 21 : 19);
            c.closePath();
            neon(c, col, 0.22, 1.7, 7);
            fillStroke(c);
            c.shadowBlur = 0;
            c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
            c.beginPath(); c.moveTo(16, 5); c.lineTo(16, 15); c.stroke();
            c.fillStyle = '#fff';
            c.beginPath(); c.arc(16, 11, 1.8, 0, Math.PI * 2); c.fill();
            c.restore();
        },
        // Chiến binh lục giác có càng
        soldier(c, f, col) {
            c.save();
            c.beginPath();
            c.moveTo(9, 4); c.lineTo(23, 4); c.lineTo(29, 12);
            c.lineTo(23, 20); c.lineTo(9, 20); c.lineTo(3, 12);
            c.closePath();
            neon(c, col, 0.2, 1.7, 7);
            fillStroke(c);
            c.beginPath();
            c.moveTo(3, 12); c.lineTo(0.5, f ? 5 : 15);
            c.moveTo(29, 12); c.lineTo(31.5, f ? 5 : 15);
            c.stroke();
            c.shadowBlur = 0;
            c.fillStyle = 'rgba(255,255,255,.9)';
            c.fillRect(10.5, 10, 11, 3.4);
            c.restore();
        },
        // Đĩa bay mái vòm có chân
        grunt(c, f, col) {
            c.save();
            c.beginPath();
            c.arc(16, 12, 9.5, Math.PI, 0);
            c.closePath();
            neon(c, col, 0.2, 1.7, 7);
            fillStroke(c);
            c.beginPath();
            c.moveTo(4, 12.5); c.lineTo(28, 12.5); c.lineTo(24.5, 17); c.lineTo(7.5, 17); c.closePath();
            fillStroke(c);
            c.beginPath();
            if (f) {
                c.moveTo(10, 17); c.lineTo(6, 23); c.moveTo(22, 17); c.lineTo(26, 23);
                c.moveTo(15, 17); c.lineTo(14, 22.5); c.moveTo(17, 17); c.lineTo(18, 22.5);
            } else {
                c.moveTo(10, 17); c.lineTo(11.5, 23); c.moveTo(22, 17); c.lineTo(20.5, 23);
                c.moveTo(15, 17); c.lineTo(16, 22.5); c.moveTo(17, 17); c.lineTo(16, 22.5);
            }
            c.stroke();
            c.shadowBlur = 0;
            c.fillStyle = '#fff';
            c.beginPath(); c.arc(12.2, 9, 1.7, 0, Math.PI * 2); c.arc(19.8, 9, 1.7, 0, Math.PI * 2); c.fill();
            c.restore();
        }
    };

    function drawPlayerShip(c) {
        c.save();
        c.beginPath();
        c.moveTo(16, 1); c.lineTo(21, 10); c.lineTo(30, 18); c.lineTo(30, 22);
        c.lineTo(22, 20); c.lineTo(19, 23); c.lineTo(13, 23); c.lineTo(10, 20);
        c.lineTo(2, 22); c.lineTo(2, 18); c.lineTo(11, 10);
        c.closePath();
        neon(c, COLORS.player, 0.2, 1.8, 8);
        fillStroke(c);
        c.shadowBlur = 0;
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(11, 10); c.lineTo(11, 19); c.moveTo(21, 10); c.lineTo(21, 19); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.92)';
        c.beginPath(); c.moveTo(16, 6); c.lineTo(18.6, 12.5); c.lineTo(16, 15); c.lineTo(13.4, 12.5); c.closePath(); c.fill();
        c.restore();
    }

    function drawCapsule(c, def) {
        const s = CONFIG.powerup.size, r = s / 2;
        c.save();
        c.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = Math.PI / 6 + i * Math.PI / 3;
            const px = r + Math.cos(a) * (r - 1.5), py = r + Math.sin(a) * (r - 1.5);
            if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath();
        neon(c, def.color, 0.28, 1.8, 8);
        fillStroke(c);
        c.shadowBlur = 0;
        c.fillStyle = '#fff';
        c.font = '700 13px "Orbitron", "Courier New", monospace';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(def.letter, r, r + 0.5);
        c.restore();
    }

    function makeGlow(color) {
        const s = 40, cv = document.createElement('canvas');
        cv.width = cv.height = s;
        const c = cv.getContext('2d');
        const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, rgba(color, 0.85));
        g.addColorStop(0.35, rgba(color, 0.28));
        g.addColorStop(1, rgba(color, 0));
        c.fillStyle = g; c.fillRect(0, 0, s, s);
        return cv;
    }
    const glowCache = {};
    function glow(color) { return glowCache[color] || (glowCache[color] = makeGlow(color)); }
    function drawGlow(ctx, color, x, y, size) {
        ctx.drawImage(glow(color), x - size / 2, y - size / 2, size, size);
    }

    const Sprites = {
        player: null, capsule: {}, enemy: { scout: [], soldier: [], grunt: [] },
        build() {
            this.player = makeSprite(CONFIG.player.width, CONFIG.player.height, drawPlayerShip);
            Object.keys(ENEMY_TYPES).forEach((k) => {
                const col = ENEMY_TYPES[k].color;
                this.enemy[k] = [0, 1].map((f) =>
                    makeSprite(CONFIG.enemy.width, CONFIG.enemy.height, (c) => ENEMY_DRAW[k](c, f, col)));
            });
            Object.keys(CONFIG.powerup.types).forEach((k) => {
                const def = CONFIG.powerup.types[k];
                this.capsule[k] = makeSprite(CONFIG.powerup.size, CONFIG.powerup.size, (c) => drawCapsule(c, def));
            });
        },
        // Vẽ icon kẻ địch vào các <canvas> trong menu
        paintLegend() {
            document.querySelectorAll('canvas[data-enemy]').forEach((el) => {
                const s = this.enemy[el.dataset.enemy][0];
                el.width = s.cv.width; el.height = s.cv.height;
                el.getContext('2d').drawImage(s.cv, 0, 0);
            });
        }
    };

    /* ======================================================================
       INPUT: bàn phím + cảm ứng
       ====================================================================== */
    const Input = {
        keys: new Set(),
        touch: { left: false, right: false, up: false, down: false, fire: false },

        left()  { return this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touch.left; },
        right() { return this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touch.right; },
        up()    { return this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.touch.up; },
        down()  { return this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.touch.down; },
        fire()  { return this.keys.has('Space') || this.touch.fire; },

        init() {
            const prevent = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
            window.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                if (prevent.has(e.code)) e.preventDefault();
                Sound.init();
                if (!e.repeat) {
                    if (e.code === 'Enter' || e.code === 'NumpadEnter') onEnter();
                    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
                    else if (e.code === 'KeyM') toggleMute();
                }
                this.keys.add(e.code);
            });
            window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
            window.addEventListener('blur', () => {
                this.keys.clear();
                this.touch.left = this.touch.right = this.touch.up = this.touch.down = this.touch.fire = false;
                if (Game.state === STATE.PLAYING) togglePause();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && Game.state === STATE.PLAYING) togglePause();
            });

            // Nút cảm ứng giữ-để-điều-khiển (đa điểm nhờ Pointer Events)
            const hold = (id, key) => {
                const el = document.getElementById(id);
                if (!el) return;
                const down = (e) => {
                    e.preventDefault();
                    Sound.init();
                    this.touch[key] = true;
                    el.classList.add('down');
                    try { el.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
                };
                const up = () => { this.touch[key] = false; el.classList.remove('down'); };
                el.addEventListener('pointerdown', down);
                ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => el.addEventListener(t, up));
                el.addEventListener('contextmenu', (e) => e.preventDefault());
            };
            hold('t-left', 'left'); hold('t-right', 'right'); hold('t-up', 'up'); hold('t-down', 'down'); hold('t-fire', 'fire');
        },

    };

    /* ======================================================================
       EFFECTS: particles, rings, popups, shake, flash, parallax stars
       ====================================================================== */
    const FX = {
        particles: [], popups: [], rings: [],
        shakeTime: 0, shakeDur: 0.0001, shakeMag: 0,
        flashAlpha: 0, flashColor: '#FFFFFF', flashDecay: 2,

        reset() {
            this.particles.length = 0; this.popups.length = 0; this.rings.length = 0;
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
            this.ring(x, y, colors[0], 34, 0.32);
        },

        ring(x, y, color, maxR, life) {
            if (this.rings.length < 24) this.rings.push({ x, y, color, maxR, life, maxLife: life });
        },

        popup(x, y, text, color) {
            if (this.popups.length < 30) this.popups.push({ x, y, text, color, life: 0.8, maxLife: 0.8 });
        },

        shake(mag, dur) {
            if (REDUCE_MOTION) return;
            this.shakeMag = mag; this.shakeDur = dur; this.shakeTime = dur;
        },

        flash(color, alpha, decay) {
            this.flashColor = color; this.flashAlpha = REDUCE_MOTION ? alpha * 0.3 : alpha;
            this.flashDecay = decay || 2.5;
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
                p.life -= dt; p.y -= 34 * dt;
                if (p.life <= 0) { pp[i] = pp[pp.length - 1]; pp.pop(); }
            }
            const rr = this.rings;
            for (let i = rr.length - 1; i >= 0; i--) {
                rr[i].life -= dt;
                if (rr[i].life <= 0) { rr[i] = rr[rr.length - 1]; rr.pop(); }
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
                const z = [0.35, 0.65, 1][i % 3];   // 3 lớp parallax
                this.list.push({
                    x: rand(-40, W + 40), y: rand(0, H), z,
                    size: z > 0.9 ? 2 : 1,
                    v: 8 + z * 34, b: rand(0.25, 0.85) * (0.5 + z * 0.5), t: rand(0, 6.28),
                    tint: Math.random() < 0.18 ? '170,210,255' : (Math.random() < 0.1 ? '255,190,240' : '255,255,255')
                });
            }
        },
        update(dt) {
            for (const s of this.list) {
                s.y += s.v * dt;
                if (s.y > H) { s.y = 0; s.x = rand(-40, W + 40); }
            }
        },
        render(ctx) {
            const par = (Player.x + Player.w / 2 - W / 2) * -0.05;
            for (const s of this.list) {
                const a = s.b * (0.7 + 0.3 * Math.sin(Game.time * 2 + s.t));
                ctx.fillStyle = 'rgba(' + s.tint + ',' + a.toFixed(2) + ')';
                ctx.fillRect(Math.round(s.x + par * s.z), Math.round(s.y), s.size, s.size);
            }
        }
    };

    /* ======================================================================
       PLAYER
       ====================================================================== */
    const Player = {
        x: 0, y: CONFIG.player.y, w: CONFIG.player.width, h: CONFIG.player.height,
        lastShot: -Infinity, invuln: 0, muzzle: 0, visible: true,
        bullets: [],

        resetPosition() {
            this.x = (W - this.w) / 2;
            this.y = CONFIG.player.y;
        },

        reset() {
            this.resetPosition();
            this.lastShot = -Infinity;
            this.invuln = 0; this.muzzle = 0; this.visible = true;
            this.bullets.length = 0;
        },

        update(dt) {
            if (Game.state === STATE.PLAYING) {
                const dx = (Input.right() ? 1 : 0) - (Input.left() ? 1 : 0);
                const dy = (Input.down() ? 1 : 0) - (Input.up() ? 1 : 0);
                const v = CONFIG.player.speed * REF * dt * (dx && dy ? Math.SQRT1_2 : 1);   // chéo không nhanh hơn
                this.x += dx * v;
                this.y += dy * v;
                this.x = clamp(this.x, CONFIG.player.margin, W - this.w - CONFIG.player.margin);
                this.y = clamp(this.y, CONFIG.player.minY, CONFIG.player.y);
                if (Input.fire()) this.tryShoot();
                if (this.invuln > 0) this.invuln -= dt;
            }
            if (this.muzzle > 0) this.muzzle -= dt;
        },

        tryShoot() {
            const c = CONFIG.player;
            const rapid = PowerUps.active.rapid > 0, spread = PowerUps.active.spread > 0;
            const volley = spread ? 3 : 1;
            const cap = (rapid ? c.rapidMaxBullets : c.maxBullets) * volley;
            if (this.bullets.length + volley > cap) return;
            const cd = (rapid ? c.rapidCooldown : c.cooldown) / 1000;
            if (Game.time - this.lastShot < cd) return;
            for (let k = 0; k < volley; k++) {
                const x = this.x + this.w / 2 - c.bulletWidth / 2;
                const y = this.y - c.bulletHeight;
                this.bullets.push({
                    x, y, prevX: x, prevY: y, w: c.bulletWidth, h: c.bulletHeight,
                    vx: volley === 3 ? (k - 1) * c.spreadAngleVx : 0,
                    vy: -c.bulletSpeed * REF
                });
            }
            this.lastShot = Game.time;
            this.muzzle = 0.07;
            Sound.shoot();
        },

        updateBullets(dt) {
            const l = this.bullets;
            for (let i = l.length - 1; i >= 0; i--) {
                const b = l[i];
                b.prevX = b.x; b.prevY = b.y;
                b.x += b.vx * dt; b.y += b.vy * dt;
                if (b.y + b.h < 0 || b.x + b.w < -10 || b.x > W + 10) l.splice(i, 1);
            }
        },

        render(ctx) {
            if (!this.visible) return;
            if (this.invuln > 0 && Math.floor(Game.time * 14) % 2 === 0) return; // nhấp nháy khi bất tử
            const cx = this.x + this.w / 2, bottom = this.y + this.h - 1;

            // Lửa động cơ
            const len = 7 + Math.sin(Game.time * 60) * 2 + Math.random() * 2;
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(0, bottom, 0, bottom + len);
            g.addColorStop(0, 'rgba(180,250,255,.95)');
            g.addColorStop(1, 'rgba(34,211,238,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(cx - 3.2, bottom); ctx.lineTo(cx + 3.2, bottom); ctx.lineTo(cx, bottom + len);
            ctx.fill();
            drawGlow(ctx, COLORS.cyan, cx, bottom + 2, 22);
            ctx.globalCompositeOperation = 'source-over';

            blit(ctx, Sprites.player, this.x, this.y);

            if (this.muzzle > 0) {
                ctx.globalCompositeOperation = 'lighter';
                drawGlow(ctx, '#ffffff', cx, this.y - 2, 26);
                ctx.globalCompositeOperation = 'source-over';
            }

            // Khiên năng lượng
            if (PowerUps.active.barrier > 0) {
                const t = PowerUps.active.barrier;
                const blink = t < 2 && Math.floor(Game.time * 10) % 2 === 0;
                if (!blink) {
                    const cy = this.y + this.h / 2, r = 27 + Math.sin(Game.time * 6) * 1.2;
                    ctx.fillStyle = 'rgba(74,222,128,0.10)';
                    ctx.strokeStyle = 'rgba(74,222,128,0.85)';
                    ctx.lineWidth = 1.6;
                    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.globalCompositeOperation = 'lighter';
                    drawGlow(ctx, COLORS.green, cx, cy, r * 2.6);
                    ctx.globalCompositeOperation = 'source-over';
                }
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
            this.x = (W - totalW) / 2;
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
                blit(ctx, Sprites.enemy[e.type.key][f], Math.round(e.x), Math.round(e.y));
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
            const bx = shooter.x + shooter.w / 2 - B.width / 2;
            this.list.push({
                x: bx, prevX: bx,
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
                const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
                ctx.globalCompositeOperation = 'lighter';
                drawGlow(ctx, b.color, cx, cy, 26);
                ctx.globalCompositeOperation = 'source-over';
                const alt = Math.floor(Game.time * 20 + b.y / 6) % 2 ? 1 : -1;   // zig-zag
                ctx.fillStyle = b.color;
                ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, 5);
                ctx.fillRect(Math.round(b.x + alt), Math.round(b.y + 5), b.w, 5);
                ctx.fillStyle = '#fff';
                ctx.fillRect(Math.round(b.x + 1), Math.round(b.y + 2), 2, 6);
            }
        }
    };

    /* ======================================================================
       POWER-UPS  (mới)
       ====================================================================== */
    const PowerUps = {
        drops: [],
        active: { rapid: 0, spread: 0, barrier: 0 },

        reset() {
            this.drops.length = 0;
            this.active.rapid = this.active.spread = this.active.barrier = 0;
        },

        maybeDrop(enemy) {
            const P = CONFIG.powerup;
            if (this.drops.length >= P.maxOnScreen) return;
            const chance = P.dropChance + (enemy.type.key === 'scout' ? P.scoutBonus : 0);
            if (Math.random() >= chance) return;
            const keys = Object.keys(P.types);
            let total = 0;
            keys.forEach((k) => { total += P.types[k].weight; });
            let r = Math.random() * total, type = keys[0];
            for (const k of keys) { r -= P.types[k].weight; if (r <= 0) { type = k; break; } }
            this.drops.push({
                type, x: enemy.x + enemy.w / 2 - P.size / 2, y: enemy.y,
                w: P.size, h: P.size, t: rand(0, 6)
            });
        },

        collect(d) {
            const def = CONFIG.powerup.types[d.type];
            this.active[d.type] = def.duration;
            Sound.powerUp();
            FX.popup(d.x + d.w / 2, d.y, def.label, def.color);
            FX.ring(d.x + d.w / 2, d.y + d.h / 2, def.color, 40, 0.4);
            FX.burst(d.x + d.w / 2, d.y + d.h / 2, [def.color, '#ffffff'], 10, 30, 120, 2);
            UI.say('Nhận ' + def.label);
        },

        tickTimers(dt) {
            const a = this.active;
            for (const k in a) if (a[k] > 0) a[k] = Math.max(0, a[k] - dt);
        },

        update(dt) {
            for (let i = this.drops.length - 1; i >= 0; i--) {
                const d = this.drops[i];
                d.y += CONFIG.powerup.fallSpeed * dt;
                d.t += dt;
                if (Player.visible && Game.state === STATE.PLAYING && overlap(Player, d)) {
                    this.collect(d); this.drops.splice(i, 1);
                } else if (d.y > H) {
                    this.drops.splice(i, 1);
                }
            }
        },

        render(ctx) {
            for (const d of this.drops) {
                const def = CONFIG.powerup.types[d.type];
                const bob = Math.sin(d.t * 6) * 1.5;
                ctx.globalCompositeOperation = 'lighter';
                drawGlow(ctx, def.color, d.x + d.w / 2, d.y + d.h / 2 + bob, 52 + Math.sin(d.t * 5) * 6);
                ctx.globalCompositeOperation = 'source-over';
                blit(ctx, Sprites.capsule[d.type], Math.round(d.x), Math.round(d.y + bob));
            }
        }
    };

    /* ======================================================================
       COMBO  (mới) — giết liên tiếp trong cửa sổ thời gian để nhân điểm
       ====================================================================== */
    const Combo = {
        count: 0, timer: 0,
        mult() {
            return Math.min(CONFIG.combo.maxMult, 1 + Math.floor(this.count / CONFIG.combo.killsPerStep));
        },
        hit() { this.count++; this.timer = CONFIG.combo.window; },
        reset() { this.count = 0; this.timer = 0; },
        update(dt) {
            if (this.timer > 0) {
                this.timer -= dt;
                if (this.timer <= 0) this.count = 0;
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
        Combo.hit();
        const mult = Combo.mult();
        const pts = e.type.score * mult;
        Score.add(pts);
        FX.explosion(cx, cy, [e.type.color, '#FFFFFF']);
        FX.popup(cx, cy, '+' + pts + (mult > 1 ? ' ×' + mult : ''), mult > 1 ? COLORS.amber : e.type.color);
        Sound.enemyHit();
        Sound.enemyDestroy();
        PowerUps.maybeDrop(e);
        if (Formation.count === 0) completeLevel();
    }

    function hitPlayer(force) {
        if (Game.state !== STATE.PLAYING) return;
        if (!force) {
            if (Player.invuln > 0) return;
            if (PowerUps.active.barrier > 0) {          // khiên hấp thụ 1 đòn
                PowerUps.active.barrier = 0;
                Player.invuln = 1.0;
                const cx = Player.x + Player.w / 2, cy = Player.y + Player.h / 2;
                FX.ring(cx, cy, COLORS.green, 54, 0.45);
                FX.burst(cx, cy, [COLORS.green, '#ffffff'], 16, 60, 200, 2);
                FX.flash(COLORS.green, 0.22, 3);
                FX.shake(3, 0.12);
                Sound.barrierBreak();
                return;
            }
        }
        Game.lives--;
        Game.state = STATE.PLAYER_HIT;
        Game.stateTimer = CONFIG.player.respawnDelay / 1000;
        Player.visible = false;
        Player.bullets.length = 0;
        Combo.reset();
        PowerUps.active.barrier = 0;
        FX.explosion(Player.x + Player.w / 2, Player.y + Player.h / 2,
            [COLORS.player, '#FFFFFF', '#7dd3fc'], 30);
        FX.flash('#FFFFFF', 0.5, 3);
        FX.shake(5, 0.2);
        Sound.playerHit();
        UI.say(Game.lives > 0 ? 'Bị trúng đạn, còn ' + Game.lives + ' mạng' : 'Hết mạng');
    }

    function completeLevel() {
        Game.state = STATE.LEVEL_COMPLETE;
        Game.stateTimer = CONFIG.timing.levelCompleteDelay / 1000;
        Score.add(CONFIG.score.levelBonus);
        Player.bullets.length = 0;
        EnemyBullets.reset();
        PowerUps.drops.length = 0;
        FX.flash(COLORS.cyan, 0.3, 1.2);
        FX.shake(3, 0.15);
        Sound.levelComplete();
        UI.banner('HOÀN THÀNH', '+' + CONFIG.score.levelBonus + ' THƯỞNG');
    }

    function endGame() {
        Game.state = STATE.GAME_OVER;
        Game.restartLock = CONFIG.timing.restartLock;
        const rank = Game.submitted ? -1 : Scores.submit(Game.score);
        Game.submitted = true;
        UI.fillGameOver(rank);
        Sound.gameOver();
        UI.say('Trò chơi kết thúc. Điểm ' + Math.floor(Game.score));
    }

    function respawnPlayer() {
        Player.resetPosition();
        Player.visible = true;
        Player.invuln = CONFIG.player.invulnerable / 1000;
        Player.bullets.length = 0;
        EnemyBullets.reset();
        Game.state = STATE.PLAYING;
    }

    /* ======================================================================
       COLLISION
       ====================================================================== */
    function resolvePlayerBullets() {
        const list = Player.bullets;
        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];
            const rect = sweptRect(b);
            let consumed = false, victim = null;
            for (const e of Formation.enemies) {
                if (overlap(e, rect)) { victim = e; consumed = true; break; }
            }
            if (consumed) list.splice(i, 1);
            if (victim) killEnemy(victim);
            if (Game.state !== STATE.PLAYING) return;     // level vừa hoàn thành
        }
    }

    function resolveCollisions() {
        // 1. Đạn player vs enemy
        resolvePlayerBullets();
        if (Game.state !== STATE.PLAYING) return;

        // 2. Đạn enemy vs player
        for (const b of EnemyBullets.list) {
            if (b.dead) continue;
            const rect = sweptRect(b);
            if (Player.visible && Player.invuln <= 0 && overlap(Player, rect)) {
                b.dead = true;
                hitPlayer(false);
                if (Game.state !== STATE.PLAYING) break;   // một sự kiện chết mỗi frame
            }
        }
        EnemyBullets.compact();
        if (Game.state !== STATE.PLAYING) return;

        // 3. Tàu đâm vào kẻ địch (khi bay lên giữa đội hình)
        if (Player.visible && Player.invuln <= 0) {
            for (const e of Formation.enemies) {
                if (overlap(Player, e)) { hitPlayer(false); break; }
            }
            if (Game.state !== STATE.PLAYING) return;
        }

        // 4. Đội hình hạ xuống tới đường phòng thủ cuối cùng
        if (Formation.maxY() >= CONFIG.player.y) {
            Formation.pullBack();
            hitPlayer(true);
        }
    }

    /* ======================================================================
       LEVEL / GAME FLOW
       ====================================================================== */
    function setupLevel() {
        Formation.init(Game.level);
        EnemyBullets.reset();
        Player.bullets.length = 0;
        PowerUps.drops.length = 0;
        EnemyBullets.scheduleNext();
        Game.enemyFireIn = Math.max(Game.enemyFireIn, 0.8);
        UI.banner('CẤP ĐỘ ' + Game.level, 'SẴN SÀNG');
    }

    function startGame() {
        Game.score = 0;
        Game.newHigh = false;
        Game.submitted = false;
        Game.level = 1;
        Game.lives = CONFIG.player.lives;
        Game.stateTimer = 0;
        FX.reset();
        Player.reset();
        PowerUps.reset();
        Combo.reset();
        setupLevel();
        Game.state = STATE.PLAYING;
        UI.say('Bắt đầu. Cấp độ 1');
    }

    function onEnter() {
        if (Game.state === STATE.MENU) startGame();
        else if (Game.state === STATE.GAME_OVER && Game.restartLock <= 0) startGame();
    }

    function togglePause() {
        if (Game.state === STATE.PAUSED) {
            Game.state = Game.prevState;
        } else if (Game.state === STATE.PLAYING || Game.state === STATE.PLAYER_HIT ||
                   Game.state === STATE.LEVEL_COMPLETE) {
            Game.prevState = Game.state;
            Game.state = STATE.PAUSED;
            Input.touch.left = Input.touch.right = Input.touch.up = Input.touch.down = Input.touch.fire = false;
        }
    }

    function toggleMute() {
        Sound.init();
        Sound.setMuted(!Sound.muted);
        UI.syncMute();
    }

    /* ======================================================================
       UI (DOM: HUD, màn hình kính mờ, banner)
       ====================================================================== */
    const UI = {
        els: {}, cache: {},

        init() {
            const $ = (id) => document.getElementById(id);
            this.els = {
                score: $('hud-score'), hi: $('hud-hi'), level: $('hud-level'), lives: $('hud-lives'),
                menu: $('screen-menu'), pause: $('screen-pause'), over: $('screen-over'),
                menuHi: $('menu-hi'),
                overScore: $('over-score'), overNew: $('over-new'), overList: $('over-list'),
                banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
                announce: $('announce'),
                muteBtn: $('btn-mute'), muteUse: $('mute-use'), pauseBtn: $('btn-pause'),
                chips: {
                    combo: $('chip-combo'), rapid: $('chip-rapid'),
                    spread: $('chip-spread'), barrier: $('chip-barrier')
                },
                comboText: $('combo-text')
            };
            $('btn-start').addEventListener('click', () => { Sound.init(); onEnter(); });
            $('btn-retry').addEventListener('click', () => { Sound.init(); onEnter(); });
            $('btn-resume').addEventListener('click', () => togglePause());
            this.els.pauseBtn.addEventListener('click', () => { Sound.init(); togglePause(); });
            this.els.muteBtn.addEventListener('click', toggleMute);
            this.syncMute();
        },

        text(key, el, val) {
            if (this.cache[key] !== val) { this.cache[key] = val; el.textContent = val; }
        },

        syncMute() {
            const m = Sound.muted;
            this.els.muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
            this.els.muteUse.setAttribute('href', m ? '#i-mute' : '#i-sound');
        },

        say(msg) { this.els.announce.textContent = msg; },

        banner(title, sub) {
            const b = this.els.banner;
            this.els.bannerTitle.textContent = title;
            this.els.bannerSub.textContent = sub || '';
            b.classList.remove('show');
            void b.offsetWidth;            // khởi động lại animation
            b.classList.add('show');
        },

        fillGameOver(rank) {
            const e = this.els;
            e.overScore.textContent = pad6(Game.score);
            e.overNew.hidden = !(rank === 0);
            e.overList.innerHTML = '';
            Scores.list.forEach((s, i) => {
                const li = document.createElement('li');
                if (i === rank) li.className = 'me';
                const b = document.createElement('b');
                b.textContent = pad6(s);
                li.appendChild(b);
                e.overList.appendChild(li);
            });
        },

        setProgress(key, el, p) {
            const q = Math.round(p * 50) / 50;
            if (this.cache[key] !== q) { this.cache[key] = q; el.style.setProperty('--p', q); }
        },

        sync() {
            const e = this.els;
            this.text('score', e.score, pad6(Game.score));
            this.text('hi', e.hi, pad6(Game.hi));
            this.text('menuHi', e.menuHi, pad6(Game.hi));
            this.text('level', e.level, String(Game.level));

            if (this.cache.lives !== Game.lives) {
                this.cache.lives = Game.lives;
                let html = '';
                for (let i = 0; i < Math.max(0, Game.lives); i++) {
                    html += '<svg class="life" viewBox="0 0 32 24" aria-hidden="true"><use href="#i-ship"/></svg>';
                }
                e.lives.innerHTML = html;
                e.lives.setAttribute('aria-label', 'Mạng còn lại: ' + Math.max(0, Game.lives));
            }

            const scr = Game.state === STATE.MENU ? 'menu'
                : Game.state === STATE.PAUSED ? 'pause'
                : Game.state === STATE.GAME_OVER ? 'over' : '';
            if (this.cache.screen !== scr) {
                this.cache.screen = scr;
                e.menu.hidden = scr !== 'menu';
                e.pause.hidden = scr !== 'pause';
                e.over.hidden = scr !== 'over';
                if (scr === 'pause') document.getElementById('btn-resume').focus({ preventScroll: true });
                else if (document.activeElement && document.activeElement.blur &&
                         document.activeElement.id === 'btn-resume') document.activeElement.blur();
            }

            // Chip combo + power-up
            const A = PowerUps.active, P = CONFIG.powerup.types;
            const showCombo = Combo.count >= 2;
            if (this.cache.combo !== showCombo) { this.cache.combo = showCombo; e.chips.combo.hidden = !showCombo; }
            if (showCombo) {
                this.text('comboText', e.comboText, '×' + Combo.mult() + ' · ' + Combo.count);
                this.setProgress('comboP', e.chips.combo, Combo.timer / CONFIG.combo.window);
            }
            ['rapid', 'spread', 'barrier'].forEach((k) => {
                const on = A[k] > 0;
                if (this.cache['on_' + k] !== on) { this.cache['on_' + k] = on; e.chips[k].hidden = !on; }
                if (on) this.setProgress('p_' + k, e.chips[k], A[k] / P[k].duration);
            });
        }
    };

    /* ======================================================================
       UPDATE
       ====================================================================== */
    function updatePlaying(dt) {
        Player.update(dt);
        Player.updateBullets(dt);
        Formation.update(dt);
        EnemyBullets.update(dt);
        PowerUps.tickTimers(dt);
        PowerUps.update(dt);
        Combo.update(dt);
        resolveCollisions();
    }

    function update(dt) {
        if (Game.state === STATE.PAUSED) return;
        Game.time += dt;
        Stars.update(dt);
        FX.update(dt);

        switch (Game.state) {
            case STATE.MENU:
                // Attract mode: đội hình lắc nhẹ phía sau menu
                Formation.x = Game.menuBaseX + Math.sin(Game.time * 0.7) * 46;
                Formation.animFrame = Math.floor(Game.time * 2) % 2;
                Formation.layout();
                break;
            case STATE.PLAYING:
                updatePlaying(dt);
                break;
            case STATE.PLAYER_HIT:
                Player.update(dt);
                PowerUps.update(dt);
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
            case STATE.GAME_OVER:
                if (Game.restartLock > 0) Game.restartLock -= dt;
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
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }

    function text(str, x, y, size, color, align) {
        ctx.font = '700 ' + size + 'px "Orbitron", "Rajdhani", monospace';
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color || COLORS.ui;
        ctx.fillText(str, x, y);
    }

    let groundGrad = null;
    function drawGround() {
        if (!groundGrad) {
            groundGrad = ctx.createLinearGradient(0, 0, W, 0);
            groundGrad.addColorStop(0, 'rgba(34,211,238,0)');
            groundGrad.addColorStop(0.5, 'rgba(34,211,238,0.55)');
            groundGrad.addColorStop(1, 'rgba(34,211,238,0)');
        }
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, 656, W, 1.5);
    }

    function drawPlayerBullets() {
        ctx.globalCompositeOperation = 'lighter';
        for (const b of Player.bullets) {
            // vệt đuôi
            for (let k = 1; k <= 4; k++) {
                ctx.fillStyle = 'rgba(34,211,238,' + (0.34 / k).toFixed(2) + ')';
                ctx.fillRect(Math.round(b.x - b.vx * 0.006 * k), Math.round(b.y + b.h + (k - 1) * 5), b.w, 5);
            }
            drawGlow(ctx, COLORS.cyan, b.x + b.w / 2, b.y + b.h / 2, 30);
        }
        ctx.globalCompositeOperation = 'source-over';
        for (const b of Player.bullets) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
        }
    }

    function drawParticles() {
        ctx.globalCompositeOperation = 'lighter';
        for (const p of FX.particles) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        for (const r of FX.rings) {
            const k = 1 - r.life / r.maxLife;
            ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 2 * (1 - k) + 0.5;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.maxR * (0.2 + 0.8 * k), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        for (const p of FX.popups) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            text(p.text, p.x, p.y, 14, p.color, 'center');
        }
        ctx.globalAlpha = 1;
    }

    function drawScene() {
        drawGround();
        Formation.render(ctx);
        PowerUps.render(ctx);
        EnemyBullets.render(ctx);
        drawPlayerBullets();
        Player.render(ctx);
        drawParticles();
    }

    function render() {
        const logical = Game.state === STATE.PAUSED ? Game.prevState : Game.state;

        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, W, H);      // nền (tinh vân) do CSS đảm nhiệm

        const off = Game.state === STATE.PAUSED ? { x: 0, y: 0 } : FX.shakeOffset();
        ctx.setTransform(scale, 0, 0, scale, off.x * scale, off.y * scale);

        Stars.render(ctx);
        if (logical === STATE.MENU) {
            ctx.globalAlpha = 0.45;
            Formation.render(ctx);
            ctx.globalAlpha = 1;
        } else {
            drawScene();
        }

        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        if (FX.flashAlpha > 0) {
            ctx.globalAlpha = Math.min(1, FX.flashAlpha);
            ctx.fillStyle = FX.flashColor;
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
        }
    }

    /* ======================================================================
       GAME LOOP
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
            UI.sync();
        } catch (err) {
            console.error('Game error:', err);
        }
    }

    function init() {
        if (loopStarted) return;
        loopStarted = true;
        Scores.load();
        Game.hi = Scores.best();
        Sprites.build();
        Sprites.paintLegend();
        Stars.init();
        Player.reset();
        Formation.init(1);                 // dùng cho attract mode ở menu
        Game.menuBaseX = Formation.x;
        Input.init();
        UI.init();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(canvas);
        // Lưu điểm nếu người chơi đóng tab giữa ván
        window.addEventListener('pagehide', () => {
            if (!Game.submitted && Game.score > 0 && Game.state !== STATE.MENU) {
                Scores.submit(Game.score); Game.submitted = true;
            }
        });
        requestAnimationFrame(frame);

        if (/[?&]debug\b/.test(location.search)) {
            window.__GI = { Game, Player, Formation, PowerUps, Combo, EnemyBullets, FX, STATE, hitPlayer, killEnemy, startGame };
        }
    }

    init();
})();
