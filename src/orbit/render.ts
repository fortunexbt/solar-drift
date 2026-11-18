import { nearestPoint, pointInPolygon, type OrbitGame, type Point } from './physics'

const TAU = Math.PI * 2
const SANS = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif'
/** The clock can bank up to this many seconds, so the top wall reads as a share of it. */
const MAX_CLOCK = 90
export interface View extends Point { scale: number }
const LESSON = ['Circle a sun', 'Cross your wake', 'Keep the light']
function path(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
}
const easeOut = (k: number) => 1 - (1 - k) ** 3

export class OrbitRenderer {
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private stars: { x: number; y: number; r: number; a: number }[] = []
  private sparks: { x: number; y: number; vx: number; vy: number; age: number; life: number }[] = []
  private rings: { x: number; y: number; age: number; color: string; size: number }[] = []
  /** Light that leaves a captured sun and flies to the score. */
  private motes: { from: Point; to: Point; bend: Point; age: number; delay: number }[] = []
  private novas: { x: number; y: number; age: number }[] = []
  private shakeLeft = 0
  private flash = 0
  private hitFlash = 0
  private lastTime = 0
  private shownTime = 60
  private gainedAt = -1
  width = 0
  height = 0
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas is unavailable')
    this.ctx = ctx
    for (let i = 0; i < 140; i++) this.stars.push({ x: ((i * 7919) % 997) / 997, y: ((i * 3571) % 991) / 991, r: i % 9 === 0 ? 1.2 : i % 3 === 0 ? .8 : .5, a: .1 + i % 5 * .07 })
  }
  resize(width: number, height: number) {
    this.width = width; this.height = height
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.round(width * this.dpr); this.canvas.height = Math.round(height * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }
  /** A flash, shock ring and sparks at each captured sun, in screen coordinates. With `collect`, light streams from each sun to that point. */
  burst(points: Point[], reduced: boolean, collect?: Point) {
    for (const p of points) {
      this.rings.push({ x: p.x, y: p.y, age: 0, color: '#ffd59a', size: 72 })
      this.novas.push({ x: p.x, y: p.y, age: 0 })
      if (reduced) continue
      for (let i = 0; i < 22; i++) {
        const angle = TAU * i / 22 + Math.random() * .4, speed = 80 + Math.random() * 190
        this.sparks.push({ x: p.x, y: p.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: .45 + Math.random() * .5 })
      }
      if (collect) for (let i = 0; i < 7; i++) {
        const side = (i % 2 ? 1 : -1) * (60 + Math.random() * 140)
        const mid = { x: (p.x + collect.x) / 2, y: (p.y + collect.y) / 2 }, dx = collect.x - p.x, dy = collect.y - p.y, len = Math.hypot(dx, dy) || 1
        this.motes.push({ from: { ...p }, to: collect, bend: { x: mid.x - dy / len * side, y: mid.y + dx / len * side }, age: 0, delay: .12 + i * .045 })
      }
    }
    if (!reduced) this.flash = 1
  }
  /** A pale ring at the ship when a close pass recharges surge. */
  ping(point: Point) { this.rings.push({ x: point.x, y: point.y, age: 0, color: '#8eead0', size: 46 }) }
  shake() { this.shakeLeft = .32; this.hitFlash = 1 }
  clearEffects() { this.sparks = []; this.rings = []; this.motes = []; this.novas = []; this.shakeLeft = 0; this.flash = 0; this.hitFlash = 0; this.shownTime = 60; this.gainedAt = -1 }
  /** `view` places and scales the world on screen; the title screen passes null when there is no room for its demo. */
  draw(game: OrbitGame, time: number, mode: string, reduced: boolean, view: View | null = { x: 0, y: 0, scale: 1 }) {
    const c = this.ctx, w = this.width, h = this.height
    const dt = Math.min(.05, Math.max(0, time - this.lastTime)); this.lastTime = time
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = '#06121a'; c.fillRect(0, 0, w, h)
    this.shakeLeft = Math.max(0, this.shakeLeft - dt)
    if (this.shakeLeft && !reduced) { const k = this.shakeLeft * 22; c.translate((Math.random() - .5) * k, (Math.random() - .5) * k) }
    const origin = view ?? { x: 0, y: 0, scale: 1 }
    const cx = origin.x + game.width * .57 * origin.scale, cy = origin.y + (game.top + game.bottom) / 2 * origin.scale
    const ambient = c.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h) * .75)
    ambient.addColorStop(0, '#14303a'); ambient.addColorStop(.42, '#0b1f29'); ambient.addColorStop(1, '#06121a')
    c.fillStyle = ambient; c.fillRect(-20, -20, w + 40, h + 40)
    this.stars.forEach(star => {
      c.globalAlpha = star.a * (reduced ? 1 : .8 + Math.sin(time * .5 + star.x * 30) * .2)
      c.fillStyle = '#cfe3df'; c.beginPath(); c.arc(star.x * w, star.y * h, star.r, 0, TAU); c.fill()
    })
    c.globalAlpha = 1
    c.strokeStyle = '#a1c3c70a'; c.lineWidth = 1
    for (let r = 90; r < Math.max(w, h) * 1.2; r += 90) { c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke() }
    if (!view) { this.drawEffects(dt, reduced); return }
    c.save(); c.translate(view.x, view.y); c.scale(view.scale, view.scale)
    if (mode !== 'ready') this.drawWalls(game, time, reduced)
    this.drawWorld(game, time, reduced, mode !== 'ready')
    if (mode !== 'ready' && game.captured === 0 && game.elapsed < 7) {
      const sx = game.width * .57, sy = (game.top + game.bottom) / 2
      c.textAlign = 'center'; c.font = `500 13px ${SANS}`; c.fillStyle = '#cfe3dfcc'
      c.fillText('Your first sun', sx, sy + game.radius + 22)
      c.strokeStyle = '#8eead040'; c.lineWidth = 1.2; c.setLineDash([3, 7]); c.lineDashOffset = reduced ? 0 : -time * 8
      c.beginPath(); c.arc(sx, sy, game.radius, 0, TAU); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0
    }
    c.restore()
    if (mode === 'ready') this.drawLesson(game, view)
    this.drawEffects(dt, reduced)
  }
  /** The arena's top wall is the clock and its bottom wall is surge, so both read without leaving the flight. */
  private drawWalls(game: OrbitGame, time: number, reduced: boolean) {
    const c = this.ctx, left = 20, right = game.width - 20, span = right - left
    if (game.remaining > this.shownTime + .5) this.gainedAt = time
    this.shownTime = game.remaining
    const low = game.remaining < 12
    c.lineCap = 'round'
    // Side walls
    c.strokeStyle = '#9ccfc114'; c.lineWidth = 1
    c.beginPath(); c.moveTo(16, game.top); c.lineTo(16, game.bottom); c.moveTo(game.width - 16, game.top); c.lineTo(game.width - 16, game.bottom); c.stroke()
    // Clock
    const share = Math.min(1, game.remaining / MAX_CLOCK), head = left + span * share
    c.strokeStyle = '#9ccfc124'; c.lineWidth = 2; c.beginPath(); c.moveTo(left, game.top); c.lineTo(right, game.top); c.stroke()
    const pulse = low && !reduced ? .65 + Math.sin(time * 9) * .35 : 1
    const gain = this.gainedAt >= 0 ? Math.max(0, 1 - (time - this.gainedAt) / .8) : 0
    const color = low ? '#ff8f78' : '#ffc46e'
    c.globalAlpha = pulse
    c.strokeStyle = color; c.lineWidth = 2 + gain * 2; c.shadowColor = color; c.shadowBlur = 10 + gain * 16
    c.beginPath(); c.moveTo(left, game.top); c.lineTo(head, game.top); c.stroke()
    c.shadowBlur = 0
    c.fillStyle = gain ? '#fff2d8' : color; c.beginPath(); c.arc(head, game.top, 3.5 + gain * 2, 0, TAU); c.fill()
    c.font = `600 ${15 + gain * 3}px ${SANS}`; c.textAlign = 'center'
    c.fillStyle = low ? '#ff8f78' : '#f4e6cf'
    c.fillText(`${Math.ceil(game.remaining)} s`, Math.min(Math.max(head, left + 18), right - 18), game.top - 12)
    c.globalAlpha = 1
    // Surge
    const charge = game.charge / 100, boosting = game.ship.speed > game.speed * 1.15
    c.strokeStyle = '#9ccfc124'; c.lineWidth = 2; c.beginPath(); c.moveTo(left, game.bottom); c.lineTo(right, game.bottom); c.stroke()
    if (charge > .005) {
      c.strokeStyle = boosting ? '#d9fff2' : '#8eead0'; c.lineWidth = boosting ? 3 : 2; c.shadowColor = '#8eead0'; c.shadowBlur = boosting ? 16 : 8
      c.beginPath(); c.moveTo(left, game.bottom); c.lineTo(left + span * charge, game.bottom); c.stroke(); c.shadowBlur = 0
    }
    c.font = `500 13px ${SANS}`; c.textAlign = 'left'; c.fillStyle = '#a3bdb6'
    c.fillText('Surge', left, game.bottom + 20)
    c.lineCap = 'butt'
  }
  private drawWorld(game: OrbitGame, time: number, reduced: boolean, playing: boolean) {
    const c = this.ctx
    for (const orbit of game.orbits) {
      const fade = Math.max(0, 1 - orbit.age / 1.8), pop = Math.max(0, 1 - orbit.age / .45)
      path(c, orbit.points); c.closePath()
      c.fillStyle = orbit.count ? `rgba(255,196,110,${fade * .16 + pop * .38})` : `rgba(142,234,208,${fade * .06})`; c.fill()
      c.strokeStyle = orbit.count ? `rgba(255,214,150,${fade * .9})` : `rgba(142,234,208,${fade * .45})`; c.lineWidth = 1.6 + pop * 3
      if (orbit.count) { c.shadowColor = '#ffc46e'; c.shadowBlur = 18 * fade }
      c.stroke(); c.shadowBlur = 0
      if (orbit.count) {
        const k = Math.min(1, orbit.age / .28), scale = reduced ? 1 : .6 + .4 * k + Math.sin(k * Math.PI) * .25
        const lift = orbit.age * 22
        c.save(); c.translate(orbit.center.x, orbit.center.y - lift); c.scale(scale, scale)
        c.globalAlpha = Math.min(1, fade * 1.6); c.textAlign = 'center'
        c.font = `600 30px ${SANS}`; c.fillStyle = '#fff1d6'; c.shadowColor = '#ffb25a'; c.shadowBlur = 16; c.fillText(`+${orbit.score.toLocaleString()}`, 0, 0); c.shadowBlur = 0
        c.font = `500 14px ${SANS}`; c.fillStyle = '#ffd59a'; c.fillText(`${orbit.count} sun${orbit.count === 1 ? '' : 's'}, +${orbit.count * 3} s`, 0, 22)
        c.restore(); c.globalAlpha = 1
      }
    }
    const preview = playing ? this.loopPreview(game) : null
    if (preview) {
      path(c, preview); c.closePath(); c.fillStyle = '#8eead012'; c.fill()
    }
    game.suns.forEach(sun => this.drawSun(sun.x, sun.y, time + sun.phase, 1, !!preview && pointInPolygon(sun, preview)))
    for (const hazard of game.hazards) {
      c.save(); c.translate(hazard.x, hazard.y)
      const halo = c.createRadialGradient(0, 0, 2, 0, 0, 42); halo.addColorStop(0, '#ff6b5240'); halo.addColorStop(1, '#ff6b5200'); c.fillStyle = halo; c.fillRect(-42, -42, 84, 84)
      c.rotate(reduced ? 0 : time * .5)
      c.strokeStyle = '#ff8f78'; c.lineWidth = 1.5
      for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.ellipse(0, 0, 20, 7, 0, 0, TAU); c.stroke() }
      c.fillStyle = '#ffb3a1'; c.beginPath(); c.arc(0, 0, 3.5, 0, TAU); c.fill(); c.restore()
    }
    const trail = game.trail
    if (trail.length > 1) {
      c.lineJoin = 'round'; c.lineCap = 'round'
      path(c, [...trail, game.ship]); c.strokeStyle = '#5fd6c012'; c.lineWidth = 18; c.stroke()
      c.strokeStyle = '#78e0cc26'; c.lineWidth = 6; c.stroke()
      c.globalCompositeOperation = 'lighter'
      for (let i = 1; i < trail.length; i++) {
        const life = Math.max(0, 1 - (game.elapsed - trail[i].t) / 7)
        c.strokeStyle = `rgba(150,240,214,${.1 + .8 * life})`; c.lineWidth = 1.2 + 1.4 * life
        c.beginPath(); c.moveTo(trail[i - 1].x, trail[i - 1].y); c.lineTo(trail[i].x, trail[i].y); c.stroke()
      }
      c.globalCompositeOperation = 'source-over'
      const start = trail[0]
      c.strokeStyle = '#9cedd640'; c.lineWidth = 1; c.beginPath(); c.arc(start.x, start.y, 4, 0, TAU); c.stroke()
    }
    this.drawShip(game.ship.x, game.ship.y, game.ship.angle, time, game.ship.speed / game.speed, game.invulnerable > 0)
  }
  /** The loop the ship would close if it touched its wake now, drawn as a hint before it happens. */
  private loopPreview(game: OrbitGame): Point[] | null {
    const trail = game.trail, ship = game.ship
    if (trail.length <= 24 || game.invulnerable) return null
    for (let i = 0; i < trail.length - 18; i++) {
      const close = nearestPoint(ship, trail[i], trail[i + 1])
      if (Math.hypot(ship.x - close.x, ship.y - close.y) < 34) return [close, ...trail.slice(i + 1), ship]
    }
    return null
  }
  /** One caption under the title-screen demo, following what the pilot is doing. */
  private drawLesson(game: OrbitGame, view: View) {
    const c = this.ctx
    const lap = game.trail.length * 3 / (TAU * game.radius * 1.3)
    const step = game.orbits.some(orbit => orbit.count && orbit.age < 1.4) ? 2 : lap > .62 ? 1 : 0
    const y = view.y + game.height * view.scale + 28, x = view.x + game.width * view.scale / 2
    c.textAlign = 'center'; c.font = `500 16px ${SANS}`
    c.fillStyle = step === 2 ? '#ffd59a' : '#cfe3df'; c.fillText(LESSON[step], x, y)
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i === step ? (step === 2 ? '#ffc46e' : '#8eead0') : '#9ccfc140'
      c.beginPath(); c.arc(x - 12 + i * 12, y + 16, 2.5, 0, TAU); c.fill()
    }
  }
  private drawEffects(dt: number, reduced: boolean) {
    const c = this.ctx, w = this.width, h = this.height
    if (this.flash > 0) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = this.flash * .1; c.fillStyle = '#ffb25a'; c.fillRect(-20, -20, w + 40, h + 40)
      c.globalCompositeOperation = 'source-over'; this.flash = Math.max(0, this.flash - dt * 3.5)
    }
    if (this.hitFlash > 0) {
      if (!reduced) {
        const edge = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75)
        edge.addColorStop(0, '#ff5a4000'); edge.addColorStop(1, '#ff5a40')
        c.globalAlpha = this.hitFlash * .35; c.fillStyle = edge; c.fillRect(-20, -20, w + 40, h + 40); c.globalAlpha = 1
      }
      this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5)
    }
    this.novas = this.novas.filter(nova => (nova.age += dt) < .55)
    for (const nova of this.novas) {
      const k = nova.age / .55
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k
      const glow = c.createRadialGradient(nova.x, nova.y, 0, nova.x, nova.y, 20 + easeOut(k) * 50)
      glow.addColorStop(0, '#fff3d8'); glow.addColorStop(.3, '#ffc46e99'); glow.addColorStop(1, '#ffc46e00')
      c.fillStyle = glow; c.beginPath(); c.arc(nova.x, nova.y, 20 + easeOut(k) * 50, 0, TAU); c.fill()
      c.globalCompositeOperation = 'source-over'
    }
    this.rings = this.rings.filter(ring => (ring.age += dt) < .7)
    for (const ring of this.rings) {
      const k = ring.age / .7
      c.globalAlpha = (1 - k) * .9; c.strokeStyle = ring.color; c.lineWidth = 2.5 * (1 - k) + .5
      c.beginPath(); c.arc(ring.x, ring.y, 8 + easeOut(k) * ring.size, 0, TAU); c.stroke()
    }
    this.sparks = this.sparks.filter(spark => (spark.age += dt) < spark.life)
    c.fillStyle = '#ffe2b0'
    for (const spark of this.sparks) {
      spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vx *= 1 - dt * 3.2; spark.vy *= 1 - dt * 3.2
      c.globalAlpha = 1 - spark.age / spark.life; c.fillRect(spark.x - 1.3, spark.y - 1.3, 2.6, 2.6)
    }
    this.motes = this.motes.filter(mote => (mote.age += dt) < mote.delay + .6)
    c.globalCompositeOperation = 'lighter'
    for (const mote of this.motes) {
      const k = Math.max(0, (mote.age - mote.delay) / .6)
      if (!k) continue
      const e = k * k, u = 1 - e
      const x = u * u * mote.from.x + 2 * u * e * mote.bend.x + e * e * mote.to.x, y = u * u * mote.from.y + 2 * u * e * mote.bend.y + e * e * mote.to.y
      c.globalAlpha = Math.min(1, (1 - k) * 3); c.fillStyle = '#ffd59a'
      c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill()
      c.globalAlpha *= .3; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill()
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1
  }
  private drawSun(x: number, y: number, time: number, scale: number, enclosed = false) {
    const c = this.ctx
    c.save(); c.translate(x, y); c.scale(scale, scale)
    const reach = enclosed ? 60 : 50
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, reach)
    glow.addColorStop(0, enclosed ? '#ffd28a80' : '#efb15b55'); glow.addColorStop(.25, enclosed ? '#ffb85a40' : '#da96452b'); glow.addColorStop(1, '#da964500')
    c.fillStyle = glow; c.fillRect(-reach, -reach, reach * 2, reach * 2)
    c.strokeStyle = enclosed ? '#ffe3b0aa' : '#edba7655'; c.lineWidth = enclosed ? 1.2 : .8; c.beginPath(); c.arc(0, 0, 14 + Math.sin(time * 1.4) * 1, 0, TAU); c.stroke()
    c.strokeStyle = '#dba96c38'; c.lineWidth = .8; c.beginPath(); c.arc(0, 0, 21, -.8 + time * .1, 1 + time * .1); c.stroke()
    const core = c.createRadialGradient(-2, -2, 1, 0, 0, 7.5); core.addColorStop(0, '#fffaea'); core.addColorStop(.4, '#ffdb95'); core.addColorStop(1, '#e09a52')
    c.fillStyle = core; c.beginPath(); c.arc(0, 0, enclosed ? 7.5 : 7, 0, TAU); c.fill(); c.restore()
  }
  private drawShip(x: number, y: number, angle: number, time: number, speed: number, invulnerable = false) {
    const c = this.ctx
    c.save(); c.translate(x, y)
    const halo = c.createRadialGradient(0, 0, 0, 0, 0, 30); halo.addColorStop(0, '#c9fff04d'); halo.addColorStop(1, '#c9fff000')
    c.fillStyle = halo; c.fillRect(-30, -30, 60, 60)
    c.rotate(angle)
    if (invulnerable) c.globalAlpha = .45 + Math.sin(time * 24) * .25
    const flame = 10 + 16 * speed + Math.sin(time * 37) * 2.5
    const engine = c.createLinearGradient(-8 - flame, 0, -7, 0); engine.addColorStop(0, '#8eead000'); engine.addColorStop(.6, speed > 1.15 ? '#ffe3b0aa' : '#a8f0d8aa'); engine.addColorStop(1, '#ffffff')
    c.fillStyle = engine; c.beginPath(); c.moveTo(-8, -2.6); c.lineTo(-8 - flame, 0); c.lineTo(-8, 2.6); c.fill()
    c.shadowColor = '#cbf9e6'; c.shadowBlur = 16
    c.fillStyle = '#f4fbf3'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-8, -7); c.lineTo(-4.5, 0); c.lineTo(-8, 7); c.closePath(); c.fill()
    c.shadowBlur = 0; c.strokeStyle = '#5c9f98'; c.lineWidth = .9; c.beginPath(); c.moveTo(8, 0); c.lineTo(-4.5, 0); c.stroke(); c.restore()
  }
}
