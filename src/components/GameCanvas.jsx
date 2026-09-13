import { useEffect, useRef } from 'react'
import { GameRenderer } from '../rendering/GameRenderer.js'
import { GameLoop } from '../game/GameLoop.js'
import { MAP_WIDTH, MAP_HEIGHT } from '../data/map.js'

export default function GameCanvas({ engine, onMove, onClick, onRightClick }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = MAP_WIDTH * dpr
    canvas.height = MAP_HEIGHT * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Nearest-neighbor, not bilinear: every scaled sprite blit (most enemies —
    // sprites are baked at a fixed 32x32, entity radii vary) would otherwise
    // pay for browser-side resampling on top of the draw call itself, on top
    // of not matching the pixel-art look.
    ctx.imageSmoothingEnabled = false

    const renderer = new GameRenderer()
    const loop = new GameLoop(engine, (eng) => renderer.render(ctx, eng))
    loop.start()
    return () => loop.stop()
  }, [engine])

  function toWorld(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * MAP_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT,
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      onMouseMove={(e) => onMove(toWorld(e))}
      onClick={(e) => onClick(toWorld(e))}
      onContextMenu={(e) => {
        e.preventDefault()
        onRightClick()
      }}
    />
  )
}
