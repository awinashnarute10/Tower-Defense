const PIXEL = 4
const GRID = 8
const SPRITE_SIZE = PIXEL * GRID

const BITMAPS = {
  blob: [
    '..oooo..',
    '.obbbbo.',
    'obbbbbbo',
    'obbobbbo',
    'obbbbbbo',
    'obbbbbbo',
    '.obbbbo.',
    '..oooo..',
  ],
  runner: [
    '...oo...',
    '..obbo..',
    '.obbbbo.',
    'obbbbbbo',
    '.obbbbo.',
    '..obbo..',
    '...bb...',
    '...oo...',
  ],
  tank: [
    'oooooooo',
    'obbbbbbo',
    'obhbbhbo',
    'obbbbbbo',
    'obbbbbbo',
    'obhbbhbo',
    'obbbbbbo',
    'oooooooo',
  ],
  healer: [
    '..oooo..',
    '.obbbbo.',
    'obbhhbbo',
    'obhhhhbo',
    'obhhhhbo',
    'obbhhbbo',
    '.obbbbo.',
    '..oooo..',
  ],
  boss: [
    'o..oo..o',
    '.obbbbo.',
    'obbbbbbo',
    'bbbhhbbb',
    'bbbhhbbb',
    'obbbbbbo',
    '.obbbbo.',
    'o..oo..o',
  ],
  tower: [
    'oooooooo',
    'obbbbbbo',
    'obhbbhbo',
    'obbbbbbo',
    'obbbbbbo',
    'obhbbhbo',
    'obbbbbbo',
    'oooooooo',
  ],
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount))
  return `rgb(${r},${g},${b})`
}

function bakeBitmap(bitmapKey, bodyColor, outlineColor) {
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIZE
  canvas.height = SPRITE_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const rows = BITMAPS[bitmapKey]
  const highlight = shade(bodyColor, 60)
  const colorFor = { b: bodyColor, o: outlineColor, h: highlight }
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const ch = rows[row][col]
      if (ch === '.') continue
      ctx.fillStyle = colorFor[ch]
      ctx.fillRect(col * PIXEL, row * PIXEL, PIXEL, PIXEL)
    }
  }
  return canvas
}

function bakeProjectile(color) {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.4, color)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
  return canvas
}

/**
 * Pre-bakes every enemy/tower/projectile visual once into offscreen canvases.
 * The renderer then does drawImage() in the hot loop instead of constructing
 * gradients/paths per entity per frame — the main reason 5000 enemies stays cheap.
 */
export class SpriteCache {
  constructor() {
    this.enemySprites = new Map()
    this.towerSprites = new Map()
    this.projectileSprites = new Map()
  }

  getEnemySprite(typeId, bitmapKey, color, outline) {
    const key = typeId
    if (!this.enemySprites.has(key)) {
      this.enemySprites.set(key, bakeBitmap(bitmapKey, color, outline))
    }
    return this.enemySprites.get(key)
  }

  getTowerSprite(typeId, color) {
    if (!this.towerSprites.has(typeId)) {
      this.towerSprites.set(typeId, bakeBitmap('tower', color, shade(color, -90)))
    }
    return this.towerSprites.get(typeId)
  }

  getProjectileSprite(color) {
    if (!this.projectileSprites.has(color)) {
      this.projectileSprites.set(color, bakeProjectile(color))
    }
    return this.projectileSprites.get(color)
  }
}

export const ENEMY_BITMAP = {
  grunt: 'blob',
  runner: 'runner',
  tank: 'tank',
  healer: 'healer',
  boss: 'boss',
}

export { SPRITE_SIZE }
