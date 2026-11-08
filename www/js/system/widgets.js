/* Home-screen widgets: snapshot sent to the phone, taps made on the home screen. */
/*    S.widgets = [{ id, name, size:'2x1'|'4x1'|'2x2'|'4x2'|'4x4', rows }]. Every row is one home-screen cell high:
     a row is [id] (one full-width quest, or one half quest in a 2-wide widget) or [a, b] (two half quests).
   Shapes: 2x1 [[h]] · 4x1 [[f]] or [[h,h]] · 2x2 [[h],[h]] · 4x2 [[f],[f]], [[f],[h,h]] or [[h,h],[h,h]] · 4x4 (whole page).
   4x4 has no spots (rows []): it shows the whole Quests page, a tab per group, and scrolls.
   Each spot looks like the quest's tile. The app sends a ready-to-draw snapshot to the phone (PsychWidget plugin,
   Android code in scripts/android-widget); taps there are queued and applied when the app opens. */
// the phone side, found the same way as the other phone plugins (Capacitor.Plugins); null in the browser
var widgetPluginCache = null;
function inPhoneApp(){ return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }   // a function (not a const): save() can run while the app is still loading
function widgetPlugin(){
  if (widgetPluginCache) return widgetPluginCache;
  if (!inPhoneApp()) return null;
  const C = window.Capacitor;
  widgetPluginCache = (C.Plugins && C.Plugins.PsychWidget) || (C.registerPlugin && C.isPluginAvailable && C.isPluginAvailable('PsychWidget') ? C.registerPlugin('PsychWidget') : null);
  return widgetPluginCache;
}
const W_SHAPES = [
  { key:'2x1',   size:'2x1', rows:[[0]],         name:'2×1',            sub:'1 half quest',            draw:[[['h']]], w:2 },
  { key:'4x1f',  size:'4x1', rows:[[0]],         name:'4×1',            sub:'1 full quest',            draw:[[['f']]], w:4 },
  { key:'4x1h',  size:'4x1', rows:[[0, 0]],      name:'4×1 halves',     sub:'2 half quests',           draw:[[['h','h']]], w:4 },
  { key:'2x2',   size:'2x2', rows:[[0], [0]],    name:'2×2',            sub:'2 half quests stacked',   draw:[[['h']],[['h']]], w:2 },
  { key:'4x2ff', size:'4x2', rows:[[0], [0]],    name:'4×2 full',       sub:'2 full quests',           draw:[[['f']],[['f']]], w:4 },
  { key:'4x2fh', size:'4x2', rows:[[0], [0, 0]], name:'4×2 mixed',      sub:'1 full + 2 half',         draw:[[['f']],[['h','h']]], w:4 },
  { key:'4x2hh', size:'4x2', rows:[[0, 0], [0, 0]], name:'4×2 halves',  sub:'4 half quests',           draw:[[['h','h']],[['h','h']]], w:4 },
  { key:'4x4',   size:'4x4', rows:[],            name:'4×4 Quests',     sub:'all quests, scrolls',     draw:[[['t','t','t']],[['h','h']],[['f']]], w:4, board:true },
];
const wWidth = w => w.size === '2x1' || w.size === '2x2' ? 2 : 4;
const isBoardW = w => w.size === '4x4';
function wShapeOf(w){
  const pat = (w.rows || []).map(r => r.length).join(',');
  return W_SHAPES.find(t => t.size === w.size && t.rows.map(r => r.length).join(',') === pat) || W_SHAPES.find(t => t.size === w.size) || W_SHAPES[1];
}
// is a spot half-size? (in a 2-wide widget every spot is half; in a 4-wide one, a row of two)
const wHalfSpot = (w, r) => wWidth(w) === 2 || (w.rows[r] || []).length === 2;
const wFits = (q, half) => !!q && (!half || canHalf(q));
const STREAK_COL = ['#f2f7f6', '#3fd47a', '#1ea4e6', '#b46ae0', '#f08a24', '#ff3b3b'];
function wSlot(q){
  if (!q) return null;
  const done = isDone(q), R = boosted(q, q.xp || 0, q.gold || 0);
  const n = hasStreak(q) ? streakNow(q) : 0, m = hasStreak(q) && streakReward(q) ? streakMult(done ? n : n + 1) : 1;
  const B = (label, act, style) => ({ label, act, style });
  const col = KIND_COL[q.kind] || '#ff8a45';
  // buttons: CLAIM / counts bordered in the kind colour ('k' + color), DONE = faded green dot ('done'),
  // SLIPPED and an urgent bounty red, LOCKED and a List's n/total grey
  const Q = (label, act, style = '') => Object.assign(B(label, act, style || (!act ? 'dim' : 'k')), { color:col });
  const base = { qid:q.id, name:q.name, kind:q.kind, color:KIND_COL[q.kind] || '#ff8a45', streak:hasStreak(q) ? fmt(n) + '×' : '',
    streakColor:STREAK_COL[flameTier(n)], mult:m > 1 ? `+${Math.round((m - 1) * 100)}%` : '', xp:'+' + fmtShort(R.xp), gold:'+' + fmtShort(R.gold),
    rawXp:R.xp, rawGold:R.gold,   // exact numbers for the phone to move the 4x4 header on a claim (xp / gold are display text)
    sub:'', done, tap:'claim', btn:[], doneUntil:0, reset:null };
  if (q.kind === 'avoid'){
    const slip = slippedToday(q);
    Object.assign(base, { done: done || slip, btn: slip ? [Q('SLIPPED', '', 'red')] : done ? [B('SLIP', 'slip', 'red'), Q('DONE', '', 'done')] : [B('SLIP', 'slip', 'red'), Q('CLAIM', 'claim')],
      doneUntil: done || slip ? nextMidnight() : 0, reset:{ btn:[B('SLIP', 'slip', 'red'), Q('CLAIM', 'claim')] } });
  } else if (q.kind === 'target'){
    targetRoll(q); const h = Math.min(q.need, q.hits || 0);
    // up to 10 hits: a dot each; more: a bar (needN carries the count)
    // more than 10 hits: a bar, "37 / 120" and + ADD (asks how many)
    const big = q.need > 10, add = Q('+ ADD', 'hits');
    Object.assign(base, big ? { hits:h, needN:q.need, pct:Math.round(h / q.need * 100), sub:`${h} / ${q.need}`, name:q.name } : { hits:h, need:q.need }, { tap: h >= q.need ? 'claim' : big ? 'hits' : 'hit',
      btn: done ? [Q('DONE', '', 'done')] : h >= q.need ? [Q('CLAIM', 'claim')] : big ? [add] : [Q(`${h}/${q.need}`, 'hit')], doneUntil: done ? q.cycleEnd : 0,
      reset:Object.assign({ btn: big ? [add] : [Q(`0/${q.need}`, 'hit')], hits:0, tap: big ? 'hits' : 'hit' }, big ? { pct:0, sub:`0 / ${q.need}` } : {}) });
  } else if (q.kind === 'scaling'){
    const w = weekClaims(q), R2 = scaledReward(q, w + 1), up = Math.round((Math.pow(1 + q.growth / 100, w) - 1) * 100);
    Object.assign(base, { done:false, xp:'+' + fmtShort(R2.xp), gold:'+' + fmtShort(R2.gold), rawXp:R2.xp, rawGold:R2.gold, streak:'', btn:[Q('CLAIM', 'claim')], growth:q.growth || 0, baseXp:q.xp || 0, baseGold:q.gold || 0,
      segs:w, segMax:7, note: w ? `Claimed ×${w}${up ? ` · Next pays +${up}%` : ''}` : `Each claim pays ${q.growth}% more` });
  } else if (q.kind === 'counter'){
    Object.assign(base, { done:false, streak:`${fmt(q.count || 0)}×`, streakColor:'#4dd0a0', note:`Today ${counterToday(q)}`, btn:[Q('CLAIM', 'claim')] });
  } else if (q.kind === 'bounty'){
    // time left where the note sits; due today / tomorrow = red tile
    const urgent = bountyUrgent(q);
    Object.assign(base, { streak:'', due: done ? '' : bountyLeftText(q), dueOn: 'Due ' + shortDate(q.due), warn: dueIn(q) >= 0, dueN: dueIn(q), urgent, btn: done ? [Q('DONE', '', 'done')] : [Q('CLAIM', 'claim', urgent ? 'red' : '')] });
  } else if (q.kind === 'standard'){
    Object.assign(base, { btn: done ? [Q('DONE', '', 'done')] : [Q('CLAIM', 'claim')], doneUntil: done ? q.doneUntil : 0, reset:{ btn:[Q('CLAIM', 'claim')] } });
  } else if (q.kind === 'tally'){
    Object.assign(base, { done:false, tap:'tally', unit:unitOf(q) || '', pre:CURRENCY.includes(unitOf(q)), chunk:q.chunk, carry:q.carry || 0, xpPer:q.xpPer, goldPer:q.goldPer,
      xp:'+' + fmtShort(q.xpPer), gold:'+' + fmtShort(q.goldPer), sub:`${fmtU(q, q.total || 0)} total`, note:`per ${fmtU(q, q.chunk)}`, btn:[B('+ ADD', 'tally', 'gold')] });
  } else if (q.kind === 'record'){
    Object.assign(base, { tap: done ? 'open' : 'record', unit:q.unit || '', xp:'+' + fmtShort(q.xpPer), gold:'+' + fmtShort(q.goldPer),
      note: q.best != null ? `per ${fmt(q.step)} ${q.unit} · next ${fmt(recNext(q))}` : 'no entries yet', btn: done ? [Q('DONE', '', 'done')] : [B('RECORD', 'record', 'rec')] });
  } else if (q.kind === 'pair'){
    // List: items as tappable lines, n/total as a button (orange once the bonus is ready, then it claims the bonus)
    const t = now(), keys = listKeys(q), n = listDoneN(q), all = n === keys.length, earned = q.bonusUntil > t;
    const B0 = q.bonus || { xp:0, gold:0 }, hasBonus = (B0.xp || 0) > 0 || (B0.gold || 0) > 0, bz = boosted(q, B0.xp || 0, B0.gold || 0), faded = all && (earned || !hasBonus);
    const H = k => { const r = itemOf(q, k), x = boosted(q, r.xp || 0, r.gold || 0); return { label:r.name, done:r.until > t, act:'pair:' + k, xp:'+' + fmtShort(x.xp), gold:'+' + fmtShort(x.gold), rawXp:x.xp, rawGold:x.gold }; };
    // a one-cell tile shows only the next two to do (padded with the latest done)
    const items = keys.map(H);
    const bonusItem = { label:'Bonus', done:false, act:'pair:bonus', xp:'+' + fmtShort(bz.xp), gold:'+' + fmtShort(bz.gold), rawXp:bz.xp, rawGold:bz.gold };
    const todo = items.filter(x => !x.done), short = todo.slice(0, 2);
    for (let i = items.length - 1; short.length < 2 && i >= 0; i--) if (items[i].done && !short.includes(items[i])) short.push(items[i]);
    short.sort((a, b) => items.indexOf(a) - items.indexOf(b));
    Object.assign(base, { tap: all && hasBonus && !earned ? 'pair:bonus' : 'open', done:faded, items, bonusItem: hasBonus && !earned ? bonusItem : null,   // bonusItem lets the phone show the Bonus the moment the last line is ticked
       short:short.map(x => ({ ...x })), more:Math.max(0, todo.length - 2), xp:hasBonus ? '+' + fmtShort(bz.xp) : '', gold:hasBonus ? '+' + fmtShort(bz.gold) : '', norew:!hasBonus,
      note: !hasBonus ? '' : earned ? 'bonus earned' : all ? 'bonus ready' : 'bonus when all done', cdone:n, ctot:keys.length, nob:!hasBonus,
      btn:[faded ? Q('DONE', '', 'done') : Q(`${n}/${keys.length}`, all && hasBonus && !earned ? 'pair:bonus' : '')] });   // ready: the count is the bonus button
  } else if (isTracker(q)){
    const due = dueTotals(q), today = dayKey(), td = stepDue(q, today), st = td.steps;
    // today's counts so the phone's background step sync (PsychStepsJob) can redraw the tile
    base.bg = { day:today, steps:st, paid:td.paid, chunk:q.chunk, xpPer:q.xpPer, goldPer:q.goldPer, goal:q.goal || 0,
      otherXp:due.xp - td.xp, otherGold:due.gold - td.gold, otherDays:due.keys.filter(k => k !== today).length };
    Object.assign(base, { done: !due.keys.length, tap: due.keys.length ? 'steps' : 'open', xp:'+' + fmtShort(due.xp), gold:'+' + fmtShort(due.gold), rawXp:due.xp, rawGold:due.gold, streak:'',
      sub:`${fmt(st)}${q.goal ? ' / ' + fmt(q.goal) : ''}`, pct: q.goal ? Math.min(100, Math.round(st / q.goal * 100)) : 0,
      note:'', btn: due.keys.length ? [Q('CLAIM', 'steps')] : [] });   // cyan: the Steps colour
  }
  // a locked follow-up: empty act = "open the app"
  if (!done && !isVisible(q)){ const p = parentOf(q); Object.assign(base, { tap:'open', btn:[Q('LOCKED', '', 'dim')], note:`after ${p.name}`, reset:null }); }
  return base;
}
// 4x4 widget: the Quests page as data. Header (level, gold, steps, ring) + up to 4 tabs (DUE, DAILY, CYCLES, OTHERS),
// each a list of rows: [full], [half, half] (null = empty half) or a subheader [{ isHdr, title, ends, time }].
// hidN / hidDone count folded follow-ups; totalXp / totalGold let the phone update the header after a widget claim.
function wBoard(){
  const L = levelInfo(S.xp), sq = firstSteps(), secs = boardSections(true);
  const cell = (q, half) => { const sl = wSlot(q); sl.half = half;
    if (!half && sl.need){ const n = sl.need; sl.needN = n; sl.pct = Math.round(Math.min(n, sl.hits || 0) / n * 100); sl.sub = `${Math.min(n, sl.hits || 0)} / ${n}`; delete sl.need; if (sl.reset) Object.assign(sl.reset, { pct:0, sub:`0 / ${n}` }); }
    if (!half && sl.segs != null) delete sl.segs;   // Recurring isn't progress, so no bar on the 4x4   // a full target shows a bar; dots only on a half tile
    sl.counts = q.kind !== 'scaling' && q.kind !== 'counter' && q.kind !== 'tally' && q.kind !== 'bounty' && isVisible(q); return sl; };
  // one section's tiles as widget rows, and the counted quests it doesn't show
  const rowsOf = sec => {
    const rows = []; let open = null;
    sec.tiles.forEach(t => {
      if (t.w){ open = null; rows.push([cell(t.q, false)]); return; }
      const sl = t.gap ? null : cell(t.q, true);
      if (open && t.c === 1){ open[1] = sl; open = null; return; }
      const r = t.c === 1 ? [null, sl] : [sl, null]; rows.push(r); open = t.c === 1 ? null : r;
    });
    const out = rows.filter(r => r.some(Boolean)), shown = new Set(out.flat().filter(Boolean).map(sl => sl.qid)), hid = sec.counted.filter(q => !shown.has(q.id));
    return { rows:out, hidN:hid.length, hidDone:hid.filter(isDone).length };
  };
  // several sections in one tab, each under its own subheader
  const tab = (key, name, list, more) => {
    const rows = []; let hidN = 0, hidDone = 0;
    list.forEach(sec => { const r = rowsOf(sec); if (!r.rows.length) return;
      if (more.hdr) rows.push([{ isHdr:true, title:'// ' + sec.g.title.toUpperCase(), ends: more.clock ? sec.ends || 0 : 0, time:'' }]);   // a clock only when the cycle has a set reset
      rows.push(...r.rows); hidN += r.hidN; hidDone += r.hidDone; });
    // DUE: the soonest first
    if (more.bcard) rows.splice(0, rows.length, ...rows.flatMap(r => r.filter(Boolean).map(x => { x.half = false; x.bcard = true; return [x]; })));   // DUE: each one a full red card, like the Quests page
    if (more.soonest) { const d = r => Math.min(...r.filter(x => x && !x.isHdr).map(x => x.dueN == null ? 9e9 : x.dueN)); rows.sort((x, y) => d(x) - d(y)); }
    return rows.length ? Object.assign({ key, tab:name, count:true, ends:0, time:'', hidN, hidDone, rows }, more.g) : null;
  };
  const isCycle = s => s.g.key.startsWith('d');
  const groups = [
    tab('due', 'DUE', secs.filter(s => s.g.key === 'a-due'), { soonest:true, bcard:true, g:{ red:true, count:false } }),
    tab('daily', 'DAILY', secs.filter(s => s.g.key === 'd1'), { g:{ ends:nextMidnight() } }),
    tab('cycles', 'CYCLES', secs.filter(s => isCycle(s) && s.g.key !== 'd1'), { hdr:true, clock:true }),
    tab('others', 'OTHERS', secs.filter(s => !isCycle(s) && s.g.key !== 'a-due'), { g:{ count:false } }),
  ].filter(Boolean);
  let steps = null;
  if (sq){ const st = stepDue(sq, dayKey()).steps, sy = stepsSync();
    steps = Object.assign(wSlot(sq), { text:`${fmt(st)}${sq.goal ? ' / ' + fmt(sq.goal) : ''}`, pct: sq.goal ? Math.min(100, Math.round(st / sq.goal * 100)) : 0, sync:sy.text, syncWarn:sy.warn,
      syncAt: S.sync && S.sync.connected ? S.sync.last || 0 : -1 }); }   // the phone writes "Synced 3 min ago" itself, so it stays right
  return { lv:L.L, xpPct: L.need ? Math.min(100, Math.round(L.into / L.need * 100)) : 0, gold:fmt(S.gold), totalXp:S.xp || 0, totalGold:S.gold || 0,
    reset:nextMidnight(), steps, groups };
}
function widgetSnapshot(){
  let board = null;
  return { updated:now(), widgets:(S.widgets || []).map(w => isBoardW(w) ? { id:w.id, size:w.size, width:4, rows:[], board: board ||= wBoard() } : { id:w.id, size:w.size, width:wWidth(w),
    rows:(w.rows || []).map((r, ri) => r.map(id => { const sl = wSlot(id && byId(id)); if (sl) sl.half = wHalfSpot(w, ri); return sl; })) }) };
}
// Sends widget data at most every 300 ms and only when it changed (home-screen redraws cost battery).
// force: send anyway (after replaying widget taps the phone's copy may differ).
var wPushTimer = 0, wLastSent = '';
function pushWidgets(force){
  const P = widgetPlugin(); if (!P) return;
  clearTimeout(wPushTimer);
  wPushTimer = setTimeout(() => { try {
    const snap = widgetSnapshot(), key = JSON.stringify(snap.widgets);
    if (!force && key === wLastSent) return;
    wLastSent = key; P.update({ data:JSON.stringify(snap) });
  } catch(e){} }, 300);
}
// apply what was tapped on a widget while the app was closed (counted at the time of the tap)
async function applyWidgetActions(){
  const P = widgetPlugin(); if (!P) return;
  let list = [];
  try { const r = await P.takeActions(); list = JSON.parse((r && r.actions) || '[]'); } catch(e){ return; }
  if (!Array.isArray(list)) return;
  list = list.filter(a => a && typeof a === 'object');   // junk in the queue is skipped
  if (!list.length) return;
  QUIET = true;
  try {
  list.sort((a, b) => (a.t || 0) - (b.t || 0)).forEach(a => {
    const q = byId(a.qid); if (!q) return;
    const t = +a.t, real = Date.now();
    NOW_AT = t > real - 14 * 864e5 && t <= real ? t : real;   // the tap's own time; junk (ancient or future) counts as now
    try {
      const v = round2(+a.v);
      if (!isVisible(q)) return;   // a locked follow-up can't be claimed from the widget either
      if (a.act === 'claim'){ if (!isDone(q)){ claimQuest(q, null); } }
      else if (a.act === 'hit' && q.kind === 'target'){ targetHit(q, 1, null); }
      else if (a.act === 'hits' && q.kind === 'target' && v >= 1 && v <= VALUE_CAP){ targetHit(q, Math.floor(v), null); }
      else if (a.act === 'slip' && q.kind === 'avoid'){ doSlip(q); }
      else if (a.act === 'tally' && q.kind === 'tally' && v > 0 && v <= VALUE_CAP){ claimTally(q, { value:String(v) }, null); }
      else if (a.act === 'record' && q.kind === 'record' && v > 0 && v <= VALUE_CAP && !isDone(q)){ submitRecord(q, { value:String(v) }, null); }
      else if (/^pair/.test(a.act) && q.kind === 'pair'){   // pair:<key> (any quest of the list, or "bonus"); pairA / pairB are the old two
        const key = a.act === 'pairA' ? 'a' : a.act === 'pairB' ? 'b' : String(a.act).slice(5);
        if (key === 'bonus' || listKeys(q).includes(key)) claimPair(q, key, null);
      }
      else if (a.act === 'steps' && isTracker(q)){ claimAll(q, null); }
    } catch(e){}
    NOW_AT = 0;
  });
  } finally { QUIET = false; }
  NOW_AT = 0; buyUndo = null; freshTile = { id:null, row:null }; renderHeader.tween = false; renderHeader.fillFull = false; tlFrom = null;
  save(); pushWidgets(true); render();
}
