import { useState } from 'react'

export default function PerformancePanel({
  snapshot,
  lab,
  stressConfig,
  onSetStressConfig,
  onApplyPreset,
  onExit,
  activeBackend,
  backend,
  onSetBackend,
}) {
  const [draft, setDraft] = useState(stressConfig ?? { enemies: 500, towers: 20, projectiles: 100 })

  return (
    <div className="flex flex-col gap-3 font-pixel text-[10px] text-[var(--retro-text)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[var(--retro-cyan)]">PERFORMANCE {lab ? 'LAB' : 'PANEL'}</h2>
        {activeBackend && (
          <span
            className="text-[8px] px-2 py-1 rounded border-2"
            style={{
              color: activeBackend === 'webgl' ? 'var(--retro-magenta)' : 'var(--retro-cyan)',
              borderColor: activeBackend === 'webgl' ? 'var(--retro-magenta)' : 'var(--retro-cyan)',
            }}
          >
            {activeBackend === 'webgl' ? 'WEBGL' : 'CANVAS2D'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[9px]">
        <Metric label="ENEMIES" value={snapshot.enemyCount} />
        <Metric label="TOWERS" value={snapshot.towerCount} />
        <Metric label="PROJECTILES" value={snapshot.projectileCount} />
        <Metric label="FPS" value={snapshot.fps} accent="var(--retro-green)" />
        <Metric label="FRAME MS" value={snapshot.frameTimeMs} />
        <Metric label="P95 MS" value={snapshot.p95Ms} />
        <Metric label="UPDATE MS" value={snapshot.updateMs} />
        <Metric label="RENDER MS" value={snapshot.renderMs} />
        <Metric label=">33MS %" value={`${snapshot.pctOver33}%`} accent={snapshot.pctOver33 > 5 ? 'var(--retro-red)' : 'var(--retro-green)'} />
      </div>

      {lab && (
        <>
          <div className="flex gap-2 border-t-2 border-[var(--retro-border)] pt-3">
            <button
              onClick={() => onSetBackend('canvas2d')}
              className={`flex-1 px-2 py-2 rounded border-2 ${
                backend === 'canvas2d' ? 'border-[var(--retro-cyan)] text-[var(--retro-cyan)]' : 'border-[var(--retro-border)]'
              }`}
            >
              CANVAS2D
            </button>
            <button
              onClick={() => onSetBackend('webgl')}
              className={`flex-1 px-2 py-2 rounded border-2 ${
                backend === 'webgl' ? 'border-[var(--retro-magenta)] text-[var(--retro-magenta)]' : 'border-[var(--retro-border)]'
              }`}
            >
              WEBGL
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t-2 border-[var(--retro-border)] pt-3">
            <Slider label="Enemies" value={draft.enemies} max={5500} onChange={(v) => setDraft({ ...draft, enemies: v })} />
            <Slider label="Towers" value={draft.towers} max={100} onChange={(v) => setDraft({ ...draft, towers: v })} />
            <Slider label="Projectiles" value={draft.projectiles} max={1100} onChange={(v) => setDraft({ ...draft, projectiles: v })} />
            <button
              onClick={() => onSetStressConfig(draft)}
              className="mt-1 px-2 py-2 rounded border-2 border-[var(--retro-cyan)] text-[var(--retro-cyan)] hover:bg-[rgba(76,243,255,0.1)]"
            >
              APPLY STRESS TEST
            </button>
            <button
              onClick={() => setDraft({ enemies: 5000, towers: 100, projectiles: 1000 })}
              className="px-2 py-2 rounded border-2 border-[var(--retro-border)] hover:border-[var(--retro-yellow)]"
            >
              MAX (5000 / 100 / 1000)
            </button>
          </div>

          <div className="flex gap-2 border-t-2 border-[var(--retro-border)] pt-3">
            <button
              onClick={() => onApplyPreset('baseline')}
              className={`flex-1 px-2 py-2 rounded border-2 ${
                !snapshot.flags.spatialGrid ? 'border-[var(--retro-red)] text-[var(--retro-red)]' : 'border-[var(--retro-border)]'
              }`}
            >
              BASELINE
            </button>
            <button
              onClick={() => onApplyPreset('optimized')}
              className={`flex-1 px-2 py-2 rounded border-2 ${
                snapshot.flags.spatialGrid ? 'border-[var(--retro-green)] text-[var(--retro-green)]' : 'border-[var(--retro-border)]'
              }`}
            >
              OPTIMIZED
            </button>
          </div>

          <div className="text-[8px] opacity-60 leading-relaxed">
            Baseline/Optimized toggle the simulation (spatial grid, target
            caching) — applies to both renderers. Sprite caching only affects
            the Canvas2D backend's Baseline mode (rebuilds gradients per
            entity per frame); WebGL always draws pooled textured sprites,
            there's no equivalent "uncached" GPU path to demonstrate.
          </div>

          <button onClick={onExit} className="mt-1 px-2 py-2 rounded border-2 border-[var(--retro-border)] hover:border-[var(--retro-magenta)]">
            EXIT TO MENU
          </button>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, accent }) {
  return (
    <div className="flex flex-col">
      <span className="opacity-50 text-[7px]">{label}</span>
      <span style={{ color: accent }}>{value}</span>
    </div>
  )
}

function Slider({ label, value, max, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-[9px]">
      <span className="opacity-70">
        {label}: {value}
      </span>
      <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
