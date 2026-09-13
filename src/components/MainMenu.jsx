import OverlayShell from './OverlayShell.jsx'
import { MenuButton } from './PauseMenu.jsx'

export default function MainMenu({ onStart, onPerfLab }) {
  return (
    <OverlayShell title="RETRO TOWER DEFENSE" accent="var(--retro-magenta)">
      <p className="text-center text-sm opacity-70 -mt-2">50 waves. 3 towers. 1 base to protect.</p>
      <MenuButton onClick={onStart} label="START GAME" />
      <MenuButton onClick={onPerfLab} label="PERFORMANCE LAB" />
    </OverlayShell>
  )
}
