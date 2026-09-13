import { Projectile } from '../entities/Projectile.js'

export class ProjectilePool {
  constructor(capacity) {
    this.capacity = capacity
    this.items = new Array(capacity)
    this.freeList = new Int32Array(capacity)
    for (let i = 0; i < capacity; i++) {
      this.items[i] = new Projectile()
      this.freeList[i] = capacity - 1 - i
    }
    this.freeTop = capacity
    this.activeIndices = new Int32Array(capacity)
    this.activeCount = 0
    this.slotPosition = new Int32Array(capacity).fill(-1)
  }

  acquire(x, y, speed, damage, kind, color, targetId, targetGeneration, slow, slowDuration, splashRadius) {
    if (this.freeTop === 0) return -1
    const index = this.freeList[--this.freeTop]
    this.items[index].reset(x, y, speed, damage, kind, color, targetId, targetGeneration, slow, slowDuration, splashRadius)
    const pos = this.activeCount++
    this.activeIndices[pos] = index
    this.slotPosition[index] = pos
    return index
  }

  release(index) {
    const projectile = this.items[index]
    if (!projectile.active) return
    projectile.active = false
    const pos = this.slotPosition[index]
    const lastPos = --this.activeCount
    const lastIndex = this.activeIndices[lastPos]
    this.activeIndices[pos] = lastIndex
    this.slotPosition[lastIndex] = pos
    this.slotPosition[index] = -1
    this.freeList[this.freeTop++] = index
  }

  get(index) {
    return this.items[index]
  }

  forEachActive(fn) {
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const index = this.activeIndices[i]
      fn(this.items[index], index)
    }
  }
}
