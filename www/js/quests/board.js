/* Quests tab: summary card, Earned today panel, tiles for every kind, groups and folding. */
// When a quest with follow-ups flips done / not done, hand-set folds below it are dropped:
// claiming shows its own follow-ups, undoing folds them away again.
function foldSync(){
  const now_ = {}; S.quests.forEach(q => { if (S.quests.some(c => c.parent === q.id)) now_[q.id] = isDone(q); });
  const was = foldSync.was; foldSync.was = now_;
  if (!was || !S.folded) return;
  const below = q => S.quests.filter(c => c.parent === q.id).flatMap(c => [c, ...below(c)]);
  for (const id in now_) if (id in was && was[id] !== now_[id]){ const q = byId(id); delete S.folded[id]; below(q).forEach(c => delete S.folded[c.id]); }
}
/*    Tap a tile to claim it (tap again to undo). Tap the icon to edit it. */
function qbIcons(){ return {
  standard:'<circle cx="12" cy="12" r="8"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>',
  pair:'<rect x="7" y="3" width="10" height="7.5" rx="1.6"/><rect x="7" y="13.5" width="10" height="7.5" rx="1.6"/><path d="M12 10.5v3"/>',
  scaling:'<path d="M5 19V9M10 19V6M15 19v-8M20 19V4"/>',
  counter:'<circle cx="12" cy="12" r="8"/><path d="M12 8.5v7M8.5 12h7"/>',
  record:'<path d="M12 3v3M5.6 6.6l2 2M18.4 6.6l-2 2"/><path d="M4 18a8 8 0 0 1 16 0z"/><path d="M12 18l3.5-5"/>',
  steps:'<path d="M8 3c2 0 3 2.5 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5zM6 15h4v2a2 2 0 0 1-4 0z"/><path d="M16 8c2 0 3 2.5 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5z" transform="translate(0 2)"/>',
  tally:'<path d="M5 5v14M9 5v14M13 5v14M17 5v14M3 15l18-6"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  bounty:'<path d="M7 3h10v18l-5-3.2L7 21z"/><path d="M10 8.5h4M10 12h4"/>',
  avoid:'<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>',
}; }
function qbIcon(q){ return `<button class="qb-ic k-${q.kind}" data-act="edit" aria-label="Edit ${esc(q.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${qbIcons()[q.kind] || qbIcons().standard}</svg></button>`; }
function qbRew(xp, gold, dim){ return `<div class="qb-rew${dim ? ' dim' : ''}${+xp === +gold ? ' same' : ''}">${rewPair(xp, gold, fmtShort)}</div>`; }
// half tiles: rewards on the left, the CLAIM / DONE dot on the same line on the right
const qbHF = (rew, strk, cls = '') => `<div class="qb-hf${cls}">${rew}<div class="qb-strk">${strk}</div></div>`;
function qbBadge(txt, cls = "") { return `<span class="qb-badge ${cls}">${txt}</span>`; }
// streak (top-right of regular quests and pairs): count + the reward bonus it gives
function qbStreak(q){
  if (!hasStreak(q)) return '';
  const n = streakNow(q), m = streakReward(q) ? streakMult(isDone(q) ? n : n + 1) : 1;
  const tier = n >= 200 ? 5 : n >= 100 ? 4 : n >= 30 ? 3 : n >= 10 ? 2 : n >= 3 ? 1 : 0;   // colour steps like TikTok streaks
  return `<span class="cy-count cy-streak t${tier}" title="Streak"><span class="nn"><b>${fmt(n)}</b>×</span>${m > 1 ? `<u>+${Math.round((m - 1) * 100)}%</u>` : ''}</span>`;
}
function qbRing(v, max){
  const r = 36, c = 2 * Math.PI * r, k = max ? Math.min(1, v / max) : 0, full = max > 0 && v >= max;
  const len = `${v}/${max}`.length, fs = len <= 3 ? 20 : len === 4 ? 17 : len === 5 ? 15 : 13;   // shrink so 10/10 stays inside the ring
  return `<div class="qb-ring${full ? ' full' : ''}" style="--rfs:${fs}px"><svg viewBox="0 0 86 86"><circle cx="43" cy="43" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
    <circle cx="43" cy="43" r="${r}" fill="none" stroke="${full ? '#3fd47a' : '#ff6b1a'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * k).toFixed(1)} ${c.toFixed(1)}"/></svg>
    <div class="qb-rc"><b>${v}/${max}</b><small>DONE</small></div></div>`;
}
function qbSummary(){
  const vis = S.quests.filter(ringQuest);
  const done = vis.filter(isDone).length, T = S.today && S.today.day === dayKey() ? S.today : { xp:0, gold:0 };
  const sq = firstSteps(), st = sq ? stepDue(sq, dayKey()).steps : 0, due = sq ? dueTotals(sq) : { keys:[] };
  const goalReady = sq && sq.goal && st >= sq.goal && !(sq.goalPaid && sq.goalPaid[dayKey()]);   // today's goal can be claimed here (older days: Progress)
  return `<div class="qb-sumw"><div class="qb-sum"${sq ? ` data-holdedit="${sq.id}"` : ''}>${qbRing(done, vis.length)}<div class="qb-st">
    <div class="ln"><span class="ep-lab">Earned today<span class="info earn-i" data-act="earn">${infoIcon('Where it came from', '', earnOpen)}</span></span><b><span class="xp-r">${ico('i-gem')}<i class="et" data-v="${T.xp}">${fmt(T.xp)}</i></span><span class="gold-r">${ico('i-coin')}<i class="et" data-v="${T.gold}">${fmt(T.gold)}</i></span></b></div>
    ${sq ? `<div class="ln qb-stp"><span>Steps</span><b>${fmt(st)}${sq.goal ? ' / ' + fmt(sq.goal) : ''}</b></div><div class="qb-bar"><i style="width:${sq.goal ? Math.min(100, st / sq.goal * 100) : 0}%"></i></div>` : ''}
    ${sq ? `<div class="qb-sumft"><span class="qb-tm">${stepsSyncTag()}</span>
      <span class="qb-sbtns">${goalReady ? `<button class="qb-sclaim qb-gclaim" data-act="goalnow" data-q="${sq.id}" data-day="${dayKey()}">${window.PsychDen ? PsychDen.icon() : ''}Goal</button>` : ''}${due.keys.length ? `<button class="qb-sclaim" data-act="claimall" data-q="${sq.id}" title="+${fmt(due.xp)} XP, +${fmt(due.gold)} gold">Claim</button>` : ''}</span></div>` : ''}</div></div>${earnOpen ? earnPanel() : ''}</div>`;
}
/* "Earned today" (i): a small panel under the summary card listing where today's XP and gold came from.
   Tap the (i) to open / close it; tapping anywhere else closes it. */
