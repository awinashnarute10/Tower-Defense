# Retro Tower Defense

A browser-based, retro-arcade Tower Defense game built with React 19, Vite, and a
hand-rolled Canvas2D game engine — no game framework (Phaser/Pixi/Three), no
backend. Fifty algorithmically-generated waves, three tower types with four
upgrade levels each, five enemy types, and a dedicated **Performance Lab** that
demonstrates the optimizations the simulation relies on to stay smooth under
thousands of active entities.

## Overview

Defend the base at the end of a fixed path for 50 waves. Place Cannon, Frost,
and Splash towers on the buildable terrain, upgrade and sell them, and survive
an escalating, procedurally-scaled enemy mix that culminates in a boss every
10th wave. Pause, 1x/2x/3x game speed, and a live FPS/frame-time readout are
available at all times.

## Features

- **50 waves**, generated algorithmically from a single formula (enemy count,
  HP/speed multipliers, unlocked enemy mix) — not hand-authored — with a boss
  wave every 10th wave.
- **5 enemy types**: Grunt, Runner, Tank, Healer (periodically heals nearby
  allies), Boss (large, high-HP, unique sprite).
- **3 tower types**, each with 4 upgrade levels: Cannon (single-target, high
  DPS), Frost (slows on hit, low damage), Splash (area damage, slow fire rate).
- Tower placement with a ghost preview, range circle, and green/red
  valid-placement tinting; selling refunds 65% of total invested cost.
- Pause, 1x/2x/3x simulation speed, restart, main menu, victory/game-over
  screens.
- Visual feedback: floating damage numbers, hit flashes, death-burst
  particles, projectile trails, wave/boss announcement banners, and a
  screen-shake on base damage.
- A **Performance Lab** with Baseline vs Optimized presets and adjustable
  enemy/tower/projectile counts, for stress-testing up to 5000 enemies / 100
  towers / 1000 projectiles and watching the optimizations' effect live.

## Architecture

The project keeps a hard line between React (UI) and the game engine
(simulation), per `src/`:

```
game/            plain JS simulation — no React, no DOM
  GameEngine.js    owns all state: pools, grid, towers, economy, wave runtime
  GameLoop.js      the single requestAnimationFrame driver (fixed timestep)
  GameState.js     initial state shape / constants
  entities/        Enemy, Tower, Projectile — plain classes, reset()-able for pooling
  systems/         EnemySystem, TowerSystem, ProjectileSystem, CollisionSystem, WaveSystem
  spatial/         SpatialGrid — uniform grid for proximity queries
  pools/           EnemyPool, ProjectilePool — free-list object pools
  performance/     PerformanceMonitor — rolling FPS/frame-time stats

rendering/       Canvas2D drawing — reads engine state, never mutates it
  GameRenderer.js  per-frame draw: background, towers, enemies, projectiles, effects
  SpriteCache.js   pre-bakes every sprite once to an offscreen canvas
  Effects.js       pooled damage numbers / death-burst particles

components/      React UI — HUD, shop, panels, menus, Performance Lab controls
data/            towers.js, enemies.js, waves.js, map.js — all game content/tuning
```

**React's job** is strictly presentational: menus, HUD numbers, the tower
shop/upgrade panel, and forwarding raw pointer events from the canvas to the
engine. It never touches simulation state directly and never runs a per-frame
loop of its own.

**The engine's job** is everything that has to happen every tick: movement,
targeting, collision, spawning, economy. It is a single `GameEngine` instance
created once (`useState(() => new GameEngine())`, not a ref — see note below)
and lives entirely outside React's render cycle.

**Bridging the two**: the engine exposes `subscribe`/`getSnapshot`, consumed
via `useSyncExternalStore`, and publishes a new snapshot at a throttled ~12Hz
(`GameLoop`'s `uiTimer`) rather than every simulation tick — so a 60Hz (or
180Hz at 3x speed) simulation doesn't force 60Hz+ React re-renders. The canvas
itself is drawn directly from live engine state inside the render loop and
never goes through React at all.

