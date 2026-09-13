const HIT_MARGIN = 6
const queryBuffer = []
const toRelease = []

function killIfDead(engine, enemy, index) {
  if (enemy.hp > 0) return false
  engine.state.money += enemy.reward
  engine.state.score += enemy.scoreValue
  engine.effects.spawnDeathBurst(enemy.x, enemy.y, enemy.color)
  engine.enemyPool.release(index)
  return true
}

function damageEnemy(engine, index, amount, color) {
  const enemy = engine.enemyPool.get(index)
  enemy.hp -= amount
  // A 0-damage hit (only possible from the Performance Lab's dummy stress
  // projectiles) shouldn't trigger visual feedback — real combat never deals
  // 0 damage, and skipping this avoids flooding the capped damage-number
  // pool with meaningless "0"s, which was forcing ~300 fillText calls/frame.
  if (amount > 0) {
    enemy.hitFlashUntil = engine.simTime + 0.12
    engine.effects.spawnDamageNumber(enemy.x, enemy.y - enemy.radius, amount, color)
  }
  killIfDead(engine, enemy, index)
}

export function resolveCollisions(engine) {
  const { projectilePool, enemyPool, grid } = engine
  toRelease.length = 0

  const { items, activeIndices, activeCount } = projectilePool
  for (let pi = 0; pi < activeCount; pi++) {
    const index = activeIndices[pi]
    const p = items[index]
    if (!enemyPool.isCurrent(p.targetId, p.targetGeneration)) continue
    const enemy = enemyPool.get(p.targetId)
    const hitDx = enemy.x - p.x
    const hitDy = enemy.y - p.y
    const hitRadius = enemy.radius + HIT_MARGIN
    if (hitDx * hitDx + hitDy * hitDy > hitRadius * hitRadius) continue

    toRelease.push(index)

    if (p.kind === 'splash' && p.splashRadius > 0) {
      grid.queryCircle(p.x, p.y, p.splashRadius, queryBuffer)
      const splashSq = p.splashRadius * p.splashRadius
      for (let i = 0; i < queryBuffer.length; i++) {
        const otherIndex = queryBuffer[i]
        const other = enemyPool.get(otherIndex)
        if (!other.active) continue
        const dx = other.x - p.x
        const dy = other.y - p.y
        if (dx * dx + dy * dy <= splashSq) damageEnemy(engine, otherIndex, p.damage, p.color)
      }
    } else {
      damageEnemy(engine, p.targetId, p.damage, p.color)
      if (p.kind === 'slow' && enemyPool.isCurrent(p.targetId, p.targetGeneration)) {
        enemy.applySlow(p.slow, p.slowDuration, engine.simTime)
      }
    }
  }

  for (let i = 0; i < toRelease.length; i++) projectilePool.release(toRelease[i])
}
