/* Pack tab: pack wheel, swipe between packs. */
/* ---- Deck tab: one deck type at a time, shown as a stack (up to 4 deep) ---- */
var invIdx = 0;   // var, not let: the app may draw this tab before this line runs
/* Deck tab on a phone: swipe left / right to switch decks, swipe up to open one (taps still work) */

// switching packs: only the pack moves (out along the wheel, the next one in from where it peeked);
// name, numbers, UR bar and colours change in place
let invSliding = 0;
const invNumTween = (el, from, to, dur) => { if (from !== to) countTo(el, from, to, dur, { every: 45 }); };   // ~20 updates a second is plenty
// packs sit on a large hidden wheel: dragging turns it, packs leave and arrive along its arc
const WH_R = 1600;
function wheelS(){ return Math.min(WH_R * .9, innerWidth * .8); }   // how far the next pack waits off to the side
function wheelSet(dx, st){
  const R = WH_R, S0 = wheelS(), A = Math.asin(S0 / R), stage = st.parentNode; st._wdx = dx;
  const a = Math.asin(Math.max(-.95, Math.min(.95, dx / R))), pos = ang => `translate(${R * Math.sin(ang)}px,${R * (1 - Math.cos(ang))}px) rotate(${ang}rad)`;
  // packs fade out before they reach the edge of the screen, so there is never a hard cut line
  if (st._lim == null){ let e = stage, l = innerWidth; for (; e && e !== document.documentElement; e = e.parentNode){ const o = getComputedStyle(e).overflowX; if (o !== 'visible'){ const r = e.getBoundingClientRect(), c = stage.getBoundingClientRect(), m = c.left + c.width / 2; l = Math.min(l, m - r.left, r.right - m); break; } } st._lim = Math.max(120, Math.min(l, innerWidth / 2)); }
  const fade = off => Math.max(0, Math.min(1, 1 - (Math.abs(off) - st._lim * .8) / (st._lim * .45)));
  st.style.transform = pos(a); st.style.opacity = fade(R * Math.sin(a));
  const sign = dx < 0 ? 1 : -1, g = stage.querySelector(sign > 0 ? '.nbw.r' : '.nbw.l'), o = stage.querySelector(sign > 0 ? '.nbw.l' : '.nbw.r');
  if (o) o.style.visibility = 'hidden';
  if (g){ g.style.visibility = 'visible'; g.firstElementChild.style.transform = pos(a + sign * A); g.firstElementChild.style.opacity = fade(R * Math.sin(a + sign * A)); }
  // the pack colours (Open all, UR bar, name, glow) blend toward the next pack's colours as the wheel turns
  const inv = st.closest('.inv'), obx = $('#openAllBtn');
  if (inv && g){
    const hex = v => { v = (v || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)) : null; };
    const c0 = st._th0 || (st._th0 = hex(getComputedStyle(inv).getPropertyValue('--ac'))), c1 = hex(getComputedStyle(g).getPropertyValue('--ac')), p2 = Math.min(1, Math.abs(dx) / S0);
    if (c0 && c1){ const m = c0.map((v, i) => Math.round(v + (c1[i] - v) * p2)); [inv, obx].forEach(e => { if (!e) return; e.style.setProperty('--ac', `rgb(${m})`); e.style.setProperty('--acr', m.join(',')); }); }
  }
  // Open all (top right) fades with the wheel when the next pack has fewer than 2 (or this one does)
  const ob = $('#openAllBtn'); if (ob && g){ const cur = (+ob.dataset.n || 0) >= 2, nb = (+g.dataset.n || 0) >= 2, p = Math.min(1, Math.abs(dx) / S0);
    const num = ob.querySelector('.oa-n'); if (num && !cur && nb) num.textContent = fmt(+g.dataset.n);   // fading in: show the next pack's number, never ×0 / ×1
    ob.hidden = !(cur || nb); ob.style.opacity = cur && nb ? '' : cur ? String(1 - p) : nb ? String(p) : ''; }
}
function wheelRun(st, to, dur, done){
  tween(st._wdx || 0, to, dur, (v, k) => { wheelSet(v, st); if (k >= 1 && done) done(); }, { delay: 1e-6 });
}
function wheelOff(st){ st._wdx = 0; { const ob = $('#openAllBtn'), num = ob && ob.querySelector('.oa-n'); if (num) num.textContent = fmt(+ob.dataset.n || 0); } st._th0 = null; st._lim = null; st.style.opacity = ''; [st.closest('.inv'), $('#openAllBtn')].forEach(e => { if (e){ e.style.removeProperty('--ac'); e.style.removeProperty('--acr'); } }); const ob = $('#openAllBtn'); if (ob){ ob.style.opacity = ''; ob.hidden = (+ob.dataset.n || 0) < 2; } st.style.transform = ''; st.parentNode.querySelectorAll('.nbw').forEach(g => { g.style.visibility = 'hidden'; g.firstElementChild.style.transform = ''; g.firstElementChild.style.opacity = ''; }); }
function invSlide(dir, st){
  st = st || document.querySelector('.inv-stack');
  const stage = document.querySelector('.dka-stage'), inv = st && st.closest('.inv');
  if (!st || !stage || !stage.querySelector('.nbw') || !inv || S.reduceFx){ invGo(dir); return; }
  invSliding = performance.now();
  // what is on screen now, to animate from
  const was = { cls:inv.className.replace(/\s*sliding/, ''), name:(inv.querySelector('.inv-name') || {}).textContent || '',
    nums:[...inv.querySelectorAll('.dka-stats .nv')].map(x => +x.dataset.v), slots:[...inv.querySelectorAll('.ur-slots i:not(.ur)')].map(x => x.classList.contains('on')) };
  const dotWas = [...inv.querySelectorAll('.inv-dots button')].findIndex(x => x.classList.contains('on'));
  const ob = $('#openAllBtn'), obWas = { n:+ob.dataset.n || 0, hidden:(+ob.dataset.n || 0) < 2, cls:ob.className };
  inv.classList.add('sliding');
  st.style.animation = 'none'; st.style.transition = 'none';
  wheelRun(st, -dir * wheelS(), 140 + 200 * (1 - Math.min(1, Math.abs(st._wdx || 0) / wheelS())), () => {
    invIdx += dir; render();
    const v = document.querySelector('.inv'), n = v && v.querySelector('.inv-stack'); if (!n) return;
    // colours: draw once in the old pack's colours, then switch so every colour fades across
    // (the colours already blended while the wheel turned)
    v.querySelectorAll('.dka-ghost, .dka-stage').forEach(x => x.classList.add('fade-in'));
    dotHl(v.querySelector('.inv-dots'), true, dotWas);
    // Open all stays put: its count and colour change in place
    const on = +ob.dataset.n || 0, num = ob.querySelector('.oa-n');
    if (!obWas.hidden && !ob.hidden){ if (num) invNumTween(num, obWas.n, on, 450); }
    // (fading in / out is done by the wheel itself while it turns)
    // the name slides out and the new one slides in from the swipe side
    const nm = v.querySelector('.inv-name');
    if (nm && was.name !== nm.textContent){ const nw = nm.textContent;
      nm.innerHTML = `<span class="nm-box"><span class="nm-o" style="--d:${-dir}">${esc(was.name)}</span><span class="nm-n" style="--d:${dir}">${esc(nw)}</span></span>`;
      setTimeout(() => { if (nm.isConnected) nm.textContent = nw; }, 460); }
    // numbers count to their new value (the / stays)
    v.querySelectorAll('.dka-stats .nv').forEach((x, i) => { if (was.nums[i] != null) invNumTween(x, was.nums[i], +x.dataset.v, 450); });
    // UR bar: start as it was, then each box fills or empties in turn
    const sl = [...v.querySelectorAll('.ur-slots i:not(.ur)')];
    if (sl.length === was.slots.length){ const target = sl.map(x => x.classList.contains('on')); const box = v.querySelector('.ur-slots'); box.classList.add('nt'); sl.forEach((x, i) => x.classList.toggle('on', was.slots[i])); void box.offsetWidth; box.classList.remove('nt');   // start exactly as it was, no movement
      const order = target.map((t, i) => i).filter(i => target[i] !== was.slots[i]); if (order.some(i => !target[i])) order.reverse();
      const gap = Math.min(55, 300 / Math.max(1, order.length));   // the whole wave takes about as long as the pack's glide
      order.forEach((i, m) => setTimeout(() => { if (sl[i].isConnected) sl[i].classList.toggle('on', target[i]); }, 40 + m * gap)); }
  });
}
function invGo(d){ const was = invIdx; invIdx += d; render(); dotHl(document.querySelector('.inv-dots'), true, ((was % invItems().length) + invItems().length) % invItems().length); const st = document.querySelector('.inv-stack'); if (st) st.classList.add(d > 0 ? 'in-r' : 'in-l');
  const nm = document.querySelector('.inv-name'); if (nm) nm.classList.add('in'); }