var earnOpen = false;
function earnPanel(){
  const T = S.today && S.today.day === dayKey() ? S.today : { xp:0, gold:0, src:[] }, L = Array.isArray(T.src) ? T.src : [];
  const sq = firstSteps(), short = k => new Date(k + 'T00:00').toLocaleDateString(undefined, { month:'short', day:'numeric' });
  const wk = k => new Date(k + 'T00:00').toLocaleDateString(undefined, { weekday:'short' });
  const row = (c, name, sub, xp, gold, gem) => `<div class="ep-row"><i style="--c:${c}"></i><span class="ep-nm">${esc(name)}${sub ? `<small>${esc(sub)}${gem ? `<i class="rdot" style="--c:${gem};margin:0 0 0 6px"></i>` : ''}</small>` : ''}</span>
    <span class="ep-x${xp ? '' : ' z'}">${xp ? '+' + fmt(xp) : '–'}</span><span class="ep-g${gold ? '' : ' z'}">${gold ? '+' + fmt(gold) : '–'}</span></div>`;
  const quests = L.filter(r => r.k.startsWith('q:')).map(r => {
    const q = byId(r.k.slice(2)), kind = q ? q.kind : r.kind;
    const sub = r.parts && r.parts.length ? r.parts.join(', ') : r.amt && q ? fmtU(q, r.amt) : r.c > 1 ? '×' + r.c : '';
    return row(KIND_COL[kind] || '#ff8a45', q ? q.name : r.n, sub, r.xp, r.gold);
  });
  const steps = [];
  const st = L.find(r => r.k === 'st:today'), early = L.find(r => r.k === 'st:early'), goal = L.find(r => r.k === 'goal');
  if (st) steps.push(row('#2ee6d6', 'Today', sq ? `${fmt(stepDue(sq, dayKey()).steps)} steps` : '', st.xp, st.gold));
  if (early){ const d = (early.days || []).slice().sort(); steps.push(row('#2ee6d6', 'Earlier days', d.length > 3 ? `${d.length} days` : d.map(short).join(', '), early.xp, early.gold)); }
  if (goal){ const d = (goal.days || []).slice().sort(); steps.push(row('#ffc94a', 'Goal bonus', d.length > 2 ? `${d.length} days` : d.map(k => k === dayKey() ? 'today' : wk(k)).join(', '), goal.xp, goal.gold)); }
  const other = [];
  const lv = L.find(r => r.k === 'lv'); if (lv) other.push(row('#f0b429', 'Level up', lv.lv ? `Lv ${lv.lv[0]} → ${lv.lv[1]}` : '', lv.xp, lv.gold));
  const dl = L.find(r => r.k === 'daily'); if (dl) other.push(row('#2ee6d6', 'Daily reward', (dl.parts || []).slice(-1)[0] || '', dl.xp, dl.gold));
  L.filter(r => r.k.startsWith('set:')).forEach(r => { const c = CARDS.find(x => x.set === r.k.slice(4)), col = c ? RARITY[c.rarity].color : '#c792ff'; other.push(row(col, 'Set complete', r.n + (r.c > 1 ? ' ×' + r.c : ''), r.xp, r.gold, col)); });
  L.filter(r => r.k.startsWith('scenes:')).forEach(sc => other.push(row('#9db2b0', sc.n, '', sc.xp, sc.gold)));
  // anything not in a row: earned before this version, or from somewhere not tagged
  const ex = T.xp - L.reduce((a, r) => a + r.xp, 0), eg = T.gold - L.reduce((a, r) => a + r.gold, 0);
  if (ex > 0 || eg > 0) other.push(row('#4e6260', 'Earlier today', '', Math.max(0, ex), Math.max(0, eg)));
  const DEN_C = { hack:'46,230,214', hilo:'255,184,58', lock:'150,225,255' };   // each game's colour in the Den
  const denG = g => (v => `<span class="ep-g${v < 0 ? ' neg' : ''}">${v < 0 ? '−' : '+'}${fmt(Math.abs(v))}</span>`);
  const dnRows = ['hack', 'hilo', 'lock'].map(g => L.find(r => r.k === 'den:' + g)).filter(Boolean), dnNet = dnRows.reduce((a, r) => a + r.gold, 0);
  const dn = !dnRows.length ? [] : [`<div class="ep-row"><i style="--c:#ff3b30"></i><span class="ep-nm">The Den</span><span class="ep-x z">–</span>${denG()(dnNet)}</div>`].concat(dnRows.map(r =>
    `<div class="ep-row ep-sub"><i style="--c:rgb(${DEN_C[r.k.slice(4)]})"></i><span class="ep-nm">${esc(r.n)}</span><span class="ep-x z">–</span>${denG()(r.gold)}</div>`));
  const grp = (t, rows) => rows.length ? `<div class="ep-grp">${t}</div>${rows.join('')}` : '';
  const any = quests.length + steps.length + dn.length + other.length;
  // the title sits on the same line as the XP / gold column icons
  return `<div class="ep-pop" data-act="earnpop">
    ${any ? `<div class="ep-row ep-hd"><span class="ep-ttl" style="grid-column:1 / 3">EARNED TODAY</span><span class="ep-x">${ico('i-gem')}</span><span class="ep-g">${ico('i-coin')}</span></div>
      ${grp('QUESTS', quests)}${grp('STEPS', steps)}${dn.join('')}${grp('OTHER', other)}
      <div class="ep-row ep-tot"><i></i><span>Total</span><span class="ep-x">+${fmt(T.xp)}</span><span class="ep-g${T.gold < 0 ? ' neg' : ''}">${T.gold < 0 ? '−' : '+'}${fmt(Math.abs(T.gold))}</span></div>`
    : '<div class="ep-h">EARNED TODAY</div><div class="ep-empty">Nothing yet today. Claim a quest to start.</div>'}</div>`;
}
function earnToggle(open){
  const icon = document.querySelector('.qb-sumw .earn-i .info-btn');
  if (open && icon){ infoOpen(icon, { inside: el => !!el.closest('.earn-i, .ep-pop'), close: () => earnShow(false) }); earnShow(true); }
  else if (infoCur && infoCur.icon === icon) infoClose();
  else earnShow(false);
}
function earnShow(open){
  earnOpen = open;
  const w = document.querySelector('.qb-sumw'); if (!w) return;
  w.querySelector('.ep-pop')?.remove();
  w.querySelector('.earn-i .info-btn')?.classList.toggle('open', open);
  if (!open) return;
  w.insertAdjacentHTML('beforeend', earnPanel());
  earnArrow();
}
// the panel's little arrow points at the (i)
function earnArrow(){
  const w = document.querySelector('.qb-sumw'), b = w && w.querySelector('.earn-i'), p = w && w.querySelector('.ep-pop'); if (!b || !p) return;
  p.style.setProperty('--ax', (b.getBoundingClientRect().left + b.offsetWidth / 2 - w.getBoundingClientRect().left) + 'px');
}
// ---- one tile per quest ----
function qbStandard(q, wide){
  const done = isDone(q), locked = !done && !isVisible(q), R = boosted(q, q.xp, q.gold), b = qbBadge(done ? 'DONE' : locked ? 'LOCKED' : 'CLAIM', done ? 'ok' : locked ? 'dim' : '');
  return `<article class="card qb-t${done ? ' done' : ''}${locked ? ' locked' : ''}"${locked ? '' : ` data-act="${done ? 'reopen' : 'claim'}"`}>
    ${wide ? qbTR(qbStreak(q), b) + qbHead(q) : `<div class="qb-top">${qbIcon(q)}${qbStreak(q)}</div><h4 class="qb-h2">${esc(q.name)}</h4>`}${qbNote(q)}
    ${wide ? `<div class="qb-foot">${qbRew(R.xp, R.gold, done)}</div>` : qbHF(qbRew(R.xp, R.gold, done), b)}
  </article>`;
}
function qbPair(q, wide = true){
  // List: one line per quest (a box that fills in the list colour when done), then the Bonus line.
  // faded once the bonus is claimed (or all done with no bonus)
  const t = now(), keys = listKeys(q), n = listDoneN(q), all = n === keys.length, earned = q.bonusUntil > t;
  const B = boosted(q, q.bonus.xp, q.bonus.gold), hasBonus = B.xp > 0 || B.gold > 0, faded = all && (earned || !hasBonus);
  const rows = keys.map(k => { const r = itemOf(q, k), d = r.until > t, R = boosted(q, r.xp, r.gold), rw = qbRew(R.xp, R.gold, d);
    const body = wide ? `<span class="ql-n">${esc(r.name)}</span>${rw}` : `<div class="nm"><span class="ql-n">${esc(r.name)}</span>${rw}</div>`;   // half: the rewards sit under the name
    return `<div class="ql-row${d ? ' done' : ''}" data-act="${d ? 'reopen' : 'claim'}" data-row="${k}"><i class="ql-ck"></i>${body}</div>`; }).join('');
  const ready = all && !earned && hasBonus;
  // bottom line: how many are done (DONE once it is all over), the bonus rewards on the right
  const bonus = `<div class="ql-bonus${ready ? ' ready' : ''}${faded ? ' got' : ''}"${ready ? ' data-act="claim" data-row="bonus"' : ''}><span class="ql-bn">${faded ? 'DONE' : `${n}/${keys.length}`}</span>${hasBonus ? qbRew(B.xp, B.gold, earned) : ''}</div>`;
  const head = wide ? qbTR(qbStreak(q)) + qbHead(q) : `<div class="qb-top">${qbIcon(q)}${qbStreak(q)}</div><h4 class="qb-h2">${esc(q.name)}</h4>`;
  return `<article class="card qb-t${wide ? ' wide' : ''}${faded ? ' done' : ''}"${ready ? ' data-act="claim" data-row="bonus"' : ''}>
    ${head}${qbNote(q)}
    <div class="ql">${rows}${bonus}</div>
  </article>`;
}
const SC_SEEN = {};   // the +% last drawn for each Recurring quest, so a change ticks up (or down) like the gold
function scalingPctTick(id, from, to){
  document.querySelectorAll(`.sc-pct[data-sq="${id}"]`).forEach(el => {
    countTo(el, from, to, 600, { every:45, show: v => '+' + Math.round(v) + '%' });
    replay(el, 'pct-up');
  });
}
function qbScaling(q, wide){
  const n = weekClaims(q), next = scaledReward(q, n + 1), up = Math.round((Math.pow(1 + q.growth / 100, n) - 1) * 100);
  const seen = SC_SEEN[q.id]; SC_SEEN[q.id] = up;
  if (seen != null && seen !== up && !S.reduceFx && !QUIET) requestAnimationFrame(() => scalingPctTick(q.id, seen, up));
  if (!wide){   // half: claims so far (2×) with what the next one pays under it, rewards and the dot on one line
    const corner = `<span class="cy-count cy-streak rc"><span class="nn"><b>${n}</b>×</span>${up ? `<u class="sc-pct" data-sq="${q.id}">+${up}%</u>` : ''}</span>`;
    return `<article class="card qb-t" data-act="claim">
      <div class="qb-top">${qbIcon(q)}${corner}</div><h4 class="qb-h2">${esc(q.name)}</h4>${qbNote(q)}
      ${qbHF(qbRew(next.xp, next.gold), qbBadge('CLAIM'))}
    </article>`;
  }
  return `<article class="card qb-t wide" data-act="claim">
    ${qbTR(qbBadge('CLAIM'))}
    ${qbHead(q)}${qbNote(q)}
    <div class="qb-pips">${Array.from({ length:7 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}${n > 7 ? `<em>+${n - 7}</em>` : ''}</div>
    <span class="qb-next">${(w => n ? `Claimed ×${n}${up ? ` · Next pays <b class="sc-pct" data-sq="${q.id}">+${up}%</b>` : ''}` : `Each claim ${w} pays <b>${q.growth}%</b> more`)(periodOf(q) === 1 ? 'today' : `this ${periodWord(q)}`)}</span>
    <div class="qb-foot">${qbRew(next.xp, next.gold)}</div>
  </article>`;
}
// Counter: lifetime count in the corner, last 7 days as small bars.
function qbCounter(q, wide){
  const locked = !isVisible(q), act = locked ? '' : ' data-act="claim"', bd = locked ? qbBadge('LOCKED', 'dim') : qbBadge('CLAIM'), lk = locked ? ' locked' : '';
  const n = q.count || 0, td = counterToday(q), corner = `<span class="cy-count cy-streak cn"><u><b>${fmt(n)}</b> ${n === 1 ? 'time' : 'times'}</u></span>`;   // the number sits left of "times"
  if (!wide) return `<article class="card qb-t${lk}"${act}>
    <div class="qb-top">${qbIcon(q)}${corner}</div><h4 class="qb-h2">${esc(q.name)}</h4>${qbNote(q)}
    <span class="qb-next cn-today">Today ${td}</span>
    ${qbHF(qbRew(q.xp, q.gold), bd)}
  </article>`;
  // wide: a bar toward the next milestone; rewards, today's count and the dot on the bottom line
  const ms = counterMilestone(n), on = Math.floor(n / ms * 10 + 1e-9);
  return `<article class="card qb-t wide${lk}"${act}>
    ${qbTR(corner, bd)}
    ${qbHead(q)}${qbNote(q)}
    <div class="cn-ms"><div class="tg-seg">${Array.from({ length:10 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div><span>${fmt(ms)}</span></div>
    <div class="qb-foot">${qbRew(q.xp, q.gold)}<span class="qb-next cn-today">Today ${td}</span></div>
  </article>`;
}
// the next round number to aim for
function counterMilestone(n){ const L = [10, 25, 50, 100, 250, 500, 1000]; return L.find(v => n < v) || (Math.floor(n / 1000) + 1) * 1000; }
function qbRecord(q, wide){
  const done = isDone(q), p = parentOf(q), locked = p && !isVisible(q), last = q.entries.length ? q.entries[q.entries.length - 1].v : null, u = esc(q.unit);
  if (!wide){   // half: the best in the corner, the value box + REC on one line, rewards and the last value under it
    const input = done || locked ? '' : `<div class="rec-input qb-in rec-h"><input type="number" step="0.1" inputmode="decimal" placeholder="${last != null ? fmt(last) : 'Value'}" aria-label="Value"><button class="rec-btn rec-dot off" data-act="record" aria-label="Record">REC</button></div>`;
    return `<article class="card qb-t${done ? ' done' : ''}${locked ? ' locked' : ''}"${done ? ' data-act="reopen"' : ''}>
      <div class="qb-top">${qbIcon(q)}<span class="qb-next">${q.best == null ? 'No entries yet' : `Best ${fmt(q.best)} ${u}`}</span></div><h4 class="qb-h2">${esc(q.name)}</h4>${qbNote(q)}
      ${input}${qbHF(qbRew(q.xpPer, q.goldPer, done || locked), done ? qbBadge('DONE', 'ok') : last != null ? `<span class="qb-next">Last ${fmt(last)}</span>` : '')}
    </article>`;
  }
  return `<article class="card qb-t wide${done ? ' done' : ''}${locked ? ' locked' : ''}"${done ? ' data-act="reopen"' : ''}>
    ${done ? qbTR(qbBadge('DONE', 'ok')) : ''}
    ${qbHead(q)}${qbNote(q)}
    <div class="qb-tot">${q.best == null ? '<span>First entry sets your starting point</span>' : `<span>Best <b>${fmt(q.best)} ${u}</b></span>${last != null ? `<span>Last ${fmt(last)} ${u}</span>` : ''}`}</div>
    ${done || locked ? '' : `<div class="rec-input qb-in"><input type="number" step="0.1" inputmode="decimal" placeholder="${last != null ? fmt(last) : 'Enter value'}" aria-label="Value"><span class="unit">${u}</span><button class="rec-btn rec-dot off" data-act="record">RECORD</button></div>`}
    <div class="qb-foot">${qbRew(q.xpPer, q.goldPer, done || locked)}<span class="qb-sub">${recSub(q)}</span></div>
  </article>`;
}
function qbTally(q, wide){
  const mine = tlFrom && tlFrom.id === q.id ? tlFrom : null, fr = mine && !S.reduceFx ? mine : null;
  if (mine) tlFrom = null;   // used once
  const pv = tallyPreview(q, ''), total = q.total || 0, ph = 'Amount';
  if (fr) requestAnimationFrame(() => { tallyCountUp(q.id, fr.total, total, fr.laps ? tallyLapsMs(fr.units) : fr.quick ? 450 : 650); if (fr.laps) tallyLaps(q.id, fr); });
  if (!wide){   // half: total + carry in the corner, amount box + ADD on one line, rewards and the step size under it
    const carry = q.carry ? `<span class="tl-cr">${fmtU(q, q.carry)} carried over</span>` : '';
    return `<article class="card qb-t tally-card tl-half">
      <div class="qb-top">${qbIcon(q)}<span class="tl-tot"><span class="qb-next">Total <b class="tl-total" data-qid="${q.id}">${fr ? fmtU(q, fr.total) : fmtU(q, total)}</b></span>${carry}</span></div><h4 class="qb-h2">${esc(q.name)}</h4>${qbNote(q)}
      <div class="qb-in tl-in tl-h"><input type="number" min="0" step="any" inputmode="decimal" placeholder="${ph}" data-tallyin="${q.id}" aria-label="Amount"><button class="tl-dot off" data-act="tally" aria-label="Add">ADD</button></div>
      ${qbHF(qbRew(q.xpPer, q.goldPer), `<span class="qb-next">every ${esc(fmtU(q, q.chunk))}</span>`)}
    </article>`;
  }
  return `<article class="card qb-t wide tally-card">
    ${qbTR(qbBadge(`${rewPair(q.xpPer, q.goldPer, fmtShort)}<span class="tl-per">/ ${esc(fmtU(q, q.chunk))}</span>`, 'tl-rate'))}
    ${qbHead(q)}${qbNote(q)}
    <div class="tl-top"><div class="tl-totbox"><small>TOTAL</small><b class="tl-total" data-qid="${q.id}">${fr ? fmtU(q, fr.total) : fmtU(q, total)}</b></div><span class="tl-note">${tallyNote(q, pv)}</span></div>
    <div class="tl-meter tg-seg">${tallyMeterHtml(q, pv, fr && !fr.laps ? fr : null)}</div>
    <div class="qb-in tl-in"><span class="tl-rew">${rewardsHtml(pv.xp, pv.gold).replace('class="rewards"', 'class="rewards" style="opacity:.45"')}</span><input type="number" min="0" step="any" inputmode="decimal" placeholder="${ph}" data-tallyin="${q.id}" aria-label="Amount"><button class="tl-dot off" data-act="tally">ADD</button></div>
  </article>`;
}
// Target: orbs up to 10, a ring + 10 segments above that
function qbTarget(q, wide){
  targetRoll(q);
  const done = isDone(q), need = q.need || 1, hits = Math.min(need, q.hits || 0), full = hits >= need, R = boosted(q, q.xp, q.gold);
  const badge = qbBadge(done ? 'DONE' : full ? 'CLAIM' : `${hits}/${need}`, done ? 'ok' : full ? 'cy' : 'cnt');
  // no countdown on the tile: the group heading (Weekly, Every 3 days…) already shows when it resets
  if (!wide && need <= 10){
    // half tile: a dot per hit; tapping the dots removes one, the rest of the tile adds one
    const orbs = `<div class="tg-orbs${full ? ' full' : ''}"${done ? '' : ' data-act="tunhit"'}>${Array.from({ length:need }, (_, i) => `<i class="${i < hits ? 'on' : ''}"></i>`).join('')}</div>`;
    return `<article class="card qb-t${done ? ' done' : ''}" data-act="${done ? 'reopen' : 'claim'}">
      <div class="qb-top">${qbIcon(q)}${qbStreak(q)}</div><h4 class="qb-h2">${esc(q.name)}</h4>${qbNote(q)}
      <div class="qb-strk tg-strk tg-row">${orbs}</div>${qbHF(qbRew(R.xp, R.gold, done), badge)}</article>`;
  }
  // full tile: a slim bar (a segment per hit up to 10) with hits / need
  const segs = Math.min(10, need), on = need <= 10 ? hits : Math.floor(hits / need * 10 + 1e-9), many = need > 10;
  const cb = done ? qbBadge('DONE', 'ok') : full ? qbBadge('CLAIM', 'cy') : '';
  return `<article class="card qb-t wide${done ? ' done' : ''}" data-act="${done ? 'reopen' : 'claim'}">
    ${qbTR(qbStreak(q), cb)}
    ${qbHead(q)}${qbNote(q)}
    <div class="cn-ms tg-ms"${done || many ? '' : ' data-act="tunhit"'}><div class="tg-seg${full && !done ? ' full' : ''}">${Array.from({ length:segs }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div><span>${fmt(hits)}/${fmt(need)}</span></div>
    ${!done && (many || hits) ? `<div class="tg-add"><button class="tg-minus" data-act="tunhit"${hits ? '' : ' disabled'}>−1</button>${many && !full ? [5, 10].map(n => `<button data-act="thit" data-n="${n}">+${n}</button>`).join('') + '<button data-act="thit" data-n="type" aria-label="Type an amount">+</button>' : ''}</div>` : ''}
    <div class="qb-foot">${qbRew(R.xp, R.gold, done)}</div></article>`;
}
function qbBounty(q, wide){
  const done = isDone(q); const b = qbBadge(done ? 'DONE' : 'CLAIM', done ? 'ok' : bountyUrgent(q) ? 'red' : '');
  return `<article class="card qb-t${wide ? ' wide' : ' bt-half'}${done ? ' done' : ''}${bountyUrgent(q) ? ' urgent' : ''}" data-act="${done ? 'reopen' : 'claim'}">
    ${wide ? qbTR(b, !done && bountyUrgent(q) && dueIn(q) >= 0 ? `<span class="bt-warn" aria-label="Due soon"><svg viewBox="0 0 24 24" fill="none" stroke="url(#btwg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="btwg" gradientUnits="userSpaceOnUse" x1="0" y1="21" x2="0" y2="3"><stop offset="0" stop-color="#ff3b30"/><stop offset="1" stop-color="#ff9f2e"/></linearGradient></defs><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg></span>` : '') + qbHead(q, bountyDue(q, true)) + qbNote(q) + `<div class="qb-foot">${qbRew(q.xp, q.gold, done)}</div>`
      : `<div class="qb-top">${qbIcon(q)}${done ? '' : `<span class="bt-chip">${CLOCK_SVG}${bountyLeft(q)}</span>`}</div><h4 class="qb-h2">${esc(q.name)}</h4>${qbNote(q)}${done ? '' : `<span class="bt-date">Due ${shortDate(q.due)}</span>`}${qbHF(qbRew(q.xp, q.gold, done), b)}`}</article>`;
}
function qbAvoid(q, wide){
  const slip = slippedToday(q), done = isDone(q), n = daysClean(q), R = boosted(q, q.xp, q.gold);
  const best = Math.max(q.best || 0, n);
  const badge = slip ? `<span class="qb-badge red" data-act="unslip">SLIPPED</span>` : qbBadge(done ? 'DONE' : 'CLAIM', done ? 'ok' : '');
  const slipBtn = slip ? '' : wide ? `<button class="av-slip" data-act="slip">SLIPPED</button>` : `<button class="av-slip av-sq" data-act="slip" aria-label="Slipped today"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/></svg></button>`;
  const big = `<div class="av-n">${fmt(n)}<small>${n === 1 ? 'day' : 'days'} clean${wide ? ` · best ${fmt(best)}` : ''}</small></div>`;
  // full tile: milestone badges, earned ones lit, the next dashed with time left
  let strip = '';
  if (wide){
    const run = slip ? 0 : n + (done ? 1 : 0), next = AV_MILESTONES.find(m => m.d > run);   // today counts once claimed
    strip = `<div class="av-ms${slip ? ' x' : ''}">${AV_MILESTONES.map(m => `<span class="${run >= m.d ? 'on' : m === next ? 'next' : ''}"><i></i>${m.k}</span>`).join('')}</div>
      <div class="av-next">${slip ? 'Starts again tomorrow' : next ? `Next: <b>${next.name}</b> ${next.d - run === 1 ? 'tomorrow' : `in ${fmt(next.d - run)} days`}` : 'Every milestone reached'}</div>`;
  }
  const act = slip ? '' : ` data-act="${done ? 'reopen' : 'claim'}"`;
  return `<article class="card qb-t${wide ? ' wide' : ''}${done ? ' done' : ''}${slip ? ' slipped' : ''}"${act}>
    ${wide ? qbTR(qbStreak(q)) + qbHead(q) : `<div class="qb-top"><span class="av-tl">${qbIcon(q)}${slipBtn}</span>${qbStreak(q)}</div><h4 class="qb-h2">${esc(q.name)}</h4>`}${qbNote(q)}
    ${wide ? big : ''}${strip}
    ${wide ? `<div class="qb-foot av-foot">${qbRew(R.xp, R.gold, done)}<span class="av-r">${slipBtn}${badge}</span></div>` : qbHF(qbRew(R.xp, R.gold, done), badge)}</article>`;
}
// the quest's note, if it has one (2 lines at most on a half tile, 3 on a full one)
function qbNote(q){ return q.note ? `<p class="qb-note">${esc(q.note)}</p>` : ''; }
function qbHead(q, sub = ''){
  const p = parentOf(q), after = p && !isVisible(q) ? `<span class="qb-after">Unlocks after: ${esc(p.name)}</span>` : '';   // a locked follow-up says what it waits for (an open one sits under its quest already)
  return `<div class="qb-hd">${qbIcon(q)}<div class="qb-hdt"><h4>${esc(q.name)}</h4>${after}${sub}</div></div>`; }
function qbTR(...parts){ return `<div class="qb-tr">${parts.join('')}</div>`; }
// keep a wide tile's name clear of its top-right corner badge:
// its header keeps clear of whatever sits there (reads first, then writes, so the page lays out once)
function fitCorners(){
  const rows = [...document.querySelectorAll('#panel .card.qb-t.wide > .qb-tr')].map(tr => ({ tr, hd:tr.parentElement.querySelector(':scope > .qb-hd') })).filter(r => r.hd);
  rows.forEach(r => {
    r.w = Math.max(0, ...[...r.tr.children].filter(el => !el.matches('.qb-badge:not(.tl-rate)')).map(el => Math.max(el.offsetWidth, ...[...el.children].map(k => k.getBoundingClientRect().width))));
    r.cur = parseFloat(getComputedStyle(r.hd).paddingRight) || 0;
  });
  rows.forEach(r => { if (r.w + 18 > r.cur) r.hd.style.paddingRight = (r.w + 18) + 'px'; });
}
// every tile: a soft wash of its quest type's colour at the top (span.kt, behind the content)
function qbTile(q, wide){
  const c = KIND_COL[q.kind] || '#ff8a45', rgb = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).join(',');
  let body;
  try { body = qbTileBody(q, wide); }
  catch(e){ console.error('tile', q && q.id, e); body = `<article class="card qb-t"><div class="qb-top"><div class="qb-hd"><div class="qb-hdt"><h4>${esc(q && q.name || 'Quest')}</h4></div></div></div></article>`; }   // a broken quest still shows (and can be edited)
  return body.replace(/^(\s*<article\b[^>]*?)(>)/, `$1 style="--kc:${rgb}"$2<span class="kt"></span>`);
}
function qbTileBody(q, wide){
  if (q.kind === 'pair') return qbPair(q, wide);
  if (q.kind === 'scaling') return qbScaling(q, wide);
  if (q.kind === 'counter') return qbCounter(q, wide);
  if (q.kind === 'record') return qbRecord(q, wide);
  if (q.kind === 'tally') return qbTally(q, wide);
  if (q.kind === 'target') return qbTarget(q, wide);
  if (q.kind === 'bounty') return qbBounty(q, wide);
  if (q.kind === 'avoid') return qbAvoid(q, wide);
  return qbStandard(q, wide);
}
// which group a quest sits in (follow-ups go with their parent)
function qbGroupOf(q, noPin){
  // a pinned quest gets its own group right under Due soon (the widget and Progress ignore pins)
  if (q.pinned && !noPin && !q.parent && !(q.kind === 'bounty' && bountyUrgent(q))) return { key:'b-pin', order:-.5, title:'Pinned', time:'' };
  // Tally and Bounty never reset, so they share one "Others" group (like the widget)
  if (q.kind === 'tally' || q.kind === 'counter' || (q.kind === 'record' && q.noReset)) return { key:'z-other', order:9e9, title:'Others', time:'' };
  if (q.kind === 'bounty') return bountyUrgent(q) ? { key:'a-due', order:-1, title:'Due soon', time:'' } : { key:'z-other', order:9e9, title:'Others', time:'' };
  const d = q.kind === 'scaling' ? periodOf(q) : isTracker(q) ? 1 : (q.days || 1);
  return { key:'d' + d, order:d, title:cycleName(d), time:d === 1 ? cd(nextMidnight()) : '' };
}
function boardGroups(){
  const groups = {};
  S.quests.filter(q => !q.parent && !isTracker(q) && !(q.kind === 'bounty' && q.doneAt && q.doneAt < startOfDay())).forEach(q => {
    const g = qbGroupOf(q); (groups[g.key] ||= { ...g, list:[] }).list.push(q);
  });
  return Object.values(groups).sort((a, b) => a.order - b.order);
}
// Follow-ups fold away behind their quest (the cut corner of a quest that has follow-ups is the button).
// follow-ups stay folded until their quest is done
// Opening or closing one by hand sticks for the rest of the day: S.folded[id] = { open, day }.
const kidCount = q => S.quests.filter(c => c.parent === q.id).reduce((n, c) => n + 1 + kidCount(c), 0);
function folded(q){
  if (!S.quests.some(c => c.parent === q.id)) return false;
  const o = S.folded && S.folded[q.id];
  if (o && typeof o === 'object' && o.day === dayKey()) return !o.open;
  return !isDone(q);
}
const FOLD_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
function foldBtn(html, q){
  if (!S.quests.some(c => c.parent === q.id)) return html;
  const n = kidCount(q), f = folded(q);
  const btn = `<button type="button" class="qb-fold${f ? '' : ' open'}" data-act="fold" data-id="${q.id}" aria-label="${f ? 'Show' : 'Hide'} ${n} follow-up${n > 1 ? 's' : ''}">${FOLD_SVG}</button>`;
  return html.replace(/<\/article>\s*$/, btn + '</article>');
}
// The Quests board by group: tiles in arranged order (follow-ups under their quest), done count, reset time.
// Used by the Quests page and by the 4x4 widget.
function boardSections(noPin){
  const groups = {};
  S.quests.forEach(targetRoll);
  // steps live in the summary card; a claimed bounty stays until midnight, then it's gone
  S.quests.filter(q => !q.parent && !isTracker(q) && !(q.kind === 'bounty' && q.doneAt && q.doneAt < startOfDay())).forEach(q => {
    const g = qbGroupOf(q, noPin); (groups[g.key] ||= { ...g, list:[] }).list.push(q);
  });
  const withKids = q => [q, ...S.quests.filter(c => c.parent === q.id).flatMap(withKids)];
  return Object.values(groups).sort((a, b) => a.order - b.order).map(g => {
    const all = g.list.flatMap(withKids);
    // multi-day groups: count down to the soonest reset of a finished quest, else just say the cycle
    let time = g.time, ends = g.key === 'd1' ? nextMidnight() : null;
    if (!time && g.key[0] === 'd'){ const e = all.map(q => q.kind === 'pair' || q.kind === 'target' ? q.cycleEnd : q.kind === 'scaling' ? periodEnd(q) : q.doneUntil).filter(x => x > now());
      // nothing claimed: the cycle restarts at full length when it ends
      ends = e.length ? Math.min(...e) : Math.min(...all.filter(q => q.kind !== 'bounty').map(rollEndOf), +g.key.slice(1) === MONTHLY ? addMonths(now(), 1) : Infinity);
      if (!isFinite(ends)) ends = null;
      time = ends ? cd(ends) : `${cycleName(+g.key.slice(1))} cycle`; }
    const counted = all.filter(ringQuest);
    const cnt = g.key === 'z-other' ? '' : counted.length ? `${counted.filter(isDone).length}/${counted.length}` : '';
    // follow-ups (and their follow-ups) go under their quest, one step further in per level
    // a folded quest hides its follow-ups (they show as a stack behind it)
    const kidsOf = (q, d = 1) => folded(q) ? [] : S.quests.filter(c => c.parent === q.id).flatMap(c => [{ q:c, d }, ...kidsOf(c, d + 1)]);
    const cells = [];
    rowCells(groupRows(g.key, g.list), false).forEach(c => { cells.push(c); if (c.q) kidsOf(c.q).forEach(k => cells.push({ q:k.q, w:true, kid:k.d })); });
    return { g, time, ends, counted, cnt, cells, tiles:flatCells(cells) };   // cells: what the board draws (a List and its column is one cell) · tiles: the same, one tile each
  });
}
// one tile on the board: the wrapper that every tap and hold looks for (.qb-item[data-id]) around the tile
function qbItem(t, extra = ''){
  const fresh = freshTile.id === t.q.id ? ' fresh' : '';
  return `<div class="item qb-item${t.w ? ' wide' : ''}${t.kid ? ' fol' : ''}${folded(t.q) ? ' qb-stacked' + (kidCount(t.q) > 1 ? ' qb-stacked2' : '') : ''}${fresh}${extra}" data-id="${t.q.id}"${t.kid ? ` style="--fd:${Math.min(t.kid, 4)}"` : ''}>${foldBtn(qbTile(t.q, t.w), t.q)}</div>`;
}
// a row built around a half List: two columns of tiles, each as tall as its own tiles
function qbStack(c){
  return `<div class="qb-stk">${c.cols.map(col => `<div class="qb-col">${col.map(q => qbItem({ q, w:false })).join('')}</div>`).join('')}</div>`;
}
function questBoard(){
  const html = boardSections().map(({ g, time, cnt, cells }) =>
    `<section class="qb-g${g.key === 'a-due' ? ' due' : ''}"><div class="qb-gh"><b>${g.title}</b>${time ? `<span class="qb-time">${ico('i-hourglass','0 0 16 16')}${time}</span>` : ''}</div>
      <div class="qb-grid">${cells.map(c => c.gap ? '<div class="qb-gap"></div>' : c.stk ? qbStack(c) : qbItem(c)).join('')}</div></section>`).join('');
  return `<div class="qb">${updateBanner()}${S.vacation ? '<div class="vac-note">Vacation mode · streaks paused</div>' : ''}${qbSummary()}${html}</div>`;
}


function initBoard(){
  // press and hold a tile to edit it
  const HOLD = '.qb-item, [data-holdedit]';
  onHold($('#panel'), { ms:500, start: e => { const it = e.target.closest(HOLD); return it && !e.target.closest('input') ? it : null; },
    onHold: it => openSheet(it.dataset.id || it.dataset.holdedit), noMenu: e => !!e.target.closest(HOLD), swallow: e => !!e.target.closest(HOLD) });
}
