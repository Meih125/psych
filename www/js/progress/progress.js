/* Progress tab: quest picker, day history, back-claims, record charts. */
let weekOffset = 0, monthOffset = 0, selDay = null;
/* ---- Quest history ----
   Progress has a row of chips: Steps, then each quest. A quest shows four stat tiles,
   a month calendar (tap a day for details), and its latest claims.
   Records show a line chart of every entry instead of a calendar. */
function dayMap(q){
  const m = {};
  const add = (arr, flag) => (arr || []).forEach(e => {
    const k = dayKey(e.t), o = m[k] || (m[k] = { n:0, xp:0, gold:0 });
    o.n++; o.xp += e.xp || 0; o.gold += e.gold || 0; o.v = round2((o.v || 0) + (e.v || 0)); if (flag) o[flag] = (o[flag] || 0) + 1; if (e.auto) o.auto = (o.auto || 0) + 1;
  });
  if (q.kind === 'pair'){ listKeys(q).forEach(k => add(itemOf(q, k).log, 'p_' + k)); add(q.bonusLog, 'bonus'); } else add(q.log);
  if (q.kind === 'avoid') (q.slips || []).forEach(t => { const k = dayKey(t); (m[k] ||= { n:0, xp:0, gold:0 }).slip = true; });
  return m;
}
function allLogs(q){
  if (q.kind === 'pair') return [...listItems(q).flatMap(r => (r.log || []).map(e => ({ ...e, what:r.name }))), ...(q.bonusLog || []).map(e => ({ ...e, what:'Bonus', bonus:true }))];
  const slips = q.kind === 'avoid' ? (q.slips || []).map(t => ({ t, xp:0, gold:0, what:'Slipped', slip:true })) : [];
  return [...(q.log || []).map(e => ({ ...e, what:q.kind === 'tally' ? fmtU(q, e.v || 0) : q.kind === 'scaling' || q.kind === 'counter' ? 'Claimed' : e.auto ? 'Auto-claimed' : 'Completed' })), ...slips];
}
var bkSel = {};   // List back-claim: which missing items are ticked, per quest and day
// a forgotten day can be claimed only if it is past and on/after the quest's creation (or first claim), so old days can't be farmed
function backOk(q, key){
  if (!(key < dayKey())) return false;
  const first = [...(q.log || []), ...(q.kind === 'pair' ? listItems(q).flatMap(r => r.log || []) : [])].reduce((m, e) => Math.min(m, e.t), Infinity);
  const from = q.created > 0 ? q.created : isFinite(first) ? first : now();
  return key >= dayKey(from);
}
function bkMissing(q, o){ return listKeys(q).filter(k => !(o && o['p_' + k])); }
function listBackHtml(q, o, label){
  const miss = bkMissing(q, o), id = q.id + '|' + selDay, sel = bkSel[id] || (bkSel[id] = new Set()), n = miss.filter(k => sel.has(k)).length;
  const rows = listKeys(q).map(k => { const r = itemOf(q, k), done = !miss.includes(k);
    return `<button type="button" class="dl-row${done ? ' done' : ''}"${done ? ' disabled' : ` data-act="bkpick" data-q="${q.id}" data-k="${k}"`}><i class="dl-ck${done ? ' on' : sel.has(k) ? ' sel' : ''}"></i><span>${esc(r.name)}</span><em>${done ? 'done' : rewardsHtml(r.xp, r.gold)}</em></button>`; }).join('');
  const b = q.bonus && (q.bonus.xp || q.bonus.gold) ? `<span class="mut">Bonus ${rewardsHtml(q.bonus.xp, q.bonus.gold)} if all done</span>` : '<span></span>';
  return `<div class="dayinfo di-list"><div class="dl-h"><b>${label}</b> · tick what you did</div>${rows}<div class="dl-f">${b}<button class="di-claim" data-act="backclaimlist" data-q="${q.id}" data-day="${selDay}"${n ? '' : ' disabled'}>Claim selected (${n})</button></div></div>`;
}
function dayInfo(q, map){
  if (!selDay) return '';
  const o = map[selDay], label = dayLabel(new Date(selDay + 'T00:00'));
  if (q.kind === 'pair' && backOk(q, selDay) && bkMissing(q, o).length) return listBackHtml(q, o, label);
  if (!o){   // a past day nobody claimed: "Claimed?" gives that day's reward and reconnects the streak
    const can = backOk(q, selDay) && ['standard', 'counter', 'scaling'].includes(q.kind);
    return `<div class="dayinfo di-row"><span><b>${label}</b> · nothing claimed</span>${can ? `<button class="di-claim" data-act="backclaim" data-q="${q.id}" data-day="${selDay}">Claimed?</button>` : ''}</div>`; }
  let what = q.kind === 'pair' ? listKeys(q).filter(k => o['p_' + k]).map(k => esc(itemOf(q, k).name)).join(', ') + (o.bonus ? ' · bonus earned' : '')
    : q.kind === 'avoid' && o.slip && !o.n ? '<span style="color:#ff8a7f">Slipped</span>' : q.kind === 'avoid' && o.auto && o.auto === o.n ? 'Auto-claimed' : q.kind === 'scaling' || q.kind === 'counter' ? `Claimed ${o.n}×` : q.kind === 'tally' ? `Logged ${fmtU(q, o.v)}${o.n > 1 ? ` in ${o.n} entries` : ''}` : 'Completed';
  return `<div class="dayinfo"><b>${label}</b> · ${what}${rewardsHtml(o.xp, o.gold)}</div>`;
}
// A daily quest's streak rebuilt from its log, so back-claims and undos always agree.
// Days inside a vacation don't break it. Returns false for quests whose streak isn't rebuilt this way.
function rebuildStreak(q){
  let days;
  if (q.kind === 'standard' && cycleDays(q) === 1) days = new Set((q.log || []).map(e => dayKey(e.t)));
  else if (q.kind === 'pair' && (q.days || 1) === 1){ const m = dayMap(q), all = listKeys(q); days = new Set(Object.keys(m).filter(d => all.every(k => m[d]['p_' + k]))); }
  else return false;
  const vac = [...(S.vacations || []), ...(S.vacation ? [{ from:S.vacation, to:now() }] : [])], inVac = t => vac.some(v => t >= startOfDay(v.from) && t < v.to);
  let until = 0, run = 0;
  if (days.size){
    const L = new Date([...days].sort().pop() + 'T00:00').getTime(); run = 1;
    for (let n = 1; n < 4000; n++){ const t = addDays(startOfDay(L), -n); if (days.has(dayKey(t))) run++; else if (!inVac(t)) break; }
    until = addDays(startOfDay(L), 1);
  }
  q.streak = run; q.bestStreak = Math.max(q.bestStreak || 0, run);
  if (q.kind === 'pair') q.lastBoth = until; else q.doneUntil = until;
  return true;
}
// Claim a forgotten day: pays that day's reward and rejoins a daily streak.
async function backClaim(q, key){
  const D = startOfDay(new Date(key + 'T00:00').getTime()), t = D + 12 * 36e5;
  if (!backOk(q, key) || dayMap(q)[key]) return;
  if (!await ask(`Claim ${dayLabel(D)}?`, 'You get that day’s reward' + (q.kind === 'standard' && cycleDays(q) === 1 ? ' and your streak joins up again.' : '.'), 'Claim', 'btn-main')) return;
  buyUndo = null;
  let R;
  if (q.kind === 'standard'){
    const daily = cycleDays(q) === 1, days = new Set((q.log || []).map(e => dayKey(e.t))); days.add(key);
    let n = 1; if (daily) while (days.has(dayKey(addDays(D, -n)))) n++;
    R = daily && streakReward(q) ? { xp:boost(q.xp, n), gold:boost(q.gold, n) } : { xp:q.xp, gold:q.gold };
    (q.log ||= []).push({ t, xp:R.xp, gold:R.gold, back:true, at:now() });
    if (daily) q.log.sort((x, y) => x.t - y.t);
  } else {
    R = q.kind === 'scaling' ? scaledReward(q, 1) : { xp:q.xp, gold:q.gold };
    (q.log ||= []).push({ t, xp:R.xp, gold:R.gold, back:true, at:now() });
  }
  q.log.sort((a, b) => a.t - b.t); q.count = (q.count || 0) + 1; rebuildStreak(q);
  grant({ xp:R.xp, gold:R.gold }, null, q.id);
  save(); render();
}
// List quest, forgotten day: claims the ticked items; a completed day also pays the bonus and rejoins the streak.
function backClaimList(q, key){
  const D = startOfDay(new Date(key + 'T00:00').getTime()), t = D + 12 * 36e5, o = dayMap(q)[key], sel = bkSel[q.id + '|' + key];
  if (!backOk(q, key) || !sel) return;
  const keys = bkMissing(q, o).filter(k => sel.has(k)); if (!keys.length) return;
  buyUndo = null;
  const daily = (q.days || 1) === 1, all = listKeys(q), full = all.every(k => keys.includes(k) || (o && o['p_' + k]));
  // full days (every item done) so far, plus this one when it becomes full
  const fd = new Set(); const m = dayMap(q); Object.keys(m).forEach(d => { if (all.every(k => m[d]['p_' + k])) fd.add(d); }); if (full) fd.add(key);
  let n = 0; if (full && daily){ n = 1; while (fd.has(dayKey(addDays(D, -n)))) n++; }
  const mul = (v) => full && daily && streakReward(q) ? boost(v, n) : v;
  let xp = 0, gold = 0;
  keys.forEach(k => { const r = itemOf(q, k), X = mul(r.xp), G = mul(r.gold); (r.log ||= []).push({ t, xp:X, gold:G, back:true, at:now() }); r.log.sort((a, b) => a.t - b.t); r.count = (r.count || 0) + 1; xp += X; gold += G; });
  if (full && q.bonus && (q.bonus.xp || q.bonus.gold) && !(m[key] && m[key].bonus)){
    const BX = mul(q.bonus.xp), BG = mul(q.bonus.gold); (q.bonusLog ||= []).push({ t, xp:BX, gold:BG, back:true, at:now() }); q.bonusLog.sort((a, b) => a.t - b.t); q.bonusCount = (q.bonusCount || 0) + 1; xp += BX; gold += BG; }
  rebuildStreak(q);
  bkSel[q.id + '|' + key] = new Set();   // what is left stays unticked
  grant({ xp, gold }, null, q.id);
  save(); render();
}
// undo a back-claim: reward and entry removed, streak rebuilt
async function undoBack(q, t, at, what){
  const pick = L => L.findIndex(e => e.back && e.t === t && (e.at || 0) === at);
  let L, i, r = null;
  if (q.kind === 'pair'){
    if (what){ r = listItems(q).find(x => x.name === what); L = r && r.log; } else L = q.bonusLog;
  } else L = q.log;
  i = L ? pick(L) : -1; if (i < 0) return;
  if (!await ask('Undo this claim?', 'The reward is taken back and ' + dayLabel(new Date(t)) + ' is open again.', 'Undo', 'btn-main')) return;
  buyUndo = null;
  const e = L.splice(i, 1)[0]; take({ xp:e.xp || 0, gold:e.gold || 0 }, qTag(q));
  if (q.kind === 'pair'){ if (r) r.count = Math.max(0, (r.count || 0) - 1); else q.bonusCount = Math.max(0, (q.bonusCount || 0) - 1); }
  else q.count = Math.max(0, (q.count || 0) - 1);
  rebuildStreak(q);
  save(); render();
}
function recordChart(q){
  const E = q.entries;
  if (E.length < 2) return '<div class="dayinfo">Log at least two entries to see a chart.</div>';
  // attempts left to right, days shaded; the line is the best so far
  const W = 340, H = 200, pl = 38, pr = 12, pt = 16, pb = 30, cw = W - pl - pr, ch = H - pt - pb, N = E.length, low = q.better === 'lower';
  const vs = E.map(e => e.v), lo = Math.min(...vs), hi = Math.max(...vs), pad = Math.max(.5, (hi - lo) * .15), vmin = lo - pad, vmax = hi + pad;
  const X = i => pl + i / (N - 1) * cw, Y = v => pt + (low ? (v - vmin) : (vmax - v)) / (vmax - vmin) * ch;
  let g = '';
  for (let i = 0; i <= 3; i++){ const v = vmin + (vmax - vmin) * i / 3, yy = Y(v).toFixed(1);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="rgba(210,240,236,.12)"/><text x="${pl - 6}" y="${(+yy + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#6f8583">${fmt(Math.round(v * 10) / 10)}</text>`; }
  // day groups
  const gr = []; E.forEach((e, i) => { const k = dayKey(e.t), l = gr[gr.length - 1]; if (l && l.k === k) l.b = i; else gr.push({ k, a:i, b:i, t:e.t }); });
  const step = Math.ceil(gr.length / 6), fd = t => new Date(t).toLocaleDateString(undefined, { day:'numeric', month:'short' });
  gr.forEach((d, j) => { const x0 = X(d.a), x1 = X(d.b), w = Math.max(x1 - x0, 2);
    if (j % 2 === 0) g += `<rect x="${(x0 - 2).toFixed(1)}" y="${pt}" width="${(w + 4).toFixed(1)}" height="${ch}" fill="#2ee6d6" opacity=".05"/>`;
    if (j % step === 0) g += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#9db2b0">${fd(d.t)}</text>`; });
  let bestSoFar = null; const bp = [];
  E.forEach((e, i) => { bestSoFar = bestSoFar == null ? e.v : (low ? Math.min(bestSoFar, e.v) : Math.max(bestSoFar, e.v)); bp.push(`${X(i).toFixed(1)},${Y(bestSoFar).toFixed(1)}`); });
  g += `<polyline points="${bp.join(' ')}" fill="none" stroke="#ff8a40" stroke-width="1.8" stroke-linejoin="round"/>`;
  E.forEach((e, i) => { const best = e.v === q.best; g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(e.v).toFixed(1)}" r="${best ? 3.4 : 2}" fill="${best ? '#ffc49a' : '#ff6b1a'}" opacity="${best ? 1 : .6}"/>`; });
  const by = Y(q.best).toFixed(1);
  g += `<line x1="${pl}" x2="${W - pr}" y1="${by}" y2="${by}" stroke="#ff3b30" stroke-width="1.1" stroke-dasharray="4 4"/><text x="${pl + 4}" y="${(+by + 13).toFixed(1)}" font-size="9.5" fill="#ff7a6a">Best ${fmt(q.best)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Attempts in order, grouped by day">${g}</svg>`;
}
// a Record quest's Progress page: start / best / latest / attempts, the chart, and its entries
function recordHistory(q){
  const tag = (q.parent ? '<span class="tag red">Follow-up</span>' : '') + '<span class="tag rose">Record</span>';
  const E = q.entries, first = E[0], last = E[E.length - 1], u = esc(q.unit);
  return `<div class="list pvl"><div class="card">${CORNERS}
      <div class="q-top"><h3>${esc(q.name)}</h3>${tag}</div>
      <div class="sum four">
        <div><b>${first ? fmt(first.v) : '—'}</b><span>Start</span></div>
        <div><b>${q.best != null ? fmt(q.best) : '—'}</b><span>Best</span></div>
        <div><b>${last ? fmt(last.v) : '—'}</b><span>Latest</span></div>
        <div><b>${fmt(E.length)}</b><span>Attempts</span></div>
      </div>
      ${recordChart(q)}
    </div>
    <div class="card">${CORNERS}<div class="q-top"><h3>Entries</h3></div>
      ${E.length ? [...E].reverse().slice(0, 30).map((e, i) => `<div class="log-row"><div class="log-l"><div>${fmt(e.v)} ${u}${e.v === q.best ? ' <span class="tag">Best</span>' : ''}</div><small>${dayLabel(e.t)}</small></div>${i === 0 && q.undo ? `<button class="hx-undo" data-act="hxundo" data-q="${q.id}">Undo</button>` : UNDO_OFF}</div>`).join('') : '<div class="empty">No entries yet.</div>'}
    </div></div>`;
}
// days whose goal was hit but whose goal bonus is still unclaimed (past days of any week, and today)
function goalDays(q){
  if (!q || !q.goal || !(q.goalXp || q.goalGold)) return [];
  const V = valsOf(q), today = dayKey();
  return Object.keys(V).filter(k => k <= today && goalDue(q, k, V[k]) > 0);
}
function progressChips(){
  const qs = S.quests.filter(q => q.kind !== 'steps' && q.kind !== 'bounty' && isTracked(q));
  const sq = firstSteps(), ready = !!sq && goalDays(sq).length > 0;   // a step goal bonus is waiting: the Steps tab glows gold (plain daily step claims don't)
  const chip = (id, name) => `<button class="chip${(S.pview || 'steps') === id ? ' on' : ''}${id === 'steps' && ready ? ' s' : ''}" data-act="pv" data-pv="${id}">${esc(name)}</button>`;
  return `<div class="chips hud-chips">${chip('steps', 'Steps')}${qs.map(q => chip(q.id, q.name)).join('')}</div>`;
}
var ppLast = null;
function closeProgPop(){ const p = $('#progPop'); if (p.classList.contains('open')){ p.classList.remove('open'); if (ppLast){ S.pview = ppLast; ppLast = null; save(); } render(); } }
function renderProgress(){
  if (S.pview && S.pview !== 'steps' && !(byId(S.pview) && isTracked(byId(S.pview)))) S.pview = 'steps';
  const q = S.pview && S.pview !== 'steps' ? byId(S.pview) : null;
  return progressChips() + (q ? (q.kind === 'record' ? recordHistory(q) : questHero(q)) : stepsHud());
}
// Lifetime steps: short form (12.5K, 10.25M, 1.2B) – tap for the exact number.
// Distance uses a stride of 0.743 m per step – tap to switch km / miles.
const STRIDE_M = 0.743;   // matched to Samsung Health: 8,380 steps = 6.23 km
let stepsExact = false;
function bigNum(v){
  const u = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([n]) => v >= n);
  return u ? (Math.floor(v / u[0] * 100) / 100).toString() + u[1] : fmt(v);
}
/* "Show in Progress": a centred dialog with switches, grouped like the Quests tab */
function renderProgPop(){
  const qs = S.quests.filter(q => !isTracker(q) && q.kind !== 'bounty'), shown = qs.filter(isTracked).length, groups = {};
  qs.forEach(q => { const g = q.parent ? qbGroupOf(parentOf(q) || q, true) : qbGroupOf(q, true); (groups[g.key] ||= { ...g, list:[] }).list.push(q); });
  const dot = q => KIND_COL[q.kind] || '#ff8a45';   // the quest type's colour, same as its tile
  $('#progPop').innerHTML = `<div class="pp-dlg">
    <div class="pp-tt"><b>Show in Progress</b><span>${shown} of ${qs.length} shown</span></div>
    <div class="pp-qa"><button data-ppall="1">Show all</button><button data-ppall="0">Hide all</button></div>
    ${Object.values(groups).sort((a, b) => a.order - b.order).map(g => `<div class="pp-gl">${g.title}</div>${g.list.map(q => `<label class="pp-sw${isTracked(q) ? '' : ' off'}">
      <i class="d" style="--c:${dot(q)}"></i><span>${esc(q.name)}</span><input type="checkbox" data-pp="${q.id}"${isTracked(q) ? ' checked' : ''}><i class="sw"></i></label>`).join('')}`).join('') || '<p class="help">No quests yet.</p>'}
    <button class="pp-done" data-ppdone="1">Done</button></div>`;
}
// toggling only updates the switches and the count in place
function ppSync(){
  const qs = S.quests.filter(q => !isTracker(q));
  document.querySelectorAll('#progPop .pp-sw').forEach(l => { const inp = l.querySelector('input'), q = byId(inp.dataset.pp); if (!q) return; inp.checked = isTracked(q); l.classList.toggle('off', !inp.checked); });
  const c = document.querySelector('#progPop .pp-tt span'); if (c) c.textContent = `${qs.filter(isTracked).length} of ${qs.length} shown`;
}

