/* Opening packs: deal, flip, reveal effects, scenes, Open all. */
/* ---- Opening a deck ---- */
let opening = null, packClear = 0;
// where each card sits: 3 on top, 2 below, slightly tilted (rollDeck shuffles which card goes where)
const PACK_SLOTS = [ { x:18, y:.66, r:-7 }, { x:50, y:.52, r:0 }, { x:82, y:.66, r:7 }, { x:34, y:1.82, r:-3 }, { x:66, y:1.82, r:3 } ];
// the label under a card, like Hearthstone's class name
const SET_LABEL = { 'Poker:H':'Hearts', 'Poker:D':'Diamonds', 'Poker:S':'Spades', 'Poker:C':'Clubs', 'SSR':'Signature', 'SR':'Beyonder', 'Cards of Blasphemy':'Card of Blasphemy', 'Angels':'Angel', 'Objects':'Artifact', 'Pathways':'Pathway', 'Promo':'Promo', 'Deity':'Deity', 'Puzzle':'Puzzle', 'Tarot Club':'Tarot Club', 'Legends':'Legend', 'Gilded':'Gilded', 'Regions':'Region', 'Duo':'Duo', 'Poker':'Poker', 'Joker':'Joker' };
const setLabel = set => SET_LABEL[set] || set;
function openDeck(id){
  const item = SHOP.find(x => x.id === id);
  if (!item || packCount(id) < 1 || opening || !deckReady(item)) return;
  buyUndo = null;
  S.inv[id] = packCount(id) - 1;
  S.opened[id] = (S.opened[id] || 0) + 1;
  const res = rollDeck(item);
  const fresh = {};
  res.cards.forEach(c => { if (!ownedCard(c.id) && !fresh[c.id]) fresh[c.id] = true; gainCard(c.id); });
  const jokerPop = checkJokers();
  if (res.scene){ S.scenes[res.scene.id] = true; recordNew(sceneDefById(res.scene.id).key, res.scene.id); }
  save();
  opening = { item, ...res, fresh, flipped:new Set(), done:false, jokerPop, tix:window.PsychDen ? PsychDen.packFirst() : 0 };
  // fully decode the art before showing the pack, so flipping never stalls
  const ids = [...res.cards.map(c => c.id), deckOf(item).back, deckOf(item).backUR, ...(res.scene ? [res.scene.id] : [])];
  opening.imgs = ids.map(id => { const im = new Image(); im.src = cardImg(id); return im; });
  const mine = opening;   // show it only if this pack is still the one being opened (it may have been closed meanwhile)
  Promise.all(opening.imgs.map(im => im.decode().catch(() => {}))).then(() => { if (opening === mine) showOpening(); });
}
function showOpening(){
  const o = opening, ov = $('#pack'); if (!o) return;
  clearTimeout(packClear);
  ov.innerHTML = `
    <div class="pk-cards">${o.cards.map((c, i) => `
      <button class="pk-card r-${rkey(c)}${c.rarity === 'ultimate' ? ' gold' : ''}" data-i="${i}" style="--d:${i * 110}ms;--rc:${glowOf(c)};--x:${PACK_SLOTS[i].x}%;--y:${PACK_SLOTS[i].y};--rot:${PACK_SLOTS[i].r}deg">
        <span class="pk-aura"></span>
        <span class="pk-inner">
          <img class="pk-back" src="${cardImg(backOf(c, c.rarity === 'ultimate'))}" alt="">
          ${c.rarity === 'ultimate' ? '<span class="pk-glare"></span>' : ''}
          <span class="pk-front"><img src="${cardImg(c.id)}" alt="${esc(c.name)}"></span>
        </span>
        <span class="pk-tag"></span>
        <span class="pk-set">${esc(setLabel(c.set))}</span>
      </button>`).join('')}</div>
    <div class="pk-actions">${hintHtml(HINT.all)}</div>`;
  ov.querySelectorAll('.pk-front img, .pk-back').forEach(i => { if (i.decode) i.decode().catch(() => {}); });   // pictures ready before the flip
  ov.classList.add('open');
  packDeal(ov, o);
  ov.querySelectorAll('.pk-card').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); flipCard(+b.dataset.i); }));
}
// the cards fly out of the pack to their spots one by one while the pack fades
function packDeal(ov, o){
  if (S.reduceFx) return;
  const stk = document.querySelector('.inv-stack'); if (stk) stk.animate([{ opacity:1 }, { opacity:0 }], { duration:220, fill:'forwards' });   // the pack itself fades; the cards come out from the top
  const fx = innerWidth / 2, fy = -60, cards = [...ov.querySelectorAll('.pk-card')], total = 780 + Math.max(0, cards.length - 1) * 110;
  ov.classList.add('dealing'); clearTimeout(packDeal.t); packDeal.anims = []; packDeal.t = setTimeout(() => ov.classList.remove('dealing'), total + 40);   // a tap while dealing skips it (packDealSkip)
  cards.forEach((b, i) => {
    b.style.animation = 'none';
    const c = b.getBoundingClientRect(), dx = fx - (c.left + c.width / 2), dy = fy - (c.top + c.height / 2);
    packDeal.anims.push(b.animate([{ translate:`${dx}px ${dy}px`, scale:'.45', opacity:0 }, { opacity:1, offset:.1 }, { translate:`${dx * .35}px ${dy * .2}px`, scale:'.9', offset:.55 }, { translate:'0 0', scale:'1', opacity:1 }], { duration:780, delay:i * 110, easing:'cubic-bezier(.3,.7,.3,1)', fill:'backwards' }))
  });
}
function packDealSkip(){ clearTimeout(packDeal.t); (packDeal.anims || []).forEach(a => a.cancel()); packDeal.anims = []; $('#pack').classList.remove('dealing'); }
// double-tap on empty space turns every card face up (taps on a card only affect that card)
let packTap = 0;
function flipCard(i, quiet, lite){
  const o = opening; if (!o) return;
  const btn = $(`#pack .pk-card[data-i="${i}"]`); if (!btn) return;
  if (o.flipped.has(i)){ if (!quiet) inspectCard(o.cards[i].id); return; }
  o.flipped.add(i);
  const c = o.cards[i];
  btn.classList.add('flipped');
  { const tg = btn.querySelector('.pk-tag'); tg.classList.toggle('nw', !!o.fresh[c.id]); tg.innerHTML = o.fresh[c.id] ? 'NEW' : `<em>×${ownedCard(c.id)}</em>`; }
  // effects fire as the card turns face up (about halfway through the flip)
  setTimeout(() => { if (opening) revealFX(btn, rkey(c), lite); }, 180);
  if (o.flipped.size === o.cards.length) finishReveal();
}
/* Card reveal effects, bigger for rarer cards (C keeps the small burst). No shaking.
   R: blue sparks + ring.  SR: purple sparks, two rings, glints, "SR" pops up.
   SSR: orange screen glow, turning light rays behind the card, a fountain of sparks, "SSR" stamp.
   UR: the screen dims, a white-hot flash, red-gold rays, three shockwaves, embers rising, a huge "UR" slam. */
