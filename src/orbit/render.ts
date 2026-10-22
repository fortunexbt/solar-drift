import type { OrbitGame, Point } from './physics'

const TAU = Math.PI * 2
export interface View extends Point { scale: number }
const LESSON = ['CIRCLE A SUN', 'CROSS YOUR WAKE', 'KEEP THE LIGHT']
function path(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
}

export class OrbitRenderer {
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private stars: { x: number; y: number; r: number; a: number }[] = []
  private sparks: { x: number; y: number; vx: number; vy: number; age: number; life: number }[] = []
  private rings: { x: number; y: number; age: number }[] = []
  private shakeLeft = 0
  private lastTime = 0
  width = 0
  height = 0
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas is unavailable')
    this.ctx = ctx
    for (let i = 0; i < 100; i++) this.stars.push({ x: ((i * 7919) % 997) / 997, y: ((i * 3571) % 991) / 991, r: i % 7 === 0 ? 1.1 : .55, a: .12 + i % 5 * .06 })
  }
  resize(width: number, height: number) {
    this.width = width; this.height = height
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.round(width * this.dpr); this.canvas.height = Math.round(height * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }
  /** Sparks and a shock ring at each captured sun, in screen coordinates. */
  burst(points: Point[], reduced: boolean) {
    for (const p of points) {
      this.rings.push({ x: p.x, y: p.y, age: 0 })
      if (reduced) continue
      for (let i = 0; i < 16; i++) {
        const angle = TAU * i / 16 + Math.random() * .4, speed = 70 + Math.random() * 150
        this.sparks.push({ x: p.x, y: p.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: .45 + Math.random() * .4 })
      }
    }
  }
  shake() { this.shakeLeft = .32 }
  clearEffects() { this.sparks = []; this.rings = []; this.shakeLeft = 0 }
  /** `view` places and scales the world on screen; the title screen passes null when there is no room for its demo. */
  draw(game: OrbitGame, time: number, mode: string, reduced: boolean, view: View | null = { x: 0, y: 0, scale: 1 }) {
    const c = this.ctx, w = this.width, h = this.height
    const dt = Math.min(.05, Math.max(0, time - this.lastTime)); this.lastTime = time
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    c.globalAlpha = 1; c.fillStyle = '#080e17'; c.fillRect(0, 0, w, h)
    this.shakeLeft = Math.max(0, this.shakeLeft - dt)
    if (this.shakeLeft && !reduced) { const k = this.shakeLeft * 22; c.translate((Math.random() - .5) * k, (Math.random() - .5) * k) }
    const origin = view ?? { x: 0, y: 0, scale: 1 }
    const cx = origin.x + game.width * .57 * origin.scale, cy = origin.y + (game.top + game.bottom) / 2 * origin.scale
    const ambient = c.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h) * .7)
    ambient.addColorStop(0, '#152a31'); ambient.addColorStop(.45, '#0e1b25'); ambient.addColorStop(1, '#080e17')
    c.fillStyle = ambient; c.fillRect(-20, -20, w + 40, h + 40)
    this.stars.forEach(star => {
      c.globalAlpha = star.a * (reduced ? 1 : .8 + Math.sin(time * .5 + star.x * 30) * .2)
      c.fillStyle = '#c4d8d7'; c.beginPath(); c.arc(star.x * w, star.y * h, star.r, 0, TAU); c.fill()
    })
    c.globalAlpha = 1
    c.strokeStyle = '#a1c3c709'; c.lineWidth = 1
    for (let r = 80; r < Math.max(w, h); r += 80) { c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke() }
    c.strokeStyle = '#a1c3c70d'
    for (let i = 0; i < 16; i++) {
      const a = TAU * i / 16; c.beginPath(); c.moveTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28); c.lineTo(cx + Math.cos(a) * 1600, cy + Math.sin(a) * 1600); c.stroke()
    }
    if (!view) return
    c.save(); c.translate(view.x, view.y); c.scale(view.scale, view.scale)
    if (mode !== 'ready') {
      c.strokeStyle = '#9eb6b51a'; c.setLineDash([2, 8]); c.beginPath(); c.moveTo(20, game.top); c.lineTo(game.width - 20, game.top); c.moveTo(20, game.bottom); c.lineTo(game.width - 20, game.bottom); c.stroke(); c.setLineDash([])
    }
    this.drawWorld(game, time, reduced)
    if (mode !== 'ready' && game.captured === 0 && game.elapsed < 7) {
      const sx = game.width * .57, sy = (game.top + game.bottom) / 2
      c.textAlign = 'center'; c.font = '10px ui-monospace, monospace'; c.letterSpacing = '2px'; c.fillStyle = '#b9d5ce99'
      c.fillText('YOUR FIRST SUN', sx, sy + 36); c.letterSpacing = '0px'
      c.strokeStyle = '#a8d8c82a'; c.setLineDash([3, 7]); c.beginPath(); c.arc(sx, sy, game.radius, 0, TAU); c.stroke(); c.setLineDash([])
    }
    c.restore()
    if (mode === 'ready') this.drawLesson(game, view)
    this.drawEffects(dt)
  }
  private drawWorld(game: OrbitGame, time: number, reduced: boolean) {
    const c = this.ctx
    for (const orbit of game.orbits) {
      const fade = Math.max(0, 1 - orbit.age / 1.8)
      path(c, orbit.points); c.closePath(); c.fillStyle = orbit.count ? `rgba(249,183,105,${fade * .2})` : `rgba(130,165,171,${fade * .05})`; c.fill()
      c.strokeStyle = `rgba(255,203,132,${fade * .8})`; c.lineWidth = 1.4; c.stroke()
      if (orbit.count) {
        c.globalAlpha = fade; c.textAlign = 'center'; c.font = '500 26px ui-sans-serif, system-ui'; c.fillStyle = '#ffe0af'; c.fillText(`+${orbit.score}`, orbit.center.x, orbit.center.y - orbit.age * 24)
        c.font = '10px ui-monospace, monospace'; c.fillStyle = '#c6a98b'; c.fillText(`${orbit.count} SUN${orbit.count === 1 ? '' : 'S'}  ·  +${orbit.count * 3}s`, orbit.center.x, orbit.center.y + 20 - orbit.age * 24); c.globalAlpha = 1
      }
    }
    game.suns.forEach(sun => this.drawSun(sun.x, sun.y, time + sun.phase, 1))
    for (const hazard of game.hazards) {
      c.save(); c.translate(hazard.x, hazard.y); c.rotate(reduced ? 0 : time * .4)
      const halo = c.createRadialGradient(0, 0, 2, 0, 0, 38); halo.addColorStop(0, '#c15b472e'); halo.addColorStop(1, '#c15b4700'); c.fillStyle = halo; c.fillRect(-38, -38, 76, 76)
      c.strokeStyle = '#cd7566'; c.lineWidth = 1.3
      for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.ellipse(0, 0, 20, 7, 0, 0, TAU); c.stroke() }
      c.fillStyle = '#0b121a'; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.restore()
    }
    const trail = game.trail
    if (trail.length > 1) {
      c.lineJoin = 'round'; c.lineCap = 'round'
      path(c, [...trail, game.ship]); c.strokeStyle = '#63cfc014'; c.lineWidth = 15; c.stroke()
      c.strokeStyle = '#78d7c82e'; c.lineWidth = 5; c.stroke()
      c.lineWidth = 1.5
      for (let i = 1; i < trail.length; i++) {
        c.strokeStyle = `rgba(156,238,214,${Math.max(.07, .78 * (1 - (game.elapsed - trail[i].t) / 7))})`
        c.beginPath(); c.moveTo(trail[i - 1].x, trail[i - 1].y); c.lineTo(trail[i].x, trail[i].y); c.stroke()
      }
      const start = trail[0]
      c.strokeStyle = '#9cedd64d'; c.lineWidth = 1; c.beginPath(); c.arc(start.x, start.y, 5, 0, TAU); c.stroke()
    }
    this.drawShip(game.ship.x, game.ship.y, game.ship.angle, time, game.ship.speed / game.speed, game.invulnerable > 0)
  }
  /** The three-step caption under the title-screen demo, lit to match what the pilot is doing. */
  private drawLesson(game: OrbitGame, view: View) {
    const c = this.ctx
    const lap = game.trail.length * 3 / (TAU * game.radius * 1.3)
    const step = game.orbits.some(orbit => orbit.count && orbit.age < 1.4) ? 2 : lap > .62 ? 1 : 0
    const y = view.y + game.height * view.scale + 26, width = game.width * view.scale
    c.font = '11px ui-monospace, monospace'; c.letterSpacing = '2px'; c.textAlign = 'left'
    const steps = LESSON.map((text, i) => `${i + 1}  ${text}`)
    if (width < 520) {
      c.fillStyle = '#efbd7d'; c.textAlign = 'center'; c.fillText(steps[step], view.x + width / 2, y)
    } else {
      let x = view.x
      steps.forEach((text, i) => { c.fillStyle = i === step ? '#efbd7d' : '#6f8f8a'; c.fillText(text, x, y); x += c.measureText(text).width + 34 })
    }
    c.letterSpacing = '0px'
  }
  private drawEffects(dt: number) {
    const c = this.ctx
    this.rings = this.rings.filter(ring => (ring.age += dt) < .7)
    for (const ring of this.rings) {
      const k = ring.age / .7, ease = 1 - (1 - k) ** 3
      c.globalAlpha = (1 - k) * .9; c.strokeStyle = '#ffd59a'; c.lineWidth = 2 * (1 - k) + .5
      c.beginPath(); c.arc(ring.x, ring.y, 8 + ease * 64, 0, TAU); c.stroke()
    }
    this.sparks = this.sparks.filter(spark => (spark.age += dt) < spark.life)
    c.fillStyle = '#ffe2b0'
    for (const spark of this.sparks) {
      spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vx *= 1 - dt * 3.2; spark.vy *= 1 - dt * 3.2
      c.globalAlpha = 1 - spark.age / spark.life; c.fillRect(spark.x - 1.2, spark.y - 1.2, 2.4, 2.4)
    }
    c.globalAlpha = 1
  }
  private drawSun(x: number, y: number, time: number, scale: number) {
    const c = this.ctx
    c.save(); c.translate(x, y); c.scale(scale, scale)
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, 48)
    glow.addColorStop(0, '#efb15b55'); glow.addColorStop(.25, '#da96452b'); glow.addColorStop(1, '#da964500')
    c.fillStyle = glow; c.fillRect(-48, -48, 96, 96)
    c.strokeStyle = '#edba7655'; c.lineWidth = .7; c.beginPath(); c.arc(0, 0, 14 + Math.sin(time) * 1, 0, TAU); c.stroke()
    c.strokeStyle = '#dba96c30'; c.beginPath(); c.arc(0, 0, 21, -.8 + time * .1, 1 + time * .1); c.stroke()
    const core = c.createRadialGradient(-2, -2, 1, 0, 0, 7); core.addColorStop(0, '#fff5d6'); core.addColorStop(.4, '#ffdb95'); core.addColorStop(1, '#da9454')
    c.fillStyle = core; c.beginPath(); c.arc(0, 0, 6.5, 0, TAU); c.fill(); c.restore()
  }
  private drawShip(x: number, y: number, angle: number, time: number, speed: number, invulnerable = false) {
    const c = this.ctx
    c.save(); c.translate(x, y); c.rotate(angle)
    if (invulnerable) c.globalAlpha = .4 + Math.sin(time * 24) * .2
    const engine = c.createLinearGradient(-30 * speed, 0, -7, 0); engine.addColorStop(0, '#a8e8d000'); engine.addColorStop(1, '#dbf7ddc0')
    c.fillStyle = engine; c.beginPath(); c.moveTo(-9, -2); c.lineTo(-25 * speed - Math.sin(time * 30) * 3, 0); c.lineTo(-9, 2); c.fill()
    c.shadowColor = '#cbf9e68c'; c.shadowBlur = 14
    c.fillStyle = '#edf5e7'; c.beginPath(); c.moveTo(12, 0); c.lineTo(-8, -6); c.lineTo(-5, 0); c.lineTo(-8, 6); c.closePath(); c.fill()
    c.shadowBlur = 0; c.strokeStyle = '#6daba7'; c.lineWidth = .8; c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, 0); c.stroke(); c.restore()
  }
}
