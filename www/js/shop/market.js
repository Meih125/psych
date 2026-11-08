/* Market: three missing cards a day, freeze, reroll, buying. */
/*    S.mkt = { day, ids:[id|null ×3], bought:[bool ×3], fz:slot|-1 }. Three unowned, non-Joker cards, new at 00:00 phone time.
   Each slot rolls with the pack odds (C 59.9 · R 25 · SR 10 · SSR 4 · UR 1.1), no card twice on a day; a rarity with nothing
   left to find drops out and the rest share its chance. One card can be frozen (kept): it stays in its slot across days
   until it is bought, moved to another card or unfrozen. A bought card stays on the board, faded, until 00:00.
   The Market always starts folded (mktOpen, not saved); opening it lasts until you leave the Shop tab. Nothing here ever runs in the background. */
var MKT_PRICE = { common:25, rare:45, epic:80, legendary:135, ultimate:200 };
var mktOpen = false;   // the Market always starts folded; opening it lasts until you leave the Shop tab
var MKT_ODDS = { common:59.9, rare:25, epic:10, legendary:4, ultimate:1.1 };
const mktMissing = () => CARDS.filter(c => !c.joker && !cardTotal(c.id));
// once every card (Jokers aside) is found, the Market sells everything again, for extra copies
const mktExtra = () => !mktMissing().length;
const mktPool = () => mktExtra() ? CARDS.filter(c => !c.joker) : mktMissing();
function mktRoll(used){
  const by = {}; mktPool().forEach(c => { if (!used.has(c.id)) (by[c.rarity] ||= []).push(c); });
  const rs = Object.keys(MKT_ODDS).filter(r => by[r]); if (!rs.length) return null;
  let x = Math.random() * rs.reduce((a, r) => a + MKT_ODDS[r], 0), pick = rs[rs.length - 1];
  for (const r of rs){ x -= MKT_ODDS[r]; if (x < 0){ pick = r; break; } }
  return pickFrom(by[pick]).id;
}
const mktOk = id => { const c = typeof id === 'string' && CARD_BY_ID[id]; return !!c && !c.joker; };
// today's board, made once a day and saved; a frozen card keeps its slot
function mktEnsure(){
  let m = S.mkt;
  const sound = m && typeof m === 'object' && /^\d{4}-\d\d-\d\d$/.test(m.day) && Array.isArray(m.ids) && m.ids.length === 3 && m.ids.every(id => id === null || mktOk(id));
  if (!sound) m = null;
  if (m) m.rr = Math.max(0, Math.min(999, Math.round(+m.rr || 0)));   // rerolls used today
  if (m) { m.bought = [0, 1, 2].map(i => !!(Array.isArray(m.bought) && m.bought[i] && m.ids[i])); if (!(m.fz >= 0 && m.fz < 3 && m.ids[m.fz] && !m.bought[m.fz])) m.fz = -1; }
  if (m && m.fz >= 0 && !mktExtra() && cardTotal(m.ids[m.fz])) m.fz = -1;   // a frozen card that came out of a pack is no longer for sale
  if (m && m.day >= dayKey()) return S.mkt = m;   // never rolls backward if the phone clock is set back
  const keep = m && m.fz >= 0 && (mktExtra() || !cardTotal(m.ids[m.fz])) ? m.fz : -1, ids = [null, null, null], used = new Set();
  if (keep >= 0){ ids[keep] = m.ids[keep]; used.add(ids[keep]); }
  for (let i = 0; i < 3; i++){ if (ids[i]) continue; ids[i] = mktRoll(used); if (ids[i]) used.add(ids[i]); }
  S.mkt = { day:dayKey(), ids, bought:[false, false, false], fz:keep, rr:0 };
  save();
  return S.mkt;
}
// the best card goes in the middle (the hero), the other two on the sides
const MKT_RANK = { common:0, rare:1, epic:2, legendary:3, ultimate:4 };
function mktOrder(m, show){ if (show.length < 2) return show; const s = show.slice().sort((a, b) => MKT_RANK[CARD_BY_ID[m.ids[b]].rarity] - MKT_RANK[CARD_BY_ID[m.ids[a]].rarity] || a - b); return s.length === 3 ? [s[1], s[0], s[2]] : s; }
const MKT_OL = '<svg class="mkt-ol" aria-hidden="true"><rect class="a"/><rect class="b"/><rect class="c"/><rect class="d"/></svg>';
const MKT_OWNED = `<button class="mkt-owned" disabled>Owned${MKT_OL}</button>`;
const mktSold = (m, i) => !!(m.ids[i] && (m.bought[i] || (!mktExtra() && cardTotal(m.ids[i]))));
function mktCell(m, i){
  const id = m.ids[i]; if (!id) return '';
  const c = CARD_BY_ID[id], r = c.rarity, sold = mktSold(m, i), ice = m.fz === i && !sold, price = MKT_PRICE[r], nm = RARITY[r].name;
  const edge = CARD_EDGE[id] && (r === 'ultimate' || r === 'legendary');
  return `<div class="mkt-cell${sold ? ' sold' : ''}" data-r="${r}" data-i="${i}"><div class="mkt-art${ice ? ' ice' : ''}${sold ? ' sold' : ''}" data-i="${i}" data-id="${id}">
    <i class="rr-glow"></i><button class="ct r-${r}${edge ? ' edge' : ''}"${edgeStyle(id)} data-act="inspect" data-id="${id}"><img src="${cardImg(id)}" alt="${esc(c.name)}"></button>
    <div class="zl"><div class="z-pane"><i class="z-hue"></i><i class="z-gloss"></i></div><i class="z-flash"></i></div><i class="mkt-rim"></i><i class="sold-dim"></i>
    <span class="sps"><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i><i class="sp"></i></span><span class="lt">${nm}</span>
    <span class="tbw"><span class="tb"><i class="bg"></i><i class="sq"></i><b>${m.bought[i] ? 'Purchased' : 'Owned'}</b></span></span></div>
    <div class="mkt-row">${sold ? MKT_OWNED : `<button class="mkt-price${S.gold < price ? ' short' : ''}" data-act="mkbuy" data-i="${i}" aria-label="Buy for ${price} gold">${ico('i-coin')}<span>${fmt(price)}</span>${MKT_OL}</button><button class="mkt-fz${ice ? ' on' : ''}" data-act="mkfz" data-i="${i}" aria-label="${ice ? 'Unfreeze' : 'Freeze'} this card">${ico('i-snow','0 0 24 24')}${MKT_OL}</button>`}</div></div>`;
}
// Reroll for Den tickets (1, 2, 3... per day); replaces unfrozen, unbought cards.
function mktReroll(btn){
  const m = mktEnsure(), cost = m.rr + 1;
  if (!window.PsychDen || PsychDen.count() < cost) return deny(btn);
  const keep = i => !m.ids[i] || m.bought[i] || m.fz === i, used = new Set(m.ids.filter((id, i) => id && keep(i))), seen = new Set(m.ids.filter(Boolean)), next = m.ids.slice();
  let changed = false;
  for (let i = 0; i < 3; i++){ if (keep(i)) continue; const id = mktRoll(seen); if (id){ next[i] = id; seen.add(id); used.add(id); changed = true; } }
  if (!changed){ showToast('No other cards to find'); return; }
  PsychDen.spend(cost); m.ids = next; m.rr = cost; save(); render();
}
// the Market row (a ticket) with up to three cards folding out of it
function marketHTML(){
  const m = mktEnsure(), open = mktOpen, show = [0, 1, 2].filter(i => m.ids[i]);
  const thumb = id => { const c = CARD_BY_ID[id], edge = CARD_EDGE[id] && (c.rarity === 'ultimate' || c.rarity === 'legendary'); return `<div class="ct r-${c.rarity}${edge ? ' edge' : ''}"${edgeStyle(id)}><img src="${cardImg(id)}" alt=""></div>`; };
  return `<div class="mkt${open ? ' open' : ''}"><div class="mkt-ent" data-act="mkfold" role="button" aria-expanded="${open}"><i class="bgl"></i><div class="mkt-stk n${show.length}">${mktOrder(m, show).map(i => thumb(m.ids[i])).join('')}</div><div class="mkt-t"><small>DAILY</small><b>Market</b><span class="mkt-say">${mktExtra() ? 'For your extra copies' : 'Cards you’re missing'}</span></div>
    <div class="mkt-stub"><small>Resets in</small><span class="qb-time">${cd(nextMidnight())}</span></div></div>
    <div class="mkt-bd"${open ? '' : ' hidden'} style="--hr:${RARITY[CARD_BY_ID[m.ids[mktOrder(m, show)[show.length === 3 ? 1 : 0]]].rarity].glow}">${window.PsychDen ? `<button class="mkt-rr${PsychDen.count() < m.rr + 1 ? ' off' : ''}" data-act="mkrr" aria-label="Reroll the cards (${m.rr + 1} ticket${m.rr ? 's' : ''})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg><span>${PsychDen.icon()}<b>${m.rr + 1}</b></span></button>` : ''}<div class="col-grid mkt-grid n${show.length}">${mktOrder(m, show).map(i => mktCell(m, i)).join('')}</div></div></div>`;
}
// fold / unfold like a Collection set; clipped top and bottom only so tilted cards aren't cut
function mktFold(host){
  const bd = host.querySelector('.mkt-bd'), ent = host.querySelector('.mkt-ent'), open = host.classList.contains('open'); if (!bd) return;
  const done = () => { mktOpen = !open; ent.setAttribute('aria-expanded', !open); };
  if (S.reduceFx){ host.classList.toggle('open', !open); bd.hidden = open; return done(); }
  if (host.dataset.anim) return; host.dataset.anim = 1; bd.style.clipPath = 'inset(0 -70px)';
  const end = () => { bd.style.clipPath = ''; delete host.dataset.anim; };
  if (open){
    host.classList.remove('open');
    bd.animate([{ height:bd.offsetHeight + 'px', opacity:1 }, { height:'0px', opacity:0, paddingTop:'0px', paddingBottom:'0px' }], { duration:280, easing:MOTION.leave, fill:'forwards' }).onfinish = () => { bd.hidden = true; bd.getAnimations().forEach(a => a.cancel()); end(); };
  } else {
    bd.hidden = false; host.classList.add('open'); const h = bd.offsetHeight;
    bd.animate([{ height:'0px', opacity:0, paddingTop:'0px', paddingBottom:'0px' }, { height:h + 'px', opacity:1 }], { duration:340, easing:MOTION.arrive }).onfinish = end;
  }
  done();
}
// freeze one card; tapping another moves the freeze, tapping it again releases it
function mktFreeze(i){
  const m = mktEnsure(); if (!m.ids[i] || mktSold(m, i)) return;
  m.fz = m.fz === i ? -1 : i; save();
  document.querySelectorAll('.mkt .mkt-cell').forEach(cell => {
    const k = +cell.dataset.i, a = cell.querySelector('.mkt-art'), b = cell.querySelector('.mkt-fz'), on = m.fz === k;
    if (b){ b.setAttribute('aria-label', (on ? 'Unfreeze' : 'Freeze') + ' this card'); }
    if (on === a.classList.contains('ice')) return;
    a.classList.toggle('ice', on);
    if (!S.reduceFx){ replay(a, on ? 'go' : 'got', ['go', 'got']); clearTimeout(a._t); a._t = setTimeout(() => a.classList.remove('go', 'got'), 800); }
    if (b){ b.classList.toggle('on', on); if (!S.reduceFx) replay(b, 'pop'); }
  });
}
// a small copy flies to the Collection tab, which pops with +rarity
function mktFly(art, id){
  const tab = document.querySelector('.tab[data-tab="collection"]'), tg = tab && tab.querySelector('svg'); if (!tg) return;
  const r = art.getBoundingClientRect(), t = tg.getBoundingClientRect(), tm = getComputedStyle(art).transform; let ang = 0;
  const v = tm && tm !== 'none' && tm.match(/matrix\(([^)]+)\)/); if (v){ const p = v[1].split(',').map(Number); ang = Math.atan2(p[1], p[0]) * 180 / Math.PI; }
  const w = art.offsetWidth, h = art.offsetHeight, cx = r.left + r.width / 2, cy = r.top + r.height / 2, c = CARD_BY_ID[id];
  const el = document.createElement('div'); el.className = 'mkt-fly'; el.style.cssText = `left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;box-shadow:0 0 10px 1px rgba(${RARITY[c.rarity].glow},.6)`; el.innerHTML = `<img src="${cardImg(id)}" alt="">`; document.body.appendChild(el);
  const dx = t.left + t.width / 2 - cx, dy = t.top + t.height / 2 - cy, s = Math.max(.1, 22 / w);
  el.animate([{ transform:`translate(0,0) rotate(${ang}deg) scale(1)`, opacity:1 }, { opacity:1, offset:.78 }, { transform:`translate(${dx}px,${dy}px) rotate(${ang}deg) scale(${s})`, opacity:0 }], { duration:MOTION.slow - 40, delay:80, easing:'cubic-bezier(.5,0,.2,1)', fill:'both' }).onfinish = () => {
    el.remove(); replay(tab, 'pop'); setTimeout(() => tab.classList.remove('pop'), 500);
    const up = document.createElement('i'); up.className = 'mkt-up'; up.dataset.k = c.rarity; up.textContent = '+' + RARITY[c.rarity].name; tab.appendChild(up); setTimeout(() => up.remove(), 1000);
  };
}
function mktBuy(i, btn){
  const m = mktEnsure(), id = m.ids[i]; if (!id || mktSold(m, i)) return;
  const price = MKT_PRICE[CARD_BY_ID[id].rarity];
  if (S.gold < price){ deny(btn); return; }
  buyUndo = null;
  S.gold -= price; gainCard(id); m.bought[i] = true; if (m.fz === i) m.fz = -1;
  const jokers = checkJokers(); save();
  renderHeader.tween = true; renderHeader(); renderTabs();
  const cell = document.querySelector(`.mkt .mkt-cell[data-i="${i}"]`), art = cell && cell.querySelector('.mkt-art'); if (!art) return;
  art.classList.remove('ice', 'go', 'got'); art.classList.add('sold'); cell.classList.add('sold'); const rw = cell.querySelector('.mkt-row'); if (rw) rw.innerHTML = MKT_OWNED; const tbb = art.querySelector('.tb b'); if (tbb) tbb.textContent = 'Purchased'; cell.querySelector('.mkt-fz')?.classList.remove('on');
  document.querySelectorAll('.mkt .mkt-price').forEach(b => b.classList.toggle('short', S.gold < MKT_PRICE[CARD_BY_ID[m.ids[+b.dataset.i]].rarity]));
  if (!S.reduceFx) mktFly(art, id);
  if (jokers) showToast('Jokers unlocked');
}
