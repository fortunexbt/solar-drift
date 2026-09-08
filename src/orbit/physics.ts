export interface Point { x: number; y: number }
export interface TrailPoint extends Point { t: number }
export interface Sun extends Point { id: number; phase: number }
export interface Hazard extends Point { angle: number; speed: number; radius: number }
export interface Orbit { points: Point[]; age: number; score: number; count: number; center: Point }
export interface Controls { turn: number; target: Point | null; boost: boolean }
export type GameEvent = { type: 'capture'; count: number; combo: number; score: number } | { type: 'empty' | 'hit' | 'near' | 'end' }

export function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y }, 0)) / 2
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function nearestPoint(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return { x: a.x + dx * t, y: a.y + dy * t }
}

export function loopScore(count: number, combo: number): number {
  return count * count * 100 * Math.min(4, Math.max(1, combo))
}

function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y) }
function angleDelta(a: number, b: number) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)) }

export class OrbitGame {
  width: number
  height: number
  ship = { x: 0, y: 0, angle: -Math.PI / 2, speed: 0 }
  trail: TrailPoint[] = []
  suns: Sun[] = []
  hazards: Hazard[] = []
  orbits: Orbit[] = []
  elapsed = 0
  remaining = 60
  score = 0
  captured = 0
  loops = 0
  combo = 0
  bestCombo = 0
  lastCapture = -20
  charge = 100
  invulnerable = 0
  nearCooldown = 0
  ended = false
  started = false
  private nextId = 0
  private random: () => number
  get speed() { return Math.max(92, Math.min(160, Math.min(this.width, this.height) * .23)) }
  get turnRate() { return 3.15 }
  get top() { return this.width < 700 ? 158 : 115 }
  get bottom() { return this.height - (this.width < 700 ? 130 : 90) }
  get radius() { return this.speed / this.turnRate }

  constructor(width: number, height: number, random: () => number = Math.random) {
    this.width = width; this.height = height; this.random = random
    const center = { x: width * .57, y: (this.top + this.bottom) / 2 }
    this.ship = { x: center.x + this.radius, y: center.y, angle: -Math.PI / 2, speed: this.speed }
    this.trail.push({ x: this.ship.x, y: this.ship.y, t: 0 })
    this.suns.push({ ...center, id: this.nextId++, phase: 0 })
    for (let i = 0; i < 6; i++) this.spawnSun()
    this.spawnHazard()
  }

  private spawnSun() {
    let point: Point = { x: this.width / 2, y: this.height / 2 }
    // Loose pairs make a deliberate wider orbit worth attempting. The opening
    // sun stays alone so the first steering lesson has one clear target.
    if (this.suns.length >= 2 && this.suns.length % 2 === 0) {
      const anchor = this.suns[this.suns.length - 1]
      for (let i = 0; i < 24; i++) {
        const angle = this.random() * Math.PI * 2
        const separation = this.radius * (1 + this.random() * .35)
        point = { x: anchor.x + Math.cos(angle) * separation, y: anchor.y + Math.sin(angle) * separation }
        if (point.x > 40 && point.x < this.width - 40 && point.y > this.top + 25 && point.y < this.bottom - 25 && this.suns.every(s => distance(s, point) > 24)) {
          this.suns.push({ ...point, id: this.nextId++, phase: this.random() * Math.PI * 2 }); return
        }
      }
    }
    for (let i = 0; i < 60; i++) {
      point = { x: 45 + this.random() * (this.width - 90), y: this.top + 30 + this.random() * Math.max(30, this.bottom - this.top - 60) }
      if (this.suns.every(s => distance(s, point) > this.radius * 1.6) && distance(point, this.ship) > 50) break
    }
    this.suns.push({ ...point, id: this.nextId++, phase: this.random() * Math.PI * 2 })
  }

  private spawnHazard() {
    const left = this.random() < .5
    this.hazards.push({ x: left ? 35 : this.width - 35, y: this.top + 30 + this.random() * Math.max(20, this.bottom - this.top - 60), angle: left ? .35 : Math.PI + .35, speed: this.speed * (.22 + Math.min(.4, this.captured * .012)), radius: 13 })
  }

  resize(width: number, height: number) {
    const oldWidth = this.width, oldTop = this.top, oldBottom = this.bottom
    this.width = width; this.height = height
    const sx = (width - 32) / (oldWidth - 32), sy = (this.bottom - this.top) / (oldBottom - oldTop)
    for (const point of [this.ship, ...this.trail, ...this.suns, ...this.hazards]) {
      point.x = Math.max(16, Math.min(width - 16, 16 + (point.x - 16) * sx))
      point.y = Math.max(this.top + 8, Math.min(this.bottom - 8, this.top + (point.y - oldTop) * sy))
    }
    this.orbits = []
  }

