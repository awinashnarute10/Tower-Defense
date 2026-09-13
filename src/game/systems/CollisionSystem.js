const HIT_MARGIN = 6
const queryBuffer = []

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
  enemy.hitFlashUntil = engine.simTime + 0.12
  engine.effects.spawnDamageNumber(enemy.x, enemy.y - enemy.radius, amount, color)
  killIfDead(engine, enemy, index)
}

export function resolveCollisions(engine) {
  const { projectilePool, enemyPool, grid } = engine
  const toRelease = []

  projectilePool.forEachActive((p, index) => {
    if (!enemyPool.isCurrent(p.targetId, p.targetGeneration)) return
    const enemy = enemyPool.get(p.targetId)
    const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y)
    if (dist > enemy.radius + HIT_MARGIN) return

    toRelease.push(index)

    if (p.kind === 'splash' && p.splashRadius > 0) {
      grid.queryCircle(p.x, p.y, p.splashRadius, queryBuffer)
      for (let i = 0; i < queryBuffer.length; i++) {
        const otherIndex = queryBuffer[i]
        const other = enemyPool.get(otherIndex)
        if (!other.active) continue
        const d = Math.hypot(other.x - p.x, other.y - p.y)
        if (d <= p.splashRadius) damageEnemy(engine, otherIndex, p.damage, p.color)
      }
    } else {
      damageEnemy(engine, p.targetId, p.damage, p.color)
      if (p.kind === 'slow' && enemyPool.isCurrent(p.targetId, p.targetGeneration)) {
        enemy.applySlow(p.slow, p.slowDuration, engine.simTime)
      }
    }
  })

  for (let i = 0; i < toRelease.length; i++) projectilePool.release(toRelease[i])
}
