import type { OrbitGame, Point } from './physics'

const TAU = Math.PI * 2
function path(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
}

export class OrbitRenderer {
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private stars: { x: number; y: number; r: number; a: number }[] = []
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
  draw(game: OrbitGame, time: number, mode: string, reduced: boolean) {
    const c = this.ctx, w = this.width, h = this.height
    c.globalAlpha = 1; c.fillStyle = '#080e17'; c.fillRect(0, 0, w, h)
    const ambient = c.createRadialGradient(w * .6, h * .44, 20, w * .6, h * .44, Math.max(w, h) * .7)
    ambient.addColorStop(0, '#152a31'); ambient.addColorStop(.45, '#0e1b25'); ambient.addColorStop(1, '#080e17')
    c.fillStyle = ambient; c.fillRect(0, 0, w, h)
    this.stars.forEach(star => {
      c.globalAlpha = star.a * (reduced ? 1 : .8 + Math.sin(time * .5 + star.x * 30) * .2)
      c.fillStyle = '#c4d8d7'; c.beginPath(); c.arc(star.x * w, star.y * h, star.r, 0, TAU); c.fill()
    })
    c.globalAlpha = 1
    c.strokeStyle = '#a1c3c709'; c.lineWidth = 1
    const cx = w * .57, cy = (game.top + game.bottom) / 2
    for (let r = 80; r < Math.max(w, h); r += 80) { c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke() }
    c.strokeStyle = '#a1c3c70d'
    for (let i = 0; i < 16; i++) {
      const a = TAU * i / 16; c.beginPath(); c.moveTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28); c.lineTo(cx + Math.cos(a) * 1600, cy + Math.sin(a) * 1600); c.stroke()
    }

    if (mode === 'ready') {
      this.drawInvitation(time, reduced)
      return
    }
    c.strokeStyle = '#9eb6b51a'; c.setLineDash([2, 8]); c.beginPath(); c.moveTo(20, game.top); c.lineTo(w - 20, game.top); c.moveTo(20, game.bottom); c.lineTo(w - 20, game.bottom); c.stroke(); c.setLineDash([])
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
    if (game.captured === 0 && game.elapsed < 7) {
      c.textAlign = 'center'; c.font = '10px ui-monospace, monospace'; c.letterSpacing = '2px'; c.fillStyle = '#b9d5ce99'
      c.fillText('YOUR FIRST SUN', cx, cy + 36); c.letterSpacing = '0px'
      c.strokeStyle = '#a8d8c82a'; c.setLineDash([3, 7]); c.beginPath(); c.arc(cx, cy, game.radius, 0, TAU); c.stroke(); c.setLineDash([])
    }
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
  private drawInvitation(time: number, reduced: boolean) {
    const c = this.ctx, mobile = this.width < 700
    const center = { x: this.width * (mobile ? .58 : .72), y: this.height * (mobile ? .7 : .52) }
    const rx = mobile ? 105 : Math.min(230, this.width * .19), ry = rx * .72
    const a = reduced ? -1 : time * .32 - 1
    c.save(); c.translate(center.x, center.y); c.rotate(-.32)
    if (this.height < 500) c.globalAlpha = .13
    c.strokeStyle = '#b7d8cb1f'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, rx + 34, ry + 28, 0, 0, TAU); c.stroke()
    c.fillStyle = '#edc38706'; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill()
    c.strokeStyle = '#9fdfca66'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, a - 4.7, a); c.stroke()
    c.strokeStyle = '#e5dca133'; c.lineWidth = 5; c.stroke()
    this.drawSun(-rx * .25, -12, time, mobile ? 1.5 : 2)
    this.drawSun(rx * .34, 20, time + 2, mobile ? 1 : 1.3)
    this.drawShip(Math.cos(a) * rx, Math.sin(a) * ry, Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx), time, 1)
    c.restore()
    if (!mobile && this.height >= 500) {
      c.font = '10px ui-monospace, monospace'; c.fillStyle = '#92b4af'; c.letterSpacing = '2px'; c.textAlign = 'left'; c.fillText('A CLOSED ORBIT', center.x - rx + 20, center.y + ry + 90); c.fillStyle = '#617a7c'; c.fillText('IS A SMALL VICTORY.', center.x - rx + 20, center.y + ry + 109); c.letterSpacing = '0px'
    }
  }
}
