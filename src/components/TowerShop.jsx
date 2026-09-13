import { TOWER_TEMPLATES, buyCost } from '../data/towers.js'

export default function TowerShop({ money, selectedTypeId, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-pixel text-[10px] text-[var(--retro-cyan)] mb-1">TOWER SHOP</h2>
      {Object.values(TOWER_TEMPLATES).map((tower) => {
        const cost = buyCost(tower.id)
        const affordable = money >= cost
        const selected = selectedTypeId === tower.id
        return (
          <button
            key={tower.id}
            disabled={!affordable}
            onClick={() => onSelect(selected ? null : tower.id)}
            className={`text-left px-3 py-2 rounded border-2 transition-colors ${
              selected
                ? 'border-[var(--retro-yellow)] bg-[rgba(255,225,76,0.1)]'
                : 'border-[var(--retro-border)] bg-[var(--retro-bg-alt)]'
            } ${!affordable ? 'opacity-40 cursor-not-allowed' : 'hover:border-[var(--retro-cyan)]'}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px]" style={{ color: tower.color }}>
                {tower.label}
              </span>
              <span className="text-sm text-[var(--retro-yellow)]">${cost}</span>
            </div>
            <p className="text-sm opacity-70 mt-1">{tower.description}</p>
          </button>
        )
      })}
      {selectedTypeId && (
        <p className="text-sm opacity-60 mt-1">Click the battlefield to place. Right-click to cancel.</p>
      )}
    </div>
  )
}
