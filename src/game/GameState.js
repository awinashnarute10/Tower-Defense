export const STARTING_HEALTH = 100
export const STARTING_MONEY = 500
export const TOTAL_WAVES = 50

export function createInitialState() {
  return {
    status: 'menu', // menu | playing | paused | victory | gameover | perflab
    health: STARTING_HEALTH,
    money: STARTING_MONEY,
    score: 0,
    wave: 0,
    gameSpeed: 1,
    waveActive: false,
    shakeUntil: 0,
    shakeMagnitude: 0,
    bossWarningUntil: 0,
    waveBannerUntil: 0,
    waveBannerText: '',
  }
}
