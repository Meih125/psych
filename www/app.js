/* Psych app logic. Plain script (no build step). The app draws once, at the very bottom, after everything is defined. */
/* ================= Settings you can tweak ================= */
// XP needed to go from level L to L+1: starts at 100 and rises 25 per level.
// The step into every 10th level is a rank promotion trial: it costs 1.5× (8→9 = 275, 9→10 = 450, 10→11 = 325).
const isBossStep = L => L % 10 === 9;
const XP_CAP = 1e9, GOLD_CAP = 1e12, REWARD_CAP = 1e6, VALUE_CAP = 1e7;
const xpToNext = L => { const base = 100 + 25 * (L - 1); return isBossStep(L) ? Math.round(base * 1.5 / 5) * 5 : base; };
// gold for reaching level L: 10 × its place in the band of 10, +5 per band;
// every 10th level pays 150, +50 per band (Lv 10 = 150, Lv 20 = 200, Lv 30 = 250 …)
function levelReward(L){
  if (L < 2) return 0;
  const band = Math.floor((L - 1) / 10), k = L - band * 10;
  return k === 10 ? 150 + 50 * band : 10 * k + 5 * band;
}
const BORDER_SWIRL = true;                   // light racing around a quest's border when you claim it (false = off)
const STORE_KEY = 'psych.v1';
const TABS = ['quests','progress','inventory','collection','shop'];
const KIND_HELP = {
  standard:'Claim once per cycle. It resets at midnight after the number of days you pick.',
  pair:'Two quests that share one cycle. Each pays its own reward, and doing both in the same cycle pays a bonus.',
  scaling:'Claim as often as you like. Each extra claim in the same period pays more. Rewards drop back to the base when the period resets.',
  record:'Log a number, like your weight. The first entry sets your starting point. You earn a reward for each step you beat your best by.',
  tally:'Whenever it happens, type the amount and claim, like a paycheque or pages read. No daily reset. Anything below the reward step carries over to next time.',
  target:'Hit it a number of times before its timer runs out, like the gym 5 times a week. Each tap lights one; claim when they are all lit.',
  bounty:'A one-off task with a due date. It jumps to the top in red when it is 2 days away, and disappears once claimed.',
  avoid:'For a habit you are quitting. Claim each day you stayed clean; Slipped starts the count over (your best is kept).',
  steps:'Tracks your daily steps from your phone’s step counter (connect it in Settings). Each day’s reward waits for you to claim it, so walking past midnight is never lost.'
};

/* ================= Time ================= */
const now = () => Date.now();
const startOfDay = (t = now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const addDays = (t, n) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
const nextMidnight = () => addDays(startOfDay(), 1);
const weekStart = (t = now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime(); };
const nextMonday = () => addDays(weekStart(), 7);
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

/* ================= Data ================= */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function starterData(){
  const t = now();
  const std = (name, xp, gold, days = 1) => ({ id:uid(), kind:'standard', name, note:'', xp, gold, days, parent:null, doneUntil:0, count:0, undo:null, showCount:true, created:t });
  const scale = std('Step on the scale', 10, 5, 3);
  return { xp:0, gold:0, tab:'quests', steps:{}, sync:{ connected:false, last:0 }, quests:[
    std('Drink 8 glasses of water', 10, 5),  // everyday habits start untracked
    std('Read for 20 minutes', 10, 5),
    std('Make your bed', 5, 3),
    { id:uid(), kind:'steps', name:'Daily Steps', note:'', chunk:100, xpPer:1, goldPer:1, goal:10000, showDays:3, paid:{}, created:t },
    { id:uid(), kind:'pair', name:'Study & Review', note:'Do both in the same day for a bonus', days:1, cycleEnd:0, created:t, showCount:true, tracked:true,
      a:{ name:'Study for 1 hour', xp:10, gold:5, count:0, until:0, undo:null },
      b:{ name:'Review your notes', xp:10, gold:5, count:0, until:0, undo:null },
      bonus:{ xp:15, gold:15 }, bonusCount:0, bonusUntil:0 },
    { id:uid(), kind:'scaling', name:'Go to the gym', note:'', xp:10, gold:10, growth:50, week:0, weekClaims:0, count:0, showCount:true, tracked:true, created:t },
    scale,
    { id:uid(), kind:'record', name:'Record your weight', note:'', unit:'kg', better:'lower', step:1, xpPer:10, goldPer:10,
      parent:scale.id, days:1, entries:[], start:null, best:null, paidTo:null, doneUntil:0, count:0, undo:null, showCount:false, created:t },
  ]};
}
let S;
function load(){
  try { const raw = localStorage.getItem(STORE_KEY); S = raw ? JSON.parse(raw) : starterData(); }
  catch(e){ S = starterData(); }
  normalize();
}
// fill in anything missing (older saves, backups)
function normalize(){
  if (!S || typeof S !== 'object' || !Array.isArray(S.quests)) S = starterData();
  sanitizeState();
  if (!S.steps) S.steps = {};
  if (!S.sync) S.sync = { connected:false, last:0 };
  if (!S.inv) S.inv = {};
  if (!S.pity) S.pity = {};
  if (!S.cards) S.cards = {};      // card id -> how many owned
  if (!S.cardsGot) S.cardsGot = {};   // card id -> how many ever collected (set claims take copies away, this never goes down)
  if (!S.scenes) S.scenes = {};
  if (!S.setClaims) S.setClaims = {};
  if (!S.opened) S.opened = {};   // item id -> how many decks opened, ever   // set name -> true once its completion reward is claimed    // scene id -> true once unlocked
  if (!S.rewardedLevel) S.rewardedLevel = levelInfo(S.xp).L;   // levels already reached before rewards existed
  if (!TABS.includes(S.tab)) S.tab = 'quests';
  S.quests.forEach(q => {                       // fill in fields added in newer versions
    if (q.kind === 'record'){ if (!q.step) q.step = 1; if (q.paidTo === undefined) q.paidTo = q.best; }
    if (isTracker(q) && !q.paid) q.paid = {};
    if (isTracker(q)){ if (q.goalXp == null) q.goalXp = GOAL_BONUS; if (q.goalGold == null) q.goalGold = GOAL_BONUS; q.goalPaid ||= {}; }
    if (q.kind === 'tally'){ q.log ||= []; q.carry ||= 0; q.total ||= 0; q.count ||= 0; }
    if (q.kind === 'target'){ q.need ||= 5; q.hits ||= 0; q.log ||= []; q.days ||= 7; }
    if (q.kind === 'bounty'){ q.due ||= startOfDay(); q.log ||= []; }
    if (q.kind === 'avoid'){ q.since ||= startOfDay(); q.slips ||= []; q.log ||= []; q.days = 1; }
    if (q.kind === 'pair'){ q.a.log = q.a.log || []; q.b.log = q.b.log || []; q.bonusLog = q.bonusLog || []; }
    else if (q.kind === 'standard' || q.kind === 'scaling') q.log = q.log || [];
  });
}
// Repairs a save or backup so nothing in it can crash or freeze the app:
// numbers finite and in range, known quest kinds only, unique ids, no parent loops.
function sanitizeState(){
  const KINDS = ['standard','pair','scaling','record','tally','steps','target','bounty','avoid'];
  const fin = (v, d = 0, lo = -Infinity, hi = Infinity) => { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  S.xp = fin(S.xp, 0, 0, XP_CAP); S.gold = fin(S.gold, 0, -GOLD_CAP, GOLD_CAP);
  ['steps','sync','inv','pity','cards','cardsGot','scenes','setClaims','opened','progHide','today'].forEach(k => { if (k in S && !obj(S[k])) delete S[k]; });
  ['inv','pity','cards','cardsGot','opened'].forEach(k => { if (obj(S[k])) for (const id in S[k]) S[k][id] = Math.round(fin(S[k][id], 0, 0, 1e6)); });
  const seen = new Set();
  S.quests = S.quests.filter(q => obj(q) && KINDS.includes(q.kind)).filter(q => {
    if (typeof q.id !== 'string' || !q.id || seen.has(q.id)) q.id = uid();
    seen.add(q.id); return true;
  });
  if (S.quests.filter(q => q.kind === 'steps').length > 1){ let one = false; S.quests = S.quests.filter(q => q.kind !== 'steps' || (!one && (one = true))); }
  S.quests.forEach(q => {
    q.name = typeof q.name === 'string' && q.name.trim() ? q.name.slice(0, 80) : 'Quest';
    if (q.note != null && typeof q.note !== 'string') q.note = '';
    ['xp','gold','xpPer','goldPer','goalXp','goalGold'].forEach(k => { if (k in q) q[k] = Math.round(fin(q[k], 0, 0, 9999)); });
    if ('growth' in q) q.growth = fin(q.growth, 0, 0, 500);
    if ('days' in q) q.days = Math.round(fin(q.days, 1, 1, 60));
    if ('period' in q) q.period = Math.round(fin(q.period, 7, 1, 60));
    if ('need' in q) q.need = Math.round(fin(q.need, 5, 1, 999));
    if ('hits' in q) q.hits = Math.round(fin(q.hits, 0, 0, 1e6));
    if ('step' in q) q.step = fin(q.step, 1, 0.01, VALUE_CAP);
    if ('chunk' in q) q.chunk = fin(q.chunk, 1, 0.01, VALUE_CAP);
    if ('goal' in q) q.goal = fin(q.goal, 0, 0, 200000);
    ['count','weekClaims','carry','total'].forEach(k => { if (k in q) q[k] = fin(q[k], 0, 0, 1e12); });
    ['doneUntil','due','since','cycleEnd','week','created'].forEach(k => { if (k in q) q[k] = fin(q[k], 0, 0, 9e15); });
    ['log','entries','slips','bonusLog'].forEach(k => { if (k in q && !Array.isArray(q[k])) q[k] = []; });
    if (Array.isArray(q.entries)) q.entries = q.entries.filter(e => obj(e) && isFinite(+e.v)).map(e => ({ ...e, v:fin(e.v, 0, -VALUE_CAP, VALUE_CAP) }));
    ['best','paidTo','start'].forEach(k => { if (q[k] != null && !isFinite(+q[k])) q[k] = null; });
    if (q.kind === 'pair') ['a','b'].forEach(h => { if (!obj(q[h])) q[h] = { name:h === 'a' ? 'Quest A' : 'Quest B', xp:0, gold:0, log:[] }; q[h].name = typeof q[h].name === 'string' ? q[h].name.slice(0, 80) : ''; q[h].xp = Math.round(fin(q[h].xp, 0, 0, 9999)); q[h].gold = Math.round(fin(q[h].gold, 0, 0, 9999)); });
    if (q.kind === 'pair' && !obj(q.bonus)) q.bonus = { xp:0, gold:0 };
    if (q.parent != null && (typeof q.parent !== 'string' || q.parent === q.id || !seen.has(q.parent))) q.parent = null;
  });
  // break parent loops (A under B under A)
  const byIdMap = new Map(S.quests.map(q => [q.id, q]));
  S.quests.forEach(q => { const path = new Set([q.id]); let p = q.parent && byIdMap.get(q.parent);
    while (p){ if (path.has(p.id)){ q.parent = null; break; } path.add(p.id); p = p.parent && byIdMap.get(p.parent); } });
}
// every claim is logged so the Progress tab can show history
function logClaim(arr, xp, gold){ arr.push({ t:now(), xp, gold }); if (arr.length > 4000) arr.shift(); }
function save(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch(e){} }

/* ================= Quest logic ================= */
const byId = id => S.quests.find(q => q.id === id);
const parentOf = q => (q.parent ? byId(q.parent) : null);
// only tracked quests get a history page in Progress (records are tracked unless turned off)
// every quest has a Progress page; the list button on the Progress tab can hide some from the chip row
const isTracked = q => q.kind === 'steps' || !(S.progHide && S.progHide[q.id]);
const showsCount = q => !isTracker(q) && q.kind !== 'tally' && q.showCount !== false;
function isDone(q){
  const t = now();
  if (q.kind === 'pair') return q.a.until > t && q.b.until > t;
  if (q.kind === 'scaling' || isTracker(q)) return false;
  return q.doneUntil > t;
}
// Target: its own countdown (Resets every N days). A new cycle starts when the old one runs out.
function targetRoll(q){
  if (q.kind !== 'target') return;
  if (!q.cycleEnd || now() >= q.cycleEnd){ q.cycleEnd = addDays(startOfDay(), q.days || 1); q.hits = 0; }
}
// Avoid: whole days clean since the start (the start day counts once it has passed)
const daysClean = q => q.since ? Math.max(0, Math.round((startOfDay() - q.since) / 864e5)) : 0;
const slippedToday = q => q.kind === 'avoid' && q.slipDay === dayKey();
// Bounty: days until it's due (0 = today, negative = overdue); urgent from 1 day before
const dueIn = q => Math.round((q.due - startOfDay()) / 864e5);
const bountyUrgent = q => q.kind === 'bounty' && !isDone(q) && dueIn(q) <= 1;
function isVisible(q, d = 0){ const p = parentOf(q); return !p || d > 50 || (isVisible(p, d + 1) && isDone(p)); }
function cycleEndFor(q){ if (q.kind === 'target'){ targetRoll(q); return q.cycleEnd; } const p = parentOf(q); return p ? p.doneUntil : addDays(startOfDay(), q.days || 1); }
// Recurring quests reset every q.period days (7 = Monday to Monday, the original behaviour)
const periodOf = q => q.period || 7;
function periodStart(q){
  if (periodOf(q) === 7) return weekStart();
  return q.week && now() < addDays(q.week, periodOf(q)) ? q.week : startOfDay();
}
const periodEnd = q => periodOf(q) === 7 ? nextMonday() : addDays(periodStart(q), periodOf(q));
const periodWord = q => periodOf(q) === 7 ? 'week' : periodOf(q) === 1 ? 'day' : `${periodOf(q)} days`;
const weekClaims = q => (q.week === periodStart(q) ? q.weekClaims : 0);
function scaledReward(q, n){ const f = Math.pow(1 + (q.growth || 0) / 100, Math.max(0, n - 1)); return { xp:Math.min(REWARD_CAP, Math.round(q.xp * f)) || 0, gold:Math.min(REWARD_CAP, Math.round(q.gold * f)) || 0 }; }
const round2 = v => Math.round(v * 100) / 100;
// Trackers (Steps and Tally) share one engine. Steps reads the synced step counts;
// a Tally keeps its own numbers that you type in (money, pages, pushups...).
const isTracker = q => q.kind === 'steps';
var GOAL_BONUS = 20;   // default XP and gold for reaching the daily step goal
const valsOf = q => (q.kind === 'tally' ? (q.vals ||= {}) : S.steps);
const unitOf = q => (q.kind === 'tally' ? (q.unit || '') : 'steps');
const CURRENCY = ['$','€','£','¥','₫','₩','₹'];
function fmtU(q, v){
  const u = unitOf(q);
  if (CURRENCY.includes(u)) return u + Number(v).toLocaleString(undefined, { minimumFractionDigits:v % 1 ? 2 : 0, maximumFractionDigits:2 });
  return `${fmt(v)}${u ? ' ' + u : ''}`;
}
// what is still owed for one day
function stepDue(q, key){
  const steps = valsOf(q)[key] || 0, paid = q.paid[key] || 0;
  const units = Math.max(0, Math.floor(steps / q.chunk) - Math.floor(paid / q.chunk));
  const total = Math.floor(steps / q.chunk);
  return { steps, paid, units, xp:units * q.xpPer, gold:units * q.goldPer, totalXp:total * q.xpPer, totalGold:total * q.goldPer };
}
/* ---- Step sync ----
   In the browser there is no step counter. In the phone app (APK), a native plugin reads
   steps from Health Connect (which Samsung Health shares with) and hands them to
   window.psychReceiveSteps({ 'YYYY-MM-DD': steps, ... }). Nothing else needs to change. */
const native = () => window.PsychNative || null;   // provided by the phone app later
function timeAgo(t){ const m = Math.round((now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; }
function syncLine(){
  if (S.sync && S.sync.connected) return `<i class="on"></i>Synced from Health Connect · ${S.sync.last ? timeAgo(S.sync.last) : 'waiting'}`;
  return '<i></i>Step sync is off · tap to set up';
}
window.psychReceiveSteps = (days, dist) => {
  Object.entries(days || {}).forEach(([k, v]) => { const n = Math.max(0, Math.round(+v || 0)); if (n) S.steps[k] = n; });
  // walking distance per day in metres, measured by the phone (Health Connect)
  if (dist){ S.dist ||= {}; Object.entries(dist).forEach(([k, v]) => { const m = Math.max(0, +v || 0); if (m) S.dist[k] = Math.round(m); }); }
  S.sync = { ...(S.sync || {}), connected:true, last:now() };
  save(); render();
};
let syncing = false;
async function syncNow(quiet){
  const n = native(); if (!n || !n.syncSteps || syncing) return;
  syncing = true;
  try { await n.syncSteps(); }
  catch(e){ if (!quiet) showToast('Couldn’t read steps from Health Connect', false); }
  finally { syncing = false; }
}
// sync when the app opens or comes back to the front (at most once a minute), and every 5 minutes while open
// next to "Steps" on the Quests summary: when Health Connect last shared steps (amber after 3 hours)
function stepsSyncTag(){
  if (!S.sync || !S.sync.connected) return ' <small class="sync-tag off">· sync off</small>';
  const t = S.sync.last;
  return ` <small class="sync-tag${!t || now() - t > 3 * 3600e3 ? ' late' : ''}">· ${t ? 'synced ' + timeAgo(t) : 'not synced yet'}</small>`;
}
function autoSync(){ if (S.sync && S.sync.connected && now() - (S.sync.last || 0) > 60000) syncNow(true); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) autoSync(); });
setInterval(autoSync, 300000);
const firstSteps = () => S.quests.find(q => q.kind === 'steps');
const trackers = () => S.quests.filter(isTracker);
function stepsWindowDue(q){
  let n = 0;
  for (let i = 0; i <= q.showDays; i++) if (stepDue(q, dayKey(addDays(startOfDay(), -i))).units) n++;
  return n;
}
function allStepsDue(q){ return Object.keys(valsOf(q)).filter(k => stepDue(q, k).units > 0).length; }

/* ================= Helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toLocaleString(undefined, { maximumFractionDigits:2 });
const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch(e){} };
function levelInfo(total){ let L = 1, r = Math.min(XP_CAP, Math.max(0, +total || 0)); while (r >= xpToNext(L)) { r -= xpToNext(L); L++; } return { L, into:r, need:xpToNext(L) }; }
const CORNERS = ['tl','tr','bl','br'].map(c => `<svg class="cn ${c}" viewBox="0 0 40 40"><use href="#i-corner"/></svg>`).join('');
const ico = (id, vb = '0 0 32 32') => `<svg viewBox="${vb}"><use href="#${id}"/></svg>`;
// "+1 💎 +1 🪙 per $10" using the gem and coin icons instead of words
function rateHtml(q){
  return `<span class="xp-r">${ico('i-gem')}+${fmt(q.xpPer)}</span> <span class="gold-r">${ico('i-coin')}+${fmt(q.goldPer)}</span> per ${fmtU(q, q.chunk)}`;
}
// rewards over 1000 are shortened (5,120 → 5.1k) so the reward column stays narrow
const rewNum = v => cyNum(v);
function rewardsHtml(xp, gold, extra = ''){
  return `<div class="rewards">${extra}<span class="xp-r">${ico('i-gem')}+${rewNum(xp)}</span><span class="gold-r">${ico('i-coin')}+${rewNum(gold)}</span></div>`;
}
const cd = (until, pre = '', post = '') => `<span class="cd" data-until="${until}" data-pre="${esc(pre)}" data-post="${esc(post)}">${esc(pre)}${fmtLeft(until - now())}${esc(post)}</span>`;
const metaLine = inner => `<div class="meta"><span class="groove">${ico('i-hourglass','0 0 16 16')}${inner}</span></div>`;
function etch(q){
  if (!showsCount(q)) return '';
  const c = fmt(q.count);
  return `<div class="etch"><b class="${c.length > 3 ? 'sm' : ''}">${c}</b><small>${q.count === 1 ? 'TIME' : 'TIMES'}</small></div>`;
}
const daysTag = d => `<span class="tag${d === 1 ? ' gold' : d === 2 ? ' green' : d === 3 ? ' violet' : d === 7 ? ' steel' : ''}">${d === 1 ? 'Daily' : d === 7 ? 'Weekly' : d + '-day'}</span>`;
function kindTag(q){
  if (q.kind === 'pair') return '<span class="tag red">Pair</span>';
  if (q.kind === 'scaling') return '<span class="tag crimson">Recurring</span>';
  if (q.kind === 'steps') return '<span class="tag steel">Tracker</span>';
  if (q.kind === 'tally') return '<span class="tag orange">Tally</span>';
  if (q.kind === 'record') return (q.parent ? '<span class="tag red">Follow-up</span>' : '') + '<span class="tag rose">Record</span>';
  if (q.parent) return '<span class="tag red">Follow-up</span>';
  return daysTag(q.days);
}

/* ================= Rank emblems =================
   The whole emblem changes every 10 levels: more swords, wings, wreath, axes and crown,
   banners, a dragon coiled round the shield, flames, scythes, and a halo for Legend. */
const RANKS = ['Rookie','Runner','Netrunner','Operator','Specialist','Enforcer','Ghost','Phantom','Overclock','Singularity','Legend',
  'Mythic','Ascendant','Eternal','Celestial','Transcendent','Paragon','Apex','Divine','Infinite','Omega'];   // a new rank every 10 levels, Omega at 200+
// a new rank every 10 levels, reached by the promotion step: Recruit 1–9, Squire 10–19 … Legend 100+
const tierOf = L => Math.min(RANKS.length - 1, Math.floor(L / 10));
const rankRange = t => t === RANKS.length - 1 ? `Lv ${t * 10}+` : `Lv ${Math.max(1, t * 10)}–${t * 10 + 9}`;
function star(n, R, r, cx = 30, cy = 40, rot = -90){
  let d = '';
  for (let i = 0; i < n * 2; i++){
    const a = (rot + i * 180 / n) * Math.PI / 180, rad = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + (cx + rad * Math.cos(a)).toFixed(2) + ' ' + (cy + rad * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}
const ring = r => `<circle cx="30" cy="40" r="${r}" fill="none" stroke="#000" stroke-width="3.4" opacity=".85"/><circle cx="30" cy="40" r="${r}" fill="none" stroke="url(#gMark)" stroke-width="1.5"/>`;
const dot = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#gMark)" stroke="#000" stroke-width=".8"/>`;
// triquetra-style knot: three lens shapes woven through each other
function knot(){
  const P = [-90, 30, 150].map(a => [30 + 9.8 * Math.cos(a * Math.PI / 180), 41 + 9.8 * Math.sin(a * Math.PI / 180)]);
  const R = 13.5, f = v => v.toFixed(2);
  return [[0, 1], [1, 2], [2, 0]].map(([i, j]) => `M${f(P[i][0])} ${f(P[i][1])}A${R} ${R} 0 0 1 ${f(P[j][0])} ${f(P[j][1])}A${R} ${R} 0 0 1 ${f(P[i][0])} ${f(P[i][1])}`).join('');
}
const mirror = s => `<g transform="translate(80 0) scale(-1 1)">${s}</g>`;
function wing(fill){
  const w = `<path d="M24 46C13 42 5 32 2 13c5 6 10 9 15 10.5C11 18 9 13 8.5 6c5.5 7.5 11 11.5 16.5 13.5C21.5 15 20.5 10.5 21 5c4 8 7.5 14 9 22z" fill="${fill}" stroke="#0a0a0a" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M23 40C15 36 10 28 7.5 20M24 33c-4-3-8-7-10-12M26 27c-2-3-4-6-5-10" fill="none" stroke="rgba(0,0,0,.45)" stroke-width=".7"/>`;
  return w + mirror(w);
}
const crown = `<path d="M28 23h24l2.6-12.5-7.3 5.2L40 6.5l-7.3 9.2-7.3-5.2z" fill="url(#gBronze)" stroke="#120a05" stroke-width="1" stroke-linejoin="round"/>
  <path d="M28 23h24v2.6H28z" fill="#3c4e4c" stroke="#120a05" stroke-width=".8"/>
  <circle cx="40" cy="18" r="1.7" fill="#ff3b30"/><circle cx="25.4" cy="10.5" r="1.4" fill="url(#gBronze)"/><circle cx="54.6" cy="10.5" r="1.4" fill="url(#gBronze)"/><circle cx="40" cy="6.5" r="1.5" fill="url(#gBronze)"/>`;
const banners = `<path d="M19 72V5M61 72V5" stroke="#2a1a10" stroke-width="2.2"/>
  <circle cx="19" cy="4.5" r="1.8" fill="url(#gBronze)"/><circle cx="61" cy="4.5" r="1.8" fill="url(#gBronze)"/>
  <path d="M19 7H4.5l4.5 6-4.5 6H19z" fill="#5e1812" stroke="#000" stroke-width=".7"/><path d="M61 7h14.5l-4.5 6 4.5 6H61z" fill="#5e1812" stroke="#000" stroke-width=".7"/>
  <path d="M8 13h9M72 13h-9" stroke="#ff8a40" stroke-width=".8" opacity=".7"/>`;
const flames = () => [[18, 26], [28, 38], [40, 46], [52, 38], [62, 26]].map(([x, h]) => {
  const b = 62, w = h * 0.3;
  return `<path d="M${x} ${b}C${x - w} ${b - h * .35} ${x - w * .3} ${b - h * .7} ${x} ${b - h}C${x + w * .5} ${b - h * .65} ${x + w} ${b - h * .4} ${x} ${b}z" fill="url(#gFlame)" opacity=".95"/>`;
}).join('');
const halo = () => { let s = ''; for (let i = 0; i < 24; i++){ const a = i * 15 * Math.PI / 180, r1 = 31, r2 = i % 2 ? 39 : 45;
  s += `<path d="M${(40 + r1 * Math.cos(a)).toFixed(1)} ${(46 + r1 * Math.sin(a)).toFixed(1)}L${(40 + r2 * Math.cos(a)).toFixed(1)} ${(46 + r2 * Math.sin(a)).toFixed(1)}" stroke="#e6c88e" stroke-width="${i % 2 ? 1 : 1.6}" opacity=".55" stroke-linecap="round"/>`; }
  return `<circle cx="40" cy="46" r="34" fill="none" stroke="#e6c88e" stroke-width=".8" opacity=".4"/>` + s; };
const dragon = `<g>
  <path d="M22 23C8 33 6 62 20 76C30 87 50 87 60 76C74 62 72 35 62 25" fill="none" stroke="#000" stroke-width="8" stroke-linecap="round"/>
  <path d="M22 23C8 33 6 62 20 76C30 87 50 87 60 76C74 62 72 35 62 25" fill="none" stroke="url(#gDragon)" stroke-width="5.6" stroke-linecap="round"/>
  <path d="M22 23C8 33 6 62 20 76C30 87 50 87 60 76C74 62 72 35 62 25" fill="none" stroke="#ff8a40" stroke-width="1.4" stroke-dasharray="1 3.2" opacity=".75"/>
  <path d="M22 23L15 13.5l9.5 5.5z" fill="url(#gDragon)" stroke="#000" stroke-width=".8"/>
  <path d="M59 28L50 17.5l8.4.6 3.4-8.6 3.6 8.4 6 4.6-6.4 3.4z" fill="url(#gDragon)" stroke="#000" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M61.8 9.5l-2.4-4.5M65.4 18l4-3.6" stroke="#ff8a40" stroke-width="1.1" stroke-linecap="round"/>
  <circle cx="61" cy="19.5" r="1.3" fill="#ff6b1a"/></g>`;
// Cyber emblem: a neon hex badge. Every 10 levels it changes colour, gains a new core mark,
// then side fins, an outer ring and finally a crown.
const TIER_COL = ['#8fd9cf','#4fb3c8','#3b82d6','#6d7ff0','#ffd27a','#ffb44a','#ff8a40','#ff6b1a','#ff4d2a','#ff3b30','#ffd84a',
  '#ff5fa2','#d46bff','#9a7dff','#6fd3ff','#5ff0c8','#b8ff6a','#fff07a','#ffffff','#ff7ae0','#ffffff'];
// second colour for ranks past Legend (two-tone parts: crown, wings, outer ring)
const TIER_COL2 = [,,,,,,,,,,,'#ffd84a','#ff5fa2','#6fd3ff','#ffffff','#6fd3ff','#ffd84a','#ff6b1a','#ffd84a','#6fd3ff','#ffd84a'];
const hexPts = (cx, cy, r) => Array.from({ length:6 }, (_, i) => { const a = (-90 + i * 60) * Math.PI / 180; return (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2); }).join(' ');
function renderRanks(){
  if (!$('#ranks')) return;
  const cur = tierOf(levelInfo(S.xp).L);
  $('#ranks').innerHTML = RANKS.map((name, t) => `<div class="rank${t === cur ? ' cur' : ''}${t > cur ? ' locked' : ''}">
    <div class="rank-ico">${emblem(Math.max(1, t * 10))}</div><b>${name}</b><span>${rankRange(t)}</span></div>`).join('');
}

/* ================= Cards ================= */

/* ---- Steps tracker ---- */
function stepAction(q, key){
  const d = stepDue(q, key);
  if (d.units) return `<button class="claim" data-act="claimday" data-q="${q.id}" data-day="${key}">Claim</button>`;
  if (d.paid) return '<span class="claimed">Claimed</span>';
  return '';   // nothing to claim yet: the Claim button appears here once there is
}
function stepReward(q, key){
  const d = stepDue(q, key);
  return d.units ? rewardsHtml(d.xp, d.gold) : rewardsHtml(d.totalXp, d.totalGold).replace('class="rewards"', 'class="rewards" style="opacity:.55"');
}
function todayParts(q){
  const key = dayKey(), d = stepDue(q, key), pct = q.goal ? Math.min(100, d.steps / q.goal * 100) : 0;
  return { key, d, pct, goalText:q.goal ? `${fmt(d.steps)} / ${fmtU(q, q.goal)}` : fmtU(q, d.steps) };
}
function stepRow(q, t, label){
  const key = dayKey(t), d = stepDue(q, key);
  // a Tally's past days can be edited (tap the amount), so a late entry still counts
  const amount = q.kind === 'tally'
    ? `<button class="st-n st-edit" data-act="editday" data-q="${q.id}" data-day="${key}">${fmtU(q, d.steps)} <span>✎</span></button>`
    : `<div class="st-n">${fmtU(q, d.steps)}</div>`;
  return `<div class="st-row${d.units ? '' : ' dim'}">
    <div class="st-l"><div class="st-date">${label || dayLabel(t)}</div><div class="st-line">${amount}${stepReward(q, key)}</div></div>
    ${stepAction(q, key)}
  </div>`;
}
function stepsCard(q){
  const tp = todayParts(q);
  const rows = []; for (let i = 1; i <= q.showDays; i++) rows.push(stepRow(q, addDays(startOfDay(), -i)));
  return `<article class="card steps-card" data-q="${q.id}">${CORNERS}
    <div class="st-head q-main" data-act="edit">
      <div class="q-top"><h3>${esc(q.name)}</h3>${kindTag(q)}<span class="st-rate">${rateHtml(q)}</span></div>
    </div>
    <div class="st-today">
      <div class="st-top"><span class="st-date">Today</span><span class="st-goal">${tp.goalText}</span></div>
      <div class="st-bar${tp.pct >= 100 ? ' met' : ''}"><div style="width:${tp.pct}%"></div></div>
      ${q.kind === 'tally'
        ? `<div class="st-input"><input type="number" min="0" step="any" inputmode="decimal" value="${tp.d.steps || ''}" placeholder="Add today's ${esc(unitOf(q) || 'amount')}" data-stepinput="${q.id}" aria-label="Today's amount">${CURRENCY.includes(unitOf(q)) ? '' : `<span class="unit">${esc(unitOf(q))}</span>`}</div>`
        : `<button class="st-sync" data-act="opensettings">${syncLine()}</button>`}
      <div class="st-foot"><span class="st-rew">${stepReward(q, tp.key)}</span>${metaLine(cd(nextMidnight(), 'Reset: '))}<span class="st-act">${stepAction(q, tp.key)}</span></div>
    </div>
    ${rows.length ? `<div class="st-rows">${rows.join('')}</div>` : ''}
    <button class="more" data-act="progress">Show more</button>
  </article>`;
}
function updateTodayParts(card, q){
  const tp = todayParts(q);
  card.querySelector('.st-goal').textContent = tp.goalText;
  const bar = card.querySelector('.st-bar'); bar.classList.toggle('met', tp.pct >= 100); bar.firstElementChild.style.width = tp.pct + '%';
  card.querySelector('.st-rew').innerHTML = stepReward(q, tp.key);
  card.querySelector('.st-act').innerHTML = stepAction(q, tp.key);
}

/* ---- Tally: type an amount whenever it happens, claim the reward ----
   Rewards come in steps (e.g. every $10). Whatever is left over carries to the next entry. */
function tallyPreview(q, typed){
  const v = Math.min(VALUE_CAP, Math.max(0, round2(parseFloat(typed) || 0))), pool = round2((q.carry || 0) + v);
  const units = Math.floor(pool / q.chunk + 1e-9), left = round2(pool - units * q.chunk);
  return { v, units, xp:units * q.xpPer, gold:units * q.goldPer, left };
}
function tallyNote(q, pv){
  if (pv.v && !pv.units) return `${fmtU(q, round2(q.chunk - pv.left))} more for the first reward`;
  if (pv.v) return pv.left ? `${fmtU(q, pv.left)} will carry over to next time` : '';
  return q.carry ? `${fmtU(q, q.carry)} carried over from last time` : '';
}
function tallyCard(q){
  const pv = tallyPreview(q, ''), last = (q.log || []).length ? q.log[q.log.length - 1] : null;
  return `<article class="card tally-card">${CORNERS}
    <div class="q-main tl-head" data-act="edit">
      <div class="q-top"><h3>${esc(q.name)}</h3>${kindTag(q)}<span class="st-rate">${rateHtml(q)}</span></div>
      <div class="tl-total" title="${last ? `Last ${fmtU(q, last.v || 0)} on ${new Date(last.t).toLocaleDateString(undefined, { month:'short', day:'numeric' })}` : ''}">Total <b>${fmtU(q, q.total || 0)}</b></div>
    </div>
    <div class="tl-row">
      <input type="number" min="0" step="any" inputmode="decimal" placeholder="Amount${CURRENCY.includes(unitOf(q)) || !unitOf(q) ? '' : ' (' + esc(unitOf(q)) + ')'}" data-tallyin="${q.id}" aria-label="Amount">
      <span class="tl-rew">${rewardsHtml(pv.xp, pv.gold).replace('class="rewards"', 'class="rewards" style="opacity:.45"')}</span>
      <button class="claim off" data-act="tally">Claim</button>
    </div>
    <div class="tl-note">${tallyNote(q, pv)}</div>
  </article>`;
}
function updateTally(input){
  const q = byId(input.dataset.tallyin); if (!q) return;
  const card = input.closest('.tally-card'), pv = tallyPreview(q, input.value);
  card.querySelector('.tl-rew').innerHTML = rewardsHtml(pv.xp, pv.gold).replace('class="rewards"', `class="rewards"${pv.units ? '' : ' style="opacity:.45"'}`);
  card.querySelector('.tl-note').textContent = tallyNote(q, pv);
  card.querySelector('[data-act="tally"]').classList.toggle('off', !(parseFloat(input.value) > 0));
}
function claimTally(q, input, rect){
  const pv = tallyPreview(q, input.value);
  if (!pv.v){ shake(input); return; }
  snapshot();
  const pc = q.carry || 0;
  q.carry = pv.left; q.total = round2((q.total || 0) + pv.v); q.count = (q.count || 0) + 1;
  logClaim(q.log ||= [], pv.xp, pv.gold); Object.assign(q.log[q.log.length - 1], { v:pv.v, pc });
  const msg = pv.units ? `${q.name}: ${fmtU(q, pv.v)} logged` : `${fmtU(q, pv.v)} logged · ${fmtU(q, round2(q.chunk - pv.left))} more for a reward`;
  grant({ xp:pv.xp, gold:pv.gold }, rect, msg, q.id, null, 1 + Math.min(1.6, pv.units / 6));
}

function compactCard(q){
  const hidden = !isVisible(q), p = parentOf(q);
  return `<article class="card compact${hidden ? ' hidden-q' : ''}">${CORNERS}
    <div class="grip" aria-label="Drag to reorder">${ico('i-grip','0 0 14 22')}</div>
    <div class="cbody"><h3>${esc(q.name)}</h3>${p ? `<div class="note">Appears after ${esc(p.name)}</div>` : ''}</div>
    ${kindTag(q)}
  </article>`;
}
function card(q, fresh){
  if (arranging) return compactCard(q);
  if (q.kind === 'pair') return pairCard(q, fresh);
  if (q.kind === 'scaling') return scalingCard(q, fresh);
  if (q.kind === 'record') return recordCard(q, fresh);
  if (isTracker(q)) return stepsCard(q);
  if (q.kind === 'tally') return tallyCard(q);
  return standardCard(q, fresh);
}

/* ================= Progress tab ================= */
let weekOffset = 0, monthOffset = 0, selDay = null;

/* ---- Quest history ----
   Progress has a row of chips: Steps, then each quest. A quest shows four stat tiles,
   a month calendar (tap a day for details), and its latest claims.
   Records show a line chart of every entry instead of a calendar. */
function dayMap(q){
  const m = {};
  const add = (arr, flag) => (arr || []).forEach(e => {
    const k = dayKey(e.t), o = m[k] || (m[k] = { n:0, xp:0, gold:0 });
    o.n++; o.xp += e.xp || 0; o.gold += e.gold || 0; o.v = round2((o.v || 0) + (e.v || 0)); if (flag) o[flag] = (o[flag] || 0) + 1;
  });
  if (q.kind === 'pair'){ add(q.a.log, 'a'); add(q.b.log, 'b'); add(q.bonusLog, 'bonus'); } else add(q.log);
  return m;
}
function allLogs(q){
  if (q.kind === 'pair') return [...(q.a.log || []).map(e => ({ ...e, what:q.a.name })), ...(q.b.log || []).map(e => ({ ...e, what:q.b.name })), ...(q.bonusLog || []).map(e => ({ ...e, what:'Pair bonus' }))];
  return (q.log || []).map(e => ({ ...e, what:q.kind === 'tally' ? fmtU(q, e.v || 0) : q.kind === 'scaling' ? 'Claimed' : 'Completed' }));
}
function cellClass(q, o){
  if (!o) return '';
  if (q.kind === 'pair') return o.a && o.b ? (o.bonus ? 'l3' : 'l2') : o.a ? 'half' : 'half b';
  if (q.kind === 'scaling') return 'l' + Math.min(3, o.n);
  return 'l2';
}
function monthCalendar(q, map){
  const base = new Date(), m0 = new Date(base.getFullYear(), base.getMonth() - monthOffset, 1);
  const y = m0.getFullYear(), mo = m0.getMonth(), daysIn = new Date(y, mo + 1, 0).getDate(), lead = (m0.getDay() + 6) % 7;
  const today = dayKey(), created = startOfDay(q.created || 0);
  let cells = ['M','T','W','T','F','S','S'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div class="hc blank"></div>';
  let doneDays = 0;
  for (let d = 1; d <= daysIn; d++){
    const t = new Date(y, mo, d).getTime(), k = dayKey(t), o = map[k];
    if (o) doneDays++;
    const cls = ['hc', cellClass(q, o)];
    if (t > startOfDay()) cls.push('fut'); else if (t < created && !o) cls.push('pre');
    if (k === today) cls.push('today');
    if (k === selDay) cls.push('sel');
    const mark = o && q.kind === 'scaling' && o.n > 1 ? `<i>×${o.n}</i>` : o && o.bonus ? '<i>✦</i>' : '';
    cells += `<button class="${cls.join(' ')}" data-act="hday" data-day="${k}"><span>${d}</span>${mark}</button>`;
  }
  const title = m0.toLocaleDateString(undefined, { month:'long', year:'numeric' });
  return { html:`<div class="wk-nav">
      <button data-act="mo-prev" aria-label="Previous month">‹</button>
      <div class="wk-l">${title}<small>${doneDays} ${doneDays === 1 ? 'day' : 'days'} with progress</small></div>
      <button data-act="mo-next" aria-label="Next month"${monthOffset === 0 ? ' disabled' : ''}>›</button>
    </div><div class="cal">${cells}</div>` };
}
function legendFor(q){
  const sw = c => `<b class="hc ${c}" style="aspect-ratio:auto"></b>`;
  if (q.kind === 'pair') return `<div class="legend"><span>${sw('half')}One done</span><span>${sw('l3')}Both · bonus</span><span>${sw('')}None</span></div>`;
  if (q.kind === 'tally') return `<div class="legend"><span>${sw('l2')}Logged</span><span>${sw('')}Nothing</span></div>`;
  if (q.kind === 'scaling') return `<div class="legend"><span>${sw('l1')}Once</span><span>${sw('l2')}Twice</span><span>${sw('l3')}3+ times</span></div>`;
  return `<div class="legend"><span>${sw('l2')}Done</span><span>${sw('')}Not done</span><span><b style="box-shadow:inset 0 0 0 1.5px #f2f7f6"></b>Today</span></div>`;
}
function dayInfo(q, map){
  if (!selDay) return '';
  const o = map[selDay], label = dayLabel(new Date(selDay + 'T00:00'));
  if (!o) return `<div class="dayinfo"><b>${label}</b> · nothing claimed</div>`;
  let what = q.kind === 'pair' ? [o.a && esc(q.a.name), o.b && esc(q.b.name)].filter(Boolean).join(' and ') + (o.bonus ? ' · bonus earned' : '')
    : q.kind === 'scaling' ? `Claimed ${o.n}×` : q.kind === 'tally' ? `Logged ${fmtU(q, o.v)}${o.n > 1 ? ` in ${o.n} entries` : ''}` : 'Completed';
  return `<div class="dayinfo"><b>${label}</b> · ${what}${rewardsHtml(o.xp, o.gold)}</div>`;
}
function recordChart(q){
  const E = q.entries;
  if (E.length < 2) return '<div class="dayinfo">Log at least two entries to see a chart.</div>';
  const W = 340, H = 200, pl = 38, pr = 12, pt = 16, pb = 26, cw = W - pl - pr, ch = H - pt - pb;
  const t0 = E[0].t, t1 = E[E.length - 1].t || t0 + 1;
  const vs = E.map(e => e.v), lo = Math.min(...vs), hi = Math.max(...vs), pad = Math.max(.5, (hi - lo) * .15);
  const vmin = lo - pad, vmax = hi + pad;
  const X = t => pl + (t1 === t0 ? cw / 2 : (t - t0) / (t1 - t0) * cw), Y = v => pt + (vmax - v) / (vmax - vmin) * ch;
  let g = '';
  for (let i = 0; i <= 3; i++){ const v = vmin + (vmax - vmin) * i / 3, yy = Y(v).toFixed(1);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="rgba(210,240,236,.12)"/><text x="${pl - 6}" y="${(+yy + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#6f8583">${fmt(Math.round(v * 10) / 10)}</text>`; }
  const pts = E.map(e => `${X(e.t).toFixed(1)},${Y(e.v).toFixed(1)}`).join(' ');
  g += `<polygon points="${pl},${pt + ch} ${pts} ${X(t1).toFixed(1)},${pt + ch}" fill="url(#gBar)" opacity=".35"/>`;
  g += `<polyline points="${pts}" fill="none" stroke="#ff8a40" stroke-width="1.8" stroke-linejoin="round"/>`;
  E.forEach(e => { const best = e.v === q.best; g += `<circle cx="${X(e.t).toFixed(1)}" cy="${Y(e.v).toFixed(1)}" r="${best ? 3.6 : 2.2}" fill="${best ? '#ffc49a' : '#ff6b1a'}" stroke="#000" stroke-width=".8"/>`; });
  const by = Y(q.best).toFixed(1);
  g += `<line x1="${pl}" x2="${W - pr}" y1="${by}" y2="${by}" stroke="#ff3b30" stroke-width="1.1" stroke-dasharray="4 4"/><text x="${pl + 4}" y="${(+by + 13).toFixed(1)}" font-size="9.5" fill="#ff7a6a">Best ${fmt(q.best)}</text>`;
  const fd = t => new Date(t).toLocaleDateString(undefined, { day:'numeric', month:'short' });
  g += `<text x="${pl}" y="${H - 8}" font-size="10" fill="#9db2b0">${fd(t0)}</text><text x="${W - pr}" y="${H - 8}" text-anchor="end" font-size="10" fill="#9db2b0">${fd(t1)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entries over time">${g}</svg>`;
}
function questHistory(q){
  const tag = kindTag(q);
  if (q.kind === 'record'){
    const E = q.entries, first = E[0], last = E[E.length - 1], u = esc(q.unit);
    const change = first && last ? round2(last.v - first.v) : 0;
    return `<div class="list"><div class="card">${CORNERS}
        <div class="q-top"><h3>${esc(q.name)}</h3>${tag}</div>
        <div class="sum four">
          <div><b>${first ? fmt(first.v) : '—'}</b><span>Start</span></div>
          <div><b>${q.best != null ? fmt(q.best) : '—'}</b><span>Best</span></div>
          <div><b>${last ? fmt(last.v) : '—'}</b><span>Latest</span></div>
          <div><b>${first ? (change > 0 ? '+' : '') + fmt(change) : '—'}</b><span>Change ${u}</span></div>
        </div>
        ${recordChart(q)}
      </div>
      <div class="card">${CORNERS}<div class="q-top"><h3>Entries</h3></div>
        ${E.length ? [...E].reverse().slice(0, 30).map((e, i) => `<div class="log-row"><div class="log-l"><div>${fmt(e.v)} ${u}${e.v === q.best ? ' <span class="tag">Best</span>' : ''}</div><small>${dayLabel(e.t)}</small></div>${i === 0 && q.undo ? `<button class="hx-undo" data-act="hxundo" data-q="${q.id}">Undo</button>` : UNDO_OFF}</div>`).join('') : '<div class="empty">No entries yet.</div>'}
      </div></div>`;
  }
  const map = dayMap(q), logs = allLogs(q).sort((a, b) => b.t - a.t);
  const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
  const monthDays = Object.keys(map).filter(k => new Date(k + 'T00:00') >= ms).length;
  const earned = logs.reduce((a, e) => a + (e.gold || 0), 0);
  const total = q.kind === 'pair' ? q.bonusCount : q.count;
  const monthV = q.kind === 'tally' ? round2(logs.filter(e => e.t >= ms.getTime()).reduce((a, e) => a + (e.v || 0), 0)) : 0;
  const cal = monthCalendar(q, map);
  return `<div class="list"><div class="card">${CORNERS}
      <div class="q-top"><h3>${esc(q.name)}</h3>${tag}</div>
      <div class="sum ${hasStreak(q) ? '' : 'two'}">
        ${hasStreak(q) ? `<div><b>${fmt(Math.max(q.bestStreak || 0, q.streak || 0))}</b><span>Best streak</span></div>` : ''}
        <div><b>${q.kind === 'tally' ? fmtU(q, q.total || 0) : fmt(total)}</b><span>${q.kind === 'pair' ? 'Both done' : 'Total'}</span></div>
        <div><b>${q.kind === 'tally' ? fmtU(q, monthV) : monthDays}</b><span>This month</span></div>
      </div>
      ${cal.html}
      ${legendFor(q)}
      ${dayInfo(q, map)}
    </div>
    <div class="card">${CORNERS}<div class="q-top"><h3>Total claimed</h3></div>
      <div class="sum">
        <div><b>${fmt(logs.length)}</b><span>Claims</span></div>
        <div><b class="xp-r">${fmt(logs.reduce((a, e) => a + (e.xp || 0), 0))}</b><span>XP</span></div>
        <div><b class="gold-r">${fmt(earned)}</b><span>Gold</span></div>
      </div>
      <div class="q-top" style="margin-top:14px"><h3>Recent claims</h3></div>
      ${logs.length ? logs.slice(0, 12).map(e => `<div class="log-row"><div class="log-l"><div>${esc(e.what)}</div><small>${dayLabel(e.t)} · ${new Date(e.t).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' })}</small></div>${rewardsHtml(e.xp || 0, e.gold || 0)}</div>`).join('') : '<div class="empty">Nothing claimed yet.</div>'}
    </div>
    <div class="since">History is recorded from version 0.7 onward.</div></div>`;
}
function progressChips(){
  const qs = S.quests.filter(q => q.kind !== 'steps' && q.kind !== 'bounty' && isTracked(q));
  const chip = (id, name) => `<button class="chip${(S.pview || 'steps') === id ? ' on' : ''}" data-act="pv" data-pv="${id}">${esc(name)}</button>`;
  return `<div class="chips hud-chips">${chip('steps', 'Steps')}${qs.map(q => chip(q.id, q.name)).join('')}</div>`;
}
$('#progMenu').addEventListener('click', e => { e.stopPropagation(); const pop = $('#progPop'); if (pop.classList.contains('open')) return closeProgPop(); renderProgPop(); pop.classList.add('open'); });
$('#progPop').addEventListener('click', e => e.stopPropagation());
$('#progPop').addEventListener('change', e => {
  const id = e.target.dataset.pp; if (!id) return;
  S.progHide ||= {};
  if (e.target.checked) delete S.progHide[id]; else S.progHide[id] = true;
  save();   // the page behind redraws once the dialog closes (no flicker while toggling)
});
function closeProgPop(){ const p = $('#progPop'); if (p.classList.contains('open')){ p.classList.remove('open'); render(); } }
document.addEventListener('click', closeProgPop);
function renderProgress(){
  if (S.pview && S.pview !== 'steps' && !(byId(S.pview) && isTracked(byId(S.pview)))) S.pview = 'steps';
  const q = S.pview && S.pview !== 'steps' ? byId(S.pview) : null;
  return progressChips() + (q ? (q.kind === 'record' ? questHistory(q) : questHero(q)) : stepsHud());
}
function shortNum(v){ return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(v)); }
function weekChart(days, vals, goal, todayIdx, gq){
  // gq: the steps quest, when reaching the goal pays a bonus (a gold coin under each day that hit it)
  const bonus = !!(gq && goal && (gq.goalXp || gq.goalGold));
  const W = 340, H = bonus ? 246 : 220, pl = 34, pr = 10, pt = 22, pb = bonus ? 56 : 30, cw = W - pl - pr, ch = H - pt - pb;
  const top = Math.max(goal * 1.15, ...vals.map(v => v * 1.12), 1);
  // round the top of the scale to a tidy number so the 4 grid lines read nicely
  const mag = Math.pow(10, Math.floor(Math.log10(top / 4))), unit4 = [1, 2, 2.5, 5, 10].map(m => m * mag).find(m => m * 4 >= top);
  const max = unit4 * 4;
  const y = v => pt + ch - v / max * ch, band = cw / 7, bw = band * .56;
  let g = '';
  for (let i = 0; i <= 4; i++){
    const v = max * i / 4, yy = y(v).toFixed(1);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="${i ? 'rgba(210,240,236,.12)' : 'rgba(210,240,236,.4)'}" stroke-width="1"/>
      <text x="${pl - 6}" y="${(+yy + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#6f8583">${shortNum(v)}</text>`;
  }
  const letters = ['M','T','W','T','F','S','S'];
  days.forEach((t, i) => {
    const v = vals[i], x = pl + band * i + (band - bw) / 2, future = todayIdx >= 0 && i > todayIdx;
    if (future){
      g += `<rect x="${x.toFixed(1)}" y="${(pt + ch - 3).toFixed(1)}" width="${bw.toFixed(1)}" height="3" fill="rgba(210,240,236,.15)"/>`;
    } else if (v > 0){
      const h = Math.max(2, v / max * ch), met = goal && v >= goal;
      g += `<rect class="bar${weekChart.still ? ' still' : ''}" style="animation-delay:${i * 40}ms" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"
        fill="url(#${met ? 'gBarHi' : 'gBar'})" stroke="${i === todayIdx ? '#f2f7f6' : '#000'}" stroke-width="${i === todayIdx ? 1.4 : .8}"/>
        <text class="${met ? 'bar-met' : ''}" x="${(x + bw / 2).toFixed(1)}" y="${(y(v) - 5).toFixed(1)}" text-anchor="middle" font-size="9" fill="${met ? '#ffc94a' : '#9db2b0'}">${shortNum(v)}</text>`;
      if (met && bonus){
        const key = dayKey(t), got = gq.goalPaid && gq.goalPaid[key], cx = pl + band * i + band / 2, cy = pt + ch + 38;
        g += got
          ? `<g class="goal-coin got" transform="translate(${(cx - 9).toFixed(1)} ${cy - 9})"><use href="#i-coin" width="18" height="18"/><path d="M12 13.5l2.4 2.4 4.6-5" fill="none" stroke="#3fd47a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><title>Goal bonus claimed</title></g>`
          : `<g class="goal-coin" data-act="goalclaim" data-q="${gq.id}" data-day="${key}" role="button" aria-label="Claim goal bonus" transform="translate(${(cx - 11).toFixed(1)} ${cy - 11})"><circle cx="11" cy="11" r="15" fill="transparent"/><circle class="gc-glow" cx="11" cy="11" r="12" fill="rgba(255,201,74,.18)"/><use href="#i-coin" width="22" height="22"/></g>`;
      }
    }
    g += `<text x="${(pl + band * i + band / 2).toFixed(1)}" y="${pt + ch + 20}" text-anchor="middle" font-size="11" fill="${i === todayIdx ? '#f2f7f6' : '#9db2b0'}">${letters[i]}</text>`;
  });
  if (goal){
    const gy = y(goal).toFixed(1);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${gy}" y2="${gy}" stroke="#ff3b30" stroke-width="1.2" stroke-dasharray="4 4"/>
      <text x="${W - pr}" y="${(+gy - 5).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#ff7a6a">Goal ${shortNum(goal)}</text>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Steps per day">${g}</svg>`;
}
// Lifetime steps: short form (12.5K, 10.25M, 1.2B) – tap for the exact number.
// Distance uses a stride of 0.743 m per step – tap to switch km / miles.
const STRIDE_M = 0.743;   // matched to Samsung Health: 8,380 steps = 6.23 km
let stepsExact = false;
function bigNum(v){
  const u = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([n]) => v >= n);
  return u ? (Math.floor(v / u[0] * 100) / 100).toString() + u[1] : fmt(v);
}

/* ================= Shop ================= */
// rarity colours, used by the drop-rate panel now and by the cards later
const RARITY = {
  ultimate: { name:'UR', color:'#c8242f', glow:'235,60,50' }, legendary:{ name:'SSR', color:'#f08a24', glow:'245,150,50' },
  epic:     { name:'SR',     color:'#a855c8', glow:'176,90,230' }, rare:     { name:'R',      color:'#1ea4e6', glow:'40,165,240' },
  common:   { name:'C',   color:'#3fd47a', glow:'63,212,122' }
};
const SHOP = [
  { id:'tarot', deck:'tarot', fan:['SSR03', 'SSR05', 'SSR07', 'SSR01', 'SSR12', 'SSR15'], name:'Tarot Pack', desc:'A price is always exacted for what fate bestows.', price:100, cards:5,
    pity:10,   // every 10th deck opened without an Ultimate guarantees one; getting any Ultimate resets the count
    // chance per card; whatever is left (59.9%) is C. A deck with no Rare or better gets one card upgraded to Rare.
    odds:{ ultimate:1.1, legendary:4, epic:10, rare:25 },
    rates:[ { r:'ultimate', pct:'1.1%' }, { r:'legendary', pct:'4%' }, { r:'epic', pct:'10%' }, { r:'rare', pct:'25%', note:'1+ guaranteed' } ] },
  { id:'mlbb', deck:'mlbb', fan:['ML_AS01', 'ML_SP05', 'ML_AS04', 'ML_SP01', 'ML_SP02', 'ML_SP03'], name:'Land of Dawn Pack', desc:'Funny you should think people are more reliable than gold!', price:100, cards:5, pity:10,
    odds:{ ultimate:1.1, legendary:4, epic:10, rare:25 },
    rates:[ { r:'ultimate', pct:'1.1%' }, { r:'legendary', pct:'4%' }, { r:'epic', pct:'10%' }, { r:'rare', pct:'25%', note:'1+ guaranteed' } ] },
  { id:'soon3', soon:true }, { id:'soon4', soon:true }
];
// per deck: card backs (normal / UR), the picture on the deck box, and its glow colours
var DECKS = {
  tarot:{ back:'backs/tarot', backUR:'backs/tarot-ur', cover:'img/packs/tarot.webp', scenes:true,
    glow:{ mid:'#ff6b1a', deep:'#c2410c', mote:'#ffc49a', ember:'#ffb07a', star:'#fff6ee', frame:'gBronze' } },
  mlbb: { back:'backs/mlbb', backUR:'backs/mlbb-ur', cover:'img/backs/mlbb.webp', scenes:false,
    glow:{ mid:'#7c5cff', deep:'#3b4bd8', mote:'#c4b5ff', ember:'#9fb8ff', star:'#eef0ff', frame:'gDawn' } }
};
function deckOf(it){ return DECKS[(it && it.deck) || "tarot"]; }
// a rarity written inline: coloured diamond + name
const rtag = r => `<span class="rtag" style="--c:${RARITY[r].color}"><i class="rdot"></i>${RARITY[r].name}</span>`;
function infoHTML(it){
  return `<div class="info" data-act="info">
    <span class="info-btn" aria-label="Drop rates">i</span>
    <div class="info-pop" role="tooltip">
      <div class="info-title" style="margin-bottom:6px">Drop rates</div>
      ${it.rates.map(x => `<div class="rate"><i style="--c:${RARITY[x.r].color}"></i><span style="color:${RARITY[x.r].color}">${RARITY[x.r].name}</span><b>${x.pct}</b>${x.note ? `<small>${x.note}</small>` : ''}</div>`).join('')}
      <div class="info-foot">Every pack has at least one ${rtag('rare')} or better. Every ${it.pity}th pack without an ${rtag('ultimate')} guarantees one.</div>
    </div>
  </div>`;
}
// Shop: a banner for the newest deck (its best cards fanned out), then every deck as a row:
// stacked deck picture | name, how much of it you've collected, UR countdown | price button + how many to buy
function shopStack(it){ const c = deckOf(it).cover; return `<div class="art sh-stack">${[0, 1, 2].map(() => `<img src="${c}" alt="">`).join('')}</div>`; }
function shopBars(it){
  const all = CARDS.filter(c => c.deck === it.deck), got = all.filter(c => ownedCard(c.id)).length;
  // UR countdown: red = decks already opened toward it, striped red = unopened decks you own (they count once you open them)
  const n = Math.min(it.pity, (S.pity && S.pity[it.id]) || 0), left = it.pity - n, mine = Math.min(left, owned(it.id));
  return `<div class="sh-bar"><span>Collected</span><div class="bar"><i style="width:${got / all.length * 100}%"></i></div><b>${got}/${all.length}</b></div>
    <div class="sh-bar ur"><span>${rtag('ultimate')} in</span><div class="bar"><i style="width:${n / it.pity * 100}%"></i><i class="own" style="width:${mine / it.pity * 100}%"></i></div><b>${left}${owned(it.id) ? `<em>(${left - mine})</em>` : ''}</b></div>`;
}
function shopBuy(it){
  const q = shopQty[it.id] || 1;
  return `<button class="sh-buy${S.gold < it.price * q ? ' short' : ''}" data-act="buy" data-item="${it.id}">${ico('i-coin')}<span>${fmt(it.price * q)}</span></button>`;
}
// one banner per deck: the newest says NEW DECK, the others FEATURED DECK
function shopBanner(f, isNew){
  const q = shopQty[f.id] || 1;
  const fan = (f.fan || []).map((id, k) => `<img class="${k < 3 ? 'back' : 'front'}" src="${cardImg(id)}" alt="" style="--i:${k % 3 - 1}">`).join('');
  return `<div class="sh-ban th-${f.deck}" data-buyhost data-item="${f.id}"><i class="sh-frame"></i>
      <div class="sh-ban-txt"><span class="sh-new">${isNew ? 'NEW PACK' : 'FEATURED PACK'}</span><h3>${f.name.length > 12 ? esc(f.name).replace(/ Pack$/, '<br>Pack') : esc(f.name)}</h3><p>${esc(f.banner || f.desc)}</p>
        <div class="sh-ban-buy">${shopBuy(f)}<div class="sh-qty"><button data-act="qty" data-d="-1" data-item="${f.id}" aria-label="Fewer"${q <= 1 ? ' disabled' : ''}>‹</button><b>×${q}</b><button data-act="qty" data-d="1" data-item="${f.id}" aria-label="More"${q >= 99 ? ' disabled' : ''}>›</button></div></div></div>
      <div class="art sh-fan">${fan}</div>
    </div>`;
}
var shopBan = 0;   // which banner is showing (kept across redraws)
function renderShop(){
  const decks = SHOP.filter(it => !it.soon), bs = decks.slice().reverse(), n = bs.length;   // newest first
  shopBan = ((shopBan % n) + n) % n;
  const slides = n > 1 ? [bs[n - 1], ...bs, bs[0]] : bs;   // a copy at each end so it can loop smoothly
  const q = id => shopQty[id] || 1;
  return `<div class="sh">
    <div class="sh-car" data-n="${n}">
      <div class="sh-track" style="transform:translateX(calc(${shopBan + (n > 1 ? 1 : 0)} * (-100% - 12px)))">
        ${slides.map((f, k) => `<div class="sh-slide${k === shopBan + 1 || n === 1 ? ' cur' : ''}">${shopBanner(f, f === bs[0])}</div>`).join('')}
      </div>
    </div>
    ${n > 1 ? `<div class="sh-dots">${bs.map((_, k) => `<i class="${k === shopBan ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    <div class="sh-h">All packs<div class="info" data-act="info"><span class="info-btn" aria-label="What the gold means">i</span>
      <div class="info-pop" role="tooltip">
        <div class="sh-tip"><i class="sw r"></i>opened</div>
        <div class="sh-tip"><i class="sw g"></i>owned, unopened</div></div></div></div>
    ${decks.map(it => `<div class="sh-row th-${it.deck}" data-buyhost data-item="${it.id}">
      ${shopStack(it)}
      <div class="sh-mid"><h3>${esc(it.name)}</h3>${shopBars(it)}</div>
      <div class="sh-right">${shopBuy(it)}
        <div class="sh-qty"><button data-act="qty" data-d="-1" data-item="${it.id}" aria-label="Fewer"${q(it.id) <= 1 ? ' disabled' : ''}>‹</button><b>×${q(it.id)}</b><button data-act="qty" data-d="1" data-item="${it.id}" aria-label="More"${q(it.id) >= 99 ? ' disabled' : ''}>›</button></div>
      </div>
    </div>`).join('')}
    <div class="sh-soon">${ico('i-pouch')}More packs coming soon</div>
  </div>`;
}
const owned = id => (S.inv && S.inv[id]) || 0;
const shopQty = {};   // how many to buy at once, per item (resets when the app restarts)
function changeQty(id, d){
  const it = SHOP.find(x => x.id === id); if (!it) return;
  const q = shopQty[id] = Math.max(1, Math.min(99, (shopQty[id] || 1) + d));
  document.querySelectorAll(`.sh-buy[data-item="${id}"]`).forEach(b => { b.querySelector('span').textContent = fmt(it.price * q); b.classList.toggle('short', S.gold < it.price * q); });
  document.querySelectorAll(`.sh-qty`).forEach(box => { const [dn, up] = box.querySelectorAll('button'); if (dn.dataset.item !== id) return; dn.disabled = q <= 1; up.disabled = q >= 99; box.querySelector('b').textContent = '×' + q; });
  vibrate(6);
}
async function tryBuy(id, el){
  const it = SHOP.find(x => x.id === id); if (!it) return;
  const q = shopQty[id] || 1, cost = it.price * q, name = q > 1 ? `${q} ${it.name}s` : `the ${it.name}`;
  if (S.gold < cost){ el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny'); vibrate([30, 40, 30]); return; }
  vibrate(10);
  if (!await askBuy(it, q, cost)) return;
  snapshot();
  const host = el.closest('[data-buyhost]') || el, art = (host.querySelector('.art') || el).getBoundingClientRect();
  S.gold -= cost; (S.inv ||= {})[id] = owned(id) + q;
  shopQty[id] = 1;
  save();
  spendCoins(art, cost);
  renderHeader.tween = true; render();
  const slot = document.querySelector(`.sh-row[data-item="${id}"]`) || document.querySelector(`[data-item="${id}"]`);
  const sa = slot && (slot.querySelector('.art') || slot);
  if (slot){ slot.classList.add('flash'); FX.burst(...mid(sa.getBoundingClientRect()), 1.4); }
  vibrate([20, 40, 30]);
  showToast(`${q > 1 ? q + ' ' + it.name + 's' : it.name} added to your Inventory`, true);
}
// coins leave the purse and fly into the item you bought
function spendCoins(to, amount){
  const purse = $('#purse svg').getBoundingClientRect(), n = Math.min(8, Math.max(3, Math.ceil(amount / 20)));
  const sx = purse.left + purse.width / 2 - 11, sy = purse.top + purse.height / 2 - 11, tx = to.left + to.width / 2 - 11, ty = to.top + to.height / 2 - 11;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div'); el.className = 'fly'; el.innerHTML = ico('i-coin'); document.body.appendChild(el);
    const rx = (Math.random() - .5) * 110;
    el.animate([
      { transform:`translate(${sx}px,${sy}px) scale(.8)`, opacity:0 },
      { transform:`translate(${(sx + tx) / 2 + rx}px,${Math.min(sy, ty) - 30}px) scale(1.15)`, opacity:1, offset:.4 },
      { transform:`translate(${tx}px,${ty}px) scale(.5)`, opacity:.2 }
    ], { duration:700, delay:i * 50, easing:'cubic-bezier(.45,0,.55,1)', fill:'both' }).onfinish = () => { el.remove(); if (i === n - 1) FX.small(tx + 11, ty + 11); };
  }
}
function useItem(id){ openDeck(id); }


/* ================= Cards ================= */
// Every card in the Tarot Deck pool. Rarity decides how often it drops; set is how the Collection groups it.
const CARD_DATA = {"cards": [{"id": "SSR01", "name": "Klein Moretti", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR02", "name": "Audrey Hall", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR03", "name": "Alger Wilson", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR04", "name": "Derrick Berg", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR05", "name": "Fors Wall", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR06", "name": "Emlyn White", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR07", "name": "Cattleya", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR08", "name": "Leonard Mitchell", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR09", "name": "Xio Derecha", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR10", "name": "Azik Eggers", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR11", "name": "Sherlock Moriarty", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR12", "name": "Gehrman Sparrow", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR13", "name": "Dwayne Dantès", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR14", "name": "Merlin Hermes", "rarity": "ultimate", "set": "SSR"}, {"id": "SSR15", "name": "Amon", "rarity": "ultimate", "set": "SSR"}, {"id": "CB00", "name": "The Fool - Klein Moretti", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB01", "name": "The Magician - Fors Wall", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB02", "name": "The High Priestess - Bernadette Gustav", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB03", "name": "The Empress - Trissy", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB04", "name": "The Emperor - Roselle Gustav", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB05", "name": "The Hierophant - Alger Wilson", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB06", "name": "The Lovers - Amon", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB07", "name": "The Chariot - Medici", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB08", "name": "Strength - Colin Iliad", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB09", "name": "The Hermit - Cattleya", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB10", "name": "The Wheel of Fortune - Will Auceptin", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB11", "name": "Justice - Audrey Hall", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB12", "name": "The Hanged Man - True Creator", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB13", "name": "Death - Azik Eggers", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB14", "name": "Temperance - Sharron", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB15", "name": "The Devil - Mother Tree of Desire", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB16", "name": "The Tower - Edwina Edwards", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB17", "name": "The Star - Leonard Mitchell", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB18", "name": "The Moon - Emlyn White", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB19", "name": "The Sun - Derrick Berg", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB20", "name": "Judgement - Xio Derecha", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "CB21", "name": "The World - Frank Lee", "rarity": "legendary", "set": "Cards of Blasphemy"}, {"id": "AC_Adam", "name": "Adam", "rarity": "epic", "set": "Angels"}, {"id": "AC_Amon", "name": "Amon", "rarity": "epic", "set": "Angels"}, {"id": "AC_Aucuses", "name": "Aucuses", "rarity": "epic", "set": "Angels"}, {"id": "AC_Herabergen", "name": "Herabergen", "rarity": "epic", "set": "Angels"}, {"id": "AC_Leodero", "name": "Leodero", "rarity": "epic", "set": "Angels"}, {"id": "AC_Medici", "name": "Medici", "rarity": "epic", "set": "Angels"}, {"id": "AC_Ouroboros", "name": "Ouroboros", "rarity": "epic", "set": "Angels"}, {"id": "AC_Sasrir", "name": "Sasrir", "rarity": "epic", "set": "Angels"}, {"id": "PM_EarthMother", "name": "Earth Mother", "rarity": "epic", "set": "Promo"}, {"id": "PM_EternalBlazingSu", "name": "Eternal Blazing Sun", "rarity": "epic", "set": "Promo"}, {"id": "PM_EvernightGoddess", "name": "Evernight Goddess", "rarity": "epic", "set": "Promo"}, {"id": "PM_GodofCombat", "name": "God of Combat", "rarity": "epic", "set": "Promo"}, {"id": "PM_GodofKnowledgean", "name": "God of Knowledge and Wisdom", "rarity": "epic", "set": "Promo"}, {"id": "PM_GodofSteamandMac", "name": "God of Steam and Machinery", "rarity": "epic", "set": "Promo"}, {"id": "PM_LordofMysteries", "name": "Lord of Mysteries", "rarity": "epic", "set": "Promo"}, {"id": "PM_LordofStorms", "name": "Lord of Storms", "rarity": "epic", "set": "Promo"}, {"id": "SCR01", "name": "Puzzle Piece 1", "rarity": "epic", "set": "Puzzle"}, {"id": "SCR02", "name": "Puzzle Piece 2", "rarity": "epic", "set": "Puzzle"}, {"id": "SCR03", "name": "Puzzle Piece 3", "rarity": "epic", "set": "Puzzle"}, {"id": "SCR04", "name": "Puzzle Piece 4", "rarity": "epic", "set": "Puzzle"}, {"id": "SCR05", "name": "Puzzle Piece 5", "rarity": "epic", "set": "Puzzle"}, {"id": "SCR06", "name": "Puzzle Piece 6", "rarity": "epic", "set": "Puzzle"}, {"id": "SCR07", "name": "Puzzle Piece 7", "rarity": "epic", "set": "Puzzle"}, {"id": "SCR08", "name": "Puzzle Piece 8", "rarity": "epic", "set": "Puzzle"}, {"id": "SR01", "name": "Azik Eggers", "rarity": "rare", "set": "SR"}, {"id": "SR02", "name": "Edwina Edwards", "rarity": "rare", "set": "SR"}, {"id": "SR03", "name": "Will Auceptin", "rarity": "rare", "set": "SR"}, {"id": "SR04", "name": "Bernadette Gustav", "rarity": "rare", "set": "SR"}, {"id": "SR05", "name": "Daly Simone", "rarity": "rare", "set": "SR"}, {"id": "SR06", "name": "Reinette Tinekerr", "rarity": "rare", "set": "SR"}, {"id": "SR07", "name": "Ince Zangwill", "rarity": "rare", "set": "SR"}, {"id": "SR08", "name": "Colin Iliad", "rarity": "rare", "set": "SR"}, {"id": "SR09", "name": "Dunn Smith", "rarity": "rare", "set": "SR"}, {"id": "SR10", "name": "Sharron", "rarity": "rare", "set": "SR"}, {"id": "SR11", "name": "Trissy", "rarity": "rare", "set": "SR"}, {"id": "SR12", "name": "Frank Lee", "rarity": "rare", "set": "SR"}, {"id": "SR13", "name": "Roselle Gustav", "rarity": "rare", "set": "SR"}, {"id": "SR14", "name": "Danitz Dubois", "rarity": "rare", "set": "SR"}, {"id": "TC_AlgerWilson", "name": "Alger Wilson", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_AudreyHall", "name": "Audrey Hall", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_Cattleya", "name": "Cattleya", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_DerrickBerg", "name": "Derrick Berg", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_EmlynWhite", "name": "Emlyn White", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_ForsWall", "name": "Fors Wall", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_GehrmanSparrow", "name": "Gehrman Sparrow", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_KleinMoretti", "name": "Klein Moretti", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_LeonardMitchell", "name": "Leonard Mitchell", "rarity": "rare", "set": "Tarot Club"}, {"id": "TC_XioDerecha", "name": "Xio Derecha", "rarity": "rare", "set": "Tarot Club"}, {"id": "OC01", "name": "Creeping Hunger", "rarity": "common", "set": "Objects"}, {"id": "OC02", "name": "Leymano's Travels", "rarity": "common", "set": "Objects"}, {"id": "OC03", "name": "Death Knell", "rarity": "common", "set": "Objects"}, {"id": "OC04", "name": "Slumber Charm", "rarity": "common", "set": "Objects"}, {"id": "OC05", "name": "Requiem Charm", "rarity": "common", "set": "Objects"}, {"id": "OC06", "name": "Dream Charm", "rarity": "common", "set": "Objects"}, {"id": "OC07", "name": "Flaring Sun Charm", "rarity": "common", "set": "Objects"}, {"id": "OC08", "name": "Quill of Alzuhod", "rarity": "common", "set": "Objects"}, {"id": "OC09", "name": "\"Magic Mirror\" Arrodes", "rarity": "common", "set": "Objects"}, {"id": "OC10", "name": "Sea God Scepter", "rarity": "common", "set": "Objects"}, {"id": "OC11", "name": "Mutated Sun Sacred Emblem", "rarity": "common", "set": "Objects"}, {"id": "OC12", "name": "Klein Moretti's Pendulum", "rarity": "common", "set": "Objects"}, {"id": "OC13", "name": "Gehrman Sparrow's Suitcase", "rarity": "common", "set": "Objects"}, {"id": "OC14", "name": "Audrey Hall's Umbrella", "rarity": "common", "set": "Objects"}, {"id": "OC15", "name": "Cattleya's Planetarium", "rarity": "common", "set": "Objects"}, {"id": "OC16", "name": "Cattleya's Staff", "rarity": "common", "set": "Objects"}, {"id": "OC17", "name": "Derrick's Axe of Hurricane", "rarity": "common", "set": "Objects"}, {"id": "OC18", "name": "Wintry Blade", "rarity": "common", "set": "Objects"}, {"id": "OC19", "name": "Emlyn White's Doll", "rarity": "common", "set": "Objects"}, {"id": "OC20", "name": "Paper Crane", "rarity": "common", "set": "Objects"}, {"id": "OC21", "name": "Sleep Bugle", "rarity": "common", "set": "Objects"}, {"id": "OC22", "name": "Staff of the Stars", "rarity": "common", "set": "Objects"}, {"id": "PWC01", "name": "Fool Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC02", "name": "Door Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC03", "name": "Paragon Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC04", "name": "Demoness Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC05", "name": "Black Emperor Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC06", "name": "Tyrant Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC07", "name": "Error Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC08", "name": "Red Priest Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC09", "name": "Visionary Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC10", "name": "Hermit Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC11", "name": "Wheel of Fortune Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC12", "name": "Twilight Giant Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC13", "name": "Hanged Man Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC14", "name": "Death Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC15", "name": "Chained Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC16", "name": "Abyss Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC17", "name": "White Tower Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC18", "name": "Darkness Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC19", "name": "Moon Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC20", "name": "Sun Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC21", "name": "Justiciar Pathway", "rarity": "common", "set": "Pathways"}, {"id": "PWC22", "name": "Mother Pathway", "rarity": "common", "set": "Pathways"}], "scenes": [{"id": "SC01", "name": "Chapter 1: Crimson"}, {"id": "SC02", "name": "Chapter 165: Epitaph"}, {"id": "SC03", "name": "Chapter 209: Light"}, {"id": "SC04", "name": "Chapter 213: Another Look"}, {"id": "SC05", "name": "Chapter 364: Cathedral of Serenity"}, {"id": "SC06", "name": "Chapter 663: False Alarm"}, {"id": "SC07", "name": "Chapter 732: Destination"}, {"id": "SC08", "name": "Chapter 766: The Deities' Anchor"}, {"id": "SC09", "name": "Chapter 1148: Not Late"}, {"id": "SC10", "name": "Chapter 1165: The Grand Lineup"}, {"id": "SC11", "name": "Chapter 1263: The Final Watch"}, {"id": "SC12", "name": "Chapter 1266: Light (I)"}, {"id": "SC13", "name": "Chapter 1266: Light (II)"}, {"id": "SC14", "name": "Chapter 1314: Miracles Are Only For A Moment"}, {"id": "SC15", "name": "Chapter 1387: Method"}, {"id": "SC16", "name": "Chapter 1394: A New Journey"}]};
CARD_DATA.cards.forEach(c => c.deck = 'tarot');
// Land of Dawn Deck (Mobile Legends cards). hero = which champion is on the card.
var MLBB_CARDS = [{"id": "ML_AS01", "name": "Miya", "hero": "Miya", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS02", "name": "Layla", "hero": "Layla", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS03", "name": "Energy Gunner", "hero": "Layla", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS04", "name": "Steel Elf", "hero": "Lolita", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS05", "name": "Arclight Outlaw", "hero": "Ixia", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS06", "name": "Claude", "hero": "Claude", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS07", "name": "Melissa", "hero": "Melissa", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS08", "name": "The Protector", "hero": "Bruno", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS09", "name": "Hoverjet Outrider", "hero": "Kimmy", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_AS10", "name": "Wild Engine", "hero": "Johnson", "rarity": "ultimate", "set": "Artist Series", "deck": "mlbb"}, {"id": "ML_SP01", "name": "Atomic Pop", "hero": "Miya", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP02", "name": "Atomic Pop", "hero": "Eudora", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP03", "name": "Miss-Hikari", "hero": "Layla", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP04", "name": "Blazing Gun", "hero": "Layla", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP05", "name": "Green Flash", "hero": "Layla", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP06", "name": "Beyond The Clouds", "hero": "Kagura", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP07", "name": "Neobeast", "hero": "Lylia", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP08", "name": "S.A.B.E.R ManHunter", "hero": "Freya", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP09", "name": "Gemini Halo", "hero": "Karina", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP10", "name": "M-World", "hero": "Wanwan", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP11", "name": "Blizzard Storm", "hero": "Vale", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP12", "name": "Empyrean Paladin", "hero": "Zilong", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP13", "name": "Sparkle", "hero": "Estes", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP14", "name": "Rattan Dragon", "hero": "Estes", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP15", "name": "Blazing Trace", "hero": "Claude", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP16", "name": "Sparkle", "hero": "Melissa", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP17", "name": "Firebolt", "hero": "Bruno", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP18", "name": "Frost Wing", "hero": "Kimmy", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP19", "name": "S.A.B.E.R. Automata", "hero": "Johnson", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP20", "name": "Blazing Shadow", "hero": "Esmeralda", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_SP21", "name": "The Foreseer", "hero": "Esmeralda", "rarity": "ultimate", "set": "Special", "deck": "mlbb"}, {"id": "ML_PR01", "name": "Modena Butterfly", "hero": "Miya", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR02", "name": "Doom Catalyst", "hero": "Miya", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR03", "name": "Suzuhime", "hero": "Miya", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR04", "name": "Emerald Enchantress", "hero": "Eudora", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR05", "name": "Twilight Waltz", "hero": "Layla", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR06", "name": "Paranormal Operative", "hero": "Layla", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR07", "name": "Cannon And Roses", "hero": "Layla", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR08", "name": "Water Lily", "hero": "Kagura", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR09", "name": "Jade Blossom", "hero": "Kagura", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR10", "name": "Dragon Maiden", "hero": "Kagura", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR11", "name": "Magitech Arsenal", "hero": "Lylia", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR12", "name": "Haunted Doll", "hero": "Lylia", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR13", "name": "Galactic Vanquisher", "hero": "Freya", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR14", "name": "Raven Shogun", "hero": "Freya", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR15", "name": "War Angel", "hero": "Freya", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR16", "name": "Doom Duelist", "hero": "Karina", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR17", "name": "Black Pearl", "hero": "Karina", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR18", "name": "Pixel Blast", "hero": "Wanwan", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR19", "name": "E-Girl", "hero": "Wanwan", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR20", "name": "Flying Swallow", "hero": "Wanwan", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR21", "name": "Starwatcher", "hero": "Lolita", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR22", "name": "Impish Trickster", "hero": "Lolita", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR23", "name": "Lion Dance", "hero": "Lolita", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR24", "name": "Supernal Tempest", "hero": "Vale", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR25", "name": "Keeper Of The Winds", "hero": "Vale", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR26", "name": "Concerto Of Light", "hero": "Vale", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR27", "name": "Mecha-King Perseus", "hero": "Alpha", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR28", "name": "Revenant Of Roses", "hero": "Alpha", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR29", "name": "Onimusha Commander", "hero": "Alpha", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR30", "name": "Glorious General", "hero": "Zilong", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR31", "name": "Changbanpo Commander", "hero": "Zilong", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR32", "name": "Dragon Of Prosperity", "hero": "Zilong", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR33", "name": "Arcane Magistrate", "hero": "Estes", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR34", "name": "Galaxy Dominator", "hero": "Estes", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR35", "name": "Blacklist International", "hero": "Estes", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR36", "name": "Challenge's Spark", "hero": "Claude", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR37", "name": "Mecha Dragon", "hero": "Claude", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR38", "name": "Umbra Bloom", "hero": "Melissa", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR39", "name": "Street Hype", "hero": "Bruno", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR40", "name": "Astrocat", "hero": "Kimmy", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR41", "name": "Wreck King", "hero": "Johnson", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR42", "name": "Sovereign Of Realms", "hero": "Johnson", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_PR43", "name": "Light Envoy", "hero": "Esmeralda", "rarity": "legendary", "set": "Prestige", "deck": "mlbb"}, {"id": "ML_ST01", "name": "Moon Priestess", "hero": "Miya", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST02", "name": "Cosmic Voyage", "hero": "Eudora", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST03", "name": "Bunny Babe", "hero": "Layla", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST04", "name": "Summer Festival", "hero": "Kagura", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST05", "name": "Future Star", "hero": "Lylia", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST06", "name": "Dragon Hunter", "hero": "Freya", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST07", "name": "Blood Moon", "hero": "Karina", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST08", "name": "Teen Pop", "hero": "Wanwan", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST09", "name": "Astro Mallet", "hero": "Lolita", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST10", "name": "Soaring Devata", "hero": "Vale", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST11", "name": "Star Enforcer", "hero": "Alpha", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST12", "name": "Dynamic Streak", "hero": "Ixia", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST13", "name": "Storm Rider", "hero": "Zilong", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST14", "name": "White Crane", "hero": "Estes", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST15", "name": "Earth's Mightiest", "hero": "Claude", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST16", "name": "Street Football", "hero": "Bruno", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST17", "name": "Charge Leader", "hero": "Kimmy", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST18", "name": "Starblazer", "hero": "Johnson", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_ST19", "name": "Lady Thief", "hero": "Esmeralda", "rarity": "epic", "set": "Starlight", "deck": "mlbb"}, {"id": "ML_SH01", "name": "Jungle Ranger", "hero": "Miya", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH02", "name": "Countess Scarlet", "hero": "Eudora", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH03", "name": "Classic Malefic Gunner", "hero": "Layla", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH04", "name": "Cherry Witch", "hero": "Kagura", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH05", "name": "Star Student", "hero": "Lylia", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH06", "name": "Gladiator", "hero": "Freya", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH07", "name": "Spider Lily", "hero": "Karina", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH08", "name": "Shoujo Commander", "hero": "Wanwan", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH09", "name": "Special Op", "hero": "Lolita", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH10", "name": "Kannagi", "hero": "Vale", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH11", "name": "Sea Gladiator", "hero": "Alpha", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH12", "name": "Eastern Warrior", "hero": "Zilong", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH13", "name": "Crow Bishop", "hero": "Estes", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH14", "name": "Plunderous Pirate", "hero": "Claude", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH15", "name": "Nightwalker", "hero": "Melissa", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH16", "name": "Best DJ", "hero": "Bruno", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH17", "name": "Bio Frontier", "hero": "Kimmy", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH18", "name": "Jeepney Racer", "hero": "Johnson", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_SH19", "name": "Poison Vine", "hero": "Esmeralda", "rarity": "rare", "set": "Shiny", "deck": "mlbb"}, {"id": "ML_CL01", "name": "Burning Bow", "hero": "Miya", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL02", "name": "Flame Red Lips", "hero": "Eudora", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL03", "name": "Green Flash", "hero": "Layla", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL04", "name": "Flower Season", "hero": "Kagura", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL05", "name": "School Idol", "hero": "Lylia", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL06", "name": "Dark Rose", "hero": "Freya", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL07", "name": "Phantom Blade", "hero": "Karina", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL08", "name": "Darting Star", "hero": "Wanwan", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL09", "name": "Soldier In Training", "hero": "Lolita", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL10", "name": "Cerulean Winds", "hero": "Vale", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL11", "name": "Fierce Dragon", "hero": "Alpha", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL12", "name": "Shifting Sand", "hero": "Ixia", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL13", "name": "Elite Warrior", "hero": "Zilong", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL14", "name": "Holy Priest", "hero": "Estes", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL15", "name": "Golden Bullet", "hero": "Claude", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL16", "name": "Twinge Weaver", "hero": "Melissa", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL17", "name": "Vanguard Elite", "hero": "Bruno", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL18", "name": "Steam Researcher", "hero": "Kimmy", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL19", "name": "Fire Chef", "hero": "Johnson", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_CL20", "name": "Ruddy Dusk", "hero": "Esmeralda", "rarity": "common", "set": "Classic", "deck": "mlbb"}, {"id": "ML_OR01", "name": "Moonlight Archer", "hero": "Miya", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR02", "name": "Lightning Weaver", "hero": "Eudora", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR03", "name": "Onmyouji Master", "hero": "Kagura", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR04", "name": "Little Witch", "hero": "Lylia", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR05", "name": "Valkyrie", "hero": "Freya", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR06", "name": "Shadow Blade", "hero": "Karina", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR07", "name": "Agile Tiger", "hero": "Wanwan", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR08", "name": "Steel Elf", "hero": "Lolita", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR09", "name": "Windtalker", "hero": "Vale", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR10", "name": "Blade Of Enmity", "hero": "Alpha", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR11", "name": "Arclight Outlaw", "hero": "Ixia", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR12", "name": "Spear Of The Dragon", "hero": "Zilong", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR13", "name": "Moon Elf King", "hero": "Estes", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR14", "name": "Master Thief", "hero": "Claude", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR15", "name": "Cursed Needle", "hero": "Melissa", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR16", "name": "The Protector", "hero": "Bruno", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR17", "name": "Hoverjet Outrider", "hero": "Kimmy", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR18", "name": "Wild Engine", "hero": "Johnson", "rarity": "common", "set": "Origin", "deck": "mlbb"}, {"id": "ML_OR19", "name": "Astrologer", "hero": "Esmeralda", "rarity": "common", "set": "Origin", "deck": "mlbb"}];
const CARDS = CARD_DATA.cards.concat(MLBB_CARDS), SCENES = CARD_DATA.scenes;
// border gradient per card: the card's own edge colour (top-left), its most striking art colour (middle), its edge colour (bottom-right)
var CARD_EDGE = {"SSR01":["#74704d","#978e66","#747150"],"SSR02":["#bf9c66","#cb9f61","#746341"],"SSR03":["#607671","#6594a9","#717460"],"SSR04":["#60745f","#6bacb8","#68745c"],"SSR05":["#747048","#458c85","#746f48"],"SSR06":["#747455","#c3451b","#745938"],"SSR07":["#6e5378","#7d63ad","#646674"],"SSR08":["#746c49","#d5c47f","#70745c"],"SSR09":["#745c39","#8c6743","#74603e"],"SSR10":["#75755c","#bcb884","#73755f"],"SSR11":["#746d59","#bbb06a","#747057"],"SSR12":["#a89963","#f3da99","#747049"],"SSR13":["#7d6950","#ab8165","#a38a78"],"SSR14":["#bcc29b","#928a66","#b1ad83"],"SSR15":["#747251","#9d8752","#74613c"],"CB00":["#746f70","#ae5c16","#746f70"],"CB01":["#b76461","#c95958","#bd726d"],"CB02":["#5e743a","#898c47","#818653"],"CB03":["#886776","#d59647","#63518f"],"CB04":["#3e479e","#8c6341","#3e48a0"],"CB05":["#27579a","#0441a1","#224d90"],"CB06":["#207e9a","#00749e","#1e7b98"],"CB07":["#852f26","#8c0b08","#752521"],"CB08":["#746860","#c5c0ad","#746661"],"CB09":["#524874","#cec4a5","#575174"],"CB10":["#717e7d","#953b34","#6b7b7c"],"CB11":["#758f70","#78abcc","#809670"],"CB12":["#6d7468","#cbbc9e","#74695a"],"CB13":["#58786f","#b49d73","#7c876e"],"CB14":["#744044","#8c0013","#742f31"],"CB15":["#783d33","#8c1113","#742924"],"CB16":["#7b6854","#ba987c","#806d59"],"CB17":["#778cb3","#5371b8","#6480b1"],"CB18":["#803456","#e32130","#863154"],"CB19":["#bd914f","#d28438","#bb904f"],"CB20":["#b6a38e","#8797af","#c4a784"],"CB21":["#a57f5f","#d07840","#837d5e"],"AC_Adam":["#f3e6dc","#8c6f5a","#f2e7df"],"AC_Amon":["#6e9eb0","#6391a4","#7296a5"],"AC_Aucuses":["#af8546","#8c581d","#a7804b"],"AC_Herabergen":["#e1d8b3","#a89678","#cdc3a5"],"AC_Leodero":["#325574","#5886a4","#46728c"],"AC_Medici":["#8a1d1f","#8c0108","#861e1f"],"AC_Ouroboros":["#eaeaf1","#b7b3bc","#dedfe7"],"AC_Sasrir":["#555174","#665e8c","#595874"],"PM_EarthMother":["#607472","#8c7e44","#74724e"],"PM_EternalBlazingSu":["#95712e","#c4932d","#9c7b46"],"PM_EvernightGoddess":["#742224","#ef2226","#742626"],"PM_GodofCombat":["#743852","#e29c54","#744c35"],"PM_GodofKnowledgean":["#355b91","#519fe5","#3d659c"],"PM_GodofSteamandMac":["#6d6c74","#8c7454","#746a67"],"PM_LordofMysteries":["#4f3574","#6a538c","#594274"],"PM_LordofStorms":["#597597","#76a3c4","#5c7f92"],"SR01":["#5a7450","#f1f1ba","#597450"],"SR02":["#2c5b74","#09558c","#2b5b74"],"SR03":["#3f746f","#1e8c88","#3e746f"],"SR04":["#543e74","#8c6446","#564174"],"SR05":["#537452","#f1f0b8","#547452"],"SR06":["#3a4574","#353c8c","#3a4574"],"SR07":["#354e74","#28478c","#344d74"],"SR08":["#743f26","#8c3806","#744028"],"SR09":["#354d74","#2e458c","#354e74"],"SR10":["#3a4574","#333a8c","#394474"],"SR11":["#583e74","#60198c","#573c74"],"SR12":["#4d745c","#368c61","#4a745b"],"SR13":["#4b5474","#6e7a8c","#4a5374"],"SR14":["#742f32","#8c2720","#742e31"],"TC_AlgerWilson":["#3f5374","#1e458c","#3e5274"],"TC_AudreyHall":["#4e745c","#258c4f","#4c745b"],"TC_Cattleya":["#644174","#6b248c","#634074"],"TC_DerrickBerg":["#74434e","#91696c","#74424e"],"TC_EmlynWhite":["#742d46","#8c093c","#742c45"],"TC_ForsWall":["#854642","#8c2d27","#844440"],"TC_GehrmanSparrow":["#464b74","#302d8c","#464a74"],"TC_KleinMoretti":["#625674","#7f7a8c","#625674"],"TC_LeonardMitchell":["#75272d","#8c0e18","#74262b"],"TC_XioDerecha":["#7e5436","#8c4b1a","#7c5234"],"OC01":["#384f74","#0f418c","#374f74"],"OC02":["#384f74","#528c69","#385074"],"OC03":["#384f74","#0d3f8c","#374f74"],"OC04":["#384f74","#0e408c","#385074"],"OC05":["#384f74","#0d3f8c","#374f74"],"OC06":["#384f74","#0d408c","#374f74"],"OC07":["#384f74","#f3a63a","#385074"],"OC08":["#384f74","#0d3f8c","#374f74"],"OC09":["#384f74","#0d408c","#374f74"],"OC10":["#374f74","#0c3f8c","#374f74"],"OC11":["#384f74","#93867a","#385074"],"OC12":["#384f74","#0d3f8c","#385074"],"OC13":["#384f74","#16468c","#385074"],"OC14":["#384f74","#0d3f8c","#384f74"],"OC15":["#384f74","#0d3f8c","#374f74"],"OC16":["#384f74","#0e3f8c","#374f74"],"OC17":["#384f74","#0c3f8c","#374f74"],"OC18":["#374f74","#0d408c","#374f74"],"OC19":["#384f74","#98243f","#374f74"],"OC20":["#384f74","#0d3f8c","#385074"],"OC21":["#384f74","#0e408c","#374f74"],"OC22":["#374f74","#0d3f8c","#374f74"],"PWC01":["#ffffff","#979082","#c8c7c7"],"PWC02":["#b2b1b1","#d0c7b3","#b2b1b0"],"PWC03":["#ffffff","#bfbaad","#e3e3e3"],"PWC04":["#e8e8e8","#b1a999","#d4d4d4"],"PWC05":["#cccccc","#8c5c53","#d0cfcf"],"PWC06":["#d9d8d8","#8c8577","#dbdbda"],"PWC07":["#b6b5b6","#b3ada0","#dedede"],"PWC08":["#ffffff","#a79c86","#dadada"],"PWC09":["#b2b0b0","#aba394","#d9d9d8"],"PWC10":["#c0bfbf","#d6cfc2","#c6c5c5"],"PWC11":["#cfcfcf","#a8997b","#e8e8e8"],"PWC12":["#c7c6c6","#b1aa9b","#e9e8e8"],"PWC13":["#ffffff","#ad9b77","#dfdede"],"PWC14":["#c9c8c8","#8c857c","#cac9c9"],"PWC15":["#c0bfbf","#aba69b","#bebebd"],"PWC16":["#b1b1b1","#988d77","#d7d7d7"],"PWC17":["#c4c4c4","#969289","#dedede"],"PWC18":["#b1b0b0","#8c877b","#cac9c9"],"PWC19":["#f5f4f4","#b19f77","#dbdada"],"PWC20":["#d0cfcf","#a89266","#ffffff"],"PWC21":["#ffffff","#8d8576","#cfcece"],"PWC22":["#f6f6f7","#8c867a","#d9d9d9"],"ML_AS01":["#94b6c7","#009de4","#889ea3"],"ML_AS02":["#efdb05","#fff400","#c5ca36"],"ML_AS03":["#d8dadb","#e3e1da","#3b5678"],"ML_AS04":["#d6d1cb","#dc7818","#b05a15"],"ML_AS05":["#cfc5c8","#ca145e","#8d2e57"],"ML_AS06":["#0098e0","#00a2eb","#076fb7"],"ML_AS07":["#cf436f","#f32371","#c93e73"],"ML_AS08":["#bbbcc4","#56638c","#384874"],"ML_AS09":["#e3dddc","#cb020b","#a90814"],"ML_AS10":["#d8dbdd","#6bb9f4","#3b7aa3"],"ML_SP01":["#7d4e9c","#f5a863","#505298"],"ML_SP02":["#6e4d8c","#cb5a3e","#6e549c"],"ML_SP03":["#b1b1d2","#d94062","#bf97be"],"ML_SP04":["#a44333","#ee4c1f","#b6512e"],"ML_SP05":["#3e5a74","#98123a","#375c74"],"ML_SP06":["#89a3c2","#1062be","#aca1a6"],"ML_SP07":["#dc7288","#cc4e8f","#df7f85"],"ML_SP08":["#245974","#9a6a58","#2a5b74"],"ML_SP09":["#3c6a74","#b2aa5e","#61aac3"],"ML_SP10":["#b6a9b9","#007cb8","#7d7b91"],"ML_SP11":["#135f91","#004f90","#375574"],"ML_SP12":["#9e9c73","#e1bf54","#8c8b75"],"ML_SP13":["#9e5e95","#ba6991","#9e5f92"],"ML_SP14":["#217a3c","#d5d536","#649f2a"],"ML_SP15":["#b27d41","#de6a0d","#936942"],"ML_SP16":["#b5524a","#eb7935","#da7a7e"],"ML_SP17":["#044b80","#00498c","#747370"],"ML_SP18":["#284c97","#053e99","#0073b0"],"ML_SP19":["#285079","#1a498c","#2a5074"],"ML_SP20":["#a57c4f","#f8ae42","#a47750"],"ML_SP21":["#97672c","#d99309","#675f74"],"ML_PR01":["#745117","#e6a00b","#986d13"],"ML_PR02":["#855c1c","#e69c00","#a4700e"],"ML_PR03":["#744c17","#e09f0d","#976614"],"ML_PR04":["#6e7455","#4293a5","#916c1a"],"ML_PR05":["#8a5330","#e29900","#a46214"],"ML_PR06":["#845130","#e69919","#b07415"],"ML_PR07":["#744a0f","#eaa100","#a65c08"],"ML_PR08":["#8e7792","#efad14","#9d6d16"],"ML_PR09":["#345e85","#e6a208","#a36e0b"],"ML_PR10":["#4c977a","#eaa206","#946b19"],"ML_PR11":["#8f7443","#3d6e9f","#9c6403"],"ML_PR12":["#745c4e","#eea208","#a48634"],"ML_PR13":["#b17f7c","#e09b0c","#95650f"],"ML_PR14":["#742b34","#a62b2d","#af660f"],"ML_PR15":["#a77241","#f5aa0f","#b67b17"],"ML_PR16":["#4c327b","#eda90d","#9a690a"],"ML_PR17":["#7b4f20","#e9a005","#a46e10"],"ML_PR18":["#744d2b","#4e5493","#9e670f"],"ML_PR19":["#745423","#7b8fbb","#9a6515"],"ML_PR20":["#745015","#e09a1d","#926207"],"ML_PR21":["#68756f","#6d76b4","#946e1a"],"ML_PR22":["#745c18","#f3d300","#a07706"],"ML_PR23":["#89583c","#edaa07","#a36708"],"ML_PR24":["#a68028","#ecaa0b","#af7614"],"ML_PR25":["#956c41","#f2ac14","#a97008"],"ML_PR26":["#8f876b","#3e4a8e","#ad811c"],"ML_PR27":["#cc8850","#e89a02","#b26e1c"],"ML_PR28":["#a32759","#dc9508","#976916"],"ML_PR29":["#499ca9","#eda50c","#9e711b"],"ML_PR30":["#745621","#268d9d","#95751d"],"ML_PR31":["#747a89","#ee9e12","#a16010"],"ML_PR32":["#804c28","#f09904","#a6690c"],"ML_PR33":["#744d16","#de8f06","#ac7110"],"ML_PR34":["#744e1c","#e29a00","#9f6711"],"ML_PR35":["#744d11","#df9903","#a87414"],"ML_PR36":["#746647","#4961a0","#9a6b1e"],"ML_PR37":["#745018","#efa105","#a46f0e"],"ML_PR38":["#74533b","#7f65ad","#a06f16"],"ML_PR39":["#74653e","#44668c","#986605"],"ML_PR40":["#74592a","#e89f0d","#9d6705"],"ML_PR41":["#7a6f55","#dc9b13","#9f6905"],"ML_PR42":["#8b5718","#e9a223","#a06909"],"ML_PR43":["#7a5a23","#e2a114","#a7710d"],"ML_ST01":["#c8b6ad","#b58047","#818c97"],"ML_ST02":["#5e6e74","#355b9d","#969aa4"],"ML_ST03":["#bdc4c6","#9b6d45","#746b58"],"ML_ST04":["#516274","#ce9b68","#a38f8a"],"ML_ST05":["#6f7274","#795e8c","#877d8d"],"ML_ST06":["#525574","#24558c","#766d83"],"ML_ST07":["#aca2af","#8c3144","#747482"],"ML_ST08":["#c3bcb8","#923736","#896f7d"],"ML_ST09":["#bcb8ae","#a14830","#746c64"],"ML_ST10":["#617374","#8c755f","#8f9184"],"ML_ST11":["#b4b6bb","#936b31","#576974"],"ML_ST12":["#e3e6e6","#8c5a62","#6a6574"],"ML_ST13":["#76545a","#a03734","#938a87"],"ML_ST14":["#cec5b6","#c19561","#74706b"],"ML_ST15":["#a2aebe","#a16031","#667274"],"ML_ST16":["#b0b5ce","#007ab0","#4f6774"],"ML_ST17":["#667374","#8d6b67","#7e7e7d"],"ML_ST18":["#b5b7c1","#135791","#245881"],"ML_ST19":["#6f746e","#a5825d","#a29891"],"ML_SH01":["#c57f2c","#f8bf2a","#7c5a19"],"ML_SH02":["#ab121b","#b9060f","#74090d"],"ML_SH03":["#67609d","#39298c","#3c2374"],"ML_SH04":["#864970","#bc3329","#742e57"],"ML_SH05":["#e7ad3b","#f9bd25","#925d15"],"ML_SH06":["#cd9f48","#fac22c","#95622b"],"ML_SH07":["#a81e23","#bb030c","#74060f"],"ML_SH08":["#8169b0","#453a8c","#382474"],"ML_SH09":["#48a675","#26ae7d","#07744c"],"ML_SH10":["#99263c","#ad0911","#741423"],"ML_SH11":["#309f89","#0b8c85","#027455"],"ML_SH12":["#8268a7","#9d6b4e","#4b2b74"],"ML_SH13":["#3f3575","#37208c","#3d1f74"],"ML_SH14":["#b0181b","#b9080c","#760f0d"],"ML_SH15":["#8294af","#d1912a","#624074"],"ML_SH16":["#a59180","#e3a833","#573074"],"ML_SH17":["#e9b237","#ffc623","#835f15"],"ML_SH18":["#902c36","#c3060e","#812b0d"],"ML_SH19":["#ac131d","#b8030c","#7e231e"],"ML_CL01":["#9b8763","#8c5b22","#ad9e54"],"ML_CL02":["#d0c1b9","#ce7136","#817696"],"ML_CL03":["#6984a3","#018fc7","#537186"],"ML_CL04":["#8294a1","#18648c","#a47378"],"ML_CL05":["#b5716e","#ae2023","#988c8e"],"ML_CL06":["#af5d70","#9d112f","#8d7075"],"ML_CL07":["#a89d7f","#008c9b","#8f9e9f"],"ML_CL08":["#c9caca","#65538c","#a29498"],"ML_CL09":["#baaca0","#c0522f","#b1897b"],"ML_CL10":["#99a8c9","#216dc1","#7b8998"],"ML_CL11":["#779fab","#8c5017","#848a89"],"ML_CL12":["#ccc6c2","#dc814c","#998d88"],"ML_CL13":["#b19182","#9b4020","#8f6f5a"],"ML_CL14":["#bda884","#dd9b51","#927c6e"],"ML_CL15":["#c0a06e","#ba6c11","#8c7969"],"ML_CL16":["#cac0bf","#9e2036","#a57e7f"],"ML_CL17":["#c3ac86","#f4cf05","#8b7a85"],"ML_CL18":["#b8a49a","#c87866","#957d81"],"ML_CL19":["#d0ae9b","#ae2a15","#845955"],"ML_CL20":["#a98198","#bd1e44","#907584"],"ML_OR01":["#0091d6","#00aff6","#2e79c1"],"ML_OR02":["#0093d8","#00abf5","#0065b5"],"ML_OR03":["#743793","#1d3b92","#472f7c"],"ML_OR04":["#782f89","#65128c","#4d1374"],"ML_OR05":["#cfa74f","#fbc44d","#b78a48"],"ML_OR06":["#0090d4","#00a4ef","#004e9a"],"ML_OR07":["#d59b2f","#df8908","#a36022"],"ML_OR08":["#d69e30","#dc840c","#b25e0e"],"ML_OR09":["#daa239","#de8911","#a8713a"],"ML_OR10":["#0093d8","#00aaf5","#104594"],"ML_OR11":["#6a2184","#72178f","#512274"],"ML_OR12":["#008cce","#00a5ef","#126da7"],"ML_OR13":["#6d2981","#64118c","#744b63"],"ML_OR14":["#6a2284","#75118c","#551f74"],"ML_OR15":["#7f437b","#68118c","#4d1874"],"ML_OR16":["#d79c2e","#da8a13","#a86019"],"ML_OR17":["#733384","#69188c","#632b76"],"ML_OR18":["#0094d3","#00a9f6","#1b4f81"],"ML_OR19":["#792888","#d07132","#682474"]};
const edgeStyle = id => { const e = CARD_EDGE[id]; return e ? ` style="--e1:${e[0]};--e2:${e[1]};--e3:${e[2]}"` : ''; };
const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
// flavour text per card id (to be written later); placeholder until then
const FLAVOR = {"SSR01": "He’s also a guardian, a miserable wretch that is constantly fighting against threats and madness!", "SSR02": "Dying, he knew not his executor; surviving, he knew not the circumstances.", "SSR03": "The revolution of the times is so obvious. To think I didn’t recognize this at all. I just simply believed his words and the “evidence” he showed. An epoch where the old gods fade and new gods arise is about to descend. The tides of history are roaring in an unstoppable manner…", "SSR04": "I don’t care if you’re God or The Fool, my prayers will not change. I hope that the people of the City of Silver will be freed from the curse of their destinies. I hope that the sun and sky described in the books will appear in our skies.", "SSR05": "Life is short. There are too many things that we need to do, why must we waste our time on such uninteresting, menial tasks?", "SSR06": "The dark, silent environment is still alright, but it’s just a little cold… But without dolls, newspapers, books, and historical documents, this life is meaningless…", "SSR07": "She taught me, and she held me by the hand as we adventured. She watched me grow up. To me, she’s my captain and my teacher, as well... as well as my mother...", "SSR08": "There are many special people in this world that can always do things others can't, such as you... and me.", "SSR09": "I’m usually popular with animals… For example, mosquitoes…", "SSR10": "From the beginning, you've been a guardian. You mimicked others until you were mimicked by others.", "SSR11": "Perhaps, there are chances amidst inevitability, and in chance, there is inevitability?", "SSR12": "I wouldn’t reject them from giving me money. That’s basic courtesy.", "SSR13": "Is this decidophobia? It also gives the strong vibes of a charlatan…", "SSR14": "Always remember you are a he, not a ‘He’.", "SSR15": "Don’t ask us why we’re taking such risks. Life often requires some excitement, joy, and anticipation.", "CB00": "Miracles are only for a moment, but fate is often a long-lasting event.", "CB01": "If only I could understand what the murmurs are saying… I wish to die in the know, and not be buried clueless…", "CB02": "I once hated him and couldn’t understand him. That’s why I didn’t call him father for many years. It’s because he did too many things against the trend of the times and hurt the innocent. I couldn’t accept my heroic father turning into a crazy tyrant…", "CB03": "With one more person knowing, there might be one more chance of a solution presenting itself. Even if the chances are slim, it’s better than nothing.", "CB04": "I was an emperor for many years, stood at the pinnacle of human power. I faced True Gods, fought Angels, had followers willing to die for me. I brought the light of civilization to that era. What regrets could I possibly have in this life?", "CB05": "Are you willing to remain on the ship as cowards, or do you want to follow me into battle as a hero to show your devotion to the Lord?", "CB06": "I plan to leave this place and enter the cosmos. That place is much more exciting than the real world. Perhaps I’ll understand the two things you mentioned as a result of this.", "CB07": "What I’m most fond of is to mix in a truth or two every few bluffs, allowing me to wait for fellows who think they’ve seen through my disguise to step into a trap. It’s just like the mistakes you two idiots made back then.", "CB08": "Go. Open that door. I want to see what the sunlight outside is like…", "CB09": "If you don’t return, I would do the same.", "CB10": "Giving me fake ice cream isn’t equivalent to fooling fate.", "CB11": "Good afternoon, Mr. Fool!", "CB12": "Mysteries. Go to the Giant King's Court and meet Sasrir.", "CB13": "Sleep isn’t a bad thing either. At least I’ll have dreams. In my dreams, I never left, accompanying her while taking in the sun while guiding that stubborn son of mine to use the broadsword. I’ll also make a swing for that little kid that loves to wheedle…", "CB14": "In the beginning, it was to not be bullied by others. Now, it’s to have the strength to protect myself and my companions, and revenge, as well as spread the principle of temperance.", "CB15": "Soon after, the Mother Tree of Desire was born, giving rise to life and introducing evil and desire.", "CB16": "The teacher who pursues knowledge,\nThe researcher of spirit world creatures,\nVice Admiral Iceberg of the seas, who hails from Lenburg.", "CB17": "Little Sun? How is he “little”? That fellow is clearly taller and larger than me...", "CB18": "If I really choose to make the attempt, it’s definitely not for myself, but for all Sanguine!", "CB19": "So, I want to be the Sun… When there was a Sun shining over the land, we had never encountered any curse.", "CB20": "If not for this, do you think we can avoid the torrent of fate?", "CB21": "I’d rather come face to face with Pirate Admirals or even Kings than run into a bloke named Frank Lee.", "AC_Adam": "Can you accept such an outcome?", "AC_Amon": "Doing something that doesn’t match your expectations is also a form of deception.", "AC_Aucuses": "Because He is the proud Sun.", "AC_Herabergen": "If you truly grasp the allure of knowledge and understand the joy of learning, even a long life will not be plagued by emptiness or torment.", "AC_Leodero": "The Storm will not destroy itself! Nor will it surrender!", "AC_Medici": "I’ll say it again. You have talent in being a Provoker.", "AC_Ouroboros": "The Angel of Fate is a loyal follower of the Lord - firm, brave, honest, having been that way from the time when ‘He’ was weak till ‘He’ became strong.", "AC_Sasrir": "The Dark Angel was the first angel created by the Lord. ‘He’ is ‘His’ left hand, ‘His’ proxy and the deputy of Heaven.", "PM_EarthMother": "Some things must be done. Some hopes must be fought for.", "PM_EternalBlazingSu": "Remember, dispel the darkness and praise the sun.", "PM_EvernightGoddess": "The era that was buried in the past is a memory shared between us, and also the critical period in which our humanity was born, sprouted, and nourished. Even if I’ve had a long life, it remains my fondest memories.", "PM_GodofCombat": "Li-li-th?", "PM_GodofKnowledgean": "Knowledge embraces everything. Knowledge is everything…", "PM_GodofSteamandMac": "I really like this city, I like everything here, so when I don't have classes, I carry my bag and phone, walk around and take photos everywhere, recording every detail that makes up this civilization.", "PM_LordofMysteries": "You can address me as…The Fool.", "PM_LordofStorms": "A person should always be hopeful!", "SR01": "You seem to still be asleep, but it doesn’t matter. I’ll write to tell you about the interesting things that I’ve encountered, the interesting traditions, and interesting people.", "SR02": "My only request is that you can talk to me about history whenever you’re free.", "SR03": "The Angel of Mercury is the embodiment of fate, our Lord's most cherished angel.", "SR04": "Confidence might be a weakness at times.", "SR05": "Obviously, you don’t understand me. My current hobby has turned even more novel. If you can turn yourself into a rotten corpse or expose your white bones, then I’ll definitely be filled with interest in you.", "SR06": "“The…Real… Mutated…King…Of…Mushrooms…”", "SR07": "You, it’s really you! You really are still alive! Die together with them!", "SR08": "I tried my best exploring and fighting, hoping that future generations wouldn’t have to suffer such pain.", "SR09": "We saved Tingen.", "SR10": "If everyone can temper their desires, to not have wars and killing, there will be less misery.", "SR11": "I’ve already sold my soul to an evil god. The only meaning to life is vengeance.", "SR12": "My greatest hobby is to study soil and figure out cross-breeding techniques. Believe me, this is the future of humanity.", "SR13": "Heroes often exhibit a different demeanor from others when they are young.", "SR14": "What problems could there be? Although I’m mainly an adventurer who hunts treasure, I’m also a qualified part-time pirate.", "TC_AlgerWilson": "Even Gehrman Sparrow can’t stand my singing. How should I act as an Ocean Songster…", "TC_AudreyHall": "One has to be careful and cautious, not seeing things that shouldn’t be seen, and not hearing things that shouldn’t be heard.", "TC_Cattleya": "Is this my destiny, Your Majesty?", "TC_DerrickBerg": "There are mushrooms that can produce milk!", "TC_EmlynWhite": "I only like puppets and pure, beautiful girls!", "TC_ForsWall": "Don’t you know I have a severe case of procrastination?", "TC_GehrmanSparrow": "For my dream. And… protect.", "TC_KleinMoretti": "If you don't want to give it to me, so be it... But why did you kill my marionette...", "TC_LeonardMitchell": "Die! Ince Zangwill!", "TC_XioDerecha": "Does every author have a sickness of procrastination?", "OC01": "In the future, the souls I graze will only come from people who have committed heinous and unforgivable crimes.", "OC02": "It’s called ‘Leymano's Travels’, but we prefer calling it ‘Leymano’s Spellbook’.", "OC03": "Death Knell? Striking the enemy's death knell with every shot? I like this name...", "OC04": "The holder can feel the deep, serene power flowing within the charm.", "OC05": "It can also deal with vengeful and evil spirits to a certain extent.", "OC06": "A semicircular piece of silver filled with indecipherable Hermes phrases as well as symbolic imagery and numbers.", "OC07": "I want light and there will be light...", "OC08": "This is extremely reasonable. This is the diagnosis by the best, most professional psychiatrist!", "OC09": "Great Master, are you afraid?", "OC10": "I have returned.", "OC11": "If you could’ve stolen some of its power back then, things wouldn’t have…", "OC12": "Divining whether the divination itself is dangerous is useless.", "OC13": "Tonight, Gehrman joins the hunt.", "OC14": "It's faith towards the Goddess, but for The Fool, it's worship.", "OC15": "Unknown Celestial Globe which connects to the Sefirah Castle.", "OC16": "The Hidden Sage is an embodiment of knowledge itself.", "OC17": "15% chance of inflicting a numbing effect on the enemy and a 5% chance of producing a bolt of lightning. If used in a thunderstorm, the chance of the lightning bolt will be raised to 50%.", "OC18": "Life’s too short to impose limits upon oneself. Break free from unnecessary restrictions and explore. You’ll have more fun and live a truly different life.", "OC19": "If only she didn't speak or move, then she would be perfect.", "OC20": "Are you hoping that I can fold a paper crane for you in my mother’s tummy? Even if I can, you won’t be able to get it!", "OC21": "A human skull. The skull’s eye sockets were deeply recessed and dark; it was impossible to see the bottom.", "OC22": "Once, someone used the Staff of the Stars to release 'Lightning Storm,' but he ended up turning himself into a frog.", "PWC01": "Although I'm also a Seer, I still have to say that, in terms of horror, terror, and bizarreness, our pathway is definitely ranked amongst the top three…", "PWC02": "The Apprentice Pathway that represented the concept of \"Door\", alternate worlds, and space itself...", "PWC03": "The Savant pathway primarily focuses on mastering scientific knowledge, enhancing memory, intelligence, and logical reasoning abilities.", "PWC04": "Do you know what the Demoness Pathway symbolizes?\nIt symbolizes catastrophe and apocalypse, and also symbolizes the feminine side of that initial Creator.", "PWC05": "As expected of the Black Emperor pathway. It finds loopholes in “order” while it appears domineering.", "PWC06": "However, at sea, the Storm pathway is really powerful. They’re practically mobile calamities.", "PWC07": "It's a trojan horse of destiny, the worm that erodes time, the loopholes in rules, the manifestation of all errors.", "PWC08": "Therefore, Hunters must rely more on their personal growth amidst blood, fire, chaos, and conflict. Many Hunters meet their end, using their bones to forge the Red Priest who conquers all.", "PWC09": "Be careful of the ‘Spectator’.", "PWC10": "The Mystery Pryer pathway is different from other pathways. From time to time, it will be chased by a large amount of knowledge. It’s impossible to ignore, and there’s no way to reject it even if one can’t handle it. And when one consumes a potion to advance, the situation of being chased by knowledge becomes even more serious.", "PWC11": "To some extent, they are the embodiment of Fate, able to travel freely in the River of Fate.", "PWC12": "The most terrifying Strength, the most Gigantic form, the most potent Devastation, the most unyielding Protection—together with Skill and experience, these compose individual Combat.", "PWC13": "Who do you think would be most likely to develop in the direction of being omnipotent and omniscient among all the present gods?", "PWC14": "It’s the Beyonder pathway that governs death and partly controls the spirit world.", "PWC15": "The mind is the prisoner of the body, and the body is the prisoner of the world. This refers to the madness that is restrained and the desire that is oppressed.", "PWC16": "The Devil pathway is highly individualistic. Unique wills, distinct hearts, and a penchant for desires all amalgamate to form the diverse nature of devils.", "PWC17": "We basically came to a consensus and believe that the Reader pathway represents the ‘omniscient’ part of ‘omnipotent and omniscient.’", "PWC18": "The power of Concealment, command over spirits, and the ability to create realistic dreams…", "PWC19": "The Moon represents spirituality, plants, beauty, parts of life, parts of darkness, and parts of mystery.", "PWC20": "The Sun pathway is truly exceptional. Befitting of the pathway that governs Purification.", "PWC21": "All living beings are equal before the law.", "PWC22": "Coming from here, returning to here—this is the origin; and to return to the origin is death."};
// Land of Dawn cards: a voice line of the hero on the card (the skin's own line when the skin has one).
// Source: Mobile Legends wiki, Hero/Audio pages (English).
const ML_FLAVOR = {"ML_AS01": "I am the moonlight that breaks through the darkness.","ML_SP01": "In Harmonia, my arrow flies towards hope!","ML_PR01": "Embrace the darkness to fight the darkness.","ML_PR02": "Still a Moon Elf. Now, powered by the latest tech.","ML_PR03": "The moon impartially sheds her grace on every corner of the forest.","ML_ST01": "May the moon forever shine upon us!","ML_SH01": "The way of the hunter: moderate, respectful, and sincere.","ML_CL01": "The forest might burn, the moon may be dark, but our hope outlives everything.","ML_OR01": "The way of the arrow: swift, silent, and precise.","ML_AS02": "Let the shining star show you the way.","ML_AS03": "The gun represents justice, when pointing at the bad guys.","ML_SP03": "Of course people pay attention to me... It's me!","ML_SP04": "Here comes the Blazing Gun of Justice!","ML_SP05": "Time to lay down the law!","ML_PR05": "That once little girl is gonna save someone this time.","ML_PR06": "Another interdimensional crisis averted!","ML_PR07": "My mom sacrificed her life for this city. I won’t let anything happen to it.","ML_ST03": "You can always find your own path to becoming a hero.","ML_SH03": "Now I know better, I’m stronger.","ML_CL03": "My gun only aims at the bad guys.","ML_AS04": "I will protect you.","ML_PR21": "The Noumenon core pulses vibrantly like the heart of Eruditio.","ML_PR22": "Size doesn’t define strength.","ML_PR23": "Just as steel toughens in the fire, tough challenges make me even stronger.","ML_ST09": "Let me show you how unbreakable I am.","ML_SH09": "Outfit checked; energy checked. I am all set for the mission.","ML_CL09": "Acknowledging my weaknesses doesn’t diminish my strength.","ML_OR08": "Real strength comes from shielding others.","ML_AS05": "It’s my way or the high way.","ML_ST12": "Be yourself and blaze your own trail.","ML_CL12": "Even the smallest speck of sand can become a sandstorm.","ML_OR11": "The name’s Ixia. Remember it!","ML_AS06": "Come on, Dexter! It's our showtime!","ML_SP15": "This'll be the heist of the century!","ML_PR36": "Dream! Fight! Set your soul ablaze!","ML_PR37": "Fortune favors the gold… I mean bold!","ML_ST15": "Lucky escape? That's what I'm good at.","ML_SH14": "Gold is dear, diamond is dearer. Neither can be given up though.","ML_CL15": "Show me the money!","ML_OR14": "Me, a thief? No, no, no. I'm only borrowing this.","ML_AS07": "Need some stitches? I can help.","ML_SP16": "Where words fail, melodies speak.","ML_PR38": "Under the eternal eclipse, chaos blooms from shadow.","ML_SH15": "Good girls avoid trouble, while I make it.","ML_CL16": "The distance between life and death is shorter than my needle.","ML_OR15": "Didn't your mother ever tell you? Never get too close to needles.","ML_AS08": "Play as a team, win as a team. It’s that simple.","ML_SP17": "Failure can never catch up with me.","ML_PR39": "This isn’t just a game, it’s a way of life.","ML_ST16": "Keep your eye on the ball.","ML_SH16": "Let’s get this match rolling!","ML_CL17": "Let’s show them why I am the captain.","ML_OR16": "Freedom is something we have to seek with our own power.","ML_AS09": "Here comes the firepower, victory is on me!","ML_SP18": "Calm and cool, just like ice.","ML_PR40": "Whoa, I'm a genius!","ML_ST17": "From courage to strength, we make the impossible possible!","ML_SH17": "Wonder if Eruditio has any new tech for me to play with- I mean, field test.","ML_CL18": "My greatest accomplishment? Making Papa proud of course!","ML_OR17": "I'll let my blasters do the talking.","ML_AS10": "Huh! Time to make the engine roar!","ML_SP19": "I am the frontline!","ML_PR41": "I put the “car” in carnage!","ML_PR42": "Even the smallest existence can burn with the fury of a sun.","ML_ST18": "Enjoy the adrenaline rush at lightning speed.","ML_SH18": "Buckle up! It’s gonna be a bumpy ride!","ML_CL19": "My spanner is handy for fast repairs and busting heads.","ML_OR18": "I don’t need a rearview mirror ‘cause I never look back.","ML_SP02": "Music is the strongest form of magic!","ML_PR04": "They sealed me away out of fear… How right they were.","ML_ST02": "What limits you is not magic itself, but the way you use it.","ML_SH02": "Would you like to have a drink with me?","ML_CL02": "Let's see who has the last laugh.","ML_OR02": "Give life to magic, not magic to life.","ML_SP06": "Hope shines even in my deepest slumber.","ML_PR08": "From the murkiest water, the purest water lily emerges.","ML_PR09": "The umbrella is Yang, the human is Yin. And I am what connects them.","ML_PR10": "Legends say that it may rain when Qinglong roars.","ML_ST04": "Umbrella, show us what you've got.","ML_SH04": "Do you want to be my Shikigami?","ML_CL04": "A thought to miss you, another to hate.","ML_OR03": "Let me read your fortune.","ML_SP07": "Guess who's the stunning brainiac detective? Yep, it's me Lylia!","ML_PR11": "You know? Magic will deeply connect us all.","ML_PR12": "Come on... Let's play some games, please?","ML_ST05": "Come, come! Let me show you some magic!","ML_SH05": "It's time to go to the Eruditio, for some fun!","ML_CL05": "We can be... good friends! Indeed.","ML_OR04": "Adults are so boring. I don't want to grow up.","ML_SP08": "Missions may be aborted, but justice won't.","ML_PR13": "Among a myriad of stars, the Valkyrie’s voyage begins!","ML_PR14": "Honor is earned on the battlefield, is it not, warrior?","ML_PR15": "I emerged from war to put an end to it.","ML_ST06": "Howling winds and freezing storms have honed our indomitable spirit.","ML_SH06": "Stand firm, and hold your ground!","ML_CL06": "We never claim to be undefeated, but unbreakable!","ML_OR05": "I am a daughter of Northern Vale. I swear to protect it till my last breath!","ML_SP09": "There’s duality in us all. Who do we become when it matters most?","ML_PR16": "Life is a duel, and I make the rules.","ML_PR17": "I live everyday, as if it's my last.","ML_ST07": "Darkness nurtured me, but it's time to end its reign.","ML_SH07": "The best assassination comes in the form of art.","ML_CL07": "No one sees me, I was never here.","ML_OR06": "How do you catch a shadow?","ML_SP10": "Wanwan is my name, and this is my stage.","ML_PR18": "I am an advanced species made of zero and one.","ML_PR19": "To me, fun is all that matters!","ML_PR20": "The Flying Swallow is here to clean up Martial City!","ML_ST08": "No one seems to know how nice I am.","ML_SH08": "Blind confidence will get you nowhere.","ML_CL08": "My darts bite!","ML_OR07": "You can try to catch me!","ML_SP11": "I'm the blizzard that hovers over evil!","ML_PR24": "To exist is to grasp a leaf in the wind.","ML_PR25": "Listen, it is the sound of the winds.","ML_PR26": "Music is the divine medium, and I am its conductor.","ML_ST10": "Nothing can't stop me from soaring to the skies.","ML_SH10": "In the name of the winds.","ML_CL10": "My magic flows as freely as the winds.","ML_OR09": "Behold, the fury of the winds!","ML_SP12": "Iron may break, but never my will.","ML_PR30": "A man with a spear is a fortress.","ML_PR31": "Valor isn’t the absence of fear, but the triumph over it.","ML_PR32": "A bright future awaits us.","ML_ST13": "Only the fearless heart can soar to the heavens.","ML_SH12": "Tranquil as a poem, but raging within.","ML_CL13": "Weapons are meant to protect, nothing else.","ML_OR12": "The Dragonborn is back.","ML_SP13": "Music transcends all languages.","ML_SP14": "Everyone possesses a burning spirit.","ML_PR33": "Darkness is the right hand of the Light.","ML_PR34": "The entire galaxy is in the palm of my hand.","ML_PR35": "I must break the code.","ML_ST14": "Bathe in the Holy Light.","ML_SH13": "I am only a shepherd.","ML_CL14": "May the Holy Light be with you!","ML_OR13": "Love others as love yourself.","ML_SP20": "The desert rose thrives in the most unforgiving places.","ML_SP21": "By design, not by fate.","ML_PR43": "There is no such thing as an accident, it is fate misnamed.","ML_ST19": "No secret is safe from me.","ML_SH19": "Let us share this momentary bliss.","ML_CL20": "You, don't want to dance?","ML_OR19": "The night sky tells all.","ML_PR27": "I am the apex of myth and machine!","ML_PR28": "All things perish, yet I remain.","ML_PR29": "Onimusha has no equal.","ML_ST11": "Motion synchronization complete.","ML_SH11": "I am not human, but something more.","ML_CL11": "Beta, initiate tracking sequence.","ML_OR10": "No other way than the Alpha way."};
const flavorOf = id => FLAVOR[id] || ML_FLAVOR[id] || '';
const RARITY_ORDER = ['ultimate','legendary','epic','rare','common'];
const POOL = Object.fromEntries(Object.keys(DECKS).map(d => [d, Object.fromEntries(RARITY_ORDER.map(r => [r, CARDS.filter(c => c.deck === d && c.rarity === r)]))]));
const setsOf = d => [...new Set(CARDS.filter(c => c.deck === d).map(c => c.set))];
const backOf = (c, ur) => DECKS[c.deck || 'tarot'][ur ? 'backUR' : 'back'];
// Images: img/cards/tarot, img/cards/mlbb (ML_…), img/scenes (SC01…), img/backs + img/packs (ids with a slash)
const imgPath = id => id.includes('/') ? id : id.startsWith('ML_') ? 'cards/mlbb/' + id : /^SC\d/.test(id) ? 'scenes/' + id : 'cards/tarot/' + id;
const cardImg = id => (window.CARD_IMG && window.CARD_IMG[id]) || `img/${imgPath(id)}.webp`;
const ownedCard = id => (S.cards && S.cards[id]) || 0;
const pickFrom = a => a[Math.floor(Math.random() * a.length)];

// Roll one deck: 5 cards, each by chance; at least one Rare or better; Ultimate guaranteed on the 10th deck without one.
function rollDeck(item){
  const o = item.odds, cuts = [o.ultimate, o.ultimate + o.legendary, o.ultimate + o.legendary + o.epic, o.ultimate + o.legendary + o.epic + o.rare];
  const roll = () => { const r = Math.random() * 100; return r < cuts[0] ? 'ultimate' : r < cuts[1] ? 'legendary' : r < cuts[2] ? 'epic' : r < cuts[3] ? 'rare' : 'common'; };
  const rar = Array.from({ length:item.cards }, roll);
  if (!rar.some(r => r !== 'common')) rar[Math.floor(Math.random() * rar.length)] = 'rare';
  const pity = (S.pity[item.id] || 0) + 1;
  let pityHit = false;
  if (!rar.includes('ultimate') && pity >= item.pity){ rar[Math.floor(Math.random() * rar.length)] = 'ultimate'; pityHit = true; }
  S.pity[item.id] = rar.includes('ultimate') ? 0 : pity;
  // the strongest cards come last, so the pack builds up to the big reveal
  rar.sort((a, b) => RARITY_ORDER.indexOf(b) - RARITY_ORDER.indexOf(a));
  // no card twice in one pack; a UR or SSR you already own only comes again once you own every one of that rarity in this pack
  const pool = POOL[item.deck || 'tarot'], used = new Set();
  const pick = r => {
    let list = pool[r].filter(c => !used.has(c.id));
    if (r === 'ultimate' || r === 'legendary'){ const missing = list.filter(c => !ownedCard(c.id)); if (missing.length) list = missing; }
    const c = pickFrom(list.length ? list : pool[r]); used.add(c.id); return c;
  };
  const cards = rar.map(pick);
  // Scene bonus: 15% per deck, never a duplicate, stops once all are collected
  const missing = deckOf(item).scenes ? SCENES.filter(sc => !S.scenes[sc.id]) : [];
  const scene = missing.length && Math.random() < .15 ? pickFrom(missing) : null;
  return { cards, scene, pityHit };
}

/* ---- Opening a deck ---- */
let opening = null, packClear = 0;
// where each card sits (Hearthstone-style star); the strongest card is dealt last, to the top
const PACK_SLOTS = [ { x:17, y:.95 }, { x:31, y:2.15 }, { x:69, y:2.15 }, { x:83, y:.95 }, { x:50, y:.5 } ];
// the label under a card, like Hearthstone's class name
const SET_LABEL = { 'SSR':'Signature', 'SR':'Character', 'Cards of Blasphemy':'Card of Blasphemy', 'Angels':'Angel', 'Objects':'Object', 'Pathways':'Pathway', 'Promo':'Promo', 'Puzzle':'Puzzle', 'Tarot Club':'Tarot Club' };
const setLabel = set => SET_LABEL[set] || set;
function openDeck(id){
  const item = SHOP.find(x => x.id === id);
  if (!item || owned(id) < 1 || opening) return;
  snap = null;
  S.inv[id] = owned(id) - 1;
  S.opened[id] = (S.opened[id] || 0) + 1;
  const res = rollDeck(item);
  const fresh = {};
  res.cards.forEach(c => { if (!ownedCard(c.id) && !fresh[c.id]) fresh[c.id] = true; gainCard(c.id); });
  if (res.scene) S.scenes[res.scene.id] = true;
  save();
  opening = { item, ...res, fresh, flipped:new Set(), done:false };
  // fully decode the art before showing the pack, so flipping never stalls
  const ids = [...res.cards.map(c => c.id), deckOf(item).back, deckOf(item).backUR, ...(res.scene ? [res.scene.id] : [])];
  opening.imgs = ids.map(id => { const im = new Image(); im.src = cardImg(id); return im; });
  Promise.all(opening.imgs.map(im => im.decode().catch(() => {}))).then(showOpening);
}
function showOpening(){
  const o = opening, ov = $('#pack'); if (!o) return;
  clearTimeout(packClear);
  ov.innerHTML = `
    <div class="pk-cards">${o.cards.map((c, i) => `
      <button class="pk-card r-${c.rarity}${c.rarity === 'ultimate' ? ' gold' : ''}" data-i="${i}" style="--d:${i * 110}ms;--rc:${RARITY[c.rarity].glow};--x:${PACK_SLOTS[i].x}%;--y:${PACK_SLOTS[i].y}">
        <span class="pk-aura"></span>
        <span class="pk-inner">
          <img class="pk-back" src="${cardImg(backOf(c, c.rarity === 'ultimate'))}" alt="">
          ${c.rarity === 'ultimate' ? '<span class="pk-glare"></span>' : ''}
          <span class="pk-front"><img src="${cardImg(c.id)}" alt="${esc(c.name)}"></span>
        </span>
        <span class="pk-tag"></span>
        <span class="pk-set">${esc(setLabel(c.set))}</span>
      </button>`).join('')}</div>
    <div class="pk-actions"><div class="pk-hint">Double-tap anywhere to reveal all</div></div>`;
  ov.classList.add('open');
  vibrate(15);
  ov.querySelectorAll('.pk-card').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); flipCard(+b.dataset.i); }));
}
// double-tap on empty space turns every card face up (taps on a card only affect that card)
let packTap = 0;
$('#pack').addEventListener('click', e => {
  const o = opening; if (!o || o.done || !$('#pack .pk-card')) return;   // not on the scene screen
  if (e.target.closest('.pk-card')){ packTap = 0; return; }   // taps on a card only flip / open that card
  const t = performance.now();
  if (t - packTap < 350){ packTap = 0; e.stopPropagation(); e.preventDefault(); revealAll(); }
  else packTap = t;
}, true);
$('#pack').addEventListener('dblclick', e => e.preventDefault());
// tapping empty space continues once every card is face up
$('#pack').addEventListener('click', () => { const o = opening; if (o && o.done) afterReveal(); });
function flipCard(i, quiet, lite){
  const o = opening; if (!o) return;
  const btn = $(`#pack .pk-card[data-i="${i}"]`); if (!btn) return;
  if (o.flipped.has(i)){ if (!quiet) inspectCard(o.cards[i].id); return; }
  o.flipped.add(i);
  const c = o.cards[i];
  btn.classList.add('flipped');
  btn.querySelector('.pk-tag').innerHTML = o.fresh[c.id] ? 'NEW' : `<em>×${ownedCard(c.id)}</em>`;
  // effects fire as the card turns face up (about halfway through the flip)
  setTimeout(() => { if (opening) revealFX(btn, c.rarity, lite); }, 180);
  if (o.flipped.size === o.cards.length) finishReveal();
}
/* Card reveal effects, bigger for rarer cards (C keeps the small burst). No shaking.
   R: blue sparks + ring.  SR: purple sparks, two rings, glints, "SR" pops up.
   SSR: orange screen glow, turning light rays behind the card, a fountain of sparks, "SSR" stamp.
   UR: the screen dims, a white-hot flash, red-gold rays, three shockwaves, embers rising, a huge "UR" slam. */
var RV_PAL = {
  rare:['80,190,255','150,215,255','230,245,255','40,140,230'],
  epic:['190,110,255','225,170,255','250,235,255','140,70,220'],
  legendary:['255,160,60','255,205,120','255,245,225','240,110,30'],
  ultimate:['255,70,60','255,200,90','255,245,230','255,120,40']
};
/* rarity pop-up lettering: hand-drawn angular U/R/S in chrome (no font needed) */
// custom angular lettering for the rarity pop-ups (only U, R, S are needed)
var RGLY={
 U:'M7 0V55L15 63H35L43 55V0',
 R:'M7 70V0H35L43 8V27L35 35H7M31 35L43 70',
 S:'M43 8L35 0H15L7 8V27L15 35H35L43 43V62L35 70H15L7 62'
};
function rarityLogo(txt, c1, c2, id){
  const W=50, gap=12, n=txt.length, w=n*W+(n-1)*gap+20, h=94;
  const d=[...txt].map((ch,i)=>`<path d="${RGLY[ch]}" transform="translate(${10+i*(W+gap)} 12)"/>`).join('');
  return `<svg class="rlogo" viewBox="0 0 ${w} ${h}" width="${w*1.25}" height="${h*1.25}" style="overflow:visible">
   <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".22" stop-color="#ffffff"/><stop offset=".48" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset=".53" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".62" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
   <filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
   <clipPath id="${id}c"><rect x="-20" y="-20" width="${w+40}" height="66"/><rect x="-20" y="49" width="${w+40}" height="80"/></clipPath></defs>
   <g transform="skewX(-12) translate(10 0)" fill="none" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="4">
    <g stroke="${c1}" stroke-width="18" filter="url(#${id}f)" opacity=".9">${d}</g>
    <g stroke="#120806" stroke-width="19">${d}</g>
    <g clip-path="url(#${id}c)">
     <g stroke="url(#${id}g)" stroke-width="13">${d}</g>
    </g>
   </g></svg>`;
}
function rvLayer(cls, html = ''){ const el = document.createElement('div'); el.className = 'rv ' + cls; el.innerHTML = html; $('#pack').appendChild(el); return el; }
function revealFX(btn, r, lite){
  const rect = btn.getBoundingClientRect(), [x, y] = mid(rect);
  if (r === 'common'){ FX.burst(x, y, .6); vibrate(10); return; }
  const pal = RV_PAL[r];
  btn.classList.add('rv-pop', 'rv-' + r);
  const TAGC = { epic:['#c07bff', '#6b2fd6'], legendary:['#ff9a2e', '#c2410c'], ultimate:['#ff4a3d', '#ffb02e'] };
  const tag = (txt, big) => { const t = rvLayer('rv-tag rv-t-' + r + (big ? ' big' : ''), rarityLogo(txt, ...TAGC[r], 'rl' + Math.random().toString(36).slice(2, 7))); t.style.left = x + 'px'; t.style.top = (rect.top - 6) + 'px'; setTimeout(() => t.remove(), 1600); };
  if (lite || S.reduceFx){ FX.burstC(x, y, r === 'rare' ? .8 : 1.2, pal); if (!lite && r !== 'rare') tag(r === 'epic' ? 'SR' : r === 'legendary' ? 'SSR' : 'UR', r !== 'epic'); return; }   // reveal-all / reduced effects: a small coloured burst (+ the rarity tag)
  if (r === 'rare'){ FX.burstC(x, y, 1.1, pal); vibrate(12); return; }
  if (r === 'epic'){
    FX.burstC(x, y, 1.6, pal); FX.ringC(x, y, 130, .8, 3, pal[1], .12); FX.glints(rect.left - 20, rect.top - 20, rect.width + 40, rect.height + 40, 8);
    tag('SR'); vibrate([15, 30, 15]); return;
  }
  const dim = r === 'ultimate' ? rvLayer('rv-dim') : null;   // UR: the room goes dark first
  const rays = rvLayer('rv-rays rv-r-' + r); rays.style.left = x + 'px'; rays.style.top = y + 'px';
  const glow = rvLayer('rv-glow rv-g-' + r); glow.style.setProperty('--x', x + 'px'); glow.style.setProperty('--y', y + 'px');
  if (r === 'legendary'){
    FX.burstC(x, y, 2.2, pal); FX.ringC(x, y, 160, .9, 4, pal[0]); FX.ringC(x, y, 220, 1, 2.5, pal[1], .18);
    FX.fountain(x, y, 18); FX.glints(rect.left - 30, rect.top - 30, rect.width + 60, rect.height + 60, 8);
    tag('SSR', true); vibrate([25, 40, 25]);
    setTimeout(() => { rays.remove(); glow.remove(); }, 2200);
    return;
  }
  // UR
  FX.flash(x, y, 300, .8); FX.burstC(x, y, 3, pal);
  [0, .15, .3].forEach((d, i) => FX.ringC(x, y, 180 + i * 90, 1.1, 5 - i, pal[i % 2], d));
  FX.fountain(x, y, 26); FX.embersC(x, y, 16, pal); FX.glints(0, rect.top - 120, innerWidth, rect.height + 240, 12);
  tag('UR', true); vibrate([40, 60, 80]);
  setTimeout(() => { rays.remove(); glow.remove(); dim.remove(); }, 2600);
}
function revealAll(){
  const o = opening; if (!o || o.revealing) return;
  const left = o.cards.map((_, i) => i).filter(i => !o.flipped.has(i)); if (!left.length) return;
  o.revealing = true; $('#pack .pk-actions').innerHTML = '';
  // the others turn over quickly with small effects; after a short beat the rarest one gets its full reveal
  // (running several big reveals at once is what made this stutter)
  const rank = i => RARITY_ORDER.indexOf(o.cards[i].rarity);   // 0 = UR
  const best = left.reduce((a, b) => rank(b) < rank(a) ? b : a), rest = left.filter(i => i !== best);
  rest.forEach((i, k) => setTimeout(() => { if (opening === o) flipCard(i, true, true); }, k * 120));
  setTimeout(() => { if (opening === o) flipCard(best, true); }, rest.length * 120 + (rank(best) <= 1 ? 450 : 120));
}
function finishReveal(){
  const o = opening;
  setTimeout(() => {
    if (opening !== o) return;
    o.done = true;
    $('#pack .pk-actions').innerHTML = `<div class="pk-hint">Click anywhere to continue</div>`;
  }, 700);
}
function afterReveal(){
  const o = opening; if (!o) return;
  if (o.scene){ const sc = o.scene; o.scene = null; o.done = false; return showScene(sc); }
  closeOpening();
}
function showScene(sc){
  const ov = $('#pack'), o = opening;
  ov.innerHTML = `
    <div class="sc-wrap">
      <div class="sc-title">Scene Unlocked</div>
      <div class="sc-img"><img src="${cardImg(sc.id)}" alt=""></div>
      <div class="sc-name">${esc(sc.name)}</div>
      <div class="pk-sub">${Object.keys(S.scenes).length} of ${SCENES.length} scenes</div>
      <div class="pk-hint">Click anywhere to continue</div>
    </div>`;
  setTimeout(() => { const r = ov.querySelector('.sc-img')?.getBoundingClientRect(); if (!r || !opening) return; FX.flash(...mid(r), 240, .7); FX.burst(...mid(r), 2); FX.glints(r.left, r.top, r.width, r.height, 10); }, 350);
  setTimeout(() => { if (opening === o) o.done = true; }, 700);   // short pause so a double tap doesn't skip it
  vibrate([30, 50, 60]);
}
function closeOpening(){
  opening = null;
  $('#pack').classList.remove('open');
  clearTimeout(packClear);
  packClear = setTimeout(() => { if (!opening) $('#pack').innerHTML = ''; }, 300);
  render();
}

/* ---- Looking at one card ---- */
function inspectCard(id, isScene){
  const c = isScene ? SCENES.find(x => x.id === id) : CARD_BY_ID[id]; if (!c) return;
  const ov = $('#inspect');
  ov.innerHTML = `<div class="in-wrap${isScene ? ' land' : ''}">
    <div class="in-card"><img src="${cardImg(id)}" alt="">${!isScene && (c.rarity === 'ultimate' || c.rarity === 'legendary') ? '<span class="pk-glare in-glare"></span>' : ''}</div>
    <div class="in-name">${esc(c.name)}</div>
    ${isScene ? '<div class="in-meta">Scene</div>' : `${flavorOf(id) ? `<p class="in-flavor">${esc(flavorOf(id))}</p>` : ''}<div class="in-meta"><b style="color:${RARITY[c.rarity].color}">${RARITY[c.rarity].name}</b> · ${esc(setLabel(c.set))}${c.hero ? ' · ' + esc(c.hero) : ''} · Owned ×${ownedCard(id)} · Collected ×${cardTotal(id)}</div>`}
  </div>`;
  ov.classList.add('open');
}
function closeInspect(){ $('#inspect').classList.remove('open'); }

/* ---- Collection ---- */
let colFilter = 'all', colGroup = 'all';
// each collection is its own group; new ones (other decks) get added here
const COLLECTIONS = [{ id:'tarot', name:'Tarot', sets:setsOf('tarot'), scenes:true }, { id:'mlbb', name:'MLBB', sets:setsOf('mlbb') }];
// finishing a whole set pays this much XP and gold (by the set's rarity)
const SET_REWARD = { common:20, rare:35, epic:50, legendary:100, ultimate:200 };
const SCENE_REWARD = 50, SCENES_KEY = '__scenes';
// A set can be claimed again and again: the first time needs one of every card,
// each later claim needs ×2 of every card and uses one copy of each (×2 → ×1, ×3 → ×2 ...).
const setTimes = key => +S.setClaims[key] || 0;   // how many times this set has been claimed (old saves stored true = once)
function setReady(set){
  const list = CARDS.filter(c => c.set === set), need = setTimes(set) ? 2 : 1;
  return list.length > 0 && list.every(c => ownedCard(c.id) >= need);
}
function claimBtn(key, done, rw, repeat){
  const times = setTimes(key), again = repeat && times > 0;
  if (times && !(again && done)) return `<button class="set-claim got" disabled>Claimed${times > 1 ? ` ×${times}` : ''}</button>`;
  return `<button class="set-claim${done ? ' ready' : ''}" ${done ? `data-act="setclaim" data-set="${esc(key)}"` : 'disabled'}>${again ? 'Again' : 'Claim'} <em>${rw}${ico('i-gem')} ${rw}${ico('i-coin')}</em></button>`;
}
// how many of a card you've collected in total; old saves didn't count it, so guess from owned + copies used by repeat claims
function cardTotal(id){
  if (S.cardsGot && S.cardsGot[id] != null) return S.cardsGot[id];
  const c = CARD_BY_ID[id], used = c ? Math.max(0, setTimes(c.set) - 1) : 0;
  return ownedCard(id) + used;
}
function gainCard(id){
  if (!S.cardsGot) S.cardsGot = {};
  S.cardsGot[id] = cardTotal(id) + 1;
  S.cards[id] = ownedCard(id) + 1;
}
function claimSet(set, el){
  if (set === SCENES_KEY){
    if (S.setClaims[set] || !SCENES.every(sc => S.scenes[sc.id])) return;
    S.setClaims[set] = true;
    return grant({ xp:SCENE_REWARD, gold:SCENE_REWARD }, el.getBoundingClientRect(), 'All scenes unlocked', null, null, 1.6);
  }
  const list = CARDS.filter(c => c.set === set);
  if (!setReady(set)) return;
  snapshot();
  const n = SET_REWARD[list[0].rarity], times = setTimes(set);
  if (times) list.forEach(c => S.cards[c.id] = ownedCard(c.id) - 1);   // repeat claims use up one copy of each card
  S.setClaims[set] = times + 1;
  grant({ xp:n, gold:n }, el.getBoundingClientRect(), times ? `${setLabel(set)} set claimed again (×${times + 1})` : `${setLabel(set)} set complete`, null, null, 1.6);
}
// Puzzle: the 8 pieces side by side as one picture that loops forever left and right
function puzzleStrip(list){
  const pieces = [...list].sort((a, b) => a.id.localeCompare(b.id));
  const one = pieces.map(c => `<div class="pz${ownedCard(c.id) ? '' : ' dark'}" ${ownedCard(c.id) ? `data-act="inspect" data-id="${c.id}"` : ''}><img loading="lazy" decoding="async" src="${cardImg(c.id)}" alt=""></div>`).join('');
  return `<div class="pz-strip" id="pzStrip"><div class="pz-track">${one}${one}${one}</div></div>`;
}
function setupPuzzle(){
  const el = $('#pzStrip'); if (!el) return;
  const third = () => el.scrollWidth / 3;
  requestAnimationFrame(() => { el.scrollLeft = third(); });
  el.addEventListener('scroll', () => {
    const t = third();
    if (el.scrollLeft < t * .5) el.scrollLeft += t;
    else if (el.scrollLeft > t * 1.5) el.scrollLeft -= t;
  }, { passive:true });
  // on PC: mouse wheel and click-drag move the strip sideways (phones swipe natively)
  el.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){ el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive:false });
  let down = null, moved = false;
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = { x:e.clientX, id:e.pointerId }; moved = false; el.classList.add('drag'); });
  el.addEventListener('pointermove', e => { if (!down) return; if (!moved && Math.abs(e.clientX - down.x) > 4){ moved = true; el.setPointerCapture(down.id); } if (moved){ el.scrollLeft -= e.clientX - (down.last ?? down.x); down.last = e.clientX; } });
  const up = () => { if (down){ down = null; el.classList.remove('drag'); } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('click', e => { if (moved){ e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}

/* ================= Rendering ================= */
const PLACEHOLDERS = {
  inventory: { icon:'i-chest', title:'Your satchel is empty', text:'Items you earn will be kept here.' },
  collection:{ icon:'i-cards', title:'No cards collected yet', text:'Cards from opened packs will be displayed here.' },
  shop:      { icon:'i-pouch', title:'The merchant has yet to arrive', text:'Soon you will trade gold for card packs here.' }
};
const TAB_TITLES = { quests:'Quests', progress:'Progress', inventory:'Pack', collection:'Collection', shop:'Shop' };
let fresh = { id:null, row:null };
let arranging = false;

let goldShown = 0, countTimer = null;
function countUp(el, from, to, delay, dur){
  cancelAnimationFrame(countTimer); el.textContent = fmt(from);
  if (from === to) return;
  setTimeout(() => { el.classList.remove('num-pop'); void el.offsetWidth; el.classList.add('num-pop'); }, delay);
  const start = performance.now() + delay;
  const step = t => {
    const k = Math.max(0, Math.min(1, (t - start) / dur)), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) countTimer = requestAnimationFrame(step);
  };
  countTimer = requestAnimationFrame(step);
}
let xpShown = null;
function renderHeader(){
  if (renderHeader.hold){   // a claim is in flight: only refresh gold now, XP comes with the gems
    if (renderHeader.tween){ renderHeader.tween = false; countUp($('#gold'), goldShown, S.gold, 620, 650); goldShown = S.gold; }
    return;
  }
  const delay = renderHeader.delay || 0; renderHeader.delay = 0;
  const leveled = renderHeader.fillFull; renderHeader.fillFull = false;
  const apply = () => {
    const { L, into, need } = levelInfo(S.xp);
    if (renderHeader.lastL !== L){ $('#lvlEmblem').innerHTML = emblem(L); renderHeader.lastL = L; }
    $('#lvlText').textContent = RANKS[tierOf(L)];
    $('#lvA').textContent = `Lv ${L}`; $('#lvB').textContent = `Lv ${L + 1}`;
    const fill = $('#xpFill'), txt = $('#xpText');
    $('.xpbar').classList.toggle('boss', isBossStep(L));
    $('#lvlText').classList.toggle('boss', isBossStep(L));
    if (isBossStep(L)) $('#lvlText').style.removeProperty('color'); else $('#lvlText').style.setProperty('color', TIER_COL[tierOf(L)], 'important');   // rank name in its rank colour
    if (isBossStep(L) && tierOf(L + 1) !== tierOf(L)) $('#lvlText').textContent = `${RANKS[tierOf(L)]} · Promotion to ${RANKS[tierOf(L + 1)]}`;
    if (leveled){
      // level up: run the bar to the end, flash it, then start the new level from empty
      fill.style.width = '100%'; $('.xpbar').classList.add('full'); txt.textContent = 'LEVEL UP';
      setTimeout(() => {
        const fr = fill.getBoundingClientRect(); FX.small(fr.right, fr.top + fr.height / 2);
        $('.xpbar').classList.remove('full');
        fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth;
        fill.style.transition = ''; const li = levelInfo(S.xp); fill.style.width = (li.into / li.need * 100) + '%';
        txt.textContent = `${fmt(li.into)} / ${fmt(li.need)} XP`; xpShown = li.into;
      }, 800);
    } else {
      fill.style.width = (into / need * 100) + '%';
      if (delay && xpShown != null && xpShown < into) countUpText(txt, xpShown, into, need, 600);
      else txt.textContent = `${fmt(into)} / ${fmt(need)} XP`;
      xpShown = into;
    }
  };
  delay ? setTimeout(apply, delay) : apply();
  if (renderHeader.tween){
    renderHeader.tween = false;
    countUp($('#gold'), goldShown, S.gold, 620, 650);
  } else if (goldShown !== S.gold || !$('#gold').textContent) $('#gold').textContent = fmt(S.gold);
  $('#purse').classList.toggle('neg', S.gold < 0);   // owing gold shows in red
  goldShown = S.gold;
}
function countUpText(el, from, to, need, dur){
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = `${fmt(Math.round(from + (to - from) * e))} / ${fmt(need)} XP`; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const openCount = () => S.quests.filter(q => q.kind !== 'scaling' && q.kind !== 'tally' && q.kind !== 'bounty' && !isTracker(q) && isVisible(q) && !isDone(q)).length
  + trackers().reduce((n, q) => n + stepsWindowDue(q), 0);
function renderTabs(){
  const sq = firstSteps();
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === S.tab);
    const badge = b.querySelector('.badge');
    const n = b.dataset.tab === 'quests' ? openCount() : b.dataset.tab === 'progress' && sq ? allStepsDue(sq) : 0;
    badge.textContent = n; badge.hidden = true;   // no notification badges
  });
}
function renderPanel(){
  $('#boardTitle').textContent = TAB_TITLES[S.tab];
  $('#progMenu').hidden = S.tab !== 'progress';
  $('#openAllBtn').hidden = true;   // the Deck tab shows it when there is something to open
  $('#colSearchBtn').hidden = S.tab !== 'collection';
  $('#colSearchBtn').classList.toggle('on', colSearch);
  $('#colSearchBox').hidden = S.tab !== 'collection' || !colSearch;
  if (S.tab !== 'progress') $('#progPop').classList.remove('open');
  if (S.tab === 'quests'){
    const visible = S.quests.filter(q => isVisible(q) && q.kind !== 'scaling' && q.kind !== 'tally' && q.kind !== 'bounty' && !isTracker(q));
    const done = visible.filter(isDone).length;
    $('#boardSub').textContent = arranging ? 'Drag the dots to reorder' : visible.length ? '' : 'Post a quest to begin';
    const top = S.quests.filter(q => !q.parent);
    $('#panel').innerHTML = `${!top.length ? '<div class="list qboard"><div class="empty">The board is empty.</div></div>'
      : arranging ? `<div class="list qboard">${questTree(top)}</div>` : questBoard()}
      <div class="board-actions">${arranging
        ? '<button class="post" id="arrangeBtn">Done arranging</button>'
        : '<button class="post" id="postBtn">+ Post a quest</button><button class="post alt" id="arrangeBtn">Arrange</button>'}</div>`;
  } else if (S.tab === 'progress'){
    { const pq = S.pview && S.pview !== 'steps' && byId(S.pview) && isTracked(byId(S.pview)) ? byId(S.pview) : null;
      $('#boardSub').textContent = ''; }
    $('#panel').innerHTML = renderProgress();
  } else if (S.tab === 'inventory'){
    const total = SHOP.reduce((a, it) => a + owned(it.id), 0);
    $('#boardSub').textContent = '';
    $('#panel').innerHTML = renderInventory();
  } else if (S.tab === 'collection'){
    const have = CARDS.filter(c => ownedCard(c.id)).length;
    $('#boardSub').textContent = '';
    $('#panel').innerHTML = renderCollection();
    setupPuzzle();
  } else if (S.tab === 'shop'){
    $('#boardSub').textContent = '';
    $('#boardTitle').insertAdjacentHTML('beforeend', infoHTML(SHOP[0]));   // drop rates are the same for every deck
    $('#panel').innerHTML = renderShop();
  } else {
    const p = PLACEHOLDERS[S.tab];
    $('#boardSub').textContent = 'Coming soon';
    $('#panel').innerHTML = `<div class="card placeholder">${CORNERS}
      <svg class="big-ico" viewBox="0 0 24 24"><use href="#${p.icon}"/></svg>
      <h3>${p.title}</h3><p>${p.text}</p>
      ${S.tab === 'shop' ? `<div class="rewards" style="justify-content:center;margin-top:14px"><span class="gold-r">${ico('i-coin')}${fmt(S.gold)} gold in your purse</span></div>` : ''}
    </div>`;
  }
}
function render(){ const sk = document.getElementById('skPop'); if (sk) sk.remove(); renderHeader(); renderTabs(); renderPanel(); fresh = { id:null, row:null };
  const on = document.querySelector('.chip.on'); if (on){ const box = on.parentElement; box.scrollLeft = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2; } }

/* ================= Actions ================= */
let snap = null;
const snapshot = () => { snap = JSON.stringify(S); };

// what the quests paid today (shown in the summary at the top of the Quests tab)
function bumpToday(xp, gold){
  const k = dayKey(); if (!S.today || S.today.day !== k) S.today = { day:k, xp:0, gold:0 };
  S.today.xp = Math.max(0, S.today.xp + xp); S.today.gold = Math.max(0, S.today.gold + gold);
}
function grant(reward, rect, msg, freshId, freshRow, power){
  reward.xp = Math.round(Math.min(REWARD_CAP, Math.max(0, +reward.xp || 0)));
  reward.gold = Math.round(Math.min(REWARD_CAP, Math.max(0, +reward.gold || 0)));
  if (S.xp + reward.xp > XP_CAP) reward.xp = Math.max(0, XP_CAP - S.xp);
  if (S.gold + reward.gold > GOLD_CAP) reward.gold = Math.max(0, GOLD_CAP - S.gold);
  const oldL = levelInfo(S.xp).L;
  bumpToday(reward.xp, reward.gold);
  S.xp += reward.xp; S.gold += reward.gold;
  const newL = levelInfo(S.xp).L;
  let lvGold = 0;
  for (let L = Math.max(oldL, S.rewardedLevel || 1) + 1; L <= newL; L++) lvGold += levelReward(L);
  if (newL > (S.rewardedLevel || 1)) S.rewardedLevel = newL;
  S.gold += lvGold;
  const paid = reward.xp > 0 || reward.gold > 0;
  save();
  fresh = { id:freshId, row:freshRow || null };
  if (paid) renderHeader.tween = true;
  if (newL > oldL) renderHeader.fillFull = true;
  const holdXp = paid && rect && reward.xp > 0;     // the gems will deliver the XP, so the bar waits for them
  if (holdXp){ renderHeader.hold = true; }
  render();
  renderHeader.hold = false;
  requestAnimationFrame(() => celebrate(reward, rect, freshId, power, newL, oldL, paid));
  vibrate(paid ? [18, 40, 22] : 10);
  showToast(msg, true);
  if (newL > oldL) setTimeout(() => showLevelUp(newL, lvGold), 1050);
}
function celebrate(reward, rect, freshId, power, newL, oldL, paid){
  const swirl = celebrate.swirl; celebrate.swirl = false;
  if (paid && swirl && rect){   // small claims (goal coin): a swirl on the spot, then the reward flies to the purse
    FX.swirl(...mid(rect));
    if (reward.gold > 0) flyCoins(rect, reward.gold);
    if (reward.xp > 0){ floatText(rect, `+${reward.xp} XP`); flyGems(rect, reward.xp); renderHeader.delay = 780; }
    if (reward.gold > 0) setTimeout(() => floatText(rect, `+${reward.gold} gold`, 'gold'), 160);
    if (renderHeader.delay) renderHeader();
    return;
  }
  if (paid){
    // light sweep over the card you just claimed
    let card = freshId && document.querySelector(`.item[data-id="${freshId}"] > .card`);
    if (!card && rect){ const hit = document.elementFromPoint(...mid(rect)); card = hit && hit.closest('.card'); }
    if (card){ card.classList.add('shine'); if (card.classList.contains('done')) card.classList.add('just');
      setTimeout(() => card.classList.remove('shine', 'just'), 1500); borderSwirl(card); }
    if (rect){
      const pw = power || 1 + Math.min(1.2, (reward.xp + reward.gold) / 90);
      FX.burst(...mid(rect), pw);
      if (reward.gold > 0) flyCoins(rect, reward.gold);
      if (reward.xp > 0){ floatText(rect, `+${reward.xp} XP`); flyGems(rect, reward.xp); renderHeader.delay = 780; }
      if (reward.gold > 0) setTimeout(() => floatText(rect, `+${reward.gold} gold`, 'gold'), 160);
    }
    if (renderHeader.delay) renderHeader();
  }
}

/* ================= Streaks =================
   Regular quests and pairs keep a streak: done in every cycle in a row (daily, 2-day, 3-day…).
   Each full 5 in the streak adds ×0.1 to the reward: streak 1–5 ×1, 6–10 ×1.1, 11–15 ×1.2 … (always rounded down). */
const hasStreak = q => q.kind === 'standard' || q.kind === 'pair' || q.kind === 'target' || q.kind === 'avoid';   // these keep a streak
const streakReward = q => hasStreak(q) && q.showCount !== false;           // "Enable streak reward" in the quest form
const cycleDays = q => { const p = parentOf(q); return (p ? p.days : q.days) || 1; };
function streakLast(q){ return q.kind === 'pair' ? q.lastBoth : q.doneUntil; }        // end of the last completed cycle
function streakNow(q){
  if (!hasStreak(q)) return 0;
  if (q.kind === 'avoid') return slippedToday(q) ? 0 : daysClean(q);                  // avoid: the streak is the days clean
  const last = streakLast(q), t = now();
  if (!last || !q.streak) return 0;
  return t < addDays(last, cycleDays(q) + vacationDays(last, t)) ? q.streak : 0;      // a whole cycle missed = streak lost (vacation days don't count)
}
// days of vacation mode between two times (whole days, including one that's still on)
function vacationDays(a, b){
  const list = [...(S.vacations || []), ...(S.vacation ? [{ from:S.vacation, to:now() }] : [])];
  let d = 0;
  list.forEach(v => { const f = Math.max(a, v.from), e = Math.min(b, v.to); if (e > f) d += Math.ceil((e - f) / 864e5); });
  return d;
}
// the streak this claim would count as (the current one if this cycle is already completed)
const streakNext = q => q.kind === 'avoid' ? daysClean(q) + (isDone(q) ? 0 : 1) : isDone(q) ? streakNow(q) : streakNow(q) + 1;
// bonus caps at +200% (x3.0) from a 101-day streak; a 200-day streak unlocks +250% (x3.5)
const streakSteps = n => n >= 200 ? 25 : Math.min(20, Math.floor(Math.max(0, n - 1) / 5));
const streakMult = n => 1 + streakSteps(n) / 10;
const boost = (v, n) => Math.floor(v * (10 + streakSteps(n)) / 10 + 1e-9);
const boosted = (q, xp, gold) => { const n = hasStreak(q) ? streakNext(q) : 0, r = streakReward(q) ? n : 0; return { xp:boost(xp, r), gold:boost(gold, r), n, mult:streakMult(r) }; };
// a pair's cycle counts once both halves are done
function pairCompleted(q){
  q.streakUndo = { streak:q.streak || 0, lastBoth:q.lastBoth || 0 };
  q.streak = streakNow(q) + 1; q.lastBoth = q.cycleEnd; q.bestStreak = Math.max(q.bestStreak || 0, q.streak);
}
function claimStandard(q, rect){
  if (isDone(q)) return;
  snapshot();
  const R = boosted(q, q.xp, q.gold);
  q.undo = { xp:R.xp, gold:R.gold, prevUntil:q.doneUntil, prevStreak:q.streak || 0 };
  logClaim(q.log ||= [], R.xp, R.gold);
  q.streak = R.n; q.bestStreak = Math.max(q.bestStreak || 0, q.streak);
  q.doneUntil = cycleEndFor(q);
  q.count++;
  grant({ xp:R.xp, gold:R.gold }, rect, R.n > 1 ? `${q.name}: Complete · streak ${R.n}` : `${q.name}: Complete`, q.id);
}
function claimScaling(q, rect){
  snapshot();
  const ws = periodStart(q);
  if (q.week !== ws){ q.week = ws; q.weekClaims = 0; }
  const reward = scaledReward(q, q.weekClaims + 1);
  q.weekClaims++; q.count++;
  logClaim(q.log ||= [], reward.xp, reward.gold);
  grant(reward, rect, `${q.name}: claim #${q.weekClaims} this week`, q.id, null, Math.min(2.6, .9 + q.weekClaims * .35));
}
// Records pay one reward per full "step" beyond the point already paid for,
// so 0.5 kg steps never lose the leftover between entries.
function submitRecord(q, input, rect){
  const v = round2(parseFloat(input.value));
  if (!isFinite(v) || v <= 0 || v > VALUE_CAP){ shake(input); return; }
  snapshot();
  const prevBest = q.best, prevPaid = q.paidTo, lower = q.better === 'lower';
  q.entries.push({ t:now(), v });
  q.count++;
  q.doneUntil = cycleEndFor(q);
  let reward = { xp:0, gold:0 }, msg;
  if (q.best == null){
    q.best = v; q.paidTo = v; msg = `Starting point set: ${fmt(v)} ${q.unit}`;
  } else if (lower ? v < q.best : v > q.best){
    const ref = q.paidTo ?? q.best, gain = round2(lower ? ref - v : v - ref);
    const units = Math.floor(gain / q.step + 1e-9);
    if (units > 0){
      reward = { xp:units * q.xpPer, gold:units * q.goldPer };
      q.paidTo = round2(lower ? ref - units * q.step : ref + units * q.step);
    }
    msg = `New best! ${fmt(round2(Math.abs(q.best - v)))} ${q.unit} ${lower ? 'down' : 'up'} from ${fmt(q.best)}`;
    if (!units) msg += ` · ${fmt(round2(q.step - gain))} ${q.unit} more for a reward`;
    q.best = v;
  } else msg = `Recorded ${fmt(v)} ${q.unit}. Best is still ${fmt(q.best)}`;
  q.undo = { prevBest, prevPaid, xp:reward.xp, gold:reward.gold };
  grant(reward, rect, msg, q.id);
}
function dueTotals(q){
  const keys = Object.keys(valsOf(q)).filter(k => stepDue(q, k).units > 0);
  return { keys, xp:keys.reduce((a, k) => a + stepDue(q, k).xp, 0), gold:keys.reduce((a, k) => a + stepDue(q, k).gold, 0) };
}
// take back what was already paid for one day of steps (it can be claimed again afterwards)
// undo the latest Recurring claim (this period) or the latest Tally entry
async function undoLast(q){
  const e = q.log && q.log[q.log.length - 1]; if (!e) return;
  const what = q.kind === 'tally' ? `the ${fmtU(q, e.v || 0)} entry` : 'the latest claim';
  if (!await ask(`Undo ${what}?`, 'Its reward will be taken back.', 'Undo')) return;
  take({ xp:e.xp || 0, gold:e.gold || 0 }); q.log.pop(); q.count = Math.max(0, (q.count || 0) - 1);
  if (q.kind === 'scaling') q.weekClaims = Math.max(0, (q.weekClaims || 0) - 1);
  if (q.kind === 'tally'){
    const v = e.v || 0, units = q.xpPer ? Math.round((e.xp || 0) / q.xpPer) : q.goldPer ? Math.round((e.gold || 0) / q.goldPer) : 0;
    q.total = Math.max(0, round2((q.total || 0) - v));
    q.carry = e.pc != null ? e.pc : Math.min(q.chunk, Math.max(0, round2((q.carry || 0) + units * q.chunk - v)));
  }
  snap = null; save(); hideToast(); render();
}
async function undoDay(q, key){
  const units = Math.floor((q.paid[key] || 0) / q.chunk); if (!units) return;
  const label = key === dayKey() ? 'today' : dayLabel(new Date(key + 'T00:00'));
  if (!await ask(`Undo steps for ${label}?`, 'Its reward will be taken back. You can claim it again.', 'Undo')) return;
  take({ xp:units * q.xpPer, gold:units * q.goldPer }); q.paid[key] = 0;
  snap = null; save(); hideToast(); render();
}
function claimAll(q, rect){
  const t = dueTotals(q);
  if (!t.keys.length) return;
  snapshot();
  t.keys.forEach(k => q.paid[k] = valsOf(q)[k]);
  grant({ xp:t.xp, gold:t.gold }, rect, `Claimed ${t.keys.length} ${t.keys.length === 1 ? 'day' : 'days'} of ${q.kind === 'tally' ? q.name : 'steps'}`, null, null, 1.6);
}
function claimDay(q, key, rect){
  const d = stepDue(q, key);
  if (!d.units) return;
  snapshot();
  q.paid[key] = d.steps;
  const label = key === dayKey() ? 'today' : dayLabel(new Date(key + 'T00:00'));
  grant({ xp:d.xp, gold:d.gold }, rect, `${q.kind === 'tally' ? q.name : 'Steps'} for ${label}: Claimed`, null);
}
// daily goal bonus: claimed from the gold coin under a day on the Progress chart
function claimGoal(q, key, rect){
  q.goalPaid ||= {};
  if (q.goalPaid[key] || !q.goal || (valsOf(q)[key] || 0) < q.goal) return;
  snapshot();
  q.goalPaid[key] = true;
  const label = key === dayKey() ? 'today' : dayLabel(new Date(key + 'T00:00'));
  weekChart.still = true; celebrate.swirl = true;   // keep the chart still; only the coin swirls
  setTimeout(() => { weekChart.still = false; }, 0);
  grant({ xp:q.goalXp || 0, gold:q.goalGold || 0 }, rect, `Daily goal reached ${label === 'today' ? 'today' : 'on ' + label}: bonus claimed`, null, null, 1.4);
}
// Reopening takes the quest's reward back. Gold may go below zero (you spent it already).
// If the lost XP drops you a level, that level's reward is taken back too, and is paid again when you re-reach it.
function take(r){
  bumpToday(-r.xp, -r.gold);
  const oldL = levelInfo(S.xp).L;
  S.xp = Math.max(0, S.xp - r.xp);
  S.gold -= r.gold;
  const newL = levelInfo(S.xp).L, paidTo = S.rewardedLevel || 1;
  for (let L = newL + 1; L <= Math.min(oldL, paidTo); L++) S.gold -= levelReward(L);
  if (paidTo > newL) S.rewardedLevel = newL;
}
async function reopen(q, key){
  if (q.kind === 'pair'){
    const r = q[key];
    if (!r.undo || !await ask(`Reopen “${r.name}”?`, `Its reward${q.bonusUntil > now() ? ' and the pair bonus' : ''} will be taken back.`, 'Reopen')) return;
    if (isDone(q) && q.streakUndo){ q.streak = q.streakUndo.streak; q.lastBoth = q.streakUndo.lastBoth; q.streakUndo = null; }
    take(r.undo); r.count = Math.max(0, r.count - 1); r.until = 0; r.undo = null; r.log && r.log.pop();
    if (q.bonusUntil > now() && q.bonusUndo){ take(q.bonusUndo); q.bonusCount = Math.max(0, q.bonusCount - 1); q.bonusUntil = 0; q.bonusUndo = null; q.bonusLog && q.bonusLog.pop(); }
    if (!(q.a.until > now()) && !(q.b.until > now())) q.cycleEnd = 0;
  } else if (q.kind === 'record'){
    if (!q.undo || !await ask('Remove your latest entry?', 'Any reward from it will be taken back.', 'Remove')) return;
    take(q.undo); q.entries.pop(); q.best = q.undo.prevBest; q.paidTo = q.undo.prevPaid; q.count = Math.max(0, q.count - 1); q.doneUntil = 0; q.undo = null;
  } else {
    if (!q.undo || !await ask(`Reopen “${q.name}”?`, 'Its reward will be taken back.', 'Reopen')) return;
    take(q.undo); q.count = Math.max(0, q.count - 1); q.doneUntil = q.undo.prevUntil; if (q.undo.prevStreak != null) q.streak = q.undo.prevStreak; q.undo = null; q.log && q.log.pop();
    if (q.kind === 'bounty') q.doneAt = 0;
  }
  snap = null; save(); hideToast(); render();
}

/* ================= Reset / testing ================= */
function resetProgress(){
  S.xp = 0; S.gold = 0; S.steps = {}; S.inv = {}; S.pity = {}; S.cards = {}; S.scenes = {}; S.setClaims = {}; S.opened = {}; S.rewardedLevel = 1;
  S.quests.forEach(q => {
    q.count = 0; q.undo = null; q.streak = 0; q.bestStreak = 0; q.lastBoth = 0; q.streakUndo = null;
    if (q.log) q.log = [];
    if (q.kind === 'pair'){ q.a.log = []; q.b.log = []; q.bonusLog = []; }
    if (q.kind === 'pair'){
      q.cycleEnd = 0; q.bonusCount = 0; q.bonusUntil = 0; q.bonusUndo = null;
      ['a','b'].forEach(k => Object.assign(q[k], { count:0, until:0, undo:null }));
    } else if (q.kind === 'scaling'){ q.week = 0; q.weekClaims = 0; }
    else if (q.kind === 'record'){ q.entries = []; q.best = q.start ?? null; q.paidTo = q.best; q.doneUntil = 0; }
    else if (q.kind === 'steps'){ q.paid = {}; q.goalPaid = {}; S.stepsMemo = null; }
    else if (q.kind === 'target'){ q.hits = 0; q.cycleEnd = 0; q.doneUntil = 0; }
    else if (q.kind === 'bounty'){ q.doneUntil = 0; q.doneAt = 0; }
    else if (q.kind === 'avoid'){ q.since = startOfDay(); q.best = 0; q.slips = []; q.slipDay = null; q.doneUntil = 0; }
    else if (q.kind === 'tally'){ q.carry = 0; q.total = 0; }
    else q.doneUntil = 0;
  });
}

/* ================= Effects =================
   A see-through canvas over the whole screen draws sparks, glints, embers and light rings.
   Nothing moves the screen itself. */
const FX = (() => {
  const cv = document.createElement('canvas'); cv.id = 'fx'; document.body.appendChild(cv);
  const g = cv.getContext('2d');
  let W = 0, H = 0, parts = [], running = false, last = 0;
  // soft glows don't need full phone resolution: 1.2x keeps them sharp enough at a fraction of the work
  function size(){ const d = Math.min(1.2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(d, 0, 0, d, 0, 0); }
  size(); addEventListener('resize', size);
  const GOLD = ['255,170,100','255,130,60','255,210,160','255,245,230'];
  const BLUE = ['200,228,245','150,195,225','235,246,252','120,170,210'];
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
  // glow images are drawn once and reused (much cheaper than building a gradient for every particle every frame)
  const SPR = {};
  function sprite(c, hot){
    const key = c + (hot ? 'h' : ''); if (SPR[key]) return SPR[key];
    const sz = 64, cnv = document.createElement('canvas'); cnv.width = cnv.height = sz;
    const x = cnv.getContext('2d'), gr = x.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    gr.addColorStop(0, hot ? 'rgba(255,248,240,1)' : `rgba(${c},1)`); gr.addColorStop(hot ? .4 : .35, `rgba(${c},${hot ? .45 : .45})`); gr.addColorStop(1, `rgba(${c},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, sz, sz); return SPR[key] = cnv;
  }
  // a 4-point twinkle star, drawn once (glints used to build a path + a glow every frame)
  let STAR = null;
  function starSprite(){
    if (STAR) return STAR;
    const sz = 64, h = sz / 2, cnv = document.createElement('canvas'); cnv.width = cnv.height = sz; const x = cnv.getContext('2d');
    x.drawImage(sprite('255,255,255'), sz * .05, sz * .05, sz * .9, sz * .9);
    x.fillStyle = 'rgba(255,248,240,1)'; x.beginPath();
    x.moveTo(h, 0); x.quadraticCurveTo(h, h, sz, h); x.quadraticCurveTo(h, h, h, sz); x.quadraticCurveTo(h, h, 0, h); x.quadraticCurveTo(h, h, h, 0); x.fill();
    return STAR = cnv;
  }
  const MAX = 140;
  // draw the glow images during quiet time at startup, so the first claim doesn't pay for it
  (window.requestIdleCallback || setTimeout)(() => { [...GOLD, ...BLUE, '255,255,255'].forEach(c => sprite(c)); sprite('255,130,60', true); starSprite(); });
  function add(p){ if (parts.length >= MAX || (S.reduceFx && p.type !== 'ring' && p.type !== 'flash' && Math.random() < .65)) return; parts.push(Object.assign({ vx:0, vy:0, g:0, drag:0, age:0, alpha:1 }, p)); if (!running){ running = true; last = performance.now(); requestAnimationFrame(tick); } }
  // only the area particles touched last frame is cleared (not the whole screen)
  let box = null;
  function tick(t){
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    if (box) g.clearRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    let n = 0;
    for (let i = 0; i < parts.length; i++){
      const p = parts[i];
      p.age += dt; if (p.age >= p.life) continue;
      parts[n++] = p; if (p.age < 0) continue;
      const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy = p.vy * f + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const R = draw(p) || 0, cx = p.type === 'orbit' ? p.cx : p.x, cy = p.type === 'orbit' ? p.cy : p.y;
      if (cx - R < x0) x0 = cx - R; if (cy - R < y0) y0 = cy - R; if (cx + R > x1) x1 = cx + R; if (cy + R > y1) y1 = cy + R;
    }
    parts.length = n;
    g.globalCompositeOperation = 'source-over';
    box = x1 > x0 ? [Math.max(0, x0 - 4), Math.max(0, y0 - 4), Math.min(W, x1 + 4), Math.min(H, y1 + 4)] : box;
    if (parts.length) requestAnimationFrame(tick); else { running = false; g.clearRect(0, 0, W, H); box = null; }
  }
  function draw(p){
    const k = 1 - p.age / p.life;
    if (p.type === 'spark'){
      const sp = Math.hypot(p.vx, p.vy) || 1, len = Math.min(22, sp * .04) + 2, a = p.alpha * k;
      g.strokeStyle = `rgba(${p.c},${a})`; g.lineWidth = p.r * (.4 + .6 * k);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * len, p.y - p.vy / sp * len); g.stroke();
      return len + p.r;
    } else if (p.type === 'ember'){
      const a = p.alpha * Math.min(1, k * 2) * (.75 + .25 * Math.sin(p.age * 14 + p.x)), r = p.r * 3;
      g.globalAlpha = a; g.drawImage(sprite(p.c), p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1;
      return r;
    } else if (p.type === 'glint'){
      const a = p.alpha * Math.sin(Math.PI * p.age / p.life), r = p.r * (.6 + .4 * Math.sin(Math.PI * p.age / p.life));
      g.globalAlpha = a; g.drawImage(starSprite(), p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1;
      return r;
    } else if (p.type === 'ring'){
      const e = 1 - Math.pow(k, 3), r = p.r + (p.r2 - p.r) * e;
      g.strokeStyle = `rgba(${p.c},${p.alpha * k})`; g.lineWidth = p.w * k + .5; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke();
      return r + p.w;
    } else if (p.type === 'orbit'){   // a mote circling a point while spiralling in
      const e = p.age / p.life, ang = p.a0 + p.spin * e, r = p.r0 + (p.r1 - p.r0) * e, a = p.alpha * Math.sin(Math.PI * e);
      const x = p.cx + Math.cos(ang) * r, y = p.cy + Math.sin(ang) * r, rr = p.r * 3;
      g.strokeStyle = `rgba(${p.c},${a * .7})`; g.lineWidth = p.r * .9;
      g.beginPath(); g.arc(p.cx, p.cy, r, ang - .5 * Math.sign(p.spin), ang, p.spin < 0); g.stroke();
      g.globalAlpha = a; g.drawImage(sprite(p.c), x - rr, y - rr, rr * 2, rr * 2); g.globalAlpha = 1;
      return r + rr;
    } else if (p.type === 'flash'){
      const a = p.alpha * Math.pow(k, 2), r = p.r * (1 + (1 - k) * .6);
      g.globalAlpha = a; g.drawImage(sprite('255,130,60', true), p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1;
      return r;
    }
  }
  return {
    // the main claim burst: a flash, a ring of light, sparks flying out, and a few twinkling stars
    burst(x, y, power = 1){
      power = Math.max(.6, Math.min(3, power));
      add({ type:'flash', x, y, r:70 * Math.sqrt(power), life:.45, alpha:.9 });
      add({ type:'ring', x, y, r:8, r2:60 * Math.sqrt(power), w:3.5, c:'255,170,110', life:.55 });
      const n = Math.round(16 * power);
      for (let i = 0; i < n; i++){
        const a = rnd(0, Math.PI * 2), sp = rnd(170, 430) * Math.sqrt(power);
        add({ type:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 80, g:560, drag:2.4, r:rnd(1.4, 2.8), c:pick(GOLD), life:rnd(.45, .9) });
      }
      for (let i = 0; i < Math.round(4 * power); i++)
        add({ type:'glint', x:x + rnd(-60, 60) * Math.sqrt(power), y:y + rnd(-45, 30) * Math.sqrt(power), vy:rnd(-30, -8), r:rnd(6, 12), c:'255,240,225', age:-rnd(.05, .4), life:rnd(.45, .8) });
      for (let i = 0; i < Math.round(5 * power); i++)
        add({ type:'ember', x:x + rnd(-30, 30), y:y + rnd(-10, 10), vx:rnd(-40, 40), vy:rnd(-120, -50), g:-10, drag:.8, r:rnd(1, 2.2), c:pick(GOLD), age:-rnd(0, .3), life:rnd(.8, 1.5), alpha:.9 });
    },
    // a small swirl of gold motes circling in on one spot (goal coin claim)
    swirl(x, y){
      for (let i = 0; i < 10; i++)
        add({ type:'orbit', x, y, cx:x, cy:y, a0:i / 10 * Math.PI * 2, spin:Math.PI * 2.2, r0:30, r1:4, r:rnd(1.2, 2), c:pick(GOLD), life:.75, age:-i * .015 });
      add({ type:'ring', x, y, r:4, r2:24, w:2, c:'255,201,74', life:.45, age:-.5 });
      add({ type:'flash', x, y, r:26, life:.35, alpha:.7, age:-.55 });
    },
    // coloured burst / ring for card reveals: pal = list of 'r,g,b'
    burstC(x, y, power, pal){
      power = Math.max(.6, Math.min(3.5, power));
      add({ type:'ring', x, y, r:8, r2:70 * Math.sqrt(power), w:3.5, c:pal[0], life:.6 });
      const n = Math.round(12 * power);
      for (let i = 0; i < n; i++){ const a = rnd(0, Math.PI * 2), sp = rnd(180, 460) * Math.sqrt(power);
        add({ type:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 80, g:520, drag:2.2, r:rnd(1.4, 3), c:pick(pal), life:rnd(.5, 1) }); }
      for (let i = 0; i < Math.round(3 * power); i++)
        add({ type:'glint', x:x + rnd(-70, 70) * Math.sqrt(power), y:y + rnd(-60, 40) * Math.sqrt(power), vy:rnd(-30, -8), r:rnd(6, 13), c:'255,250,245', age:-rnd(.05, .5), life:rnd(.5, .9) });
    },
    ringC(x, y, r2, life, w, c, delay = 0){ add({ type:'ring', x, y, r:10, r2, w, c, life, age:-delay }); },
    embersC(x, y, n, pal){ for (let i = 0; i < n; i++) add({ type:'ember', x:x + rnd(-60, 60), y:y + rnd(-20, 40), vx:rnd(-50, 50), vy:rnd(-220, -80), g:-12, drag:.6, r:rnd(1.2, 3), c:pick(pal), age:-rnd(0, .6), life:rnd(1.2, 2.4), alpha:.95 }); },
    small(x, y, tint){
      const P = tint === 'blue' ? BLUE : GOLD;
      add({ type:'ring', x, y, r:4, r2:26, w:2.5, c:tint === 'blue' ? '190,220,240' : '255,170,110', life:.4 });
      for (let i = 0; i < 8; i++){ const a = rnd(0, Math.PI * 2), sp = rnd(90, 220);
        add({ type:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 40, g:420, drag:3, r:rnd(1, 2), c:pick(P), life:rnd(.3, .55) }); }
    },
    glints(x, y, w, h, n){ for (let i = 0; i < n; i++) add({ type:'glint', x:x + rnd(0, w), y:y + rnd(0, h), r:rnd(5, 10), c:'255,240,225', age:-rnd(0, .6), life:rnd(.4, .7) }); },
    embers(n, fromY){ for (let i = 0; i < n; i++) add({ type:'ember', x:rnd(0, W), y:(fromY ?? H) + rnd(0, 30), vx:rnd(-25, 25), vy:rnd(-190, -80), g:-15, drag:.4, r:rnd(1.2, 3), c:pick(GOLD), age:-rnd(0, .5), life:rnd(1.6, 3.2), alpha:.95 }); },
    fountain(x, y, n){ for (let i = 0; i < n; i++){ const a = rnd(-Math.PI * .85, -Math.PI * .15), sp = rnd(300, 680);
      add({ type:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, g:620, drag:1.2, r:rnd(1.6, 3.2), c:pick(GOLD), age:-rnd(0, .25), life:rnd(1, 1.7) }); } },
    ring(x, y, r2, life = .8, w = 4){ add({ type:'ring', x, y, r:10, r2, w, c:'255,170,110', life }); },
    flash(x, y, r, life = .6){ add({ type:'flash', x, y, r, life, alpha:1 }); },
    trail(x, y){ add({ type:'ember', x, y, vx:rnd(-25, 25), vy:rnd(-70, -20), g:-20, drag:1, r:rnd(.9, 1.8), c:pick(GOLD), life:rnd(.5, .9), alpha:.9 }); },
    center(){ return [W / 2, H / 2]; }
  };
})();
const mid = r => [r.left + r.width / 2, r.top + r.height / 2];

/* Border swirl: two comets of light race around the card's frame (from opposite corners),
   shedding embers, then the frame flashes and the card pops up and settles. */
function borderSwirl(card){
  if (!BORDER_SWIRL || !card) return;
  const w = card.offsetWidth + 6, h = card.offsetHeight + 6, NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'swirl'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  // three strokes per comet: faint long tail, gold body, white-hot head
  const layers = [ { len:30, width:9, color:'rgba(34,211,238,.25)' }, { len:15, width:3.4, color:'#ff6b1a' }, { len:3.5, width:3.2, color:'#fffaf5' } ];
  const D = 1150, anims = [];
  [0, 50].forEach(start => layers.forEach(L => {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', 1.5); r.setAttribute('y', 1.5); r.setAttribute('width', w - 3); r.setAttribute('height', h - 3); r.setAttribute('rx', 4);
    r.setAttribute('pathLength', 100); r.setAttribute('stroke', L.color); r.setAttribute('stroke-width', L.width);
    r.setAttribute('stroke-dasharray', `${L.len} ${100 - L.len}`);
    svg.appendChild(r);
    // heads stay lined up: every layer ends at the same moving point
    const off = L.len - 30 - start;
    anims.push(r.animate([{ strokeDashoffset:off, opacity:0 }, { opacity:1, offset:.08 }, { opacity:1, offset:.85 }, { strokeDashoffset:off - 100, opacity:0 }],
      { duration:D, easing:'cubic-bezier(.45,.05,.35,1)', fill:'forwards' }));
  }));
  card.appendChild(svg);
  // embers shed from the two comet heads
  const t0 = performance.now(), per = 2 * (w + h);
  const box = card.getBoundingClientRect();   // measured once, not every frame
  const at = d => { d = ((d % per) + per) % per; const b = box, x0 = b.left - 3, y0 = b.top - 3;
    if (d < w) return [x0 + d, y0]; d -= w; if (d < h) return [x0 + w, y0 + d]; d -= h; if (d < w) return [x0 + w - d, y0 + h]; return [x0, y0 + h - (d - w)]; };
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  (function shed(){
    const k = (performance.now() - t0) / D; if (k >= 1 || !card.isConnected) return;
    const e = ease(Math.min(1, k)) * per;
    [e + per * .3, e + per * .8].forEach(d => { if (Math.random() < .3) FX.trail(...at(d)); });
    requestAnimationFrame(shed);
  })();
  // press in at the start, pop up when the comets meet, settle back
  card.animate([
    { transform:'none' }, { transform:'scale(.985)', offset:.07 }, { transform:'scale(1)', offset:.16 },
    { transform:'translateY(0) scale(1)', offset:.6 }, { transform:'translateY(-10px) scale(1.035)', offset:.72 },
    { transform:'translateY(2px) scale(.995)', offset:.86 }, { transform:'none' }
  ], { duration:D + 500, easing:'ease-out' });
  setTimeout(() => {
    if (!card.isConnected) return;
    card.classList.remove('flare'); void card.offsetWidth; card.classList.add('flare');
    const b = card.getBoundingClientRect();
    FX.glints(b.left, b.top - 8, b.width, 16, 5); FX.glints(b.left, b.bottom - 8, b.width, 16, 5);
    setTimeout(() => card.classList.remove('flare'), 800);
  }, D * .66);
  setTimeout(() => svg.remove(), D + 100);
}
function flyCoins(from, amount){
  const purse = $('#purse svg').getBoundingClientRect();
  const n = Math.min(6, Math.max(2, Math.ceil(amount / 6)));
  const sx = from.left + from.width / 2 - 11, sy = from.top + from.height / 2 - 11;
  const tx = purse.left + purse.width / 2 - 11, ty = purse.top + purse.height / 2 - 11;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div');
    el.className = 'fly'; el.innerHTML = ico('i-coin');
    document.body.appendChild(el);
    const rx = (Math.random() - .5) * 90, ry = (Math.random() - .5) * 40;
    el.animate([
      { transform:`translate(${sx}px,${sy}px) scale(.5)`, opacity:0 },
      { transform:`translate(${sx + rx}px,${sy - 50 + ry}px) scale(1.15)`, opacity:1, offset:.35 },
      { transform:`translate(${tx}px,${ty}px) scale(.8)`, opacity:1 }
    ], { duration:750, delay:i * 60, easing:'cubic-bezier(.45,0,.6,1)', fill:'both' }).onfinish = () => {
      el.remove();
      const p = $('#purse'); p.classList.remove('bump', 'glow'); void p.offsetWidth; p.classList.add('bump', 'glow');
      const ci = $('#purse svg'); ci.classList.remove('coin-pop'); void ci.getBoundingClientRect(); ci.classList.add('coin-pop');
      if (i === n - 1){ const r = $('#purse svg').getBoundingClientRect(); FX.small(r.left + r.width / 2, r.top + r.height / 2); }
    };
  }
}
// XP gems arc up from the quest into the XP bar; the bar fills as they land
function flyGems(from, xp){
  const bar = $('.xpbar').getBoundingClientRect(), fill = $('#xpFill').getBoundingClientRect();
  const n = Math.min(5, Math.max(2, Math.ceil(xp / 8)));
  const sx = from.left + from.width / 2 - 9, sy = from.top + from.height / 2 - 9;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div');
    el.className = 'fly gem'; el.innerHTML = ico('i-gem');
    document.body.appendChild(el);
    const tx = Math.max(bar.left + 4, Math.min(bar.right - 22, fill.right - 9 + (Math.random() - .5) * 40)), ty = bar.top + bar.height / 2 - 9;
    const rx = (Math.random() - .5) * 120, up = 70 + Math.random() * 50;
    el.animate([
      { transform:`translate(${sx}px,${sy}px) scale(.4) rotate(0deg)`, opacity:0 },
      { transform:`translate(${sx + rx}px,${sy - up}px) scale(1.2) rotate(${rx > 0 ? 160 : -160}deg)`, opacity:1, offset:.38 },
      { transform:`translate(${tx}px,${ty}px) scale(.7) rotate(${rx > 0 ? 360 : -360}deg)`, opacity:1 }
    ], { duration:720, delay:i * 55, easing:'cubic-bezier(.45,0,.55,1)', fill:'both' }).onfinish = () => {
      el.remove();
      FX.small(tx + 9, ty + 9, 'blue');
      const b = $('.xpbar'); b.classList.remove('gain'); void b.offsetWidth; b.classList.add('gain');
    };
  }
}
function floatText(from, text, cls){
  const el = document.createElement('div');
  el.className = 'float' + (cls ? ' ' + cls : ''); el.textContent = text;
  document.body.appendChild(el);
  const w = el.offsetWidth, c = from.left + from.width / 2;
  let x = cls === 'gold' ? c + 6 : cls === 'big' ? c - w / 2 : c - w - 6, y = from.top - 14;
  x = Math.max(6, Math.min(innerWidth - w - 6, x));
  el.animate([
    { transform:`translate(${x}px,${y + 6}px) scale(.4)`, opacity:0 },
    { transform:`translate(${x}px,${y - 22}px) scale(1.25)`, opacity:1, offset:.18 },
    { transform:`translate(${x}px,${y - 34}px) scale(1)`, opacity:1, offset:.45 },
    { transform:`translate(${x}px,${y - 78}px) scale(.95)`, opacity:0 }
  ], { duration:1300, easing:'cubic-bezier(.2,.7,.3,1)', fill:'both' }).onfinish = () => el.remove();
}
let luTimer, luEmbers;
let luGold = 0;
function showLevelUp(L, gold){
  const rankUp = L % 10 === 0 && L <= (RANKS.length - 1) * 10, lu = $('#levelup');
  luGold = gold || 0;
  $('#luReward').innerHTML = luGold ? `<span class="lu-rw-l">Reward</span>${ico('i-coin')}<b>+${fmt(luGold)}</b>` : '';
  $('#luEmblem').innerHTML = emblem(L);
  $('#luLevel').textContent = `Level ${L}`;
  $('#luRank').textContent = rankUp ? `New rank: ${RANKS[tierOf(L)]}` : RANKS[tierOf(L)];
  $('#luTitle').innerHTML = [...(rankUp ? 'Rank Up' : 'Level Up')].map((c, i) => `<span style="animation-delay:${.35 + i * .06}s">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  lu.classList.remove('show', 'rankup'); void lu.offsetWidth;
  lu.classList.add('show'); lu.classList.toggle('rankup', rankUp);
  vibrate(rankUp ? [40, 70, 40, 70, 90] : [40, 60, 60]);
  const r = $('#luEmblem').getBoundingClientRect(), [cx, cy] = mid(r);
  FX.flash(cx, cy, 260, .8);
  setTimeout(() => { FX.burst(cx, cy, 2.2); FX.fountain(cx, cy + 40, 30); }, 250);
  setTimeout(() => FX.glints(r.left - 20, r.top - 10, r.width + 40, r.height + 20, 10), 900);
  if (rankUp) setTimeout(() => { FX.ring(cx, cy, 260, 1.1, 6); FX.burst(cx, cy, 2.4); FX.fountain(cx, cy + 40, 35); }, 1100);
  clearInterval(luEmbers); FX.embers(18);
  luEmbers = setInterval(() => { FX.embers(3); FX.glints(r.left - 30, r.top - 20, r.width + 60, r.height + 40, 1); }, 240);
  clearTimeout(luTimer); luTimer = setTimeout(hideLevelUp, rankUp ? 5200 : 4200);
}
function hideLevelUp(){
  const lu = $('#levelup'); if (!lu.classList.contains('show')) return;
  if (luGold){ const rw = $('#luReward svg'); if (rw) flyCoins(rw.getBoundingClientRect(), luGold); luGold = 0; }
  lu.classList.remove('show', 'rankup'); clearInterval(luEmbers); clearTimeout(luTimer);
  const e = $('#lvlEmblem'); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
  const r = e.getBoundingClientRect(); FX.burst(...mid(r), 1.1);
}

let toastTimer;
function showToast(text, canUndo){
  // capitalise the first word after a colon: "Floss: Complete", "Submit Assignment: Claim #8 this week"
  $('#toastText').textContent = String(text).replace(/: (\p{Ll})/gu, (m, c) => ': ' + c.toUpperCase());
  $('#toastUndo').hidden = !canUndo;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}
function hideToast(){ $('#toast').classList.remove('show'); }
function shake(el){ el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); el.focus(); }

/* ================= In-app confirm dialog ================= */
let askResolve = null;
function ask(title, text, yes = 'Confirm'){
  $('#ask .dialog').className = 'dialog'; $('#askArt').innerHTML = ''; $('#askYes').className = 'btn-plain btn-danger';
  $('#askTitle').textContent = title; $('#askText').textContent = text; $('#askYes').textContent = yes;
  $('#askNo').style.display = yes === 'OK' ? 'none' : '';
  $('#ask').classList.add('open');
  return new Promise(res => { askResolve = res; });
}
// buying a deck: its picture, the amount, the price with the coin icon and what's left after
function askBuy(it, q, cost){
  const p = ask(`Buy ${q} ${it.name}${q > 1 ? 's' : ''}?`, '', 'Buy');
  $('#ask .dialog').className = `dialog buy th-${it.deck}`;
  $('#askYes').className = 'btn-buy';
  $('#askArt').innerHTML = `<div class="ab-stack">${[0, 1, 2].map(() => `<img src="${deckOf(it).cover}" alt="">`).join('')}${q > 1 ? `<b>×${q}</b>` : ''}</div>`;
  $('#askText').innerHTML = `<span class="ab-price">${ico('i-coin')}${fmt(cost)}</span><span class="ab-left">${ico('i-coin')}${fmt(S.gold - cost)} left after</span>`;
  return p;
}
function answer(v){ $('#ask').classList.remove('open'); if (askResolve){ const r = askResolve; askResolve = null; r(v); } }
$('#askYes').addEventListener('click', () => answer(true));
$('#askNo').addEventListener('click', () => answer(false));
$('#ask').addEventListener('click', e => { if (e.target.id === 'ask') answer(false); });

/* ================= Drag to reorder (Arrange mode) ================= */
let drag = null, dragScroll = null;
function reorder(ids){
  const slots = ids.map(id => S.quests.findIndex(q => q.id === id)).sort((a, b) => a - b);
  const objs = ids.map(byId);
  slots.forEach((slot, k) => S.quests[slot] = objs[k]);
}
function moveDrag(){
  const { item, box, ph, dy, y } = drag;
  item.style.top = (y - dy) + 'px';
  const sibs = [...box.children].filter(c => c.classList.contains('item') && c !== item);
  let before = null;
  for (const s of sibs){ const r = s.getBoundingClientRect(); if (y < r.top + r.height / 2){ before = s; break; } }
  if (before){ if (ph.nextElementSibling !== before) box.insertBefore(ph, before); }
  else if (box.lastElementChild !== ph) box.appendChild(ph);
}
$('#panel').addEventListener('pointerdown', e => {
  const grip = e.target.closest('.grip'); if (!grip || !arranging) return;
  e.preventDefault();
  const item = grip.closest('.item'), box = item.parentElement, r = item.getBoundingClientRect();
  const ph = document.createElement('div');
  ph.className = 'ph'; ph.style.height = r.height + 'px';
  box.insertBefore(ph, item);
  Object.assign(item.style, { position:'fixed', left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', zIndex:50, pointerEvents:'none' });
  item.classList.add('dragging');
  drag = { item, box, ph, dy:e.clientY - r.top, y:e.clientY };
  vibrate(12);
  dragScroll = setInterval(() => {
    if (!drag) return;
    if (drag.y < 170) window.scrollBy(0, -10);
    else if (drag.y > innerHeight - 110) window.scrollBy(0, 10);
    else return;
    moveDrag();
  }, 16);
});
window.addEventListener('pointermove', e => { if (!drag) return; drag.y = e.clientY; moveDrag(); });
function endDrag(){
  if (!drag) return;
  const { item, box, ph } = drag;
  box.insertBefore(item, ph); ph.remove();
  item.removeAttribute('style'); item.classList.remove('dragging');
  reorder([...box.children].filter(c => c.classList.contains('item')).map(c => c.dataset.id));
  drag = null; clearInterval(dragScroll); save();
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

/* ================= Post / edit sheet ================= */
let editingId = null;
const radios = name => [...document.querySelectorAll(`input[name=${name}]`)];
const getRadio = name => (radios(name).find(r => r.checked) || {}).value;
const setRadio = (name, v) => radios(name).forEach(r => r.checked = r.value === String(v));
const int = (v, max = 9999) => Math.max(0, Math.min(max, Math.round(parseFloat(v)) || 0));
const DEFAULTS = { standard:{ xp:10, gold:5 }, scaling:{ xp:10, gold:10 }, target:{ xp:30, gold:15 }, bounty:{ xp:60, gold:30 }, avoid:{ xp:10, gold:5 } };
function isDescendant(q, ancestorId){ let p = parentOf(q), n = 0; while (p && n++ < 60){ if (p.id === ancestorId) return true; p = parentOf(p); } return false; }

function fillParentOptions(selfId, current){
  const opts = S.quests.filter(q => q.kind === 'standard' && q.id !== selfId && !(selfId && isDescendant(q, selfId)));
  $('#fParent').innerHTML = `<option value="">Always visible</option>` + opts.map(q => `<option value="${q.id}"${q.id === current ? ' selected' : ''}>${esc(q.name)}</option>`).join('');
}
// "Resets every": any number of days (1–60), with − / + and quick picks
function setDays(n){
  n = Math.max(1, Math.min(60, Math.round(+n) || 1));
  $('#fDays').value = n; $('#fDaysUnit').textContent = n === 1 ? 'day' : 'days';
  document.querySelectorAll('.dp-quick button').forEach(b => b.classList.toggle('on', +b.dataset.days === n));
}
document.querySelector('.days-pick').addEventListener('click', e => { const b = e.target.closest('[data-dd]'); if (b) setDays(+$('#fDays').value + +b.dataset.dd); });
document.querySelector('.dp-quick').addEventListener('click', e => { const b = e.target.closest('[data-days]'); if (b) setDays(b.dataset.days); });
$('#fDays').addEventListener('change', () => setDays($('#fDays').value));
function updateForm(){
  const kind = getRadio('kind');
  document.querySelectorAll('#form [data-show]').forEach(el => el.style.display = el.dataset.show.split(' ').includes(kind) ? '' : 'none');
  if ((kind === 'standard' || kind === 'record') && $('#fParent').value) $('#daysField').style.display = 'none';
  const q = editingId && byId(editingId);
  if (kind === 'record'){
    $('#startField').style.display = q ? 'none' : '';
    $('#histField').style.display = q && q.entries.length ? '' : 'none';
    const u = $('#fUnit').value.trim() || 'unit', st = parseFloat($('#fStep').value) || 1;
    $('#stepHelp').textContent = `You earn the reward for every ${fmt(st)} ${u} you beat your best by.`;
    $('#fStepUnit') && ($('#fStepUnit').textContent = $('#fUnit').value.trim() || 'unit');
  }
  if (kind === 'steps' || kind === 'tally'){
    const tmp = { kind, unit:$('#fTUnit').value.trim() };
    const c = Math.max(0.01, parseFloat($('#fChunk').value) || 1);
    const ex = kind === 'steps' ? 10000 : c * 10, n = Math.floor(ex / c + 1e-9);
    $('#chunkLbl').firstChild.nodeValue = 'Every';   // only the text, keep the (i) button
    $('#fChunkUnit').textContent = kind === 'steps' ? 'steps' : (tmp.unit || 'unit');
    $('#chunkHelp').textContent = `${fmtU(tmp, ex)} would pay +${fmt(n * int($('#fStXp').value))} XP and +${fmt(n * int($('#fStGold').value))} gold.`;
  }
  $('#kindHelp').textContent = KIND_HELP[kind];
  $('#nameLbl').textContent = kind === 'pair' ? 'Pair title' : 'Title';
  $('#xpLbl').textContent = kind === 'scaling' ? 'Base XP' : 'XP';
  $('#goldLbl').textContent = kind === 'scaling' ? 'Base gold' : 'Gold';
  if (kind === 'scaling'){
    const tmp = { xp:int($('#fXp').value), gold:int($('#fGold').value), growth:int($('#fGrowth').value, 500) };
    const xs = [1,2,3,4,5].map(n => scaledReward(tmp, n).xp);
    $('#growthPreview').textContent = `Each claim in the same period pays more than the one before.\nWith these numbers: 1st claim +${xs[0]} XP, 2nd +${xs[1]}, 3rd +${xs[2]}, 4th +${xs[3]}, 5th +${xs[4]}.`;
  }
}
function openSheet(id){
  editingId = id || null;
  const q = id ? byId(id) : null;
  const kind = q ? q.kind : 'standard';
  $('#formTitle').textContent = q ? 'Edit Quest' : 'Post a Quest';
  $('#saveBtn').textContent = q ? 'Save Changes' : 'Post Quest';
  $('#deleteBtn').style.display = q ? '' : 'none';
  $('#histBtn').style.display = 'none';
  radios('kind').forEach(r => { r.checked = r.value === kind; r.disabled = !!q; });
  $('#fName').value = q ? q.name : '';
  $('#fNote').value = q ? q.note : '';
  fillParentOptions(q ? q.id : null, q ? q.parent : null);
  setDays(q ? (q.kind === 'scaling' ? periodOf(q) : q.days || 1) : 1);
  const base = q && ['standard','scaling','target','bounty','avoid'].includes(q.kind) ? q : DEFAULTS[kind] || DEFAULTS.standard;
  $('#fNeed').value = q && q.kind === 'target' ? q.need : 5;
  setDateField('fDue', q && q.kind === 'bounty' ? q.due : addDays(startOfDay(), 7));
  setDateField('fSince', q && q.kind === 'avoid' ? q.since : startOfDay());
  $('#fXp').value = base.xp; $('#fGold').value = base.gold;
  $('#fGrowth').value = q && q.kind === 'scaling' ? q.growth : 50;
  const pq = q && q.kind === 'pair' ? q : null;
  $('#fAName').value = pq ? pq.a.name : ''; $('#fAXp').value = pq ? pq.a.xp : 10; $('#fAGold').value = pq ? pq.a.gold : 5;
  $('#fBName').value = pq ? pq.b.name : ''; $('#fBXp').value = pq ? pq.b.xp : 10; $('#fBGold').value = pq ? pq.b.gold : 5;
  $('#fBonusXp').value = pq ? pq.bonus.xp : 15; $('#fBonusGold').value = pq ? pq.bonus.gold : 15;
  const rq = q && q.kind === 'record' ? q : null;
  $('#fUnit').value = rq ? rq.unit : 'kg';
  setRadio('better', rq ? rq.better : 'lower');
  $('#fStep').value = rq ? rq.step : 1;
  $('#fXpPer').value = rq ? rq.xpPer : 10; $('#fGoldPer').value = rq ? rq.goldPer : 10;
  $('#fStart').value = '';
  const sq = q && (isTracker(q) || q.kind === 'tally') ? q : null;
  $('#fTUnit').value = sq && sq.kind === 'tally' ? sq.unit : '$';
  $('#fChunk').value = sq ? sq.chunk : 100; $('#fStXp').value = sq ? sq.xpPer : 1; $('#fStGold').value = sq ? sq.goldPer : 1;
  $('#fGoal').value = sq ? sq.goal : 10000; $('#fShowDays').value = sq ? sq.showDays : 3;
  $('#fGoalXp').value = sq && sq.goalXp != null ? sq.goalXp : GOAL_BONUS; $('#fGoalGold').value = sq && sq.goalGold != null ? sq.goalGold : GOAL_BONUS;
  $('#fShowCount').checked = q ? showsCount(q) : true;
  $('#fTracked').checked = q ? isTracked(q) : false;
  $('#hist').innerHTML = rq ? [...rq.entries].reverse().map(e => {
    const d = new Date(e.t);
    return `<div><span>${d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}</span><b class="${e.v === rq.best ? 'best' : ''}">${fmt(e.v)} ${esc(rq.unit)}</b></div>`;
  }).join('') : '';
  let metaText = '';
  if (q) metaText = q.kind === 'pair' ? `Pair bonus earned ${fmt(q.bonusCount)} ${q.bonusCount === 1 ? 'time' : 'times'}`
    : isTracker(q) ? `${Object.keys(valsOf(q)).length} days recorded`
    : q.kind === 'tally' ? `${fmt(q.count || 0)} entries · ${fmtU(q, q.total || 0)} total`
    : `Completed ${fmt(q.count)} ${q.count === 1 ? 'time' : 'times'}`;
  $('#formMeta').textContent = metaText; $('#formMeta').style.display = q ? '' : 'none';
  updateForm();
  $('#modal').classList.add('open');
  $('#form').scrollTop = 0;
}
function closeSheet(){ $('#modal').classList.remove('open'); editingId = null; }

$('#form').addEventListener('input', updateForm);
$('#form').addEventListener('change', e => {
  if (e.target.name === 'kind' && !editingId){
    const d = DEFAULTS[e.target.value];
    if (d){ $('#fXp').value = d.xp; $('#fGold').value = d.gold; }
    $('#fShowCount').checked = e.target.value !== 'record';
    if (!editingId) setDays(e.target.value === 'scaling' || e.target.value === 'target' ? 7 : 1);
    $('#fTracked').checked = e.target.value === 'record' || e.target.value === 'tally';
    if (e.target.value === 'tally'){ $('#fChunk').value = 10; $('#fStXp').value = 5; $('#fStGold').value = 5; $('#fGoal').value = 100; }
    if (e.target.value === 'steps'){ $('#fChunk').value = 100; $('#fStXp').value = 1; $('#fStGold').value = 1; $('#fGoal').value = 10000; }
  }
  updateForm();
});
function saveForm(){
  if (!$('#modal').classList.contains('open') || $('#form').classList.contains('pick')) return;   // closing, or still choosing a kind
  const kind = getRadio('kind');
  if (kind === 'steps' && S.quests.some(x => isTracker(x) && x.id !== editingId)){ showToast('You already have a Steps quest', false); return; }
  const name = $('#fName').value.trim();
  if (!name){ shake($('#fName')); return; }
  const common = { name, note:$('#fNote').value.trim(), showCount:$('#fShowCount').checked, tracked:$('#fTracked').checked };
  const days = int($('#fDays').value || 1, 60) || 1;
  const parent = $('#fParent').value || null;
  let q = editingId ? byId(editingId) : null;
  const isNew = !q;
  if (kind === 'pair'){
    const an = $('#fAName').value.trim(), bn = $('#fBName').value.trim();
    if (!an){ shake($('#fAName')); return; }
    if (!bn){ shake($('#fBName')); return; }
    if (isNew) q = { id:uid(), kind, cycleEnd:0, bonusCount:0, bonusUntil:0, created:now(),
      a:{ count:0, until:0, undo:null }, b:{ count:0, until:0, undo:null } };
    Object.assign(q, common, { days, bonus:{ xp:int($('#fBonusXp').value), gold:int($('#fBonusGold').value) } });
    Object.assign(q.a, { name:an, xp:int($('#fAXp').value), gold:int($('#fAGold').value) });
    Object.assign(q.b, { name:bn, xp:int($('#fBXp').value), gold:int($('#fBGold').value) });
  } else if (kind === 'scaling'){
    if (isNew) q = { id:uid(), kind, week:0, weekClaims:0, count:0, created:now() };
    Object.assign(q, common, { xp:int($('#fXp').value), gold:int($('#fGold').value), growth:int($('#fGrowth').value, 500), period:days });
  } else if (kind === 'record'){
    if (isNew){
      const start = round2(parseFloat($('#fStart').value));
      const s0 = isFinite(start) && start > 0 ? Math.min(VALUE_CAP, start) : null;
      q = { id:uid(), kind, entries:[], start:s0, best:s0, paidTo:s0, doneUntil:0, count:0, undo:null, created:now() };
    }
    const st = round2(parseFloat($('#fStep').value));
    Object.assign(q, common, { unit:$('#fUnit').value.trim() || 'unit', better:getRadio('better') || 'lower', step:isFinite(st) && st > 0 ? Math.min(VALUE_CAP, st) : 1,
      xpPer:int($('#fXpPer').value), goldPer:int($('#fGoldPer').value), parent, days });
  } else if (kind === 'tally'){
    if (isNew) q = { id:uid(), kind, log:[], carry:0, total:0, count:0, created:now() };
    const ch = round2(parseFloat($('#fChunk').value));
    Object.assign(q, common, { unit:$('#fTUnit').value.trim(), chunk:isFinite(ch) && ch > 0 ? Math.min(VALUE_CAP, ch) : 1, xpPer:int($('#fStXp').value), goldPer:int($('#fStGold').value) });
  } else if (kind === 'steps'){
    if (isNew) q = { id:uid(), kind, paid:{ ...(S.stepsMemo || {}).paid }, goalPaid:{ ...(S.stepsMemo || {}).goalPaid }, created:now() };
    Object.assign(q, common, { chunk:Math.max(1, int($('#fChunk').value, 100000)), xpPer:int($('#fStXp').value), goldPer:int($('#fStGold').value),
      goal:int($('#fGoal').value, 200000), showDays:int($('#fShowDays').value, 14), goalXp:int($('#fGoalXp').value), goalGold:int($('#fGoalGold').value) });
  } else if (kind === 'target'){
    if (isNew) q = { id:uid(), kind, doneUntil:0, count:0, undo:null, hits:0, cycleEnd:0, log:[], created:now() };
    const need = Math.max(1, int($('#fNeed').value || 1, 999));
    if (!isNew && q.days !== days){ q.cycleEnd = 0; q.doneUntil = 0; }   // a new timer length starts a fresh cycle
    Object.assign(q, common, { xp:int($('#fXp').value), gold:int($('#fGold').value), days, need });
  } else if (kind === 'bounty'){
    if (isNew) q = { id:uid(), kind, doneUntil:0, doneAt:0, count:0, undo:null, log:[], created:now() };
    Object.assign(q, common, { xp:int($('#fXp').value), gold:int($('#fGold').value), due:+$('#fDue').value });
  } else if (kind === 'avoid'){
    if (isNew) q = { id:uid(), kind, doneUntil:0, count:0, undo:null, slips:[], best:0, log:[], created:now() };
    Object.assign(q, common, { xp:int($('#fXp').value), gold:int($('#fGold').value), days:1, since:+$('#fSince').value });
  } else {
    if (isNew) q = { id:uid(), kind, doneUntil:0, count:0, undo:null, created:now() };
    Object.assign(q, common, { xp:int($('#fXp').value), gold:int($('#fGold').value), parent, days });
  }
  if (isNew) S.quests.push(q);
  save(); closeSheet(); render();
  showToast(isNew ? `Posted “${name}”` : 'Changes saved', false);
}
$('#saveBtn').addEventListener('click', saveForm);
$('#form').addEventListener('submit', e => { e.preventDefault(); saveForm(); });
$('#form').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.repeat && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox'){ e.preventDefault(); saveForm(); } });
$('#cancelBtn').addEventListener('click', closeSheet);
$('#deleteBtn').addEventListener('click', async () => {
  const q = byId(editingId); if (!q) return;
  const kids = S.quests.filter(c => c.parent === q.id);
  let msg = q.kind === 'steps' ? 'Your step history is kept for the Progress tab.' : q.kind === 'tally' ? 'Its entries and total will be lost.' : `Its count${q.kind === 'record' ? ' and history' : ''} will be lost.`;
  if (kids.length) msg += ` ${kids.length} follow-up quest${kids.length > 1 ? 's' : ''} will become always visible.`;
  if (!await ask(`Remove “${q.name}”?`, msg, 'Remove')) return;
  kids.forEach(c => c.parent = null);
  // a removed Steps quest leaves behind what it already paid, so adding it back can't pay those steps or goals twice
  if (isTracker(q)) S.stepsMemo = { paid:{ ...(S.stepsMemo || {}).paid, ...q.paid }, goalPaid:{ ...(S.stepsMemo || {}).goalPaid, ...q.goalPaid } };
  S.quests = S.quests.filter(x => x.id !== q.id);
  save(); closeSheet(); render();
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeSheet(); });

/* ================= Settings ================= */
const closeSettings = () => $('#settings').classList.remove('open');
function renderSync(){
  const hasNative = !!(native() && native().connectHealth);
  const on = S.sync && S.sync.connected;
  $('#syncDot').classList.toggle('on', !!on);
  $('#syncState').textContent = on ? `Connected · last sync ${S.sync.last ? timeAgo(S.sync.last) : 'pending'}` : 'Not connected';
  $('#syncHelp').textContent = hasNative
    ? 'Steps come from Health Connect, Android’s shared health hub. Samsung Health sends its step count there.'
    : 'This only works in the phone app (APK).';
  $('#syncConnect').textContent = on ? 'Disconnect' : 'Connect';
}
function openSettings(){ renderRanks(); renderSync(); renderBackup(); $('#reduceFx').checked = !!S.reduceFx; $('#settings').classList.add('open'); }
$('#gearBtn').addEventListener('click', () => openSettings());
$('#syncConnect').addEventListener('click', async () => {
  const n = native();
  if (S.sync.connected){ S.sync.connected = false; save(); renderSync(); render(); return; }
  if (!n || !n.connectHealth){
    await ask('Phone app needed', 'Step sync connects to Health Connect, which a web page can’t reach. It will work once Psych is built as an APK. For now, use the Testing section.', 'OK');
    return;
  }
  const ok = await n.connectHealth();            // asks Android for permission to read steps
  if (ok){ S.sync.connected = true; save(); await syncNow(); }
  renderSync(); render();
});
$('#syncNowBtn').addEventListener('click', async () => {
  const n = native();
  if (!n || !n.syncSteps){ showToast('Sync works in the phone app only', false); return; }
  if (!S.sync.connected){ showToast('Tap Connect first', false); return; }
  await syncNow(); renderSync(); showToast(`Steps synced · today ${fmt(S.steps[dayKey()] || 0)}`, false);
});
/* ---- Backup ----
   Saves everything as one .json file. On a PC browser the save/open windows remember the
   folder you used last. In the phone app, PsychNative.saveBackup / openBackup will write to
   and read from a Psych folder instead. */
const BACKUP_PICKER = { id:'psych-backup', startIn:'documents', types:[{ description:'Psych backup', accept:{ 'application/json':['.json'] } }] };
function renderBackup(){
  $('#backupInfo').textContent = (S.lastBackup ? `Manual: last saved ${timeAgo(S.lastBackup)}.` : 'Manual: never saved.')
    + ' Each Save backup makes a new dated file.';
  $('#autoBackupInfo').textContent = native()
    ? (S.autoBackup ? `Automatic: last saved ${timeAgo(S.autoBackup)}.` : 'Automatic: not saved yet.')
      + ' One file, Psych-AUTO-backup.json, replaced every night at midnight.'
    : 'Automatic: only in the phone app (one file, replaced every night at midnight).';
}
const backupStamp = t => { const d = new Date(t); return `${dayKey(t)}_${pad2(d.getHours())}${pad2(d.getMinutes())}`; };
// the file says which kind it is, in its name and inside it
function backupPayload(kind, stamp){
  return JSON.stringify({ app:'Psych', version:1, kind,
    note: kind === 'auto' ? 'AUTOMATIC backup: saved by the app at midnight, replaced every night.' : 'MANUAL backup: saved when you tapped Save backup.',
    exported:new Date(stamp).toISOString(), data:{ ...S, lastBackup:kind === 'manual' ? stamp : S.lastBackup, autoBackup:kind === 'auto' ? stamp : S.autoBackup } }, null, 2);
}
async function exportBackup(){
  const stamp = now(), name = `Psych-MANUAL-backup-${backupStamp(stamp)}.json`;
  const payload = backupPayload('manual', stamp);
  const done = () => { S.lastBackup = stamp; save(); renderBackup(); showToast(native() ? `Saved to Documents/Psych/${name}` : `Backup saved: ${name}`, false); };
  const n = native();
  try {
    if (n && n.saveBackup){ await n.saveBackup(name, payload); return done(); }
    if (window.showSaveFilePicker){
      const h = await window.showSaveFilePicker({ ...BACKUP_PICKER, suggestedName:name });
      const w = await h.createWritable(); await w.write(payload); await w.close(); return done();
    }
  } catch(e){ if (e && e.name === 'AbortError') return; }
  try {   // fallback: ordinary download
    const url = URL.createObjectURL(new Blob([payload], { type:'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000); done();
  } catch(e){ showToast('Could not save here. Open the file directly in Chrome.', false); }
}
async function importBackup(){
  const n = native();
  try {
    if (n && n.openBackup){ const text = await n.openBackup(); if (text) applyBackup(text); return; }
    if (window.showOpenFilePicker){
      const [h] = await window.showOpenFilePicker(BACKUP_PICKER);
      applyBackup(await (await h.getFile()).text()); return;
    }
  } catch(e){ if (e && e.name === 'AbortError') return; }
  $('#importFile').click();
}
async function applyBackup(text){
  let obj; try { obj = JSON.parse(text); } catch(e){ obj = null; }
  const data = obj && obj.data && Array.isArray(obj.data.quests) ? obj.data : obj && Array.isArray(obj.quests) ? obj : null;
  if (!data){ await ask('Not a Psych backup', 'That file doesn’t look like a Psych backup.', 'OK'); return; }
  const when = obj.exported ? new Date(obj.exported).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' }) : 'an unknown date';
  const kind = obj.kind === 'auto' ? 'Automatic backup' : obj.kind === 'manual' ? 'Manual backup' : 'Backup';
  if (!await ask('Restore this backup?', `${kind}, saved ${when}. Everything in the app now will be replaced by it.`, 'Restore')) return;
  const keep = JSON.stringify(S);
  try { S = JSON.parse(JSON.stringify(data)); normalize(); render(); }
  catch(e){ S = JSON.parse(keep); normalize(); render(); await ask('Backup is damaged', 'That file couldn’t be read, so nothing was changed.', 'OK'); return; }
  snap = null; arranging = false; save(); closeSettings(); renderHeader.lastL = null; render(); showToast('Backup restored', false);
}
$('#exportBtn').addEventListener('click', exportBackup);
$('#importBtn').addEventListener('click', importBackup);
$('#importFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) applyBackup(await f.text()); });

$('#histBtn').addEventListener('click', () => {
  const q = byId(editingId); if (!q) return;
  S.pview = q.kind === 'steps' ? 'steps' : q.id; S.tab = 'progress'; monthOffset = 0; selDay = null;
  closeSheet(); save(); render(); window.scrollTo({ top:0 });
});
$('#closeSettings').addEventListener('click', closeSettings);
$('#settings').addEventListener('click', e => { if (e.target.id === 'settings') closeSettings(); });
$('#resetProgress').addEventListener('click', async () => {
  if (!await ask('Reset all progress?', 'Gold, XP, counts, records and step history will be cleared. Your quests stay.', 'Reset')) return;
  resetProgress(); snap = null; save(); closeSettings(); render(); showToast('Progress reset', false);
});
$('#resetAll').addEventListener('click', async () => {
  if (!await ask('Start over?', 'This deletes all your quests and progress.', 'Start over')) return;
  S = starterData(); normalize(); snap = null; arranging = false; save(); closeSettings(); render(); showToast('Starter quests restored', false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape'){ if ($('#ask').classList.contains('open')) return answer(false); closeSheet(); closeSettings(); hideLevelUp(); } });

/* ================= Wiring ================= */
document.addEventListener('click', e => { if (!e.target.closest('.info')) document.querySelectorAll('.info.open').forEach(x => x.classList.remove('open')); }, true);
// the (i) next to the Shop title (outside the panel)
$('#boardTitle').addEventListener('click', e => { const el = e.target.closest('.info'); if (!el) return; el.classList.toggle('open'); vibrate(6); });
$('#panel').addEventListener('click', e => {
  if (e.target.closest('#postBtn')) return openSheet(null);
  if (e.target.closest('#arrangeBtn')){ arranging = !arranging; render(); return; }
  if (arranging) return;
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, rect = el.getBoundingClientRect();
  if (act === 'stepsexact'){ stepsExact = !stepsExact; render(); return; }
  if (act === 'distunit'){ S.distUnit = S.distUnit === 'mi' ? 'km' : 'mi'; save(); render(); return; }
  if (act === 'pv'){ S.pview = el.dataset.pv; monthOffset = 0; selDay = null; save(); render(); return; }
  if (act === 'mo-prev'){ monthOffset++; selDay = null; render(); return; }
  if (act === 'mo-next'){ monthOffset = Math.max(0, monthOffset - 1); selDay = null; render(); return; }
  if (act === 'hday'){ if (el.classList.contains('fut') || el.classList.contains('pre')) return; selDay = selDay === el.dataset.day ? null : el.dataset.day; render(); return; }
  if (act === 'wk-prev'){ weekOffset++; render(); return; }
  if (act === 'wk-next'){ weekOffset = Math.max(0, weekOffset - 1); render(); return; }
  if (act === 'progress'){ S.tab = 'progress'; weekOffset = 0; save(); render(); window.scrollTo({ top:0 }); return; }
  if (act === 'info'){ const open = el.classList.toggle('open'); document.querySelectorAll('.info.open').forEach(x => x !== el && x.classList.remove('open')); if (open) vibrate(6); return; }
  if (act === 'qty'){ changeQty(el.dataset.item, +el.dataset.d); return; }
  if (act === 'buy'){ tryBuy(el.dataset.item, el); return; }
  if (act === 'useitem'){ useItem(el.dataset.item); return; }
  if (act === 'inspect'){ inspectCard(el.dataset.id, !!el.dataset.scene); return; }
  if (act === 'setclaim'){ claimSet(el.dataset.set, el); return; }
  if (act === 'colg'){ colGroup = el.dataset.g; render(); return; }
  if (act === 'colf'){ colFilter = el.dataset.r; render(); return; }
  if (act === 'colset'){ const k = el.dataset.set, i = colSets.indexOf(k); if (i < 0) colSets.push(k); else colSets.splice(i, 1); const y = scrollY; render(); scrollTo(0, y); return; }
  if (act === 'colfold'){ const k = el.dataset.set; colOpen[k] = colOpen[k] === false; const y = scrollY; render(); scrollTo(0, y); return; }
  if (act === 'opensettings'){ openSettings(); return; }
  if (act === 'skinfo'){ toggleSkPop(el); return; }
  if (act === 'lastundo'){ const q = byId(el.dataset.q); if (q) undoLast(q); return; }
  if (act === 'dayundo'){ const q = byId(el.dataset.q); if (q) undoDay(q, el.dataset.day); return; }
  if (act === 'hxundo'){ const q = byId(el.dataset.q); if (q) reopen(q, el.dataset.k || undefined); return; }
  if (act === 'editday'){
    const q = byId(el.dataset.q); if (!q) return;
    const v = valsOf(q)[el.dataset.day] || '';
    el.outerHTML = `<input class="st-dayin" type="number" min="0" step="any" inputmode="decimal" value="${v}" data-stepinput="${q.id}" data-day="${el.dataset.day}" aria-label="Amount">`;
    const inp = $(`.st-dayin[data-day="${el.dataset.day}"]`); inp.focus(); inp.select();
    inp.addEventListener('blur', () => render(), { once:true });
    return;
  }
  if (act === 'claimall'){ const q = byId(el.dataset.q); if (q) claimAll(q, rect); return; }
  if (act === 'claimday'){ const q = byId(el.dataset.q); if (q) claimDay(q, el.dataset.day, rect); return; }
  if (act === 'goalclaim'){ const q = byId(el.dataset.q); if (q) claimGoal(q, el.dataset.day, rect); return; }
  const item = el.closest('.item'); if (!item) return;
  const q = byId(item.dataset.id); if (!q) return;
  if (act === 'edit') openSheet(q.id);
  else if (act === 'reopen') reopen(q, el.dataset.row);
  else if (act === 'record') submitRecord(q, el.closest('.card').querySelector('.rec-input input'), rect);
  else if (act === 'tally') claimTally(q, el.closest('.card').querySelector('[data-tallyin]'), rect);
  else if (act === 'claim'){
    if (q.kind === 'pair') claimPair(q, el.dataset.row, rect);
    else if (q.kind === 'scaling') claimScaling(q, rect);
    else if (q.kind === 'target' && (targetRoll(q), (q.hits || 0) < q.need)) targetHit(q, 1, rect);
    else if (q.kind === 'bounty') claimBounty(q, rect);
    else claimStandard(q, rect);
  }
  else if (act === 'thit'){ const n = el.dataset.n; if (n === 'type') return targetType(q, el); targetHit(q, +n, rect); }
  else if (act === 'slip'){ slipAvoid(q);
  }
});
// typing today's steps updates the reward straight away
$('#panel').addEventListener('input', e => {
  const tin = e.target.closest('[data-tallyin]'); if (tin){ updateTally(tin); return; }
  const rin = e.target.closest('.rec-input input'); if (rin){ rin.parentElement.querySelector('[data-act="record"]').classList.toggle('off', !(parseFloat(rin.value) > 0)); return; }
  const inp = e.target.closest('[data-stepinput]'); if (!inp) return;
  const q = byId(inp.dataset.stepinput); if (!q) return;
  const v = Math.max(0, Math.min(1e7, round2(parseFloat(inp.value) || 0))), key = inp.dataset.day || dayKey(), V = valsOf(q);
  if (v) V[key] = v; else delete V[key];
  save(); renderTabs();
  if (!inp.dataset.day) updateTodayParts(inp.closest('.steps-card'), q);
  else { const row = inp.closest('.st-row'); const d = stepDue(q, key);
    row.classList.toggle('dim', !d.units); row.querySelector('.rewards').outerHTML = stepReward(q, key);
    row.lastElementChild.outerHTML = stepAction(q, key); }
});
$('#panel').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.closest('[data-tallyin]')){ e.preventDefault(); e.target.closest('.card').querySelector('[data-act=tally]').click(); return; }
  if (e.target.closest('[data-stepinput]')){ e.target.blur(); if (e.target.dataset.day) render(); return; }
  if (!e.target.closest('.rec-input')) return;
  e.preventDefault();
  e.target.closest('.rec-input').querySelector('[data-act=record]').click();
});
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  S.tab = b.dataset.tab; arranging = false; if (S.tab === 'progress') weekOffset = 0; save(); render(); window.scrollTo({ top:0 });
}));
// swipe the toast sideways to dismiss it (works with a finger or a mouse drag)
(() => {
  const t = $('#toast'); let x0 = null, dx = 0, id = null;
  t.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; x0 = e.clientX; dx = 0; id = e.pointerId; t.setPointerCapture(id); t.style.transition = 'none'; });
  t.addEventListener('pointermove', e => { if (x0 == null) return; dx = e.clientX - x0; t.style.transform = `translate(calc(-50% + ${dx}px),0)`; t.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / 220)); });
  const end = () => {
    if (x0 == null) return; x0 = null; t.style.transition = '';
    if (Math.abs(dx) > 70){
      t.style.transform = `translate(calc(-50% + ${dx > 0 ? 420 : -420}px),0)`; t.style.opacity = '0';
      setTimeout(() => { hideToast(); t.style.transform = ''; t.style.opacity = ''; }, 220);
    } else { t.style.transform = ''; t.style.opacity = ''; }
  };
  t.addEventListener('pointerup', end); t.addEventListener('pointercancel', end);
  t.style.touchAction = 'pan-y';
})();
$('#toastUndo').addEventListener('click', () => { if (!snap) return; S = JSON.parse(snap); snap = null; save(); hideToast(); render(); });
$('#levelup').addEventListener('click', hideLevelUp);
// hold a card tile in the collection (or search results): it opens straight to the art; letting go shows the full view
(function(){
  let timer = 0, sx = 0, sy = 0, on = false, quiet = 0;
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest('#panel [data-act="inspect"]'); if (!t) return;
    sx = e.clientX; sy = e.clientY; clearTimeout(timer);
    timer = setTimeout(() => { on = true; quiet = performance.now(); inspectCard(t.dataset.id, !!t.dataset.scene); $('#inspect').classList.add('art'); vibrate(10); }, 350);
  });
  document.addEventListener('pointermove', e => { if (!on && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clearTimeout(timer); }, { passive:true });
  const up = () => { clearTimeout(timer); if (on){ on = false; quiet = performance.now(); $('#inspect').classList.remove('art'); } };
  ['pointerup','pointercancel'].forEach(t => document.addEventListener(t, up));
  // the tap that ends a hold must not close the view (or open it twice)
  document.addEventListener('click', e => { if (performance.now() - quiet < 450){ e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest('#panel [data-act="inspect"]')) e.preventDefault(); });
})();
// tap closes; press and hold the card to see only the art (bigger, no text), let go to come back
(function(){
  const ov = $('#inspect'); let timer = 0, held = 0, sx = 0, sy = 0;
  const end = () => { clearTimeout(timer); ov.classList.remove('art'); };
  ov.addEventListener('pointerdown', e => {
    if (!e.target.closest('.in-card')) return;
    sx = e.clientX; sy = e.clientY; clearTimeout(timer);
    timer = setTimeout(() => { held = performance.now(); ov.classList.add('art'); vibrate(10); }, 350);
  });
  ov.addEventListener('pointermove', e => { if (!ov.classList.contains('art') && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clearTimeout(timer); }, { passive:true });
  ['pointerup','pointercancel','pointerleave'].forEach(t => ov.addEventListener(t, () => { if (ov.classList.contains('art')) held = performance.now(); end(); }));
  ov.addEventListener('contextmenu', e => e.preventDefault());
  ov.addEventListener('click', () => { if (performance.now() - held < 400) return; closeInspect(); });
})();

// Live countdowns to the second; redraw the board when any of them runs out
setInterval(() => {
  const t = now(); let expired = false;
  document.querySelectorAll('.cd').forEach(el => {
    const left = +el.dataset.until - t;
    if (left <= 0) expired = true;
    el.textContent = el.dataset.pre + fmtLeft(left) + el.dataset.post;
  });
  const busy = drag || document.querySelector('.modal.open') || document.activeElement?.closest?.('.rec-input, [data-stepinput], [data-tallyin]');
  if (expired && !busy) render();
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !drag) render(); });


/* ================= Back button =================
   Order: level-up → confirm dialog → edit/settings sheet → arrange mode → other tab → exit (press twice). */
let lastBackPress = 0;
function handleBack(){
  if ($('#inspect').classList.contains('open')) return closeInspect();
  if (opening){   // a finished pack (or the Open all summary) closes like its Done button; mid-reveal waits
    const d = $('#oaDone'); if (d) return d.click();
    if (opening.done) return afterReveal();
    return;
  }
  if ($('#levelup').classList.contains('show')) return hideLevelUp();
  if ($('#lvlPop').classList.contains('open')) return toggleLvlPop(false);
  if ($('#ask').classList.contains('open')) return answer(false);
  if ($('#modal').classList.contains('open')) return closeSheet();
  if ($('#settings').classList.contains('open')) return closeSettings();
  if (arranging){ arranging = false; return render(); }
  if (S.tab !== 'quests'){ S.tab = 'quests'; save(); render(); window.scrollTo({ top:0 }); return; }
  if (now() - lastBackPress < 2000){
    const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (A) A.exitApp();
    return;
  }
  lastBackPress = now();
  showToast('Press back again to exit', false);
}

/* ================= Next levels (tap the emblem) ================= */
function renderLvlPop(){
  const { L, into, need } = levelInfo(S.xp);
  let toGo = need - into, rows = '';
  for (let n = L + 1; n <= L + 3; n++){
    const newRank = tierOf(n) !== tierOf(n - 1), gold = levelReward(n);
    rows += `<div class="lp-row${n % 10 === 0 ? ' milestone' : ''}">
      <div class="lp-l"><b>Level ${n}${newRank ? ' <span class="lp-boss">Promotion</span>' : ''}</b>${newRank ? `<span class="lp-rank">New rank: ${RANKS[tierOf(n)]}</span>` : ''}<small>${fmt(toGo)} XP to go</small></div>
      <div class="lp-g">${ico('i-coin')}<span>${fmt(gold)}</span></div></div>`;
    toGo += xpToNext(n);
  }
  $('#lvlPop').innerHTML = `<div class="lp-title">Next levels</div>${rows}<div class="lp-foot">Gold is paid automatically when you level up.</div>`;
}
function toggleLvlPop(force){
  const p = $('#lvlPop'), open = force ?? !p.classList.contains('open');
  if (open) renderLvlPop();
  p.classList.toggle('open', open);
}
$('#lvlEmblem').addEventListener('click', e => { e.stopPropagation(); toggleLvlPop(); vibrate(6); });
document.addEventListener('click', e => { if (!e.target.closest('#lvlPop')) toggleLvlPop(false); });

/* ================= Phone app (Capacitor) bridge =================
   Only runs inside the APK. Backups are written to Documents/Psych on the phone;
   if that ever fails, Android's share sheet opens so you can save it anywhere. */
(function(){
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const P = C.Plugins || {};
  window.PsychNative = Object.assign(window.PsychNative || {}, {
    async saveBackup(name, text, silent){
      const FS = P.Filesystem;
      try {
        try { await FS.mkdir({ path:'Psych', directory:'DOCUMENTS', recursive:true }); } catch(e){}
        await FS.writeFile({ path:'Psych/' + name, data:text, directory:'DOCUMENTS', encoding:'utf8' });
        return;
      } catch(e){
        if (silent) throw e;   // the midnight backup never pops up the share sheet
        const r = await FS.writeFile({ path:name, data:text, directory:'CACHE', encoding:'utf8' });
        await P.Share.share({ title:'Psych backup', files:[r.uri] });
      }
    }
  });
  // Android back button: close what's open, then go to Quests, then press twice to exit
  if (P.App) P.App.addListener('backButton', () => handleBack());
  // Steps from Health Connect (Samsung Health shares its steps there)
  const H = P.Health;
  if (H) Object.assign(window.PsychNative, {
    async connectHealth(){
      const a = await H.isAvailable();
      if (!a.available){
        await ask('Health Connect not found', 'Make sure the Health Connect app is installed and up to date, then try again.' + (a.reason ? ' (' + a.reason + ')' : ''), 'OK');
        return false;
      }
      const st = await H.requestAuthorization({ read:['steps', 'distance'], write:[] });
      const ok = (st.readAuthorized || []).includes('steps');
      if (!ok) await ask('Permission not given', 'Psych needs permission to read Steps. You can allow it in Health Connect › App permissions › Psych.', 'OK');
      return ok;
    },
    async syncSteps(){
      const start = addDays(startOfDay(), -29);       // Health Connect allows about 30 days back
      const res = await H.queryAggregated({ dataType:'steps', startDate:new Date(start).toISOString(),
        endDate:new Date().toISOString(), bucket:'day', aggregation:'sum' });
      const days = {}, dist = {};
      (res.samples || []).forEach(x => { days[dayKey(new Date(x.startDate).getTime())] = Math.round(x.value || 0); });
      // distance is optional: if it isn't allowed or recorded, the app estimates it from steps
      try {
        const dr = await H.queryAggregated({ dataType:'distance', startDate:new Date(start).toISOString(),
          endDate:new Date().toISOString(), bucket:'day', aggregation:'sum' });
        (dr.samples || []).forEach(x => { dist[dayKey(new Date(x.startDate).getTime())] = x.value || 0; });
      } catch(e){}
      window.psychReceiveSteps(days, dist);
    },
    openHealthSettings(){ return H.openHealthConnectSettings(); }
  });
})();

load();   // read the saved state; the first draw happens at the very end of the file, once everything is defined
autoSync();

/* ================= Cyber 2.0 quest layout =================
   Plain quests become tiles (two per row), a Pair is two tiles joined by a live link with the
   bonus in the middle, a Recurring quest is a stack of cards with a weekly meter.
   These replace the list-style renderers above (a later function with the same name wins). */
// full numbers on cards; only 10,000+ is shortened (12,345 → 12.34k)
// rewards: under 10,000 in full (1,280); bigger ones shortened with 2 decimals, rounded down: 12.34k, 5.55M, 1.20B, 3.00T
function cyNum(v){
  const a = Math.abs(v), u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']].find(([n]) => a >= n && a >= 1e4);
  return u ? (Math.floor(v / u[0] * 100) / 100).toFixed(2) + u[1] : fmt(v);
}
function cyRew(xp, gold){ return `<div class="cy-rew"><span class="xp-r">${ico('i-gem')}+${cyNum(xp)}</span><span class="gold-r">${ico('i-coin')}+${cyNum(gold)}</span></div>`; }
// one head row: name, type tag(s), (i) ... and the streak / total on the right
function cyHead(q, tags, info, right, noEdit){
  return `<div class="cy-head"><div class="cy-hl"><h3${noEdit ? '' : ' class="q-main" data-act="edit"'}>${esc(q.name)}</h3>${tags}${info}</div>${right || ''}</div>`;
}
// streak (top-right of regular quests and pairs): count + the reward bonus it gives
function cyStreak(q){
  if (!hasStreak(q)) return '';
  const n = streakNow(q), m = streakReward(q) ? streakMult(isDone(q) ? n : n + 1) : 1;
  const tier = n >= 200 ? 5 : n >= 100 ? 4 : n >= 30 ? 3 : n >= 10 ? 2 : n >= 3 ? 1 : 0;   // colour steps like TikTok streaks
  return `<span class="cy-count cy-streak t${tier}" title="Streak">${m > 1 ? `<em${m >= 3.5 ? ' class="ur"' : m >= 3 ? ' class="max"' : ''}>+${Math.round((m - 1) * 100)}%</em>` : ''}<b>${fmt(n)}</b>×</span>`;
}
function cyMeta(q, until){
  const p = parentOf(q);
  if (until) return metaLine(cd(until, 'Reset: '));
  if (p && p.doneUntil > now()) return metaLine(cd(p.doneUntil, 'Reset: '));
  if ((q.days || 1) === 1) return metaLine(cd(nextMidnight(), 'Reset: '));
  return metaLine(`${q.days}-day cycle`);
}
function standardCard(q, fresh){
  const done = isDone(q);
  return `<article class="card cy-tile${done ? ' done' : ''}">
    ${cyHead(q, kindTag(q), '', cyStreak(q))}
    ${q.note ? `<p class="note">${esc(q.note)}</p>` : ''}
    ${(R => cyRew(R.xp, R.gold))(boosted(q, q.xp, q.gold))}
    ${cyMeta(q, done ? q.doneUntil : 0)}
    ${done ? `<button class="stamp cy-act${fresh ? ' new' : ''}" data-act="reopen">Done</button>` : `<button class="claim cy-act" data-act="claim">Claim</button>`}
  </article>`;
}
function pairCard(q, fresh){
  const t = now(), earned = q.bonusUntil > t, sc = showsCount(q), aD = q.a.until > t, bD = q.b.until > t;
  const half = key => {
    const r = q[key], d = r.until > t, f = fresh === key;
    return `<div class="cy-half ${key}${d ? ' done' : ''}">
      <div class="cy-top"><span class="pr-name">${esc(r.name)}</span></div>
      ${(R => cyRew(R.xp, R.gold))(boosted(q, r.xp, r.gold))}
      <div class="cy-gap"></div>
      ${d ? `<button class="stamp cy-act${f ? ' new' : ''}" data-act="reopen" data-row="${key}">Done</button>` : `<button class="claim cy-act" data-act="claim" data-row="${key}">Claim</button>`}
    </div>`;
  };
  const until = aD || bD ? q.cycleEnd : 0;
  return `<article class="card cy-pair${earned ? ' earned' : ''}${aD && bD ? ' done' : ''}">
    <div class="pair-head q-main" data-act="edit">
      ${cyHead(q, kindTag(q) + daysTag(q.days), '', cyStreak(q), true)}
      ${q.note ? `<p class="note">${esc(q.note)}</p>` : ''}
    </div>
    <div class="cy-link${aD ? ' la' : ''}${bD ? ' lb' : ''}${earned ? ' on' : ''}">
      ${half('a')}${half('b')}
      <i class="cy-wire wa"></i><i class="cy-wire wb"></i>
      ${aD && bD && !earned
        ? `<button class="cy-bonus ready" data-act="claim" data-row="bonus"><small>Claim</small>${(R => cyRew(R.xp, R.gold))(boosted(q, q.bonus.xp, q.bonus.gold))}</button>`
        : `<div class="cy-bonus"><small>${earned ? 'Earned' : 'Bonus'}</small>${(R => cyRew(R.xp, R.gold))(boosted(q, q.bonus.xp, q.bonus.gold))}</div>`}
    </div>
    ${cyMeta(q, until)}
  </article>`;
}
function scalingCard(q, fresh){
  const n = weekClaims(q), next = scaledReward(q, n + 1);
  const pips = Array.from({ length:7 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  return `<article class="card cy-rec">
    ${cyHead(q, kindTag(q), qInfo(`Each claim in the same ${periodWord(q)} pays ${q.growth}% more.`), '')}
    ${q.note ? `<p class="note">${esc(q.note)}</p>` : ''}
    <div class="cy-pips" title="Claims this week">${pips}${n > 7 ? `<em>+${n - 7}</em>` : ''}</div>
    <div class="cy-recrow">
      <div class="cy-recl"><div class="cy-next">${cyRew(next.xp, next.gold)}</div>${metaLine(cd(periodEnd(q), 'Reset: '))}</div>
      <button class="claim cy-btn" data-act="claim">Claim</button>
    </div>
  </article>`;
}
// Tiles go two per row. A quest that has follow-ups (shown or not yet) always takes the full row,
// and a tile left without a partner next to it also takes the full row, so there are no empty gaps.
function pairUpTiles(list){
  const ids = new Set(); let run = [];
  const flush = () => { const n = run.length - run.length % 2; run.slice(0, n).forEach(id => ids.add(id)); run = []; };
  list.forEach(q => {
    const tile = q.kind === 'standard' && !S.quests.some(c => c.parent === q.id);
    if (tile) run.push(q.id); else flush();
  });
  flush();
  return ids;
}
function questTree(list){
  const halfIds = pairUpTiles(list);
  return list.map(q => {
    const f = fresh.id === q.id ? (q.kind === 'pair' ? fresh.row : true) : false;
    const kids = S.quests.filter(c => c.parent === q.id && (arranging || isVisible(c)));
    let cls = '';
    if (!arranging){
      if (q.kind === 'standard' && halfIds.has(q.id)) cls = ' half';
      else if (q.kind === 'standard') cls = ' wide';
      else if (q.kind === 'scaling') cls = ` stacked s${Math.min(2, weekClaims(q))}${f ? ' pushed' : ''}`;
    }
    return `<div class="item${cls}" data-id="${q.id}">${card(q, f)}${kids.length ? `<div class="children">${questTree(kids)}</div>` : ''}</div>`;
  }).join('');
}

// The pair bonus is no longer paid automatically: once both halves are done it becomes its own Claim button.
function claimPair(q, key, rect){
  if (key === 'bonus') return claimPairBonus(q, rect);
  const t = now(), r = q[key];
  if (r.until > t) return;
  snapshot();
  if (!(q.cycleEnd > t)) q.cycleEnd = addDays(startOfDay(), q.days || 1);
  const R = boosted(q, r.xp, r.gold), other = q[key === 'a' ? 'b' : 'a'];
  r.until = q.cycleEnd; r.count++;
  r.undo = { xp:R.xp, gold:R.gold };
  logClaim(r.log ||= [], R.xp, R.gold);
  if (other.until > t) pairCompleted(q);
  grant({ xp:R.xp, gold:R.gold }, rect, other.until > t && q.streak > 1 ? `${r.name}: Complete · streak ${q.streak}` : `${r.name}: Complete`, q.id, key);
}
function claimPairBonus(q, rect){
  const t = now();
  if (!(q.a.until > t && q.b.until > t) || q.bonusUntil > t) return;
  snapshot();
  const B = boosted(q, q.bonus.xp, q.bonus.gold);
  q.bonusUntil = q.cycleEnd; q.bonusCount++;
  q.bonusUndo = { xp:B.xp, gold:B.gold };
  logClaim(q.bonusLog ||= [], B.xp, B.gold);
  setTimeout(() => { if (rect) floatText({ left:rect.left - 60, top:rect.top - 30, width:rect.width }, 'BONUS!', 'big'); }, 250);
  grant({ xp:B.xp, gold:B.gold }, rect, `Pair complete! Bonus +${B.xp} XP, +${B.gold} gold`, q.id, 'bonus', 2.2);
}

/* ---- Deck tab: one deck type at a time, shown as a stack (up to 4 deep) ---- */
var invIdx = 0;   // var, not let: the app may draw this tab before this line runs
$('#panel').addEventListener('click', e => {
  const el = e.target.closest('[data-act="invdot"],[data-act="goshop"]'); if (!el) return;
  if (el.dataset.act === 'invdot'){ const k = +el.dataset.k; if (k !== invIdx) invGo(k - invIdx); return; }
  else document.querySelector('.tab[data-tab="shop"]').click();
});
/* Shop banners: swipe left / right (they follow your finger), loop around, and turn by themselves every 9 s.
   Touching a banner (picking an amount, buying) holds it still for 20 s so you can finish. */
let banDrag = null, banMoved = 0, banLast = performance.now();
function banSet(pos, anim){
  const tr = document.querySelector('.sh-track'); if (!tr) return;
  tr.style.transition = anim ? 'transform .45s cubic-bezier(.25,.8,.3,1)' : 'none';
  tr.style.transform = `translateX(calc(${pos} * (-100% - 12px)))`;
}
function banGo(d){
  const car = document.querySelector('.sh-car'); if (!car) return;
  const n = +car.dataset.n; if (n < 2) return;
  const tr = car.querySelector('.sh-track'), pos = shopBan + 1 + d;
  shopBan = ((shopBan + d) % n + n) % n; banLast = performance.now();
  banSet(pos, true);
  car.querySelectorAll('.sh-slide').forEach((el, k) => el.classList.toggle('cur', k === pos));
  document.querySelectorAll('.sh-dots i').forEach((el, k) => el.classList.toggle('on', k === shopBan));
  // landed on an end copy: jump to the real one without animating
  if (pos === 0 || pos === n + 1) setTimeout(() => { if (tr.isConnected){ banSet(shopBan + 1, false);
    car.querySelectorAll('.sh-slide').forEach((el, k) => el.classList.toggle('cur', k === shopBan + 1)); } }, 470);
}
$('#panel').addEventListener('pointerdown', e => {
  const car = e.target.closest('.sh-car'); if (!car || +car.dataset.n < 2) return;
  banLast = performance.now() + 11000;   // 9 s + 11 s = held for 20 s after a touch
  banDrag = { x:e.clientX, y:e.clientY, w:car.offsetWidth, on:false, id:e.pointerId, car };
});
$('#panel').addEventListener('pointermove', e => {
  const d = banDrag; if (!d) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y;
  if (!d.on){ if (Math.abs(dx) < 8) return; if (Math.abs(dy) > Math.abs(dx)){ banDrag = null; return; }
    d.on = true; d.car.classList.add('drag'); try { d.car.setPointerCapture(d.id); } catch(_){} }
  banSet(shopBan + 1 - dx / (d.w + 12), false);
});
function banEnd(e){
  const d = banDrag; banDrag = null; if (!d || !d.on) return;
  d.car.classList.remove('drag'); banMoved = performance.now();
  const dx = e.clientX - d.x;
  if (Math.abs(dx) > d.w * .18) banGo(dx < 0 ? 1 : -1); else { banSet(shopBan + 1, true); banLast = performance.now() + 11000; }
}
$('#panel').addEventListener('pointerup', banEnd);
$('#panel').addEventListener('pointercancel', e => { const d = banDrag; banDrag = null; if (d && d.on){ d.car.classList.remove('drag'); banSet(shopBan + 1, true); } });
// a drag shouldn't also press the price button
$('#panel').addEventListener('click', e => { if (performance.now() - banMoved < 350 && e.target.closest('.sh-car')){ e.stopPropagation(); e.preventDefault(); } }, true);
setInterval(() => {
  if (S.tab !== 'shop' || document.hidden || banDrag || $('#ask').classList.contains('open') || opening) return;
  if (performance.now() - banLast > 9000) banGo(1);
}, 500);

/* Deck tab on a phone: swipe left / right to switch decks, swipe up to open one (taps still work) */
let invSw = null, invSwiped = 0;
// the new deck slides in from the side you swiped toward
function invGo(d){ invIdx += d; render(); const st = document.querySelector('.inv-stack'); if (st) st.classList.add(d > 0 ? 'in-r' : 'in-l');
  const nm = document.querySelector('.inv-name'); if (nm) nm.classList.add('in'); vibrate(6); }
function invItems(){ return SHOP.filter(it => !it.soon); }
// the whole Deck screen is the swipe area; the deck follows your finger
$('#panel').addEventListener('pointerdown', e => {
  if (S.tab !== 'inventory' || opening || !e.target.closest('.inv') || e.target.closest('.inv-dots')) return;
  const st = document.querySelector('.inv-stack'); if (!st) return;
  invSw = { x:e.clientX, y:e.clientY, axis:null, st };
});
$('#panel').addEventListener('pointermove', e => {
  const s0 = invSw; if (!s0) return;
  const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
  if (!s0.axis){ if (Math.hypot(dx, dy) < 10) return; s0.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; s0.st.style.animation = 'none'; s0.st.style.transition = 'none'; }
  if (s0.axis === 'x') s0.st.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
  else s0.st.style.transform = `translateY(${Math.min(0, dy) * .7}px) scale(${1 - Math.min(0, dy) / -2000})`;
});
function invRelease(e, cancel){
  const s0 = invSw; invSw = null; if (!s0 || !s0.axis) return;
  invSwiped = performance.now();
  const dx = e.clientX - s0.x, dy = e.clientY - s0.y, st = s0.st, items = invItems();
  const back = () => { st.style.transition = 'transform .28s cubic-bezier(.3,1.4,.5,1)'; st.style.transform = '';
    setTimeout(() => { st.style.transition = ''; st.style.animation = ''; }, 300); };
  if (cancel) return back();
  if (s0.axis === 'x' && Math.abs(dx) > 50 && items.length > 1){
    const dir = dx < 0 ? 1 : -1;
    st.style.transition = 'transform .16s ease-in, opacity .16s'; st.style.transform = `translateX(${-dir * innerWidth * .8}px) rotate(${-dir * 14}deg)`; st.style.opacity = '0';
    setTimeout(() => invGo(dir), 150);
    return;
  }
  if (s0.axis === 'y' && dy < -60){
    const it = items[((invIdx % items.length) + items.length) % items.length];
    if (owned(it.id) && !opening){ st.style.transition = 'transform .17s ease-in, opacity .17s'; st.style.transform = 'translateY(-120px) scale(.95)'; st.style.opacity = '0';
      setTimeout(() => useItem(it.id), 160); return; }
  }
  back();
}
$('#panel').addEventListener('pointerup', e => invRelease(e));
$('#panel').addEventListener('pointercancel', e => invRelease(e, true));
// a swipe shouldn't also count as a tap
$('#panel').addEventListener('click', e => { if (performance.now() - invSwiped < 400 && e.target.closest('.inv')){ e.stopPropagation(); e.preventDefault(); } }, true);

/* ---- Quest form: icon tiles for the kind, a headline title, − / + steppers on rewards ---- */
(function cyberForm(){
  const ICON = {
    standard:'<circle cx="12" cy="12" r="8"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>',
    pair:'<rect x="3" y="7" width="7.5" height="10" rx="1.6"/><rect x="13.5" y="7" width="7.5" height="10" rx="1.6"/><path d="M10.5 12h3"/>',
    scaling:'<path d="M5 19V9M10 19V6M15 19v-8M20 19V4"/>',
    record:'<path d="M12 3v3M5.6 6.6l2 2M18.4 6.6l-2 2"/><path d="M4 18a8 8 0 0 1 16 0z"/><path d="M12 18l3.5-5"/>',
    steps:'<path d="M8 3c2 0 3 2.5 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5zM6 15h4v2a2 2 0 0 1-4 0z"/><path d="M16 8c2 0 3 2.5 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5z" transform="translate(0 2)"/>',
    tally:'<path d="M5 5v14M9 5v14M13 5v14M17 5v14M3 15l18-6"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    bounty:'<path d="M7 3h10v18l-5-3.2L7 21z"/><path d="M10 8.5h4M10 12h4"/>',
    avoid:'<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>',
  };
  document.querySelectorAll('#form input[name="kind"]').forEach(r => {
    const span = r.nextElementSibling;
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[r.value] || ''}</svg>${span.textContent}`;
  });
  $('#fName').placeholder = 'Name your quest';
  // − / + around reward numbers
  const STEP = { fGrowth:10 };
  ['fXp','fGold','fGrowth','fAXp','fAGold','fBXp','fBGold','fBonusXp','fBonusGold','fXpPer','fGoldPer','fStXp','fStGold','fGoalXp','fGoalGold'].forEach(id => {
    const inp = document.getElementById(id); if (!inp || inp.closest('.stp')) return;
    const w = document.createElement('div'); w.className = 'stp';
    inp.parentNode.insertBefore(w, inp);
    const mk = d => { const b = document.createElement('button'); b.type = 'button'; b.textContent = d < 0 ? '−' : '+';
      b.addEventListener('click', () => { const st = STEP[id] || 5; inp.value = Math.max(0, (Math.round((+inp.value || 0) / st) * st) + d * st); inp.dispatchEvent(new Event('input', { bubbles:true })); });
      return b; };
    w.append(mk(-1), inp, mk(1));
  });
})();

/* ---- Edit mode: no kind picker, no "recorded" line; custom dropdown for "Appears after" ---- */
(function cyberEdit(){
  const kindField = document.querySelector('#form input[name="kind"]').closest('.field');
  const orig = openSheet;
  openSheet = function(id){
    orig.apply(this, arguments);
    const editing = !!id;
    kindField.style.display = editing ? 'none' : '';
    // only one Steps quest: hide the Steps choice while one exists
    const stepsOpt = document.querySelector('#form input[name="kind"][value="steps"]').closest('label');
    const stepsOff = !editing && !!firstSteps();   // only one Steps quest: grey the choice out while one exists
    stepsOpt.classList.toggle('off', stepsOff); stepsOpt.querySelector('input').disabled = stepsOff;
    if (!editing && firstSteps() && getRadio('kind') === 'steps') setRadio('kind', 'standard');
    document.querySelector('#form').classList.toggle('editing', editing);
    document.querySelector('.cy-tip')?.classList.remove('open');
    $('#formMeta').style.display = editing ? 'none' : '';
    cyParentSync();
  };
  // custom dropdown that mirrors the hidden <select id="fParent">
  const sel = $('#fParent'), box = document.createElement('div');
  box.className = 'cy-select'; box.innerHTML = '<button type="button" class="cy-sel-btn"><span></span><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="cy-sel-list"></div>';
  sel.after(box); sel.style.display = 'none';
  const btn = box.querySelector('.cy-sel-btn'), list = box.querySelector('.cy-sel-list');
  window.cyParentSync = () => {
    const o = sel.options[sel.selectedIndex];
    btn.querySelector('span').textContent = o ? o.textContent : 'Always visible';
    list.innerHTML = [...sel.options].map((x, i) => `<button type="button" data-i="${i}" class="${i === sel.selectedIndex ? 'on' : ''}">${i ? '' : '<i>◇</i>'}${esc(x.textContent)}</button>`).join('');
  };
  btn.addEventListener('click', e => { e.stopPropagation(); cyParentSync(); box.classList.toggle('open'); });
  list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; sel.selectedIndex = +b.dataset.i; sel.dispatchEvent(new Event('change', { bubbles:true })); box.classList.remove('open'); cyParentSync(); });
  document.addEventListener('click', () => box.classList.remove('open'));
  // XP and gold on one line: [crystal][− n +]  [coin][− n +]
  document.querySelectorAll('#form .row2, #form .row3f').forEach(row => {
    row.querySelectorAll('label.inlabel').forEach(l => { l.classList.add('cy-ico'); l.querySelectorAll('span').forEach(s => s.hidden = true); [...l.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); }); });
  });
})();

/* ---- Form hints: an (i) next to the field name opens a floating tip instead of text under every field ---- */
(function cyberHints(){
  const pop = document.createElement('div'); pop.className = 'cy-tip'; document.body.appendChild(pop);
  const hide = () => pop.classList.remove('open');
  document.querySelectorAll('#form p.help').forEach(p => {
    if (p.id === 'kindHelp') return;
    const field = p.closest('.field');
    let host = field ? field.querySelector(':scope > label, :scope > .lbl, :scope > div > label:not(.cy-ico)') : null;
    if (!host){ let prev = p.previousElementSibling; while (prev && !host){ host = prev.querySelector('label:not(.cy-ico), .lbl'); prev = prev.previousElementSibling; } }
    if (!host) return;
    p.classList.add('cy-hint-src');
    let btn = host.querySelector('.cy-i');
    if (!btn){ btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cy-i'; btn.textContent = 'i'; btn._src = []; host.appendChild(btn);
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const text = btn._src.map(x => x.textContent.trim()).filter(Boolean).join('\n\n');
        if (pop.classList.contains('open') && pop._for === btn){ hide(); return; }
        pop.textContent = text; pop._for = btn; pop.classList.add('open');
        const r = btn.getBoundingClientRect(), w = Math.min(280, innerWidth - 24);
        pop.style.width = w + 'px';
        pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left - 20)) + 'px';
        pop.style.top = (r.bottom + 8) + 'px';
      });
    }
    btn._src.push(p);
  });
  document.addEventListener('click', hide);
  document.querySelector('.sheet').addEventListener('scroll', hide, { passive:true });
})();

/* ---- Record card: stacked like the quest tiles, so it breathes on a phone ---- */
function recordCard(q, fresh){
  const done = isDone(q), last = q.entries.length ? q.entries[q.entries.length - 1].v : null, u = esc(q.unit);
  const arrow = q.better === 'lower' ? '↓' : '↑';
  const stats = q.best == null
    ? '<div class="cy-recnote">First entry sets your starting point.</div>'
    : `<div class="cy-stats"><span><small>Best</small><b>${fmt(q.best)}</b> ${u}</span>${last != null ? `<span><small>Last</small><b>${fmt(last)}</b> ${u}</span>` : ''}</div>`;
  return `<article class="card cy-tile cy-record${done ? ' done' : ''}">
    ${cyHead(q, kindTag(q), '', '')}
    ${q.note ? `<p class="note">${esc(q.note)}</p>` : ''}
    ${stats}
    <div class="cy-rate">${cyRew(q.xpPer, q.goldPer)}<span>per ${fmt(q.step)} ${u} ${arrow}</span></div>
    ${cyMeta(q, done ? q.doneUntil : 0)}
    ${done ? `<button class="stamp cy-act${fresh ? ' new' : ''}" data-act="reopen">Done</button>`
      : `<div class="rec-input"><input type="number" step="0.1" inputmode="decimal" placeholder="${last != null ? fmt(last) : 'Enter value'}" aria-label="Value"><span class="unit">${u}</span><button class="claim off" data-act="record">Record</button></div>`}
  </article>`;
}

/* ---- small (i) next to a quest name: tap for how the quest pays ---- */
function qInfo(text){ return `<button type="button" class="cy-qi" data-act="qinfo" data-tip="${esc(text)}" aria-label="How this quest works">i</button>`; }
(function(){
  const base = card;
  card = function(q, fresh){
    let h = base(q, fresh);
    if (!arranging && (isTracker(q) || q.kind === 'tally')){
      const rate = `<span class="st-rate">${rateHtml(q)}</span>`;
      const t = `<span class="xp-r">+${fmt(q.xpPer)}${ico('i-gem')}</span> <span class="gold-r">+${fmt(q.goldPer)}${ico('i-coin')}</span> for every ${esc(fmtU(q, q.chunk))}`;
      h = h.replace(rate, qInfo(t));
    }
    return h;
  };
  $('#panel').addEventListener('click', e => {
    const b = e.target.closest('[data-act="qinfo"]'); if (!b) return;
    e.stopPropagation();
    const pop = document.querySelector('.cy-tip');
    if (pop.classList.contains('open') && pop._for === b){ pop.classList.remove('open'); return; }
    pop.innerHTML = b.dataset.tip; pop._for = b; pop.classList.add('open');
    const r = b.getBoundingClientRect(), w = Math.min(260, innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left - 20)) + 'px';
    pop.style.top = (r.bottom + 8) + 'px';
  });
  addEventListener('scroll', () => document.querySelector('.cy-tip')?.classList.remove('open'), { passive:true });
})();


/* ================= Quests board: summary on top, then tiles grouped by when they reset =================
   Tap a tile to claim it (tap again to reopen). Tap the icon, or press and hold a tile, to edit it.
   Arrange mode still uses the plain list (questTree). */
function qbIcons(){ return {
  standard:'<circle cx="12" cy="12" r="8"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>',
  pair:'<rect x="3" y="7" width="7.5" height="10" rx="1.6"/><rect x="13.5" y="7" width="7.5" height="10" rx="1.6"/><path d="M10.5 12h3"/>',
  scaling:'<path d="M5 19V9M10 19V6M15 19v-8M20 19V4"/>',
  record:'<path d="M12 3v3M5.6 6.6l2 2M18.4 6.6l-2 2"/><path d="M4 18a8 8 0 0 1 16 0z"/><path d="M12 18l3.5-5"/>',
  steps:'<path d="M8 3c2 0 3 2.5 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5zM6 15h4v2a2 2 0 0 1-4 0z"/><path d="M16 8c2 0 3 2.5 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5z" transform="translate(0 2)"/>',
  tally:'<path d="M5 5v14M9 5v14M13 5v14M17 5v14M3 15l18-6"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  bounty:'<path d="M7 3h10v18l-5-3.2L7 21z"/><path d="M10 8.5h4M10 12h4"/>',
  avoid:'<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>',
}; }
function qbIcon(q){ return `<button class="qb-ic k-${q.kind}" data-act="edit" aria-label="Edit ${esc(q.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${qbIcons()[q.kind] || qbIcons().standard}</svg></button>`; }
function qbRew(xp, gold, dim){ return `<div class="qb-rew${dim ? ' dim' : ''}"><span class="xp-r">${ico('i-gem')}+${cyNum(xp)}</span><span class="gold-r">${ico('i-coin')}+${cyNum(gold)}</span></div>`; }
function qbBadge(txt, cls = "") { return `<span class="qb-badge ${cls}">${txt}</span>`; }
function qbRing(v, max){
  const r = 36, c = 2 * Math.PI * r, k = max ? v / max : 0;
  return `<div class="qb-ring"><svg viewBox="0 0 86 86"><circle cx="43" cy="43" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
    <circle cx="43" cy="43" r="${r}" fill="none" stroke="#ff6b1a" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * k).toFixed(1)} ${c.toFixed(1)}"/></svg>
    <div class="qb-rc"><b>${v}/${max}</b><small>DONE</small></div></div>`;
}
function qbSummary(){
  const vis = S.quests.filter(q => isVisible(q) && q.kind !== 'scaling' && q.kind !== 'tally' && q.kind !== 'bounty' && !isTracker(q));
  const done = vis.filter(isDone).length, T = S.today && S.today.day === dayKey() ? S.today : { xp:0, gold:0 };
  const sq = firstSteps(), st = sq ? stepDue(sq, dayKey()).steps : 0, due = sq ? dueTotals(sq) : { keys:[] };
  return `<div class="qb-sum"${sq ? ` data-holdedit="${sq.id}"` : ''}>${qbRing(done, vis.length)}<div class="qb-st">
    <div class="ln">Earned today <b><span class="xp-r">${ico('i-gem')}${fmt(T.xp)}</span><span class="gold-r">${ico('i-coin')}${fmt(T.gold)}</span></b></div>
    ${sq ? `<div class="ln qb-stp"><span>Steps${stepsSyncTag()}</span><b>${fmt(st)}${sq.goal ? ' / ' + fmt(sq.goal) : ''}</b></div><div class="qb-bar"><i style="width:${sq.goal ? Math.min(100, st / sq.goal * 100) : 0}%"></i></div>` : ''}
    ${sq ? `<div class="qb-sumft"><span class="qb-time">${ico('i-hourglass','0 0 16 16')}${cd(nextMidnight())}</span>
      ${due.keys.length ? `<button class="qb-sclaim" data-act="claimall" data-q="${sq.id}" title="+${fmt(due.xp)} XP, +${fmt(due.gold)} gold">Claim</button>` : ''}</div>` : ''}</div></div>`;
}
// ---- one tile per quest ----
function qbStandard(q, wide){
  const done = isDone(q), R = boosted(q, q.xp, q.gold), b = qbBadge(done ? 'DONE' : 'CLAIM', done ? 'ok' : '');
  return `<article class="card qb-t${done ? ' done' : ''}" data-act="${done ? 'reopen' : 'claim'}">
    ${wide ? qbTR(cyStreak(q), b) + qbHead(q) : `<div class="qb-top">${qbIcon(q)}${cyStreak(q)}</div><h4 class="qb-h2">${esc(q.name)}</h4>`}${q.note && wide ? `<p class="qb-note">${esc(q.note)}</p>` : ''}
    ${wide ? `<div class="qb-foot">${qbRew(R.xp, R.gold, done)}</div>` : `${qbRew(R.xp, R.gold, done)}<div class="qb-strk">${b}</div>`}
  </article>`;
}
function qbSteps(q){
  const T = stepDue(q, dayKey()), due = dueTotals(q), on = S.sync && S.sync.connected;
  const act = due.keys.length ? `data-act="claimall" data-q="${q.id}"` : on ? `data-act="progress"` : `data-act="opensettings"`;
  return `<article class="card qb-t" ${act}>
    ${qbIcon(q)}${due.keys.length ? qbBadge('CLAIM', 'cy') : ''}
    <h4>${esc(q.name)}</h4>
    <span class="qb-sub">${fmt(T.steps)} steps${due.keys.length ? ` · ${due.keys.length} ${due.keys.length === 1 ? 'day' : 'days'} waiting` : on ? '' : ' · sync off'}</span>
    <div class="qb-bar"><i style="width:${q.goal ? Math.min(100, T.steps / q.goal * 100) : 0}%"></i></div>
    <div class="qb-foot">${qbRew(due.xp, due.gold, !due.keys.length)}</div>
  </article>`;
}
function qbPair(q){
  const t = now(), aD = q.a.until > t, bD = q.b.until > t, earned = q.bonusUntil > t, B = boosted(q, q.bonus.xp, q.bonus.gold);
  const half = key => { const r = q[key], d = r.until > t, R = boosted(q, r.xp, r.gold);
    return `<div class="qb-half${d ? ' done' : ''}" data-act="${d ? 'reopen' : 'claim'}" data-row="${key}"><i class="hk"></i><span class="t">${esc(r.name)}</span>${qbRew(R.xp, R.gold, d)}</div>`; };
  const ready = aD && bD && !earned;
  return `<article class="card qb-t wide${aD && bD && earned ? ' done' : ''}">
    ${qbTR(cyStreak(q), qbBadge(earned ? 'DONE' : `${(aD ? 1 : 0) + (bD ? 1 : 0)}/2`, earned ? 'ok' : ''))}
    ${qbHead(q)}${q.note ? `<p class="qb-note">${esc(q.note)}</p>` : ''}
    <div class="qb-pair">${half('a')}${half('b')}
      <div class="qb-bonus${ready ? ' ready' : ''}${earned ? ' got' : ''}"${ready ? ' data-act="claim" data-row="bonus"' : ''}>
        <span class="lk"><i class="${aD ? 'on' : ''}"></i><i class="${bD ? 'on' : ''}"></i></span>
        <b>${earned ? 'Bonus earned' : ready ? 'Claim bonus' : 'Bonus'}</b>${qbRew(B.xp, B.gold, earned)}</div>
    </div>
  </article>`;
}
function qbScaling(q){
  const n = weekClaims(q), next = scaledReward(q, n + 1), up = Math.round((Math.pow(1 + q.growth / 100, n) - 1) * 100);
  return `<article class="card qb-t wide" data-act="claim">
    ${qbTR(qbBadge('CLAIM'))}
    ${qbHead(q)}${q.note ? `<p class="qb-note">${esc(q.note)}</p>` : ''}
    <div class="qb-pips">${Array.from({ length:7 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}${n > 7 ? `<em>+${n - 7}</em>` : ''}</div>
    <span class="qb-next">${(w => n ? `Claimed ×${n} ${w}${up ? ` · next pays +${up}%` : ''}` : `Each claim ${w} pays ${q.growth}% more`)(periodOf(q) === 1 ? 'today' : `this ${periodWord(q)}`)}</span>
    <div class="qb-foot">${qbRew(next.xp, next.gold)}</div>
  </article>`;
}
function qbRecord(q){
  const done = isDone(q), p = parentOf(q), locked = p && !isVisible(q), last = q.entries.length ? q.entries[q.entries.length - 1].v : null, u = esc(q.unit);
  return `<article class="card qb-t wide${p ? ' fol' : ''}${done ? ' done' : ''}${locked ? ' locked' : ''}"${done ? ' data-act="reopen"' : ''}>
    ${done ? qbTR(qbBadge('DONE', 'ok')) : ''}
    ${qbHead(q, p ? `<span class="qb-after">${locked ? 'Unlocks after' : 'After'}: ${esc(p.name)}</span>` : '')}
    <div class="qb-tot">${q.best == null ? '<span>First entry sets your starting point</span>' : `<span>Best <b>${fmt(q.best)} ${u}</b></span>${last != null ? `<span>Last ${fmt(last)} ${u}</span>` : ''}`}</div>
    ${done || locked ? '' : `<div class="rec-input qb-in"><input type="number" step="0.1" inputmode="decimal" placeholder="${last != null ? fmt(last) : 'Enter value'}" aria-label="Value"><span class="unit">${u}</span><button class="claim off" data-act="record">Record</button></div>`}
    <div class="qb-foot">${qbRew(q.xpPer, q.goldPer, done || locked)}<span class="qb-sub">per ${fmt(q.step)} ${u} ${q.better === 'lower' ? 'below' : 'above'} best</span></div>
  </article>`;
}
function qbTally(q){
  const pv = tallyPreview(q, '');
  return `<article class="card qb-t wide tally-card">
    ${qbTR(qbBadge(`+${fmt(q.xpPer)} / ${esc(fmtU(q, q.chunk))}`))}
    ${qbHead(q)}
    <div class="qb-tot"><span>Total <b>${fmtU(q, q.total || 0)}</b></span><span class="tl-note">${tallyNote(q, pv)}</span></div>
    <div class="qb-in"><input type="number" min="0" step="any" inputmode="decimal" placeholder="Add an amount${CURRENCY.includes(unitOf(q)) || !unitOf(q) ? '' : ' (' + esc(unitOf(q)) + ')'}" data-tallyin="${q.id}" aria-label="Amount"><button class="claim off" data-act="tally">Add</button></div>
    <div class="qb-foot"><span class="tl-rew">${rewardsHtml(pv.xp, pv.gold).replace('class="rewards"', 'class="rewards" style="opacity:.45"')}</span></div>
  </article>`;
}
function qbHead(q, sub = ''){ return `<div class="qb-hd">${qbIcon(q)}<div class="qb-hdt"><h4>${esc(q.name)}</h4>${sub}</div></div>`; }
function qbTR(...parts){ return `<div class="qb-tr">${parts.join('')}</div>`; }
function qbTile(q, wide){
  if (q.kind === 'pair') return qbPair(q);
  if (q.kind === 'scaling') return qbScaling(q);
  if (q.kind === 'record') return qbRecord(q);
  if (isTracker(q)) return qbSteps(q);
  if (q.kind === 'tally') return qbTally(q);
  if (q.kind === 'target') return qbTarget(q, wide);
  if (q.kind === 'bounty') return qbBounty(q);
  if (q.kind === 'avoid') return qbAvoid(q, wide);
  return qbStandard(q, wide);
}
// which group a quest sits in (follow-ups go with their parent)
function qbGroupOf(q){
  if (q.kind === 'tally') return { key:'z-tally', order:9e9, title:'Tally', time:'' };
  if (q.kind === 'bounty') return bountyUrgent(q) ? { key:'a-due', order:-1, title:'Due soon', time:'' } : { key:'y-bounty', order:8e9, title:'Bounties', time:'' };
  const d = q.kind === 'scaling' ? periodOf(q) : isTracker(q) ? 1 : (q.days || 1);
  return { key:'d' + d, order:d, title:d === 1 ? 'Daily' : d === 7 ? 'Weekly' : `Every ${d} days`, time:d === 1 ? cd(nextMidnight()) : '' };
}
function questBoard(){
  const groups = {};
  S.quests.forEach(targetRoll);
  // steps live in the summary card; a claimed bounty stays until midnight, then it's gone
  S.quests.filter(q => !q.parent && !isTracker(q) && !(q.kind === 'bounty' && q.doneAt && q.doneAt < startOfDay())).forEach(q => {
    const g = qbGroupOf(q); (groups[g.key] ||= { ...g, list:[] }).list.push(q);
  });
  const withKids = q => [q, ...S.quests.filter(c => c.parent === q.id).flatMap(withKids)];
  const html = Object.values(groups).sort((a, b) => a.order - b.order).map(g => {
    const all = g.list.flatMap(withKids);
    // multi-day groups: count down to the soonest reset of a finished quest, else just say the cycle
    let time = g.time;
    if (!time && g.key[0] === 'd'){ const ends = all.map(q => q.kind === 'pair' || q.kind === 'target' ? q.cycleEnd : q.kind === 'scaling' ? periodEnd(q) : q.doneUntil).filter(x => x > now());
      time = ends.length ? cd(Math.min(...ends)) : `${g.key.slice(1)}-day cycle`; }
    const counted = all.filter(q => q.kind !== 'scaling' && q.kind !== 'tally' && q.kind !== 'bounty' && !isTracker(q) && isVisible(q));
    const cnt = g.key === 'z-tally' ? '' : counted.length ? `${counted.filter(isDone).length}/${counted.length}` : '';
    // half-width tiles: plain quests and steps without follow-ups; an odd one out takes the full row
    const half = q => (q.kind === 'standard' || q.kind === 'avoid' || (q.kind === 'target' && q.need <= 10) || isTracker(q)) && !S.quests.some(c => c.parent === q.id);
    const tiles = all.map(q => ({ q, w:!half(q) }));
    let run = [];
    const fix = () => { if (run.length % 2) run[run.length - 1].w = true; run = []; };
    tiles.forEach(t => { if (t.w) fix(); else run.push(t); }); fix();
    const fresh_ = id => fresh.id === id ? ' fresh' : '';
    return `<section class="qb-g${g.key === 'a-due' ? ' due' : ''}"><div class="qb-gh"><b>${g.title}${cnt ? `<span>${cnt}</span>` : ''}</b>${time ? `<span class="qb-time">${ico('i-hourglass','0 0 16 16')}${time}</span>` : ''}</div>
      <div class="qb-grid">${tiles.map(t => `<div class="item qb-item${t.w ? ' wide' : ''}${fresh_(t.q.id)}" data-id="${t.q.id}">${qbTile(t.q, t.w)}</div>`).join('')}</div></section>`;
  }).join('');
  return `<div class="qb">${S.vacation ? '<div class="vac-note">Vacation mode · streaks paused</div>' : ''}${qbSummary()}${html}</div>`;
}
// press and hold a tile to edit it
(function(){
  let timer = 0, held = 0;
  let sx = 0, sy = 0;
  $('#panel').addEventListener('pointerdown', e => {
    const it = e.target.closest('.qb-item, [data-holdedit]'); if (!it || e.target.closest('input')) return;
    clearTimeout(timer); sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { held = performance.now(); vibrate(15); openSheet(it.dataset.id || it.dataset.holdedit); }, 500);
  });
  ['pointerup','pointercancel'].forEach(t => $('#panel').addEventListener(t, () => clearTimeout(timer)));
  // a finger always wobbles a little: only a real drag (scrolling) cancels the hold
  $('#panel').addEventListener('pointermove', e => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clearTimeout(timer); }, { passive:true });
  $('#panel').addEventListener('contextmenu', e => { if (e.target.closest('.qb-item, [data-holdedit]')) e.preventDefault(); });
  $('#panel').addEventListener('click', e => { if (performance.now() - held < 500 && e.target.closest('.qb-item, [data-holdedit]')){ e.stopPropagation(); e.preventDefault(); } }, true);
})();


/* ================= Progress: Streak hero =================
   A big card with the current streak and a flame that grows with it (6 looks), three counters,
   a month calendar in the flame's colour, and recent claims. Records keep their line chart. */
function FLAME(t, size){ // t = streak tier 0..5
 const C=[['#5f7472','#3a4847','#9db2b0'],['#7dffb0','#3fd47a','#178a4a'],['#9fe2ff','#1ea4e6','#0b5f9c'],['#ecc2ff','#b46ae0','#6b2fa6'],['#ffe08a','#f08a24','#b8430f'],['#fff1c2','#ff3b3b','#8f0f14']][t];
 const id='fl'+t+Math.random().toString(36).slice(2,6), s=size||64;
 const outer='M32 4C36 16 50 22 50 40C50 52 42 60 32 60C22 60 14 52 14 40C14 30 20 26 22 18C26 24 26 28 30 30C30 20 30 12 32 4Z';
 const inner='M32 26C35 33 42 36 42 45C42 51 37.5 55 32 55C26.5 55 22 51 22 45C22 39 26 37 27 33C29 36 30 37 31 38C31 33 31 30 32 26Z';
 const side=t>=3?`<path d="M14 30C10 36 9 44 13 50C11 44 14 40 16 38Z" fill="url(#${id}o)" opacity=".8"/><path d="M50 30C54 36 55 44 51 50C53 44 50 40 48 38Z" fill="url(#${id}o)" opacity=".8"/>`:'';
 const crown=t>=5?`<path d="M20 12L24 4L28 10L32 1L36 10L40 4L44 12" fill="none" stroke="#ffd27a" stroke-width="2.4" stroke-linejoin="round" filter="url(#${id}g)"/>`:'';
 const sparks=t>=4?[[12,14],[52,16],[8,40],[56,36],[18,6],[46,6]].slice(0,t===5?6:4).map(([x,y],i)=>`<circle class="fsp" style="animation-delay:${i*.3}s" cx="${x}" cy="${y}" r="1.6" fill="${C[0]}"/>`).join(''):'';
 const scale=[.72,.78,.86,.94,1,1.06][t];
 return `<svg class="flame t${t}" viewBox="0 0 64 64" width="${s}" height="${s}" style="overflow:visible"><defs>
  <linearGradient id="${id}o" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C[2]}"/><stop offset=".55" stop-color="${C[1]}"/><stop offset="1" stop-color="${C[0]}"/></linearGradient>
  <linearGradient id="${id}i" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${C[0]}"/></linearGradient>
  <filter id="${id}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${t?3:0}"/></filter></defs>
  <g transform="translate(32 60) scale(${scale}) translate(-32 -60)">
   ${t?`<path d="${outer}" fill="${C[1]}" filter="url(#${id}g)" opacity=".75"/>`:''}${side}
   <g class="fbody"><path d="${outer}" fill="url(#${id}o)"/>${t?`<path d="${inner}" fill="url(#${id}i)" opacity=".9"/>`:''}</g>${crown}</g>${sparks}</svg>`;
}
function flameTier(n){ return n >= 200 ? 5 : n >= 100 ? 4 : n >= 30 ? 3 : n >= 10 ? 2 : n >= 3 ? 1 : 0; }
function tierCol(t){ return [['#9db2b0','157,178,176'],['#3fd47a','63,212,122'],['#1ea4e6','30,164,230'],['#b46ae0','180,106,224'],['#f08a24','240,138,36'],['#ff3b3b','255,59,59']][t]; }
function heroCal(q, map, tc){
  const base = new Date(), m0 = new Date(base.getFullYear(), base.getMonth() - monthOffset, 1);
  const y = m0.getFullYear(), mo = m0.getMonth(), daysIn = new Date(y, mo + 1, 0).getDate(), lead = (m0.getDay() + 6) % 7, today = dayKey();
  let cells = ['M','T','W','T','F','S','S'].map(d => `<span class="hx-dow">${d}</span>`).join('') + '<i class="hx-c blank"></i>'.repeat(lead), n = 0;
  for (let d = 1; d <= daysIn; d++){
    const t = new Date(y, mo, d).getTime(), k = dayKey(t), o = map[k]; if (o) n++;
    let c = '';
    if (o){ if (q.kind === 'pair') c = o.a && o.b ? (o.bonus ? 'on bonus' : 'on') : 'split';
      else if (q.kind === 'scaling') c = 'on s' + Math.min(3, o.n); else c = 'on'; }
    if (t > startOfDay()) c += ' fut'; if (k === today) c += ' td'; if (k === selDay) c += ' sel';
    cells += `<button class="hx-c ${c}" data-act="hday" data-day="${k}">${d}</button>`;
  }
  const title = m0.toLocaleDateString(undefined, { month:'long' }) + (y !== base.getFullYear() ? ' ' + y : '');
  return `<div class="hx-card"><div class="hx-h"><span>${title}</span><small>${n} ${n === 1 ? 'day' : 'days'}</small>
      <div class="hx-nav"><button data-act="mo-prev" aria-label="Previous month">‹</button><button data-act="mo-next" aria-label="Next month"${monthOffset === 0 ? ' disabled' : ''}>›</button></div></div>
    <div class="hx-cal" style="--tc:${tc[0]};--tcr:${tc[1]}">${cells}</div>
    ${q.kind === 'pair' ? `<div class="hx-leg"><span><i class="hx-c on bonus"></i>Both · bonus</span><span><i class="hx-c split"></i>One half</span></div>` : ''}
    ${dayInfo(q, map)}</div>`;
}
// Undo on a Recent row: only for a claim that can still be reopened (same as tapping its done tile)
const UNDO_OFF = '<button class="hx-undo" disabled>Undo</button>';
function undoBtn(q, e, i){ return undoLive(q, e, i) || UNDO_OFF; }
function undoLive(q, e, i){
  if (i === 0 && q.kind === 'scaling' && q.week === periodStart(q) && q.weekClaims > 0 && e.t >= q.week)
    return `<button class="hx-undo" data-act="lastundo" data-q="${q.id}">Undo</button>`;
  if (i === 0 && q.kind === 'tally') return `<button class="hx-undo" data-act="lastundo" data-q="${q.id}">Undo</button>`;
  if (q.kind === 'pair'){
    const last = h => q[h].log && q[h].log.length ? q[h].log[q[h].log.length - 1].t : 0;
    let k = e.what === q.a.name && last('a') === e.t ? 'a' : e.what === q.b.name && last('b') === e.t ? 'b' : null;
    // the bonus row: undoing the half claimed last takes the bonus back with it
    if (e.what === 'Pair bonus' && q.bonusLog && q.bonusLog.length && q.bonusLog[q.bonusLog.length - 1].t === e.t && q.bonusUntil > now()) k = last('a') > last('b') ? 'a' : 'b';
    return k && q[k].undo && q[k].until > now() ? `<button class="hx-undo" data-act="hxundo" data-q="${q.id}" data-k="${k}">Undo</button>` : '';
  }
  if (i !== 0 || !['standard','target','avoid','bounty'].includes(q.kind) || !q.undo || !isDone(q)) return '';
  return `<button class="hx-undo" data-act="hxundo" data-q="${q.id}">Undo</button>`;
}
// Streak bonus explained, each row with the flame you'd have by then
function streakInfo(){
  const row = (pct, txt, t) => `<div class="sk-row"><b style="--c:${tierCol(t)[0]}">${pct}</b><span>${txt}</span>${FLAME(t, 26)}</div>`;
  return `<div class="info sk-info" data-act="skinfo"><span class="info-btn" aria-label="Streak bonus">i</span>
    <template><div class="info-title">Streak bonus</div>${row('+10%', 'every 5', 1)}${row('+200%', 'at 100', 4)}${row('+250%', 'at 200', 5)}</template></div>`;
}
// the streak card clips its corners, so its bubble is shown outside it, under the (i)
function toggleSkPop(el){
  let pop = $('#skPop');
  if (pop){ pop.remove(); if (pop.dataset.for === 'on') return; }
  const r = el.getBoundingClientRect();
  pop = document.createElement('div'); pop.id = 'skPop'; pop.className = 'info-pop sk-pop'; pop.dataset.for = 'on';
  pop.innerHTML = el.querySelector('template').innerHTML;
  pop.style.top = (r.bottom + scrollY + 6) + 'px'; pop.style.left = Math.max(8, Math.min(innerWidth - 216, r.left - 2)) + 'px';
  document.body.appendChild(pop); vibrate(6);
}
document.addEventListener('click', e => { const p = $('#skPop'); if (p && !e.target.closest('#skPop, .sk-info')) p.remove(); }, true);
document.addEventListener('scroll', () => { const p = $('#skPop'); if (p) p.remove(); }, true);
{ const host = $('#fStreakInfo');
  if (host){ host.innerHTML = streakInfo();
    host.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleSkPop(host.querySelector('.sk-info')); }); } }
function questHero(q){
  const map = dayMap(q), logs = allLogs(q).sort((a, b) => b.t - a.t), t0 = now();
  const xp = logs.reduce((a, e) => a + (e.xp || 0), 0), gold = logs.reduce((a, e) => a + (e.gold || 0), 0);
  let k, big, unit, sub, tier = 0, art;
  if (hasStreak(q)){
    const n = streakNow(q), best = Math.max(q.bestStreak || 0, n), m = streakReward(q) ? streakMult(n) : 1;
    tier = flameTier(n); k = q.kind === 'pair' ? 'Both-done streak' : q.kind === 'avoid' ? 'Days clean' : q.kind === 'target' ? 'Targets hit in a row' : 'Current streak'; big = fmt(n);
    unit = q.kind === 'target' ? (n === 1 ? 'time' : 'times') : n === 1 ? 'day' : 'days';
    if (q.kind === 'avoid') q.best = Math.max(q.best || 0, n);
    sub = `Best ${fmt(q.kind === 'avoid' ? q.best : best)}${q.kind === 'avoid' && (q.slips || []).length ? ` · slipped ${q.slips.length}×` : ''}${m > 1 ? ` · +${Math.round((m - 1) * 100)}% reward bonus` : ''}`; art = FLAME(tier, 64);
  } else if (q.kind === 'scaling'){
    const w = weekClaims(q); tier = -1; k = `This ${periodOf(q) === 1 ? 'day' : periodWord(q)}`; big = '×' + w; unit = '';
    sub = `Next claim pays ${scaledReward(q, w + 1).xp} XP · resets ${new Date(periodEnd(q)).toLocaleDateString(undefined, { weekday:'short' })}`; art = `<div class="hx-ic">${qbIcon(q)}</div>`;
  } else {   // tally
    tier = -2; k = 'Total'; big = fmtU(q, q.total || 0); unit = ''; sub = q.carry ? `${fmtU(q, q.carry)} carried over` : `${fmt(logs.length)} entries`;
    art = `<div class="hx-ic">${qbIcon(q)}</div>`;
  }
  const tc = tier === -1 ? ['#ff5a5a', '255,90,90'] : tier === -2 ? ['#ffc94a', '255,201,74'] : tierCol(tier);   // recurring = red, tally = gold, streaks = flame colour
  const kp = q.kind === 'pair'
    ? [[esc(q.a.name), fmt(q.a.count || 0) + '×'], [esc(q.b.name), fmt(q.b.count || 0) + '×'], ['Bonus', fmt(q.bonusCount || 0) + '×', 't']]
    : [['Total', fmt(logs.length)], ['XP earned', fmt(xp), 'x'], ['Gold', fmt(gold), 'g']];
  return `<div class="hx" style="--tc:${tc[0]};--tcr:${tc[1]}">
    <div class="hx-hero"><div><div class="hx-k">${k}${hasStreak(q) && streakReward(q) ? streakInfo() : ''}</div><div class="hx-big">${big}${unit ? `<small>${unit}</small>` : ''}</div><div class="hx-sub">${sub}</div></div><div class="hx-art">${art}</div></div>
    <div class="hx-kp">${kp.map(([l, v, c]) => `<div><span>${l}</span><b class="${c || ''}">${v}</b></div>`).join('')}</div>
    ${heroCal(q, map, tc)}
    <div class="hx-card"><div class="hx-h"><span>Recent</span></div>
      ${logs.length ? (() => { const rows = logs.slice(0, 8), ub = rows.map((e, i) => undoBtn(q, e, i));
        return rows.map((e, i) => `<div class="hx-log"><div class="hx-lt"><b>${esc(e.what)}</b><small>${dayLabel(e.t)} · ${new Date(e.t).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' })}</small></div>${qbRew(e.xp || 0, e.gold || 0)}${ub[i]}</div>`).join(''); })() : '<div class="dayinfo">Nothing claimed yet.</div>'}
    </div></div>`;
}
/* "Show in Progress": a centred dialog with switches, grouped like the Quests tab */
function renderProgPop(){
  const qs = S.quests.filter(q => !isTracker(q) && q.kind !== 'bounty'), shown = qs.filter(isTracked).length, groups = {};
  qs.forEach(q => { const g = q.parent ? qbGroupOf(parentOf(q) || q) : qbGroupOf(q); (groups[g.key] ||= { ...g, list:[] }).list.push(q); });
  const dot = q => ({ pair:'#ff8a45', scaling:'#ff5a5a', record:'#ff8fb1', tally:'#ffc94a' })[q.kind] || '#ffc94a';
  $('#progPop').innerHTML = `<div class="pp-dlg">
    <div class="pp-tt"><b>Show in Progress</b><span>${shown} of ${qs.length} shown</span></div>
    <div class="pp-qa"><button data-ppall="1">Show all</button><button data-ppall="0">Hide all</button></div>
    ${Object.values(groups).sort((a, b) => a.order - b.order).map(g => `<div class="pp-gl">${g.title}</div>${g.list.map(q => `<label class="pp-sw${isTracked(q) ? '' : ' off'}">
      <i class="d" style="--c:${dot(q)}"></i><span>${esc(q.name)}</span><input type="checkbox" data-pp="${q.id}"${isTracked(q) ? ' checked' : ''}><i class="sw"></i></label>`).join('')}`).join('') || '<p class="help">No quests yet.</p>'}
    <button class="pp-done" data-ppdone="1">Done</button></div>`;
}
$('#progPop').addEventListener('click', e => {
  const all = e.target.closest('[data-ppall]');
  if (all){ S.progHide ||= {}; S.quests.forEach(q => { if (all.dataset.ppall === '1') delete S.progHide[q.id]; else if (!isTracker(q)) S.progHide[q.id] = true; }); save(); ppSync(); return; }
  if (e.target.closest('[data-ppdone]') || e.target === $('#progPop')) closeProgPop();
});
// toggling only updates the switches and the count in place
function ppSync(){
  const qs = S.quests.filter(q => !isTracker(q));
  document.querySelectorAll('#progPop .pp-sw').forEach(l => { const inp = l.querySelector('input'), q = byId(inp.dataset.pp); if (!q) return; inp.checked = isTracked(q); l.classList.toggle('off', !inp.checked); });
  const c = document.querySelector('#progPop .pp-tt span'); if (c) c.textContent = `${qs.filter(isTracked).length} of ${qs.length} shown`;
}
$('#progPop').addEventListener('change', () => setTimeout(ppSync, 0));


/* Progress: swipe anywhere (except the week chart and the chips) to go to the next / previous quest */
(function(){
  let s0 = null, swiped = 0;
  const order = () => ['steps', ...S.quests.filter(q => q.kind !== 'steps' && q.kind !== 'bounty' && isTracked(q)).map(q => q.id)];
  $('#panel').addEventListener('pointerdown', e => { if (S.tab === 'progress' && !e.target.closest('.sh-cols, .chips, .chips2, input')) s0 = { x:e.clientX, y:e.clientY }; });
  $('#panel').addEventListener('pointercancel', () => { s0 = null; });
  $('#panel').addEventListener('pointerup', e => {
    const a = s0; s0 = null; if (!a) return;
    const dx = e.clientX - a.x, dy = e.clientY - a.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const L = order(), i = Math.max(0, L.indexOf(S.pview || 'steps')), j = (i + (dx < 0 ? 1 : -1) + L.length) % L.length;
    swiped = performance.now();
    S.pview = L[j]; monthOffset = 0; selDay = null; weekOffset = 0; save(); render();
    const body = document.querySelector('#panel .hx, #panel .shx, #panel > .list:last-child'); if (body) body.classList.add(dx < 0 ? 'pv-in-r' : 'pv-in-l');
    document.querySelector('#panel .chips .chip.on')?.scrollIntoView({ inline:'center', block:'nearest', behavior:'smooth' });
    vibrate(6);
  });
  $('#panel').addEventListener('click', e => { if (performance.now() - swiped < 400 && S.tab === 'progress'){ e.stopPropagation(); e.preventDefault(); } }, true);
})();
/* swipe the week chart: left = newer week, right = older week */
(function(){
  let s0 = null, swiped = 0;
  $('#panel').addEventListener('pointerdown', e => { if (e.target.closest('.sh-cols')) s0 = { x:e.clientX, y:e.clientY }; });
  $('#panel').addEventListener('pointerup', e => {
    const a = s0; s0 = null; if (!a) return;
    const dx = e.clientX - a.x, dy = e.clientY - a.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    swiped = performance.now();
    if (dx > 0) weekOffset++; else if (weekOffset > 0) weekOffset--; else return;
    render(); const c = document.querySelector('.sh-cols'); if (c) c.classList.add(dx > 0 ? 'in-l' : 'in-r'); vibrate(6);
  });
  $('#panel').addEventListener('pointercancel', () => { s0 = null; });
  $('#panel').addEventListener('click', e => { if (performance.now() - swiped < 400 && e.target.closest('.sh-cols')){ e.stopPropagation(); e.preventDefault(); } }, true);
})();
/* ================= Progress: Steps (HUD) =================
   Today panel, a week of segment columns (red segment = the goal line; gold column = goal hit, tap to
   claim the goal bonus, then it turns green), and one row per day with its own Claim button. */
function goalStreak(q){
  if (!q || !q.goal) return 0;
  const V = valsOf(q); let t = startOfDay(), n = 0;
  if (!((V[dayKey(t)] || 0) >= q.goal)) t = addDays(t, -1);   // today still counts once it's done
  while ((V[dayKey(t)] || 0) >= q.goal){ n++; t = addDays(t, -1); }
  return n;
}
function stepsHud(){
  const q = firstSteps(), V = q ? valsOf(q) : S.steps, goal = q ? q.goal : 10000;
  const ws = addDays(weekStart(), -7 * weekOffset), days = [0,1,2,3,4,5,6].map(i => addDays(ws, i));
  const vals = days.map(t => V[dayKey(t)] || 0), today = startOfDay(), ti = days.indexOf(today);
  const elapsed = ti >= 0 ? ti + 1 : 7, avg = Math.round(vals.reduce((a, b) => a + b, 0) / elapsed);
  const tv = V[dayKey()] || 0, D = S.dist || {};
  const km = (D[dayKey()] || tv * STRIDE_M) / 1000, distTxt = S.distUnit === 'mi' ? `${fmt(Math.round(km / 1.609344 * 100) / 100)} MI` : `${fmt(Math.round(km * 100) / 100)} KM`;
  // today: 10 segments toward the goal
  const tf = goal ? Math.min(1, tv / goal) * 10 : 0;
  const seg10 = Array.from({ length:10 }, (_, i) => i + 1 <= tf ? '<i class="on"></i>' : i < tf ? `<i class="h" style="--p:${((tf - i) * 100).toFixed(0)}%"></i>` : '<i></i>').join('');
  // week columns
  // one segment = 1,000 steps: segment 1 lights for 1–999, segment 2 for 1,000–1,999 ... the goal's segment is red
  // 14 segments of 1,000 steps each; 14,000+ fills the column
  const N = 14, segOf = v => v > 0 ? Math.min(N, Math.floor(v / 1000) + 1) : 0, gi = goal ? Math.min(N - 1, Math.floor(goal / 1000)) : -1;
  const short = v => v >= 10000 ? (Math.floor(v / 100) / 10) + 'k' : fmt(v);
  const cols = days.map((t, i) => {
    const v = vals[i], k = dayKey(t), fut = ti >= 0 && i > ti, n = segOf(v);
    const met = q && goal && v >= goal, paid = met && q.goalPaid && q.goalPaid[k], bonus = met && (q.goalXp || q.goalGold);
    const cls = fut ? 'fut' : met ? (bonus && !paid ? 'gold' : 'green') : 'on';
    const act = met && bonus && !paid && !fut ? ` data-act="goalclaim" data-q="${q.id}" data-day="${k}"` : '';
    const segs = Array.from({ length:N }, (_, s) => `<i class="${s < n ? cls : ''}${s === gi ? ' goal' : ''}"></i>`).join('');
    return `<div class="sh-col${act ? ' tap' : ''}${i === ti ? ' td' : ''}"${act}><span class="sh-v">${fut ? '' : short(v)}</span><div class="sh-segs">${segs}</div><span class="sh-d">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span></div>`;
  }).join('');
  const fd = t => new Date(t).toLocaleDateString(undefined, { month:'short', day:'numeric' });
  // one row per day
  const rows = q ? days.filter((t, i) => ti < 0 || i <= ti).map(t => {
    const k = dayKey(t), d = stepDue(q, k), lab = t === today ? 'Today' : new Date(t).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    const btn = d.units ? `<button class="sh-go" data-act="claimday" data-q="${q.id}" data-day="${k}">CLAIM</button>`
      : d.paid ? '<span class="sh-go ok">CLAIMED</span>' : '<span class="sh-go off">CLAIM</span>';
    const paidU = Math.floor(d.paid / q.chunk);
    const undo = paidU > 0 ? `<button class="hx-undo" data-act="dayundo" data-q="${q.id}" data-day="${k}">Undo</button>` : UNDO_OFF;
    const rw = d.units ? qbRew(d.xp, d.gold) : d.paid ? qbRew(d.totalXp, d.totalGold, true) : qbRew(0, 0, true);
    return `<div class="sh-row2 sh-row3"><div><b>${lab}</b><small>${fmt(d.steps)} steps</small></div>${rw}${btn}${undo}</div>`;
  }).join('') : '';
  const all = Object.values(V).reduce((a, b) => a + (+b || 0), 0);
  const allKm = Object.entries(V).reduce((a, [k, v]) => a + (D[k] || (+v || 0) * STRIDE_M), 0) / 1000;
  return `<div class="shx">
    <div class="hud"><div class="hud-bar"><span>// STEPS · TODAY</span><span>GOAL STREAK ${goalStreak(q)}</span></div>
      <div class="hud-num">${String(tv).padStart(5, '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')}<small>/ ${fmt(goal)}</small></div>
      <div class="hud-seg">${seg10}</div>
      <div class="hud-lab"><span data-act="distunit">${distTxt}</span><span>${tv >= goal ? 'GOAL HIT' : fmt(goal - tv) + ' TO GOAL'}</span></div></div>
    <div class="hud"><div class="hud-bar"><span class="hud-wk"><button data-act="wk-prev" aria-label="Previous week">‹</button>// WEEK · ${fd(days[0]).toUpperCase()} – ${fd(days[6]).toUpperCase()}<button data-act="wk-next" aria-label="Next week"${weekOffset === 0 ? ' disabled' : ''}>›</button></span><span>AVG ${fmt(avg)}</span></div>
      <div class="sh-cols">${cols}</div>
      ${q && (q.goalXp || q.goalGold) ? `<div class="hud-note"><i class="g"></i>goal hit · tap to claim <i class="gr"></i>claimed <i class="rd"></i>goal</div>` : ''}</div>
    ${q ? `<div class="hud"><div class="hud-bar"><span>// DAILY REWARDS</span><span>+${fmt(q.xpPer)} / +${fmt(q.goldPer)} PER ${fmt(q.chunk)}</span></div>${rows}</div>` : `<div class="empty">Post a Steps quest to start earning rewards for walking.</div>`}
    <div class="hud"><div class="hud-bar"><span>// ALL-TIME</span></div>
      <div class="sh-row2"><div><b data-act="stepsexact">${stepsExact ? fmt(all) : bigNum(all)} steps</b></div><span class="sh-rw" data-act="distunit">${S.distUnit === 'mi' ? fmt(Math.round(allKm / 1.609344 * 100) / 100) + ' mi' : fmt(Math.round(allKm * 100) / 100) + ' km'}</span></div></div>
  </div>`;
}


/* ================= Deck tab: holo showcase =================
   One big tilted deck with a holo shine, the neighbouring decks faded at the sides, a count badge,
   Opened / Collected, the UR guarantee bar and page dots. Swipe up (or tap) to open, sideways to switch. */
function renderInventory(){
  const items = SHOP.filter(it => !it.soon);
  if (!items.length) return '<div class="empty">Nothing here yet.</div>';
  invIdx = ((invIdx || 0) % items.length + items.length) % items.length;
  const it = items[invIdx], n = owned(it.id), opened = (S.opened && S.opened[it.id]) || 0, D = deckOf(it);
  const all = CARDS.filter(c => c.deck === it.deck), got = all.filter(c => ownedCard(c.id)).length;
  const prev = items[(invIdx + items.length - 1) % items.length], next = items[(invIdx + 1) % items.length];
  const pity = it.pity ? Math.min(it.pity, (S.pity && S.pity[it.id]) || 0) : 0;
  const dots = items.length > 1 ? `<div class="inv-dots">${items.map((x, k) => `<button class="${k === invIdx ? 'on' : ''}" data-act="invdot" data-k="${k}" aria-label="${esc(x.name)}"></button>`).join('')}</div>` : '';
  const ob = $('#openAllBtn'); ob.hidden = n < 2; ob.dataset.item = it.id; ob.textContent = `Open all ×${n}`; ob.className = 'open-all th-' + it.deck;
  return `<div class="inv dka th-${it.deck}${n ? '' : ' none'}">
    ${items.length > 1 ? `<img class="dka-ghost l" src="${deckOf(prev).cover}" alt=""><img class="dka-ghost r" src="${deckOf(next).cover}" alt="">` : ''}
    <div class="dka-stage">
      <div class="inv-stack" data-act="${n ? 'useitem' : 'goshop'}" data-item="${it.id}">
        <div class="inv-layer top${n ? '' : ' dim'}"><img src="${D.cover}" alt=""><i class="dka-holo"></i></div>
        ${n ? `<span class="dka-cnt">×${fmt(n)}</span>` : ''}
      </div>
    </div>
    <div class="inv-name">${esc(it.name)}</div>
    <div class="inv-hint dka-hint" data-act="${n ? 'useitem' : 'goshop'}" data-item="${it.id}">${n ? 'SWIPE UP TO OPEN' : 'GET MORE IN THE SHOP'}</div>
    <div class="dka-stats"><div><span>Opened</span><b>${fmt(opened)}</b></div><div><span>Collected</span><b>${got}/${all.length}</b></div></div>
    ${it.pity ? `<div class="ur-slots" title="UR guaranteed in ${it.pity - pity}">${Array.from({ length:it.pity }, (_, i) => i === it.pity - 1
      ? '<i class="ur"><b>UR</b></i>' : `<i class="${i < pity ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    ${dots}
  </div>`;
}
/* ---- Open all: every deck of this kind at once, cards laid out face down (glowing in their rarity),
   best first. Tap to flip one, double-tap anywhere to flip them all. ---- */
function openAll(id){
  const item = SHOP.find(x => x.id === id), n = owned(id);
  if (!item || n < 1 || opening) return;
  snap = null;
  S.inv[id] = 0; S.opened[id] = (S.opened[id] || 0) + n;
  let cards = [], scenes = 0; const fresh = {};
  for (let i = 0; i < n; i++){
    const res = rollDeck(item);
    res.cards.forEach(c => { if (!ownedCard(c.id) && !fresh[c.id]) fresh[c.id] = true; gainCard(c.id); });
    if (res.scene){ S.scenes[res.scene.id] = true; scenes++; }
    cards = cards.concat(res.cards);
  }
  save();
  cards.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));   // UR first
  opening = { item, cards, all:true, fresh, scene:null, flipped:new Set(), done:false, scenes };
  const ids = [...new Set(cards.map(c => c.id)), deckOf(item).back, deckOf(item).backUR];
  Promise.all(ids.map(x => { const im = new Image(); im.src = cardImg(x); return im.decode().catch(() => {}); })).then(showOpenAll);
}
/* Open all, shown as a stack: the front card big, the rest fanned out behind it to the right.
   Tap the front card to flip it, tap again (or swipe it left) for the next one. The flipped cards collect
   in a tray at the bottom. Double-tap the background to flip everything. Ends on a grid of all cards. */
function oaCardHTML(c, i){
  return `<button class="oa-c r-${c.rarity}" data-i="${i}" style="--rc:${RARITY[c.rarity].glow}">
    <span class="oa-in"><img class="oa-b" src="${cardImg(backOf(c, c.rarity === 'ultimate'))}" alt=""><span class="oa-f"><img src="${cardImg(c.id)}" alt=""></span></span><span class="oa-tag"></span></button>`;
}
function showOpenAll(){
  const o = opening, ov = $('#pack'); if (!o) return;
  clearTimeout(packClear);
  o.idx = 0;
  ov.innerHTML = `<div class="oa2"><div class="oa-h"><b>${fmt(o.cards.length / o.item.cards)} ${esc(o.item.name)}s</b><span id="oaCount">1 / ${o.cards.length}</span></div>
    <div class="oa-stage">${o.cards.map(oaCardHTML).join('')}</div>
    <div class="oa-hint pk-hint">Double-tap anywhere to reveal all</div>
    <div class="oa-tray" id="oaTray"></div></div>`;
  ov.classList.add('open');
  oaLayout();
  ov.querySelectorAll('.oa-stage .oa-c').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); oaTap(+b.dataset.i); }));
  // swipe the front card left for the next one
  let sx = null;
  const st = ov.querySelector('.oa-stage');
  st.addEventListener('pointerdown', e => { sx = e.clientX; });
  st.addEventListener('pointerup', e => { if (sx != null && sx - e.clientX > 50){ const f = o.cards[o.idx]; if (f && o.flipped.has(o.idx)) oaNext(); } sx = null; });
}
function oaLayout(){
  const o = opening; if (!o || !o.all) return;
  document.querySelectorAll('#pack .oa-stage .oa-c').forEach(b => {
    const k = +b.dataset.i - o.idx;
    b.classList.toggle('front', k === 0);
    if (k < 0){ b.style.transform = 'translateX(-130%) rotate(-12deg)'; b.style.opacity = '0'; b.style.pointerEvents = 'none'; return; }
    b.style.transform = `translateX(${k * 20}px) translateY(${k * 2}px) scale(${Math.max(.6, 1 - k * .06)})`;
    b.style.zIndex = 100 - k; b.style.opacity = k > 6 ? '0' : '1'; b.style.filter = k ? `brightness(${Math.max(.35, 1 - k * .12)})` : '';
    b.style.pointerEvents = k === 0 ? '' : 'none';
  });
  const c = $('#oaCount'); if (c) c.textContent = `${Math.min(o.idx + 1, o.cards.length)} / ${o.cards.length}`;
}
function oaTap(i){
  const o = opening; if (!o || !o.all || i !== o.idx) return;
  if (!o.flipped.has(i)){
    o.flipped.add(i);
    const btn = $(`#pack .oa-stage .oa-c[data-i="${i}"]`), c = o.cards[i];
    btn.classList.add('flipped'); btn.querySelector('.oa-tag').innerHTML = o.fresh[c.id] ? 'NEW' : '';
    setTimeout(() => { if (opening === o) revealFX(btn, c.rarity); }, 160);
  } else oaNext();
}
function oaNext(){
  const o = opening; if (!o) return;
  const c = o.cards[o.idx];
  $('#oaTray').insertAdjacentHTML('afterbegin', `<img class="r-${c.rarity}" style="--rc:${RARITY[c.rarity].glow}" src="${cardImg(c.id)}" alt="">`);
  o.idx++;
  if (o.idx >= o.cards.length) return oaSummary();
  oaLayout(); vibrate(6);
}
function oaSummary(){
  const o = opening; if (!o) return;
  o.cards.forEach((_, i) => o.flipped.add(i));
  const ov = $('#pack');
  ov.innerHTML = `<div class="oa"><div class="oa-h"><b>${fmt(o.cards.length / o.item.cards)} ${esc(o.item.name)}s</b><span>${o.cards.length} cards</span></div>
    <div class="oa-grid">${o.cards.map((c, i) => oaCardHTML(c, i).replace('class="oa-c', 'class="oa-c flipped')).join('')}</div>
    <div class="oa-foot"><button class="post" id="oaDone">Done</button></div></div>`;
  ov.querySelectorAll('.oa-c').forEach(b => { const c = o.cards[+b.dataset.i]; b.querySelector('.oa-tag').innerHTML = o.fresh[c.id] ? 'NEW' : ''; b.addEventListener('click', e => { e.stopPropagation(); inspectCard(c.id); }); });
  o.done = true;
  $('#oaDone').addEventListener('click', e => { e.stopPropagation(); closeOpening(); if (o.scenes) showToast(`${o.scenes} new ${o.scenes === 1 ? 'scene' : 'scenes'} unlocked`, false); });
  const best = ov.querySelector('.oa-c'); if (best && o.cards[0].rarity !== 'common') setTimeout(() => revealFX(best, o.cards[0].rarity), 200);
}
function oaRevealAll(){ const o = opening; if (o && o.all && !o.done) oaSummary(); }
(function(){
  let last = 0;
  $('#pack').addEventListener('click', e => {
    const o = opening; if (!o || !o.all || o.done) return;
    if (e.target.closest('.oa-c')){ last = 0; return; }   // the card handles its own tap
    e.stopPropagation();
    const t = performance.now(); if (t - last < 350){ last = 0; oaRevealAll(); } else last = t;
  }, true);
})();
$('#openAllBtn').addEventListener('click', e => { e.stopPropagation(); openAll(e.currentTarget.dataset.item); });


/* ---- Collection 2: pack tabs, category chips (multi-select), overview bars, folding sets ---- */
var colSets = [], colOpen = {};
function colRing(f1, f2, c){
  const R = 9, C = 2 * Math.PI * R;
  // first lap = cards owned (rarity colour); once full, a gold lap = cards owned ×2 (progress to claim again)
  return `<svg class="cc-ring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="${R}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3.4"/>
    ${f1 > 0 ? `<circle cx="12" cy="12" r="${R}" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${C * f1} ${C}"/>` : ''}
    ${f1 >= 1 && f2 > 0 ? `<circle cx="12" cy="12" r="${R}" fill="none" stroke="#f5c542" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${C * f2} ${C}"/>` : ''}</svg>`;
}
function colInfo(set){
  if (set === SCENES_KEY){
    const got = SCENES.filter(sc => S.scenes[sc.id]).length, n = SCENES.length;
    return { name:'Scenes', col:'#9db2b0', got, n, f1:got / n, f2:0, ready:got === n && !S.setClaims[set] };
  }
  const list = CARDS.filter(c => c.set === set), n = list.length, r = list[0].rarity;
  const got = list.filter(c => ownedCard(c.id)).length, two = list.filter(c => ownedCard(c.id) >= 2).length;
  return { name:setLabel(set), list, rar:r, col:RARITY[r].color, got, two, n, f1:got / n, f2:two / n, ready:setReady(set) };
}
function renderCollection(){
  const packs = COLLECTIONS.filter(g => colGroup === 'all' || colGroup === g.id);
  const keys = [];
  packs.forEach(g => { g.sets.forEach(s => keys.push(s)); if (g.scenes) keys.push(SCENES_KEY); });
  if (colGroup === 'all'){   // all packs: rarest sets first, scenes last
    const rk = k => k === SCENES_KEY ? 99 : RARITY_ORDER.indexOf((CARDS.find(c => c.set === k) || {}).rarity);
    keys.sort((a, b) => rk(a) - rk(b));
  }
  colSets = (colSets || []).filter(k => keys.includes(k)); colOpen = colOpen || {};   // the app can draw before these vars are set       // drop picks from a pack that is no longer shown
  const tile = colTile;
  // pack picker: one tile per pack with its card back and how many you have
  const pkCol = { all:'200,220,218', tarot:'255,107,26', mlbb:'124,92,255' };
  const pkTile = (id, name) => {
    const L = CARDS.filter(c => id === 'all' || COLLECTIONS.find(g => g.id === id).sets.includes(c.set));
    const art = id === 'all' ? COLLECTIONS.map(g => `<img src="${cardImg(DECKS[g.id].back)}" alt="">`).join('') : `<img class="v-ur" src="${cardImg(DECKS[id].backUR)}" alt=""><img class="v-n" src="${cardImg(DECKS[id].back)}" alt="">`;   // V: UR back behind, normal back in front
    return `<button class="pk-tile${colGroup === id ? ' on' : ''}" style="--r:${pkCol[id] || '200,220,218'}" data-act="colg" data-g="${id}">${art}<b>${esc(name)}</b><small>${L.filter(c => ownedCard(c.id)).length}/${L.length}</small></button>`;
  };
  let html = `<div class="pk-tiles">${pkTile('all', 'All')}${COLLECTIONS.map(g => pkTile(g.id, g.id === 'mlbb' ? 'Land of Dawn' : g.name)).join('')}</div>`;
  // search bar (magnifying glass in the title row): results replace the sets while something is typed
  if (colSearch) html += `<div id="ccRes">${colQ ? colSearchHTML(colQ) : ''}</div>`;
  html += `<div id="ccMain"${colSearch && colQ ? ' hidden' : ''}>`;
  // category chips: tap to pick one or more, tap again to drop; none picked = show everything
  html += `<div class="cc-chips">${keys.map(k => { const I = colInfo(k);
    return `<button class="cc-chip${colSets.includes(k) ? ' on' : ''}${I.ready ? ' ready' : ''}" style="--c:${I.col}" data-act="colset" data-set="${esc(k)}">${colRing(I.f1, I.f2, I.col)}${esc(I.name)}</button>`; }).join('')}</div>`;
  // overview bars for whatever pack tab is picked (hidden while categories are picked)
  if (!colSets.length){
    const pool = CARDS.filter(c => packs.some(g => g.sets.includes(c.set)));
    const title = colGroup === 'all' ? 'All packs' : colGroup === 'mlbb' ? 'Land of Dawn' : packs[0].name;
    html += `<div class="cc-over"><div class="cc-tt"><b>${esc(title)}</b><span>${pool.filter(c => ownedCard(c.id)).length}/${pool.length}</span></div>${RARITY_ORDER.map(r => {
      const L = pool.filter(c => c.rarity === r); if (!L.length) return '';
      const g = L.filter(c => ownedCard(c.id)).length;
      return `<div class="cc-row"><span style="color:${RARITY[r].color}">${RARITY[r].name}</span><span class="cc-bar"><i style="width:${g / L.length * 100}%;background:${RARITY[r].color}"></i></span><span>${g}/${L.length}</span></div>`; }).join('')}</div>`;
  }
  (colSets.length ? keys.filter(k => colSets.includes(k)) : keys).forEach(k => {
    const I = colInfo(k), open = colOpen[k] !== false;
    const scene = k === SCENES_KEY;
    const prevIds = scene ? SCENES.filter(sc => S.scenes[sc.id]).map(sc => sc.id) : I.list.filter(c => ownedCard(c.id)).map(c => c.id);
    const prev = (prevIds.length ? prevIds : scene ? [] : I.list.map(c => backOf(c))).slice(0, 3);
    const claim = scene ? claimBtn(SCENES_KEY, I.got === I.n, SCENE_REWARD) : claimBtn(k, I.ready, SET_REWARD[I.rar], true);
    const cnt = !scene && setTimes(k) ? `${I.two}/${I.n} ×2` : `${I.got}/${I.n}`;
    html += `<section class="cc-fold${open ? ' open' : ''}${I.ready ? ' ready' : ''}" style="--c:${I.col};--rows:${open ? (k === 'Puzzle' ? 1 : Math.ceil(I.n / 3)) : 0}">
      <div class="cc-hd" data-act="colfold" data-set="${esc(k)}">
        <div class="cc-pv${scene ? ' land' : ''}">${prev.map(id => `<img src="${cardImg(id)}" alt="">`).join('') || '<i></i>'}</div>
        <div class="cc-mid"><b>${esc(I.name)}<small>${cnt}</small></b><div class="cc-bar"><i style="width:${I.f1 * 100}%"></i>${I.f1 >= 1 && I.f2 ? `<i class="gold" style="width:${I.f2 * 100}%"></i>` : ''}</div></div>
        ${claim}
      </div>
      ${open ? `<div class="cc-bd">${scene
        ? `<div class="col-scenes">${SCENES.map(sc => S.scenes[sc.id]
            ? `<button class="cs" data-act="inspect" data-id="${sc.id}" data-scene="1"><img loading="lazy" decoding="async" src="${cardImg(sc.id)}" alt="${esc(sc.name)}"></button>`
            : `<div class="cs locked"><span>Undiscovered scene</span></div>`).join('')}</div>`
        : k === 'Puzzle' ? puzzleStrip(I.list) : `<div class="col-grid">${I.list.map(tile).join('')}</div>`}</div>` : ''}
    </section>`;
  });
  return `<div class="collection cc">${html}</div></div>`;
}

/* ---- Rank emblem: circuit starburst + hex runner + light rays, animated.
   Ranks past Legend add crown points, a second ring, two-tone colour, wings, a shockwave and a colour-shifting prism.
   Glow filters only sit on parts that don't move (moving parts with a blur filter would be redrawn every frame). ---- */
function embEnd(d){
  const m = d.match(/-?[\d.]+/g).map(Number); let x = m[0], y = m[1];
  d.slice(1).split(/(?=[VvHhLl])/).slice(1).forEach(sg => { const k = sg[0], v = (sg.slice(1).match(/-?[\d.]+/g) || []).map(Number);
    if (k === 'V') y = v[0]; else if (k === 'v') y += v[0]; else if (k === 'H') x = v[0]; else if (k === 'h') x += v[0]; else if (k === 'l'){ x += v[0]; y += v[1]; } else if (k === 'L'){ x = v[0]; y = v[1]; } });
  return [x, y];
}
function embMark(t, c){
  const chev = y => `<path d="M31 ${y + 4}l9-6 9 6" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (t < 3) return [chev(44), chev(40) + chev(49), chev(36) + chev(44) + chev(52)][t];
  if (t < 5) return `<path d="M40 33l10 13-10 13-10-13z" fill="${c}33" stroke="${c}" stroke-width="2.2"/><circle cx="40" cy="46" r="2.8" fill="${c}"/>`;
  if (t < 7) return `<path d="${star(4, 14, 4, 40, 46)}" fill="${c}44" stroke="${c}" stroke-width="1.8"/>`;
  if (t < 9) return `<path d="M40 32l13 22H27z" fill="${c}33" stroke="${c}" stroke-width="2"/><circle cx="40" cy="47" r="3.4" fill="${c}"/>`;
  if (t < 11) return `<path d="${star(t > 9 ? 8 : 6, 15, 5.5, 40, 46)}" fill="${c}55" stroke="${c}" stroke-width="1.6"/><circle cx="40" cy="46" r="3.6" fill="#fff"/>`;
  if (t < 15) return `<path d="${star(8, 16, 6, 40, 46)}" fill="${c}55" stroke="${c}" stroke-width="1.6"/><path d="${star(4, 9, 3, 40, 46)}" fill="#fff" opacity=".9"/>`;
  if (t < 20) return `<path d="${star(12, 17, 7, 40, 46)}" fill="${c}55" stroke="${c}" stroke-width="1.4"/><circle cx="40" cy="46" r="6" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="40" cy="46" r="2.6" fill="#fff"/>`;
  return `<path d="M32 56h5.5v-2.5c-4-1.8-6.5-5.5-6.5-9.5 0-6 4-10.5 9-10.5s9 4.5 9 10.5c0 4-2.5 7.7-6.5 9.5V56H48" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>`;   // Ω
}
function emblem(L){
  // everything lives inside the function: the header is drawn before the rest of the file has run
  emblem.n = (emblem.n || 0) + 1;
  const t = tierOf(L), c = TIER_COL[t], c2 = TIER_COL2[t] || c, id = 'emb' + emblem.n;
  const BURST = ['M40 27V16l-6-6V2','M40 65v11l6 6v8','M23.5 36.5l-9-5H4','M56.5 36.5l9-5h11','M23.5 55.5l-9 5-6 10','M56.5 55.5l9 5 6 10','M30 30l-9-9h-8','M50 62l9 9h8'];
  const lines = BURST.slice(0, Math.min(8, 2 + t));
  const R = 30 + Math.min(t, 14) * 1.4, nr = 8 + (t >= 6 ? 4 : 0) + (t >= 17 ? 8 : 0);
  const rays = Array.from({ length:nr }, (_, i) => `<path d="M40 46L38.4 ${46 - R * (i % 2 ? .7 : 1)}L41.6 ${46 - R * (i % 2 ? .7 : 1)}Z" fill="url(#${id}y)" transform="rotate(${i * 360 / nr} 40 46)"/>`).join('');
  const track = 'M' + hexPts(40, 46, 25).split(' ').join('L') + 'Z', runners = Math.min(5, 1 + Math.floor(t / 4));
  // a moving dot: a soft halo circle + a bright dot (no blur filter, so it's cheap to animate)
  const ride = (d, col, dur, beg, r) => `<g><circle r="${r * 2.2}" fill="${col}" opacity=".25"/><circle r="${r}" fill="${col}"/><animateMotion dur="${dur}s" begin="${beg}s" repeatCount="indefinite" path="${d}"/></g>`;
  let back = '', front = '';
  if (t >= 14){   // circuit wings
    const w = 6 + (t - 14) * 1.6;
    const wing = s => { const x0 = 40 + s * 27; return [[-8, w], [-1, w * 1.3], [6, w]].map(([dy, len], i) => { const d = `M${x0} ${46 + dy}h${s * len * .45}l${s * 4} ${dy * .35}h${s * len * .55}`;
      return `<path d="${d}" fill="none" stroke="${c2}" stroke-width="1" opacity=".35"/><path class="em-trace" style="animation-delay:${-i * .4}s" d="${d}" fill="none" stroke="${c2}" stroke-width="1.8" stroke-linecap="round"/>`; }).join(''); };
    back += `<g class="em-flap">${wing(-1)}${wing(1)}</g>`;
  }
  if (t >= 16) back += `<polygon class="em-shock" points="${hexPts(40, 46, 20)}" fill="none" stroke="${c2}" stroke-width="2"/>`;
  if (t >= 12) back += `<polygon class="em-spin em-rev" points="${hexPts(40, 46, 31)}" fill="none" stroke="${c2}" stroke-width="1" stroke-dasharray="4 3" opacity=".75"/>`;
  if (t >= 11){   // crown points
    const k = Math.min(5, 1 + Math.floor((t - 10) / 2) * 2);
    front += Array.from({ length:k }, (_, i) => { const a = (-90 + (i - (k - 1) / 2) * 20) * Math.PI / 180, r1 = 21, r2 = 33 + (i === (k - 1) / 2 ? 5 : 0) + (t - 10) * .5;
      return `<path d="M${(40 + r1 * Math.cos(a) - 2).toFixed(1)} ${(46 + r1 * Math.sin(a)).toFixed(1)}L${(40 + r2 * Math.cos(a)).toFixed(1)} ${(46 + r2 * Math.sin(a)).toFixed(1)}L${(40 + r1 * Math.cos(a) + 2).toFixed(1)} ${(46 + r1 * Math.sin(a)).toFixed(1)}Z" fill="${c2}66" stroke="${c2}" stroke-width="1"/>`; }).join('');
    front = `<g filter="url(#${id}g)">${front}</g>`;
  }
  return `<svg viewBox="0 0 80 92" aria-hidden="true"${t >= 19 ? ' class="em-prism"' : ''}><defs>
      <filter id="${id}g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="${id}y" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <g class="em-spin" style="opacity:.5">${rays}</g>${back}
    ${lines.map((d, i) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="3.6" opacity=".15"/><path class="em-trace" d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" style="animation-delay:${-i * .35}s"/>`).join('')}
    ${lines.map((d, i) => ride(d, '#fff', 1.6 + (i % 3) * .4, -i * .37, 1.3)).join('')}
    ${lines.map(d => { const [x, y] = embEnd(d); return `<rect x="${x - 2}" y="${y - 2}" width="4" height="4" fill="#071114" stroke="${c}" stroke-width="1.2"/>`; }).join('')}
    <path d="${track}" fill="none" stroke="${c}" stroke-width=".8" opacity=".35"/>
    ${Array.from({ length:runners }, (_, i) => ride(track, i % 2 && t >= 13 ? c2 : c, 4.5, -i * 4.5 / runners, 2.3)).join('')}
    <g filter="url(#${id}g)">
      <polygon points="${hexPts(40, 46, 19)}" fill="#071114" stroke="${t >= 13 ? `url(#${id}d)` : c}" stroke-width="2"/>
      <polygon points="${hexPts(40, 46, 14)}" fill="none" stroke="${c}" stroke-width=".7" opacity=".4"/>
      <g transform="translate(40 46) scale(.73) translate(-40 -46)">${embMark(t, c)}</g>
    </g>${front}
  </svg>`;
}

/* ---- Collection search: magnifying glass in the title row ---- */
var colSearch = false, colQ = '';
function colTile(c){
  const n = ownedCard(c.id);
  return n
    ? `<button class="ct r-${c.rarity}${CARD_EDGE[c.id] && (c.rarity === 'ultimate' || c.rarity === 'legendary') ? ' edge' : ''}"${edgeStyle(c.id)} data-act="inspect" data-id="${c.id}"><img loading="lazy" decoding="async" src="${cardImg(c.id)}" alt="${esc(c.name)}">${n > 1 ? `<span class="qty">×${n}</span>` : ''}</button>`
    : `<div class="ct locked r-${c.rarity}"><img loading="lazy" decoding="async" src="${cardImg(c.id)}" alt=""></div>`;   // not owned: face up but dark, like the puzzle pieces
}
// lower-case, no accents, curly quotes made straight: "Soryu" finds "Sōryū", "its" finds "it's"
const searchNorm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');
function cardSearchText(c){
  const pack = c.deck === 'mlbb' ? 'land of dawn mlbb' : 'tarot';
  return searchNorm([c.name, c.hero, setLabel(c.set), RARITY[c.rarity].name, pack, ownedCard(c.id) ? flavorOf(c.id) : ''].join('   '));
}
function colSearchHTML(q){
  const words = searchNorm(q).split(/\s+/).filter(Boolean);
  // every card shows up; ones you don't own are faded (owned first; their flavour text isn't searchable)
  const pool = CARDS.filter(c => (colGroup === 'all' || COLLECTIONS.find(g => g.id === colGroup).sets.includes(c.set)));
  const hits = pool.filter(c => { const t = cardSearchText(c); return words.every(w => t.includes(w)); })
    .sort((a, b) => (!ownedCard(a.id) - !ownedCard(b.id)) || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  if (!hits.length) return `<p class="cc-none">No cards match “${esc(q)}”.</p>`;
  const own = hits.filter(c => ownedCard(c.id)).length;
  return `<div class="cc-count">${hits.length} ${hits.length === 1 ? 'card' : 'cards'} · ${own} owned</div>
    <div class="col-grid cc-hits">${hits.map(c => `<div class="cc-hit${ownedCard(c.id) ? '' : ' off'}">${colTile(c)}<b>${esc(c.name)}</b><small style="color:${RARITY[c.rarity].color}">${RARITY[c.rarity].name}${c.hero && c.hero !== c.name ? ' · ' + esc(c.hero) : ' · ' + esc(setLabel(c.set))}</small></div>`).join('')}</div>`;
}
function colSearchUpdate(){
  const res = $('#ccRes'), main = $('#ccMain'); if (!res) return;
  res.innerHTML = colQ ? colSearchHTML(colQ) : '';
  if (main) main.hidden = !!colQ;
  $('#ccClear').hidden = !colQ;
}
$('#colSearchBtn').addEventListener('click', e => {
  e.stopPropagation();
  colSearch = !colSearch; if (!colSearch) colQ = '';
  $('#ccQ').value = colQ; $('#ccClear').hidden = !colQ;
  render();
  if (colSearch){ $('#ccQ').focus(); scrollTo({ top:0 }); }
});
// typing only redraws the results, so the keyboard stays open
$('#ccQ').addEventListener('input', e => { colQ = e.target.value; colSearchUpdate(); });
$('#ccClear').addEventListener('click', e => { e.stopPropagation(); colQ = ''; $('#ccQ').value = ''; colSearchUpdate(); $('#ccQ').focus(); });


/* ---- Automatic backup (phone app only) ----
   One file, Documents/Psych/Psych-AUTO-backup.json, written at midnight and replaced every night.
   The app can't run while it's closed, so if it wasn't open at midnight the backup is made the moment
   it opens next, before anything changes (so it still holds the data as it was at midnight). */
var autoBackupBusy = false;
async function autoBackupCheck(){
  const n = native(); if (!n || !n.saveBackup || autoBackupBusy) return;
  const today = dayKey(); if (S.autoBackupDay === today) return;
  if (!S.autoBackupDay){ S.autoBackupDay = today; save(); return; }   // first run: start counting from tonight
  autoBackupBusy = true;
  try {
    const stamp = now();
    await n.saveBackup('Psych-AUTO-backup.json', backupPayload('auto', stamp), true);
    S.autoBackup = stamp; S.autoBackupDay = today; save();
    if ($('#settings').classList.contains('open')) renderBackup();
  } catch(e){ /* try again on the next check */ }
  autoBackupBusy = false;
}
function scheduleMidnightBackup(){
  clearTimeout(scheduleMidnightBackup.t);
  scheduleMidnightBackup.t = setTimeout(() => { autoBackupCheck(); scheduleMidnightBackup(); }, Math.max(1000, nextMidnight() - now() + 1000));
}
autoBackupCheck(); scheduleMidnightBackup();
setInterval(autoBackupCheck, 60000);   // a phone that slept through midnight catches up within a minute of waking
document.addEventListener('visibilitychange', () => { if (!document.hidden){ autoBackupCheck(); scheduleMidnightBackup(); } });

/* ---- Reduce effects (Settings, off by default): fewer particles, no looping glows ---- */
function applyReduceFx(){ document.documentElement.classList.toggle('reduce-fx', !!S.reduceFx); }
$('#reduceFx').addEventListener('change', e => { S.reduceFx = e.target.checked; save(); applyReduceFx(); });
applyReduceFx();


/* ================= Target, Bounty, Avoid ================= */
const KIND_NAME = { standard:'Quest', pair:'Pair', scaling:'Recurring', target:'Target', steps:'Steps', bounty:'Bounty', avoid:'Avoid', record:'Record', tally:'Tally' };
const shortDate = t => new Date(t).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
// Target: orbs up to 10, a ring + 10 segments above that
function qbTarget(q, wide){
  targetRoll(q);
  const done = isDone(q), need = q.need || 1, hits = Math.min(need, q.hits || 0), full = hits >= need, R = boosted(q, q.xp, q.gold);
  const badge = qbBadge(done ? 'DONE' : full ? 'CLAIM' : `${hits}/${need}`, done ? 'ok' : full ? 'cy' : 'dim');
  const timer = `<span class="tg-time">${done ? 'next in ' : ''}${cd(q.cycleEnd)}</span>`;
  if (need <= 10){
    const orbs = `<div class="tg-orbs${full ? ' full' : ''}">${Array.from({ length:need }, (_, i) => `<i class="${i < hits ? 'on' : ''}"></i>`).join('')}</div>`;
    return `<article class="card qb-t${done ? ' done' : ''}" data-act="${done ? 'reopen' : 'claim'}">
      ${wide ? qbTR(cyStreak(q), badge) + qbHead(q) : `<div class="qb-top">${qbIcon(q)}${cyStreak(q)}</div><h4 class="qb-h2">${esc(q.name)}</h4>`}
      ${orbs}<div class="tg-line">${hits} / ${need} · ${timer}</div>
      ${wide ? `<div class="qb-foot">${qbRew(R.xp, R.gold, done)}</div>` : `${qbRew(R.xp, R.gold, done)}<div class="qb-strk">${badge}</div>`}</article>`;
  }
  const C = 2 * Math.PI * 24, f = hits / need, on = Math.floor(f * 10 + 1e-9);
  return `<article class="card qb-t wide${done ? ' done' : ''}" data-act="${done ? 'reopen' : 'claim'}">
    ${qbTR(cyStreak(q), badge)}
    <div class="tg-big"><div class="tg-ring"><svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="24"/><circle class="v${full ? ' full' : ''}" cx="29" cy="29" r="24" stroke-dasharray="${C * f} ${C}"/></svg><b>${Math.floor(f * 100)}%</b></div>
      <div class="tg-main"><div class="qb-hd">${qbIcon(q)}<div class="qb-hdt"><h4>${esc(q.name)}</h4></div></div>
      <div class="tg-line"><span>${fmt(hits)} / ${fmt(need)}</span>${timer}</div>
      <div class="tg-seg">${Array.from({ length:10 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div>
      ${done || full ? '' : `<div class="tg-add">${[1, 5, 10].map(n => `<button data-act="thit" data-n="${n}">+${n}</button>`).join('')}<button data-act="thit" data-n="type">+ type</button></div>`}</div></div>
    <div class="qb-foot">${qbRew(R.xp, R.gold, done)}</div></article>`;
}
function targetHit(q, n, rect){
  targetRoll(q); if (isDone(q) || !(n > 0)) return;
  snapshot();
  q.hits = Math.min(q.need, (q.hits || 0) + Math.floor(n));
  save(); render();
  if (rect) FX.small(...mid(rect), 'blue');
  vibrate(8);
  showToast(q.hits >= q.need ? `${q.name}: all ${q.need} done · tap to claim` : `${q.name}: ${q.hits} / ${q.need}`, true);
}
function targetType(q, btn){
  btn.outerHTML = `<input class="tg-in" type="number" min="1" inputmode="numeric" placeholder="+" aria-label="Add">`;
  const inp = document.querySelector(`.qb-item[data-id="${q.id}"] .tg-in`); if (!inp) return;
  inp.focus();
  let sent = false;   // Enter and the blur that follows must not both add
  const go = () => { if (sent) return; sent = true; const v = int(inp.value, 99999); if (v > 0) targetHit(q, v); else render(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); go(); } });
  inp.addEventListener('blur', go, { once:true });
  inp.addEventListener('click', e => e.stopPropagation());
}
// Bounty: one-off with a due date
function bountyDue(q){
  if (isDone(q)) return '';
  const d = dueIn(q);
  if (d < 0) return `<span class="bt-tag">OVERDUE</span> ${shortDate(q.due)} · ${-d} ${d === -1 ? 'day' : 'days'} late`;
  if (d === 0) return `<span class="bt-tag">DUE TODAY</span> ${shortDate(q.due)}`;
  if (d === 1) return `<span class="bt-tag">DUE TOMORROW</span> ${shortDate(q.due)}`;
  return `Due ${shortDate(q.due)} · ${d} days left`;
}
function qbBounty(q){
  const done = isDone(q);
  return `<article class="card qb-t wide${done ? ' done' : ''}${bountyUrgent(q) ? ' urgent' : ''}" data-act="${done ? 'reopen' : 'claim'}">
    ${qbTR(qbBadge(done ? 'DONE' : 'CLAIM', done ? 'ok' : bountyUrgent(q) ? 'red' : ''))}
    ${qbHead(q, isDone(q) ? '' : `<span class="bt-due">${bountyDue(q)}</span>`)}${q.note ? `<p class="qb-note">${esc(q.note)}</p>` : ''}
    <div class="qb-foot">${qbRew(q.xp, q.gold, done)}</div></article>`;
}
function claimBounty(q, rect){
  if (isDone(q)) return;
  snapshot();
  q.undo = { xp:q.xp, gold:q.gold, prevUntil:q.doneUntil };
  logClaim(q.log ||= [], q.xp, q.gold);
  q.doneUntil = 9e15; q.doneAt = now(); q.count = (q.count || 0) + 1;
  grant({ xp:q.xp, gold:q.gold }, rect, `${q.name}: Bounty claimed`, q.id, null, 1.8);
}
// Avoid: days clean since the start; claim once a day; Slipped starts over
function qbAvoid(q, wide){
  const slip = slippedToday(q), done = isDone(q), n = daysClean(q), R = boosted(q, q.xp, q.gold);
  const best = Math.max(q.best || 0, n);
  const badge = slip ? qbBadge('SLIPPED', 'red') : qbBadge(done ? 'DONE' : 'CLAIM', done ? 'ok' : '');
  const slipBtn = slip ? '' : `<button class="av-slip" data-act="slip">${wide ? 'SLIPPED' : 'SLIP'}</button>`;
  const big = `<div class="av-n">${fmt(n)}<small>${n === 1 ? 'day' : 'days'} clean${wide ? ` · best ${fmt(best)}` : ''}</small></div>`;
  let strip = '';
  if (wide){
    // fills from the left, one segment per clean day in the current run (today counts once claimed), 7+ = full
    const lit = slip ? 0 : Math.min(7, n + (done ? 1 : 0));
    strip = `<div class="qb-pips av-week${slip ? ' x' : ''}">${Array.from({ length:7 }, (_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  const act = slip ? '' : ` data-act="${done ? 'reopen' : 'claim'}"`;
  return `<article class="card qb-t${wide ? ' wide' : ''}${done ? ' done' : ''}${slip ? ' slipped' : ''}"${act}>
    ${wide ? qbTR(cyStreak(q), badge) + qbHead(q) : `<div class="qb-top">${qbIcon(q)}${cyStreak(q)}</div><h4 class="qb-h2">${esc(q.name)}</h4>`}
    ${big}${strip}
    ${wide ? `<div class="qb-foot av-foot">${qbRew(R.xp, R.gold, done)}${slipBtn}</div>` : `${qbRew(R.xp, R.gold, done)}<div class="qb-strk">${slipBtn}${badge}</div>`}</article>`;
}
async function slipAvoid(q){
  if (slippedToday(q)) return;
  const n = daysClean(q), best = Math.max(q.best || 0, n), claimed = isDone(q) && q.undo;
  if (!await ask('Slipped?', `The count goes back to 0.${claimed ? ' Today’s reward is taken back.' : ''}`, 'Slipped')) return;
  snapshot();
  if (claimed){ take(q.undo); q.log && q.log.pop(); q.count = Math.max(0, (q.count || 0) - 1); }
  q.best = best; q.undo = null;
  (q.slips ||= []).push(now()); q.slipDay = dayKey();
  q.since = addDays(startOfDay(), 1);      // clean days count again from tomorrow
  q.doneUntil = nextMidnight();
  save(); render(); showToast(`${q.name}: slipped · the count starts again tomorrow`, true);
}

/* ---- Date picker (bounty due date, avoid start) ---- */
function setDateField(id, t){
  t = startOfDay(t || now());
  $('#' + id).value = t;
  const btn = $('#' + id + 'Btn'); if (!btn) return;
  const d = Math.round((t - startOfDay()) / 864e5);
  btn.querySelector('span').textContent = new Date(t).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  btn.querySelector('small').textContent = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 0 ? `in ${d} days` : `${-d} days ago`;
}
var dpkState = null;
function openDatePicker(value, opt, done){
  const v = startOfDay(value || now()), d = new Date(v);
  dpkState = { y:d.getFullYear(), m:d.getMonth(), sel:v, min:opt.min ?? -Infinity, max:opt.max ?? Infinity, done, title:opt.title || 'Pick a date' };
  drawDatePicker(); $('#datePick').classList.add('open');
}
function drawDatePicker(){
  const st = dpkState, first = new Date(st.y, st.m, 1), lead = (first.getDay() + 6) % 7, n = new Date(st.y, st.m + 1, 0).getDate(), today = startOfDay();
  let cells = ['M','T','W','T','F','S','S'].map(x => `<span class="dk-dow">${x}</span>`).join('') + '<i></i>'.repeat(lead);
  for (let i = 1; i <= n; i++){
    const t = new Date(st.y, st.m, i).getTime(), off = t < st.min || t > st.max;
    cells += `<button type="button" class="dk-d${t === st.sel ? ' sel' : ''}${t === today ? ' td' : ''}"${off ? ' disabled' : ` data-t="${t}"`}>${i}</button>`;
  }
  const canPrev = new Date(st.y, st.m, 0).getTime() >= st.min, canNext = new Date(st.y, st.m + 1, 1).getTime() <= st.max;
  $('#dpk').innerHTML = `<div class="dk-t">${esc(st.title)}</div>
    <div class="dk-h"><button type="button" data-dm="-1"${canPrev ? '' : ' disabled'} aria-label="Previous month">‹</button><b>${first.toLocaleDateString(undefined, { month:'long', year:'numeric' })}</b><button type="button" data-dm="1"${canNext ? '' : ' disabled'} aria-label="Next month">›</button></div>
    <div class="dk-g">${cells}</div>
    <div class="dk-f"><button type="button" class="btn-plain" data-dtoday="1"${today < st.min || today > st.max ? ' disabled' : ''}>Today</button><button type="button" class="btn-plain" data-dclose="1">Cancel</button></div>`;
}
$('#datePick').addEventListener('click', e => {
  e.stopPropagation();
  const st = dpkState; if (!st) return;
  const m = e.target.closest('[data-dm]'); if (m){ st.m += +m.dataset.dm; if (st.m < 0){ st.m = 11; st.y--; } if (st.m > 11){ st.m = 0; st.y++; } drawDatePicker(); return; }
  const dd = e.target.closest('[data-t]') || (e.target.closest('[data-dtoday]') && { dataset:{ t:startOfDay() } });
  if (dd){ st.done(+dd.dataset.t); $('#datePick').classList.remove('open'); return; }
  if (e.target.closest('[data-dclose]') || e.target.id === 'datePick') $('#datePick').classList.remove('open');
});
$('#fDueBtn').addEventListener('click', () => openDatePicker(+$('#fDue').value, { min:startOfDay(), title:'Due date' }, t => setDateField('fDue', t)));
$('#fSinceBtn').addEventListener('click', () => openDatePicker(+$('#fSince').value, { max:startOfDay(), title:'Clean since' }, t => setDateField('fSince', t)));
// "Times to hit" stepper
function setNeed(n){ n = Math.max(1, Math.min(999, Math.round(+n) || 1)); $('#fNeed').value = n; $('#fNeedUnit').textContent = n === 1 ? 'time' : 'times'; }
$('#needPick').addEventListener('click', e => { const b = e.target.closest('[data-dn]'); if (b) setNeed(+$('#fNeed').value + +b.dataset.dn); });
$('#fNeed').addEventListener('change', () => setNeed($('#fNeed').value));

/* ---- Post a quest in two steps: pick a kind (3×3), then set it up ---- */
function kindHead(editing){
  const k = getRadio('kind');
  $('#kindHeadIc').className = 'kh-ic k-' + k;
  $('#kindHeadIc').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${qbIcons()[k] || ''}</svg>`;
  $('#kindHeadT').textContent = (editing ? 'Edit ' : 'New ') + KIND_NAME[k];
  $('#kindHeadS').textContent = KIND_HELP[k].split('. ')[0].replace(/\.$/, '') + '.';
  $('#kindBack').hidden = editing;
}
function setPick(on){ $('#form').classList.toggle('pick', on); if (!on) kindHead(!!editingId); $('#form').scrollTop = 0; }
{ const os = openSheet; openSheet = function(id){ os.apply(this, arguments); setNeed($('#fNeed').value); setPick(!id); }; }
$('#pickNext').addEventListener('click', () => { if (!getRadio('kind')) return; setPick(false); });
$('#pickCancel').addEventListener('click', closeSheet);
$('#kindBack').addEventListener('click', () => setPick(true));

/* ---- Vacation mode (Settings > General): streaks pause while it's on ---- */
function renderVacation(){
  $('#vacation').checked = !!S.vacation;
  $('#vacInfo').textContent = S.vacation ? `On since ${shortDate(S.vacation)}. Streaks are paused; turn it off when you're back.` : "Streaks pause while it's on, so days away don't break them.";
}
$('#vacation').addEventListener('change', e => {
  if (e.target.checked){ S.vacation = now(); }
  else if (S.vacation){ (S.vacations ||= []).push({ from:S.vacation, to:now() }); S.vacation = null; }
  save(); renderVacation(); render();
});
{ const os = openSettings; openSettings = function(){ os.apply(this, arguments); renderVacation(); }; }

/* ---- Number fields: digits only (a dot where decimals make sense), never negative, never past the field's max ----
   Works for every number box, including ones drawn later. Typing, pasting and the phone keyboard all go through it. */
(function(){
  const isNum = el => el && el.tagName === 'INPUT' && el.type === 'number';
  const decimalOK = el => el.inputMode === 'decimal' || /any|\./.test(el.getAttribute('step') || '');
  const maxOf = el => { const m = parseFloat(el.getAttribute('max')); return isFinite(m) ? m : decimalOK(el) ? VALUE_CAP : 99999; };
  const okText = (el, t) => decimalOK(el) ? /^[0-9]*[.,]?[0-9]*$/.test(t) : /^[0-9]*$/.test(t);
  document.addEventListener('keydown', e => {
    if (!isNum(e.target) || e.ctrlKey || e.metaKey || e.key.length !== 1) return;
    if (!/[0-9]/.test(e.key) && !(decimalOK(e.target) && /[.,]/.test(e.key))) e.preventDefault();
  }, true);
  document.addEventListener('beforeinput', e => {
    if (!isNum(e.target) || e.data == null) return;
    if (!okText(e.target, e.data)) e.preventDefault();
  }, true);
  document.addEventListener('paste', e => {
    if (!isNum(e.target)) return;
    const t = ((e.clipboardData && e.clipboardData.getData('text')) || '').trim().replace(/,/g, decimalOK(e.target) ? '.' : '');
    e.preventDefault();
    if (!t || !okText(e.target, t)) return;
    e.target.value = t; e.target.dispatchEvent(new Event('input', { bubbles:true }));
  }, true);
  document.addEventListener('wheel', e => { if (isNum(document.activeElement) && e.target === document.activeElement) e.preventDefault(); }, { passive:false });
  document.addEventListener('input', e => {
    const el = e.target; if (!isNum(el) || el.value === '') return;
    let v = parseFloat(el.value), fix = null;
    if (!isFinite(v)) fix = '';
    else if (v < 0) fix = String(Math.abs(v));
    else if (v > maxOf(el)) fix = String(maxOf(el));
    else if (!decimalOK(el) && v % 1) fix = String(Math.trunc(v));
    else if (/\.\d{3,}/.test(el.value)) fix = el.value.replace(/(\.\d\d)\d+/, '$1');
    if (fix !== null && fix !== el.value) el.value = fix;   // runs before the field's own handlers, so they see the fixed value
  }, true);
})();

// ===== start: everything is defined now, draw the app =====
render();
