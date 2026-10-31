import { CONFIG, ENEMY_TYPES, COLORS } from "../config.js";
import { rgba } from "../utils.js";

/* Canvas sprite generation and cached glow rendering. */
/* ======================================================================
   SPRITES — vector field markings, cached offscreen (supersample)
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

export function blit(ctx, s, x, y) {
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
        neon(c, col, 0.18, 1.5, 4);
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
        neon(c, col, 0.17, 1.5, 4);
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
        neon(c, col, 0.17, 1.5, 4);
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
    c.lineJoin = 'round';
    c.lineCap = 'round';

    /* Swept tactical interceptor: armored nose, split wings and twin engines. */
    const hull = c.createLinearGradient(0, 2, 0, 23);
    hull.addColorStop(0, '#F4FBFF');
    hull.addColorStop(0.42, '#A9DFF0');
    hull.addColorStop(1, '#315E8A');

    c.beginPath();
    c.moveTo(16, 0.8);
    c.lineTo(20.4, 9.4);
    c.lineTo(31, 17.2);
    c.lineTo(29.5, 21.1);
    c.lineTo(21.2, 19.4);
    c.lineTo(18.5, 23.1);
    c.lineTo(13.5, 23.1);
    c.lineTo(10.8, 19.4);
    c.lineTo(2.5, 21.1);
    c.lineTo(1, 17.2);
    c.lineTo(11.6, 9.4);
    c.closePath();
    c.fillStyle = hull;
    c.strokeStyle = COLORS.cyan;
    c.lineWidth = 1.25;
    c.shadowColor = COLORS.cyan;
    c.shadowBlur = 5 * SS;
    c.fill();
    c.stroke();

    /* Wing panels */
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(16, 37, 73, 0.72)';
    c.beginPath();
    c.moveTo(11.8, 10.2); c.lineTo(4.1, 17.1); c.lineTo(11.4, 17.8); c.closePath();
    c.moveTo(20.2, 10.2); c.lineTo(27.9, 17.1); c.lineTo(20.6, 17.8); c.closePath();
    c.fill();

    /* Central cockpit and spine */
    c.beginPath();
    c.moveTo(16, 4.1); c.lineTo(18.7, 11.7); c.lineTo(16, 17.2); c.lineTo(13.3, 11.7); c.closePath();
    c.fillStyle = 'rgba(237, 248, 255, 0.95)';
    c.fill();
    c.strokeStyle = 'rgba(70, 217, 232, 0.9)';
    c.lineWidth = 0.8;
    c.stroke();

    /* Twin engine emitters */
    c.fillStyle = '#46D9E8';
    c.shadowColor = '#46D9E8';
    c.shadowBlur = 5 * SS;
    c.fillRect(10.6, 18.2, 2.4, 4.2);
    c.fillRect(19, 18.2, 2.4, 4.2);

    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 0.65;
    c.beginPath();
    c.moveTo(16, 5.2); c.lineTo(16, 17.8);
    c.moveTo(7.2, 17.1); c.lineTo(11.3, 18.1);
    c.moveTo(24.8, 17.1); c.lineTo(20.7, 18.1);
    c.stroke();
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
    neon(c, def.color, 0.22, 1.6, 4.5);
    fillStroke(c);
    c.shadowBlur = 0;
    c.fillStyle = '#fff';
    c.font = '700 13px "Segoe UI", Arial, sans-serif';
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
export function drawGlow(ctx, color, x, y, size) {
    ctx.drawImage(glow(color), x - size / 2, y - size / 2, size, size);
}

export const Sprites = {
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
