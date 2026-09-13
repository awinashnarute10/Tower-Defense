import * as PIXI from 'pixi.js'
import { MAP_WIDTH, MAP_HEIGHT } from '../../data/map.js'
import { TOWER_TEMPLATES } from '../../data/towers.js'
import { ENEMY_CAPACITY, PROJECTILE_CAPACITY } from '../../game/GameEngine.js'
import { SpriteCache, ENEMY_BITMAP } from '../SpriteCache.js'
import { bakeBackground } from '../GameRenderer.js'

const TOWER_CAPACITY = 150

function makeWhiteTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 1, 1)
  return PIXI.Texture.from(canvas)
}

/**
 * GPU-accelerated backend. PixiJS is used strictly as a rendering library —
 * it draws pooled sprites fed by the untouched GameEngine/simulation systems,
 * never owns any game state. Every display object (sprite/text/graphics) is
 * created exactly once in init() and only ever has its properties mutated in
 * render() — nothing is created or destroyed per frame. See ARCHITECTURE.md
 * for the full design and measured results vs the Canvas2D backend.
 */
export class WebGLRenderer {
  static backendName = 'webgl'

  async init(container) {
    this.app = new PIXI.Application()
    await this.app.init({
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      backgroundColor: 0x0a0812,
      antialias: false,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      // autoDensity would set an inline canvas.style.width/height in fixed
      // px, which beats our `w-full h-full` class and lets the canvas
      // overflow its (often narrower, sidebar-shrunk) container instead of
      // scaling to fit it — same responsive-sizing approach as CanvasRenderer.
      autoDensity: false,
      preference: 'webgl',
      autoStart: false, // we drive rendering from the same GameLoop as Canvas2D — one render loop, not two.
    })
    this.app.ticker.stop()
    this.app.canvas.className = 'w-full h-full'
    container.appendChild(this.app.canvas)

    this.sprites = new SpriteCache()
    this._textureCache = new Map()
    this.whiteTexture = makeWhiteTexture()

    this.world = new PIXI.Container()
    this.app.stage.addChild(this.world)

    this.background = new PIXI.Sprite(this._textureFor(bakeBackground()))
    this.world.addChild(this.background)

    this._initPlacementGhost()
    this._initTowers()
    this._initEnemies()
    this._initProjectiles()
    this._initEffects()

    this._prevTowerCount = 0
    this._prevEnemyActive = 0
    this._prevProjectileActive = 0
  }

  _textureFor(canvas) {
    let texture = this._textureCache.get(canvas)
    if (!texture) {
      texture = PIXI.Texture.from(canvas)
      this._textureCache.set(canvas, texture)
    }
    return texture
  }

  // --- placement ghost ---
  _initPlacementGhost() {
    this.ghostGraphics = new PIXI.Graphics()
    this.world.addChild(this.ghostGraphics)
    this.ghostSprite = new PIXI.Sprite()
    this.ghostSprite.anchor.set(0.5)
    this.ghostSprite.visible = false
    this.world.addChild(this.ghostSprite)
  }

  _updatePlacementGhost(engine) {
    const p = engine.placement
    this.ghostGraphics.clear()
    if (!p.typeId) {
      this.ghostSprite.visible = false
      return
    }
    const template = TOWER_TEMPLATES[p.typeId]
    const color = p.valid ? 0x4cff6a : 0xff4c5c
    this.ghostGraphics
      .circle(p.x, p.y, template.levels[0].range)
      .fill({ color, alpha: 0.18 })
      .stroke({ color, width: 2, alpha: 0.8 })

    this.ghostSprite.texture = this._textureFor(this.sprites.getTowerSprite(p.typeId, template.color))
    this.ghostSprite.x = p.x
    this.ghostSprite.y = p.y
    this.ghostSprite.width = 34
    this.ghostSprite.height = 34
    this.ghostSprite.alpha = p.valid ? 0.9 : 0.5
    this.ghostSprite.visible = true
  }

  // --- towers ---
  _initTowers() {
    this.towerLayer = new PIXI.Container()
    this.world.addChild(this.towerLayer)
    this.towerRangeGraphics = new PIXI.Graphics()
    this.world.addChild(this.towerRangeGraphics)

    this.towerSprites = new Array(TOWER_CAPACITY)
    this.towerBarrels = new Array(TOWER_CAPACITY)
    this.towerLevelTexts = new Array(TOWER_CAPACITY)
    for (let i = 0; i < TOWER_CAPACITY; i++) {
      const body = new PIXI.Sprite()
      body.anchor.set(0.5)
      body.visible = false
      this.towerLayer.addChild(body)
      this.towerSprites[i] = body

      const barrel = new PIXI.Sprite(this.whiteTexture)
      barrel.anchor.set(0, 0.5)
      barrel.visible = false
      this.towerLayer.addChild(barrel)
      this.towerBarrels[i] = barrel

      const text = new PIXI.Text({ text: '', style: { fontFamily: 'monospace', fontSize: 10, fill: 0xffe14c } })
      text.anchor.set(0.5, 0)
      text.visible = false
      this.towerLayer.addChild(text)
      this.towerLevelTexts[i] = text
    }
  }

