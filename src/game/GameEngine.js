import { EnemyPool } from './pools/EnemyPool.js'
import { ProjectilePool } from './pools/ProjectilePool.js'
import { SpatialGrid } from './spatial/SpatialGrid.js'
import { PerformanceMonitor } from './performance/PerformanceMonitor.js'
import { Tower } from './entities/Tower.js'
import { createInitialState } from './GameState.js'
import { updateEnemyMovement, rebuildEnemyGrid, applyHealing } from './systems/EnemySystem.js'
import { updateTowers } from './systems/TowerSystem.js'
import { updateProjectiles } from './systems/ProjectileSystem.js'
import { resolveCollisions } from './systems/CollisionSystem.js'
import { updateWaveSystem } from './systems/WaveSystem.js'
import { EffectSystem } from '../rendering/Effects.js'
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  worldToCell,
  isCellBuildable,
  cellCenter,
  pointAtProgress,
  buildableCells,
} from '../data/map.js'
import { TOWER_TEMPLATES, buyCost, upgradeCost, SELL_REFUND_RATE } from '../data/towers.js'
import { ENEMY_TEMPLATES } from '../data/enemies.js'

export const ENEMY_CAPACITY = 5300
export const PROJECTILE_CAPACITY = 1100
const GRID_CELL_SIZE = 100

const PROJECTILE_SPEED = { single: 820, slow: 680, splash: 560 }

export class GameEngine {
  constructor() {
    this.state = createInitialState()
    this.enemyPool = new EnemyPool(ENEMY_CAPACITY)
    this.projectilePool = new ProjectilePool(PROJECTILE_CAPACITY)
    this.grid = new SpatialGrid(MAP_WIDTH, MAP_HEIGHT, GRID_CELL_SIZE)
    this.effects = new EffectSystem()
    this.perfMonitor = new PerformanceMonitor()
    this.towers = []
    this.simTime = 0
    this.waveRuntime = { data: null, spawnQueue: [], spawnTimer: 0, intermission: 0 }
    this.flags = { spatialGrid: true, targetCache: true, spriteCache: true }
    this.stressConfig = { enemies: 0, towers: 0, projectiles: 0 }
    this.placement = { typeId: null, col: -1, row: -1, x: 0, y: 0, valid: false }
    this.selectedTowerId = null
    this.listeners = new Set()
    this.snapshot = this._computeSnapshot()
  }

  // --- React binding (useSyncExternalStore) ---
  subscribe = (cb) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getSnapshot = () => this.snapshot

  publish() {
    this.snapshot = this._computeSnapshot()
    for (const cb of this.listeners) cb()
  }

  _computeSnapshot() {
    const perf = this.perfMonitor.computeStats()
    return {
      status: this.state.status,
      health: this.state.health,
      money: this.state.money,
      score: this.state.score,
      wave: this.state.wave,
      gameSpeed: this.state.gameSpeed,
      waveActive: this.state.waveActive,
      waveBannerText: this.state.waveBannerText,
      waveBannerVisible: this.simTime < this.state.waveBannerUntil,
      bossWarningVisible: this.simTime < this.state.bossWarningUntil,
      enemyCount: this.enemyPool.activeCount,
      towerCount: this.towers.length,
      projectileCount: this.projectilePool.activeCount,
      simTime: this.simTime,
      fps: perf.fps,
      frameTimeMs: perf.frameTimeMs,
      p95Ms: perf.p95Ms,
      pctOver33: perf.pctOver33,
      flags: this.flags,
      placementTypeId: this.placement.typeId,
      selectedTower: this._describeSelectedTower(),
    }
  }

