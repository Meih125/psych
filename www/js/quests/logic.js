/* Shared quest rules: lookups, cycles and periods, streaks, claiming and undo. */
const byId = id => S.quests.find(q => q.id === id);
const parentOf = q => (q.parent ? byId(q.parent) : null);
// only tracked quests get a history page in Progress (records are tracked unless turned off)
// every quest has a Progress page; the list button on the Progress tab can hide some from the chip row
const isTracked = q => q.kind === 'steps' || !(S.progHide && S.progHide[q.id]);
const showsCount = q => !isTracker(q) && q.kind !== 'tally' && q.showCount !== false;
function isDone(q){
  const t = now();
  if (q.kind === 'pair') return listItems(q).every(r => r.until > t);
  if (q.kind === 'scaling' || q.kind === 'counter' || isTracker(q)) return false;
  if (q.kind === 'record' && q.noReset) return false;   // no reset: any number of entries, any time
  return q.doneUntil > t;
}
// Target: its own countdown (Resets every N days). A new cycle starts when the old one runs out.
function targetRoll(q){
  if (q.kind !== 'target') return;
  if (!q.cycleEnd || now() >= q.cycleEnd){ q.cycleEnd = cycleAfter(startOfDay(), q.days || 1); q.hits = 0; }
}
// Avoid: whole days clean since the start (the start day counts once it has passed)
const daysClean = q => q.since ? Math.max(0, Math.round((startOfDay() - q.since) / 864e5)) : 0;
const slippedToday = q => q.kind === 'avoid' && q.slipDay === dayKey();
// Bounty: days until it's due (0 = today, negative = overdue); urgent from 1 day before
const dueIn = q => Math.round((q.due - startOfDay()) / 864e5);
const bountyUrgent = q => q.kind === 'bounty' && !isDone(q) && dueIn(q) <= 1;
function isVisible(q, d = 0){ const p = parentOf(q); return !p || d > 50 || (isVisible(p, d + 1) && isDone(p)); }
// An unclaimed quest's cycle keeps running; when it ends a new full one starts.
function rollEndOf(q){ if (!(q.rollEnd > now())) q.rollEnd = cycleAfter(startOfDay(), cycleDays(q)); return q.rollEnd; }
function cycleEndFor(q){ if (q.kind === 'target'){ targetRoll(q); return q.cycleEnd; } const p = parentOf(q); return p ? p.doneUntil : cycleAfter(startOfDay(), q.days || 1); }
// Recurring quests reset every q.period days (7 = Monday to Monday, the original behaviour)
const periodOf = q => q.period || 7;
function periodStart(q){
  if (periodOf(q) === 7) return weekStart();
  if (periodOf(q) === MONTHLY) return monthStart();
  if (periodOf(q) === 14) return biStart();
  return q.week && now() < addDays(q.week, periodOf(q)) ? q.week : startOfDay();
}
const periodEnd = q => periodOf(q) === 7 ? nextMonday() : periodOf(q) === MONTHLY ? addMonths(now(), 1) : periodOf(q) === 14 ? addDays(biStart(), 14) : addDays(periodStart(q), periodOf(q));
const periodWord = q => periodOf(q) === 7 ? 'week' : periodOf(q) === 1 ? 'day' : periodOf(q) === MONTHLY ? 'month' : periodOf(q) === 14 ? '2 weeks' : `${periodOf(q)} days`;
const weekClaims = q => (q.week === periodStart(q) ? q.weekClaims : 0);
function scaledReward(q, n){ const f = Math.pow(1 + (q.growth || 0) / 100, Math.max(0, n - 1)); return { xp:Math.min(REWARD_CAP, Math.round(q.xp * f)) || 0, gold:Math.min(REWARD_CAP, Math.round(q.gold * f)) || 0 }; }
const round2 = v => Math.round(v * 100) / 100;
// Trackers (Steps and Tally) share one engine. Steps reads the synced step counts;
// a Tally keeps its own numbers that you type in (money, pages, pushups...).
const isTracker = q => q.kind === 'steps';
var GOAL_BONUS = 20;   // default XP and gold for reaching the daily step goal
const valsOf = () => S.steps;   // the Steps quest's numbers (Tally keeps its own total / carry / log)
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
const firstSteps = () => S.quests.find(q => q.kind === 'steps');
/*    Regular quests and pairs keep a streak: done in every cycle in a row (daily, 2-day, 3-day…).
   Each full 5 in the streak adds ×0.1 to the reward: streak 1–5 ×1, 6–10 ×1.1, 11–15 ×1.2 … (always rounded down). */
