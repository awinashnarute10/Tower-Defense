# Retro Tower Defense — Architecture

A browser-based, retro-arcade Tower Defense game built with React 19, Vite, and a
hand-rolled game engine — no game framework, no backend. The renderer is
swappable: a Canvas2D backend (the original implementation) and a
GPU-accelerated WebGL backend (via PixiJS, used strictly as a rendering
library — see [Rendering](#rendering)) can be toggled live from the
Performance Lab and produce pixel-identical output from the same simulation.
Fifty algorithmically-generated waves, three tower types with four upgrade
levels each, five enemy types, and a dedicated **Performance Lab** that
demonstrates the optimizations the simulation and both renderers rely on to
stay smooth under thousands of active entities.

*This document covers how the game is built (engine, rendering, performance
engineering). Looking for how to play instead? See [GAME.md](GAME.md).*

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
- A **Performance Lab** with Baseline vs Optimized presets, a live
  Canvas2D/WebGL renderer toggle with a backend indicator, and adjustable
  enemy/tower/projectile counts, for stress-testing up to 5000 enemies / 100
  towers / 1000 projectiles and watching the optimizations' (and the
  renderer's) effect live.

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

rendering/       drawing — reads engine state, never mutates it
  GameRenderer.js  Canvas2D per-frame draw: background, towers, enemies, projectiles, effects
  SpriteCache.js   pre-bakes every sprite once to an offscreen canvas (shared by both backends)
  Effects.js       pooled damage numbers / death-burst particles (simulation-side, backend-agnostic)
  renderers/       the two interchangeable backend implementations (see Rendering)
    CanvasRenderer.js  thin adapter around the existing GameRenderer
    WebGLRenderer.js   PixiJS-backed GPU renderer

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

Both backends draw the same fixed logical resolution (1280×720) letterboxed
into their container, with no camera/scrolling — the whole map is always the
viewport — and neither ever mutates engine state, only reads it.

### Renderer abstraction

`GameCanvas.jsx` owns a `<div>` container rather than a `<canvas>` directly,
because a canvas can only host one context type (2D *or* WebGL) for its
lifetime — switching backends means swapping the DOM node inside the
container, not reusing one. Both backends implement the same shape:

```js
class SomeRenderer {
  async init(container) {}   // create canvas, set up context/app
  render(engine) {}          // called once per rAF frame from GameLoop
  destroy() {}               // remove canvas, free GPU resources
  get name() {}              // 'canvas2d' | 'webgl' — the actual active backend
}
```

`GameCanvas.jsx` attempts the requested backend's `init()` in a try/catch and
falls back to `CanvasRenderer` on failure (no WebGL support, context creation
error, etc.), reporting whichever backend is *actually* mounted — never
claiming WebGL is active when it silently fell back. `WebGLRenderer.js` is
loaded via a dynamic `import()` only when WebGL is selected, so Canvas2D-only
sessions (the default) never pay for PixiJS's bundle size — it lands in its
own ~235KB chunk instead of the main bundle.

### Canvas2D (`renderers/CanvasRenderer.js` → `GameRenderer.js`)

Three layers, cheapest-first:

1. **Static background** (grid, path, spawn/base markers) is rendered once to
   an offscreen canvas at startup and blitted with a single `drawImage` every
   frame instead of being redrawn.
2. **Entity sprites** are pre-baked once per type into small offscreen
   canvases (`SpriteCache.js`) using a hand-drawn 8×8 pixel bitmap per enemy
   type (blob/runner/tank/healer/boss shapes) and a shared turret bitmap for
   towers, recolored per tower type. The render loop just does `drawImage` —
   no gradients, shadows, or path construction per entity per frame. Sprite
   draw positions are rounded to whole pixels, and active entities are
   bucketed by type/color before drawing so the sprite lookup happens once per
   bucket and same-source blits stay consecutive (see Optimization Log).
3. **Dynamic overlays** — range circles, the placement ghost, damage numbers,
   hit-flash rings, death-burst particles, projectile trails — are drawn
   directly each frame from small, capped-size arrays.

### WebGL (`renderers/WebGLRenderer.js`, via PixiJS)

PixiJS is used **strictly as a rendering library** — `PIXI.Application`,
`PIXI.Sprite`, `PIXI.Container`, `PIXI.Graphics`, and `PIXI.Text` calls only
ever appear inside this one file. It never owns game state, never runs its
own game loop (`autoStart: false` — the same `GameLoop`/`GameEngine` drives
both backends identically, satisfying "one render loop" regardless of which
backend is active), and `GameEngine`/every `systems/*` file is completely
unaware it exists.

- **Texture strategy**: `WebGLRenderer` reuses the *same* `SpriteCache`
  instance as Canvas2D — the baked offscreen canvases are wrapped directly
  with `PIXI.Texture.from(canvas)` (cached in a small Map), so there's a
  single source of truth for what every sprite looks like across both
  backends, and no separate atlas-packing step. A shared 1×1 white texture
  covers every solid-color rect Canvas2D would have drawn with `fillRect`
  (HP bars, projectile trails, particles) — scaled and tinted per use, which
  keeps everything on the sprite batcher instead of needing per-shape
  `Graphics` geometry rebuilds.
- **Object pooling, mirroring `EnemyPool`/`ProjectilePool`**: every sprite,
  text, and graphics object is created exactly once in `init()` and only ever
  has its properties mutated in `render()` — nothing is created or destroyed
  per frame. Enemy/projectile sprite pools are sized to `ENEMY_CAPACITY`/
  `PROJECTILE_CAPACITY` (imported directly from `GameEngine.js`, not
  redeclared), and are indexed by *active position* (`activeIndices[0..activeCount)`)
  rather than by pool slot — the same entity-count-proportional cost as the
  Canvas2D backend's raw-indexed loops, not the pool's full capacity. A slot
  that was active last frame but isn't now just needs hiding, handled by a
  small cleanup loop bounded by how many left this frame, not by capacity.
- **Hit flash** uses a second sprite sharing the same texture, tinted white
  at reduced alpha — the Pixi equivalent of Canvas2D's white overlay circle,
  but silhouetted to the actual sprite shape.
- **Screen shake** offsets the root `PIXI.Container`'s position instead of
  `ctx.translate`.
- Effects (`Effects.js`'s damage numbers/particles) aren't pool-compacted the
  way `EnemyPool` is (they're a ring-buffer cursor, not a swap-remove active
  list), so those two pools (300/400 capacity) get a plain full-capacity scan
  each frame — trivial next to 5000 enemies either way.

Both backends read the identical `Effects.js` data and the identical engine
state; visually they're built to match (same sprites, same colors, same
layout), verified by side-by-side screenshot comparison during development.

The retro look (dark background, chunky pixel sprites, scanline/vignette CSS
overlay, pixel font) is a deliberate fit for the performance budget as much as
the aesthetic: flat-color pixel sprites are cheap to bake and cheap to blit —
on *both* backends — whereas the spec's original neon-glow look would have
pushed toward per-entity gradients/shadowBlur, one of the more expensive
things Canvas2D can do at thousands of instances (and awkward to replicate on
a GPU batcher too).

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
projectiles), several things get expensive fast if done naively. Some of
these were identified by design; others were found by profiling the stress
test after an initial pass didn't meet the "&lt;5% of frames &gt;33ms" target
(see the investigation writeup under Results — this section lists the
findings, that section shows the before/after numbers):

- **Targeting**: a tower checking every active enemy every frame is
  O(towers × enemies) — at 100×5000 that's 500,000 distance checks *per
  frame*, and if it also re-picks a target every frame instead of caching, the
  cost never amortizes.
- **Rendering**: thousands of `drawImage`/`fill`/`stroke` calls per frame are
  fine individually but add up; rebuilding a gradient and stroking an outline
  per enemy per frame (rather than blitting a pre-baked sprite) is the most
  expensive per-entity rendering path measured in this codebase, and even
  with caching, ~5000-6000 `drawImage`/`fillText` calls/frame is the
  practical floor for Canvas2D at this entity count (see Results).
- **Allocations**: spawning a `new Enemy()`/`new Projectile()` (and
  discarding one) every time an enemy dies or a shot lands creates constant
  garbage-collection pressure once kills are happening dozens of times a
  second — GC pauses show up directly as frame-time spikes. This turned out
  to be a real, measurable issue, not just a theoretical one: `EnemyPool`/
  `ProjectilePool.acquire()` originally took a config *object*, and both the
  call site and `EnemyPool.acquire`'s internal `{ ...config, generation }`
  spread allocated a throwaway object on every single spawn — cheap at normal
  wave-spawn rates, but a steady source of garbage at stress-test churn rates.
- **Callback-based iteration in hot loops**: `pool.forEachActive(callback)`
  is a clean API, but at up to 5000 calls/frame the per-entity closure
  invocation has measurable overhead compared to a raw indexed loop over the
  pool's own `activeIndices`/`items` arrays.
- **An O(n) scan hiding inside the stress-test spawner itself**: to keep the
  projectile pool topped up, `GameEngine._maintainStressPopulation()` picked
  a dummy target by scanning the *entire* active-enemy list — up to 200
  times per frame (its own throttling guard) at up to 5000 active enemies.
  That's up to ~1,000,000 wasted iterations/frame, entirely inside the
  Performance Lab's own harness rather than the game itself — a good
  reminder that a stress-test's own code can become the bottleneck it's
  trying to measure.
- **Visual feedback for a hit that deals 0 damage**: the stress test's
  synthetic projectiles deal 0 damage by design (they exist to occupy the
  pool, not to simulate real combat), but they still travelled, "hit", and
  triggered the same `spawnDamageNumber`/hit-flash path a real hit would.
  Because they hit almost instantly and recycle continuously, this kept the
  capped 300-slot damage-number pool saturated, forcing ~300 `fillText`
  calls/frame — and canvas text rendering is far more expensive per call
  than a sprite blit.
- **Canvas2D's draw-call-count ceiling**: after every CPU-side fix above,
  simulation cost fell to ~1ms and the remaining ~12-13ms/frame was
  irreducibly the cost of ~5900 individual `drawImage`/`fillText` calls —
  Canvas2D has no mechanism to submit more than one shape per call the way a
  GPU instanced/batched draw can. This is what motivated trying a
  GPU-accelerated (WebGL) rendering backend — see the Optimization Log.

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
  `[]` every call. `Enemy.reset()`/`Projectile.reset()` and the corresponding
  pool `acquire()` methods take positional arguments rather than a config
  object, so spawning an enemy or projectile — including at stress-test churn
  rates — allocates nothing beyond the return value.
- **Raw indexed loops in the hottest paths**: `EnemySystem`, `ProjectileSystem`,
  `CollisionSystem`, and `GameRenderer`'s enemy/projectile drawing all iterate
  `pool.items[pool.activeIndices[i]]` directly instead of going through
  `pool.forEachActive(callback)`, removing per-entity closure-call overhead
  from the loops that run at full entity count every frame or every fixed
  step. (`forEachActive` is still used for one-off, infrequent operations like
  clearing a pool on restart, where the readability is worth it.)
- **Squared-distance comparisons**: range/hit/splash checks compare
  `dx*dx + dy*dy` against `r*r` instead of calling `Math.hypot`/`Math.sqrt`
  and comparing to `r`, avoiding a sqrt in the hottest per-pair checks
  (targeting candidates, projectile-hit tests, splash queries).
- **No wasted visual feedback for 0-damage hits**: `CollisionSystem` only
  triggers the hit-flash/damage-number effect when `amount > 0` — real combat
  never deals 0 damage, so this only affects the Performance Lab's synthetic
  filler projectiles, but it removes a source of unbounded `fillText` cost
  under stress-test conditions (see Performance Bottlenecks).
- **Render batching by sprite** (`rendering/GameRenderer.js`): `_drawEnemies`
  and `_drawProjectiles` sort active entities into per-type / per-color
  bucket arrays (reused every frame, not reallocated) before drawing, then
  draw one bucket at a time. Canvas2D can't batch `drawImage` calls the way a
  WebGL instanced draw would, but grouping still buys two real things: the
  sprite is looked up once per type (≤5 enemy types, a handful of projectile
  colors) instead of once per entity, and every `drawImage` in a batch shares
  the same source image instead of the source jumping between entities frame
  to frame — friendlier to the browser's internal texture cache.
- **`imageSmoothingEnabled = false`** on the main canvas context
  (`components/GameCanvas.jsx`), set once at setup rather than per frame.
  Sprites are baked at a fixed 32×32 and drawn at each entity's actual size
  (radius-dependent, so often scaled up or down); without this the browser
  bilinear-resamples every scaled `drawImage` call, which costs real time on
  top of the draw itself and blurs what's meant to be crisp pixel art.
- **The last per-call allocation, closed out**: `TowerSystem`'s target
  acquisition used to create a `{ best, bestProgress }` object on every
  target refresh (~10x/sec per tower, not per frame — target caching already
  covers that, but it was still the one place left creating throwaway
  objects). Replaced with two module-level mutable variables reset in place.
  Its baseline-only linear-scan path (`acquireTargetLinear`, used when the
  spatial-grid flag is off) was also still using `forEachActive(callback)`;
  since this is the one targeting path that's O(activeCount), it's the place
  where the closure-call overhead of raw-loop conversion (above) mattered
  most, and switching it over measurably lowered Baseline mode's `update()`
  cost too, on top of Optimized mode's.

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
frame budget actually goes rather than just the total. Both fields (plus FPS,
frame time, P95, and %>33ms) are exposed in `GameEngine`'s published snapshot
and shown live in the Performance Panel, alongside a renderer indicator
badge showing whichever backend is *actually* mounted (`CANVAS2D`/`WEBGL` —
reflecting a fallback if one occurred, never just what was requested) — this
same monitor runs identically regardless of which backend is active, since
both are driven by the one `GameLoop`.

The Performance Lab drives this directly: pick an enemy/tower/projectile
target, hit **Apply Stress Test** (or the **Max (5000/100/1000)** shortcut),
and the engine spawns synthetic enemies at random points along the path
(bypassing normal waves/economy) and continuously tops up projectiles against
them, so the pools stay churning near the requested population instead of
just sitting at a static count. Real towers are also placed and really fight
the synthetic enemies within their range — the stress test isn't a purely
inert entity count, it's live combat at scale. A `CANVAS2D`/`WEBGL` toggle
sits alongside the `BASELINE`/`OPTIMIZED` one, so the exact same stress
configuration can be re-run on either renderer for a direct, like-for-like
comparison without leaving the panel.

**Methodology notes, because they changed the numbers below**:

- While chasing the "&gt;5% of frames &gt;33ms" issue, repeatedly cycling the
  5000/100/1000 scenario back-to-back for several minutes made frame time
  degrade run over run (e.g. 23 → 15 → 12 → 10 FPS across four consecutive
  runs in the same browser session). Sampling `performance.memory` across
  that window showed the JS heap staying essentially flat (13-14MB, no
  sawtooth growth), ruling out an application-level memory leak; letting the
  machine idle ~45s and re-running immediately fully recovered the original
  numbers. Sustained-load thermal/power throttling on this development
  machine under an unusually punishing test pattern, not a bug in the app.
- Benchmarking the WebGL backend surfaced a second, sharper version of the
  same problem: repeated `chromium.launch()`/`browser.close()` cycles (one
  per measurement run, dozens over the course of this work) left **stray
  Chrome processes accumulating in the background** — as many as 12-13
  simultaneous Chrome processes were found still running from earlier
  measurement scripts. On this machine's integrated GPU (Intel Iris Xe,
  shares memory bandwidth and power/thermal budget with the CPU — there's no
  discrete GPU to fail over to), that contention swings a single scenario's
  result by 2x or more (e.g. 56 FPS/7.8% vs 27 FPS/77% for the *identical*
  5000/100/1000/Optimized/WebGL configuration, measured minutes apart). This
  is a real hardware/environment characteristic — a discrete GPU wouldn't
  show anywhere near this much variance — not a flaw in the renderer, but it
  means every WebGL number below required verifying zero stray Chrome
  processes immediately before measuring, and is reported as an honest range
  across multiple such clean runs rather than a single best-case number.
