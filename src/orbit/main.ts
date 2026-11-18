import { OrbitAudio } from './audio'
import { MAX_CHAIN, OrbitGame, createAutopilot, seededRandom, type Controls, type Point } from './physics'
import { OrbitRenderer, type View } from './render'
import './style.css'

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id)
  if (!value) throw new Error(`Missing interface element: ${id}`)
  return value as T
}
const canvas = element<HTMLCanvasElement>('space')
const renderer = new OrbitRenderer(canvas)
const audio = new OrbitAudio()
const controls: Controls = { turn: 0, target: null, boost: false }
const keys = new Set<string>()
const guide = element<HTMLDialogElement>('guide')
const MAX_SEED = 2147483646
/** A valid `?seed=` from a shared link, or null for a fresh random run. */
function seedFromLink(): number | null {
  const value = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isInteger(value) && value >= 1 && value <= MAX_SEED ? value : null
}
let linkSeed = seedFromLink()
let runSeed = linkSeed ?? 1 + Math.floor(Math.random() * MAX_SEED)
let game = new OrbitGame(innerWidth, innerHeight, seededRandom(runSeed))
let demo = game
let pilot = createAutopilot()
let demoView: View | null = null
let demoRuns = 0
let runSuns: Point[] = []
let mode: 'ready' | 'playing' | 'paused' | 'ended' = 'ready'
let muted = true
let best = 0
try { muted = localStorage.getItem('solarDriftOrbitSound') !== 'on'; best = Number(localStorage.getItem('solarDriftOrbitBest')) || 0 } catch { /* The game also works without persistent storage. */ }
audio.setMuted(muted)
let feedbackUntil = 0
let feedbackText = ''
let lastTime = performance.now()
let lastUI = 0
let raf = 0
let guideWasPlaying = false
let pointerSteering = false
let turnTouch = 0
let boostTouch = false
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const listeners = new AbortController()
const options = { signal: listeners.signal }

