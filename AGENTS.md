# GALACTIC INVASION – PROJECT DEVELOPMENT INSTRUCTIONS

## 1. PROJECT OVERVIEW

**Project name:** Galactic Invasion

**Project type:** 2D Arcade Space Shooter

**Development approach:** Vanilla Frontend Game Development

Galactic Invasion is a browser-based 2D space shooter game. The project originally started as a classic arcade space shooter where players control a spaceship, shoot enemies, avoid enemy attacks and survive increasingly difficult waves.

The long-term goal is to evolve the game into a distinctive futuristic space-combat experience with a unique visual identity and a signature environmental gameplay mechanic called **Magnetic Storm / Storm Steering**.

The project is currently a prototype. Prioritize gameplay quality, visual identity, responsiveness and maintainable code over feature quantity.

### Main objectives

1. Develop stable and enjoyable core gameplay.
2. Establish a recognizable futuristic cosmic visual identity.
3. Support mobile portrait gameplay with touch controls.
4. Build the Magnetic Storm system as the game's signature mechanic.
5. Maintain a clean and scalable vanilla JavaScript architecture.

Do not prioritize story, lore, dialogue, narrative missions or world-building documentation. These are outside the current development scope.

---

# 2. STRICT TECHNICAL REQUIREMENTS

These requirements are mandatory.

### Allowed technologies

- HTML5
- CSS3
- Vanilla JavaScript
- HTML5 Canvas
- Native JavaScript ES Modules (import/export)
- LocalStorage
- Web Audio API
- Native browser APIs

### Prohibited technologies

Do NOT use:

- React
- Vue
- Angular
- Svelte
- TypeScript
- Tailwind CSS
- Bootstrap
- jQuery
- Phaser
- Three.js
- PixiJS
- Other frontend frameworks or game engines
- External JavaScript libraries
- Backend services
- Databases
- External APIs
- Build tools or bundlers

### File organization

The project must remain a pure HTML/CSS/JavaScript project.

Use:
- One main HTML entry point.
- Multiple CSS files, preferably organized into 3–4 logical files.
- Multiple JavaScript files organized by responsibility.
- An assets directory for images, sounds and other static resources.

Suggested structure:

GalacticInvasion/
│
├── index.html
│
├── css/
│   ├── style.css
│   ├── game.css
│   ├── ui.css
│   └── effects.css
│
├── js/
│   ├── main.js
│   ├── config.js
│   │
│   ├── core/
│   │   ├── Game.js
│   │   ├── GameLoop.js
│   │   └── GameState.js
│   │
│   ├── entities/
│   │   ├── Player.js
│   │   ├── Enemy.js
│   │   └── Projectile.js
│   │
│   ├── systems/
│   │   ├── CombatSystem.js
│   │   ├── EnemySystem.js
│   │   ├── CollisionSystem.js
│   │   └── MagneticStorm.js
│   │
│   ├── rendering/
│   │   ├── Renderer.js
│   │   └── ParticleSystem.js
│   │
│   └── ui/
│       ├── HUD.js
│       └── Menu.js
│
└── assets/
    ├── images/
    └── sounds/

This is a suggested structure, not a requirement to recreate the project from scratch. Inspect the existing workspace and preserve its current organization when appropriate.

### Architecture rules

1. Every module must have a clear responsibility.
2. Use ES Modules for communication between files.
3. Avoid unnecessary global variables.
4. Avoid duplicated game loops and rendering systems.
5. Keep configuration values centralized.
6. Separate game logic, rendering, input handling and UI.
7. Do not create excessive files for trivial code.
8. Preserve existing working functionality when refactoring.

Run the project through a local development server such as VS Code Live Server. Do not rely on opening ES modules directly through file://.

---

# 3. ART DIRECTION – OFFICIAL VISUAL IDENTITY

The agreed visual direction is:

# NEO COSMIC COMMAND

**Concept:** Cinematic Deep Space × Advanced Technology × Tactical Command Interface.

The game should feel like a futuristic spacecraft combat system operating inside a vast, mysterious and visually rich universe.

The visual identity must combine two major elements:

### A. Neo Cosmic

