import { useEffect, useState, useSyncExternalStore } from 'react'
import { GameEngine } from './game/GameEngine.js'
import GameCanvas from './components/GameCanvas.jsx'
import HUD from './components/HUD.jsx'
import TowerShop from './components/TowerShop.jsx'
import TowerPanel from './components/TowerPanel.jsx'
import PauseMenu from './components/PauseMenu.jsx'
import GameOver from './components/GameOver.jsx'
import MainMenu from './components/MainMenu.jsx'
import WaveBanner from './components/WaveBanner.jsx'
import PerformancePanel from './components/PerformancePanel.jsx'

function App() {
  const [engine] = useState(() => new GameEngine())
  useEffect(() => {
    if (import.meta.env.DEV) window.__engine = engine
  }, [engine])

  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot)
  const [showPerf, setShowPerf] = useState(false)

  const inPlay = snapshot.status === 'playing' || snapshot.status === 'paused'

  function handleCanvasMove(pos) {
    if (snapshot.status === 'playing' && snapshot.placementTypeId) engine.updateHover(pos.x, pos.y)
  }

  function handleCanvasClick(pos) {
    if (snapshot.status !== 'playing') return
    // Clicking an existing tower always selects it, even while a shop tower
    // type is active — otherwise the click just silently fails to place on
    // the occupied cell and the player can never reach the upgrade panel.
    const existingId = engine.pickTowerAt(pos.x, pos.y)
    if (existingId !== null) {
      engine.setPlacementType(null)
      engine.setSelectedTower(existingId)
      return
    }
    if (snapshot.placementTypeId) {
      engine.updateHover(pos.x, pos.y)
      engine.tryPlaceTower()
    } else {
      engine.setSelectedTower(null)
    }
  }

  function handleCanvasRightClick() {
    engine.setPlacementType(null)
    engine.setSelectedTower(null)
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-[var(--retro-bg)] overflow-hidden select-none">
      {inPlay && (
        <HUD snapshot={snapshot} onPause={() => engine.togglePause()} onSpeedChange={(s) => engine.setGameSpeed(s)} />
      )}

      <div className="flex-1 flex relative min-h-0">
        <div className="relative flex-1 min-w-0 flex items-center justify-center bg-black">
          <div className="relative w-full h-full max-w-[1280px] max-h-[720px] mx-auto aspect-video" style={{ minWidth: 0 }}>
            <GameCanvas
              engine={engine}
              onMove={handleCanvasMove}
              onClick={handleCanvasClick}
              onRightClick={handleCanvasRightClick}
            />
            <div className="crt-overlay absolute inset-0" />
            <div className="crt-vignette absolute inset-0" />

            {snapshot.status === 'playing' && <WaveBanner snapshot={snapshot} />}

            {snapshot.status === 'menu' && (
              <MainMenu onStart={() => engine.start()} onPerfLab={() => engine.enterPerfLab({ enemies: 500, towers: 20, projectiles: 100 })} />
            )}
            {snapshot.status === 'paused' && (
              <PauseMenu
                onResume={() => engine.togglePause()}
                onRestart={() => engine.restart()}
                onMainMenu={() => engine.goToMenu()}
              />
            )}
            {(snapshot.status === 'gameover' || snapshot.status === 'victory') && (
              <GameOver
                victory={snapshot.status === 'victory'}
                snapshot={snapshot}
                onRestart={() => engine.restart()}
                onMainMenu={() => engine.goToMenu()}
              />
            )}

            {inPlay && showPerf && (
              <div className="absolute bottom-3 right-3 bg-[var(--retro-panel)]/95 border-2 border-[var(--retro-border)] rounded p-3 z-10">
                <PerformancePanel snapshot={snapshot} lab={false} />
              </div>
            )}
          </div>
        </div>

        {inPlay && (
          <aside className="w-64 shrink-0 bg-[var(--retro-panel)] border-l-4 border-[var(--retro-border)] p-3 overflow-y-auto flex flex-col">
            <TowerShop
              money={snapshot.money}
              selectedTypeId={snapshot.placementTypeId}
              onSelect={(typeId) => {
                engine.setPlacementType(typeId)
                engine.setSelectedTower(null)
              }}
            />
            <TowerPanel
              tower={snapshot.selectedTower}
              money={snapshot.money}
              onUpgrade={(id) => engine.upgradeTower(id)}
              onSell={(id) => engine.sellTower(id)}
              onClose={() => engine.setSelectedTower(null)}
            />
            <button
              onClick={() => setShowPerf((v) => !v)}
              className="mt-auto pt-3 border-t-2 border-[var(--retro-border)] text-[9px] font-pixel opacity-60 hover:opacity-100 text-left"
            >
              {showPerf ? 'HIDE' : 'SHOW'} PERFORMANCE PANEL
            </button>
          </aside>
        )}

        {snapshot.status === 'perflab' && (
          <aside className="w-72 shrink-0 bg-[var(--retro-panel)] border-l-4 border-[var(--retro-border)] p-3 overflow-y-auto">
            <PerformancePanel
              snapshot={snapshot}
              lab
              stressConfig={engine.stressConfig}
              onSetStressConfig={(cfg) => engine.setStressConfig(cfg)}
              onApplyPreset={(mode) => (mode === 'baseline' ? engine.applyBaselineMode() : engine.applyOptimizedMode())}
              onExit={() => engine.goToMenu()}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

export default App
