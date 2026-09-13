import { ENEMY_UNLOCK_WAVE } from './enemies.js'

const ORDER = ['grunt', 'runner', 'tank', 'healer']

/**
 * Pure, algorithmic wave generator — no hardcoded per-wave tables.
 * Difficulty scales via enemy count, HP/speed multipliers, and unlocked
 * enemy mix; every 10th wave is a boss wave.
 * @param {number} n 1-indexed wave number
 */
export function generateWave(n) {
  const isBoss = n % 10 === 0
  const hpMultiplier = 1 + (n - 1) * 0.13
  const speedMultiplier = 1 + Math.min((n - 1) * 0.012, 0.4)
  const spawnIntervalMs = Math.max(220, 700 - n * 7)
  const baseCount = 8 + Math.floor(n * 1.7)

  const unlocked = ORDER.filter((type) => n >= ENEMY_UNLOCK_WAVE[type])
  const enemies = []

  if (isBoss) {
    enemies.push({ type: 'boss', count: 1 })
    enemies.push({ type: 'grunt', count: Math.max(4, Math.floor(baseCount * 0.5)) })
    if (unlocked.includes('tank')) enemies.push({ type: 'tank', count: Math.floor(2 + n / 10) })
  } else {
    let remaining = baseCount
    const weights = unlocked.map((type, i) => 1 + i * 0.6)
    const weightSum = weights.reduce((a, b) => a + b, 0)
    unlocked.forEach((type, i) => {
      const share = i === unlocked.length - 1
        ? remaining
        : Math.max(1, Math.round((baseCount * weights[i]) / weightSum))
      const count = Math.min(remaining, share)
      if (count > 0) enemies.push({ type, count })
      remaining -= count
    })
  }

  return {
    waveNumber: n,
    isBoss,
    hpMultiplier,
    speedMultiplier,
    spawnIntervalMs,
    enemies,
    clearBonus: 20 + n * 5,
  }
}
