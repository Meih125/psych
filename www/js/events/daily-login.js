/* Daily login reward: streak, roll, pop-up. */
/*    Once a day, the gift next to the widgets button: 50% 5 gold + 5 XP, 25% 10 gold, 15% 25 gold, 10% a card
   (any pack, rarity at pack odds, no Rare guarantee). The days the streak flame changes (3, 10, 30, 100) give an SSR,
   day 200 a UR, without saying so (it should feel like luck). Miss a day and it starts over at day 1 (vacation days don't count). After claiming, the gift turns
   into the streak's flame and number.
   S.daily = { at: time of the last claim, streak, pending: the reward until its pop-up is closed (so closing the
   app mid-way never loses it) }. Gold and XP are paid on "tap to continue"; a card is added at once. */
const DL_TICKETS = 2;   // Den tickets for each daily login
const DL_MILESTONE = { 3:'legendary', 10:'legendary', 30:'legendary', 100:'legendary', 200:'ultimate' };
const DL_GIFT = '<svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M4.5 11h15v9.5h-15z"/><path d="M3.5 7.5h17V11h-17z"/><path d="M12 7.5v13"/><path d="M12 7.5C10.5 4 7 3.6 7.2 5.8 7.4 7.4 10.4 7.5 12 7.5zM12 7.5c1.5-3.5 5-3.9 4.8-1.7-.2 1.6-3.2 1.7-4.8 1.7z"/></svg>';
// claimed today? (a claim dated in the future after a clock change counts as today)
const dlClaimed = () => { const a = S.daily && S.daily.at; return !!a && (dayKey(a) === dayKey() || a > now()); };
// the streak as it stands: kept while yesterday (or today) was claimed
function dlStreak(){
  const d = S.daily; if (!d || !d.at || !d.streak) return 0;
  return d.at > now() || now() < addDays(startOfDay(d.at), 2 + vacationDays(d.at, now())) ? d.streak : 0;
}
// same odds as one card in a pack: UR 1.1, SSR 4, SR 10, R 25, C the rest
function dlRarity(){ const o = SHOP[0].odds, r = Math.random() * 100;
  return r < o.ultimate ? 'ultimate' : r < o.ultimate + o.legendary ? 'legendary' : r < o.ultimate + o.legendary + o.epic ? 'epic' : r < o.ultimate + o.legendary + o.epic + o.rare ? 'rare' : 'common'; }
