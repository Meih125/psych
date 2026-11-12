/* The save (S): starter data, load, repair (normalize / sanitizeState), quest shapes, save. */
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
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); S = raw ? JSON.parse(raw) : starterData(); }
  catch(e){ S = null; }
  // an unreadable save is kept aside (psych.v1.unreadable) before starting fresh
  if (raw && (!S || typeof S !== 'object' || !Array.isArray(S.quests))){ try { localStorage.setItem(STORE_KEY + '.unreadable', raw); } catch(e){} }
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
  if (!S.lv) S.lv = {};            // card id -> level 1-16 (missing = the start level of its rarity)
  if (!S.scenes) S.scenes = {};
  if (S.setClaims && S.setClaims.Promo && !S.setClaims.Deity){ S.setClaims.Deity = S.setClaims.Promo; delete S.setClaims.Promo; }   // Tarot's Promo set was renamed Deity (Hand of Destiny has its own Promo)
  if (!S.setClaims) S.setClaims = {};
  if (S.setClaims.Poker && !S.setClaims['Poker:H']){ ['H','D','S','C'].forEach(x => S.setClaims['Poker:' + x] = +S.setClaims.Poker || 1); delete S.setClaims.Poker; }   // Poker used to be one claim; now one per suit
  if (!S.opened) S.opened = {};      // pack id -> how many opened, ever
  if (!S.rewardedLevel) S.rewardedLevel = levelInfo(S.xp).L;   // levels already reached before level rewards existed
  if (!TABS.includes(S.tab)) S.tab = 'quests';
  // quest fields are filled by fillShape (sanitizeState); only the steps goal bonus default is set here
  S.quests.forEach(q => { if (isTracker(q)){ if (q.goalXp == null) q.goalXp = GOAL_BONUS; if (q.goalGold == null) q.goalGold = GOAL_BONUS; } if (q.kind === 'avoid') q.days = 1; });
}
// Repairs a save or backup so nothing in it can crash the app: finite in-range numbers, known kinds, unique ids, no parent loops.
function sanitizeState(){
  const KINDS = ['standard','pair','scaling','counter','record','tally','steps','target','bounty','avoid'];
  const fin = (v, d = 0, lo = -Infinity, hi = Infinity) => { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  S.xp = fin(S.xp, 0, 0, XP_CAP); S.gold = fin(S.gold, 0, -GOLD_CAP, GOLD_CAP);
  ['steps','dist','sync','inv','pity','cards','cardsGot','lv','scenes','setClaims','cover','newest','big','order','opened','progHide','today','layout','folded','colOpen','den'].forEach(k => { if (k in S && !obj(S[k])) delete S[k]; });
  if ('mkt' in S && !obj(S.mkt)) delete S.mkt;   // Market board: deep checks live in mktEnsure()
  delete S.mktShut;
  if ('pzOrder' in S) S.pzOrder = Array.isArray(S.pzOrder) ? S.pzOrder.filter(x => typeof x === 'string').slice(0, 64) : [];   // puzzle piece order (a list, not an object)
  if (obj(S.cover)) for (const k in S.cover){ if (!Array.isArray(S.cover[k])) delete S.cover[k]; else S.cover[k] = S.cover[k].filter(x => typeof x === 'string').slice(0, 3); }
  if (obj(S.newest)) for (const k in S.newest){ if (!Array.isArray(S.newest[k])) delete S.newest[k]; else S.newest[k] = S.newest[k].filter(x => typeof x === 'string').slice(0, 3); }
  if (obj(S.order)) for (const k in S.order){ if (!Array.isArray(S.order[k])) delete S.order[k]; else S.order[k] = S.order[k].filter(x => typeof x === 'string').slice(0, 400); }
  if (obj(S.big)) for (const k in S.big){ if (S.big[k] !== 1 && S.big[k] !== 2) delete S.big[k]; }
  if (S.update != null){ const u = S.update; if (!obj(u)) delete S.update; else { if (typeof u.latest !== 'string' || !/^v?\d+(\.\d+){0,2}$/.test(u.latest)) delete u.latest; if (typeof u.url !== 'string' || !/^https:\/\/(github\.com|objects\.githubusercontent\.com)\//.test(u.url)) delete u.url; u.notes = Array.isArray(u.notes) ? u.notes.filter(n => typeof n === 'string').slice(0, 8).map(n => n.slice(0, 200)) : []; if (!isFinite(+u.checked)) u.checked = 0; } }
  if (obj(S.folded)) for (const k in S.folded){ const v = S.folded[k]; if (!obj(v) || v.day !== dayKey()) delete S.folded[k]; }   // hand-set folds last one day
  if (obj(S.dist)) for (const k in S.dist){ const v = +S.dist[k]; if (!/^\d{4}-\d\d-\d\d$/.test(k) || !isFinite(v) || v < 0) delete S.dist[k]; else S.dist[k] = Math.min(1e6, v); }
  ['inv','pity','cards','cardsGot','opened'].forEach(k => { if (obj(S[k])) for (const id in S[k]) S[k][id] = Math.round(fin(S[k][id], 0, 0, 1e6)); });
  if (obj(S.lv)) for (const id in S.lv){ const v = Math.round(fin(S.lv[id], 0, 0, 16)); if (v < 1) delete S.lv[id]; else S.lv[id] = v; }   // card levels 1-16 (a missing one is the card's start level)
  const seen = new Set();
  S.quests = S.quests.filter(q => obj(q) && KINDS.includes(q.kind)).filter(q => {
    if (typeof q.id !== 'string' || !q.id || seen.has(q.id)) q.id = uid();
    seen.add(q.id); return true;
  });
  if (S.quests.filter(q => q.kind === 'steps').length > 1){ let one = false; S.quests = S.quests.filter(q => q.kind !== 'steps' || (!one && (one = true))); }
  // a save without the Steps quest gets it back (its paid history is kept, so nothing pays twice)
  if (!S.quests.some(q => q.kind === 'steps')){ const m = obj(S.stepsMemo) ? S.stepsMemo : {};
    S.quests.unshift({ id:uid(), kind:'steps', name:'Daily Steps', note:'', chunk:100, xpPer:1, goldPer:1, goal:10000, showDays:3, paid:obj(m.paid) ? { ...m.paid } : {}, goalPaid:obj(m.goalPaid) ? { ...m.goalPaid } : {}, created:now() }); }
  S.quests.forEach(fillShape);
  if (obj(S.steps)) for (const k in S.steps){ const v = +S.steps[k]; if (!/^\d{4}-\d\d-\d\d$/.test(k) || !isFinite(v) || v < 0) delete S.steps[k]; else S.steps[k] = Math.min(VALUE_CAP, v); }
  if (S.vacation != null && !(isFinite(+S.vacation) && +S.vacation > 0)) S.vacation = null;
  if (S.vacations != null) S.vacations = Array.isArray(S.vacations) ? S.vacations.filter(v => obj(v) && isFinite(+v.from) && isFinite(+v.to) && +v.to >= +v.from) : [];
  ['lastBackup','autoBackup'].forEach(k => { if (S[k] != null && !isFinite(+S[k])) delete S[k]; });
  if (S.rewardedLevel != null && !(S.rewardedLevel >= 1)) delete S.rewardedLevel;
  S.quests.forEach(q => {
    q.name = typeof q.name === 'string' && q.name.trim() ? q.name.slice(0, 80) : 'Quest';
    if (q.note != null && typeof q.note !== 'string') q.note = '';
    ['xp','gold','xpPer','goldPer','goalXp','goalGold'].forEach(k => { if (k in q) q[k] = Math.round(fin(q[k], 0, 0, 9999)); });
    if ('growth' in q) q.growth = fin(q.growth, 0, 0, 500);
    if ('days' in q) q.days = q.days === MONTHLY ? MONTHLY : Math.round(fin(q.days, 1, 1, 60));
    if ('period' in q) q.period = q.period === MONTHLY ? MONTHLY : Math.round(fin(q.period, 7, 1, 60));
    if ('need' in q) q.need = Math.round(fin(q.need, 5, 1, 999));
    if ('hits' in q) q.hits = Math.round(fin(q.hits, 0, 0, 1e6));
    if ('step' in q) q.step = fin(q.step, 1, 0.01, VALUE_CAP);
    if ('chunk' in q) q.chunk = fin(q.chunk, 1, 0.01, VALUE_CAP);
    if ('goal' in q) q.goal = fin(q.goal, 0, 0, 200000);
    ['count','weekClaims','carry','total'].forEach(k => { if (k in q) q[k] = fin(q[k], 0, 0, 1e12); });
    ['doneUntil','due','since','cycleEnd','rollEnd','week','created'].forEach(k => { if (k in q) q[k] = fin(q[k], 0, 0, 9e15); });
    ['log','entries','slips','bonusLog'].forEach(k => { if (k in q && !Array.isArray(q[k])) q[k] = []; });
    const okT = t => isFinite(+t) && +t > 0 && +t < 9e15;
    if (Array.isArray(q.entries)) q.entries = q.entries.filter(e => obj(e) && isFinite(+e.v) && okT(e.t)).map(e => ({ ...e, t:+e.t, v:fin(e.v, 0, -VALUE_CAP, VALUE_CAP) }));
    // history: every entry needs a real time; rewards are numbers
    const cleanLog = L => L.filter(e => obj(e) && okT(e.t)).map(e => ({ ...e, t:+e.t, xp:fin(e.xp, 0, -REWARD_CAP, REWARD_CAP), gold:fin(e.gold, 0, -REWARD_CAP, REWARD_CAP) }));
    ['log','bonusLog'].forEach(k => { if (Array.isArray(q[k])) q[k] = cleanLog(q[k]); });
    if (q.kind === 'pair'){
      if (!Array.isArray(q.extra)) q.extra = [];
      q.extra = q.extra.filter(obj).slice(0, LIST_MAX - 2);
      ['a','b'].forEach(h => { if (obj(q[h]) && Array.isArray(q[h].log)) q[h].log = cleanLog(q[h].log); });
      q.extra.forEach(r => { if (Array.isArray(r.log)) r.log = cleanLog(r.log); });
    }
    if (Array.isArray(q.slips)) q.slips = q.slips.filter(okT).map(Number);
    ['paid','goalPaid','vals'].forEach(k => { if (obj(q[k])) for (const d in q[k]){ if (k === 'goalPaid' && q[k][d] === true) continue;   // old saves: paid in full
      const v = +q[k][d]; if (!isFinite(v)) delete q[k][d]; else q[k][d] = v; } });
    ['best','paidTo','start'].forEach(k => { if (q[k] != null && !isFinite(+q[k])) q[k] = null; });
    if (q.kind === 'pair'){
      ['a','b'].forEach(h => { if (!obj(q[h])) q[h] = { name:h === 'a' ? 'Quest A' : 'Quest B', xp:0, gold:0, log:[] }; });
      [q.a, q.b, ...q.extra].forEach(r => { r.name = typeof r.name === 'string' ? r.name.slice(0, 80) : ''; r.xp = Math.round(fin(r.xp, 0, 0, 9999)); r.gold = Math.round(fin(r.gold, 0, 0, 9999)); });
    }
    if (q.kind === 'pair' && !obj(q.bonus)) q.bonus = { xp:0, gold:0 };
    if (q.size !== undefined && q.size !== 'full' && q.size !== 'half') delete q.size;
    if (q.parent != null && (typeof q.parent !== 'string' || q.parent === q.id || !seen.has(q.parent))) q.parent = null;
  });
  if (S.layout && (typeof S.layout !== 'object' || Array.isArray(S.layout))) S.layout = {};
  // daily login: last claim, streak, and a pending reward (gold/XP up to 25, or a card)
  if (S.daily != null){
    const d = obj(S.daily) ? S.daily : {}, p = obj(d.pending) ? d.pending : null;
    S.daily = { at: isFinite(+d.at) && +d.at > 0 ? +d.at : 0, streak: Math.round(fin(d.streak, 0, 0, 1e5)) };
    if (p && p.kind === 'gold') S.daily.pending = { kind:'gold', gold:Math.round(fin(p.gold, 0, 0, 25)), xp:Math.round(fin(p.xp, 0, 0, 25)) };
    else if (p && p.kind === 'card' && CARDS.some(c => c.id === p.id) && RARITY[p.rarity]) S.daily.pending = { kind:'card', id:p.id, rarity:p.rarity, fresh:!!p.fresh, milestone:!!p.milestone };
  }
  if (S.widgets && !Array.isArray(S.widgets)) S.widgets = [];
  if (S.widgets) S.widgets = S.widgets.filter(w => w && typeof w === 'object' && WSIZES_OK.includes(w.size) && Array.isArray(w.rows))
    .map(w => ({ id:String(w.id || uid()), name:String(w.name || '').slice(0, 24), size:w.size, rows:w.size === '4x4' ? [] : w.rows.filter(Array.isArray).slice(0, 2).map(r => r.slice(0, 2).map(x => typeof x === 'string' ? x : null)) }));
  // break parent loops (A under B under A)
  const byIdMap = new Map(S.quests.map(q => [q.id, q]));
  S.quests.forEach(q => { const path = new Set([q.id]); let p = q.parent && byIdMap.get(q.parent);
    while (p){ if (path.has(p.id)){ q.parent = null; break; } path.add(p.id); p = p.parent && byIdMap.get(p.parent); } });
}
// Every field each quest kind needs, with its default (used for missing or wrong-typed fields). Ranges are checked in sanitizeState.
const QUEST_SHAPE = {
  standard:{ xp:10, gold:5, days:1, doneUntil:0, undo:null, log:[] },
  scaling: { xp:10, gold:10, growth:50, week:0, weekClaims:0, log:[] },
  counter: { xp:5, gold:5, log:[] },
  record:  { unit:'unit', better:'lower', step:1, xpPer:10, goldPer:10, entries:[], start:null, best:null, paidTo:null, doneUntil:0, undo:null },
  tally:   { unit:'', chunk:1, xpPer:1, goldPer:1, carry:0, total:0, log:[], vals:{} },
  target:  { need:5, hits:0, days:7, xp:30, gold:15, cycleEnd:0, doneUntil:0, undo:null, log:[] },
  bounty:  { due:0, xp:20, gold:10, doneUntil:0, doneAt:0, undo:null, log:[] },
  avoid:   { since:0, slips:[], best:0, xp:10, gold:5, days:1, doneUntil:0, undo:null, log:[] },
  steps:   { chunk:100, xpPer:1, goldPer:1, goal:10000, showDays:3, paid:{}, goalPaid:{} },
  pair:    { days:1, cycleEnd:0, bonusCount:0, bonusUntil:0, bonusLog:[], bonus:{ xp:0, gold:0 }, extra:[] },
};
const PAIR_HALF = { name:'', xp:5, gold:5, count:0, until:0, undo:null, log:[] };
/* List quest (kind 'pair' inside, so old saves and the widgets keep working): quests 1 and 2 live in q.a / q.b,
   quests 3–8 in q.extra[]. Keys: 'a', 'b', 'x0' … 'x5'. Everything that walks the list goes through these. */
const LIST_MAX = 8;
function listKeys(q){ return ['a', 'b', ...(Array.isArray(q.extra) ? q.extra.map((_, i) => 'x' + i) : [])]; }
function itemOf(q, k){ return k === 'a' || k === 'b' ? q[k] : (q.extra || [])[+String(k).slice(1)]; }
function listItems(q){ return listKeys(q).map(k => itemOf(q, k)).filter(Boolean); }
function listDoneN(q){ const t = now(); return listItems(q).filter(r => r.until > t).length; }
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
function fillFrom(o, shape){
  for (const k in shape){
    const d = shape[k], v = o[k], dt = typeOf(d), vt = typeOf(v);
    if (vt === dt) continue;
    if (dt === 'null'){ if (vt === 'undefined' || (vt !== 'number' && vt !== 'object' && vt !== 'null')) o[k] = null; continue; }   // nullable: a number/object or nothing
    if (dt === 'string' && vt === 'number'){ o[k] = String(v); continue; }
    if (dt === 'number' && vt === 'string' && v.trim() !== '' && isFinite(+v)){ o[k] = +v; continue; }
    o[k] = JSON.parse(JSON.stringify(d));
  }
}
function fillShape(q){
  if (typeof q.count !== 'number') q.count = +q.count || 0;
  if (q.kind === 'record' && q.paidTo === undefined) q.paidTo = q.best ?? null;   // older saves: paid up to the best so far
  fillFrom(q, QUEST_SHAPE[q.kind] || {});
  if (q.kind === 'scaling' && !q.size) q.size = 'full';   // Recurring could not be half before: keep existing ones full
  if (q.kind === 'bounty' && !q.due) q.due = startOfDay();
  if (q.kind === 'avoid' && !q.since) q.since = startOfDay();
  if (q.kind === 'record' && !['lower','higher'].includes(q.better)) q.better = 'lower';
  if (q.kind === 'pair'){
    ['a','b'].forEach(h => { if (typeOf(q[h]) !== 'object') q[h] = { name:h === 'a' ? 'Quest A' : 'Quest B' }; fillFrom(q[h], PAIR_HALF); if (!q[h].name.trim()) q[h].name = h === 'a' ? 'Quest A' : 'Quest B'; });
    if (!Array.isArray(q.extra)) q.extra = [];
    q.extra.forEach((r, i) => { fillFrom(r, PAIR_HALF); if (!r.name.trim()) r.name = 'Quest ' + (i + 3); });
  }
  if (q.slipDay != null && typeof q.slipDay !== 'string') q.slipDay = null;
  if (q.undo != null && typeOf(q.undo) !== 'object') q.undo = null;
}
// After the phone clock moves back, "done until" times can sit far in the future: cap them at one cycle from today.
function repairClock(){
  if (!S || !Array.isArray(S.quests)) return;
  const sod = startOfDay(), lim = d => cycleAfter(sod, d || 1);
  S.quests.forEach(q => {
    const max = lim(q.kind === 'scaling' ? periodOf(q) : cycleDays(q));
    if (q.kind !== 'bounty' && q.doneUntil > max) q.doneUntil = max;          // a claimed bounty stays done for good (9e15)
    if (q.cycleEnd > max) q.cycleEnd = max;
    if (q.rollEnd > max) q.rollEnd = max;
    if (q.kind === 'pair'){ listItems(q).forEach(r => { if (r.until > max) r.until = max; }); if (q.bonusUntil > max) q.bonusUntil = max; }
    if (q.kind === 'avoid' && q.since > addDays(sod, 1)) q.since = addDays(sod, 1);
    if (q.kind === 'scaling' && q.week > now()){ q.week = 0; q.weekClaims = 0; }
  });
  if (S.vacation > now()) S.vacation = now();
}
// every claim is logged so the Progress tab can show history
function logClaim(arr, xp, gold){ arr.push({ t:now(), xp, gold }); if (arr.length > 4000) arr.shift(); }
// saves are batched (one write 0.35 s after the first change) and flushed when the app is hidden or closed
let saveT = 0;
function flushSave(){ if (!saveT) return; clearTimeout(saveT); saveT = 0; try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch(e){ console.error('save', e); } try { pushWidgets(); } catch(e){ console.error('widgets', e); } }
function save(){ if (saveT) return; saveT = setTimeout(flushSave, 350); }

function initState(){
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('beforeunload', flushSave);
}