- All numbers are from freshly-loaded pages, reproduced across multiple
  separate runs before being recorded.

## Optimization Log

Each attempt: what was tried, what was actually measured, and what came
next — including the one that didn't fully succeed.

### Attempt 1 — CPU hot-loop fixes

**Hypothesis**: `engine.timing.updateMs`/`.renderMs` profiling showed
Optimized mode averaging 35 FPS at 5000/100/1000 but with 62.2% of frames
still over 33ms — a spiky, inconsistent pace average FPS was hiding.
Isolating enemy/tower/projectile counts independently pointed at four
concrete causes (all under Performance Bottlenecks above): callback-based
`forEachActive` iteration in the hottest loops, an O(n) enemy scan inside the
stress-test's own projectile-topping-up logic (run up to 200×/frame), a
config-object allocation on every `Enemy`/`Projectile` spawn, and zero-damage
synthetic hits saturating the capped damage-number pool with ~300
`fillText` calls/frame.

**Applied**: raw indexed loops in place of `forEachActive(callback)`; O(1)
dummy-target lookup instead of an O(n) scan; positional-argument
`reset()`/`acquire()` instead of config objects; skip hit-flash/damage-number
spawn when `amount <= 0`.

**Measured** (5000/100/1000, Optimized, fresh page):

| Metric | Before | After |
|---|---|---|
| `updateMs` | 2.8ms | ~1.0ms |
| `renderMs` | 15.3ms | ~13ms |
| Avg FPS | 35 | 42 |
| Frames >33ms | 62.2% | ~39% |

