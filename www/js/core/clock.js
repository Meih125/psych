/* One shared 1-second clock, idle detection, and date/time helpers (all in phone time).
   Every repeating job (countdowns, banner, step sync, backup check) runs off this clock, which stops while the app is hidden. */
var TICKS = [], tickN = 0, tickT = 0, BG_PAUSED = false;
function every(sec, fn){ TICKS.push({ sec, fn }); }
function tickRun(){ tickN++; for (const k of TICKS) if (tickN % k.sec === 0){ try { k.fn(); } catch(e){ console.error('tick', e); } } }
// ticks land just after each new second, on the next frame, so countdowns step evenly
function tickStart(){ if (tickT || document.hidden || BG_PAUSED) return; const go = () => { tickT = setTimeout(go, 1000 - (Date.now() % 1000) + 4); requestAnimationFrame(tickRun); }; tickT = setTimeout(go, 1000 - (Date.now() % 1000) + 4); }
function tickStop(){ clearTimeout(tickT); tickT = 0; }
// Lockpick (a timing game) pauses everything outside the Den while a run is on: CSS animations (html.bg-pause), this clock and the sets strip; all resume when the run ends
function bgPause(on){
  on = !!on; if (on === BG_PAUSED) return; BG_PAUSED = on; document.documentElement.classList.toggle('bg-pause', on);
  if (on) tickStop(); else { tickStart(); requestAnimationFrame(tickRun); dispatchEvent(new Event('bgresume')); }
}
// idle: 30 s without input pauses looping glows (html.idle) so the screen can stop redrawing; any input resumes them
var lastInput = Date.now();
function wake(){ lastInput = Date.now(); if (document.documentElement.classList.contains('idle')) document.documentElement.classList.remove('idle'); }
// shared animation speeds (ms) and curves
var MOTION = { fast:200, norm:320, slow:500, arrive:'cubic-bezier(.2,.8,.3,1)', leave:'cubic-bezier(.4,0,.3,1)', move:'cubic-bezier(.5,0,.3,1)', spring:'cubic-bezier(.3,1.4,.5,1)' };
let NOW_AT = 0;   // while replaying a home-screen widget tap: the time it was tapped
const now = () => NOW_AT || Date.now();
const startOfDay = (t = now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const addDays = (t, n) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
const nextMidnight = () => addDays(startOfDay(), 1);
const weekStart = (t = now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime(); };
const nextMonday = () => addDays(weekStart(), 7);
// quest cycles: 1–60 days counted from the claim day; MONTHLY (99) resets on the 1st
const MONTHLY = 99;
const monthStart = (t = now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const addMonths = (t, n) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime(); };   // the 1st, n months on
// biweekly: every second Monday, counted from Monday 1 Jan 2024 so it never drifts
const biStart = (t = now()) => { const w = Math.floor(Math.round((weekStart(t) - new Date(2024, 0, 1).getTime()) / 6048e5)); return addDays(weekStart(t), -7 * (((w % 2) + 2) % 2)); };
const cycleAfter = (from, days) => days === MONTHLY ? addMonths(from, 1) : days === 7 ? addDays(weekStart(from), 7) : days === 14 ? addDays(biStart(from), 14) : addDays(from, days);   // weekly / biweekly follow the calendar (Monday 00:00)
const cycleName = d => d === 1 ? 'Daily' : d === 7 ? 'Weekly' : d === 14 ? 'Biweekly' : d === MONTHLY ? 'Monthly' : `Every ${d} days`;
const pad2 = n => String(n).padStart(2, '0');
const dayKey = (t = now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const dayLabel = t => new Date(t).toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' });
function fmtLeft(ms){
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  if (d) return `${d}d ${h}h ${pad2(m)}m ${pad2(sec)}s`;
  if (h) return `${h}h ${pad2(m)}m ${pad2(sec)}s`;
  return `${m}m ${pad2(sec)}s`;
}

function timeAgo(t){ const m = Math.round((now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; }

function initClock(){
  document.addEventListener('visibilitychange', () => { if (document.hidden) tickStop(); else tickStart(); });
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, wake, { capture:true, passive:true }));
  addEventListener('scroll', wake, { capture:true, passive:true });
  every(1, () => { if (Date.now() - lastInput > 30000) document.documentElement.classList.add('idle'); });
}
