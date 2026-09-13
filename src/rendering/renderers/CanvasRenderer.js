import { GameRenderer } from '../GameRenderer.js'
import { MAP_WIDTH, MAP_HEIGHT } from '../../data/map.js'

/** Thin adapter: owns the 2D canvas + context, delegates drawing to the
 * existing, unmodified GameRenderer. */
export class CanvasRenderer {
  static backendName = 'canvas2d'

  async init(container) {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'w-full h-full'
    container.appendChild(this.canvas)

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = MAP_WIDTH * dpr
    this.canvas.height = MAP_HEIGHT * dpr
    this.ctx = this.canvas.getContext('2d')
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Nearest-neighbor, not bilinear: every scaled sprite blit (most enemies —
    // sprites are baked at a fixed 32x32, entity radii vary) would otherwise
    // pay for browser-side resampling on top of the draw call itself, on top
    // of not matching the pixel-art look.
    this.ctx.imageSmoothingEnabled = false

    this.renderer = new GameRenderer()
  }

  render(engine) {
    this.renderer.render(this.ctx, engine)
  }

  destroy() {
    this.canvas.remove()
  }

  get name() {
    return CanvasRenderer.backendName
  }
}
