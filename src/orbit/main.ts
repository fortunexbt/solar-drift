import { OrbitAudio } from './audio'
import { OrbitGame, type Controls } from './physics'
import { OrbitRenderer } from './render'
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
let game = new OrbitGame(innerWidth, innerHeight)
let mode: 'ready' | 'playing' | 'paused' | 'ended' = 'ready'
let muted = false
let best = 0
try { muted = localStorage.getItem('solarDriftOrbitSound') === 'off'; best = Number(localStorage.getItem('solarDriftOrbitBest')) || 0 } catch { /* The game also works without persistent storage. */ }
audio.setMuted(muted)
let feedbackUntil = 0
let feedbackText = ''
let lastTime = performance.now()
let lastUI = 0
let raf = 0
let guideWasPlaying = false
let firstStart = true
let pointerSteering = false
let turnTouch = 0
let boostTouch = false
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const listeners = new AbortController()
const options = { signal: listeners.signal }

function feedback(text: string, duration = 2200) {
  feedbackText = text; feedbackUntil = performance.now() + duration
  element('feedback').textContent = text; element('feedback').classList.add('visible')
}
function resetControls() {
  keys.clear(); controls.turn = 0; controls.boost = false; controls.target = null; pointerSteering = false; turnTouch = 0; boostTouch = false
  document.querySelectorAll('.touch-controls .active').forEach(el => el.classList.remove('active'))
}
function saveBest() {
  best = Math.max(best, game.score)
  try { localStorage.setItem('solarDriftOrbitBest', String(best)) } catch { /* No storage is required for a run. */ }
}
function soundUI() {
  element('sound').innerHTML = `SOUND <span>${muted ? 'OFF' : 'ON'}</span>`
  element('sound').setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off')
  element('sound').setAttribute('aria-pressed', String(!muted))
}
function setMode(next: typeof mode) {
  mode = next; document.body.classList.toggle('playing', mode === 'playing')
  element('welcome').hidden = mode !== 'ready'
  element('hud').hidden = mode === 'ready'
  element('pause').hidden = mode !== 'playing'
  element('overlay').hidden = mode !== 'paused' && mode !== 'ended'
  element('footer').hidden = mode !== 'ready'
  element('flight-help').hidden = mode !== 'playing'
  element('desktop-controls').hidden = mode !== 'playing'
  element('touch-controls').hidden = mode !== 'playing'
  if (mode !== 'playing') { resetControls(); audio.setMotion(0, false); element('feedback').classList.remove('visible'); element('feedback').textContent = ''; feedbackText = ''; feedbackUntil = 0 }
  if (mode === 'paused') {
    element('result-label').textContent = 'FLIGHT ON HOLD'
    element('result-title').innerHTML = 'Take your<br /><em>time.</em>'
    element('result-note').textContent = 'Your orbit is right where you left it.'
    element('result-stats').hidden = true; element('resume').hidden = false; element('restart').hidden = true
    element('resume').focus()
  }
  if (mode === 'ended') {
    element('result-label').textContent = 'FLIGHT RECORDED'
    element('result-title').innerHTML = game.score ? 'A little<br /><em>more light.</em>' : 'Find your<br /><em>first orbit.</em>'
    element('result-note').textContent = game.score ? 'Try enclosing two suns in one orbit. The reward grows with the risk.' : 'Hold the left arrow at the start. Circle the marked sun and meet your own wake.'
    element('result-stats').hidden = false; element('resume').hidden = true; element('restart').hidden = false
    element('final-score').textContent = game.score.toLocaleString(); element('final-suns').textContent = String(game.captured); element('final-chain').textContent = `×${game.bestCombo}`
    element('restart').focus()
  }
  lastTime = performance.now(); updateUI()
}
async function start() {
  game = new OrbitGame(innerWidth, innerHeight)
  const currentRun = game
  feedbackText = ''; feedbackUntil = 0; element('feedback').textContent = ''; element('feedback').classList.remove('visible')
  setMode('playing')
  await audio.unlock()
  if (game !== currentRun || mode !== 'playing') return
  audio.start()
  if (firstStart && game.captured === 0) feedback('CIRCLE THE MARKED SUN. CROSS YOUR WAKE.', 4200)
  firstStart = false
  canvas.focus({ preventScroll: true })
}
function pause() { if (mode === 'playing') setMode('paused') }
function resume() { if (mode === 'paused') { setMode('playing'); canvas.focus({ preventScroll: true }) } }
function updateUI() {
  element('score').textContent = String(game.score).padStart(4, '0')
  element('best').textContent = `PERSONAL BEST ${Math.max(best, game.score).toLocaleString()}`
  element('time').textContent = String(Math.ceil(game.remaining)).padStart(2, '0')
  element('time').style.color = game.remaining < 12 ? '#ecaa8b' : ''
  element('combo').textContent = game.combo > 0 ? `×${Math.min(4, game.combo)}` : '—'
  element('charge').style.transform = `scaleX(${game.charge / 100})`
  const mobile = innerWidth < 700 || matchMedia('(pointer: coarse)').matches
  element('instruction').innerHTML = game.captured === 0 ? (mobile ? 'Hold <kbd>↶</kbd> to launch your first orbit.' : 'Hold <kbd>←</kbd> to launch your first orbit.') : 'Two suns. One orbit. Four times the light.'
  element('sub-instruction').textContent = game.captured === 0 ? 'Cross your wake to collect it. Keep the sun inside.' : 'Each sun adds 3s. Red bodies and edges cost 5s.'
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
      if (event.type === 'capture') { audio.capture(event.count, event.combo); feedback(`${event.count} SUN${event.count === 1 ? '' : 'S'} CAPTURED  ·  +${event.score} LIGHT  ·  +${event.count * 3}s`); if (navigator.vibrate) navigator.vibrate(18) }
      else if (event.type === 'empty') feedback('EMPTY ORBIT. KEEP A SUN INSIDE.', 1700)
      else if (event.type === 'hit') { audio.hit(); feedback('WAKE LOST  ·  −5s', 1800); if (navigator.vibrate) navigator.vibrate([15, 35, 20]) }
      else if (event.type === 'near') { audio.nearMiss(); feedback('CLOSE PASS  ·  SURGE RECHARGED', 1200) }
      else if (event.type === 'end') { saveBest(); audio.end(); setMode('ended') }
    }
    audio.setMotion(game.ship.speed / game.speed, controls.boost && game.charge > 2)
  }
  renderer.draw(game, now / 1000, mode, reduced.matches)
  if (now - lastUI > 100) { updateUI(); lastUI = now }
  if (!document.hidden) raf = requestAnimationFrame(frame)
}
function resize() {
  renderer.resize(innerWidth, innerHeight)
  if (mode === 'ready') game = new OrbitGame(innerWidth, innerHeight)
  else game.resize(innerWidth, innerHeight)
}
canvas.tabIndex = -1
element('start').addEventListener('click', () => void start(), options)
element('restart').addEventListener('click', () => void start(), options)
element('pause').addEventListener('click', pause, options)
element('resume').addEventListener('click', resume, options)
element('back').addEventListener('click', () => { saveBest(); audio.end(); game = new OrbitGame(innerWidth, innerHeight); setMode('ready'); element('start').focus() }, options)
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
