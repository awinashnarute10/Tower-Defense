export class SpatialGrid {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize
    this.cols = Math.max(1, Math.ceil(width / cellSize))
    this.rows = Math.max(1, Math.ceil(height / cellSize))
    this.buckets = new Array(this.cols * this.rows)
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = []
  }

  clear() {
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0
  }

  _colRow(x, y) {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)))
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)))
    return [col, row]
  }

  insert(id, x, y) {
    const [col, row] = this._colRow(x, y)
    this.buckets[row * this.cols + col].push(id)
  }

  /** Collect candidate ids within `radius` of (x, y). Caller refines by exact distance. */
  queryCircle(x, y, radius, out) {
    out.length = 0
    const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize))
    const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize))
    const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize))
    const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize))
    for (let row = minRow; row <= maxRow; row++) {
      const base = row * this.cols
      for (let col = minCol; col <= maxCol; col++) {
        const bucket = this.buckets[base + col]
        for (let i = 0; i < bucket.length; i++) out.push(bucket[i])
      }
    }
    return out
  }
}
