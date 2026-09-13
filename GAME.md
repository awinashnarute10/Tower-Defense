# Retro Tower Defense — Game Guide

A pixel-art, arcade-style Tower Defense game. Enemies march down a fixed path
toward your base; you place and upgrade towers along the way to stop them
before they get through. Survive all 50 waves to win.

*(Looking for how the game is built instead of how to play it? See
[ARCHITECTURE.md](ARCHITECTURE.md).)*

## Objective

Your base sits at the end of the path with **100 health**. Every enemy that
reaches it deals damage. Health hits zero → **Game Over**. Clear all **50
waves** → **Victory**.

## Controls

| Action | How |
|---|---|
| Select a tower to place | Click its card in the **Tower Shop** (right panel) |
| Place the selected tower | Click a highlighted buildable tile on the map |
| Cancel placement | Right-click anywhere on the map |
| Select a placed tower | Click on it (works even while another tower type is selected) |
| Upgrade / sell the selected tower | Buttons in the panel that appears below the shop |
| Pause / Resume | **PAUSE** button (top right) |
| Change simulation speed | **1x / 2x / 3x** buttons (top right) |
| Restart or return to menu | Pause menu, or the Game Over / Victory screen |

While placing a tower, its range circle and a ghost preview follow your
cursor: **green** means you can build there, **red** means you can't (either
the tile is too close to the path, already occupied, or you can't afford it).

## The Map

Enemies spawn on the left and walk the fixed path to the base on the right.
You can build anywhere off the path, subject to a small clearance margin
around it — towers can't be placed directly on or hugging the road.

## Towers

Every tower has 4 upgrade levels. Upgrading costs money and improves damage,
range, and fire rate (and, for Frost/Splash, their special stat). Selling a
tower refunds **65%** of everything you've spent on it (purchase + upgrades).

### Cannon — single-target, high DPS
Your reliable all-rounder: solid damage against one enemy at a time, good
fire rate, respectable range.

| Level | Damage | Range | Fire Rate | Cost |
|---|---|---|---|---|
| 1 | 30 | 120 | 2.0/s | $100 |
| 2 | 45 | 130 | 2.2/s | $140 |
| 3 | 70 | 145 | 2.5/s | $220 |
| 4 | 110 | 160 | 3.0/s | $340 |

### Frost — slows enemies, low damage
Weak on its own, but every hit slows the target — great for controlling
Runners and buying your other towers more time in range. Stack it early on
corners where enemies would otherwise blast through quickly.

| Level | Damage | Range | Fire Rate | Slow | Slow Duration | Cost |
|---|---|---|---|---|---|---|
| 1 | 8 | 110 | 1.5/s | −50% speed | 1.5s | $90 |
| 2 | 12 | 120 | 1.6/s | −44% speed | 1.6s | $120 |
| 3 | 18 | 130 | 1.8/s | −37% speed | 1.8s | $190 |
| 4 | 26 | 145 | 2.0/s | −28% speed | 2.0s | $300 |

### Splash — area damage, slow fire rate
Fires slowly but hits every enemy within its splash radius on impact — the
answer to tightly-packed groups, especially on the straight stretches where
enemies bunch up.

| Level | Damage | Range | Fire Rate | Splash Radius | Cost |
|---|---|---|---|---|---|
| 1 | 40 | 130 | 0.8/s | 50 | $150 |
| 2 | 60 | 140 | 0.9/s | 58 | $210 |
| 3 | 90 | 150 | 1.0/s | 66 | $320 |
| 4 | 130 | 165 | 1.15/s | 75 | $480 |

## Enemies

New types unlock as waves progress, and the whole roster gets scaled up
(more HP, more speed) as the waves climb — the numbers below are their wave-1
baseline stats.

| Enemy | Unlocks at Wave | HP | Speed | Reward | Notes |
|---|---|---|---|---|---|
| Grunt | 1 | 100 | Normal | $10 | The baseline threat — expect a steady stream of these all game. |
| Runner | 3 | 60 | Very fast | $12 | Low HP but outruns most towers' fire windows — slow it down first. |
| Tank | 5 | 500 | Slow | $50 | Huge HP pool; needs sustained focus fire, not a quick kill. |
| Healer | 8 | 200 | Medium | $25 | Periodically heals nearby allies — kill it first or its group outlasts your DPS. |
| Boss | Every 10th wave | 3200+ (scales up each boss wave) | Slow | $300 | Large, high-HP, arrives with an escort. A red "BOSS INCOMING" warning banner gives you time to prepare. |

## Waves & Difficulty

- **50 waves total**, generated algorithmically — enemy count, HP, and speed
  all scale up with wave number, and the enemy mix broadens as new types
  unlock.
- **Every 10th wave is a boss wave**: a single Boss plus an escort of
  regular enemies. Watch for the on-screen boss warning banner.
- A short intermission (with a wave-clear money bonus) follows each wave
  before the next one begins automatically.

## Economy

- Start with **$500** and **100 health**.
- Killing an enemy earns its reward (money) and score.
- Clearing a wave earns a bonus on top of that.
- Selling a tower refunds 65% of its total invested cost (purchase +
  upgrades) — useful for respeccing your defense as the enemy mix shifts.

## Game States

- **Main Menu** — Start Game or open the Performance Lab.
- **Playing** — the core loop described above.
- **Paused** — simulation freezes completely; resume, restart, or return to
  the main menu.
- **Victory** — reached after clearing wave 50.
- **Game Over** — reached when base health hits zero.
- **Performance Lab** — a separate sandbox for stress-testing the engine
  itself (not part of normal play) — see ARCHITECTURE.md if you're curious
  what it's demonstrating.

## Tips

- Frost early, Splash on choke points, Cannon everywhere else is a solid
  general-purpose loadout.
- Corners and dead-ends where the path doubles back are prime real estate —
  a tower there can hit the same enemies on two different path segments.
- Don't sleep on Runners: their raw speed means a tower with too little
  range or too slow a fire rate barely gets a shot off before they're gone.
- Save some money heading into a boss wave (every 10th) rather than
  spending down to zero — you'll want to react to the boss's escort.
