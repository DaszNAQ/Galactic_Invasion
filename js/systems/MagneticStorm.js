/* Render-only magnetic anomaly. Coordinates are logical game-world units. */
const CYAN = '#46D9E8';
const VIOLET = '#8B79F5';
const WHITE = '#EDF4FF';
const TAU = Math.PI * 2;
const FIELD_COUNT = 6;
const PARTICLE_COUNT = 36;
const point = { x: 0, y: 0 };
const trailPoint = { x: 0, y: 0 };

const particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    angle: index / PARTICLE_COUNT * TAU,
    speed: 0.2 + (index * 13 % 9) * 0.018,
    orbit: index % FIELD_COUNT,
    direction: index % 4 === 0 ? -1 : 1,
    size: 1 + index % 3 * 0.45,
    violet: index % 3 === 0,
    trail: 0.045 + index % 4 * 0.008
}));

let elapsed = 0;

function pulseAt(time) {
    return 0.68 + (0.5 + 0.5 * Math.sin(time * 0.7 - 0.9)) * 0.32;
}

function pathPoint(angle, orbit, cx, cy, rx, ry, rotation, out) {
    const phase = orbit * 0.61;
    const a = angle + rotation + phase * 0.11;
    // Several harmonics produce a lopsided, pinched magnetic envelope instead of rings.
    const shape = 1 + 0.22 * Math.cos(2 * a + phase) + 0.12 * Math.sin(3 * a - phase * 0.72)
        + 0.045 * Math.cos(5 * a + phase * 1.4);
    const scale = 0.53 + orbit * 0.105;
    out.x = cx + Math.cos(a) * rx * scale * shape + Math.sin(2 * a + phase) * rx * 0.035;
    out.y = cy + Math.sin(a) * ry * scale * shape + Math.cos(2 * a - phase) * ry * 0.035;
    return out;
}

