import { generateWave } from '../../data/waves.js'
import { ENEMY_TEMPLATES } from '../../data/enemies.js'
import { SPAWN_POINT } from '../../data/map.js'
import { TOTAL_WAVES } from '../GameState.js'

const INTERMISSION_SEC = 3

function interleave(enemies) {
  const queues = enemies.map((e) => ({ type: e.type, remaining: e.count }))
  const out = []
  let total = queues.reduce((sum, q) => sum + q.remaining, 0)
  let cursor = 0
  while (total > 0) {
    const q = queues[cursor % queues.length]
    if (q.remaining > 0) {
      out.push(q.type)
      q.remaining--
      total--
    }
    cursor++
  }
  return out
}

export function startWave(engine, waveNumber) {
  const data = generateWave(waveNumber)
  engine.state.wave = waveNumber
  engine.state.waveActive = true
  engine.waveRuntime.data = data
  engine.waveRuntime.spawnQueue = interleave(data.enemies)
  engine.waveRuntime.spawnTimer = 0
  engine.state.waveBannerText = data.isBoss ? `WAVE ${waveNumber} — BOSS INCOMING` : `WAVE ${waveNumber}`
  engine.state.waveBannerUntil = engine.simTime + 2.5
  if (data.isBoss) engine.state.bossWarningUntil = engine.simTime + 2.5
}

function spawnNext(engine) {
  const rt = engine.waveRuntime
  const typeId = rt.spawnQueue.shift()
  const template = ENEMY_TEMPLATES[typeId]
  const hp = Math.round(template.hp * rt.data.hpMultiplier)
  const speed = template.speed * rt.data.speedMultiplier
  engine.enemyPool.acquire({
    typeId,
    template,
    x: SPAWN_POINT.x,
    y: SPAWN_POINT.y,
    hp,
    speed,
  })
}

export function updateWaveSystem(engine, dt) {
  const rt = engine.waveRuntime
  if (!rt.data) {
    startWave(engine, 1)
    return
  }

  if (rt.spawnQueue.length > 0) {
    rt.spawnTimer -= dt * 1000
    if (rt.spawnTimer <= 0) {
      spawnNext(engine)
      rt.spawnTimer = rt.data.spawnIntervalMs
    }
    return
  }

  if (engine.state.waveActive) {
    if (engine.enemyPool.activeCount === 0) {
      engine.state.waveActive = false
      engine.state.money += rt.data.clearBonus
      if (engine.state.wave >= TOTAL_WAVES) {
        engine.setStatus('victory')
        return
      }
      rt.intermission = INTERMISSION_SEC
    }
    return
  }

  rt.intermission -= dt
  if (rt.intermission <= 0) startWave(engine, engine.state.wave + 1)
}