  _describeSelectedTower() {
    const tower = this.getSelectedTower()
    if (!tower) return null
    const template = TOWER_TEMPLATES[tower.typeId]
    const nextLevel = template.levels[tower.level + 1] ?? null
    return {
      id: tower.id,
      typeId: tower.typeId,
      label: template.label,
      level: tower.level,
      maxLevel: template.levels.length,
      damage: tower.damage,
      range: tower.range,
      fireRate: tower.fireRate,
      slow: tower.slow,
      splashRadius: tower.splashRadius,
      totalInvested: tower.totalInvested,
      sellValue: Math.round(tower.totalInvested * SELL_REFUND_RATE),
      nextLevel,
      upgradeCost: nextLevel ? nextLevel.cost : null,
    }
  }

  pickTowerAt(x, y) {
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i]
      if (Math.hypot(t.x - x, t.y - y) <= 18) return t.id
    }
    return null
  }

  // --- lifecycle ---
  setStatus(status) {
    this.state.status = status
  }

  start() {
    this.state.status = 'playing'
  }

  togglePause() {
    if (this.state.status === 'playing') this.state.status = 'paused'
    else if (this.state.status === 'paused') this.state.status = 'playing'
  }

  setGameSpeed(speed) {
    this.state.gameSpeed = speed
  }

  _resetWorld() {
    this.enemyPool.forEachActive((_e, index) => this.enemyPool.release(index))
    this.projectilePool.forEachActive((_p, index) => this.projectilePool.release(index))
    this.towers = []
    this.simTime = 0
    this.waveRuntime = { data: null, spawnQueue: [], spawnTimer: 0, intermission: 0 }
    this.placement = { typeId: null, col: -1, row: -1, x: 0, y: 0, valid: false }
    this.selectedTowerId = null
    this.state = createInitialState()
  }

  restart() {
    this._resetWorld()
    this.state.status = 'playing'
  }

  goToMenu() {
    this._resetWorld()
  }

  damageBase(amount) {
    this.state.health = Math.max(0, this.state.health - amount)
    this.state.shakeUntil = this.simTime + 0.35
    this.state.shakeMagnitude = Math.min(18, amount * 2 + 4)
    if (this.state.health <= 0) this.setStatus('gameover')
  }

  onEnemyReachedBase(amount) {
    if (this.state.status === 'perflab') return
    this.damageBase(amount)
  }

  // --- simulation tick (fixed timestep) ---
  update(dt) {
    const status = this.state.status
    if (status !== 'playing' && status !== 'perflab') return
    this.simTime += dt
    if (status === 'perflab') this._maintainStressPopulation()
    updateEnemyMovement(this, dt)
    rebuildEnemyGrid(this)
    applyHealing(this)
    updateTowers(this, dt)
    updateProjectiles(this, dt)
    resolveCollisions(this)
    if (status === 'playing') updateWaveSystem(this, dt)
    this.effects.update(dt)
  }

  // --- Performance Lab ---
  setFlags(partial) {
    Object.assign(this.flags, partial)
  }

  applyBaselineMode() {
    this.setFlags({ spatialGrid: false, targetCache: false, spriteCache: false })
  }

  applyOptimizedMode() {
    this.setFlags({ spatialGrid: true, targetCache: true, spriteCache: true })
  }

  enterPerfLab(config) {
    this.enemyPool.forEachActive((_e, index) => this.enemyPool.release(index))
    this.projectilePool.forEachActive((_p, index) => this.projectilePool.release(index))
    this.towers = []
    this.simTime = 0
    this.stressConfig = { ...this.stressConfig, ...config }
    this.setStatus('perflab')
    this._placeStressTowers()
  }

  setStressConfig(config) {
    this.stressConfig = { ...this.stressConfig, ...config }
    this._placeStressTowers()
  }

  _placeStressTowers() {
    const cells = buildableCells()
    const want = Math.min(this.stressConfig.towers, cells.length)
    this.towers = []
    const typeIds = Object.keys(TOWER_TEMPLATES)
    const step = Math.max(1, Math.floor(cells.length / Math.max(1, want)))
    for (let i = 0, placed = 0; i < cells.length && placed < want; i += step, placed++) {
      const { col, row } = cells[i]
      const { x, y } = cellCenter(col, row)
      this.towers.push(new Tower(typeIds[placed % typeIds.length], col, row, x, y))
    }
  }

  _maintainStressPopulation() {
    const { enemies, projectiles } = this.stressConfig
    let guard = 0
    while (this.enemyPool.activeCount < enemies && guard++ < 200) {
      const typeId = 'grunt'
      const template = ENEMY_TEMPLATES[typeId]
      const { x, y, waypointIndex } = pointAtProgress(Math.random())
      const index = this.enemyPool.acquire({ typeId, template, x, y, hp: template.hp, speed: template.speed })
      if (index >= 0) this.enemyPool.get(index).waypointIndex = waypointIndex
    }
    guard = 0
    while (this.projectilePool.activeCount < projectiles && this.enemyPool.activeCount > 0 && guard++ < 200) {
      let targetIndex = -1
      this.enemyPool.forEachActive((_e, idx) => {
        if (targetIndex === -1) targetIndex = idx
      })
      if (targetIndex === -1) break
      const target = this.enemyPool.get(targetIndex)
      this.projectilePool.acquire({
        x: target.x + (Math.random() - 0.5) * 200,
        y: target.y + (Math.random() - 0.5) * 200,
        speed: 700,
        damage: 0,
        kind: 'single',
        color: '#4cf3ff',
        targetId: targetIndex,
        targetGeneration: this.enemyPool.generations[targetIndex],
      })
    }
  }

  // --- towers: placement / selection / economy ---
  isCellOccupied(col, row) {
    for (let i = 0; i < this.towers.length; i++) {
      if (this.towers[i].col === col && this.towers[i].row === row) return true
    }
    return false
  }

  setPlacementType(typeId) {
    this.placement.typeId = typeId
  }

  updateHover(worldX, worldY) {
    const { col, row } = worldToCell(worldX, worldY)
    const { x, y } = cellCenter(col, row)
    const typeId = this.placement.typeId
    const buildable = isCellBuildable(col, row) && !this.isCellOccupied(col, row)
    const affordable = typeId ? this.state.money >= buyCost(typeId) : false
    this.placement.col = col
    this.placement.row = row
    this.placement.x = x
    this.placement.y = y
    this.placement.valid = Boolean(typeId) && buildable && affordable
  }

  tryPlaceTower() {
    const { typeId, valid, col, row, x, y } = this.placement
    if (!typeId || !valid) return false
    this.state.money -= buyCost(typeId)
    this.towers.push(new Tower(typeId, col, row, x, y))
    return true
  }

  setSelectedTower(id) {
    this.selectedTowerId = id
  }

  getSelectedTower() {
    return this.towers.find((t) => t.id === this.selectedTowerId) ?? null
  }

  sellTower(id) {
    const index = this.towers.findIndex((t) => t.id === id)
    if (index === -1) return
    const tower = this.towers[index]
    this.state.money += Math.round(tower.totalInvested * SELL_REFUND_RATE)
    this.towers.splice(index, 1)
    if (this.selectedTowerId === id) this.selectedTowerId = null
  }

  upgradeTower(id) {
    const tower = this.towers.find((t) => t.id === id)
    if (!tower || !tower.canUpgrade()) return false
    const cost = upgradeCost(tower.typeId, tower.level)
    if (this.state.money < cost) return false
    this.state.money -= cost
    tower.totalInvested += cost
    tower.level += 1
    tower.applyLevelStats()
    return true
  }

  spawnProjectile(tower, targetIndex) {
    const generation = this.enemyPool.generations[targetIndex]
    this.projectilePool.acquire({
      x: tower.x,
      y: tower.y,
      speed: PROJECTILE_SPEED[tower.kind] ?? 700,
      damage: tower.damage,
      kind: tower.kind,
      color: tower.projectileColor,
      targetId: targetIndex,
      targetGeneration: generation,
      slow: tower.slow,
      slowDuration: tower.slowDuration,
      splashRadius: tower.splashRadius,
    })
  }
}

export { TOWER_TEMPLATES }
