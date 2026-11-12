/* Level-up screen: shows every card that levelled up (see gainCard in sets.js, the log is lvLog).
   Packs show it as the last step (afterReveal in opening.js); the shop, Den market and daily reward call lvSchedule().
   Nothing is saved: if the app closes before the screen shows, it is simply lost. Look: css/cards/levelup.css. */
let lvShown = null, lvTimer = 0;   // lvShown: the open screen { el, ready, T:[timers] }
const lvHas = () => Object.keys(lvLog).length > 0;
function lvTake(){   // everything that levelled so far, best rarity first (the log is emptied)
  const L = Object.keys(lvLog).map(id => ({ id, from:lvLog[id].from, to:lvLog[id].to })).sort((a, b) => rarRank(CARD_BY_ID[a.id]) - rarRank(CARD_BY_ID[b.id]));
  Object.keys(lvLog).forEach(k => delete lvLog[k]);
  return L;
}
// the line under the Open all sub title: packs · cards · different · duplicates
function lvStats(o){
  const packs = Math.round(o.cards.length / o.item.cards); if (packs < 2) return '';
  const diff = new Set(o.cards.map(c => c.id)).size, dup = o.cards.length - diff;
  return `${packs} ${pl(packs, 'pack')} · ${o.cards.length} ${pl(o.cards.length, 'card')} · ${diff} different · ${dup} ${pl(dup, 'duplicate')}`;
}
const lvLine = e => e.from === e.to ? `LV ${e.to} <span class="mx">MAX</span>` : `LV ${e.from} <i>→</i> <span class="cur">${e.to}</span>${e.to === LV_MAX ? ' <span class="mx">MAX</span>' : ''}`;
// o: { src } where the cards came from (Shop purchase, Event reward), { stats } the Open all line; done() runs on CONTINUE
function lvOpen(o, done){
  if (lvShown) return false;
  const L = lvTake(); if (!L.length) return false;
  o = o || {};
  const n = L.length, mode = n === 1 ? 'one' : n === 2 ? 'two' : 'grid', R = !!S.reduceFx, size = mode === 'one' ? 'big' : mode === 'two' ? 'mid' : '';
  const cell = e => `<div class="lu-c${R ? ' on' : ''}" data-id="${e.id}"><div class="lu-img r-${rkey(CARD_BY_ID[e.id])}" style="--rc:${glowOf(CARD_BY_ID[e.id])}"><img src="${cardImg(e.id)}" alt=""></div>${mode === 'grid' ? '' : `<b>${esc(CARD_BY_ID[e.id].name)}</b>`}<div class="lu-bar">${starBar(R ? e.to : e.from, { size })}</div><div class="lu-lv">${lvLine(e)}</div></div>`;
  const el = document.createElement('div'); el.className = 'lvu';
  el.innerHTML = `<div class="lu-in"><h2>LEVEL UP</h2><div class="lu-sub">${o.src ? `<span class="lu-src">${esc(o.src)}</span>` : ''}${o.stats ? `<span>${o.stats}</span>` : ''}<span>${n} ${pl(n, 'card')} levelled up</span></div>
    <div class="lu-body lu-${mode}${n === 3 ? ' lu-3' : ''}">${L.map(cell).join('')}</div>
    <div class="lu-btn">${hintHtml()}</div></div>`;
  document.body.appendChild(el);
  const T = [], sh = lvShown = { el, ready:false, T };
  const ready = () => { sh.ready = true; el.classList.add('rdy'); };   // the "Tap to continue" hint shows and a tap anywhere closes
  sh.go = () => { if (sh.ready) lvClose(sh, done); };
  el.addEventListener('click', sh.go);
  const steps = Math.max(0, ...L.map(e => e.to - e.from));   // a card with 2 or more level-ups pops its next star 1 s later, and so on
  if (R) T.push(setTimeout(ready, 400));
  else {
    T.push(setTimeout(() => el.querySelectorAll('.lu-c').forEach(c => c.classList.add('on')), 300));   // every cell slides in together
    for (let k = 0; k < steps; k++) T.push(setTimeout(() => L.forEach(e => {
      const lv = e.from + 1 + k, c = el.querySelector(`.lu-c[data-id="${e.id}"] .lu-bar`); if (lv <= e.to && c) c.innerHTML = starBar(lv, { size, pop:starAt(lv) });
    }), 900 + k * 1000));
    T.push(setTimeout(ready, 900 + Math.max(0, steps - 1) * 1000 + 1000));   // CONTINUE wakes 1 s after the last pop
  }
  return true;
}
function lvClose(sh, done){
  sh.T.forEach(clearTimeout); lvShown = null;
  sh.el.remove();
  if (done) done();
  if (lvHas()) lvSchedule(300);   // cards that came in while the screen was open get a screen of their own
}
// a card source other than a pack (shop, events): show the screen once things have settled
// (later gains restart the wait, so a few buys in a row land on one screen; it waits while a pack is open)
function lvSchedule(delay, src){
  clearTimeout(lvTimer); if (src) lvSchedule.src = src;
  lvTimer = setTimeout(function again(){
    if (!lvHas()){ lvSchedule.src = ''; return; }
    if (lvShown || opening){ lvTimer = setTimeout(again, 500); return; }
    const s = lvSchedule.src; lvSchedule.src = ''; lvOpen({ src:s });
  }, delay == null ? 700 : delay);
}
