export default function TowerPanel({ tower, money, onUpgrade, onSell, onClose }) {
  if (!tower) return null
  const canAfford = tower.upgradeCost !== null && money >= tower.upgradeCost

  return (
    <div className="flex flex-col gap-2 border-t-4 border-[var(--retro-border)] pt-3 mt-3">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-[10px] text-[var(--retro-yellow)]">
          {tower.label} L{tower.level + 1}
        </h2>
        <button onClick={onClose} className="text-sm opacity-60 hover:opacity-100">
          ✕
        </button>
      </div>

      <StatRow label="Damage" value={tower.damage} next={tower.nextLevel?.damage} />
      <StatRow label="Range" value={tower.range} next={tower.nextLevel?.range} />
      <StatRow label="Fire Rate" value={tower.fireRate.toFixed(1)} next={tower.nextLevel?.fireRate.toFixed(1)} />
      {tower.slow != null && (
        <StatRow label="Slow %" value={Math.round((1 - tower.slow) * 100)} next={tower.nextLevel ? Math.round((1 - tower.nextLevel.slow) * 100) : undefined} />
      )}
      {tower.splashRadius != null && (
        <StatRow label="Splash" value={tower.splashRadius} next={tower.nextLevel?.splashRadius} />
      )}

      <div className="flex gap-2 mt-2">
        {tower.nextLevel ? (
          <button
            onClick={() => onUpgrade(tower.id)}
            disabled={!canAfford}
            className={`flex-1 px-2 py-2 rounded border-2 font-pixel text-[9px] ${
              canAfford
                ? 'border-[var(--retro-green)] text-[var(--retro-green)] hover:bg-[rgba(76,255,106,0.1)]'
                : 'border-[var(--retro-border)] opacity-40 cursor-not-allowed'
            }`}
          >
            UPGRADE ${tower.upgradeCost}
          </button>
        ) : (
          <div className="flex-1 px-2 py-2 text-center text-sm opacity-60">MAX LEVEL</div>
        )}
        <button
          onClick={() => onSell(tower.id)}
          className="px-2 py-2 rounded border-2 border-[var(--retro-red)] text-[var(--retro-red)] font-pixel text-[9px] hover:bg-[rgba(255,76,92,0.1)]"
        >
          SELL ${tower.sellValue}
        </button>
      </div>
    </div>
  )
}

function StatRow({ label, value, next }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="opacity-70">{label}</span>
      <span>
        {value}
        {next !== undefined && next !== null && (
          <span className="text-[var(--retro-green)]"> → {next}</span>
        )}
      </span>
    </div>
  )
}
