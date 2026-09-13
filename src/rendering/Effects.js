const MAX_DAMAGE_NUMBERS = 300
const MAX_PARTICLES = 400

function makeDamageNumber() {
  return { active: false, x: 0, y: 0, text: '', color: '#fff', age: 0, life: 0.6 }
}

function makeParticle() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0.5, color: '#fff', size: 3 }
}

/**
 * Fixed-capacity pooled effect system (damage numbers, death-burst particles,
 * screen shake). Capacity is capped so a mass die-off during a stress test
 * can't itself blow the frame budget — oldest effect is recycled when full.
 */
export class EffectSystem {
  constructor() {
    this.damageNumbers = Array.from({ length: MAX_DAMAGE_NUMBERS }, makeDamageNumber)
    this.particles = Array.from({ length: MAX_PARTICLES }, makeParticle)
    this.dnCursor = 0
    this.particleCursor = 0
  }

  spawnDamageNumber(x, y, amount, color = '#ffe14c') {
    const dn = this.damageNumbers[this.dnCursor]
    this.dnCursor = (this.dnCursor + 1) % MAX_DAMAGE_NUMBERS
    dn.active = true
    dn.x = x
    dn.y = y
    dn.text = String(Math.round(amount))
    dn.color = color
    dn.age = 0
  }

  spawnDeathBurst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const p = this.particles[this.particleCursor]
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4
      const speed = 60 + Math.random() * 80
      p.active = true
      p.x = x
      p.y = y
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.age = 0
      p.life = 0.4 + Math.random() * 0.2
      p.color = color
      p.size = 2 + Math.random() * 2
    }
  }

  update(dt) {
    for (let i = 0; i < MAX_DAMAGE_NUMBERS; i++) {
      const dn = this.damageNumbers[i]
      if (!dn.active) continue
      dn.age += dt
      dn.y -= 28 * dt
      if (dn.age >= dn.life) dn.active = false
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i]
      if (!p.active) continue
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 220 * dt
      if (p.age >= p.life) p.active = false
    }
  }
}
