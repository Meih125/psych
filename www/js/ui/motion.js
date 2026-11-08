/* Shared motion helpers. Anything that counts a number up/down, restarts a CSS animation, or gives the
   "not enough" shake goes through here, so every place animates the same way. */

const easeOut = k => 1 - Math.pow(1 - k, 3);

// Animate a value from a to b over dur ms (ease-out). draw(value, k) runs every frame, k = 0..1; the last frame gets b exactly;
// draw returning false stops it (e.g. its element is gone).
// Without a delay the first frame is drawn at once. Returns stop(), which cancels it.
function tween(a, b, dur, draw, { delay = 0, ease = easeOut, every = 0 } = {}){
  const t0 = performance.now() + delay; let id = 0, last = -1e9, done = false;
  const frame = t => {
    if (done) return;
    const k = dur > 0 ? Math.max(0, Math.min(1, (t - t0) / dur)) : 1;
    if (k >= 1 || !every || t - last >= every){ last = t; if (draw(k >= 1 ? b : a + (b - a) * ease(k), k) === false) return; }   // every: at most one draw per that many ms
    if (k < 1) id = requestAnimationFrame(frame);
  };
  if (delay) id = requestAnimationFrame(frame); else frame(t0);
  return () => { done = true; cancelAnimationFrame(id); };
}

// A number in el counts from `from` to `to` (rounded, formatted with fmt unless show() is given).
function countTo(el, from, to, dur, { show = v => fmt(Math.round(v)), delay = 0, every = 0 } = {}){
  return tween(from, to, dur, v => { el.textContent = show(v); }, { delay, every });
}

// Restart a CSS animation class: remove `drop` (defaults to the classes being added), reflow, add again.
function replay(el, add, drop = add){
  if (!el) return;
  el.classList.remove(...[].concat(drop)); void el.offsetWidth; el.classList.add(...[].concat(add));
}
// Set styles instantly (no transition), e.g. to put a bar back to its start before it animates again.
function jump(els, set){
  els = [].concat(els).filter(Boolean);
  els.forEach(e => { e.style.transition = 'none'; }); set(); if (els[0]) void els[0].offsetWidth; els.forEach(e => { e.style.transition = ''; });
}
// "Not enough" (gold, tickets): the gentle sideways shake every buy / start button uses
const deny = el => replay(el, 'deny');
// a field that needs fixing shakes and takes the focus
function shake(el){ replay(el, 'shake'); if (el) el.focus(); }