var RV_PAL = {
  rare:['80,190,255','150,215,255','230,245,255','40,140,230'],
  epic:['190,110,255','225,170,255','250,235,255','140,70,220'],
  legendary:['255,160,60','255,205,120','255,245,225','240,110,30'],
  joker:['170,70,255','235,40,70','255,225,240','120,40,200'],
  ultimate:['255,70,60','255,200,90','255,245,230','255,120,40']
};
/* rarity pop-up lettering: hand-drawn angular U/R/S in chrome (no font needed) */
// custom angular lettering for the rarity pop-ups (only U, R, S are needed)
var RV_GLYPH={
 J:'M43 0V55L35 63H15L7 55V45',
 O:'M15 0H35L43 8V62L35 70H15L7 62V8Z',
 K:'M7 0V70M43 0L7 40M20 30L43 70',
 E:'M43 0H7V70H43M7 35H35',
 U:'M7 0V55L15 63H35L43 55V0',
 R:'M7 70V0H35L43 8V27L35 35H7M31 35L43 70',
 S:'M43 8L35 0H15L7 8V27L15 35H35L43 43V62L35 70H15L7 62'
};
function rarityLogo(txt, c1, c2, id){
  const W=50, gap=12, n=txt.length, w=n*W+(n-1)*gap+20, h=94;
  const d=[...txt].map((ch,i)=>`<path d="${RV_GLYPH[ch]}" transform="translate(${10+i*(W+gap)} 12)"/>`).join('');
  return `<svg class="rlogo" viewBox="0 0 ${w} ${h}" width="${w*1.25}" height="${h*1.25}" style="overflow:visible">
   <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".22" stop-color="#ffffff"/><stop offset=".48" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset=".53" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".62" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
   <filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
   <clipPath id="${id}c"><rect x="-20" y="-20" width="${w+40}" height="66"/><rect x="-20" y="49" width="${w+40}" height="80"/></clipPath></defs>
   <g transform="skewX(-12) translate(10 0)" fill="none" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="4">
    <g stroke="${c1}" stroke-width="18" filter="url(#${id}f)" opacity=".9">${d}</g>
    <g stroke="#120806" stroke-width="19">${d}</g>
    <g clip-path="url(#${id}c)">
     <g stroke="url(#${id}g)" stroke-width="13">${d}</g>
    </g>
   </g></svg>`;
}
function rvLayer(cls, html = ''){ const el = document.createElement('div'); el.className = 'rv ' + cls; el.innerHTML = html; $('#pack').appendChild(el); return el; }
function revealFX(btn, r, lite){
  const rect = btn.getBoundingClientRect(), [x, y] = rectMid(rect);
  if (r === 'common'){ FX.burst(x, y, .6); return; }
  if (r === 'joker') FX.burstC(x, y, .1, RV_PAL.joker);
  const pal = RV_PAL[r];
  btn.classList.add('rv-pop', 'rv-' + r);
  const TAGC = { epic:['#c07bff', '#6b2fd6'], legendary:['#ff9a2e', '#c2410c'], ultimate:['#ff4a3d', '#ffb02e'], joker:['#b04bff', '#e0153b'] };
  const tag = (txt, big) => { const t = rvLayer('rv-tag rv-t-' + r + (big ? ' big' : ''), rarityLogo(txt, ...TAGC[r], 'rl' + Math.random().toString(36).slice(2, 7))); t.style.left = (r === 'joker' ? Math.min(Math.max(x, 100), innerWidth - 100) : x) + 'px'; t.style.top = (rect.top - 6) + 'px'; setTimeout(() => t.remove(), 1600); };
  if (lite || S.reduceFx){ FX.burstC(x, y, r === 'rare' ? .8 : 1.2, pal); if (!lite && r !== 'rare') tag(r === 'epic' ? 'SR' : r === 'legendary' ? 'SSR' : r === 'joker' ? 'JOKER' : 'UR', r !== 'epic'); return; }   // reveal-all / reduced effects: a small coloured burst (+ the rarity tag)
  if (r === 'rare'){ FX.burstC(x, y, 1.1, pal); return; }
  if (r === 'epic'){
    FX.burstC(x, y, 1.6, pal); FX.ringC(x, y, 130, .8, 3, pal[1], .12); FX.glints(rect.left - 20, rect.top - 20, rect.width + 40, rect.height + 40, 8);
    tag('SR'); return;
  }
  const dim = r === 'ultimate' ? rvLayer('rv-dim') : null;   // UR: the room goes dark first
  const rays = rvLayer('rv-rays rv-r-' + r); rays.style.left = x + 'px'; rays.style.top = y + 'px';
  const glow = rvLayer('rv-glow rv-g-' + r); glow.style.setProperty('--x', x + 'px'); glow.style.setProperty('--y', y + 'px');
  if (r === 'legendary' || r === 'joker'){
    FX.burstC(x, y, 2.2, pal); FX.ringC(x, y, 160, .9, 4, pal[0]); FX.ringC(x, y, 220, 1, 2.5, pal[1], .18);
    FX.fountain(x, y, 18); FX.glints(rect.left - 30, rect.top - 30, rect.width + 60, rect.height + 60, 8);
    tag(r === 'joker' ? 'JOKER' : 'SSR', true);
    setTimeout(() => { rays.remove(); glow.remove(); }, 2200);
    return;
  }
  // UR
  FX.flash(x, y, 300, .8); FX.burstC(x, y, 3, pal);
  [0, .15, .3].forEach((d, i) => FX.ringC(x, y, 180 + i * 90, 1.1, 5 - i, pal[i % 2], d));
  FX.fountain(x, y, 26); FX.embersC(x, y, 16, pal); FX.glints(0, rect.top - 120, innerWidth, rect.height + 240, 12);
  tag('UR', true);
  setTimeout(() => { rays.remove(); glow.remove(); dim.remove(); }, 2600);
}
function revealAll(){
  const o = opening; if (!o || o.revealing) return;
  const left = o.cards.map((_, i) => i).filter(i => !o.flipped.has(i)); if (!left.length) return;
  o.revealing = true; $('#pack .pk-actions').innerHTML = '';
  // the others turn over quickly with small effects; after a short beat the rarest one gets its full reveal
  // (running several big reveals at once is what made this stutter)
  const rank = i => rarRank(o.cards[i]);   // 0 = UR ... 4 = C; a Joker sits between UR and SSR
  const best = left.reduce((a, b) => rank(b) < rank(a) ? b : a), rest = left.filter(i => i !== best).sort((a, b) => rank(b) - rank(a));   // lowest first, the best last
  rest.forEach((i, k) => setTimeout(() => { if (opening === o) flipCard(i, true, true); }, k * 120));
  setTimeout(() => { if (opening === o) flipCard(best, true); }, rest.length * 120 + (rank(best) <= 1 ? 450 : 120));
}
function finishReveal(){
  const o = opening;
  setTimeout(() => {
    if (opening !== o) return;
    o.done = true;
    $('#pack .pk-actions').innerHTML = hintHtml();
  }, 700);
}
function afterReveal(){
  const o = opening; if (!o) return;
  if (o.scene){ const sc = o.scene; o.scene = null; o.done = false; return showScene(sc); }
  if (o.sceneList && o.sceneList.length){   // Open all: the new scenes as a stack, one tap each
    if (o.sceneAt == null){ o.done = false; return showSceneStack(); }
    if (o.sceneAt < o.sceneList.length - 1){ o.done = false; return sceneStackNext(); }
  }
  if (o.jokerPop){ o.jokerPop = false; o.done = false; return showJokerUnlock(); }
  if (o.tix){ o.tixN = o.tix; o.tix = 0; o.done = false; return showPackTicket(); }   // first pack of the day: a Den ticket
  if (o.tixN && window.PsychDen){ const ic = $('#pack .ptk-ic'); if (ic) PsychDen.fly(ic.getBoundingClientRect(), o.tixN); else PsychDen.land(o.tixN); o.tixN = 0; }
  if (lvHas()){ o.done = false; lvOpen({ stats:o.all ? lvStats(o) : '' }, closeOpening); return; }   // last step: the cards that levelled up
  closeOpening();
}
// first pack of the day: a ticket pop-up; tapping sends it to the header
// an "unlocked" screen in the pack overlay: sparkle its hero element, then let a tap continue
// (the short pause keeps a double tap from skipping it)
function packScreenFx(sel, fx, at = 350, ready = 700){
  const o = opening;
  setTimeout(() => { const r = $('#pack ' + sel)?.getBoundingClientRect(); if (r && opening === o) fx(r); }, at);
  setTimeout(() => { if (opening === o) o.done = true; }, ready);
}
function showPackTicket(){
  const ov = $('#pack'), o = opening;
  ov.innerHTML = `<div class="sc-wrap ptk"><div class="sc-title">Daily pack bonus</div><div class="ptk-ic">${PsychDen.icon()}</div>${hintHtml()}</div>`;
  packScreenFx('.ptk-ic', r => { FX.flash(...rectMid(r), 200, .6); FX.burst(...rectMid(r), 1.4); });
}
// the 52nd Poker card is in: the Jokers are open for collecting
function showJokerUnlock(){
  const ov = $('#pack'), o = opening, J = CARDS.filter(c => c.joker);
  ov.innerHTML = `<div class="jku">
    <div class="jku-rays"></div><div class="jku-halo"></div>
    <div class="jku-word">JOKERS</div><div class="jku-sub">Jokers are now unlocked for collecting</div>
    <div class="jku-cards">${J.map(c => `<img src="${cardImg(c.id)}" alt="">`).join('')}</div>
    <div class="jku-flash"></div>${hintHtml()}</div>`;
  packScreenFx('.jku-word', r => { FX.burstC(...rectMid(r), 2, RV_PAL.joker); FX.glints(r.left, r.top - 30, r.width, r.height + 60, 10); }, 450, 900);
}
/* Open all with new scenes: like the single-pack "Scene Unlocked", but the scenes sit in a stack (the next ones
   peeking out behind on the left). Tap: the front one flies off to the right and the next slides forward. */
