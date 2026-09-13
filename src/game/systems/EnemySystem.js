import { PATH } from '../../data/map.js'

const BASE_DAMAGE = { grunt: 1, runner: 1, healer: 1, tank: 3, boss: 10 }
const queryBuffer = []
const toRelease = []

export function updateEnemyMovement(engine, dt) {
  const { enemyPool, simTime } = engine
  toRelease.length = 0

  enemyPool.forEachActive((enemy, index) => {
    const target = PATH[enemy.waypointIndex]
    if (!target) {
      engine.onEnemyReachedBase(BASE_DAMAGE[enemy.typeId] ?? 1)
      toRelease.push(index)
      return
    }
    const dx = target.x - enemy.x
    const dy = target.y - enemy.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const step = enemy.currentSpeed(simTime) * dt
    if (step >= dist || dist === 0) {
      enemy.x = target.x
      enemy.y = target.y
      enemy.waypointIndex++
    } else {
      enemy.x += (dx / dist) * step
      enemy.y += (dy / dist) * step
    }
  })

  for (let i = 0; i < toRelease.length; i++) enemyPool.release(toRelease[i])
}

export function rebuildEnemyGrid(engine) {
  const { grid, enemyPool } = engine
  grid.clear()
  enemyPool.forEachActive((enemy, index) => {
    grid.insert(index, enemy.x, enemy.y)
  })
}

export function applyHealing(engine) {
  const { enemyPool, grid, simTime } = engine
  enemyPool.forEachActive((healer) => {
    if (healer.healRadius <= 0) return
    if (simTime - healer.healTimer < healer.healInterval) return
    healer.healTimer = simTime
    grid.queryCircle(healer.x, healer.y, healer.healRadius, queryBuffer)
    for (let i = 0; i < queryBuffer.length; i++) {
      const ally = enemyPool.get(queryBuffer[i])
      if (!ally.active || ally === healer) continue
      const dx = ally.x - healer.x
      const dy = ally.y - healer.y
      if (dx * dx + dy * dy <= healer.healRadius * healer.healRadius) {
        ally.hp = Math.min(ally.maxHp, ally.hp + healer.healAmount)
      }
    }
  })
}
