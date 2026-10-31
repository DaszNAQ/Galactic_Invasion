import { CONFIG } from "./config.js";

/* Local-only score and preference storage. */
export const Store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* bỏ qua */ } }
};

export const Scores = {
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
