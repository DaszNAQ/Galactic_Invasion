/* Shared gameplay configuration and visual tokens. */
export const CONFIG = {
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
            rapid:   { color: '#46D9E8', letter: 'R', duration: 8,  label: 'RAPID FIRE', weight: 4 },
            spread:  { color: '#8B79F5', letter: '3', duration: 8,  label: 'SPREAD SHOT', weight: 4 },
            barrier: { color: '#7CE6C4', letter: 'B', duration: 12, label: 'ENERGY SHIELD', weight: 3 }
        }
    },
    combo: { window: 1.4, killsPerStep: 4, maxMult: 5 },
    score: { levelBonus: 500 },
    timing: { levelCompleteDelay: 1500, restartLock: 0.8 },
    fx: {
        particleMin: 8, particleMax: 15,
        particleLifeMin: 0.3, particleLifeMax: 0.5,
        maxParticles: 400,
        starCount: 160
    },
    storage: {
        legacyHigh: 'galactic_invasion_highscore',
        scores: 'galactic_invasion_scores_v2',
        mute: 'galactic_invasion_mute'
    },
    topN: 5
};

export const W = CONFIG.canvas.width;
// The logical world keeps a fixed width and adapts its height to the portrait viewport.
export let H = CONFIG.canvas.height;
export function setWorldHeight(height) {
    H = Math.max(CONFIG.canvas.height, Math.round(height));
}
export const REF = CONFIG.refFps;
export const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export const STATE = {
    MENU: 'MENU', PLAYING: 'PLAYING', PLAYER_HIT: 'PLAYER_HIT',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE', GAME_OVER: 'GAME_OVER', PAUSED: 'PAUSED'
};

export const ENEMY_TYPES = {
    scout:   { key: 'scout',   color: '#FF657A', score: 30, hp: 1 },
    soldier: { key: 'soldier', color: '#8B79F5', score: 20, hp: 1 },
    grunt:   { key: 'grunt',   color: '#FFB45C', score: 10, hp: 1 }
};

export const COLORS = {
    player: '#BDEFFF', ui: '#EDF4FF', cyan: '#46D9E8',
    magenta: '#8B79F5', amber: '#FFB45C', green: '#7CE6C4', red: '#FF657A'
};