const sdOf = () => SCENE_DEF[(opening && opening.item && opening.item.deck) || 'tarot'];
function showSceneStack(){
  const ov = $('#pack'), o = opening, L = o.sceneList; o.sceneAt = 0;
  ov.innerHTML = `
    <div class="sc-wrap sc-multi${L.length === 1 ? ' one' : ''}">
      <div class="sc-title">${sdOf().one} Unlocked</div>
      <div class="sc-count">${L.length > 1 ? `1 / ${L.length}` : ''}</div>
      <div class="sc-stack">${L.map((sc, i) => `<div class="sc-img sc-card" data-i="${i}"><img src="${cardImg(sc.id)}" alt=""></div>`).join('')}</div>
      <div class="sc-name">${esc(L[0].name)}</div>
      <div class="pk-sub">${sdOf().list.filter(x => S.scenes[x.id]).length} of ${sdOf().list.length} ${sdOf().name.toLowerCase()}</div>
      ${hintHtml()}
    </div>`;
  sceneStackLayout();
  packScreenFx('.sc-card[data-i="0"]', r => { FX.flash(...rectMid(r), 240, .7); FX.burst(...rectMid(r), 2); FX.glints(r.left, r.top, r.width, r.height, 10); });
}
function sceneStackLayout(){
  const o = opening; if (!o) return;
  document.querySelectorAll('#pack .sc-card').forEach(c => {
    const k = +c.dataset.i - o.sceneAt;
    c.classList.toggle('front', k === 0); c.classList.toggle('gone', k < 0);
    c.style.setProperty('--k', Math.max(0, Math.min(k, 2)));
    c.style.zIndex = 50 - k;
    c.style.opacity = k < 0 || k > 2 ? '0' : '';
  });
}
function sceneStackNext(){
  const o = opening, L = o.sceneList; o.sceneAt++;
  sceneStackLayout();
  const sc = L[o.sceneAt], nm = $('#pack .sc-name'), ct = $('#pack .sc-count');
  if (nm) nm.textContent = sc.name;
  if (ct) ct.textContent = `${o.sceneAt + 1} / ${L.length}`;
  setTimeout(() => { const r = document.querySelector(`#pack .sc-card[data-i="${o.sceneAt}"]`)?.getBoundingClientRect(); if (!r || opening !== o) return; FX.burst(...rectMid(r), 1.4); FX.glints(r.left, r.top, r.width, r.height, 6); }, 380);
  setTimeout(() => { if (opening === o) o.done = true; }, 450);
}
function showScene(sc){
  const ov = $('#pack'), o = opening;
  ov.innerHTML = `
    <div class="sc-wrap">
      <div class="sc-title">${sdOf().one} Unlocked</div>
      <div class="sc-img"><img src="${cardImg(sc.id)}" alt=""></div>
      <div class="sc-name">${esc(sc.name)}</div>
      <div class="pk-sub">${sdOf().list.filter(x => S.scenes[x.id]).length} of ${sdOf().list.length} ${sdOf().name.toLowerCase()}</div>
      ${hintHtml()}
    </div>`;
  packScreenFx('.sc-img', r => { FX.flash(...rectMid(r), 240, .7); FX.burst(...rectMid(r), 2); FX.glints(r.left, r.top, r.width, r.height, 10); });

}
function closeOpening(){
  opening = null;
  $('#pack').classList.remove('open');
  clearTimeout(packClear);
  packClear = setTimeout(() => { if (!opening) $('#pack').innerHTML = ''; }, 300);
  render();
}
/* ---- Open all: every deck of this kind at once, cards laid out face down (glowing in their rarity),
   best first. Tap to flip one, double-tap anywhere to flip them all. ---- */