- Deep space environments.
- Rich nebula formations.
- Cosmic clouds.
- Distant stars and celestial objects.
- Plasma and quantum energy.
- Atmospheric lighting.
- Spatial depth and parallax.

### B. Stellar Command

- Modern tactical interfaces.
- Futuristic spacecraft systems.
- Holographic panels.
- Radar and navigation displays.
- Technical typography.
- Minimal but precise information panels.
- Clean, sophisticated UI components.

The overall result must look modern, cinematic and distinctive.

Do not make the game look like a generic Cyberpunk game or a conventional military simulator.

## 3.1. Official Color Palette

Use the following colors as the primary design system:

| Name | HEX | Usage |
|---|---|---|
| Deep Void | #050816 | Main background |
| Nebula Navy | #101A32 | Panels and environment |
| Quantum Cyan | #46D9E8 | Technology and interaction |
| Cosmic Violet | #8B79F5 | Cosmic energy |
| Solar Amber | #FFB45C | Warnings |
| Stellar White | #EDF4FF | Main text |
| Danger Coral | #FF657A | Damage and danger |
| Nebula Mist | #9BAAC4 | Secondary text |

Visual balance:

- Approximately 65% dark cosmic background.
- Approximately 15% environmental colors.
- Approximately 12% cyan technology accents.
- Approximately 5% violet energy.
- Approximately 3% warm warning accents.

These percentages are design guidelines, not rigid limits.

Glow intensity must remain balanced. Avoid making every UI element glow.

## 3.2. Environment Design

The space environment should have multiple visual layers:

1. Distant stars and celestial objects.
2. Nebula clouds and cosmic dust.
3. Planets, asteroids and distant structures.
4. Foreground plasma and energy effects.

Use parallax and independent movement speeds to create depth.

Important: Keep the gameplay area readable. Background effects must not interfere with enemy visibility, projectiles or player movement.

## 3.3. Spaceship Design

Player spaceship:

- Modern futuristic mechanical appearance.
- Distinctive silhouette.
- Dark metallic or blue-black body.
- Cyan engine glow.
- Violet energy details.
- Responsive engine effects.

Enemy spaceships:

- Visually distinct from the player.
- Different silhouettes according to their combat roles.
- Violet, coral or other appropriate energy accents.
- Clear visual distinction between enemy types.

Do not simply recolor existing objects and call them a new visual design.

## 3.4. UI Design

Use a modern Tactical Holographic Interface.

Preferred elements:

- Dark translucent panels.
- Thin cyan borders.
- Restrained violet accents.
- Circular radar.
- Technical indicators.
- Energy bars.
- Minimal animation.
- Readable modern sans-serif typography.
- Monospace typography for telemetry and technical values.

The UI must prioritize gameplay visibility and readability.

## 3.5. Magnetic Storm Visual Identity

Magnetic Storm will eventually become the game's signature visual element.

Its visual components should include:

- Storm Core.
- Dynamic Magnetic Field Lines.
- Energy Particles.
- Spatial Distortion.
- Periodic Storm Pulse.

The player should clearly see when the storm changes direction or intensity due to their actions.

---

# 4. CURRENT GAMEPLAY DIRECTION

The existing arcade shooter foundation should be preserved.

Existing gameplay concepts include:

- Player movement.
- Continuous projectile firing.
- Enemy formations.
- Enemy attacks.
- Collision detection.
- Health and lives.
- Score system.
- Wave and level progression.
- Power-ups.
- Rapid Fire.
- Spread Shot.
- Barrier.
- Pause and Game Over states.
- Local high-score storage.

Do not rebuild these systems unless there is a clear technical reason.

Before changing gameplay code, inspect how the existing systems interact.

---

# 5. CURRENT MOBILE CONTROL SPECIFICATION

The agreed mobile control system is:

# ONE-FINGER COMBAT

Mobile and tablet users should only need one finger to control the spaceship.

## 5.1. Direct Touch Drag

Use direct touch dragging.

Expected behavior:

1. The user touches the gameplay area.
2. The game records the initial pointer position and the player's relative offset.
3. The user drags their finger.
4. The spaceship follows the finger's movement.
5. The spaceship stops when the finger is released.

Important requirements:

