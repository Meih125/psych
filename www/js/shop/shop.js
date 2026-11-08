/* Shop tab: packs, buying, quantity, the banner carousel. */
const SHOP = [
  { id:'tarot', deck:'tarot', fan:['SSR03', 'SSR05', 'SSR07', 'SSR02', 'SSR13', 'SSR15'], pop:['SSR04', 'SSR06', 'SSR01', 'SSR12', 'SSR08', 'SSR09'], pbg:['SSR10', 'SSR11', 'SSR13'], name:'Lord of Mysteries Pack', desc:'A price is always exacted for what fate bestows.', price:100, cards:5,
    pity:10,   // every 10th deck opened without an Ultimate guarantees one; getting any Ultimate resets the count
    // % per card; the rest (59.9%) is C; a deck with no Rare+ gets one card upgraded to Rare
    odds:{ ultimate:1.1, legendary:4, epic:10, rare:25 },
    rates:[ { r:'ultimate', pct:'1.1%' }, { r:'legendary', pct:'4%' }, { r:'epic', pct:'10%' }, { r:'rare', pct:'25%', note:'1+ guaranteed' } ] },
  { id:'mlbb', deck:'mlbb', fan:['ML_AS01', 'ML_SP05', 'ML_AS04', 'ML_SP01', 'ML_SP02', 'ML_SP03'], pop:['ML_SP04', 'ML_SP06', 'ML_AS02', 'ML_AS06', 'ML_SP07', 'ML_SP08'], pbg:['ML_SP09', 'ML_SP10', 'ML_SP01'], name:'Land of Dawn Pack', desc:'Funny you should think people are more reliable than gold!', price:100, cards:5, pity:10,
    odds:{ ultimate:1.1, legendary:4, epic:10, rare:25 },
    rates:[ { r:'ultimate', pct:'1.1%' }, { r:'legendary', pct:'4%' }, { r:'epic', pct:'10%' }, { r:'rare', pct:'25%', note:'1+ guaranteed' } ] },
  { id:'hod', deck:'hod', fan:['HD_UR05', 'HD_SP05', 'HD_UR12', 'HD_SP01', 'HD_UR02', 'HD_UR01'], pop:['HD_UR03', 'HD_SP02', 'HD_PR02', 'HD_PR03', 'HD_UR06', 'HD_SP03'], pbg:['HD_UR07', 'HD_SP04', 'HD_UR05'], name:'Hand of Destiny Pack', desc:'Fate deals the cards. You only choose to play.', price:100, cards:5, pity:10,
    odds:{ ultimate:1.1, legendary:4, epic:10, rare:25 },
    rates:[ { r:'ultimate', pct:'1.1%' }, { r:'legendary', pct:'4%' }, { r:'epic', pct:'10%' }, { r:'rare', pct:'25%', note:'1+ guaranteed' } ] }
];
function infoHTML(it){
  return `<div class="info" data-act="info">
    ${infoIcon('Drop rates')}
    <div class="info-pop" role="tooltip">
      <div class="info-title" style="margin-bottom:6px">Drop rates</div>
      ${it.rates.map(x => `<div class="rate"><i style="--c:${RARITY[x.r].color}"></i><span style="color:${RARITY[x.r].color}">${RARITY[x.r].name}</span><b>${x.pct}</b>${x.note ? `<small>${x.note}</small>` : ''}</div>`).join('')}
      <div class="info-foot">Every pack has at least one ${rtag('rare')} or better. Every ${it.pity}th pack without an ${rtag('ultimate')} guarantees one.</div>
    </div>
  </div>`;
}
function shopBuy(it){
  const q = shopQty[it.id] || 1;
  if (!deckReady(it)) return `<button class="sh-buy short soon" disabled>SOON</button>`;
  return `<button class="sh-buy${S.gold < it.price * q ? ' short' : ''}" data-act="buy" data-item="${it.id}">${ico('i-coin')}<span>${fmt(it.price * q)}</span></button>`;
}
// one banner per pack (newest = NEW PACK); tap opens the pack details
function shopBanner(f, isNew){
  const fan = (f.fan || []).map((id, k) => `<img class="${k < 3 ? 'back' : 'front'}" src="${cardImg(id)}" alt="" style="--i:${k % 3 - 1}">`).join('');
  return `<div class="sh-ban th-${f.deck}" data-act="packinfo" data-item="${f.id}"><i class="sh-frame"></i>
      <div class="sh-ban-txt"><span class="sh-new">${isNew ? 'NEW PACK' : 'FEATURED PACK'}</span><h3>${f.name.length > 12 ? esc(f.name).replace(/ Pack$/, '<br>Pack') : esc(f.name)}</h3><p>${esc(f.banner || f.desc)}</p>
        <div class="sh-ban-buy"><span class="sh-det">DETAILS ›</span></div></div>
      <div class="art sh-fan">${fan}</div>
    </div>`;
}
// one pack as a ticket: box | name, collected, UR bar | price stub
function packTicket(it, latest){
  const all = CARDS.filter(c => c.deck === it.deck), got = all.filter(c => ownedCard(c.id)).length, q = shopQty[it.id] || 1;
  const n = Math.min(it.pity, (S.pity && S.pity[it.id]) || 0), left = it.pity - n, mine = Math.min(left, packCount(it.id));
  const pips = Array.from({ length:it.pity }, (_, k) => `<i class="${k < n ? 'on' : k < n + mine ? 'own' : ''}"></i>`).join('');
  return `<div class="u-r th-${it.deck}" data-buyhost data-item="${it.id}"><div class="bgl"></div><div class="box"><img class="sx-img" src="${deckOf(it).cover}" alt=""></div>
    <div class="mid"><h3>${esc(it.name.replace(/ Pack$/, ''))}</h3><div class="col-line"><span>Collected</span><div class="bar"><i style="width:${all.length ? got / all.length * 100 : 0}%"></i></div><b>${got}/${all.length}</b></div>
      <div class="ur1">${rtag('ultimate')}<div class="pips">${pips}</div><b>${left}${packCount(it.id) ? `<em>(${left - mine})</em>` : ''}</b></div></div>
    <div class="stub">${latest ? '<span class="sh-latest">LATEST</span>' : ''}${shopBuy(it)}
      <div class="sh-qty"><button data-act="qty" data-d="-1" data-item="${it.id}" aria-label="Fewer"${q <= 1 ? ' disabled' : ''}>‹</button><b data-plain>${q}</b><button data-act="qty" data-d="1" data-item="${it.id}" aria-label="More"${q >= 99 ? ' disabled' : ''}>›</button></div></div></div>`;
}
var shopBan = 0;   // which banner is showing (kept across redraws)
function renderShop(){
  const decks = SHOP, bs = decks.slice().reverse(), n = bs.length;   // newest first
  shopBan = ((shopBan % n) + n) % n;
  const slides = n > 1 ? [bs[n - 1], ...bs, bs[0]] : bs;   // a copy at each end so it can loop smoothly
  const q = id => shopQty[id] || 1;
  return `<div class="sh">
    <div class="sh-car" data-n="${n}">
      <div class="sh-track" style="transform:translateX(calc(${shopBan + (n > 1 ? 1 : 0)} * (-100% - 12px)))">
        ${slides.map((f, k) => `<div class="sh-slide${k === shopBan + 1 || n === 1 ? ' cur' : ''}">${shopBanner(f, f === bs[0])}</div>`).join('')}
      </div>
    </div>
    ${n > 1 ? `<div class="sh-dots">${bs.map((_, k) => `<i class="${k === shopBan ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    ${marketHTML()}
    <div class="sh-h">All packs<div class="info" data-act="info">${infoIcon('What the gold means')}
      <div class="info-pop" role="tooltip">
        <div class="sh-tip"><i class="sw r"></i>Opened</div>
        <div class="sh-tip"><i class="sw g"></i>Owned, unopened</div></div></div></div>
    ${bs.map(it => packTicket(it, it === bs[0])).join('')}
    <div class="sh-soon">${ico('i-pouch')}More packs coming soon</div>
  </div>`;
}
const packCount = id => (S.inv && S.inv[id]) || 0;
const shopQty = {};   // how many to buy at once, per item (resets when the app restarts)
function changeQty(id, d){
  const it = SHOP.find(x => x.id === id); if (!it) return;
  const q = shopQty[id] = Math.max(1, Math.min(99, (shopQty[id] || 1) + d));
  document.querySelectorAll(`.sh-buy[data-item="${id}"]`).forEach(b => { b.querySelector('span').textContent = fmt(it.price * q); b.classList.toggle('short', S.gold < it.price * q); });
  document.querySelectorAll(`.sh-qty`).forEach(box => { const [dn, up] = box.querySelectorAll('button'); if (dn.dataset.item !== id) return; dn.disabled = q <= 1; up.disabled = q >= 99; const bb = box.querySelector('b'); bb.textContent = bb.hasAttribute('data-plain') ? q : '×' + q; });

}
async function tryBuy(id, el){
  const it = SHOP.find(x => x.id === id); if (!it || !deckReady(it)) return;
  const q = shopQty[id] || 1, cost = it.price * q;
  if (S.gold < cost){ deny(el); return; }

  if (!await askBuy(it, q, cost)) return;
  buyUndo = { id, q, cost };
  const host = el.closest('[data-buyhost]') || el, art = (host.querySelector('.art, .box') || el).getBoundingClientRect();
  S.gold -= cost; (S.inv ||= {})[id] = packCount(id) + q;
  shopQty[id] = 1;
  save();
  spendCoins(art, cost);
  renderHeader.tween = true; render();
  const slot = document.querySelector(`.u-r[data-item="${id}"]`) || document.querySelector(`.sh-row[data-item="${id}"]`) || document.querySelector(`[data-item="${id}"]`);
  const sa = slot && (slot.querySelector('.art, .box') || slot);
  if (slot){ slot.classList.add('flash'); FX.burst(...rectMid(sa.getBoundingClientRect()), 1.4); }

  showToast(`${q > 1 ? q + ' ' + it.name + 's' : it.name} added to your Inventory`, true);
}
// coins leave the purse and fly into the item you bought
function spendCoins(to, amount){
  const purse = $('#purse svg').getBoundingClientRect(), n = Math.min(8, Math.max(3, Math.ceil(amount / 20)));
  const sx = purse.left + purse.width / 2 - 11, sy = purse.top + purse.height / 2 - 11, tx = to.left + to.width / 2 - 11, ty = to.top + to.height / 2 - 11;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div'); el.className = 'fly'; el.innerHTML = ico('i-coin'); document.body.appendChild(el);
    const rx = (Math.random() - .5) * 110;
    el.animate([
      { transform:`translate(${sx}px,${sy}px) scale(.8)`, opacity:0 },
      { transform:`translate(${(sx + tx) / 2 + rx}px,${Math.min(sy, ty) - 30}px) scale(1.15)`, opacity:1, offset:.4 },
      { transform:`translate(${tx}px,${ty}px) scale(.5)`, opacity:.2 }
    ], { duration:700, delay:i * 50, easing:'cubic-bezier(.45,0,.55,1)', fill:'both' }).onfinish = () => { el.remove(); if (i === n - 1) FX.small(tx + 11, ty + 11); };
  }
}
function useItem(id){ openDeck(id); }
/* Shop banners: swipe left / right (they follow your finger), loop around, and turn by themselves every 9 s.
   Touching a banner (picking an amount, buying) holds it still for 20 s so you can finish. */
let banDrag = null, banLast = performance.now(), banJumpT = 0;
// if the banner rests on its loop copy, jump to the real one before the next swipe
function banFix(){ if (!banJumpT) return; clearTimeout(banJumpT); banJumpT = 0; const car = document.querySelector('.sh-car'); if (!car) return; banSet(shopBan + 1, false); car.querySelectorAll('.sh-slide').forEach((el, k) => el.classList.toggle('cur', k === shopBan + 1)); }
function banSet(pos, anim){
  const tr = document.querySelector('.sh-track'); if (!tr) return;
  tr.style.transition = anim ? 'transform .45s cubic-bezier(.25,.8,.3,1)' : 'none';
  tr.style.transform = `translateX(calc(${pos} * (-100% - 12px)))`;
}
function banGo(d){
  const car = document.querySelector('.sh-car'); if (!car) return;
  const n = +car.dataset.n; if (n < 2) return;
  banFix();
  const tr = car.querySelector('.sh-track'), pos = shopBan + 1 + d;
  shopBan = ((shopBan + d) % n + n) % n; banLast = performance.now();
  banSet(pos, true);
  car.querySelectorAll('.sh-slide').forEach((el, k) => el.classList.toggle('cur', k === pos));
  const was = [...document.querySelectorAll('.sh-dots i')].findIndex(x => x.classList.contains('on'));
  document.querySelectorAll('.sh-dots i').forEach((el, k) => el.classList.toggle('on', k === shopBan));
  dotHl(document.querySelector('.sh-dots'), true, was);
  // landed on an end copy: jump to the real one without animating
  if (pos === 0 || pos === n + 1) banJumpT = setTimeout(() => { banJumpT = 0; if (tr.isConnected){ banSet(shopBan + 1, false);
    car.querySelectorAll('.sh-slide').forEach((el, k) => el.classList.toggle('cur', k === shopBan + 1)); } }, 470);
}
function banEnd(d, dx){
  banDrag = null; d.car.classList.remove('drag');
  if (Math.abs(dx) > d.w * .18 || (Math.abs(dx) > 16 && Math.abs(d.v || 0) > .45)) banGo(dx < 0 ? 1 : -1);   // far enough, or a quick flick
  else { banSet(shopBan + 1, true); banLast = performance.now() + 11000; }   // otherwise it slides back
}

// last pack purchase for the toast's Undo ({ id, q, cost }); cleared by any other action
let buyUndo = null;

function initShop(){
  // drag the banner sideways (vertical drags scroll the page)
  onDrag($('#panel'), { axis:'x', slop:8, capture:true,
    start: e => { const car = e.target.closest('.sh-car'); if (!car || +car.dataset.n < 2) return null;
      banFix(); banLast = performance.now() + 11000;   // 9 s + 11 s = held for 20 s after a touch
      return banDrag = { w:car.offsetWidth, car, el:car }; },
    begin: d => d.car.classList.add('drag'),
    move: (d, dx) => banSet(shopBan + 1 - dx / (d.w + 12), false),
    end: (d, dx) => banEnd(d, dx),
    cancel: d => { banDrag = null; d.car.classList.remove('drag'); banSet(shopBan + 1, true); },
    abort: () => { banDrag = null; },
    swallow: e => !!e.target.closest('.sh-car'), swallowMs:350 });   // a drag shouldn't also press the price button
  every(1, () => {
    if (S.tab !== 'shop' || document.hidden || banDrag || $('#ask').classList.contains('open') || opening) return;
    if (performance.now() - banLast > 9000) banGo(1);
  });
}