function openAll(id){
  const item = SHOP.find(x => x.id === id), n = packCount(id);
  if (!item || n < 1 || opening || !deckReady(item)) return;
  buyUndo = null;
  S.inv[id] = 0; S.opened[id] = (S.opened[id] || 0) + n;
  let cards = [], scenes = 0; const fresh = {}, sceneList = [];
  for (let i = 0; i < n; i++){
    const res = rollDeck(item);
    res.cards.forEach(c => { if (!ownedCard(c.id) && !fresh[c.id]) fresh[c.id] = true; gainCard(c.id); });
    if (res.scene){ S.scenes[res.scene.id] = true; recordNew(sceneDefById(res.scene.id).key, res.scene.id); scenes++; sceneList.push(res.scene); }
    cards = cards.concat(res.cards);
  }
  const jokerPop = checkJokers();
  save();
  cards.sort((a, b) => rarRank(a) - rarRank(b));   // the best first (the top of the stack), the lowest last
  opening = { item, cards, all:true, fresh, scene:null, flipped:new Set(), done:false, scenes, sceneList, jokerPop, tix:window.PsychDen ? PsychDen.packFirst() : 0 };
  const ids = [...new Set(cards.map(c => c.id)), deckOf(item).back, deckOf(item).backUR, ...sceneList.map(sc => sc.id)];
  Promise.all(ids.map(x => { const im = new Image(); im.src = cardImg(x); return im.decode().catch(() => {}); })).then(showOpenAll);
}
/* Open all, shown as a stack: the front card big, the rest fanned out behind it to the right.
   Tap the front card to flip it, tap again (or swipe it left) for the next one. The flipped cards collect
   in a tray at the bottom. Double-tap the background to flip everything. Ends on a grid of all cards. */