- The spaceship must not jump abruptly when touch begins.
- Preserve the initial touch-to-ship offset.
- Use smooth but responsive movement.
- Avoid excessive movement inertia.
- Allow only one active controlling pointer.
- Ignore additional fingers.
- Release pointer state correctly when the pointer is cancelled or interrupted.
- UI buttons must not accidentally trigger ship movement.

Do not implement a virtual joystick.

Do not add a mobile FIRE button.

## 5.2. Auto-Shoot

Mobile and touch gameplay must use automatic shooting.

The weapon should fire continuously while the game is in the Playing state.

Reuse the existing weapon cooldown and projectile systems.

Preserve:
- Existing fire rate.
- Rapid Fire.
- Spread Shot.
- Projectile limits.
- Damage calculation.
- Existing weapon effects.

Do not create a second shooting system.

Auto-Shoot must stop when:
- The game is paused.
- Game Over occurs.
- The game is on the main menu.
- The page becomes hidden or the game is suspended.

Auto-Shoot should resume appropriately when gameplay resumes.

## 5.3. Desktop Controls

Desktop users retain the classic controls:

- WASD / Arrow Keys: Move.
- Space: Manual shooting.
- Escape: Pause, where appropriate.

Desktop must not automatically fire unless a deliberate control mode is introduced later.

For hybrid devices, detect the actual input mode rather than relying only on the User-Agent string.

---

# 6. RESPONSIVE DESIGN – PORTRAIT ONLY ON MOBILE

This is an important confirmed decision.

Mobile gameplay must be optimized for portrait orientation only.

Do not create a separate mobile landscape gameplay layout.

### Mobile requirements

- Fullscreen-style portrait gameplay.
- Canvas uses the full available screen width and height.
- No fixed square game container.
- No unnecessary empty margins.
- No horizontal scrolling.
- HUD adapts to small screens.
- Respect device safe areas.
- Use appropriate viewport sizing.
- Handle screen resizing and orientation changes.
- Maintain correct object proportions.

Use modern viewport measurements such as 100dvh with appropriate fallbacks.

Use ResizeObserver where appropriate.

Limit devicePixelRatio to a reasonable value, approximately 2, to avoid excessive Canvas rendering cost.

### Portrait Game World

The game world must adapt to the available portrait viewport.

Do not stretch sprites, spaceships or projectiles to fill the viewport.

Adjust the logical world dimensions, camera or scaling strategy so that:

- Spaceships preserve their proportions.
- Projectile trajectories remain correct.
- Enemy formations fit the available play area.
- The player has sufficient movement space.
- HUD does not obscure important combat areas.

### Landscape Mobile

When a mobile device is in landscape orientation:

- Do not display a separate landscape gameplay layout.
- Show a simple rotate-device message or overlay.
- Ask the player to rotate the device back to portrait.

Desktop landscape gameplay remains supported.

### Touch UX

The game area must support touch dragging without unwanted browser scrolling or gestures.

Use touch-action rules carefully. Do not disable normal browser interactions globally.

---

# 7. RESPONSIVE HUD CONTENT

Mobile HUD should contain only essential information:

1. Hull / Health.
2. Score.
3. Wave.
4. Pause button.
5. Auto-Shoot status.
6. Storm Energy.

Additional technical information may be hidden or minimized on small screens.

Desktop may retain a more complete HUD.

All important buttons must remain large enough to operate on touch screens. Use approximately 44 × 44 CSS pixels as a minimum target where practical.

---

# 8. CURRENT DEVELOPMENT PRIORITIES

The previous long-term roadmap is temporarily paused.

Do not independently continue or expand the old roadmap without user approval.

Current priorities:

### Priority 1 – Responsiveness and Core Experience

- Verify portrait fullscreen behavior.
- Verify Direct Touch Drag.
- Verify Auto-Shoot.
- Verify pause and resume.
- Verify desktop keyboard controls.
- Verify Canvas scaling.
- Fix UI overlap and layout issues.

### Priority 2 – Visual Identity

- Improve the Neo Cosmic Command design.
- Improve the space environment.
- Improve spaceship and enemy visual identity.
- Improve HUD and menu design.
- Avoid superficial recoloring of legacy layouts.

### Priority 3 – Magnetic Storm Prototype

