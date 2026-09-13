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
    // Reusable per-type/per-color bucket arrays for batched drawing (see
    // _drawEnemies/_drawProjectiles): grouping same-sprite draws together
    // means the sprite is looked up once per type/color instead of once per
    // entity, and keeps same-source drawImage calls consecutive instead of
    // interleaved, which is friendlier to the browser's internal texture cache.
    this._enemyBuckets = {}
    for (const typeId in ENEMY_BITMAP) this._enemyBuckets[typeId] = []
    this._projectileBuckets = new Map()
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
    const buckets = this._enemyBuckets
    for (const typeId in buckets) buckets[typeId].length = 0

    // Pass 1: raw indexed loop (not forEachActive(callback) — this is the
    // hottest loop in the renderer at up to ~5000 entities) that culls
    // off-screen enemies and sorts the rest into per-type buckets.
    const { items, activeIndices, activeCount } = enemyPool
    for (let i = 0; i < activeCount; i++) {
      const enemy = items[activeIndices[i]]
      if (enemy.x < -60 || enemy.x > MAP_WIDTH + 60 || enemy.y < -60 || enemy.y > MAP_HEIGHT + 60) continue
      buckets[enemy.typeId].push(enemy)
    }

    // Pass 2: draw one type at a time. All enemies of a type share one
    // sprite, so it's looked up once per type (≤5 lookups) instead of once
    // per entity (≤5000), and every drawImage in a batch shares the same
    // source image instead of the source jumping around between entities.
    for (const typeId in buckets) {
      const bucket = buckets[typeId]
      if (bucket.length === 0) continue
      const bitmapKey = ENEMY_BITMAP[typeId]
      const first = bucket[0]
      const sprite = flags.spriteCache ? this.sprites.getEnemySprite(typeId, bitmapKey, first.color, first.outline) : null

      for (let i = 0; i < bucket.length; i++) {
        const enemy = bucket[i]
        const size = enemy.radius * 2.6
        if (flags.spriteCache) {
          // Snap to whole pixels: fits the pixel-art look and lets the browser
          // do a cheaper unfiltered blit instead of resampling a sub-pixel
          // sprite position.
          ctx.drawImage(sprite, Math.round(enemy.x - size / 2), Math.round(enemy.y - size / 2), size, size)
        } else {
          // Baseline path: rebuild a fresh gradient and stroke every entity
          // every frame instead of blitting a pre-baked sprite — the cost
          // the cache (and this batching) avoids.
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

        // Skip the HP bar entirely at full health — avoids two fillRect calls
        // per untouched enemy, which matters when thousands are on screen.
        if (enemy.hp < enemy.maxHp) {
          const barW = size
          const pct = Math.max(0, enemy.hp / enemy.maxHp)
          ctx.fillStyle = '#1c1630'
          ctx.fillRect(enemy.x - barW / 2, enemy.y - size / 2 - 8, barW, 4)
          ctx.fillStyle = pct > 0.5 ? '#4cff6a' : pct > 0.2 ? '#ffe14c' : '#ff4c5c'
          ctx.fillRect(enemy.x - barW / 2, enemy.y - size / 2 - 8, barW * pct, 4)
        }
      }
    }
  }

  _drawProjectiles(ctx, engine) {
    const { projectilePool } = engine
    const buckets = this._projectileBuckets
    for (const bucket of buckets.values()) bucket.length = 0

    // Pass 1: one batched trail path (a single stroke() call for every
    // projectile) plus sorting visible projectiles into per-color buckets —
    // raw indexed loop, not forEachActive(callback), for the same reason as
    // the enemy loop above.
    ctx.beginPath()
    const { items, activeIndices, activeCount } = projectilePool
    for (let i = 0; i < activeCount; i++) {
      const p = items[activeIndices[i]]
      ctx.moveTo(p.trailX, p.trailY)
      ctx.lineTo(p.x, p.y)
      if (p.x >= -20 && p.x <= MAP_WIDTH + 20 && p.y >= -20 && p.y <= MAP_HEIGHT + 20) {
        let bucket = buckets.get(p.color)
        if (!bucket) {
          bucket = []
          buckets.set(p.color, bucket)
        }
        bucket.push(p)
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Pass 2: one sprite lookup per color (there are only a handful of
    // projectile colors, one per tower type), all same-source blits grouped.
    for (const [color, bucket] of buckets) {
      if (bucket.length === 0) continue
      const sprite = this.sprites.getProjectileSprite(color)
      for (let i = 0; i < bucket.length; i++) {
        const p = bucket[i]
        ctx.drawImage(sprite, Math.round(p.x - 8), Math.round(p.y - 8), 16, 16)
      }
    }
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
