/**
 * @typedef {Object} EnemyTemplate
 * @property {string} id
 * @property {string} label
 * @property {number} hp
 * @property {number} speed
 * @property {number} reward
 * @property {number} scoreValue
 * @property {number} radius
 * @property {string} color
 * @property {string} outline
 * @property {{ radius: number, amount: number, interval: number } | null} heal
 */

/** @type {Record<string, EnemyTemplate>} */
export const ENEMY_TEMPLATES = {
  grunt: {
    id: 'grunt',
    label: 'Grunt',
    hp: 100,
    speed: 70,
    reward: 10,
    scoreValue: 10,
    radius: 11,
    color: '#4cff6a',
    outline: '#123312',
    heal: null,
  },
  runner: {
    id: 'runner',
    label: 'Runner',
    hp: 60,
    speed: 150,
    reward: 12,
    scoreValue: 12,
    radius: 9,
    color: '#ffe14c',
    outline: '#332c12',
    heal: null,
  },
  tank: {
    id: 'tank',
    label: 'Tank',
    hp: 500,
    speed: 35,
    reward: 50,
    scoreValue: 50,
    radius: 17,
    color: '#8a8a9a',
    outline: '#2a2a33',
    heal: null,
  },
  healer: {
    id: 'healer',
    label: 'Healer',
    hp: 200,
    speed: 55,
    reward: 25,
    scoreValue: 25,
    radius: 12,
    color: '#ff4cd8',
    outline: '#33122c',
    heal: { radius: 100, amount: 18, interval: 2.5 },
  },
  boss: {
    id: 'boss',
    label: 'Boss',
    hp: 3200,
    speed: 32,
    reward: 300,
    scoreValue: 500,
    radius: 30,
    color: '#b23bff',
    outline: '#2a1033',
    heal: null,
  },
}

export const ENEMY_UNLOCK_WAVE = {
  grunt: 1,
  runner: 3,
  tank: 5,
  healer: 8,
  boss: 10,
}
