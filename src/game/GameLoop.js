const FIXED_DT = 1 / 60
const MAX_FRAME_SEC = 0.25
const MAX_SUBSTEPS = 5
const UI_PUBLISH_INTERVAL = 1 / 12

export class GameLoop {
  constructor(engine, render) {
    this.engine = engine
    this.render = render
    this.accumulator = 0
    this.uiTimer = 0
    this.lastTime = 0
    this.rafId = null
    this._tick = this._tick.bind(this)
  }

  start() {
    if (this.rafId !== null) return
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this._tick)
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  _tick(now) {
    const rawDeltaSec = Math.min(MAX_FRAME_SEC, (now - this.lastTime) / 1000)
    this.lastTime = now
    this.engine.perfMonitor.record(rawDeltaSec * 1000)

    this.accumulator += rawDeltaSec * this.engine.state.gameSpeed
    let steps = 0
    const updateStart = performance.now()
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.engine.update(FIXED_DT)
      this.accumulator -= FIXED_DT
      steps++
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0
    const updateMs = performance.now() - updateStart

    const renderStart = performance.now()
    this.render(this.engine)
    const renderMs = performance.now() - renderStart

    // Exponential moving average — cheap running breakdown for the Performance
    // Lab / README, not a precise profiler.
    const t = this.engine.timing
    t.updateMs += (updateMs - t.updateMs) * 0.1
    t.renderMs += (renderMs - t.renderMs) * 0.1

    this.uiTimer += rawDeltaSec
    if (this.uiTimer >= UI_PUBLISH_INTERVAL) {
      this.uiTimer = 0
      this.engine.publish()
    }

    this.rafId = requestAnimationFrame(this._tick)
  }
}
