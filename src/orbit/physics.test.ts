import { describe, expect, it } from 'vitest'
import { MAX_CHAIN, OrbitGame, createAutopilot, hudMargins, loopScore, nearestPoint, pointInPolygon, polygonArea, seededRandom } from './physics'

describe('orbit geometry', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
  it('captures points within either winding, excluding outside points', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true)
    expect(pointInPolygon({ x: 5, y: 5 }, [...square].reverse())).toBe(true)
    expect(pointInPolygon({ x: 11, y: 5 }, square)).toBe(false)
    expect(polygonArea(square)).toBe(100)
  })
  it('clamps the closest point to a segment and handles degenerate trails', () => {
    expect(nearestPoint({ x: 20, y: 3 }, square[0], square[1])).toEqual({ x: 10, y: 0 })
    expect(nearestPoint({ x: 5, y: 3 }, square[0], square[0])).toEqual(square[0])
  })
  it('rewards multi-sun routes more than separate captures and caps combo multiplication', () => {
    expect(loopScore(2, 1)).toBeGreaterThan(loopScore(1, 1) * 2)
    expect(loopScore(3, 12)).toBe(loopScore(3, 4))
    expect(loopScore(0, 3)).toBe(0)
  })
})

describe('playable orbit rules', () => {
  it('holds the ship and timer until the player gives the first input', () => {
    const game = new OrbitGame(1280, 800, () => .2)
    const initial = { ...game.ship }
    for (let i = 0; i < 300; i++) game.step(1 / 60, { turn: 0, target: null, boost: false })
    expect(game.ship).toEqual(initial)
    expect(game.remaining).toBe(60)
    expect(game.started).toBe(false)
    for (let i = 0; i < 150; i++) game.step(1 / 60, { turn: -1, target: null, boost: false })
    expect(game.captured).toBeGreaterThan(0)
  })
  it('lets a held left turn complete the guided first orbit with real simulation', () => {
    const game = new OrbitGame(1280, 800, () => .2)
    game.started = true
    const events = []
    for (let i = 0; i < 150; i++) events.push(...game.step(1 / 60, { turn: -1, target: null, boost: false }))
    expect(events.some(event => event.type === 'capture')).toBe(true)
    expect(game.captured).toBeGreaterThan(0)
    expect(game.score).toBeGreaterThan(0)
    expect(game.remaining).toBeGreaterThan(60)
  })
  it('supports the same guided first orbit at a phone viewport', () => {
    const game = new OrbitGame(390, 844, () => .2)
    for (let i = 0; i < 150; i++) game.step(1 / 60, { turn: -1, target: null, boost: false })
    expect(game.captured).toBeGreaterThan(0)
  })
  it('penalizes collisions once during invulnerability and prevents negative time', () => {
    const game = new OrbitGame(1280, 800, () => .2)
    game.started = true
    game.ship.x = 15; game.ship.angle = Math.PI
    expect(game.step(1 / 60, { turn: 0, target: null, boost: false })).toContainEqual({ type: 'hit' })
    expect(game.remaining).toBeCloseTo(55 - 1 / 60)
    game.remaining = .001
    game.step(1 / 60, { turn: 0, target: null, boost: false })
    expect(game.remaining).toBe(0)
    expect(game.ended).toBe(true)
  })
  it('keeps suns within the playable rectangle after phone rotation', () => {
    const game = new OrbitGame(390, 844, () => .2)
    game.suns[0].y = 190; game.suns[1].y = 680
    game.resize(844, 390)
    expect(game.suns.every(sun => sun.y > game.top && sun.y < game.bottom)).toBe(true)
    game.resize(320, 568)
    expect(game.suns.every(sun => sun.x > 0 && sun.x < 320 && sun.y > game.top && sun.y < game.bottom)).toBe(true)
  })
  it('uses tighter margins on wide screens and honours custom ones', () => {
    expect(hudMargins(390).top).toBeGreaterThan(hudMargins(1280).top)
    const game = new OrbitGame(1280, 800, () => .2, { top: 20, bottom: 20 })
    expect(game.top).toBe(20)
    expect(game.bottom).toBe(780)
  })
  it('reports captured sun positions and records each captured loop', () => {
    const game = new OrbitGame(1280, 800, () => .2)
    game.started = true
    const events = []
    for (let i = 0; i < 150; i++) events.push(...game.step(1 / 60, { turn: -1, target: null, boost: false }))
    const capture = events.find(event => event.type === 'capture')
    expect(capture?.suns).toHaveLength(capture?.count ?? -1)
    expect(game.history).toHaveLength(game.loops)
    expect(game.history[0].length).toBeGreaterThan(2)
  })
  it('flies the title-screen autopilot into repeated captures', () => {
    const game = new OrbitGame(800, 420, () => .2, { top: 0, bottom: 0 })
    game.hazards = []
    const pilot = createAutopilot()
    for (let i = 0; i < 60 * 20; i++) game.step(1 / 60, pilot(game))
    expect(game.loops).toBeGreaterThanOrEqual(3)
  })
  it('keeps raising difficulty through a whole run, past 15 and 34 captures', () => {
    const game = new OrbitGame(1280, 800, () => .2)
    const at = (captured: number) => { game.captured = captured; return { speed: game.hazardSpeed, count: game.hazardTarget } }
    for (const [from, to] of [[0, 14], [14, 15], [15, 33], [33, 34], [34, 45], [45, 80]]) {
      expect(at(to).speed).toBeGreaterThan(at(from).speed)
    }
    for (const [from, to] of [[0, 3], [14, 15], [15, 18], [33, 36], [36, 45]]) {
      expect(at(to).count).toBeGreaterThan(at(from).count)
    }
  })
  it('speeds up hazards already on the field as captures mount', () => {
    const game = new OrbitGame(1280, 800, () => .2)
    game.started = true
    const before = game.hazards[0].speed
    game.captured = 20
    game.step(1 / 60, { turn: 0, target: null, boost: false })
    expect(game.hazards[0].speed).toBeGreaterThan(before)
  })
  it('reports the capped chain that scoring uses', () => {
    const game = new OrbitGame(800, 420, () => .2, { top: 0, bottom: 0 })
    game.hazards = []
    const pilot = createAutopilot()
    for (let i = 0; i < 60 * 20 && !game.loops; i++) {
      game.combo = 12; game.lastCapture = game.elapsed
      game.step(1 / 60, pilot(game))
    }
    expect(game.combo).toBeGreaterThan(MAX_CHAIN)
    expect(game.bestCombo).toBe(MAX_CHAIN)
  })
  it('plays the same run for the same seed and a different one for another', () => {
    const fly = (seed: number) => {
      const game = new OrbitGame(800, 420, seededRandom(seed), { top: 0, bottom: 0 })
      const pilot = createAutopilot()
      for (let i = 0; i < 60 * 30; i++) game.step(1 / 60, pilot(game))
      return JSON.stringify({ score: game.score, captured: game.captured, suns: game.suns, hazards: game.hazards, ship: game.ship })
    }
    expect(fly(12345)).toBe(fly(12345))
    expect(fly(12345)).not.toBe(fly(54321))
  })
})