Only start this feature when requested.

The intended mechanic:

- Magnetic field influences projectile trajectories.
- The player can control field direction.
- Energy particles react to magnetic forces.
- Environment affects combat.
- The system must create meaningful tactical decisions.

Do not add multiple weather systems yet.

Start with one complete and enjoyable Magnetic Storm implementation.

---

# 9. DEVELOPMENT WORKFLOW

You are working directly inside the user's existing VS Code workspace.

The workspace is the single source of truth.

Do not ask the user to download and re-upload ZIP files for normal code changes.

## Before making changes

1. Inspect the entire relevant project structure.
2. Read existing HTML, CSS and JavaScript files.
3. Identify current working functionality.
4. Check imports and dependencies.
5. Inspect Git status if Git is available.
6. Identify relevant modules before modifying them.

Do not assume previous project versions or archived ZIP files match the current workspace.

## During implementation

1. Modify the actual project files directly.
2. Keep changes focused on the requested task.
3. Preserve working functionality.
4. Reuse existing systems whenever possible.
5. Avoid unnecessary rewrites.
6. Do not introduce frameworks or external dependencies.
7. Keep the code readable and maintainable.
8. Handle errors and edge cases.
9. Maintain consistent naming and module responsibilities.
10. Do not create duplicate implementations of existing systems.

Do not delete existing functionality simply because it is not part of the current task.

Before destructive changes, inspect their dependencies and preserve recoverability.

## After implementation

Always perform appropriate checks:

- JavaScript syntax validation.
- HTML reference checks.
- CSS validation.
- ES module import checks.
- Runtime checks when possible.
- Input behavior checks.
- Canvas resize checks.
- Responsive layout checks.

Distinguish between:
- Tests actually executed and passed.
- Tests not executed.
- Behavior that still requires manual testing on a real device.

Never claim that a browser feature or mobile interaction has been tested if it was only statically inspected.

## Reporting

After each task, provide a concise report containing:

1. Files modified.
2. Features implemented.
3. Existing functionality preserved.
4. Tests executed and results.
5. Remaining problems or limitations.

Do not produce unnecessarily long reports.

---

# 10. DESIGN AND IMPLEMENTATION RULES

These rules are especially important.

### Do not perform superficial redesigns

Changing only background colors, button colors or borders does not constitute a complete visual redesign.

When asked to redesign an interface:

- Review the existing hierarchy.
- Review layout and spatial composition.
- Review typography.
- Review visual balance.
- Review interactions.
- Reconsider the component structure when necessary.

The target is a coherent Neo Cosmic Command experience.

### Do not overcomplicate the prototype

Avoid adding unnecessary features.

Prioritize:
- Core gameplay.
- Responsive controls.
- Visual consistency.
- Stability.
- Performance.

A small number of well-executed mechanics is preferable to many unfinished features.

### Preserve the user's decisions

Do not independently change:
- Art direction.
- Color palette.
- Mobile orientation strategy.
- Touch control method.
- Technology restrictions.
- Project scope.

When a significant design decision is needed, present the proposal before making irreversible changes.

---

# 11. FIRST TASK FOR CODEX

Before developing additional gameplay features, perform a complete inspection of the current VS Code workspace.

Specifically:

1. Read and map the actual project structure.
2. Identify the main HTML entry point.
3. Identify all CSS files.
4. Identify all JavaScript modules.
5. Understand the current Game Loop.
6. Understand Canvas sizing and coordinate systems.
7. Understand Player Movement and Input Handling.
8. Understand Shooting and Weapon Cooldown.
9. Understand Auto-Shoot behavior.
10. Understand Pause, Game Over and Resume.
11. Understand the portrait-only fullscreen implementation.
12. Identify any unused or duplicate code.

Then provide a concise technical report describing:

- What is already implemented.
- What works.
- What is incomplete.
- What is technically problematic.
- What should be improved next.

Do not rebuild the project.

Do not replace working code without a clear reason.

Do not start a new feature before the user selects the next task.

Your responsibility is to work as a senior frontend/gameplay engineer: maintain the codebase, protect existing functionality and improve the game incrementally.

**Final principle: Build a distinctive game, not just a collection of features.**