function oaCardHTML(c, i){
  return `<button class="oa-c r-${rkey(c)}" data-i="${i}" style="--rc:${glowOf(c)}">
    <span class="oa-in"><img class="oa-b" src="${cardImg(backOf(c, c.rarity === 'ultimate'))}" alt=""><span class="oa-f"><img src="${cardImg(c.id)}" alt=""></span></span><span class="oa-tag"></span></button>`;
}
function showOpenAll(){
  const o = opening, ov = $('#pack'); if (!o) return;
  clearTimeout(packClear);
  o.idx = 0;
  ov.innerHTML = `<div class="oa2"><div class="oa-h"><b>${fmt(o.cards.length / o.item.cards)} ${esc(o.item.name)}s</b><span id="oaCount">1 / ${o.cards.length}</span></div>
    <div class="oa-stage">${o.cards.map(oaCardHTML).join('')}</div>
    ${hintHtml(HINT.all, 'oa-hint pk-hint')}
    <div class="oa-tray" id="oaTray"></div></div>`;
  ov.classList.add('open');
  oaFlick();
  ov.querySelectorAll('.oa-stage .oa-c').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); oaTap(+b.dataset.i); }));
  // swipe the front card left for the next one
  const st = ov.querySelector('.oa-stage');
  $('#oaTray').addEventListener('click', e => { const im = e.target.closest('img[data-id]'); if (!im) return; e.stopPropagation(); inspectCard(im.dataset.id); });   // tap a card in the tray to look at it
  onFlick(st, { min:50.001, ratio:0, onSwipe: dir => { if (dir < 0 && o.cards[o.idx] && o.flipped.has(o.idx)) oaNext(); } });
}
// the pile is flicked into the big stack, back card first (a tap anywhere skips it)
function oaFlick(){
  const o = opening; if (!o) return;
  if (S.reduceFx){ oaLayout(); return; }
  const st = document.querySelector('#pack .oa-stage'), cs = [...st.querySelectorAll('.oa-c')], h = st.offsetHeight, vis = cs.slice(0, 8);
  oaLayout();
  const fin = vis.map(b => ({ t:b.style.transform, f:b.style.filter, o:b.style.opacity }));
  vis.forEach((b, i) => { b.style.transition = 'none'; b.style.transform = `translateY(${h * .45}px) scale(.8)`; b.style.filter = 'none'; b.style.opacity = '1'; b.style.zIndex = i; });
  void st.offsetWidth;
  $('#pack').classList.add('dealing'); o.flicking = [];
  for (let i = vis.length - 1; i >= 0; i--) o.flicking.push(setTimeout(() => {
    const b = vis[i]; b.style.transition = 'transform 440ms cubic-bezier(.2,.8,.3,1), filter 440ms, opacity 440ms'; b.style.zIndex = 100 - i;
    b.style.transform = fin[i].t; b.style.filter = fin[i].f; b.style.opacity = fin[i].o;
    b.animate([{ rotate:'0deg' }, { rotate:(i % 2 ? -9 : 9) + 'deg', offset:.4 }, { rotate:'0deg' }], { duration:500, easing:'cubic-bezier(.2,.8,.3,1)' });
  }, (vis.length - 1 - i) * 60));
  o.flicking.push(setTimeout(() => oaFlickEnd(), vis.length * 60 + 520));
}
function oaFlickEnd(){
  const o = opening; if (!o || !o.flicking) return;
  o.flicking.forEach(clearTimeout); o.flicking = null; $('#pack').classList.remove('dealing');
  const cs = [...document.querySelectorAll('#pack .oa-stage .oa-c')];
  cs.forEach(b => { b.style.transition = 'none'; b.getAnimations().forEach(a => a.cancel()); });
  oaLayout(); void document.body.offsetWidth; cs.forEach(b => { b.style.transition = ''; });
}
function oaLayout(){
  const o = opening; if (!o || !o.all) return;
  document.querySelectorAll('#pack .oa-stage .oa-c').forEach(b => {
    const k = +b.dataset.i - o.idx;
    b.classList.toggle('front', k === 0);
    if (k < 0){ if (b.dataset.gone) return; b.style.transform = 'translateX(-130%) rotate(-12deg)'; b.style.opacity = '0'; b.style.pointerEvents = 'none'; return; }
    b.style.transform = `translateX(${k * 20}px) translateY(${k * 2}px) scale(${Math.max(.6, 1 - k * .06)})`;
    b.style.zIndex = 100 - k; b.style.opacity = k > 6 ? '0' : '1'; b.style.filter = k ? `brightness(${Math.max(.35, 1 - k * .12)})` : '';
    b.style.pointerEvents = k === 0 ? '' : 'none';
  });
  const c = $('#oaCount'); if (c) c.textContent = `${Math.min(o.idx + 1, o.cards.length)} / ${o.cards.length}`;
}
function oaTap(i){
  const o = opening; if (!o || !o.all || i !== o.idx) return;
  if (!o.flipped.has(i)){
    o.flipped.add(i);
    const btn = $(`#pack .oa-stage .oa-c[data-i="${i}"]`), c = o.cards[i];
    btn.classList.add('flipped'); { const tg = btn.querySelector('.oa-tag'); tg.classList.toggle('nw', !!o.fresh[c.id]); tg.innerHTML = o.fresh[c.id] ? 'NEW' : ''; }
    setTimeout(() => { if (opening === o) revealFX(btn, rkey(c)); }, 160);
  } else oaNext();
}
function oaNext(){
  const o = opening; if (!o) return;
  const c = o.cards[o.idx];
  const tray = $('#oaTray'); tray.insertAdjacentHTML('beforeend', `<img class="r-${c.rarity}" data-id="${c.id}" style="--rc:${RARITY[c.rarity].glow}" src="${cardImg(c.id)}" alt="">`);   // best stay on the left, newer ones follow (one line; the line never moves by itself, drag it to see the newer ones)
  if (!S.reduceFx && o.idx < o.cards.length - 1) oaMinimize($(`#pack .oa-stage .oa-c[data-i="${o.idx}"]`), tray.lastElementChild, tray);
  o.idx++;
  if (o.idx >= o.cards.length) return oaSummary();
  oaLayout();
}
// the front card shrinks down into its place in the drawer (instead of sliding off to the left)
function oaMinimize(b, im, tray){
  if (!b || !im) return;
  b.dataset.gone = '1'; b.style.pointerEvents = 'none';
  const cr = b.getBoundingClientRect(), tr = im.getBoundingClientRect(), box = tray.getBoundingClientRect();
  const tx = Math.min(tr.left, box.right - tr.width) + tr.width / 2, ty = tr.top + tr.height / 2;
  im.style.animation = 'none'; im.style.opacity = '0';
  b.style.transformOrigin = 'center'; b.style.zIndex = 200;
  b.style.transition = 'transform .45s cubic-bezier(.5,0,.2,1), opacity .15s ease-in .32s, filter .3s';
  b.style.transform = `translate(${tx - (cr.left + cr.width / 2)}px, ${ty - (cr.top + cr.height / 2)}px) scale(${tr.width / cr.width})`;
  b.style.opacity = '0';
  setTimeout(() => { im.style.transition = 'opacity .12s'; im.style.opacity = '1'; setTimeout(() => { im.style.transition = ''; im.style.opacity = ''; im.style.animation = ''; }, 160); }, 340);
}
// the same card pulled twice or more shows once, with ×N in its corner
function oaGroups(o){ const m = new Map(); o.cards.forEach((c, i) => { const g = m.get(c.id); if (g) g.n++; else m.set(c.id, { c, i, n:1 }); }); return [...m.values()]; }
function oaSummary(){
  const o = opening; if (!o) return;
  o.cards.forEach((_, i) => o.flipped.add(i)); o.summary = true;
  const ov = $('#pack');
  ov.innerHTML = `<div class="oa"><div class="oa-h"><b>${fmt(o.cards.length / o.item.cards)} ${esc(o.item.name)}s</b><span>${o.cards.length} ${pl(o.cards.length, 'card')}${oaGroups(o).length < o.cards.length ? ' · ' + oaGroups(o).length + ' unique · ' + (o.cards.length - oaGroups(o).length) + ' ' + pl(o.cards.length - oaGroups(o).length, 'duplicate') : ' · all unique'}</span></div>
    <div class="oa-grid">${oaGroups(o).map(g => oaCardHTML(g.c, g.i).replace('class="oa-c', 'class="oa-c flipped').replace('</button>', g.n > 1 ? `<span class="oa-q">×${g.n}</span></button>` : '</button>')).join('')}</div>  
    <div class="oa-foot">${hintHtml()}</div></div>`;
  ov.querySelectorAll('.oa-c').forEach(b => { const c = o.cards[+b.dataset.i]; { const tg = b.querySelector('.oa-tag'); tg.classList.toggle('nw', !!o.fresh[c.id]); tg.innerHTML = o.fresh[c.id] ? 'NEW' : ''; } b.addEventListener('click', e => { e.stopPropagation(); inspectCard(c.id); }); });
  // tap anywhere but a card (that opens the card) to go on: new scenes first, if any, then close
  o.done = false; setTimeout(() => { if (opening === o) o.done = true; }, 600);   // a short pause so the double-tap that got here doesn't skip it
  const best = ov.querySelector('.oa-c'); const top = o.cards[0]; if (best && rkey(top) !== 'common') setTimeout(() => revealFX(best, rkey(top)), 200);
}
function oaRevealAll(){ const o = opening; if (o && o.all && !o.done && !o.summary) oaSummary(); }