export const MagneticStorm = {
    update(dt) {
        const step = Math.max(0, Math.min(dt, 0.05));
        elapsed += step;
        const energy = 0.9 + pulseAt(elapsed) * 0.2;
        for (const particle of particles) {
            particle.angle = (particle.angle + particle.speed * energy * step * particle.direction + TAU) % TAU;
        }
    },

    render(ctx, width, height) {
        const cx = width * 0.5;
        const cy = Math.min(height * 0.42, Math.max(245, height * 0.35));
        const rx = Math.min(width * 0.44, 286);
        const ry = Math.min(Math.max(height * 0.19, 165), 236);
        const pulse = pulseAt(elapsed);
        const rotation = elapsed * 0.045;
        const coreRadius = 37 + pulse * 5;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Asymmetric cloud keeps the event legible while tying it into the nebula background.
        const haze = ctx.createRadialGradient(cx - rx * 0.13, cy - ry * 0.08, 8, cx, cy, Math.max(rx, ry) * 1.38);
        haze.addColorStop(0, `rgba(70,217,232,${0.105 * pulse})`);
        haze.addColorStop(0.34, `rgba(139,121,245,${0.075 * pulse})`);
        haze.addColorStop(0.72, 'rgba(16,26,50,0.025)');
        haze.addColorStop(1, 'rgba(16,26,50,0)');
        ctx.fillStyle = haze;
        ctx.fillRect(cx - rx * 1.5, cy - ry * 1.55, rx * 3, ry * 3.1);

        // Broken, offset lens arcs suggest spatial shear around the anomaly without pixel work.
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-rotation * 0.7);
        for (let ring = 0; ring < 3; ring++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, 42 + ring * 13, 31 + ring * 10, ring * 0.18, 0.18 + ring * 1.8, 2.35 + ring * 1.8);
            ctx.strokeStyle = ring % 2 ? `rgba(139,121,245,${0.075 * pulse})` : `rgba(70,217,232,${0.09 * pulse})`;
            ctx.lineWidth = ring === 0 ? 1.4 : 0.8;
            ctx.stroke();
        }
        ctx.restore();

        // Magnetic streamlines flow around the core; each has a distinct harmonic, scale and drift.
        for (let line = 0; line < FIELD_COUNT; line++) {
            const phase = rotation * (line % 2 ? -0.72 : 1) + line * 0.14;
            const alpha = (0.105 + (line % 3) * 0.027) * pulse;
            ctx.beginPath();
            for (let sample = 0; sample <= 84; sample++) {
                const angle = sample / 84 * TAU;
                pathPoint(angle, line, cx, cy, rx, ry, phase, point);
                if (sample === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            }
            ctx.closePath();
            ctx.strokeStyle = line % 2 ? `rgba(139,121,245,${alpha})` : `rgba(70,217,232,${alpha})`;
            ctx.lineWidth = line === 2 ? 1.55 : (line % 2 ? 0.9 : 1.1);
            ctx.stroke();
        }

        // Preallocated motes follow their own warped streamline. Short tail strokes show direction.
        for (const particle of particles) {
            pathPoint(particle.angle, particle.orbit, cx, cy, rx, ry, rotation, point);
            pathPoint(particle.angle - particle.direction * particle.trail, particle.orbit, cx, cy, rx, ry, rotation, trailPoint);
            const color = particle.violet ? VIOLET : CYAN;
            const alpha = (0.44 + 0.18 * Math.sin(particle.angle * 2 + elapsed)) * pulse;
            ctx.globalAlpha = alpha * 0.58;
            ctx.strokeStyle = color;
            ctx.lineWidth = particle.size * 1.1;
            ctx.beginPath();
            ctx.moveTo(trailPoint.x, trailPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, particle.size, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Stacked halo and shell establish a focal core without a large white bloom.
        const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, 75 + pulse * 8);
        halo.addColorStop(0, `rgba(237,244,255,${0.18 * pulse})`);
        halo.addColorStop(0.22, `rgba(70,217,232,${0.25 * pulse})`);
        halo.addColorStop(0.52, `rgba(139,121,245,${0.19 * pulse})`);
        halo.addColorStop(1, 'rgba(139,121,245,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, 83, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(elapsed * 0.12);
        ctx.scale(1.2, 0.82);
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius + 9, 0.2, 2.75);
        ctx.strokeStyle = `rgba(70,217,232,${0.48 * pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.rotate(-elapsed * 0.3 - 0.8);
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius + 3, 0.25, 4.7);
        ctx.strokeStyle = `rgba(139,121,245,${0.52 * pulse})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();

        // Dark containment shell, inner plasma gradients, and clipped moving filaments.
        const shell = ctx.createRadialGradient(cx, cy, 4, cx, cy, coreRadius + 3);
        shell.addColorStop(0, 'rgba(5,8,22,0.94)');
        shell.addColorStop(0.58, 'rgba(16,26,50,0.9)');
        shell.addColorStop(0.82, `rgba(70,217,232,${0.44 * pulse})`);
        shell.addColorStop(1, `rgba(139,121,245,${0.16 * pulse})`);
        ctx.fillStyle = shell;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius + 3, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius - 3, 0, TAU);
        ctx.clip();
        const plasma = ctx.createRadialGradient(cx - 12, cy - 13, 2, cx + 4, cy + 5, coreRadius);
        plasma.addColorStop(0, `rgba(237,244,255,${0.65 * pulse})`);
        plasma.addColorStop(0.2, `rgba(70,217,232,${0.72 * pulse})`);
        plasma.addColorStop(0.55, `rgba(139,121,245,${0.62 * pulse})`);
        plasma.addColorStop(1, 'rgba(5,8,22,0.8)');
        ctx.fillStyle = plasma;
        ctx.fillRect(cx - coreRadius, cy - coreRadius, coreRadius * 2, coreRadius * 2);

        ctx.translate(cx, cy);
        ctx.rotate(-elapsed * 0.42);
        ctx.lineCap = 'round';
        for (let filament = 0; filament < 3; filament++) {
            const offset = filament * 2.1;
            ctx.beginPath();
            ctx.moveTo(-27, -9 + offset);
            ctx.bezierCurveTo(-9, -25 + offset, 2, 20 - offset, 27, 5 - offset);
            ctx.strokeStyle = filament === 1 ? `rgba(237,244,255,${0.38 * pulse})` : `rgba(70,217,232,${0.52 * pulse})`;
            ctx.lineWidth = filament === 1 ? 1.2 : 1.8;
            ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
    }
};
