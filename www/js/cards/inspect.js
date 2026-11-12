/* Card inspect view: zoom, holo tilt, long-press to inspect. */
/* ---- Looking at one card ---- */
const EYE_SVG = `<button class="in-eye" aria-label="Hide text and effects">${ico('i-eye', '0 0 24 24')}</button>`;
function inspectCard(id, isScene, isLand){
  $('#inspect').classList.remove('art', 'locked');
  if (/^HD_DUO\d/.test(id)){   // a joined Duo picture
    const k = +id.slice(6), pr = CARDS.filter(c => c.set === 'Duo').sort((a, b) => a.id.localeCompare(b.id)).slice(k * 2 - 2, k * 2), ov = $('#inspect');
    ov.innerHTML = `<div class="in-wrap land"><div class="in-card"><img src="${cardImg(id)}" alt=""></div><div class="in-name">${pr.map(c => esc(c.name)).join(' &amp; ')}</div><div class="in-stars">${pr.map(c => starBar(cardLv(c.id))).join('')}</div><div class="in-meta"><b style="color:${RARITY.rare.color}">R</b> · Duo · Owned ×${ownedCard(pr[0].id)} / ×${ownedCard(pr[1].id)}</div>${EYE_SVG}</div>`;
    ov.classList.add('open'); inspectZoom(ov); return;
  }
  const sd = isScene ? sceneDefById(id) : null, c = isScene ? (sd && sd.list.find(x => x.id === id)) : CARD_BY_ID[id]; if (!c) return;
  const ov = $('#inspect');
  const top3 = !isScene && (c.rarity === 'ultimate' || c.rarity === 'legendary' || c.joker), holo = top3 && !S.reduceFx;   // Reduce effects: UR / SSR / J get the plain glare instead of the tilt; SR and R get nothing   // UR, SSR and J tilt with your finger and catch the light; SR and R keep the sweeping glare; C has neither
  ov.innerHTML = `<div class="in-wrap${isScene || isLand ? ' land' : ''}${isScene ? ' sc' : ''}">
    <div class="in-card${holo ? ' holo' : ''}"><img src="${isLand ? landImg(id) : cardImg(id)}" alt="">${holo ? '<span class="in-foil"></span>' : !isScene && (top3 || (!S.reduceFx && (c.rarity === 'epic' || c.rarity === 'rare'))) ? `<span class="pk-glare in-glare${c.rarity === 'epic' || c.rarity === 'rare' ? ' in-slow' : ''}"></span>` : ''}</div>
    <div class="in-name">${esc(c.name)}</div>
    ${isScene ? '' : `<div class="in-stars">${starBar(cardLv(id))}</div>`}
    ${isScene ? `<div class="in-meta">${sd.one}</div>` : `${flavorOf(id) ? `<p class="in-flavor">${esc(flavorOf(id))}</p>` : ''}<div class="in-meta">${rarBadge(c)} · ${esc(setLabel(c.set))}${c.hero ? ' · ' + esc(c.hero) : ''} · Owned ×${ownedCard(id)} · Collected ×${cardTotal(id)}</div>`}
    ${EYE_SVG}
  </div>`;
  ov.classList.add('open'); inspectZoom(ov);
  if (holo) holoTilt(ov.querySelector('.in-card'));
}
// the card grows out of the tile you tapped, and shrinks back into it when the card view closes
var inspectFrom = null;
function inspectZoom(ov){
  const src = inspectFrom; inspectFrom = null; ov.classList.remove('zoom'); ov._src = null;
  const img = ov.querySelector('.in-card'); if (!src || !img || S.reduceFx || !src.isConnected) return;   // the whole card (picture + shine layers) moves
  const s = (src.querySelector('img') || src).getBoundingClientRect(); if (!s.width) return;
  ov.classList.add('zoom'); ov._src = src;
  const t = img.getBoundingClientRect();
  img.animate([{ transform:`translate(${s.left + s.width / 2 - (t.left + t.width / 2)}px,${s.top + s.height / 2 - (t.top + t.height / 2)}px) scale(${s.width / t.width})` }, { transform:'none' }], { duration:MOTION.norm, easing:MOTION.arrive });
  ov.animate([{ backgroundColor:'rgba(5,11,12,0)' }, { backgroundColor:'rgba(5,11,12,.94)' }], { duration:300, easing:'ease-out' });
}
// drag on a UR / SSR / J card: it tilts toward the finger and a soft light follows
function holoTilt(card){
  if (!card) return;
  const ov = $('#inspect');
  const move = e => {
    if (ov.classList.contains('art')) return;
    const r = card.getBoundingClientRect(), t = e.touches ? e.touches[0] : e;
    const x = Math.min(1, Math.max(0, (t.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (t.clientY - r.top) / r.height));
    card.style.transform = `perspective(700px) rotateY(${(x - .5) * 30}deg) rotateX(${(.5 - y) * 30}deg)`;
    card.style.setProperty('--px', (x * 100) + '%'); card.style.setProperty('--py', (y * 100) + '%'); card.classList.add('hot');
  };
  const rest = () => { card.style.transform = ''; card.classList.remove('hot'); };
  card.addEventListener('pointermove', move); card.addEventListener('touchmove', move, { passive:true });
  card.addEventListener('pointerleave', rest); card.addEventListener('touchend', rest); card.addEventListener('pointercancel', rest);
}
function closeInspect(){
  const ov = $('#inspect'), src = ov._src, img = ov.querySelector('.in-card'); ov._src = null;
  if (!ov.classList.contains('open') || !src || !src.isConnected || !img || S.reduceFx || ov.classList.contains('art')){ ov.classList.remove('open', 'zoom'); return; }
  const s = (src.querySelector('img') || src).getBoundingClientRect(), t = img.getBoundingClientRect();
  if (!s.width || s.bottom < 0 || s.top > innerHeight){ ov.classList.remove('open', 'zoom'); return; }
  ov.classList.add('closing');
  img.animate([{ transform:'none' }, { transform:`translate(${s.left + s.width / 2 - (t.left + t.width / 2)}px,${s.top + s.height / 2 - (t.top + t.height / 2)}px) scale(${s.width / t.width})` }], { duration:MOTION.norm, easing:MOTION.leave, fill:'forwards' });
  ov.animate([{ backgroundColor:'rgba(5,11,12,.94)' }, { backgroundColor:'rgba(5,11,12,0)' }], { duration:300, easing:'ease-in', fill:'forwards' }).onfinish = () => { ov.getAnimations().forEach(a => a.cancel()); img.getAnimations().forEach(a => a.cancel()); ov.classList.remove('open', 'zoom', 'closing'); };
}

function initInspect(){
  // while the card view is open, a finger or wheel on it never scrolls the page behind
  ['touchmove','wheel'].forEach(t => document.addEventListener(t, e => { if ($('#inspect').classList.contains('open')) e.preventDefault(); }, { passive:false, capture:true }));
  // tap closes; press and hold the card to see only the art (bigger, no text), let go to come back
  (function(){
    const ov = $('#inspect'); let held = 0;
    onHold(ov, { ms:350, leave:true, swallow:false, start: e => e.target.closest('.in-card'),
      onHold: () => { held = performance.now(); ov.classList.add('art'); },
      release: () => { if (ov.classList.contains('art')) held = performance.now(); if (!ov.classList.contains('locked')) ov.classList.remove('art'); } });
    ov.addEventListener('contextmenu', e => e.preventDefault());
    ov.addEventListener('click', e => {
      if (e.target.closest('.in-eye')){
        const cd = ov.querySelector('.in-wrap.land .in-card');   // Chapter / Realm pictures are wide: the eye turns the picture on its side so it fills the screen
        if (cd){ const w = cd.offsetWidth, h = cd.offsetHeight; if (w && h) ov.style.setProperty('--rs', Math.min(innerWidth * .96 / h, innerHeight * .94 / w).toFixed(3)); }
        ov.classList.add('art', 'locked'); held = performance.now(); return; }   // the eye: hide the effects and all the text until the next tap
      if (ov.classList.contains('locked')){ ov.classList.remove('art', 'locked'); held = performance.now(); return; }
      if (performance.now() - held < 400) return; closeInspect(); });
  })();
}
