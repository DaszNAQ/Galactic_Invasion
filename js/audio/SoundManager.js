import { CONFIG } from "../config.js";
import { Store } from "../storage.js";

/* Procedural sound using the browser Web Audio API. */
/* ======================================================================
   AUDIO (Web Audio API, tổng hợp 100%)
   ====================================================================== */
export const Sound = {
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
