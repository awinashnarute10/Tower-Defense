import OverlayShell from './OverlayShell.jsx'

export default function PauseMenu({ onResume, onRestart, onMainMenu }) {
  return (
    <OverlayShell title="PAUSED" accent="var(--retro-cyan)">
      <MenuButton onClick={onResume} label="RESUME" />
      <MenuButton onClick={onRestart} label="RESTART" />
      <MenuButton onClick={onMainMenu} label="MAIN MENU" />
    </OverlayShell>
  )
}

export function MenuButton({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="font-pixel text-[11px] px-6 py-3 rounded border-2 border-[var(--retro-border)] text-[var(--retro-text)] hover:border-[var(--retro-cyan)] hover:text-[var(--retro-cyan)] transition-colors"
    >
      {label}
    </button>
  )
}
