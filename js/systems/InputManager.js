/* Keyboard input for desktop and one-finger drag input for touch devices. */
export function createInput({ Sound, Game, STATE, onEnter, togglePause, toggleMute, getPlayer }) {
    const Input = {
        keys: new Set(),
        autoShoot: false,
        touchMode: false,
        pointer: {
            active: false,
            pointerId: null,
            x: 0,
            y: 0,
            offsetX: 0,
            offsetY: 0
        },

        left()  { return this.keys.has('ArrowLeft') || this.keys.has('KeyA'); },
        right() { return this.keys.has('ArrowRight') || this.keys.has('KeyD'); },
        up()    { return this.keys.has('ArrowUp') || this.keys.has('KeyW'); },
        down()  { return this.keys.has('ArrowDown') || this.keys.has('KeyS'); },
        fire()  { return this.autoShoot || this.keys.has('Space'); },

        clearPointer() {
            this.pointer.active = false;
            this.pointer.pointerId = null;
        },

        clear() {
            this.keys.clear();
            this.clearPointer();
        },

        init() {
            const prevent = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
            const canvas = document.getElementById('game');
            const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            this.autoShoot = !!coarsePointer;

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

            window.addEventListener('keyup', (e) => this.keys.delete(e.code));

            const pauseIfPlaying = () => {
                this.clear();
                if (Game.state === STATE.PLAYING) togglePause();
            };
            window.addEventListener('blur', pauseIfPlaying);
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) pauseIfPlaying();
            });

            if (!canvas) return;

            // Prevent browser panning/zooming only inside the actual playfield.
            canvas.style.touchAction = 'none';

            const getLogicalPoint = (event) => {
                const rect = canvas.getBoundingClientRect();
                if (!rect.width || !rect.height) return { x: 0, y: 0 };
                const { width, height } = getPlayer().world;
                return {
                    x: ((event.clientX - rect.left) / rect.width) * width,
                    y: ((event.clientY - rect.top) / rect.height) * height
                };
            };

            canvas.addEventListener('pointerdown', (event) => {
                // Mouse remains keyboard-controlled; touch and pen use direct drag.
                if (event.pointerType === 'mouse' || !event.isPrimary) return;
                if (Game.state !== STATE.PLAYING || this.pointer.active) return;
                event.preventDefault();
                Sound.init();
                this.touchMode = true;
                this.autoShoot = true;

                const point = getLogicalPoint(event);
                const player = getPlayer();
                this.pointer.active = true;
                this.pointer.pointerId = event.pointerId;
                this.pointer.x = point.x;
                this.pointer.y = point.y;
                // Preserve the initial finger-to-ship offset to avoid a jump on touch-down.
                this.pointer.offsetX = point.x - (player.x + player.w / 2);
                this.pointer.offsetY = point.y - (player.y + player.h / 2);

                try { canvas.setPointerCapture(event.pointerId); } catch (_) { /* capture may be unavailable */ }
            }, { passive: false });

            canvas.addEventListener('pointermove', (event) => {
                if (!this.pointer.active || event.pointerId !== this.pointer.pointerId) return;
                event.preventDefault();
                const point = getLogicalPoint(event);
                this.pointer.x = point.x;
                this.pointer.y = point.y;
            }, { passive: false });

            const endPointer = (event) => {
                if (event && this.pointer.pointerId !== null && event.pointerId !== this.pointer.pointerId) return;
                this.clearPointer();
            };
            ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
                canvas.addEventListener(type, endPointer);
            });
            window.addEventListener('pointerup', endPointer);
            canvas.addEventListener('contextmenu', (event) => event.preventDefault());
        }
    };

    return Input;
}
