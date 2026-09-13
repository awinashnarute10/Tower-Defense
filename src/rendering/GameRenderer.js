import { MAP_WIDTH, MAP_HEIGHT, PATH, PATH_WIDTH, SPAWN_POINT, BASE_POINT } from '../data/map.js'
import { TOWER_TEMPLATES } from '../data/towers.js'
import { SpriteCache, ENEMY_BITMAP } from './SpriteCache.js'

function bakeBackground() {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_WIDTH
  canvas.height = MAP_HEIGHT
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#0a0812'
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

  ctx.strokeStyle = 'rgba(140, 110, 200, 0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x < MAP_WIDTH; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, MAP_HEIGHT)
    ctx.stroke()
  }
  for (let y = 0; y < MAP_HEIGHT; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(MAP_WIDTH, y)
    ctx.stroke()
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#241a3a'
  ctx.lineWidth = PATH_WIDTH
  ctx.beginPath()
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()

  ctx.strokeStyle = '#3a2a5c'
  ctx.lineWidth = PATH_WIDTH - 10
  ctx.stroke()

  ctx.setLineDash([14, 14])
  ctx.strokeStyle = 'rgba(140, 243, 255, 0.35)'
  ctx.lineWidth = 3
  ctx.beginPath()
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#4cf3ff'
  ctx.beginPath()
  ctx.arc(SPAWN_POINT.x, SPAWN_POINT.y, 22, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ff4c5c'
  ctx.beginPath()
  ctx.arc(BASE_POINT.x, BASE_POINT.y, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffd9d9'
  ctx.lineWidth = 3
  ctx.stroke()

  return canvas
}

export class GameRenderer {
  constructor() {
    this.background = bakeBackground()
    this.sprites = new SpriteCache()
    this.hoverCol = -1
  }

  render(ctx, engine) {
    const { state, simTime } = engine
    ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

    ctx.save()
    if (simTime < state.shakeUntil) {
      const mag = state.shakeMagnitude
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag)
    }

    ctx.drawImage(this.background, 0, 0)

    this._drawPlacementGhost(ctx, engine)
    this._drawTowers(ctx, engine)
    this._drawEnemies(ctx, engine)
    this._drawProjectiles(ctx, engine)
    this._drawEffects(ctx, engine)

    ctx.restore()
  }

  _drawPlacementGhost(ctx, engine) {
    const p = engine.placement
    if (!p.typeId) return
    const template = TOWER_TEMPLATES[p.typeId]
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.arc(p.x, p.y, template.levels[0].range, 0, Math.PI * 2)
    ctx.strokeStyle = p.valid ? 'rgba(76,255,106,0.8)' : 'rgba(255,76,92,0.8)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = p.valid ? 'rgba(76,255,106,0.18)' : 'rgba(255,76,92,0.18)'
    ctx.fill()

    const sprite = this.sprites.getTowerSprite(p.typeId, template.color)
    ctx.globalAlpha = p.valid ? 0.9 : 0.5
    const size = 34
    ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size)
    ctx.globalAlpha = 1
  }

  _drawTowers(ctx, engine) {
    const { towers, simTime, selectedTowerId } = engine
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i]
      const template = TOWER_TEMPLATES[tower.typeId]
      const sprite = this.sprites.getTowerSprite(tower.typeId, template.color)
      const size = 32

      if (tower.id === selectedTowerId) {
        ctx.beginPath()
        ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 225, 76, 0.55)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      ctx.drawImage(sprite, tower.x - size / 2, tower.y - size / 2, size, size)

      ctx.save()
      ctx.translate(tower.x, tower.y)
      ctx.rotate(tower.angle)
      ctx.fillStyle = simTime < tower.flashUntil ? '#ffffff' : '#1c1630'
      ctx.fillRect(0, -3, 16, 6)
      ctx.restore()

      ctx.fillStyle = '#ffe14c'
      ctx.font = '10px "Press Start 2P"'
      ctx.fillText(`L${tower.level + 1}`, tower.x - 10, tower.y + size / 2 + 12)
    }
  }

  _drawEnemies(ctx, engine) {
    const { enemyPool, simTime, flags } = engine
    enemyPool.forEachActive((enemy) => {
      if (enemy.x < -60 || enemy.x > MAP_WIDTH + 60 || enemy.y < -60 || enemy.y > MAP_HEIGHT + 60) return

      const size = enemy.radius * 2.6
      if (flags.spriteCache) {
        const bitmapKey = ENEMY_BITMAP[enemy.typeId]
        const sprite = this.sprites.getEnemySprite(enemy.typeId, bitmapKey, enemy.color, enemy.outline)
        ctx.drawImage(sprite, enemy.x - size / 2, enemy.y - size / 2, size, size)
      } else {
        // Baseline path: rebuild a fresh gradient and stroke every entity every
        // frame instead of blitting a pre-baked sprite — the cost the cache avoids.
        const gradient = ctx.createRadialGradient(enemy.x, enemy.y, 0, enemy.x, enemy.y, size / 2)
        gradient.addColorStop(0, enemy.color)
        gradient.addColorStop(1, enemy.outline)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(enemy.x, enemy.y, size / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = enemy.outline
        ctx.lineWidth = 2
        ctx.stroke()
      }

      if (simTime < enemy.hitFlashUntil) {
        ctx.globalAlpha = 0.55
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      const barW = size
      const pct = Math.max(0, enemy.hp / enemy.maxHp)
      ctx.fillStyle = '#1c1630'
      ctx.fillRect(enemy.x - barW / 2, enemy.y - size / 2 - 8, barW, 4)
      ctx.fillStyle = pct > 0.5 ? '#4cff6a' : pct > 0.2 ? '#ffe14c' : '#ff4c5c'
      ctx.fillRect(enemy.x - barW / 2, enemy.y - size / 2 - 8, barW * pct, 4)
    })
  }

  _drawProjectiles(ctx, engine) {
    const { projectilePool } = engine
    ctx.beginPath()
    projectilePool.forEachActive((p) => {
      ctx.moveTo(p.trailX, p.trailY)
      ctx.lineTo(p.x, p.y)
    })
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 2
    ctx.stroke()

    projectilePool.forEachActive((p) => {
      if (p.x < -20 || p.x > MAP_WIDTH + 20 || p.y < -20 || p.y > MAP_HEIGHT + 20) return
      const sprite = this.sprites.getProjectileSprite(p.color)
      ctx.drawImage(sprite, p.x - 8, p.y - 8, 16, 16)
    })
  }

  _drawEffects(ctx, engine) {
    const { effects } = engine
    ctx.font = '10px "Press Start 2P"'
    ctx.textAlign = 'center'
    for (let i = 0; i < effects.damageNumbers.length; i++) {
      const dn = effects.damageNumbers[i]
      if (!dn.active) continue
      ctx.globalAlpha = Math.max(0, 1 - dn.age / dn.life)
      ctx.fillStyle = dn.color
      ctx.fillText(dn.text, dn.x, dn.y)
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'

    for (let i = 0; i < effects.particles.length; i++) {
      const p = effects.particles[i]
      if (!p.active) continue
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1
  }
}
