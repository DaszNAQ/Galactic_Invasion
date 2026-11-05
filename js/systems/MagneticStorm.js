import { CONFIG, W, H } from '../config.js';

/* Magnetic anomaly and projectile field. Coordinates are logical game-world units. */
const CYAN = '#46D9E8';
const VIOLET = '#8B79F5';
const WHITE = '#EDF4FF';
const TAU = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const STORM = CONFIG.magneticStorm;
const FIELD_COUNT = STORM.fieldLineCount;
const PARTICLE_COUNT = STORM.particleCount;
const ANCHOR_COUNT = 8;
const point = { x: 0, y: 0 };
const trailPoint = { x: 0, y: 0 };
const anchorX = new Float32Array(ANCHOR_COUNT);
const anchorY = new Float32Array(ANCHOR_COUNT);

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
let currentAngle = 0;
let targetAngle = 0;
const fieldSample = { strength: 0, radius: 0, polarity: 1, directionX: 0, directionY: 0, accelerationX: 0, accelerationY: 0 };
const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function pulseAt(time) {
    return 0.68 + (0.5 + 0.5 * Math.sin(time * 0.7 - 0.9)) * 0.32;
}

function pathPoint(angle, orbit, cx, cy, rx, ry, rotation, out) {
    const phase = orbit * 0.73;
    const a = angle + rotation;
    const flow = elapsed * (orbit % 2 ? -0.13 : 0.16);
    const shape = 1 + 0.17 * Math.cos(2 * a + phase)
        + 0.085 * Math.sin(3 * a - phase * 0.8)
        + 0.035 * Math.cos(5 * a + flow + phase);
    const pinch = 1 + 0.035 * Math.sin(a * 2 - phase + flow);
    const scale = 0.55 + orbit * 0.105;
    out.x = cx + Math.cos(a) * rx * scale * shape * pinch;
    out.y = cy + Math.sin(a) * ry * scale * shape * (2 - pinch);
    return out;
}

function traceFieldLine(ctx, cx, cy, rx, ry, scale, orientation, phase, flow) {
    for (let i = 0; i < ANCHOR_COUNT; i++) {
        const angle = i / ANCHOR_COUNT * TAU + orientation;
        const shape = 1 + 0.17 * Math.cos(2 * angle + phase)
            + 0.085 * Math.sin(3 * angle - phase * 0.8)
            + 0.035 * Math.cos(5 * angle + flow + phase);
        const pinch = 1 + 0.035 * Math.sin(angle * 2 - phase + flow);
        anchorX[i] = cx + Math.cos(angle) * rx * scale * shape * pinch;
        anchorY[i] = cy + Math.sin(angle) * ry * scale * shape * (2 - pinch);
    }

    ctx.beginPath();
    ctx.moveTo(anchorX[0], anchorY[0]);
    for (let i = 0; i < ANCHOR_COUNT; i++) {
        const next = (i + 1) % ANCHOR_COUNT;
        const previous = (i + ANCHOR_COUNT - 1) % ANCHOR_COUNT;
        const afterNext = (i + 2) % ANCHOR_COUNT;
        const c1x = anchorX[i] + (anchorX[next] - anchorX[previous]) / 6;
        const c1y = anchorY[i] + (anchorY[next] - anchorY[previous]) / 6;
        const c2x = anchorX[next] - (anchorX[afterNext] - anchorX[i]) / 6;
        const c2y = anchorY[next] - (anchorY[afterNext] - anchorY[i]) / 6;
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, anchorX[next], anchorY[next]);
    }
    ctx.closePath();
}

