const TARGET_REFRESH_SEC = 0.1
const queryBuffer = []
// Reused across every target-refresh call instead of a `{ best, bestProgress }`
// object literal per call — with target caching this is only ~10x/sec per
// tower, not per frame, but it's still the last remaining per-call allocation
// in the targeting path, so it's worth closing out.
let bestCandidate = -1
let bestCandidateProgress = -Infinity

function considerCandidate(tower, enemyPool, index) {
  const enemy = enemyPool.get(index)
  if (!enemy.active) return
  const dx = enemy.x - tower.x
  const dy = enemy.y - tower.y
  const distSq = dx * dx + dy * dy
  if (distSq > tower.range * tower.range) return
  // Prefer the enemy furthest along the path (closest to the base).
  const progress = enemy.waypointIndex * 100000 - distSq
  if (progress > bestCandidateProgress) {
    bestCandidateProgress = progress
    bestCandidate = index
  }
}

// Optimized path: only scan enemies in nearby spatial-grid cells.
function acquireTargetGrid(engine, tower) {
  const { enemyPool, grid } = engine
  grid.queryCircle(tower.x, tower.y, tower.range, queryBuffer)
  bestCandidate = -1
  bestCandidateProgress = -Infinity
  for (let i = 0; i < queryBuffer.length; i++) considerCandidate(tower, enemyPool, queryBuffer[i])
  return bestCandidate
}

// Baseline path: scan every active enemy on the map (no spatial partitioning) —
// used by Performance Lab's "Baseline" mode to demonstrate the cost this avoids.
// Raw indexed loop over the pool's own arrays rather than forEachActive(callback):
// this is the one targeting path that's O(activeCount), so the per-entity
// closure-call overhead matters here more than anywhere else in the engine.
function acquireTargetLinear(engine, tower) {
  const { enemyPool } = engine
  bestCandidate = -1
  bestCandidateProgress = -Infinity
  const { activeIndices, activeCount } = enemyPool
  for (let i = 0; i < activeCount; i++) considerCandidate(tower, enemyPool, activeIndices[i])
  return bestCandidate
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