function initOpening(){
  $('#pack').addEventListener('click', e => {
    const o = opening; if (!o || o.done || !$('#pack .pk-card')) return;   // not on the scene screen
    if ($('#pack').classList.contains('dealing')){ e.stopPropagation(); e.preventDefault(); packDealSkip(); return; }   // a tap skips the deal
    if (e.target.closest('.pk-card')){ packTap = 0; return; }   // taps on a card only flip / open that card
    const t = performance.now();
    if (t - packTap < 350){ packTap = 0; e.stopPropagation(); e.preventDefault(); revealAll(); }
    else packTap = t;
  }, true);
  $('#pack').addEventListener('dblclick', e => e.preventDefault());
  // tapping empty space continues once every card is face up
  $('#pack').addEventListener('click', () => { const o = opening; if (o && o.done) afterReveal(); });
  (function(){
    let last = 0;
    $('#pack').addEventListener('click', e => {
      const o = opening; if (!o || !o.all || o.done) return;
      if (o.flicking){ e.stopPropagation(); e.preventDefault(); oaFlickEnd(); return; }   // a tap skips the flick
      if (o.summary){ e.stopPropagation(); return; }   // the list of all cards: taps wait for the short pause
      if (e.target.closest('.oa-c') || e.target.closest('#oaTray img')){ last = 0; return; }   // the card handles its own tap
      e.stopPropagation();
      const t = performance.now(); if (t - last < 350){ last = 0; oaRevealAll(); } else last = t;
    }, true);
  })();
  $('#openAllBtn').addEventListener('click', e => { e.stopPropagation(); openAll(e.currentTarget.dataset.item); });
}
