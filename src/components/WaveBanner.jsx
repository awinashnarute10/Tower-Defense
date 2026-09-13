export default function WaveBanner({ snapshot }) {
  if (!snapshot.waveBannerVisible) return null
  const boss = snapshot.bossWarningVisible
  return (
    <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
      <div
        className={`font-pixel px-6 py-3 rounded border-4 bg-[var(--retro-panel)]/90 ${
          boss ? 'text-[var(--retro-red)] border-[var(--retro-red)] animate-pulse' : 'text-[var(--retro-cyan)] border-[var(--retro-cyan)]'
        }`}
        style={{ fontSize: boss ? '13px' : '11px' }}
      >
        {snapshot.waveBannerText}
      </div>
    </div>
  )
}
