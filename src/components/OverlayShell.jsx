export default function OverlayShell({ title, accent = 'var(--retro-cyan)', children }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
      <div className="crt-overlay absolute inset-0" />
      <div
        className="relative flex flex-col items-center gap-4 px-10 py-8 rounded-lg border-4 bg-[var(--retro-panel)]"
        style={{ borderColor: accent, boxShadow: `0 0 24px ${accent}55` }}
      >
        <h1 className="font-pixel text-lg tracking-wider" style={{ color: accent }}>
          {title}
        </h1>
        <div className="flex flex-col gap-3 items-stretch w-56">{children}</div>
      </div>
    </div>
  )
}