export const MagneticStorm = {
    get directionIndex() {
        const step = CONFIG.magneticStorm.directionStepDegrees * DEG_TO_RAD;
        return Math.round(currentAngle / step) % directions.length;
    },

    get directionName() { return directions[this.directionIndex]; },
    get angle() { return currentAngle; },

    rotateClockwise() {
        targetAngle = (targetAngle + CONFIG.magneticStorm.directionStepDegrees * DEG_TO_RAD) % TAU;
    },

    resetDirection() {
        currentAngle = 0;
        targetAngle = 0;
    },

    // World-space field query. Pass an output object to avoid allocating in projectile loops.
    sampleField(x, y, out = fieldSample) {
        const cx = W * 0.5;
        const cy = Math.min(H * 0.42, Math.max(245, H * 0.35));
        const dx = x - cx, dy = y - cy;
        const distance = Math.hypot(dx, dy);
        const radius = CONFIG.magneticStorm.radius;
        const edge = Math.max(0, 1 - distance / radius);
        const strength = edge * edge * (3 - 2 * edge);
        const inverseDistance = distance > 0.001 ? 1 / distance : 0;
        out.strength = strength;
        out.radius = radius;
        out.polarity = 1;
        // The local tangent follows the field orientation, so controller input
        // changes both the visible streamlines and projectile response.
        const baseX = distance > 0.001 ? -dy * inverseDistance : 0;
        const baseY = distance > 0.001 ? dx * inverseDistance : 1;
        const cos = Math.cos(currentAngle), sin = Math.sin(currentAngle);
        out.directionX = baseX * cos - baseY * sin;
        out.directionY = baseX * sin + baseY * cos;
        out.accelerationX = out.directionX * strength * CONFIG.magneticStorm.strength;
        out.accelerationY = out.directionY * strength * CONFIG.magneticStorm.strength;
        return out;
    },

    applyToProjectile(projectile, dt) {
        if (projectile.faction !== 'enemy') return;
        const field = this.sampleField(
            projectile.x + projectile.w * 0.5,
            projectile.y + projectile.h * 0.5
        );
        projectile.fieldStrength = field.strength;
        const speed = Math.hypot(projectile.vx, projectile.vy);
        const maxDeflection = CONFIG.magneticStorm.maxProjectileDeflection;
        if (field.strength <= 0 || speed < 0.001 || projectile.deflection >= maxDeflection) return;

        const cross = (projectile.vx * field.directionY - projectile.vy * field.directionX) / speed;
        if (Math.abs(cross) < 0.001) return;
        const remaining = maxDeflection - projectile.deflection;
        const turn = Math.min(remaining, CONFIG.magneticStorm.strength * field.strength * dt * Math.abs(cross))
            * Math.sign(cross) * projectile.polarity * field.polarity;
        projectile.turnSign = Math.sign(turn);
        const cos = Math.cos(turn), sin = Math.sin(turn);
        const vx = projectile.vx * cos - projectile.vy * sin;
        projectile.vy = projectile.vx * sin + projectile.vy * cos;
        projectile.vx = vx;
        projectile.deflection += Math.abs(turn);
    },

    update(dt) {
        const step = Math.max(0, Math.min(dt, 0.05));
        elapsed += step;
        let angleDelta = (targetAngle - currentAngle + Math.PI) % TAU;
        if (angleDelta < 0) angleDelta += TAU;
        angleDelta -= Math.PI;
        currentAngle += angleDelta * (1 - Math.exp(-CONFIG.magneticStorm.directionSmoothingRate * step));
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
        const rotation = currentAngle;
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

        // Offset Bezier lens folds imply spatial shear without per-pixel work.
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation * 0.42 + Math.sin(elapsed * 0.22) * 0.025);
        for (let ring = 0; ring < 3; ring++) {
            const r = 61 + ring * 15;
            ctx.beginPath();
            ctx.moveTo(-r * 0.82, -r * 0.16);
            ctx.bezierCurveTo(-r * 0.96, -r * 0.8, -r * 0.17, -r * 1.02, r * 0.28, -r * 0.76);
            ctx.bezierCurveTo(r * 0.92, -r * 0.44, r * 0.98, r * 0.16, r * 0.68, r * 0.47);
            ctx.strokeStyle = ring % 2 ? `rgba(139,121,245,${0.052 * pulse})` : `rgba(70,217,232,${0.064 * pulse})`;
            ctx.lineWidth = ring === 0 ? 1.1 : 0.75;
            ctx.stroke();
        }
        ctx.restore();

        // Irregular closed Bezier streamlines share the controller angle with field physics.
        for (let line = 0; line < FIELD_COUNT; line++) {
            const phase = line * 0.73;
            const scale = 0.55 + line * 0.105;
            const flow = elapsed * (line % 2 ? -0.13 : 0.16);
            const alpha = (0.09 + (line % 3) * 0.022) * pulse;
            traceFieldLine(ctx, cx, cy, rx, ry, scale, rotation, phase, flow);
            ctx.strokeStyle = line % 2 ? `rgba(139,121,245,${alpha * 0.58})` : `rgba(70,217,232,${alpha * 0.62})`;
            ctx.lineWidth = line < 2 ? 2.1 : 1.45;
            ctx.stroke();
            ctx.strokeStyle = line % 2 ? `rgba(183,174,255,${alpha})` : `rgba(150,244,250,${alpha})`;
            ctx.lineWidth = line === 3 ? 1.05 : 0.68;
            ctx.stroke();
        }

        // Preallocated motes follow their own warped streamline. Short tail strokes show direction.
        for (const particle of particles) {
            pathPoint(particle.angle, particle.orbit, cx, cy, rx, ry, rotation, point);
            pathPoint(particle.angle - particle.direction * particle.trail,
                particle.orbit, cx, cy, rx, ry, rotation, trailPoint);
            const color = particle.violet ? VIOLET : CYAN;
            const alpha = (0.34 + 0.22 * Math.sin(particle.angle * 2 + elapsed)) * pulse;
            ctx.globalAlpha = alpha * 0.24;
            ctx.strokeStyle = color;
            ctx.lineWidth = particle.size * 2.1;
            ctx.beginPath();
            ctx.moveTo(trailPoint.x, trailPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
            ctx.globalAlpha = alpha * 0.68;
            ctx.lineWidth = Math.max(0.7, particle.size * 0.8);
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

        // A transparent outer corona leaves combat silhouettes readable beneath it.
        const corona = ctx.createRadialGradient(cx, cy, coreRadius * 0.62, cx, cy, 148 + pulse * 8);
        corona.addColorStop(0, `rgba(70,217,232,${0.13 * pulse})`);
        corona.addColorStop(0.38, `rgba(139,121,245,${0.085 * pulse})`);
        corona.addColorStop(0.72, `rgba(70,217,232,${0.025 * pulse})`);
        corona.addColorStop(1, 'rgba(70,217,232,0)');
        ctx.fillStyle = corona;
        ctx.beginPath();
        ctx.arc(cx, cy, 156, 0, TAU);
        ctx.fill();

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
        ctx.rotate(rotation * 0.65 + elapsed * 0.08);
        ctx.scale(1.45, 0.72);
        for (let arc = 0; arc < 3; arc++) {
            const radius = coreRadius + 13 + arc * 7;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0.28 + arc * 1.7, 2.15 + arc * 1.95);
            ctx.strokeStyle = arc === 1
                ? `rgba(139,121,245,${0.25 * pulse})`
                : `rgba(70,217,232,${0.28 * pulse})`;
            ctx.lineWidth = arc === 0 ? 1.35 : 0.8;
            ctx.stroke();
        }
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
        ctx.save();
        ctx.rotate(-elapsed * 0.31 + rotation * 0.7);
        ctx.scale(1.32, 0.72);
        for (let vane = 0; vane < 3; vane++) {
            ctx.beginPath();
            ctx.arc(0, 0, coreRadius * (0.42 + vane * 0.12), -0.7 + vane * 1.55, 0.58 + vane * 1.55);
            ctx.strokeStyle = vane === 1
                ? `rgba(139,121,245,${0.36 * pulse})`
                : `rgba(70,217,232,${0.42 * pulse})`;
            ctx.lineWidth = vane === 1 ? 1 : 1.35;
            ctx.stroke();
        }
        ctx.restore();

        const nucleus = ctx.createRadialGradient(-2, -3, 1, 0, 0, 16 + pulse * 2);
        nucleus.addColorStop(0, `rgba(237,244,255,${0.82 * pulse})`);
        nucleus.addColorStop(0.24, `rgba(70,217,232,${0.58 * pulse})`);
        nucleus.addColorStop(0.62, `rgba(139,121,245,${0.24 * pulse})`);
        nucleus.addColorStop(1, 'rgba(139,121,245,0)');
        ctx.fillStyle = nucleus;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.restore();
    }
};

export const StormController = {
    energy: CONFIG.magneticStorm.initialEnergy,
    activationTimer: 0,

    reset() {
        this.energy = CONFIG.magneticStorm.initialEnergy;
        this.activationTimer = 0;
        MagneticStorm.resetDirection();
    },

    rotate(isPlaying) {
        const storm = CONFIG.magneticStorm;
        if (!isPlaying || this.energy < storm.rotationEnergyCost || this.activationTimer > 0) return false;
        this.energy -= storm.rotationEnergyCost;
        this.activationTimer = storm.activationCooldown;
        MagneticStorm.rotateClockwise();
        return true;
    },

    update(dt) {
        const step = Math.max(0, dt);
        this.activationTimer = Math.max(0, this.activationTimer - step);
        this.energy = Math.min(CONFIG.magneticStorm.maxEnergy,
            this.energy + CONFIG.magneticStorm.energyRegenPerSecond * step);
    }
};