function initProgress(){
  $('#progMenu').addEventListener('click', e => { e.stopPropagation(); const pop = $('#progPop'); if (pop.classList.contains('open')) return closeProgPop(); ppLast = null; renderProgPop(); pop.classList.add('open'); });
  $('#progPop').addEventListener('click', e => e.stopPropagation());
  $('#progPop').addEventListener('change', e => {
    const id = e.target.dataset.pp; if (!id) return;
    S.progHide ||= {};
    if (e.target.checked) delete S.progHide[id]; else S.progHide[id] = true;
    ppLast = e.target.checked ? id : 'steps';   // closing the dialog opens the quest you just turned on (or Steps)
    save();   // the page behind redraws once the dialog closes (no flicker while toggling)
  });
  document.addEventListener('click', closeProgPop);
  $('#progPop').addEventListener('click', e => {
    const all = e.target.closest('[data-ppall]');
    if (all){ S.progHide ||= {}; S.quests.forEach(q => { if (all.dataset.ppall === '1') delete S.progHide[q.id]; else if (!isTracker(q)) S.progHide[q.id] = true; }); ppLast = 'steps'; save(); ppSync(); return; }
    if (e.target.closest('[data-ppdone]') || e.target === $('#progPop')) closeProgPop();
  });
  $('#progPop').addEventListener('change', () => setTimeout(ppSync, 0));
  // swipe anywhere (except the week chart and chips) for the next / previous quest
  {
    const order = () => ['steps', ...S.quests.filter(q => q.kind !== 'steps' && q.kind !== 'bounty' && isTracked(q)).map(q => q.id)];
    onFlick($('#panel'), { min:60, ratio:1.4, start: e => S.tab === 'progress' && !e.target.closest('.sh-cols, .chips, input'), swallow: () => S.tab === 'progress', onSwipe: dir => {
      const L = order(), i = Math.max(0, L.indexOf(S.pview || 'steps')), j = (i - dir + L.length) % L.length;
      S.pview = L[j]; monthOffset = 0; selDay = null; weekOffset = 0; save(); render();
      const body = document.querySelector('#panel .hx, #panel .shx, #panel > .list:last-child'); if (body) body.classList.add(dir < 0 ? 'pv-in-r' : 'pv-in-l');
      document.querySelector('#panel .chips .chip.on')?.scrollIntoView({ inline:'center', block:'nearest', behavior:'smooth' });
    } });
  }
  // swipe the week chart: left = newer week, right = older week
  {
    onFlick($('#panel'), { min:40, ratio:1.2, start: e => !!e.target.closest('.sh-cols'), swallow: e => !!e.target.closest('.sh-cols'), onSwipe: dir => {
      if (dir > 0) weekOffset++; else if (weekOffset > 0) weekOffset--; else return;
      render(); const c = document.querySelector('.sh-cols'); if (c) c.classList.add(dir > 0 ? 'in-l' : 'in-r');
    } });
  }
}