function invItems(){ return SHOP; }
function invRelease(s0, dx, dy, cancel){
  const st = s0.st, items = invItems();
  const back = () => { if (S.reduceFx || s0.axis !== 'x'){ st.style.transition = 'transform .28s cubic-bezier(.3,1.4,.5,1)'; st.style.transform = ''; setTimeout(() => { st.style.transition = ''; st.style.animation = ''; }, 300); return; }
    wheelRun(st, 0, 260, () => { wheelOff(st); st.style.transition = ''; st.style.animation = ''; }); };
  if (cancel) return back();
  if (s0.axis === 'x' && (Math.abs(dx) > 50 || (Math.abs(dx) > 18 && Math.abs(s0.v || 0) > .45)) && items.length > 1){   // far enough, or a quick flick
    const dir = dx < 0 ? 1 : -1;
    invSlide(dir, st);
    return;
  }
  if (s0.axis === 'y' && dy < -60){
    const it = items[((invIdx % items.length) + items.length) % items.length];
    if (packCount(it.id) && !opening){ st.style.transition = 'transform .17s ease-in, opacity .17s'; st.style.transform = 'translateY(-120px) scale(.95)'; st.style.opacity = '0';
      setTimeout(() => useItem(it.id), 160); return; }
  }
  back();
}
/*    One big tilted deck with a holo shine, the neighbouring decks faded at the sides, a count badge,
   Opened / Collected, the UR guarantee bar and page dots. Swipe up (or tap) to open, sideways to switch. */