function dlRoll(day){
  if (DL_MILESTONE[day]) return { kind:'card', rarity:DL_MILESTONE[day], milestone:true };
  if (dlRoll.force) return dlRoll.force(day);   // the preview's test bar picks the outcome
  const r = Math.random() * 100;
  return r < 10 ? { kind:'card', rarity:dlRarity() } : r < 25 ? { kind:'gold', gold:25, xp:0 } : r < 50 ? { kind:'gold', gold:10, xp:0 } : { kind:'gold', gold:5, xp:5 };
}
// a card of that rarity from any pack; like packs, a UR or SSR you don't own yet comes first
function dlCard(rarity){
  const decks = SHOP.map(s => s.deck || 'tarot'), pool = POOL[pickFrom(decks)][rarity];
  const missing = rarity === 'ultimate' || rarity === 'legendary' ? pool.filter(c => !ownedCard(c.id)) : [];
  return pickFrom(missing.length ? missing : pool);
}
// the streak number in the same angular chrome lettering as the UR / SSR pop-ups, in the flame's colours
const DL_GLYPH = {
  0:'M15 0H35L43 8V62L35 70H15L7 62V8Z', 1:'M13 13L26 0V70', 2:'M7 8L15 0H35L43 8V27L35 35H15L7 43V70H43',
  3:'M7 8L15 0H35L43 8V27L35 35H20M35 35L43 43V62L35 70H15L7 62', 4:'M33 70V0L7 46V50H43', 5:'M43 0H7V35H35L43 43V62L35 70H15L7 62',
  6:'M43 8L35 0H15L7 8V62L15 70H35L43 62V43L35 35H7', 7:'M7 0H43V8L20 70', 8:'M15 35L7 27V8L15 0H35L43 8V27L35 35H15L7 43V62L15 70H35L43 62V43L35 35',
  9:'M7 62L15 70H35L43 62V8L35 0H15L7 8V27L15 35H43'
};
const DL_COL = [['#9db2b0','#5f7472'],['#7dffb0','#178a4a'],['#9fe2ff','#0b5f9c'],['#ecc2ff','#6b2fa6'],['#ffe08a','#b8430f'],['#fff1c2','#c8242f']];
function streakNum(n, tier, h){
  const txt = String(n), W = 50, gap = 12, w = txt.length * W + (txt.length - 1) * gap + 20, H = 94, id = 'sn' + Math.random().toString(36).slice(2, 7);
  const [c1, c2] = DL_COL[tier], d = [...txt].map((ch, i) => `<path d="${DL_GLYPH[ch]}" transform="translate(${10 + i * (W + gap)} 12)"/>`).join('');
  return `<svg class="dl-num" viewBox="0 0 ${w} ${H}" height="${h}" width="${(h * w / H).toFixed(1)}" style="overflow:visible"><defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".22" stop-color="#ffffff"/><stop offset=".48" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset=".53" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".62" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter></defs>
    <g transform="skewX(-12) translate(10 0)" fill="none" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="4">
    <g stroke="${c1}" stroke-width="18" filter="url(#${id}f)" opacity=".9">${d}</g><g stroke="#120806" stroke-width="19">${d}</g><g stroke="url(#${id}g)" stroke-width="13">${d}</g></g></svg>`;
}
// the button: a gift (with a dot) until today's reward is taken, then the streak's flame with its number.
// Smaller flames sit lower in their box, so each one is lifted to look centred.
function renderDaily(pop){
  const b = $('#dlBtn'); if (!b) return;
  b.hidden = S.tab !== 'quests' || arranging;
  const ready = !dlClaimed() || !!(S.daily && S.daily.pending);
  b.classList.toggle('ready', ready);
  const key = ready ? 'gift' : 'f' + dlStreak();
  if (b.dataset.k === key && !pop) return;
  b.dataset.k = key;
  if (ready){ b.innerHTML = DL_GIFT + '<span class="dot"></span>'; return; }
  const n = dlStreak(), t = flameTier(n), lift = (28 * (1 - [.72, .78, .86, .94, 1, 1.06][t]) * 26 / 64).toFixed(1);   // negative for the 200+ flame (it's bigger)
  b.innerHTML = `<span class="dl-fl${pop ? ' pop' : ''}"><span class="dl-fw" style="transform:translate(-50%,${-lift}px)">${flameSvg(t, 26)}</span>${streakNum(n, t, 13)}</span>`;
}
function dlOpen(){
  const d = S.daily, rw = d.pending, day = d.streak, btn = $('#dlBtn').getBoundingClientRect();
  // the gift pops and sparks, then the pop-up grows out of it
  $('#dlBtn').classList.add('burst'); setTimeout(() => $('#dlBtn').classList.remove('burst'), 500);
  FX.burstC(...rectMid(btn), .9, ['46,230,214', '150,240,230', '230,255,250', '20,180,170']);
  const amt = (icon, n, xp) => `<div class="dl-amt${xp ? ' xp' : ''}"><svg viewBox="0 0 32 32"><use href="#${icon}"/></svg><b>${n}</b></div>`;
  let body, hint = HINT.next, card = null;
  if (rw.kind === 'card'){
    card = CARDS.find(c => c.id === rw.id);
    body = `<button type="button" class="pk-card dl-card r-${rw.rarity}${rw.rarity === 'ultimate' ? ' gold' : ''}" style="--rc:${RARITY[rw.rarity].glow}">
      <span class="pk-aura"></span><span class="pk-inner"><span class="pk-back dl-glass"><i>?</i></span>
      <span class="pk-front"><img src="${cardImg(rw.id)}" alt="${esc(card ? card.name : '')}"></span></span><span class="pk-tag"></span><span class="pk-set">${esc(card ? setLabel(card.set) : '')}</span></button>`;
    hint = HINT.open;
  } else body = rw.xp ? `<div class="dl-two">${amt('i-coin', rw.gold)}${amt('i-gem', rw.xp, true)}</div>` : amt('i-coin', rw.gold);
  let flipped = rw.kind !== 'card';
  const pop = popupOpen(`<div class="dl-pop"><div class="dl-head"><small>Daily login</small><b>Day ${day}</b></div>${window.PsychDen ? `<div class="dl-tk">${PsychDen.icon()}<b>+${DL_TICKETS}</b></div>` : ''}<div class="dl-body">${body}</div>${hintHtml(hint, 'dl-hint')}</div>`, { from: btn, onTap: () => {
    if (!flipped){   // a tap first turns the card over, like in a pack
      flipped = true;
      const c = pop.querySelector('.dl-card'); c.classList.add('flipped');
      c.querySelector('.pk-tag').innerHTML = rw.fresh ? 'NEW' : `<em>×${ownedCard(rw.id)}</em>`;
      setTimeout(() => revealFX(c, rw.rarity), 180);
      pop.querySelector('.dl-hint').textContent = HINT.next;
      popBusy = true; setTimeout(() => { popBusy = false; }, 700);
      return;
    }
    dlClose(pop, rw);
  } });
}
function dlClose(pop, rw){
  const from = (pop.querySelector('.dl-amt') || pop.querySelector('.dl-card') || pop).getBoundingClientRect();
  if (S.daily) delete S.daily.pending;
  const tkIc = pop.querySelector('.dl-tk svg'), tkFrom = tkIc && tkIc.getBoundingClientRect(), tkGot = window.PsychDen ? PsychDen.add(DL_TICKETS) : 0;   // tickets: saved now, flown up once the pop-up has closed
  popupClose(pop, () => {
    if (rw.kind === 'gold'){ celebrate.swirl = true; earnTag = { k:'daily', n:'Daily reward', kind:'daily', part:'day ' + dlStreak() }; grant({ xp:rw.xp || 0, gold:rw.gold }, from); }   // coins to the purse, gems to the XP bar
    else { save(); render(); }
    renderDaily(true);
    if (tkGot){ if (tkFrom) PsychDen.fly(tkFrom, tkGot); else PsychDen.land(tkGot); }
    const b = $('#dlBtn').getBoundingClientRect(), t = flameTier(dlStreak());
    setTimeout(() => FX.burstC(...rectMid(b), .8, RV_PAL[['rare', 'rare', 'rare', 'epic', 'legendary', 'ultimate'][t]]), 120);
  });
}

function initDailyLogin(){
  $('#dlBtn').addEventListener('click', () => {
    if (popBusy || opening) return;
    const d = S.daily || {};
    if (dlClaimed() && !d.pending){
      showToast(`Day ${dlStreak()} streak · come back tomorrow`, false);
      return;
    }
    if (!d.pending){
      const day = dlStreak() + 1, rw = dlRoll(day);
      if (rw.kind === 'card'){ const c = dlCard(rw.rarity); rw.id = c.id; rw.fresh = !ownedCard(c.id); gainCard(c.id); }
      S.daily = { at:now(), streak:day, pending:rw };
      save();
    }
    dlOpen();
  });
}
