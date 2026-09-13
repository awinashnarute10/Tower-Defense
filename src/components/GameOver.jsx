import OverlayShell from './OverlayShell.jsx'
import { MenuButton } from './PauseMenu.jsx'

export default function GameOver({ victory, snapshot, onRestart, onMainMenu }) {
  return (
    <OverlayShell
      title={victory ? 'VICTORY!' : 'GAME OVER'}
      accent={victory ? 'var(--retro-green)' : 'var(--retro-red)'}
    >
      <p className="text-center text-sm opacity-80 -mt-2">
        {victory ? 'All 50 waves cleared!' : `You survived to wave ${snapshot.wave}.`}
      </p>
      <p className="text-center font-pixel text-[11px] text-[var(--retro-yellow)]">SCORE {snapshot.score}</p>
      <MenuButton onClick={onRestart} label="PLAY AGAIN" />
      <MenuButton onClick={onMainMenu} label="MAIN MENU" />
    </OverlayShell>
  )
}