*Why `useState(() => new GameEngine())` instead of `useRef`*: React's
`react-hooks/refs` rule flags reading `ref.current` during render (correctly —
refs aren't meant to drive render output). Since the engine instance itself
never changes, a lazily-initialized `useState` value is the idiomatic way to
create a single long-lived non-render object without tripping that rule.

## Rendering

Everything is drawn to one `<canvas>` with the 2D context, at a fixed logical
resolution (1280×720) letterboxed into its container. There's no
camera/scrolling — the whole map is always the viewport.

Three layers, cheapest-first:

1. **Static background** (grid, path, spawn/base markers) is rendered once to
   an offscreen canvas at startup and blitted with a single `drawImage` every
   frame instead of being redrawn.
2. **Entity sprites** are pre-baked once per type into small offscreen
   canvases (`SpriteCache.js`) using a hand-drawn 8×8 pixel bitmap per enemy
   type (blob/runner/tank/healer/boss shapes) and a shared turret bitmap for
   towers, recolored per tower type. The render loop just does `drawImage` —
   no gradients, shadows, or path construction per entity per frame. Sprite
   draw positions are rounded to whole pixels, which both fits the pixel-art
   look and avoids sub-pixel resampling cost.
3. **Dynamic overlays** — range circles, the placement ghost, damage numbers,
   hit-flash rings, death-burst particles, projectile trails — are drawn
   directly each frame from small, capped-size arrays.

The retro look (dark background, chunky pixel sprites, scanline/vignette CSS
overlay, pixel font) is a deliberate fit for the performance budget as much as
the aesthetic: flat-color pixel sprites are cheap to bake and cheap to blit,
whereas the spec's original neon-glow look would have pushed toward
per-entity gradients/shadowBlur, which is one of the more expensive things
Canvas2D can do at thousands of instances.

## Game Loop

`GameLoop.js` runs exactly one `requestAnimationFrame` and drives everything
else from it — there is no per-entity timer or animation anywhere in the
codebase.

Fixed timestep with an accumulator:

```js
accumulator += rawDeltaSeconds * gameSpeed
while (accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
  engine.update(FIXED_DT)   // FIXED_DT = 1/60s, always
  accumulator -= FIXED_DT
  steps++
}
render(engine)               // once per rendered frame, regardless of substep count
```

This decouples simulation from the monitor's refresh rate: on a 144Hz display
the sim still advances in fixed 1/60s steps, just with `render()` called more
often; if a frame stalls, up to `MAX_SUBSTEPS` (5) catch-up steps run before
the accumulator is clamped to 0, so a stall produces a visible hitch instead
of a runaway "spiral of death." Game speed (1x/2x/3x) scales how much sim time
is fed into the accumulator per real second, not the substep count directly.

Pausing doesn't stop the loop — `GameEngine.update()` simply no-ops when
`status !== 'playing'` (or `'perflab'`), while rendering and FPS measurement
continue every frame so the paused frame stays visible and the Performance
Panel keeps reading real numbers.

## Performance Bottlenecks

At the scale this game targets (up to 5000 enemies, 100 towers, 1000
projectiles), three things get expensive fast if done naively:

- **Targeting**: a tower checking every active enemy every frame is
  O(towers × enemies) — at 100×5000 that's 500,000 distance checks *per
  frame*, and if it also re-picks a target every frame instead of caching, the
  cost never amortizes.
- **Rendering**: thousands of `drawImage`/`fill`/`stroke` calls per frame are
  fine individually but add up; rebuilding a gradient and stroking an outline
  per enemy per frame (rather than blitting a pre-baked sprite) is the single
  most expensive thing measured in this codebase (see Results below).
- **Allocations**: spawning a `new Enemy()`/`new Projectile()` (and
  discarding one) every time an enemy dies or a shot lands creates constant
  garbage-collection pressure once kills are happening dozens of times a
  second — GC pauses show up directly as frame-time spikes.

## Optimizations

- **Spatial grid** (`spatial/SpatialGrid.js`): a uniform grid over the map;
  towers query only the cells overlapping their range circle instead of
  scanning every enemy. Rebuilt every fixed step by clearing and re-filling
  reused bucket arrays (no reallocation).
- **Object pooling** (`pools/EnemyPool.js`, `pools/ProjectilePool.js`):
  capacity-sized flat arrays (5300 enemy slots, 1100 projectile slots) with a
  free-list for O(1) acquire/release, and a generation counter per slot so a
  stale reference (a tower's cached target, a projectile's target) can be
  detected cheaply instead of causing a mis-hit. Iteration is a manual
  back-to-front loop over only the active indices, so releasing an entity
  mid-iteration (very common — kills happen inside the same pass that walks
  active enemies) can't skip or double-process the swapped-in entity.
- **Target caching** (`systems/TowerSystem.js`): a tower re-queries the grid
  only every ~100ms, or immediately if its current target dies or leaves
  range — not every frame.
- **Viewport/activity culling**: the renderer skips anything outside the
  canvas bounds and, more importantly, only ever iterates *active* pool
  slots (never the full backing array). Because this map has no camera pan,
  off-screen culling's practical effect is modest here — it mainly matters
  for the few entities near the spawn/base points, which sit slightly outside
  the drawn map on purpose. It's implemented for correctness and would matter
  far more in a scrolling/zoomable map.
- **Cached rendering** (`rendering/SpriteCache.js`): every enemy/tower/
  projectile visual is baked once into an offscreen canvas at startup; the
  hot path is `drawImage`, never gradient/path construction. This is the
  single biggest lever measured — see Results.
- **No per-frame allocation in hot loops**: the small "which indices to
  release this tick" scratch arrays in `EnemySystem`/`ProjectileSystem`/
  `CollisionSystem`, and the projectile-visibility list in `GameRenderer`, are
  module-level arrays reused via `array.length = 0` rather than a fresh
  `[]` every call.
- **Squared-distance comparisons**: range/hit/splash checks compare
  `dx*dx + dy*dy` against `r*r` instead of calling `Math.hypot`/`Math.sqrt`
  and comparing to `r`, avoiding a sqrt in the hottest per-pair checks
  (targeting candidates, projectile-hit tests, splash queries).

The **Performance Lab**'s Baseline preset flips three of these off at runtime
(spatial grid → linear scan, target cache → re-acquire every frame, sprite
cache → live gradient+stroke per enemy) so the same codebase can demonstrate
the before/after live, rather than maintaining two separate implementations.
Pooling is always on — at this scale, un-pooled allocation is a stability risk
(GC pauses), not just a speed one, so it isn't offered as a toggle.

## Performance Testing

`PerformanceMonitor.js` keeps a 180-sample ring buffer of `performance.now()`
frame deltas (recorded every raw `requestAnimationFrame`, independent of
pause state or simulation speed) and derives:

- **Avg FPS** and **avg frame time** from the buffer mean.
- **P95 frame time** — the 95th-percentile sample, i.e. "how bad do the worst
  5% of frames get," which average FPS alone hides.
- **% of frames > 33ms** — the spec's stated regression threshold (33ms ≈
  below 30 FPS for that frame).