  _updateTowers(engine) {
    const { towers, simTime, selectedTowerId } = engine
    this.towerRangeGraphics.clear()

    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i]
      const template = TOWER_TEMPLATES[tower.typeId]

      const body = this.towerSprites[i]
      body.visible = true
      body.texture = this._textureFor(this.sprites.getTowerSprite(tower.typeId, template.color))
      body.x = tower.x
      body.y = tower.y
      body.width = 32
      body.height = 32

      const barrel = this.towerBarrels[i]
      barrel.visible = true
      barrel.x = tower.x
      barrel.y = tower.y
      barrel.rotation = tower.angle
      barrel.width = 16
      barrel.height = 6
      barrel.tint = simTime < tower.flashUntil ? 0xffffff : 0x1c1630

      const text = this.towerLevelTexts[i]
      text.visible = true
      text.text = `L${tower.level + 1}`
      text.x = tower.x
      text.y = tower.y + 28

      if (tower.id === selectedTowerId) {
        this.towerRangeGraphics.circle(tower.x, tower.y, tower.range).stroke({ color: 0xffe14c, width: 2, alpha: 0.55 })
      }
    }

    for (let i = towers.length; i < this._prevTowerCount; i++) {
      this.towerSprites[i].visible = false
      this.towerBarrels[i].visible = false
      this.towerLevelTexts[i].visible = false
    }
    this._prevTowerCount = towers.length
  }

  // --- enemies ---
  _initEnemies() {
    this.enemyLayer = new PIXI.Container()
    this.enemyFlashLayer = new PIXI.Container()
    this.enemyBarLayer = new PIXI.Container()
    this.world.addChild(this.enemyLayer, this.enemyFlashLayer, this.enemyBarLayer)

    this.enemyBody = new Array(ENEMY_CAPACITY)
    this.enemyFlash = new Array(ENEMY_CAPACITY)
    this.enemyBarBg = new Array(ENEMY_CAPACITY)
    this.enemyBarFill = new Array(ENEMY_CAPACITY)
    for (let i = 0; i < ENEMY_CAPACITY; i++) {
      const body = new PIXI.Sprite()
      body.anchor.set(0.5)
      body.visible = false
      this.enemyLayer.addChild(body)
      this.enemyBody[i] = body

      const flash = new PIXI.Sprite()
      flash.anchor.set(0.5)
      flash.tint = 0xffffff
      flash.alpha = 0.55
      flash.visible = false
      this.enemyFlashLayer.addChild(flash)
      this.enemyFlash[i] = flash

      const barBg = new PIXI.Sprite(this.whiteTexture)
      barBg.anchor.set(0.5, 0.5)
      barBg.tint = 0x1c1630
      barBg.visible = false
      this.enemyBarLayer.addChild(barBg)
      this.enemyBarBg[i] = barBg

      const barFill = new PIXI.Sprite(this.whiteTexture)
      barFill.anchor.set(0, 0.5)
      barFill.visible = false
      this.enemyBarLayer.addChild(barFill)
      this.enemyBarFill[i] = barFill
    }
  }

  // Sprites are indexed by *active position* (0..activeCount-1), not by pool
  // slot — this keeps the per-frame update loop O(activeCount), matching the
  // Canvas2D backend's raw-indexed-loop cost, instead of O(capacity). Slots
  // that were active last frame but aren't anymore just need hiding, handled
  // by the small cleanup loop at the end (bounded by however many left this
  // frame, not by the full 5300-slot capacity).
  _updateEnemies(engine) {
    const { enemyPool, simTime } = engine
    const { items, activeIndices, activeCount } = enemyPool

    for (let k = 0; k < activeCount; k++) {
      const enemy = items[activeIndices[k]]
      const size = enemy.radius * 2.6

      const body = this.enemyBody[k]
      body.visible = true
      body.texture = this._textureFor(this.sprites.getEnemySprite(enemy.typeId, ENEMY_BITMAP[enemy.typeId], enemy.color, enemy.outline))
      body.x = enemy.x
      body.y = enemy.y
      body.width = size
      body.height = size

      const flashing = simTime < enemy.hitFlashUntil
      const flash = this.enemyFlash[k]
      flash.visible = flashing
      if (flashing) {
        flash.texture = body.texture
        flash.x = enemy.x
        flash.y = enemy.y
        flash.width = size
        flash.height = size
      }

      const damaged = enemy.hp < enemy.maxHp
      const barBg = this.enemyBarBg[k]
      const barFill = this.enemyBarFill[k]
      barBg.visible = damaged
      barFill.visible = damaged
      if (damaged) {
        const pct = Math.max(0, enemy.hp / enemy.maxHp)
        const barY = enemy.y - size / 2 - 8
        barBg.x = enemy.x
        barBg.y = barY
        barBg.width = size
        barBg.height = 4
        barFill.x = enemy.x - size / 2
        barFill.y = barY
        barFill.width = Math.max(0.001, size * pct)
        barFill.height = 4
        barFill.tint = pct > 0.5 ? 0x4cff6a : pct > 0.2 ? 0xffe14c : 0xff4c5c
      }
    }

    for (let k = activeCount; k < this._prevEnemyActive; k++) {
      this.enemyBody[k].visible = false
      this.enemyFlash[k].visible = false
      this.enemyBarBg[k].visible = false
      this.enemyBarFill[k].visible = false
    }
    this._prevEnemyActive = activeCount
  }

  // --- projectiles ---
  _initProjectiles() {
    this.projectileTrail = new PIXI.Graphics()
    this.projectileLayer = new PIXI.Container()
    this.world.addChild(this.projectileTrail, this.projectileLayer)

    this.projectileSprites = new Array(PROJECTILE_CAPACITY)
    for (let i = 0; i < PROJECTILE_CAPACITY; i++) {
      const sprite = new PIXI.Sprite()
      sprite.anchor.set(0.5)
      sprite.visible = false
      this.projectileLayer.addChild(sprite)
      this.projectileSprites[i] = sprite
    }
  }

  _updateProjectiles(engine) {
    const { projectilePool } = engine
    const { items, activeIndices, activeCount } = projectilePool
    this.projectileTrail.clear()

    for (let k = 0; k < activeCount; k++) {
      const p = items[activeIndices[k]]
      const sprite = this.projectileSprites[k]
      sprite.visible = true
      sprite.texture = this._textureFor(this.sprites.getProjectileSprite(p.color))
      sprite.x = p.x
      sprite.y = p.y
      sprite.width = 16
      sprite.height = 16
      this.projectileTrail.moveTo(p.trailX, p.trailY).lineTo(p.x, p.y)
    }
    if (activeCount > 0) this.projectileTrail.stroke({ color: 0xffffff, width: 2, alpha: 0.35 })

    for (let k = activeCount; k < this._prevProjectileActive; k++) this.projectileSprites[k].visible = false
    this._prevProjectileActive = activeCount
  }

  // --- effects (damage numbers, death-burst particles) ---
  _initEffects() {
    this.effectLayer = new PIXI.Container()
    this.world.addChild(this.effectLayer)

    // Effects.js's pools aren't compacted (spawn uses a ring-buffer cursor,
    // not a swap-remove active list), so unlike enemies/projectiles there's
    // no cheap "active count" to index by — a full-capacity scan here is
    // still fine, these pools cap at 300/400, tiny next to 5000 enemies.
    this.damageTexts = new Array(300)
    for (let i = 0; i < 300; i++) {
      const text = new PIXI.Text({ text: '', style: { fontFamily: 'monospace', fontSize: 10, fill: 0xffe14c } })
      text.anchor.set(0.5, 1)
      text.visible = false
      this.effectLayer.addChild(text)
      this.damageTexts[i] = text
    }

    this.particleSprites = new Array(400)
    for (let i = 0; i < 400; i++) {
      const sprite = new PIXI.Sprite(this.whiteTexture)
      sprite.anchor.set(0.5)
      sprite.visible = false
      this.effectLayer.addChild(sprite)
      this.particleSprites[i] = sprite
    }
  }

  _updateEffects(engine) {
    const { damageNumbers, particles } = engine.effects
    for (let i = 0; i < damageNumbers.length; i++) {
      const d = damageNumbers[i]
      const text = this.damageTexts[i]
      text.visible = d.active
      if (!d.active) continue
      text.text = d.text
      text.style.fill = d.color
      text.x = d.x
      text.y = d.y
      text.alpha = Math.max(0, 1 - d.age / d.life)
    }
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const sprite = this.particleSprites[i]
      sprite.visible = p.active
      if (!p.active) continue
      sprite.x = p.x
      sprite.y = p.y
      sprite.width = p.size
      sprite.height = p.size
      sprite.tint = p.color
      sprite.alpha = Math.max(0, 1 - p.age / p.life)
    }
  }

  // --- screen shake ---
  _updateShake(engine) {
    const { state, simTime } = engine
    if (simTime < state.shakeUntil) {
      const mag = state.shakeMagnitude
      this.world.x = (Math.random() - 0.5) * mag
      this.world.y = (Math.random() - 0.5) * mag
    } else {
      this.world.x = 0
      this.world.y = 0
    }
  }

  render(engine) {
    this._updateShake(engine)
    this._updatePlacementGhost(engine)
    this._updateTowers(engine)
    this._updateEnemies(engine)
    this._updateProjectiles(engine)
    this._updateEffects(engine)
    this.app.render()
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true })
  }

  get name() {
    return WebGLRenderer.backendName
  }
}
