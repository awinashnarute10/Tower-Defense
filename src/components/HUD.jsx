const SPEEDS = [1, 2, 3]

export default function HUD({ snapshot, onPause, onSpeedChange }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-[var(--retro-panel)] border-b-4 border-[var(--retro-border)] font-pixel text-[10px] text-[var(--retro-text)]">
      <div className="flex items-center gap-5">
        <Stat label="HEALTH" value={snapshot.health} color="var(--retro-red)" />
        <Stat label="MONEY" value={`$${snapshot.money}`} color="var(--retro-yellow)" />
        <Stat label="WAVE" value={`${snapshot.wave}/50`} color="var(--retro-cyan)" />
        <Stat label="SCORE" value={snapshot.score} color="var(--retro-green)" />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[var(--retro-magenta)]">{snapshot.fps} FPS</span>
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-1 border-2 rounded ${
                snapshot.gameSpeed === s
                  ? 'border-[var(--retro-cyan)] text-[var(--retro-cyan)]'
                  : 'border-[var(--retro-border)] text-[var(--retro-text)]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <button
          onClick={onPause}
          className="px-3 py-1 border-2 border-[var(--retro-border)] rounded hover:border-[var(--retro-cyan)]"
        >
          {snapshot.status === 'paused' ? 'RESUME' : 'PAUSE'}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[8px] opacity-60">{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}
