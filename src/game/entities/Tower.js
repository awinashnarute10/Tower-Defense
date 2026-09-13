import { TOWER_TEMPLATES } from '../../data/towers.js'

let nextTowerId = 1

export class Tower {
  constructor(typeId, col, row, x, y) {
    this.id = nextTowerId++
    this.typeId = typeId
    this.col = col
    this.row = row
    this.x = x
    this.y = y
    this.level = 0
    this.cooldown = 0
    this.targetId = -1
    this.targetGeneration = -1
    this.lastAcquire = -Infinity
    this.totalInvested = TOWER_TEMPLATES[typeId].levels[0].cost
    this.angle = 0
    this.flashUntil = 0
    this.applyLevelStats()
  }

  applyLevelStats() {
    const template = TOWER_TEMPLATES[this.typeId]
    const stats = template.levels[this.level]
    this.damage = stats.damage
    this.range = stats.range
    this.fireRate = stats.fireRate
    this.slow = stats.slow ?? null
    this.slowDuration = stats.slowDuration ?? null
    this.splashRadius = stats.splashRadius ?? null
    this.kind = template.kind
    this.color = template.color
    this.projectileColor = template.projectileColor
  }

  canUpgrade() {
    return this.level < TOWER_TEMPLATES[this.typeId].levels.length - 1
  }
}