  step(dt: number, input: Controls): GameEvent[] {
    if (this.ended || dt <= 0) return []
    if (!this.started) {
      if (!input.turn && !input.target && !input.boost) return []
      this.started = true
    }
    dt = Math.min(dt, .04)
    const events: GameEvent[] = []
    this.elapsed += dt; this.remaining -= dt
    this.invulnerable = Math.max(0, this.invulnerable - dt)
    this.nearCooldown = Math.max(0, this.nearCooldown - dt)
    this.orbits.forEach(orbit => orbit.age += dt)
    this.orbits = this.orbits.filter(orbit => orbit.age < 1.8)
    if (this.elapsed - this.lastCapture > 9) this.combo = 0
    const boost = input.boost && this.charge > 2
    this.charge = Math.max(0, Math.min(100, this.charge + (boost ? -30 : 13) * dt))
    this.ship.speed += ((this.speed * (boost ? 1.8 : 1)) - this.ship.speed) * Math.min(1, dt * 6)
    let turn = input.turn
    if (input.target && !turn) {
      const desired = Math.atan2(input.target.y - this.ship.y, input.target.x - this.ship.x)
      turn = Math.max(-1, Math.min(1, angleDelta(desired, this.ship.angle) * 2.4))
    }
    this.ship.angle += turn * this.turnRate * dt
    this.ship.x += Math.cos(this.ship.angle) * this.ship.speed * dt
    this.ship.y += Math.sin(this.ship.angle) * this.ship.speed * dt

    let hit = false
    if (this.ship.x < 16 || this.ship.x > this.width - 16) {
      this.ship.x = Math.max(16, Math.min(this.width - 16, this.ship.x)); this.ship.angle = Math.PI - this.ship.angle; hit = true
    }
    if (this.ship.y < this.top || this.ship.y > this.bottom) {
      this.ship.y = Math.max(this.top, Math.min(this.bottom, this.ship.y)); this.ship.angle = -this.ship.angle; hit = true
    }
    for (const hazard of this.hazards) {
      hazard.x += Math.cos(hazard.angle) * hazard.speed * dt; hazard.y += Math.sin(hazard.angle) * hazard.speed * dt
      if (hazard.x < 22 || hazard.x > this.width - 22) { hazard.angle = Math.PI - hazard.angle; hazard.x = Math.max(22, Math.min(this.width - 22, hazard.x)) }
      if (hazard.y < this.top + 12 || hazard.y > this.bottom - 12) { hazard.angle = -hazard.angle; hazard.y = Math.max(this.top + 12, Math.min(this.bottom - 12, hazard.y)) }
      const separation = distance(this.ship, hazard)
      if (separation < hazard.radius + 7) hit = true
      else if (separation < hazard.radius + 25 && !this.nearCooldown) { this.charge = Math.min(100, this.charge + 15); this.nearCooldown = 2; events.push({ type: 'near' }) }
    }
    if (hit && !this.invulnerable) {
      this.remaining = Math.max(0, this.remaining - 5); this.combo = 0; this.trail = []; this.invulnerable = 1.4; events.push({ type: 'hit' })
    }

    const last = this.trail[this.trail.length - 1]
    if (!last || distance(last, this.ship) >= 3) {
      if (this.trail.length > 24 && !this.invulnerable) {
        for (let i = 0; i < this.trail.length - 18; i++) {
          const close = nearestPoint(this.ship, this.trail[i], this.trail[i + 1])
          if (distance(this.ship, close) > 8) continue
          const points = [close, ...this.trail.slice(i + 1), { x: this.ship.x, y: this.ship.y }]
          if (polygonArea(points) < 600) continue
          const caught = this.suns.filter(s => pointInPolygon(s, points))
          const count = caught.length
          this.combo = count ? this.combo + 1 : 0
          const score = loopScore(count, this.combo)
          const center = points.reduce((p, q) => ({ x: p.x + q.x / points.length, y: p.y + q.y / points.length }), { x: 0, y: 0 })
          this.orbits.push({ points, age: 0, score, count, center })
          this.trail = []
          if (count) {
            this.score += score; this.captured += count; this.loops++; this.lastCapture = this.elapsed; this.bestCombo = Math.max(this.bestCombo, this.combo)
            this.remaining = Math.min(90, this.remaining + count * 3); this.charge = Math.min(100, this.charge + count * 20)
            this.suns = this.suns.filter(s => !caught.includes(s))
            for (let j = 0; j < count; j++) this.spawnSun()
            if (this.hazards.length < Math.min(6, 1 + Math.floor(this.captured / 3))) this.spawnHazard()
            events.push({ type: 'capture', count, combo: this.combo, score })
          } else events.push({ type: 'empty' })
          break
        }
      }
      this.trail.push({ x: this.ship.x, y: this.ship.y, t: this.elapsed })
    }
    this.trail = this.trail.filter(point => this.elapsed - point.t < 7)
    if (this.remaining <= 0) { this.remaining = 0; this.ended = true; events.push({ type: 'end' }) }
    return events
  }
}
