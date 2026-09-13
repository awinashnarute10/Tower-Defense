/**
 * @typedef {Object} TowerLevel
 * @property {number} damage
 * @property {number} range
 * @property {number} fireRate  shots per second
 * @property {number} cost      buy cost at level 1, upgrade cost thereafter
 * @property {number} [slow]         frost only: speed multiplier applied to hit enemies (0-1)
 * @property {number} [slowDuration] frost only: seconds
 * @property {number} [splashRadius] splash only
 */

/**
 * @typedef {Object} TowerTemplate
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} color
 * @property {string} projectileColor
 * @property {'single'|'slow'|'splash'} kind
 * @property {TowerLevel[]} levels
 */

/** @type {Record<string, TowerTemplate>} */
export const TOWER_TEMPLATES = {
  cannon: {
    id: 'cannon',
    label: 'Cannon',
    description: 'Single-target, high DPS.',
    color: '#4cf3ff',
    projectileColor: '#c9fbff',
    kind: 'single',
    levels: [
      { damage: 30, range: 120, fireRate: 2.0, cost: 100 },
      { damage: 45, range: 130, fireRate: 2.2, cost: 140 },
      { damage: 70, range: 145, fireRate: 2.5, cost: 220 },
      { damage: 110, range: 160, fireRate: 3.0, cost: 340 },
    ],
  },
  frost: {
    id: 'frost',
    label: 'Frost',
    description: 'Slows enemies, low damage.',
    color: '#7fd8ff',
    projectileColor: '#dff6ff',
    kind: 'slow',
    levels: [
      { damage: 8, range: 110, fireRate: 1.5, cost: 90, slow: 0.5, slowDuration: 1.5 },
      { damage: 12, range: 120, fireRate: 1.6, cost: 120, slow: 0.56, slowDuration: 1.6 },
      { damage: 18, range: 130, fireRate: 1.8, cost: 190, slow: 0.63, slowDuration: 1.8 },
      { damage: 26, range: 145, fireRate: 2.0, cost: 300, slow: 0.72, slowDuration: 2.0 },
    ],
  },
  splash: {
    id: 'splash',
    label: 'Splash',
    description: 'Area damage, slow fire rate.',
    color: '#ff9c4c',
    projectileColor: '#ffd9b0',
    kind: 'splash',
    levels: [
      { damage: 40, range: 130, fireRate: 0.8, cost: 150, splashRadius: 50 },
      { damage: 60, range: 140, fireRate: 0.9, cost: 210, splashRadius: 58 },
      { damage: 90, range: 150, fireRate: 1.0, cost: 320, splashRadius: 66 },
      { damage: 130, range: 165, fireRate: 1.15, cost: 480, splashRadius: 75 },
    ],
  },
}

export const SELL_REFUND_RATE = 0.65

export function buyCost(typeId) {
  return TOWER_TEMPLATES[typeId].levels[0].cost
}

export function upgradeCost(typeId, currentLevel) {
  const levels = TOWER_TEMPLATES[typeId].levels
  const next = levels[currentLevel + 1]
  return next ? next.cost : null
}