**Verdict**: real, reproducible ~35-40% relative reduction in bad frames —
partial success, not a full fix. Update cost is now negligible; render cost
(~13ms) is only slightly over one 60Hz vsync interval (16.7ms), which
matches what was observed: frame times clustering near one vsync (16.7ms) or
two (33.3ms) rather than spreading smoothly. **Next**: close the remaining
render-side gaps rather than declare victory on a partial fix.

### Attempt 2 — render batching and the last allocation

**Hypothesis**: being that close to the vsync edge meant a small further
render-side reduction could matter disproportionately. `_drawEnemies`/
`_drawProjectiles` looked up a sprite from the cache per *entity* (≤5000
Map/object lookups/frame) instead of per *type*; the main canvas context
never set `imageSmoothingEnabled = false`, so every scaled `drawImage` call
(most enemies — sprites are baked at 32×32, drawn at varying radii) paid for
browser-side bilinear resampling; and `TowerSystem`'s target-acquisition
helper still allocated a `{ best, bestProgress }` object per target refresh,
with its baseline-only O(n) linear-scan path still using
`forEachActive(callback)`.

**Applied**: bucket-and-draw batching by sprite type/color; `imageSmoothingEnabled = false`
set once at canvas setup; the allocation replaced with two reused
module-level variables; the linear-scan path converted to a raw loop.