`GameLoop.js` additionally keeps a lightweight exponential-moving-average
split of time spent in `engine.update()` vs. the render callback each frame
(`engine.timing.updateMs` / `.renderMs`), used below to show *where* the
frame budget actually goes rather than just the total.

The Performance Lab drives this directly: pick an enemy/tower/projectile
target, hit **Apply Stress Test** (or the **Max (5000/100/1000)** shortcut),
and the engine spawns synthetic enemies at random points along the path
(bypassing normal waves/economy) and continuously tops up projectiles against
them, so the pools stay churning near the requested population instead of
just sitting at a static count.

## Results

Measured with the Performance Lab's stress test, each scenario run for 7s
after reaching a stable population, on this development machine (Windows 11,
Chromium via Playwright, GPU-accelerated windowed rendering — **not**
headless; headless/software-rendered Canvas2D measured 20-40% slower on the
same scenarios, since it falls back to CPU rasterization for `drawImage`).
These are the actual numbers produced by that run, not estimates:

| Scenario | Enemies | Towers | Projectiles | Avg FPS | P95 Frame (ms) | Frames >33ms |
|---|---|---|---|---|---|---|
| Baseline | 500 | 50 | 100 | 58 | 17.0 | 3.3% |
| Baseline | 2000 | 100 | 500 | 25 | 50.2 | 88.3% |
| Baseline | 5000 | 100 | 1000 | 15 | 150.0 | 98.3% |
| Optimized | 500 | 50 | 100 | 60 | 16.9 | 0.0% |
| Optimized | 2000 | 100 | 500 | 52 | 33.2 | 5.6% |
| Optimized | 5000 | 100 | 1000 | 35 | 33.5 | 62.2% |

Update/render time split at 5000/100/1000 (from `engine.timing`), which is
the more telling number:

| Mode | update() | render() |
|---|---|---|
| Baseline | 33.4ms | 13.6ms |
| Optimized | 2.8ms | 15.3ms |

This is the honest story: the optimizations move the bottleneck almost
entirely out of simulation (33ms → under 3ms — the spatial grid and target
cache are doing their job) and onto rendering, which barely moves (~14-15ms
either way, since sprite-cache toggling only affects the *style* of draw
call, not the count). At 5000 simultaneous on-screen sprites, ~15ms of
`drawImage` calls is close to the practical floor for Canvas2D without moving
to WebGL — which the spec explicitly rules out. In other words: **Optimized
comfortably clears 45+ FPS up to roughly 2000-2500 concurrent enemies**, and
at the full 5000/100/1000 ceiling it's render-bound rather than logic-bound,
landing in the mid-30s FPS on this machine rather than 45+. The 2.3x
(Baseline→Optimized) improvement at max load, and the near-total elimination
of the update-side cost, is the actual optimization win being demonstrated;
the specific FPS number at the extreme ceiling is a function of this
machine's Canvas2D compositing throughput as much as the algorithm.

## Deployment

### Run locally

```bash
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

### Deploy to Vercel

This is a static Vite app with no backend — Vercel needs no configuration
beyond the defaults it infers for Vite:

1. Push the repo to GitHub (or another Git provider Vercel supports).
2. In Vercel, **Add New Project** → import the repo.
3. Framework preset: **Vite** (auto-detected). Build command `npm run build`,
   output directory `dist` (both auto-filled).
4. Deploy — no environment variables or serverless functions are needed.

Alternatively, from the CLI: `npx vercel` (preview) or `npx vercel --prod`
from the project root.
