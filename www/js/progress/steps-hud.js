/* Progress tab: Steps HUD (goal streak, daily bars). */
/*    Today panel, a week of segment columns (red segment = the goal line; gold column = goal hit, tap to
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
  // one segment per 1,000 steps; the goal's segment is red
  // 14 segments of 1,000 steps each; 14,000+ fills the column
  const N = 14, segOf = v => v > 0 ? Math.min(N, Math.floor(v / 1000) + 1) : 0, gi = goal ? Math.min(N - 1, Math.floor(goal / 1000)) : -1;
  const short = v => v >= 10000 ? (Math.floor(v / 100) / 10) + 'k' : fmt(v);
  const cols = days.map((t, i) => {
    const v = vals[i], k = dayKey(t), fut = ti >= 0 && i > ti, n = segOf(v);
    const met = q && goal && v >= goal, due = met ? goalDue(q, k, v) : 0, paid = met && !due, bonus = met && (q.goalXp || q.goalGold);
    const cls = fut ? 'fut' : met ? (bonus && !paid ? 'gold' : 'green') : 'on';
    const act = met && bonus && !paid && !fut ? ` data-act="goalclaim" data-q="${q.id}" data-day="${k}"` : '';
    // goal hit and claimed: a light band runs up the lit segments (--s height, --c day)
    const segs = Array.from({ length:N }, (_, s) => `<i class="${s < n ? cls : ''}${s === gi ? ' goal' : ''}"${s < n && cls === 'green' ? ` style="--s:${s}"` : ''}></i>`).join('');
    // while a 2×+ goal bonus waits, the day name gives way to its ×N (back to the day once claimed)
    const m = act ? due : 1, dn = m > 1 ? `<span class="sh-d sh-xn"><small>×</small>${m}</span>` : `<span class="sh-d">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>`;
    return `<div class="sh-col${act ? ' tap' : ''}${i === ti ? ' td' : ''}${cls === 'green' ? ' met' : ''}"${act}><span class="sh-v">${fut ? '' : short(v)}</span><div class="sh-segs">${segs}</div>${dn}</div>`;
  }).join('');
  const fd = t => new Date(t).toLocaleDateString(undefined, { month:'short', day:'numeric' });
  // an unclaimed goal bonus in an earlier week: the ‹ arrow glows like the Steps tab
  const olderGoal = q && goalDays(q).some(k => k < dayKey(days[0])), newerGoal = q && weekOffset > 0 && goalDays(q).some(k => k > dayKey(days[6]));   // gold arrows: a goal bonus waits in an older / a newer week
  // one row per day, today at the top
  const rows = q ? days.filter((t, i) => ti < 0 || i <= ti).reverse().map(t => {   // newest first
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
    <div class="hud"><div class="hud-bar"><span class="hud-wk"><button data-act="wk-prev" aria-label="Previous week"${olderGoal ? ' class="s"' : ''}>‹</button>// WEEK · ${fd(days[0]).toUpperCase()} – ${fd(days[6]).toUpperCase()}<button data-act="wk-next" aria-label="Next week"${weekOffset === 0 ? ' disabled' : newerGoal ? ' class="s"' : ''}>›</button></span><span>AVG ${fmt(avg)}</span></div>
      <div class="sh-cols">${cols}</div>
      ${q && (q.goalXp || q.goalGold) ? `<div class="hud-note"><i class="g"></i>Goal hit · tap to claim <i class="gr"></i>Claimed <i class="rd"></i>Goal</div>` : ''}</div>
    ${q ? `<div class="hud"><div class="hud-bar"><span>// RECORD</span><span class="hud-rate">${rewPair(q.xpPer, q.goldPer, fmt)}PER ${fmt(q.chunk)} STEPS</span></div>${rows}</div>` : `<div class="empty">Post a Steps quest to start earning rewards for walking.</div>`}
    <div class="hud"><div class="hud-bar"><span>// ALL-TIME</span></div>
      <div class="sh-row2"><div><b data-act="stepsexact">${stepsExact ? fmt(all) : bigNum(all)} steps</b></div><span class="sh-rw" data-act="distunit">${S.distUnit === 'mi' ? fmt(Math.round(allKm / 1.609344 * 100) / 100) + ' mi' : fmt(Math.round(allKm * 100) / 100) + ' km'}</span></div></div>
  </div>`;
}