**Measured** (5000/100/1000, Optimized, on top of Attempt 1's numbers):

| Metric | After attempt 1 | After attempt 2 |
|---|---|---|
| `renderMs` | ~13ms | ~12.2ms |
| Avg FPS | 42 | 42-44 |
| Frames >33ms | ~39% | ~34% |

**Verdict**: a smaller, incremental win, as expected — attempt 1 had already
removed the large, clearly-wrong costs, so attempt 2 was trimming per-call
overhead on an already-lean path. The draw-call *count* itself (~5900/frame)
was unchanged, because Canvas2D fundamentally cannot batch a `drawImage` call
the way a GPU instanced/batched draw can. **Next**: the remaining bottleneck
is structural to Canvas2D, not fixable by further CPU-side tuning — try a
GPU-accelerated rendering backend.

### Attempt 3 — WebGL (PixiJS) rendering backend

**Hypothesis**: replacing only the rendering layer with a GPU-accelerated
backend (PixiJS, used strictly as a rendering library — see
[Rendering](#rendering)) should let the GPU batch the ~5900 draw calls/frame
that Canvas2D issues one at a time, closing the remaining gap to the &lt;5%
target without touching `GameEngine` or any simulation system.

**Applied**: `WebGLRenderer.js` — pooled `PIXI.Sprite`/`Text`/`Graphics`
objects (created once, mutated per frame, never recreated), reusing the
existing `SpriteCache` textures, indexed by active position exactly like the
Canvas2D backend's raw loops (see Rendering above for the full design). A
renderer abstraction (`CanvasRenderer`/`WebGLRenderer`, both implementing
`init`/`render`/`destroy`/`name`) lets `GameCanvas.jsx` mount either one, with
a try/catch fallback to Canvas2D and a UI toggle + indicator in the
Performance Lab.

**Measured** (5000/100/1000, Optimized, fresh page each run, zero stray
Chrome processes verified before each — see the methodology note above):

| Scenario | Avg FPS | Frames >33ms | updateMs | renderMs |
|---|---|---|---|---|
| Canvas2D (clean runs) | 34-43 | 36.7-75.6% | ~1.0-1.7ms | ~12.8-16.4ms |
| WebGL (clean runs) | 46-56 | 7.8-27.8% | ~1.1-1.6ms | ~17.6-19.9ms |
| WebGL (one contaminated run, for scale) | 27-30 | 76.7-81.7% | 2.5-3.7ms | 25.4-29.2ms |

**Verdict — a real, substantial improvement, but not a guaranteed pass on
this hardware**. Excluding the shared-cause bad outliers (present in *both*
backends under contention — this is a machine/environment characteristic,
not a WebGL-specific flaw), WebGL typically runs at roughly **2-3x fewer
over-budget frames** than Canvas2D at the identical stress configuration
(median frames-over-budget: WebGL ~14%, Canvas2D ~41%), and its best clean
runs (7.8-10%) come close to the &lt;5% target — closer than Canvas2D ever
gets — but don't reliably clear it on this integrated-GPU test machine.
Note also that `renderMs` (WebGL's is *higher* than Canvas2D's, ~18ms vs
~13ms) is measuring JS-side submission time to `app.render()`, not GPU
compute time — WebGL's actual advantage shows up in total frame time and
`pctOver33`, not in that one number, because the GPU does the batched
compositing work in parallel with — and faster than — Canvas2D's fully
synchronous per-call CPU rasterization.

**Next, if pursued further**: (1) re-measure on non-integrated-GPU hardware,
where this contention characteristic shouldn't exist; (2) replace the pooled
`PIXI.Text` damage numbers with `PIXI.BitmapText` (glyph-atlas-based, much
closer in cost to a sprite blit than Pixi's canvas-based `Text`) as the next
concrete candidate, since text objects are the one display-object type in
`WebGLRenderer` that isn't a plain textured sprite; (3) profile whether
Pixi's automatic batch size limit is being hit and splitting the ~5900
sprites into more draw calls than the theoretical minimum.

## Results

### Benchmark table

Measured with the Performance Lab's stress test, each scenario run for 9-12s
after reaching a stable population, on freshly-loaded pages (Windows 11,
Intel Iris Xe integrated graphics, Chromium via Playwright, GPU-accelerated
windowed rendering — **not** headless; headless/software-rendered Canvas2D
measured 20-40% slower on the same scenarios, since it falls back to CPU
rasterization for `drawImage`). Reproduced across multiple fresh-page runs
with verified-clean process state; ranges reflect real measured variance, not
uncertainty about a single number:

| Scenario | Enemies | Towers | Projectiles | Avg FPS | P95 Frame (ms) | Frames >33ms |
|---|---|---|---|---|---|---|
| Baseline, Canvas2D | 500 | 50 | 100 | 55-60 | 17-33 | 0-8% |
| Baseline, Canvas2D | 2000 | 100 | 500 | 23-25 | 50-67 | 88-100% |
| Baseline, Canvas2D | 5000 | 100 | 1000 | 15-16 | 117-150 | 68-100% |
| Optimized, Canvas2D | 500 | 50 | 100 | 60 | 17 | 0% |
| Optimized, Canvas2D | 2000 | 100 | 500 | 60 | 17-34 | **0%** |
| Optimized, Canvas2D | 5000 | 100 | 1000 | 34-44 | 33-34 | 34-76% |
| Optimized, WebGL | 5000 | 100 | 1000 | 46-57 | 33-50 | **7.8-28%** |

This is the honest story: the CPU-side optimizations move the bottleneck
almost entirely out of simulation (Baseline's `update()` cost still balloons
to 17-33ms from the O(towers × enemies) linear scan; Optimized's stays under
~1.7ms at every scale, on both renderers) and onto rendering, which is the
sole meaningful cost at the top end. **The spec's 45+ FPS / &lt;5% &gt;33ms
bar is comfortably and consistently met by Optimized Canvas2D up to 2000
concurrent enemies** (100 towers, 500 projectiles) — a scale most real
playthroughs will never approach, since even wave 50's generated enemy count
is a small fraction of that. At the full 5000/100/1000 ceiling, switching to
the WebGL backend roughly halves the worst-case frame time distribution
compared to Canvas2D and gets close to the &lt;5% target in its best runs,
but — measured honestly, including the runs that didn't look good — doesn't
reliably guarantee it on this integrated-GPU machine. **We are not claiming
the &lt;5% target is met at the full 5000/100/1000 ceiling on this
hardware**; it is met at 2000 concurrent enemies on Canvas2D alone, and the
WebGL backend is a real, measured, substantial improvement at the ceiling
without being a certain pass.

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