function feedback(text: string, duration = 2200, tone: 'capture' | 'empty' | 'hit' | 'near' = 'capture') {
  feedbackText = text; feedbackUntil = performance.now() + duration
  element('feedback').textContent = text; element('feedback').dataset.tone = tone; element('feedback').classList.add('visible')
}
/** Fit the title-screen demo into the space the welcome copy leaves free. */
function newDemo() {
  const w = innerWidth, h = innerHeight
  const copy = element('welcome').getBoundingClientRect()
  const copyBottom = Math.max(...['start', 'start-note'].map(id => element(id).getBoundingClientRect().bottom))
  const area = w >= 700 ? { x: Math.max(copy.right + 60, w * .45), y: 96 } : { x: 20, y: copyBottom + 24 }
  const width = w - area.x - (w >= 700 ? 40 : 20), height = h - area.y - (w >= 700 ? 120 : 96)
  // Drawn larger than play scale so the lesson reads at a glance.
  const scale = w >= 700 ? 1.5 : 1.25
  demoView = width >= 240 && height >= 170 && h >= 500 ? { ...area, scale } : null
  pilot = createAutopilot()
  demo = new OrbitGame(Math.max(240, width) / scale, Math.max(170, height) / scale, seededRandom([7, 8, 10][demoRuns++ % 3]), { top: 0, bottom: 0 })
}
function resetControls() {
  keys.clear(); controls.turn = 0; controls.boost = false; controls.target = null; pointerSteering = false; turnTouch = 0; boostTouch = false
  document.querySelectorAll('.touch-controls .active').forEach(el => el.classList.remove('active'))
}
function saveBest() {
  const record = game.score > best
  best = Math.max(best, game.score)
  try { localStorage.setItem('solarDriftOrbitBest', String(best)) } catch { /* No storage is required for a run. */ }
  return record
}
/** Draws every loop that captured light this run, framed around where the flying happened. */
function drawRunMap() {
  const map = element('run-map'), points = [...game.history.flat(), ...runSuns]
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const span = Math.max(game.width * .35, Math.max(...xs) - Math.min(...xs) + 60, (Math.max(...ys) - Math.min(...ys) + 60) * 2.5)
  const cx = points.length ? (Math.max(...xs) + Math.min(...xs)) / 2 : game.width / 2, cy = points.length ? (Math.max(...ys) + Math.min(...ys)) / 2 : (game.top + game.bottom) / 2
  map.setAttribute('viewBox', `${Math.round(cx - span / 2)} ${Math.round(cy - span / 5)} ${Math.round(span)} ${Math.round(span / 2.5)}`)
  const loops = game.history.map((loop, i) => {
    const opacity = (.35 + .65 * (i + 1) / game.history.length).toFixed(2)
    return `<polygon points="${loop.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}" opacity="${opacity}" />`
  })
  const suns = runSuns.map(p => `<circle cx="${Math.round(p.x)}" cy="${Math.round(p.y)}" r="${(span / 110).toFixed(1)}" />`)
  map.innerHTML = loops.join('') + suns.join('')
  const count = game.history.length
  element('map-caption').textContent = count === 1 ? 'The loop that caught light this run' : count ? `The ${count} loops that caught light this run` : 'No suns caught this run'
}
async function share() {
  const url = `${location.origin}${location.pathname}?seed=${runSeed}`
  const text = `I collected ${game.score.toLocaleString()} light in Solar Drift: ${game.captured} sun${game.captured === 1 ? '' : 's'}, best chain ×${game.bestCombo}, seed ${runSeed}. Fly the same sky and close a bigger orbit.`
  if (navigator.share) {
    try { await navigator.share({ title: 'Solar Drift', text, url }) } catch (error) { if ((error as DOMException).name !== 'AbortError') throw error }
    return
  }
  await navigator.clipboard.writeText(`${text} ${url}`)
  element('share').textContent = 'Copied to clipboard'
  setTimeout(() => { element('share').textContent = 'Share this run' }, 2000)
}
function bump(id: string) {
  if (reduced.matches) return
  element(id).animate([{ transform: 'scale(1.18)', color: '#ffe3b0' }, { transform: 'scale(1)' }], { duration: 420, delay: 380, easing: 'cubic-bezier(.23, 1, .32, 1)' })
}
function soundUI() {
  element('sound').querySelector('span')!.textContent = muted ? 'Sound off' : 'Sound on'
  element('sound').setAttribute('aria-pressed', String(!muted))
}
function setMode(next: typeof mode, record = false) {
  mode = next
  for (const name of ['ready', 'playing', 'paused', 'ended']) document.body.classList.toggle(name, mode === name)
  element('welcome').hidden = mode !== 'ready'
  element('hud').hidden = mode === 'ready'
  element('pause').hidden = mode !== 'playing'
  element('overlay').hidden = mode !== 'paused' && mode !== 'ended'
  element('footer').hidden = mode !== 'ready'
  element('touch-controls').hidden = mode !== 'playing'
  if (mode !== 'playing') { resetControls(); audio.setMotion(0, false); element('feedback').classList.remove('visible'); element('feedback').textContent = ''; feedbackText = ''; feedbackUntil = 0 }
  if (mode === 'paused') {
    element('result-label').textContent = ''
    element('result-title').textContent = 'Paused'
    element('result-note').textContent = 'Your orbit is right where you left it.'
    element('result-stats').hidden = true; element('run-record').hidden = true; element('share').hidden = true; element('resume').hidden = false; element('restart').hidden = true
    element('resume').focus()
  }
  if (mode === 'ended') {
    element('result-label').textContent = record && game.score ? 'A new best on this browser.' : best ? `Your best is ${best.toLocaleString()}.` : ''
    element('result-title').innerHTML = `${game.score.toLocaleString()}<small>light</small>`
    element('result-note').textContent = !game.score ? 'Hold the left arrow at the start. Circle the marked sun and meet your own wake.'
      : runSuns.length === game.history.length ? 'Next time, fit two suns in one loop. Together they earn four times the light.'
        : game.bestCombo < MAX_CHAIN ? 'Catch again within 9 seconds of the last capture to build the chain to ×4.' : 'Full chain. Next, try three suns in a single loop.'
    element('result-stats').hidden = false; element('run-record').hidden = false; element('share').hidden = !game.score; element('resume').hidden = true; element('restart').hidden = false
    drawRunMap()
    element('result-stats').innerHTML = game.captured
      ? `You caught <strong>${game.captured}</strong> sun${game.captured === 1 ? '' : 's'} with a best chain of <strong>×${game.bestCombo}</strong>. This sky was seed <strong>${runSeed}</strong>.`
      : `This sky was seed <strong>${runSeed}</strong>.`
    element('restart').focus()
  }
  lastTime = performance.now(); updateUI()
}
async function start() {
  runSeed = linkSeed ?? 1 + Math.floor(Math.random() * MAX_SEED); linkSeed = null
  game = new OrbitGame(innerWidth, innerHeight, seededRandom(runSeed))
  const currentRun = game
  runSuns = []; renderer.clearEffects()
  feedbackText = ''; feedbackUntil = 0; element('feedback').textContent = ''; element('feedback').classList.remove('visible')
  setMode('playing')
  await audio.unlock()
  if (game !== currentRun || mode !== 'playing') return
  audio.start()
  canvas.focus({ preventScroll: true })
}
function pause() { if (mode === 'playing') setMode('paused') }
function resume() { if (mode === 'paused') { setMode('playing'); canvas.focus({ preventScroll: true }) } }
function updateUI() {
  element('score').textContent = game.score.toLocaleString()
  element('best').textContent = `Best ${Math.max(best, game.score).toLocaleString()}`
  element('time').textContent = String(Math.ceil(game.remaining))
  element('charge-text').textContent = String(Math.round(game.charge))
  const combo = element('combo')
  combo.hidden = game.combo < 2
  combo.textContent = `×${Math.min(MAX_CHAIN, game.combo)} chain`
  combo.style.setProperty('--window', String(Math.max(0, 1 - (game.elapsed - game.lastCapture) / 9)))
  element('flight-help').hidden = mode !== 'playing' || game.captured >= 2
  element('desktop-controls').hidden = mode !== 'playing' || game.captured >= 2
  const mobile = innerWidth < 700 || matchMedia('(pointer: coarse)').matches
  element('instruction').innerHTML = game.captured === 0 ? (mobile ? 'Hold <kbd>↶</kbd> to launch your first orbit.' : 'Hold <kbd>←</kbd> to launch your first orbit.') : 'Two suns in one loop earn four times the light.'
  element('sub-instruction').textContent = game.captured === 0 ? 'Cross your wake to collect it. Keep the sun inside.' : 'Each sun adds 3\u00a0s. Red bodies and the edges cost 5\u00a0s.'
  if (feedbackText && performance.now() > feedbackUntil) { element('feedback').classList.remove('visible'); feedbackText = '' }
}
function frame(now: number) {
  raf = 0
  const dt = Math.min(.035, (now - lastTime) / 1000); lastTime = now
  if (mode === 'playing') {
    controls.turn = turnTouch || (Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a')))
    controls.boost = boostTouch || keys.has(' ') || keys.has('Shift') || keys.has('ArrowUp') || keys.has('w')
    const events = game.step(dt, controls)
    for (const event of events) {
      if (event.type === 'capture') {
        audio.capture(event.count, event.combo); runSuns.push(...event.suns)
        const score = element('score').getBoundingClientRect()
        renderer.burst(event.suns, reduced.matches, { x: score.left + score.width / 2, y: score.top + score.height / 2 }); bump('score')
        const chain = Math.min(MAX_CHAIN, event.combo)
        feedback(`${event.count === 1 ? 'Sun' : `${event.count} suns`} captured${chain > 1 ? `, chain ×${chain}` : ''}`)
        if (navigator.vibrate) navigator.vibrate(18)
      }
      else if (event.type === 'empty') feedback('Empty loop. Keep a sun inside.', 1700, 'empty')
      else if (event.type === 'hit') { audio.hit(); renderer.shake(); feedback('Wake lost, 5 seconds gone', 1800, 'hit'); if (navigator.vibrate) navigator.vibrate([15, 35, 20]) }
      else if (event.type === 'near') { audio.nearMiss(); renderer.ping(game.ship); feedback('Close pass, surge recharged', 1200, 'near') }
      else if (event.type === 'end') { audio.end(); setMode('ended', saveBest()) }
    }
    audio.setMotion(game.ship.speed / game.speed, controls.boost && game.charge > 2)
  }
  if (mode === 'ready' && demoView) {
    // The lesson flight only shows suns and the wake, so red bodies never spawn in it.
    demo.hazards = []
    for (const event of demo.step(dt, pilot(demo))) if (event.type === 'capture') renderer.burst(event.suns.map(p => ({ x: demoView!.x + p.x * demoView!.scale, y: demoView!.y + p.y * demoView!.scale })), reduced.matches)
    if (demo.elapsed > 16 && !demo.orbits.length) newDemo()
  }
  if (mode === 'ready') renderer.draw(demo, now / 1000, mode, reduced.matches, demoView)
  else renderer.draw(game, now / 1000, mode, reduced.matches)
  if (now - lastUI > 100) { updateUI(); lastUI = now }
  if (!document.hidden) raf = requestAnimationFrame(frame)
}
function resize() {
  renderer.resize(innerWidth, innerHeight)
  if (mode === 'ready') newDemo()
  else game.resize(innerWidth, innerHeight)
}
canvas.tabIndex = -1
element('start').addEventListener('click', () => void start(), options)
element('restart').addEventListener('click', () => void start(), options)
element('pause').addEventListener('click', pause, options)
element('resume').addEventListener('click', resume, options)
element('back').addEventListener('click', () => { saveBest(); audio.end(); setMode('ready'); newDemo(); element('start').focus() }, options)
element('share').addEventListener('click', () => void share(), options)
element('sound').addEventListener('click', async () => {
  muted = !muted; audio.setMuted(muted); soundUI()
  try { localStorage.setItem('solarDriftOrbitSound', muted ? 'off' : 'on') } catch { /* Optional preference. */ }
  if (!muted) { await audio.unlock(); if (mode === 'playing') audio.start() }
}, options)
element('guide-toggle').addEventListener('click', () => { guideWasPlaying = mode === 'playing'; pause(); guide.showModal() }, options)
guide.addEventListener('close', () => { if (guideWasPlaying) resume(); guideWasPlaying = false }, options)

window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (guide.open) return
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (key === 'Escape') { event.preventDefault(); if (event.repeat) return; if (mode === 'playing') pause(); else if (mode === 'paused') resume(); return }
  if (key === 'm' && !event.repeat) { element('sound').click(); return }
  if (mode !== 'playing') return
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', ' ', 'Shift'].includes(key)) { event.preventDefault(); keys.add(key); controls.target = null }
}, options)
window.addEventListener('keyup', (event: KeyboardEvent) => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key), options)
canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  if (mode !== 'playing') return
  pointerSteering = true; controls.target = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId)
}, options)
canvas.addEventListener('pointermove', (event: PointerEvent) => { if (pointerSteering && mode === 'playing') controls.target = { x: event.clientX, y: event.clientY } }, options)
const releasePointer = () => { pointerSteering = false; controls.target = null }
canvas.addEventListener('pointerup', releasePointer, options); canvas.addEventListener('pointercancel', releasePointer, options)
for (const [id, direction] of [['left', -1], ['right', 1], ['boost', 0]] as const) {
  const button = element(id)
  button.addEventListener('pointerdown', (event: PointerEvent) => {
    if (mode !== 'playing') return
    event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add('active')
    if (id === 'boost') boostTouch = true
    else { turnTouch = direction; controls.target = null }
  }, options)
  const release = () => { button.classList.remove('active'); if (id === 'boost') boostTouch = false; else if (turnTouch === direction) turnTouch = 0 }
  button.addEventListener('pointerup', release, options); button.addEventListener('pointercancel', release, options); button.addEventListener('lostpointercapture', release, options)
}
window.addEventListener('blur', pause, options)
window.addEventListener('resize', resize, options)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); if (raf) cancelAnimationFrame(raf); raf = 0 }
  else { lastTime = performance.now(); if (!raf) raf = requestAnimationFrame(frame) }
}, options)
window.addEventListener('pagehide', (event: PageTransitionEvent) => { if (!event.persisted) { listeners.abort(); audio.dispose(); if (raf) cancelAnimationFrame(raf) } }, options)
soundUI(); resize(); setMode('ready'); raf = requestAnimationFrame(frame)
