const TARGET_REFRESH_SEC = 0.1
const queryBuffer = []

function considerCandidate(tower, enemyPool, index, state) {
  const enemy = enemyPool.get(index)
  if (!enemy.active) return
  const dx = enemy.x - tower.x
  const dy = enemy.y - tower.y
  const distSq = dx * dx + dy * dy
  if (distSq > tower.range * tower.range) return
  // Prefer the enemy furthest along the path (closest to the base).
  const progress = enemy.waypointIndex * 100000 - distSq
  if (progress > state.bestProgress) {
    state.bestProgress = progress
    state.best = index
  }
}

// Optimized path: only scan enemies in nearby spatial-grid cells.
function acquireTargetGrid(engine, tower) {
  const { enemyPool, grid } = engine
  grid.queryCircle(tower.x, tower.y, tower.range, queryBuffer)
  const state = { best: -1, bestProgress: -Infinity }
  for (let i = 0; i < queryBuffer.length; i++) considerCandidate(tower, enemyPool, queryBuffer[i], state)
  return state.best
}

// Baseline path: scan every active enemy on the map (no spatial partitioning) —
// used by Performance Lab's "Baseline" mode to demonstrate the cost this avoids.
function acquireTargetLinear(engine, tower) {
  const { enemyPool } = engine
  const state = { best: -1, bestProgress: -Infinity }
  enemyPool.forEachActive((_enemy, index) => considerCandidate(tower, enemyPool, index, state))
  return state.best
}

function acquireTarget(engine, tower) {
  return engine.flags.spatialGrid ? acquireTargetGrid(engine, tower) : acquireTargetLinear(engine, tower)
}

function isTargetValid(engine, tower) {
  if (tower.targetId < 0) return false
  const { enemyPool } = engine
  if (!enemyPool.isCurrent(tower.targetId, tower.targetGeneration)) return false
  const enemy = enemyPool.get(tower.targetId)
  const dx = enemy.x - tower.x
  const dy = enemy.y - tower.y
  return dx * dx + dy * dy <= tower.range * tower.range
}

export function updateTowers(engine, dt) {
  const { towers, enemyPool, simTime } = engine
  for (let i = 0; i < towers.length; i++) {
    const tower = towers[i]
    tower.cooldown -= dt

    const refreshInterval = engine.flags.targetCache ? TARGET_REFRESH_SEC : 0
    const needsRefresh = !isTargetValid(engine, tower) || simTime - tower.lastAcquire >= refreshInterval
    if (needsRefresh) {
      tower.lastAcquire = simTime
      const found = acquireTarget(engine, tower)
      if (found >= 0) {
        tower.targetId = found
        tower.targetGeneration = enemyPool.generations[found]
      } else if (!isTargetValid(engine, tower)) {
        tower.targetId = -1
      }
    }

    if (tower.targetId < 0) continue
    const target = enemyPool.get(tower.targetId)
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x)

    if (tower.cooldown <= 0) {
      tower.cooldown = 1 / tower.fireRate
      engine.spawnProjectile(tower, tower.targetId)
      tower.flashUntil = simTime + 0.08
    }
  }
}
