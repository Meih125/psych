/* Progress tab: streak hero card, calendar, live undo, quest detail. */
/*    A big card with the current streak and a flame that grows with it (6 looks), three counters,
   a month calendar in the flame's colour, and recent claims. Records keep their line chart. */
function flameSvg(t, size, mid){ // t = streak tier 0..5; mid = grow from the middle (lined up in a row), not from the base
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
  <g transform="translate(32 ${mid ? 34 : 60}) scale(${scale}) translate(-32 -${mid ? 34 : 60})">
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
    const t = new Date(y, mo, d).getTime(), k = dayKey(t), o = map[k]; if (o && o.n) n++;
    let c = '';
    if (o){ if (q.kind === 'pair'){ const m = listKeys(q).filter(x => o['p_' + x]).length; c = m >= listKeys(q).length ? (o.bonus ? 'on bonus' : 'on') : m ? 'split' : (o.bonus ? 'on bonus' : ''); }
      else if (q.kind === 'scaling') c = 'on s' + Math.min(3, o.n); else c = o.slip ? 'slip' : 'on'; }
    if (t > startOfDay()) c += ' fut'; if (k === today) c += ' td'; if (k === selDay) c += ' sel';
    cells += `<button class="hx-c ${c}" data-act="hday" data-day="${k}">${d}</button>`;
  }
  const title = m0.toLocaleDateString(undefined, { month:'long' }) + (y !== base.getFullYear() ? ' ' + y : '');
  return `<div class="hx-card"><div class="hx-h"><span>${title}</span><small>${n} ${n === 1 ? 'day' : 'days'}</small>
      <div class="hx-nav"><button data-act="mo-prev" aria-label="Previous month">‹</button><button data-act="mo-next" aria-label="Next month"${monthOffset === 0 ? ' disabled' : ''}>›</button></div></div>
    <div class="hx-cal" style="--tc:${tc[0]};--tcr:${tc[1]}">${cells}</div>
    ${q.kind === 'pair' ? `<div class="hx-leg"><span><i class="hx-c on bonus"></i>All · bonus</span><span><i class="hx-c split"></i>Some done</span></div>` : ''}
    ${dayInfo(q, map)}</div>`;
}
// Undo on a Recent row: only for a claim that can still be reopened (same as tapping its done tile)
const UNDO_OFF = '<button class="hx-undo" disabled>Undo</button>';
function undoBtn(q, e, i){ return undoLive(q, e, i) || UNDO_OFF; }
// the newest real claim (back-claims can't be undone here)
const topClaim = (q, e, i) => !e.back && (i === 0 || !allLogs(q).sort((a, b) => (b.at || b.t) - (a.at || a.t)).slice(0, i).some(x => !x.back && !x.slip));
function undoLive(q, e, i){
  // an auto-claimed Avoid day: "Slipped?" breaks the streak there (only inside the current streak)
  if (e.auto) return `<button class="hx-undo" data-act="autoslip" data-q="${q.id}" data-t="${e.t}">Slip?</button>`;   // always available
  if (e.slip) return slippedToday(q) && q.slipUndo && (q.slips || []).slice(-1)[0] === e.t ? `<button class="hx-undo" data-act="unslip" data-q="${q.id}">Undo</button>` : '';
  if (e.back) return `<button class="hx-undo" data-act="undoback" data-q="${q.id}" data-t="${e.t}" data-at="${e.at || 0}" data-w="${e.bonus ? '' : esc(e.what || '')}">Undo</button>`;
  if (topClaim(q, e, i) && q.kind === 'scaling' && q.week === periodStart(q) && q.weekClaims > 0 && e.t >= q.week)
    return `<button class="hx-undo" data-act="lastundo" data-q="${q.id}">Undo</button>`;
  if (topClaim(q, e, i) && (q.kind === 'tally' || q.kind === 'counter')) return `<button class="hx-undo" data-act="lastundo" data-q="${q.id}">Undo</button>`;
  if (q.kind === 'pair'){
    const last = h => { const r = itemOf(q, h); return r && r.log && r.log.length ? r.log[r.log.length - 1].t : 0; };
    let k = e.bonus ? null : listKeys(q).find(h => itemOf(q, h).name === e.what && last(h) === e.t) || null;
    // the bonus row: undoing the quest claimed last takes the bonus back with it
    if (e.bonus && q.bonusLog && q.bonusLog.length && q.bonusLog[q.bonusLog.length - 1].t === e.t && q.bonusUntil > now()) k = listKeys(q).reduce((a, h) => last(h) > last(a) ? h : a);
    const r = k && itemOf(q, k);
    return r && r.undo && r.until > now() ? `<button class="hx-undo" data-act="hxundo" data-q="${q.id}" data-k="${k}">Undo</button>` : '';
  }
  if (!topClaim(q, e, i) || !['standard','target','avoid','bounty'].includes(q.kind) || !q.undo || !isDone(q)) return '';
  return `<button class="hx-undo" data-act="hxundo" data-q="${q.id}">Undo</button>`;
}
function questHero(q){
  const map = dayMap(q), logs = allLogs(q).sort((a, b) => (b.at || b.t) - (a.at || a.t));
  const xp = logs.reduce((a, e) => a + (e.xp || 0), 0), gold = logs.reduce((a, e) => a + (e.gold || 0), 0);
  let k, big, unit, sub, tier = 0, art;
  if (hasStreak(q)){
    const n = streakNow(q), best = Math.max(q.bestStreak || 0, n), m = streakReward(q) ? streakMult(n) : 1;
    tier = flameTier(n); k = q.kind === 'pair' ? 'Full-list streak' : q.kind === 'avoid' ? 'Days clean' : q.kind === 'target' ? 'Targets hit in a row' : 'Current streak'; big = fmt(n);
    unit = q.kind === 'target' ? (n === 1 ? 'time' : 'times') : n === 1 ? 'day' : 'days';
    if (q.kind === 'avoid') q.best = Math.max(q.best || 0, n);
    sub = `Best ${fmt(q.kind === 'avoid' ? q.best : best)}${q.kind === 'avoid' && (q.slips || []).length ? ` · slipped ${q.slips.length}×` : ''}${m > 1 ? ` · <span style="white-space:nowrap"><b style="color:${tierCol(tier)[0]}">+${Math.round((m - 1) * 100)}%</b> reward</span>` : ''}`; art = flameSvg(tier, 64);
  } else if (q.kind === 'scaling'){
    const w = weekClaims(q); tier = -1; k = `This ${periodOf(q) === 1 ? 'day' : periodWord(q)}`; big = '×' + w; unit = '';
    sub = `Next claim pays ${scaledReward(q, w + 1).xp} XP · resets ${new Date(periodEnd(q)).toLocaleDateString(undefined, { weekday:'short' })}`; art = `<div class="hx-ic">${qbIcon(q)}</div>`;
  } else if (q.kind === 'counter'){
    tier = -3; k = 'Times done'; big = fmt(q.count || 0); unit = ''; sub = `Today ${counterToday(q)}`; art = `<div class="hx-ic">${qbIcon(q)}</div>`;
  } else {   // tally
    tier = -2; k = 'Total'; big = fmtU(q, q.total || 0); unit = ''; sub = q.carry ? `${fmtU(q, q.carry)} carried over` : `${fmt(logs.length)} entries`;
    art = `<div class="hx-ic">${qbIcon(q)}</div>`;
  }
  const tc = tier === -1 ? ['#ff7a7a', '255,122,122'] : tier === -2 ? ['#ffc94a', '255,201,74'] : tier === -3 ? ['#4dd0a0', '77,208,160'] : tierCol(tier);   // recurring / tally = their type colour, streaks = flame colour
  const kp = q.kind === 'pair'
    ? [['Quests', listKeys(q).length], ['Claimed', fmtShort(listItems(q).reduce((a, r) => a + (r.count || 0), 0)) + '×'], ['Bonus', fmtShort(q.bonusCount || 0) + '×', 't']]
    : q.kind === 'counter' ? [['Today', fmtShort(counterToday(q))], ['XP earned', fmtShort(xp), 'x'], ['Gold', fmtShort(gold), 'g']]
    : [['Total', fmtShort(logs.filter(e => !e.slip).length)], ['XP earned', fmtShort(xp), 'x'], ['Gold', fmtShort(gold), 'g']];   // big numbers shortened (12.34M) so they fit
  return `<div class="hx" style="--tc:${tc[0]};--tcr:${tc[1]}">
    <div class="hx-hero"><div><div class="hx-k">${k}${hasStreak(q) && streakReward(q) ? streakInfo() : ''}</div><div class="hx-big">${big}${unit ? `<small>${unit}</small>` : ''}</div><div class="hx-sub">${sub}</div></div><div class="hx-art">${art}</div></div>
    <div class="hx-kp">${kp.map(([l, v, c]) => `<div><span>${l}</span><b class="${c || ''}">${v}</b></div>`).join('')}</div>
    ${heroCal(q, map, tc)}
    <div class="hx-card"><div class="hx-h"><span>Recent</span></div>
      ${logs.length ? (() => { const rows = logs.slice(0, 8), ub = rows.map((e, i) => { const h = undoBtn(q, e, i); return q.kind === 'avoid' ? h.replace('class="hx-undo"', 'class="hx-undo w"') : h; });
        return rows.map((e, i) => `<div class="hx-log"><div class="hx-lt"><b>${esc(e.what)}</b><small>${dayLabel(e.t)} · ${new Date(e.t).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' })}</small></div>${e.slip ? '<span class="hx-slipt">Count reset</span>' : qbRew(e.xp || 0, e.gold || 0)}${ub[i]}</div>`).join(''); })() : '<div class="dayinfo">Nothing claimed yet.</div>'}
    </div></div>`;
}
