const toRelease = []

export function updateProjectiles(engine, dt) {
  const { projectilePool, enemyPool } = engine
  toRelease.length = 0

  projectilePool.forEachActive((p, index) => {
    p.life -= dt
    if (p.life <= 0) {
      toRelease.push(index)
      return
    }

    p.trailX = p.x
    p.trailY = p.y

    const targetValid = enemyPool.isCurrent(p.targetId, p.targetGeneration)
    let dx, dy
    if (targetValid) {
      const enemy = enemyPool.get(p.targetId)
      dx = enemy.x - p.x
      dy = enemy.y - p.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      p.dirX = dx / dist
      p.dirY = dy / dist
    } else if (p.dirX === undefined) {
      p.dirX = 0
      p.dirY = -1
    }

    p.x += p.dirX * p.speed * dt
    p.y += p.dirY * p.speed * dt

    if (!targetValid && p.life > 0.4) {
      // Lost its target — let it fizzle out shortly instead of flying forever.
      p.life = Math.min(p.life, 0.15)
    }
  })

  for (let i = 0; i < toRelease.length; i++) projectilePool.release(toRelease[i])
}