const hasStreak = q => q.kind === 'standard' || q.kind === 'pair' || q.kind === 'target' || q.kind === 'avoid';   // these keep a streak
const streakReward = q => hasStreak(q) && q.showCount !== false;           // "Streak reward" in the quest form
const cycleDays = q => { const p = parentOf(q); return (p ? p.days : q.days) || 1; };
function streakLast(q){ return q.kind === 'pair' ? q.lastBoth : q.doneUntil; }        // end of the last completed cycle
function streakNow(q){
  if (!hasStreak(q)) return 0;
  if (q.kind === 'avoid') return slippedToday(q) ? 0 : daysClean(q);                  // avoid: the streak is the days clean
  const last = streakLast(q), t = now();
  if (!last || !q.streak) return 0;
  return t < addDays(cycleAfter(last, cycleDays(q)), vacationDays(last, t)) ? q.streak : 0;      // a whole cycle missed = streak lost (vacation days don't count)
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
function claimQuest(q, rect){
  if (!isVisible(q)) return;   // a follow-up stays locked until its quest is done
  if (q.kind === 'scaling') claimScaling(q, rect);
  else if (q.kind === 'counter') claimCounter(q, rect);
  else if (q.kind === 'target' && (targetRoll(q), (q.hits || 0) < q.need)) targetHit(q, 1, rect);
  else if (q.kind === 'bounty') claimBounty(q, rect);
  else claimStandard(q, rect);
}
function claimStandard(q, rect){
  if (isDone(q)) return;
  buyUndo = null;
  const R = boosted(q, q.xp, q.gold);
  q.undo = { xp:R.xp, gold:R.gold, prevUntil:q.doneUntil, prevStreak:q.streak || 0 };
  logClaim(q.log ||= [], R.xp, R.gold);
  q.streak = R.n; q.bestStreak = Math.max(q.bestStreak || 0, q.streak);
  q.doneUntil = cycleEndFor(q);
  q.count++;
  grant({ xp:R.xp, gold:R.gold }, rect, q.id);
}
function claimScaling(q, rect){
  buyUndo = null;
  const ws = periodStart(q);
  if (q.week !== ws){ q.week = ws; q.weekClaims = 0; }
  const reward = scaledReward(q, q.weekClaims + 1);
  q.weekClaims++; q.count++;
  logClaim(q.log ||= [], reward.xp, reward.gold);
  grant(reward, rect, q.id, null, Math.min(2.6, .9 + q.weekClaims * .35));
}
// Counter: flat reward per tap, no reset; q.count = lifetime total
function claimCounter(q, rect){
  buyUndo = null;
  q.count = (q.count || 0) + 1;
  logClaim(q.log ||= [], q.xp, q.gold);
  grant({ xp:q.xp, gold:q.gold }, rect, q.id, null, 1.1);
}
function counterToday(q){ const a = startOfDay(), b = addDays(a, 1); let n = 0; for (const e of q.log || []) if (e.t >= a && e.t < b) n++; return n; }   // plain time compare (no date text per entry)
// Records pay one reward per full "step" beyond the point already paid for,
// so 0.5 kg steps never lose the leftover between entries.
// Record: the next paid milestone is one step past the last paid line
function recNext(q){
  if (q.best == null) return null;
  const ref = q.paidTo ?? q.best;
  return round2(q.better === 'lower' ? ref - q.step : ref + q.step);
}
function recSub(q){
  const n = recNext(q), u = esc(q.unit), dir = q.better === 'lower' ? 'lower' : 'higher';
  return n == null ? `per ${fmt(q.step)} ${u} from your first entry` : `per ${fmt(q.step)} ${u} ${dir} · next ${fmt(n)} ${u}`;
}
function submitRecord(q, input, rect){
  if (!isVisible(q)) return;
  const v = round2(parseFloat(input.value));
  if (!isFinite(v) || v <= 0 || v > VALUE_CAP){ shake(input); return; }
  input.value = ''; if (input.blur) input.blur();   // the box is empty (and the keyboard closes) once it is recorded
  buyUndo = null;
  const prevBest = q.best, prevPaid = q.paidTo, lower = q.better === 'lower';
  q.entries.push({ t:now(), v });
  q.count++;
  q.doneUntil = cycleEndFor(q);
  let reward = { xp:0, gold:0 };
  if (q.best == null){
    q.best = v; q.paidTo = v;   // the first entry is the starting point
  } else if (lower ? v < q.best : v > q.best){
    const ref = q.paidTo ?? q.best, gain = round2(lower ? ref - v : v - ref);
    const units = Math.floor(gain / q.step + 1e-9);
    if (units > 0){
      reward = { xp:units * q.xpPer, gold:units * q.goldPer };
      q.paidTo = round2(lower ? ref - units * q.step : ref + units * q.step);
    }
    q.best = v;
  }
  q.undo = { prevBest, prevPaid, xp:reward.xp, gold:reward.gold };
  grant(reward, rect, q.id);
}
function dueTotals(q){
  const today = dayKey(), keys = Object.keys(valsOf(q)).filter(k => k <= today && stepDue(q, k).units > 0);   // never a day that hasn't happened yet
  return { keys, xp:keys.reduce((a, k) => a + stepDue(q, k).xp, 0), gold:keys.reduce((a, k) => a + stepDue(q, k).gold, 0) };
}
// take back what was already paid for one day of steps (it can be claimed again afterwards)
// undo the latest Recurring claim (this period) or the latest Tally entry
async function undoLast(q){
  const e = q.log && q.log[q.log.length - 1]; if (!e) return;
  const what = q.kind === 'tally' ? `the ${fmtU(q, e.v || 0)} entry` : 'the latest claim';
  if (!await ask(`Undo ${what}?`, 'Its reward will be taken back.', 'Undo')) return;
  take({ xp:e.xp || 0, gold:e.gold || 0 }, qTag(q, q.kind === 'tally' ? { amt:e.v || 0 } : null)); q.log.pop(); q.count = Math.max(0, (q.count || 0) - 1);
  if (q.kind === 'scaling') q.weekClaims = Math.max(0, (q.weekClaims || 0) - 1);
  if (q.kind === 'tally'){
    const v = e.v || 0, units = q.xpPer ? Math.round((e.xp || 0) / q.xpPer) : q.goldPer ? Math.round((e.gold || 0) / q.goldPer) : 0;
    q.total = Math.max(0, round2((q.total || 0) - v));
    q.carry = e.pc != null ? e.pc : Math.min(q.chunk, Math.max(0, round2((q.carry || 0) + units * q.chunk - v)));
  }
  buyUndo = null; save(); hideToast(); render();
}
async function undoDay(q, key){
  const units = Math.floor((q.paid[key] || 0) / q.chunk); if (!units) return;
  const label = key === dayKey() ? 'today' : dayLabel(new Date(key + 'T00:00'));
  if (!await ask(`Undo steps for ${label}?`, 'Its reward will be taken back. You can claim it again.', 'Undo')) return;
  take({ xp:units * q.xpPer, gold:units * q.goldPer }, stepsTag(q, key)); q.paid[key] = 0;
  buyUndo = null; save(); hideToast(); render();
}
function claimAll(q, rect){
  const t = dueTotals(q);
  if (!t.keys.length) return;
  buyUndo = null;
  earnTag = t.keys.map(k => { const d = stepDue(q, k); return { tag:stepsTag(q, k), xp:d.xp, gold:d.gold }; });
  t.keys.forEach(k => q.paid[k] = valsOf(q)[k]);
  grant({ xp:t.xp, gold:t.gold }, rect, null, null, 1.6);
}
function claimDay(q, key, rect){
  const d = stepDue(q, key);
  if (!d.units) return;
  buyUndo = null;
  earnTag = stepsTag(q, key);
  q.paid[key] = d.steps;
  grant({ xp:d.xp, gold:d.gold }, rect, null);
}
// daily goal bonus: claimed from the gold coin under a day on the Progress chart
// 2× the goal or more pays the bonus that many times (×2, ×3 …) in the one claim
const goalMult = (q, v) => q && q.goal ? Math.max(1, Math.floor(v / q.goal)) : 1;
// onBar (Quests step card): "Goal claimed!" floats up from the button, then the ticket pops on the step bar and flies to the header
function claimGoal(q, key, rect, opts){
  q.goalPaid ||= {};
  if (q.goalPaid[key] || !q.goal || (valsOf(q)[key] || 0) < q.goal) return;
  buyUndo = null;
  q.goalPaid[key] = true;
  const bar = opts && opts.onBar ? document.querySelector('.qb-sum .qb-bar') : null, barR = bar ? bar.getBoundingClientRect() : null;   // read before the redraw
  const m = goalMult(q, valsOf(q)[key] || 0);
  celebrate.swirl = true;   // only the coin swirls
  earnTag = { k:'goal', n:'Goal bonus', kind:'goal', day:key };
  grant({ xp:(q.goalXp || 0) * m, gold:(q.goalGold || 0) * m }, rect, null, null, m > 1 ? 1.4 + Math.min(1.2, m * .15) : 1.4);
  const tg = window.PsychDen ? PsychDen.add(1) : 0;   // a Den ticket pops out of the claimed goal, then flies up with the coins
  const tr = barR || (typeof rect === 'function' ? rect() : rect);
  if (opts && opts.onBar && rect && !QUIET) floatText({ left:rect.left, width:rect.width, top:rect.top - 46, height:rect.height }, 'Goal claimed!', 'big');
  if (tg){ if (QUIET || !tr) PsychDen.land(tg); else setTimeout(() => PsychDen.pop(tr, tg), barR ? 700 : 250); }
}
// Undo takes the reward back (gold may go below zero; a lost level takes its level reward too, paid again on re-reaching it)
// and plays the claim backwards: XP and gold fly from the header back onto the quest.
function undoFly(r, tag){
  renderHeader.tween = true;
  const id = tag && tag.k && tag.k.startsWith('q:') ? tag.k.slice(2) : null;
  setTimeout(() => {
    const it = id && document.querySelector(`#panel .item[data-id="${id}"] .card`), to = it ? it.getBoundingClientRect() : { left:innerWidth / 2 - 40, top:innerHeight / 2, width:80, height:20 };
    const ex = to.left + to.width / 2, ey = to.top + to.height / 2;
    // coins fly from the purse and gems from the XP bar back onto the quest
    if (r.gold > 0){
      const purse = $('#purse svg').getBoundingClientRect(), n = Math.min(6, Math.max(2, Math.ceil(r.gold / 6))), sx = purse.left + purse.width / 2 - 11, sy = purse.top + purse.height / 2 - 11;
      for (let i = 0; i < n; i++){
        const el = document.createElement('div'); el.className = 'fly'; el.innerHTML = ico('i-coin'); document.body.appendChild(el);
        const rx = (Math.random() - .5) * 90, ry = (Math.random() - .5) * 40, tx = ex - 11, ty = ey - 11;
        el.animate([{ transform:`translate(${sx}px,${sy}px) scale(.8)`, opacity:1 }, { transform:`translate(${(sx + tx) / 2 + rx}px,${(sy + ty) / 2 - 50 + ry}px) scale(1.15)`, opacity:1, offset:.65 }, { transform:`translate(${tx}px,${ty}px) scale(.5)`, opacity:0 }], { duration:750, delay:i * 60, easing:'cubic-bezier(.4,0,.55,1)', fill:'both' }).onfinish = () => el.remove();
      }
    }
    if (r.xp > 0){
      const fill = $('#xpFill').getBoundingClientRect(), bar = $('.xpbar').getBoundingClientRect(), n = Math.min(5, Math.max(2, Math.ceil(r.xp / 8)));
      const sx = Math.max(bar.left + 4, Math.min(bar.right - 22, fill.right - 9)), sy = bar.top + bar.height / 2 - 9;
      for (let i = 0; i < n; i++){
        const el = document.createElement('div'); el.className = 'fly gem'; el.innerHTML = ico('i-gem'); document.body.appendChild(el);
        const rx = (Math.random() - .5) * 120, up = 70 + Math.random() * 50, tx = ex - 9, ty = ey - 9;
        el.animate([{ transform:`translate(${sx}px,${sy}px) scale(.7) rotate(${rx > 0 ? 360 : -360}deg)`, opacity:1 }, { transform:`translate(${(sx + tx) / 2 + rx}px,${(sy + ty) / 2 - up}px) scale(1.2) rotate(${rx > 0 ? 160 : -160}deg)`, opacity:1, offset:.62 }, { transform:`translate(${tx}px,${ty}px) scale(.4) rotate(0deg)`, opacity:0 }], { duration:720, delay:i * 55, easing:'cubic-bezier(.45,0,.55,1)', fill:'both' }).onfinish = () => el.remove();
      }
    }
    if (it) it.animate([{ boxShadow:'0 0 0 rgba(255,143,177,0)' }, { boxShadow:'0 0 18px rgba(255,143,177,.45)' }, { boxShadow:'0 0 0 rgba(255,143,177,0)' }], { duration:700, delay:420 });
  }, 30);
}
async function reopen(q, key){
  if (q.kind === 'pair'){
    const r = itemOf(q, key); if (!r) return;
    if (!r.undo || !await ask(`Undo “${r.name}”?`, `Its reward${q.bonusUntil > now() ? ' and the list bonus' : ''} will be taken back.`, 'Undo', 'btn-undo')) return;
    if (isDone(q) && q.streakUndo){ q.streak = q.streakUndo.streak; q.lastBoth = q.streakUndo.lastBoth; q.streakUndo = null; }
    take(r.undo, qTag(q, { part:r.name })); r.count = Math.max(0, r.count - 1); r.until = 0; r.undo = null; if (r.log && r.log.length){ let k = -1; r.log.forEach((e, i) => { if (!e.back && (k < 0 || e.t >= r.log[k].t)) k = i; }); r.log.splice(k < 0 ? r.log.length - 1 : k, 1); }
    if (q.bonusUntil > now() && q.bonusUndo){ take(q.bonusUndo, qTag(q, { part:'bonus' })); q.bonusCount = Math.max(0, q.bonusCount - 1); q.bonusUntil = 0; q.bonusUndo = null; q.bonusLog && q.bonusLog.pop(); }
    if (!listItems(q).some(x => x.until > now())) q.cycleEnd = 0;
    rebuildStreak(q);
  } else if (q.kind === 'record'){
    if (!q.undo || !await ask('Remove your latest entry?', 'Any reward from it will be taken back.', 'Remove')) return;
    take(q.undo, qTag(q)); q.entries.pop(); q.best = q.undo.prevBest; q.paidTo = q.undo.prevPaid; q.count = Math.max(0, q.count - 1); q.doneUntil = 0; q.undo = null;
  } else {
    if (!q.undo || !await ask(`Undo “${q.name}”?`, 'Its reward will be taken back.', 'Undo', 'btn-undo')) return;
    take(q.undo, qTag(q)); q.count = Math.max(0, q.count - 1); q.doneUntil = q.undo.prevUntil; if (q.undo.prevStreak != null) q.streak = q.undo.prevStreak; q.undo = null;
    if (q.log && q.log.length){ let k = -1; q.log.forEach((e, i) => { if (!e.back && (k < 0 || e.t >= q.log[k].t)) k = i; }); q.log.splice(k < 0 ? q.log.length - 1 : k, 1); }   // the live claim, not a late one
    rebuildStreak(q);
    if (q.kind === 'bounty') q.doneAt = 0;
  }
  buyUndo = null; save(); hideToast(); render();
}
// The List bonus is not paid automatically: once every quest is done it becomes its own claim.
function claimPair(q, key, rect){
  if (key === 'bonus') return claimPairBonus(q, rect);
  const t = now(), r = itemOf(q, key);
  if (!r || r.until > t) return;
  buyUndo = null;
  if (!(q.cycleEnd > t)) q.cycleEnd = cycleAfter(startOfDay(), q.days || 1);
  const R = boosted(q, r.xp, r.gold);
  r.until = q.cycleEnd; r.count++;
  r.undo = { xp:R.xp, gold:R.gold };
  logClaim(r.log ||= [], R.xp, R.gold);
  const full = listItems(q).every(x => x.until > t);   // this was the last one on the list
  if (full) pairCompleted(q);
  grant({ xp:R.xp, gold:R.gold }, rect, q.id, key);
}
function claimPairBonus(q, rect){
  const t = now();
  if (!listItems(q).every(r => r.until > t) || q.bonusUntil > t || !(q.bonus && (q.bonus.xp || q.bonus.gold))) return;   // a list without a bonus has nothing to claim
  buyUndo = null;
  const B = boosted(q, q.bonus.xp, q.bonus.gold);
  q.bonusUntil = q.cycleEnd; q.bonusCount++;
  q.bonusUndo = { xp:B.xp, gold:B.gold };
  logClaim(q.bonusLog ||= [], B.xp, B.gold);
  setTimeout(() => { if (rect) floatText({ left:rect.left - 60, top:rect.top - 30, width:rect.width }, 'BONUS!', 'big'); }, 250);
  grant({ xp:B.xp, gold:B.gold }, rect, q.id, 'bonus', 2.2);
}
