const SAMPLE_SIZE = 180

export class PerformanceMonitor {
  constructor() {
    this.samples = new Float32Array(SAMPLE_SIZE)
    this.index = 0
    this.count = 0
    this.sorted = new Float32Array(SAMPLE_SIZE)
    this.lastStats = { fps: 0, frameTimeMs: 0, p95Ms: 0, pctOver33: 0 }
  }

  record(frameTimeMs) {
    this.samples[this.index] = frameTimeMs
    this.index = (this.index + 1) % SAMPLE_SIZE
    this.count = Math.min(this.count + 1, SAMPLE_SIZE)
  }

  computeStats() {
    const n = this.count
    if (n === 0) return this.lastStats
    let sum = 0
    let over33 = 0
    for (let i = 0; i < n; i++) {
      const v = this.samples[i]
      sum += v
      if (v > 33) over33++
      this.sorted[i] = v
    }
    const view = this.sorted.subarray(0, n).slice().sort()
    const p95Index = Math.min(n - 1, Math.floor(n * 0.95))
    const avgFrameTime = sum / n
    this.lastStats = {
      fps: avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0,
      frameTimeMs: Math.round(avgFrameTime * 100) / 100,
      p95Ms: Math.round(view[p95Index] * 100) / 100,
      pctOver33: Math.round((over33 / n) * 1000) / 10,
    }
    return this.lastStats
  }
}