function renderInventory(){
  const items = SHOP;
  if (!items.length) return '<div class="empty">Nothing here yet.</div>';
  invIdx = ((invIdx || 0) % items.length + items.length) % items.length;
  const it = items[invIdx], n = packCount(it.id), opened = (S.opened && S.opened[it.id]) || 0, D = deckOf(it);
  const all = CARDS.filter(c => c.deck === it.deck), got = all.filter(c => ownedCard(c.id)).length;
  const prev = items[(invIdx + items.length - 1) % items.length], next = items[(invIdx + 1) % items.length];
  const pity = it.pity ? Math.min(it.pity, (S.pity && S.pity[it.id]) || 0) : 0;
  const dots = items.length > 1 ? `<div class="inv-dots">${items.map((x, k) => `<button class="${k === invIdx ? 'on' : ''}" data-act="invdot" data-k="${k}" aria-label="${esc(x.name)}"></button>`).join('')}</div>` : '';
  const ob = $('#openAllBtn'); if (!ob.querySelector('.oa-n')) ob.innerHTML = 'Open all ×<i class="oa-n"></i>';   // fixed width; the number counts when switching packs
  ob.hidden = n < 2; ob.style.opacity = ''; ob.style.removeProperty('--ac'); ob.style.removeProperty('--acr'); ob.dataset.item = it.id; ob.dataset.n = n; ob.querySelector('.oa-n').textContent = fmt(n); ob.className = 'open-all th-' + it.deck;
  return `<div class="inv dka th-${it.deck}${n ? '' : ' none'}">
    <div class="dka-stage">
      <div class="inv-stack" data-act="${n ? 'useitem' : 'goshop'}" data-item="${it.id}">
        <div class="inv-layer top${n ? '' : ' dim'}"><img src="${D.cover}" alt=""><i class="dka-holo"></i></div>
        ${n ? `<span class="dka-cnt">×${fmt(n)}</span>` : ''}
      </div>
      ${items.length > 1 ? [[prev, 'l'], [next, 'r']].map(([x, sd]) => { const nx = packCount(x.id), Dx = deckOf(x); return `<div class="nbw ${sd} dka th-${x.deck}${nx ? '' : ' none'}" data-n="${nx}"><div class="inv-stack"><div class="inv-layer top${nx ? '' : ' dim'}"><img src="${Dx.cover}" alt=""><i class="dka-holo"></i></div>${nx ? `<span class="dka-cnt">×${fmt(nx)}</span>` : ''}</div></div>`; }).join('') : ''}
    </div>
    <div class="inv-name">${esc(it.name.replace(/ Pack$/, ""))}</div>
    <div class="inv-hint dka-hint" data-act="${n ? 'useitem' : 'goshop'}" data-item="${it.id}">${n ? 'SWIPE UP TO OPEN' : 'GET MORE IN SHOP'}</div>
    <div class="dka-stats"><div><span>Opened</span><b><i class="nv" data-v="${opened}">${fmt(opened)}</i></b></div><div><span>Collected</span><b><i class="nv" data-v="${got}">${got}</i>/<i class="nv" data-v="${all.length}">${all.length}</i></b></div></div>
    ${it.pity ? `<div class="ur-slots" title="UR guaranteed in ${it.pity - pity}">${Array.from({ length:it.pity }, (_, i) => i === it.pity - 1
      ? '<i class="ur"><b>UR</b></i>' : `<i class="${i < pity ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    ${dots}
  </div>`;
}

function initInventory(){
  $('#panel').addEventListener('click', e => {
    const el = e.target.closest('[data-act="invdot"],[data-act="goshop"]'); if (!el) return;
    if (el.dataset.act === 'invdot'){ const k = +el.dataset.k, d = k - invIdx; if (d && performance.now() - invSliding > 420){ if (Math.abs(d) === 1) invSlide(d); else invGo(d); } return; }
    else document.querySelector('.tab[data-tab="shop"]').click();
  });
  // the whole Deck screen is the swipe area; the deck follows your finger
  // drag the pack: sideways switches pack, up opens it
  onDrag($('#panel'), { axis:'xy', slop:10,
    start: e => { if (S.tab !== 'inventory' || opening || !e.target.closest('.inv') || e.target.closest('.inv-dots') || performance.now() - invSliding < 400) return null;
      const st = document.querySelector('.inv-stack'); return st ? { st } : null; },
    begin: s0 => { s0.st.style.animation = 'none'; s0.st.style.transition = 'none'; },
    move: (s0, dx, dy) => {
      if (s0.axis === 'x'){ if (S.reduceFx) s0.st.style.transform = `translateX(${dx}px)`; else { const S0 = wheelS(); wheelSet(Math.max(-S0, Math.min(S0, dx * 1.3)), s0.st); } }
      else s0.st.style.transform = `translateY(${Math.min(0, dy) * .7}px) scale(${1 - Math.min(0, dy) / -2000})`;
    },
    end: (s0, dx, dy) => invRelease(s0, dx, dy),
    cancel: (s0, dx, dy) => invRelease(s0, dx, dy, true),
    swallow: e => !!e.target.closest('.inv') });   // a swipe shouldn't also count as a tap
}
