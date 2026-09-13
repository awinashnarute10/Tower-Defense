export class Enemy {
  constructor() {
    this.active = false
    this.typeId = 'grunt'
    this.x = 0
    this.y = 0
    this.hp = 0
    this.maxHp = 0
    this.baseSpeed = 0
    this.reward = 0
    this.scoreValue = 0
    this.radius = 10
    this.color = '#4cff6a'
    this.outline = '#123312'
    this.waypointIndex = 1
    this.slowMultiplier = 1
    this.slowUntil = 0
    this.healRadius = 0
    this.healAmount = 0
    this.healInterval = 0
    this.healTimer = 0
    this.hitFlashUntil = 0
    this.generation = 0
  }

  // Positional args, not a config object — this runs on every spawn (up to
  // hundreds/sec during a stress test), and avoiding an object literal here
  // and at every call site removes a steady source of GC churn.
  reset(typeId, template, x, y, hp, speed, generation) {
    this.active = true
    this.typeId = typeId
    this.x = x
    this.y = y
    this.hp = hp
    this.maxHp = hp
    this.baseSpeed = speed
    this.reward = template.reward
    this.scoreValue = template.scoreValue
    this.radius = template.radius
    this.color = template.color
    this.outline = template.outline
    this.waypointIndex = 1
    this.slowMultiplier = 1
    this.slowUntil = 0
    this.hitFlashUntil = 0
    this.healTimer = 0
    if (template.heal) {
      this.healRadius = template.heal.radius
      this.healAmount = template.heal.amount
      this.healInterval = template.heal.interval
    } else {
      this.healRadius = 0
    }
    this.generation = generation
  }

  currentSpeed(now) {
    if (now > this.slowUntil) this.slowMultiplier = 1
    return this.baseSpeed * this.slowMultiplier
  }

  applySlow(multiplier, durationSec, now) {
    if (multiplier < this.slowMultiplier || now > this.slowUntil) {
      this.slowMultiplier = multiplier
    }
    this.slowUntil = Math.max(this.slowUntil, now + durationSec)
  }
}
