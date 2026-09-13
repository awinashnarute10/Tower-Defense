import { useEffect, useRef } from 'react'
import { GameLoop } from '../game/GameLoop.js'
import { CanvasRenderer } from '../rendering/renderers/CanvasRenderer.js'
import { MAP_WIDTH, MAP_HEIGHT } from '../data/map.js'

export default function GameCanvas({ engine, backend, onRendererReady, onMove, onClick, onRightClick }) {
  const containerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let renderer = null
    let loop = null
    const container = containerRef.current

    async function mount() {
      let active
      try {
        if (backend === 'webgl') {
          // Dynamic import: Canvas2D-only sessions never pay for Pixi's bundle
          // weight (it's a substantial library — see the code-splitting note
          // in ARCHITECTURE.md).
          const { WebGLRenderer } = await import('../rendering/renderers/WebGLRenderer.js')
          active = new WebGLRenderer()
        } else {
          active = new CanvasRenderer()
        }
        if (cancelled) return
        await active.init(container)
      } catch (err) {
        // Never claim a backend is active when it isn't — fall back to
        // Canvas2D and let the UI reflect what's actually running.
        console.warn('[GameCanvas] renderer init failed, falling back to canvas2d:', err)
        if (cancelled) return
        active = new CanvasRenderer()
        await active.init(container)
      }
      if (cancelled) {
        active.destroy()
        return
      }
      renderer = active
      onRendererReady?.(renderer.name)
      loop = new GameLoop(engine, (eng) => renderer.render(eng))
      loop.start()
    }

    mount()

    return () => {
      cancelled = true
      loop?.stop()
      renderer?.destroy()
    }
  }, [engine, backend, onRendererReady])

  function toWorld(e) {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * MAP_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT,
    }
  }

  return (
    <div
      ref={containerRef}
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
