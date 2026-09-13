export const MAP_WIDTH = 1280
export const MAP_HEIGHT = 720
export const PATH_WIDTH = 70

export const PATH = [
  { x: -40, y: 180 },
  { x: 220, y: 180 },
  { x: 220, y: 420 },
  { x: 560, y: 420 },
  { x: 560, y: 220 },
  { x: 1000, y: 220 },
  { x: 1000, y: 540 },
  { x: 1320, y: 540 },
]

export const SPAWN_POINT = PATH[0]
export const BASE_POINT = PATH[PATH.length - 1]

export const PLACEMENT_CELL = 40
export const PLACEMENT_COLS = Math.floor(MAP_WIDTH / PLACEMENT_CELL)
export const PLACEMENT_ROWS = Math.floor(MAP_HEIGHT / PLACEMENT_CELL)

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const lenSq = abx * abx + aby * aby
  let t = lenSq === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + abx * t
  const cy = ay + aby * t
  return Math.hypot(px - cx, py - cy)
}

export function distanceToPath(x, y) {
  let min = Infinity
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i]
    const b = PATH[i + 1]
    const d = distToSegment(x, y, a.x, a.y, b.x, b.y)
    if (d < min) min = d
  }
  return min
}

const BUILD_MARGIN = 26

export const buildableGrid = (() => {
  const grid = new Uint8Array(PLACEMENT_COLS * PLACEMENT_ROWS)
  for (let row = 0; row < PLACEMENT_ROWS; row++) {
    for (let col = 0; col < PLACEMENT_COLS; col++) {
      const cx = col * PLACEMENT_CELL + PLACEMENT_CELL / 2
      const cy = row * PLACEMENT_CELL + PLACEMENT_CELL / 2
      const clear = distanceToPath(cx, cy) > PATH_WIDTH / 2 + BUILD_MARGIN
      grid[row * PLACEMENT_COLS + col] = clear ? 1 : 0
    }
  }
  return grid
})()

export function cellIndex(col, row) {
  return row * PLACEMENT_COLS + col
}

export function worldToCell(x, y) {
  return {
    col: Math.floor(x / PLACEMENT_CELL),
    row: Math.floor(y / PLACEMENT_CELL),
  }
}

export function cellCenter(col, row) {
  return {
    x: col * PLACEMENT_CELL + PLACEMENT_CELL / 2,
    y: row * PLACEMENT_CELL + PLACEMENT_CELL / 2,
  }
}

export function isCellBuildable(col, row) {
  if (col < 0 || row < 0 || col >= PLACEMENT_COLS || row >= PLACEMENT_ROWS) return false
  return buildableGrid[cellIndex(col, row)] === 1
}

const segmentLengths = []
let totalPathLength = 0
for (let i = 0; i < PATH.length - 1; i++) {
  const len = Math.hypot(PATH[i + 1].x - PATH[i].x, PATH[i + 1].y - PATH[i].y)
  segmentLengths.push(len)
  totalPathLength += len
}

/** Position + next-waypoint-index at fractional progress t (0..1) along the path. */
export function pointAtProgress(t) {
  let remaining = Math.max(0, Math.min(1, t)) * totalPathLength
  for (let i = 0; i < segmentLengths.length; i++) {
    if (remaining <= segmentLengths[i] || i === segmentLengths.length - 1) {
      const a = PATH[i]
      const b = PATH[i + 1]
      const frac = segmentLengths[i] === 0 ? 0 : remaining / segmentLengths[i]
      return {
        x: a.x + (b.x - a.x) * frac,
        y: a.y + (b.y - a.y) * frac,
        waypointIndex: i + 1,
      }
    }
    remaining -= segmentLengths[i]
  }
  return { x: BASE_POINT.x, y: BASE_POINT.y, waypointIndex: PATH.length - 1 }
}

export function buildableCells() {
  const cells = []
  for (let row = 0; row < PLACEMENT_ROWS; row++) {
    for (let col = 0; col < PLACEMENT_COLS; col++) {
      if (buildableGrid[cellIndex(col, row)] === 1) cells.push({ col, row })
    }
  }
  return cells
}
