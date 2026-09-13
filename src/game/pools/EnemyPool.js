import { Enemy } from '../entities/Enemy.js'

export class EnemyPool {
  constructor(capacity) {
    this.capacity = capacity
    this.items = new Array(capacity)
    this.generations = new Int32Array(capacity)
    this.freeList = new Int32Array(capacity)
    for (let i = 0; i < capacity; i++) {
      this.items[i] = new Enemy()
      this.freeList[i] = capacity - 1 - i
    }
    this.freeTop = capacity
    this.activeIndices = new Int32Array(capacity)
    this.activeCount = 0
    this.slotPosition = new Int32Array(capacity).fill(-1)
  }

  acquire(typeId, template, x, y, hp, speed) {
    if (this.freeTop === 0) return -1
    const index = this.freeList[--this.freeTop]
    this.items[index].reset(typeId, template, x, y, hp, speed, this.generations[index])
    const pos = this.activeCount++
    this.activeIndices[pos] = index
    this.slotPosition[index] = pos
    return index
  }

  release(index) {
    const enemy = this.items[index]
    if (!enemy.active) return
    enemy.active = false
    this.generations[index]++
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

  isCurrent(index, generation) {
    return index >= 0 && this.generations[index] === generation && this.items[index].active
  }

  // Iterate back-to-front: release() does a swap-remove from the tail, and
  // walking backwards means the swapped-in entity was already visited this
  // pass, so nothing gets skipped or double-processed while releasing mid-loop.
  forEachActive(fn) {
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const index = this.activeIndices[i]
      fn(this.items[index], index)
    }
  }
}
