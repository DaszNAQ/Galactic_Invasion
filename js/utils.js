/* Small, reusable math and collision helpers. */
/* ======================================================================
   UTILS
   ====================================================================== */
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');

export function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

// Rect quét (swept) của viên đạn trong frame này (cả hai trục) để không xuyên vật thể mỏng.
const SWEPT = { x: 0, y: 0, w: 0, h: 0 };
export function sweptRect(b) {
    const x0 = Math.min(b.x, b.prevX), x1 = Math.max(b.x, b.prevX) + b.w;
    const y0 = Math.min(b.y, b.prevY), y1 = Math.max(b.y, b.prevY) + b.h;
    SWEPT.x = x0; SWEPT.y = y0; SWEPT.w = x1 - x0; SWEPT.h = y1 - y0;
    return SWEPT;
}
