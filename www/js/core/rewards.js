/* Giving and taking rewards: grant, celebrate, take/give, Earned today bookkeeping, level info. */
function levelInfo(total){ let L = 1, r = Math.min(XP_CAP, Math.max(0, +total || 0)); while (r >= xpToNext(L)) { r -= xpToNext(L); L++; } return { L, into:r, need:xpToNext(L) }; }
// Earned today (Quests summary) and where it came from (its (i) panel).
// S.today.src: one row per source { k, n, kind, xp, gold, c (claims), parts, days, amt }; untagged rewards show as "Earlier today".
var earnTag = null;   // set just before grant() / give() to say where the reward came from (cleared after)
const qTag = (q, extra) => q ? Object.assign({ k:'q:' + q.id, n:q.name, kind:q.kind }, extra) : null;
function stepsTag(q, key){ return key === dayKey() ? { k:'st:today', n:'Today', kind:'steps' } : { k:'st:early', n:'Earlier days', kind:'steps', day:key }; }
function bumpToday(xp, gold, tag){
  const k = dayKey(); if (!S.today || S.today.day !== k) S.today = { day:k, xp:0, gold:0, src:[] };
  S.today.xp = Math.max(0, S.today.xp + xp); S.today.gold = Math.max(0, S.today.gold + gold);
  if (!(xp || gold) || !tag) return;
  const L = Array.isArray(S.today.src) ? S.today.src : (S.today.src = []);
  let r = L.find(x => x.k === tag.k);
  if (!r){ if (xp < 0 || gold < 0) return; r = { k:tag.k, n:tag.n, kind:tag.kind, xp:0, gold:0, c:0 }; L.push(r); }
  if (tag.n) r.n = tag.n;
  const up = xp > 0 || gold > 0;
  r.xp = Math.max(0, r.xp + xp); r.gold = Math.max(0, r.gold + gold); r.c = Math.max(0, r.c + (up ? 1 : -1));
  if (tag.part){ r.parts ||= []; if (up){ if (!r.parts.includes(tag.part)) r.parts.push(tag.part); } else r.parts = r.parts.filter(x => x !== tag.part); }
  if (tag.day){ r.days ||= []; if (up){ if (!r.days.includes(tag.day)) r.days.push(tag.day); } else r.days = r.days.filter(x => x !== tag.day); }
  if (tag.amt) r.amt = round2(Math.max(0, (r.amt || 0) + (up ? tag.amt : -tag.amt)));
  if (tag.lv){ r.lv = up ? [Math.min((r.lv || tag.lv)[0], tag.lv[0]), Math.max((r.lv || tag.lv)[1], tag.lv[1])] : r.lv; }
  if (r.xp <= 0 && r.gold <= 0) S.today.src = L.filter(x => x !== r);
}
// a reward from several sources at once (Claim all steps): list of { tag, xp, gold }
function bumpParts(parts){ parts.forEach(p => bumpToday(p.xp, p.gold, p.tag)); }
// QUIET: true while replaying widget taps on open: no effects, just the new state drawn once
var QUIET = false;
function grant(reward, rect, freshId, freshRow, power, wait){   // wait: ms before the reward flies (e.g. Tally's bar laps); saved at once either way
  reward.xp = Math.round(Math.min(REWARD_CAP, Math.max(0, +reward.xp || 0)));
  reward.gold = Math.round(Math.min(REWARD_CAP, Math.max(0, +reward.gold || 0)));
  if (S.xp + reward.xp > XP_CAP) reward.xp = Math.max(0, XP_CAP - S.xp);
  if (S.gold + reward.gold > GOLD_CAP) reward.gold = Math.max(0, GOLD_CAP - S.gold);
  const oldL = levelInfo(S.xp).L;
  // where it came from: what the caller said (earnTag), else the quest it's for
  const tag = earnTag || (freshId && byId(freshId) ? qTag(byId(freshId), byId(freshId).kind === 'pair' && freshRow ? { part:freshRow === 'bonus' ? 'bonus' : (itemOf(byId(freshId), freshRow) || {}).name } : null) : null);
  earnTag = null;
  if (Array.isArray(tag)) bumpParts(tag); else bumpToday(reward.xp, reward.gold, tag);
  S.xp += reward.xp; S.gold += reward.gold;
  const newL = levelInfo(S.xp).L;
  let lvGold = 0, lvTix = 0; const L0 = Math.max(oldL, S.rewardedLevel || 1);
  for (let L = L0 + 1; L <= newL; L++){ lvGold += levelReward(L); lvTix++; }   // every level also gives a Den ticket
  if (newL > (S.rewardedLevel || 1)) S.rewardedLevel = newL;
  S.gold += lvGold;
  if (lvGold) bumpToday(0, lvGold, { k:'lv', n:'Level up', lv:[L0, newL] });
  const paid = reward.xp > 0 || reward.gold > 0;
  const tixGot = lvTix && window.PsychDen ? PsychDen.add(lvTix) : 0;   // saved now; the header count rolls when the flying ticket lands
  save();
  if (QUIET){ if (tixGot) PsychDen.land(tixGot); return; }
  freshTile = { id:freshId, row:freshRow || null };
  if (lvGold) renderHeader.lvHold = (renderHeader.lvHold || 0) + lvGold;   // two separate sequences: the quest's gold goes to the purse now, the level-up gold when its own coins land
  if (paid || lvGold) renderHeader.tween = true;
  if (newL > oldL) renderHeader.fillFull = true;
  const holdXp = paid && rect && reward.xp > 0;     // the gems will deliver the XP, so the bar waits for them
  if (wait && paid){
    // header keeps the old numbers until the show starts; then it runs exactly like a normal claim
    renderHeader.holdAll = true; render();
    setTimeout(() => {
      renderHeader.holdAll = false;
      const r = (typeof rect === 'function' ? rect() : rect) || null;
      if (holdXp) renderHeader.hold = true; renderHeader(); renderHeader.hold = false;
      celebrate.lite = true; celebrate(reward, r, freshId, power, newL, oldL, paid);
    }, wait);
    if (newL > oldL) setTimeout(() => hdrLevelUp(newL, lvGold, tixGot), wait + 1050);
    return;
  }
  if (holdXp){ renderHeader.hold = true; }
  render();
  renderHeader.hold = false;
  requestAnimationFrame(() => celebrate(reward, rect, freshId, power, newL, oldL, paid));

  if (newL > oldL) setTimeout(() => hdrLevelUp(newL, lvGold, tixGot), 1050);
}
function celebrate(reward, rect, freshId, power, newL, oldL, paid){
  if (QUIET) return;
  { const h = document.documentElement; h.classList.add('busy'); clearTimeout(celebrate.bt); celebrate.bt = setTimeout(() => h.classList.remove('busy'), 1300); }   // background loops rest while the claim plays
  const swirl = celebrate.swirl; celebrate.swirl = false;
  const lite = celebrate.lite; celebrate.lite = false;
  if (paid && lite && rect){   // after Tally's fill-up: just the coins and gems flying to the purse
    if (reward.gold > 0) flyCoins(rect, reward.gold);
    if (reward.xp > 0){ flyGems(rect, reward.xp); renderHeader.delay = 780; renderHeader(); }
    return;
  }
  if (paid && swirl && rect){   // small claims (goal coin): a swirl on the spot, then the reward flies to the purse
    FX.swirl(...rectMid(rect));
    if (reward.gold > 0) flyCoins(rect, reward.gold);
    if (reward.xp > 0){ floatText(rect, `+${reward.xp} XP`); flyGems(rect, reward.xp); renderHeader.delay = 780; }
    if (reward.gold > 0) setTimeout(() => floatText(rect, `+${reward.gold} gold`, 'gold'), 160);
    if (renderHeader.delay) renderHeader();
    return;
  }
  if (paid){
    // light sweep over the card you just claimed
    let card = freshId && document.querySelector(`.item[data-id="${freshId}"] > .card`);
    if (!card && rect){ const hit = document.elementFromPoint(...rectMid(rect)); card = hit && hit.closest('.card'); }
    if (card) racingEdge(card);
    if (rect){
      const pw = power || 1 + Math.min(1.2, (reward.xp + reward.gold) / 90);
      FX.burst(...rectMid(rect), pw);
      if (reward.gold > 0) flyCoins(rect, reward.gold);
      if (reward.xp > 0){ floatText(rect, `+${reward.xp} XP`); flyGems(rect, reward.xp); renderHeader.delay = 780; }
      if (reward.gold > 0) setTimeout(() => floatText(rect, `+${reward.gold} gold`, 'gold'), 160);
    }
    if (renderHeader.delay) renderHeader();
  }
}
function take(r, tag){
  if (!QUIET && (r.xp > 0 || r.gold > 0)) undoFly(r, tag);
  bumpToday(-r.xp, -r.gold, tag);
  const oldL = levelInfo(S.xp).L;
  S.xp = Math.max(0, S.xp - r.xp);
  S.gold -= r.gold;
  const newL = levelInfo(S.xp).L, paidTo = S.rewardedLevel || 1;
  let lv = 0;
  for (let L = newL + 1; L <= Math.min(oldL, paidTo); L++) lv += levelReward(L);
  S.gold -= lv; if (lv) bumpToday(0, -lv, { k:'lv' });
  if (lv && window.PsychDen) PsychDen.take(Math.max(0, Math.min(oldL, paidTo) - newL));   // the level tickets go back too
  if (paidTo > newL) S.rewardedLevel = newL;
}
// opposite of take(): returns a reward quietly, paying level rewards reached again
function give(r, tag){
  const xp = +r.xp || 0, gold = +r.gold || 0;
  bumpToday(xp, gold, tag);
  S.xp = Math.min(XP_CAP, S.xp + xp); S.gold += gold;
  const L = levelInfo(S.xp).L, L0 = S.rewardedLevel || 1;
  let lv = 0;
  for (let k = L0 + 1; k <= L; k++) lv += levelReward(k);
  S.gold += lv; if (lv) bumpToday(0, lv, { k:'lv', n:'Level up', lv:[L0, L] });
  if (L > L0 && window.PsychDen) PsychDen.gain(L - L0);
  if (L > (S.rewardedLevel || 1)) S.rewardedLevel = L;
}
