export class Projectile {
  constructor() {
    this.active = false
    this.x = 0
    this.y = 0
    this.speed = 0
    this.damage = 0
    this.kind = 'single'
    this.color = '#c9fbff'
    this.targetId = -1
    this.targetGeneration = -1
    this.slow = null
    this.slowDuration = 0
    this.splashRadius = 0
    this.life = 0
    this.trailX = 0
    this.trailY = 0
  }

  // Positional args, not a config object — see the note on Enemy.reset().
  reset(x, y, speed, damage, kind, color, targetId, targetGeneration, slow, slowDuration, splashRadius) {
    this.active = true
    this.x = x
    this.y = y
    this.trailX = x
    this.trailY = y
    this.speed = speed
    this.damage = damage
    this.kind = kind
    this.color = color
    this.targetId = targetId
    this.targetGeneration = targetGeneration
    this.slow = slow ?? null
    this.slowDuration = slowDuration || 0
    this.splashRadius = splashRadius || 0
    this.life = 2.5
    this.dirX = undefined
    this.dirY = undefined
  }
}
