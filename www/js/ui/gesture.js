/* Shared touch gestures. Every swipe, drag and press-and-hold in the app is built from these three, so they all
   work the same way: a finger may wobble a little before anything counts, and the tap that a gesture ends with
   never also presses the thing underneath (`swallow`). */

const isMainPointer = e => e.isPrimary !== false && !(e.pointerType === 'mouse' && e.button !== 0);
// ignore the click that ends a gesture, for `ms` after it (test(e): only clicks this returns true for)
function swallowClick(host, since, test = () => true, ms = 400){
  host.addEventListener('click', e => { if (performance.now() - since() < ms && test(e)){ e.stopPropagation(); e.preventDefault(); } }, true);
}

// Flick: a sideways swipe, judged when the finger lifts.
//  start(e): true to follow this press · min: px sideways needed · ratio: how much more sideways than up/down
//  onSwipe(dir, dx, dy, e): dir -1 = finger moved left, +1 = right · swallow(e): ignore the click right after
//  (untilDown: ignore clicks until the next press instead of for 400 ms, so a quick second swipe or tap still works)
function onFlick(host, { start = () => true, min = 40, ratio = 1.5, onSwipe, swallow = null, mainOnly = false, untilDown = false }){
  let p = null, at = -Infinity;
  host.addEventListener('pointerdown', e => {
    if (e.isPrimary === false) return;   // a second finger doesn't restart the swipe
    if (untilDown) at = -Infinity;
    p = (!mainOnly || isMainPointer(e)) && start(e) ? { x:e.clientX, y:e.clientY } : null; });
  host.addEventListener('pointercancel', () => { p = null; });
  host.addEventListener('pointerup', e => {
    const a = p; p = null; if (!a) return;
    const dx = e.clientX - a.x, dy = e.clientY - a.y;
    if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * ratio) return;
    onSwipe(dx < 0 ? -1 : 1, dx, dy, e); at = performance.now();
  });
  if (swallow) swallowClick(host, () => at, swallow, untilDown ? Infinity : 400);
}

// Drag: follows the finger once it has moved `slop` px.
//  axis 'x': only sideways drags (moving up/down first leaves the page to scroll; abort() is called)
//  axis 'xy': decides x or y from the first movement (state.axis) · axis 'free': no decision
//  start(e) -> state object (or null to ignore) · begin(s) once moving · move(s, dx, dy, e) · end(s, dx, dy, e)
//  cancel(s, e) on pointercancel (defaults to end). s.v = sideways finger speed (px/ms), for flicks.
//  capture: keep the pointer on s.el while dragging · swallow(e): ignore the click after a drag
function onDrag(host, { start, axis = 'x', slop = 8, capture = false, begin, move, end, cancel, abort, swallow = null, swallowMs = 400 }){
  let s = null, at = -1e9;
  host.addEventListener('pointerdown', e => {
    const st = start(e); if (!st) return;
    s = Object.assign(st, { x:e.clientX, y:e.clientY, axis: axis === 'free' ? 'free' : null, id:e.pointerId });
    if (axis === 'free'){ if (capture && s.el) try { s.el.setPointerCapture(s.id); } catch(_){} if (begin) begin(s); }
  });
  host.addEventListener('pointermove', e => {
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.axis){
      if (axis === 'x'){ if (Math.abs(dx) < slop) return; if (Math.abs(dy) > Math.abs(dx)){ const a = s; s = null; if (abort) abort(a); return; } s.axis = 'x'; }
      else { if (Math.hypot(dx, dy) < slop) return; s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; }
      if (capture && s.el) try { s.el.setPointerCapture(s.id); } catch(_){}
      if (begin) begin(s);
    }
    const t = performance.now(); s.v = (e.clientX - (s.lx ?? s.x)) / Math.max(1, t - (s.lt || t - 16)); s.lx = e.clientX; s.lt = t;
    move(s, dx, dy, e);
  });
  const finish = (e, cancelled) => {
    const st = s; s = null; if (!st) return;
    if (!st.axis){ if (abort) abort(st); return; }
    at = performance.now();
    (cancelled && cancel ? cancel : end)(st, e.clientX - st.x, e.clientY - st.y, e);
  };
  host.addEventListener('pointerup', e => finish(e, false));
  host.addEventListener('pointercancel', e => finish(e, true));
  if (swallow) swallowClick(host, () => at, swallow, swallowMs);
}

// Press and hold: onHold(el, e, x, y) after `ms` without moving more than `slop` px (a finger always wobbles a little);
// x, y = where the finger is when it fires. ms may be a function of the pointerdown event.
//  start(e) -> the element being held, or null · release(el, held, e): the finger lifted (held = the hold fired)
//  swallow: ignore the click right after a hold · target: where moves / lifts are listened for (default host)
function onHold(host, { start, ms = 500, slop = 12, onHold: fire, release, swallow = true, leave = false, noMenu = null, target = host }){
  let timer = 0, el = null, x = 0, y = 0, lx = 0, ly = 0, fired = false, at = -1e9;
  host.addEventListener('pointerdown', e => {
    if (e.isPrimary === false) return;   // a second finger doesn't restart the hold
    const t = start(e); clearTimeout(timer); el = t || null; fired = false; if (!t) return;
    x = lx = e.clientX; y = ly = e.clientY;
    timer = setTimeout(() => { fired = true; at = performance.now(); fire(t, e, lx, ly); }, typeof ms === 'function' ? ms(e) : ms);
  });
  target.addEventListener('pointermove', e => { if (!el || fired) return; lx = e.clientX; ly = e.clientY; if (Math.hypot(lx - x, ly - y) > slop){ clearTimeout(timer); el = null; } }, { passive:true });
  const up = e => { clearTimeout(timer); if (!el) return; const t = el; el = null; if (fired) at = performance.now(); if (release) release(t, fired, e); };
  ['pointerup', 'pointercancel'].concat(leave ? ['pointerleave'] : []).forEach(n => target.addEventListener(n, up));
  if (noMenu) host.addEventListener('contextmenu', e => { if (noMenu(e)) e.preventDefault(); });
  if (swallow) swallowClick(host, () => at, typeof swallow === 'function' ? swallow : () => true, 500);
}
