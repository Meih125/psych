/* Drawing: header, tabs, panel morphing, render(), countdown ticks, image preloading. */
// after every redraw: loaded pictures show at once, the rest fade in; dot highlights are placed
const FADE_IMG = '#panel .col-grid img, #panel .col-duo img, #panel .col-scenes img, #panel .col-fan img, #panel .pk-row img, #panel .cc-pv img, #panel .pz-strip img';
var lastStreaks = {}, lastRing = null, lastDay = null, lastEarn = null;
// other tabs' pictures preload while the app is idle
var preloaded = false;
function preloadPics(){
  if (preloaded) return; preloaded = true;
  const urls = [...new Set([...SHOP.map(x => deckOf(x).cover), ...SHOP.flatMap(x => [...(x.fan || []), ...(x.pop || []), ...(x.pbg || [])]).map(cardImg)])];   // only the pack art (a few pictures); the cards load as you scroll to them
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining:() => 8 }), 200));
  let i = 0; const step = dl => { while (i < urls.length && dl.timeRemaining() > 2){ const im = new Image(); im.decoding = 'async'; im.src = urls[i++]; } if (i < urls.length) idle(step); };
  setTimeout(() => idle(step), 4000);
}
let offObs = null;
function watchLoops(){
  if (!('IntersectionObserver' in window)) return;
  if (!offObs) offObs = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('offs', !e.isIntersecting)), { rootMargin: '80px 0px' });
  document.querySelectorAll('#panel :is(.cc-chip.ready,.set-claim.ready,.sh-latest,.sh-col,.dka-holo,.inv-stack,.dl-btn.ready,.xpbar.boss,.chip.s,.hud-wk button.s,.flame)').forEach(el => { if (!el._ob){ el._ob = 1; offObs.observe(el); } });
}
function afterRender(){
  preloadPics(); watchLoops();
  const fx = !S.reduceFx;
  if (S.tab === 'quests'){
    // streak numbers roll on change; the done ring sweeps from its old value
    const now = {};
    document.querySelectorAll('#panel .qb-item[data-id]').forEach(it => { const b = it.querySelector('.cy-streak .nn b'); if (!b) return; const n = +b.textContent.replace(/\D/g, '') || 0; now[it.dataset.id] = n;
      if (fx && lastStreaks[it.dataset.id] != null && lastStreaks[it.dataset.id] !== n) rollNum(b, lastStreaks[it.dataset.id], n); });
    lastStreaks = now;
    // Earned today counts up (or down after an Undo) to its new numbers
    const ets = [...document.querySelectorAll('#panel .qb-sumw .et')].map(x => +x.dataset.v || 0);
    if (fx && lastEarn) document.querySelectorAll('#panel .qb-sumw .et').forEach((x, i) => { if (lastEarn[i] != null && lastEarn[i] !== ets[i]){ const a = lastEarn[i], b = ets[i]; x.textContent = fmt(a); setTimeout(() => invNumTween(x, a, b, 600), 500); } });   // waits for the rewards to fly first
    lastEarn = ets;
    const ring = document.querySelector('#panel .qb-ring circle + circle');
    if (ring){ const da = ring.getAttribute('stroke-dasharray'), col = ring.getAttribute('stroke');
      if (fx && lastRing && lastRing.da !== da){ ring.style.transition = 'none'; ring.setAttribute('stroke-dasharray', lastRing.da); ring.setAttribute('stroke', lastRing.col); void ring.getBoundingClientRect();
        ring.style.transition = 'stroke-dasharray .7s cubic-bezier(.3,.8,.3,1), stroke .6s ease, filter .6s ease'; ring.setAttribute('stroke-dasharray', da); ring.setAttribute('stroke', col); }
      lastRing = { da, col }; }
    // a new day: the quests light back up one after another, top to bottom
    const dk = dayKey();
    if (fx && lastDay && lastDay !== dk) [...document.querySelectorAll('#panel .card.qb-t:not(.done)')].slice(0, 30).forEach((c, i) => c.animate([{ opacity:.35, filter:'saturate(.3)' }, { opacity:1, filter:'none' }], { duration:450, delay:i * 70, easing:'ease-out', fill:'backwards' }));
    lastDay = dk;
  }
  if (!S.reduceFx) document.querySelectorAll(FADE_IMG).forEach(i => { if (i.complete && i.naturalWidth) i.classList.add('ld'); else i.classList.add('fi'); });   // Reduce effects: pictures just appear
  document.querySelectorAll('.sh-dots, .inv-dots').forEach(c => dotHl(c, false));
}
// the pill on a row of dots stretches from the old dot to the new one (like the tab bar)
function dotHl(c, anim, from){
  if (!c) return; let hl = c.querySelector(':scope > .dot-hl'); if (!hl){ hl = document.createElement('b'); hl.className = 'dot-hl'; c.prepend(hl); }
  const dots = [...c.children].filter(x => x !== hl), on = dots.find(x => x.classList.contains('on')); if (!on){ hl.style.opacity = 0; return; }
  const w = c.classList.contains('inv-dots') ? 18 : 16, x = on.offsetLeft + on.offsetWidth / 2 - w / 2; hl.style.opacity = '';
  clearTimeout(hl.tm);
  const old = from != null && dots[from] ? dots[from].offsetLeft + dots[from].offsetWidth / 2 - w / 2 : null;
  if (!anim || S.reduceFx || old == null){ jump(hl, () => { hl.style.left = x + 'px'; hl.style.width = w + 'px'; }); return; }
  jump(hl, () => { hl.style.left = old + 'px'; hl.style.width = w + 'px'; });
  const a = Math.min(x, old), b = Math.max(x, old) + w; hl.style.left = a + 'px'; hl.style.width = (b - a) + 'px';
  hl.tm = setTimeout(() => { hl.style.left = x + 'px'; hl.style.width = w + 'px'; }, 170);
}
const TAB_TITLES = { quests:'Quests', progress:'Progress', inventory:'Pack', collection:'Collection', shop:'Shop' };
let freshTile = { id:null, row:null };
let arranging = false;
let goldShown = 0;
let xpShown = null;
// roll one number's digits (the streak) from an old value to the new one, in place
function rollNum(el, from, to){
  const a = String(from), b = String(to); if (a === b) return;
  const pad = Math.max(a.length, b.length), A = a.padStart(pad, ' '), B = b.padStart(pad, ' ');
  const Y = ch => ch === ' ' ? 1.15 : -ch * 1.15;   // each digit line is 1.15em tall (.od.rl), so the steps are too
  el.innerHTML = [...B].map((ch, i) => `<span class="od rl"><i style="transform:translateY(${Y(A[i])}em)">0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9</i></span>`).join('');
  void el.offsetWidth;
  [...el.querySelectorAll('i')].forEach((r, i) => { r.style.transform = `translateY(${Y(B[i])}em)`; });
  const seq = el._rn = (el._rn || 0) + 1;   // a newer roll on the same number wins
  setTimeout(() => { if (el.isConnected && el._rn === seq) el.textContent = b; }, 650);
}
// header gold: ticks up (or down) to the new amount like Earned today does, after `delay` ms (instant = just draw it)
function goldRoll(v, delay, instant){
  const el = $('#gold'); el.setAttribute('aria-label', fmt(v));
  const seq = goldRoll.seq = (goldRoll.seq || 0) + 1;   // a newer amount cancels the one still counting
  if (goldRoll.stop){ goldRoll.stop(); goldRoll.stop = null; }
  const from = goldRoll.cur == null ? v : goldRoll.cur;
  if (instant || S.reduceFx || from === v){ goldRoll.cur = v; el.textContent = fmt(v); return; }
  const up = v >= from;
  setTimeout(() => {
    if (seq !== goldRoll.seq) return;
    goldRoll.stop = countTo(el, from, v, 600, { every: 45, show: x => { goldRoll.cur = x; return fmt(Math.round(x)); } });
    replay(el, ['num-pop', up ? 'g-up' : 'g-dn'], ['num-pop', 'g-up', 'g-dn']);
  }, delay || 0);
}
// back from the background: show the real amount, whatever a paused count left behind
function goldSettle(){ if (renderHeader.hold || renderHeader.holdAll || renderHeader.luLock) return; const g = S.gold - (renderHeader.lvHold || 0); goldRoll(g, 0, true); goldShown = g; }
function renderHeader(){
  if (renderHeader.holdAll) return;   // a reward is waiting for its animation (grant with wait): show nothing new yet
  if (renderHeader.hold){   // a claim is in flight: only refresh gold now, XP comes with the gems
    if (renderHeader.tween){ renderHeader.tween = false; const g = S.gold - (renderHeader.lvHold || 0); if (g !== goldShown){ goldRoll(g, 620); goldShown = g; } }   // no change (a quest that pays no gold): the purse stays put
    return;
  }
  const delay = renderHeader.delay || 0; renderHeader.delay = 0;
  const leveled = renderHeader.fillFull; renderHeader.fillFull = false;
  const apply = () => {
    const { L, into, need } = levelInfo(S.xp);
    if (renderHeader.luLock && !leveled) return;   // a header level-up is playing: it sets the bar, emblem and rank itself
    if (leveled){   // the header level-up (hdrLevelUp) shows the new level: keep the old look until then, bar full
      const fill = $('#xpFill'); fill.style.width = '100%'; $('.xpbar').style.setProperty('--xw', '100%'); $('.xpbar').classList.add('full'); $('#xpText').textContent = 'LEVEL UP'; xpShown = into;
      renderHeader.luLock = true; clearTimeout(renderHeader.luSafe); renderHeader.luSafe = setTimeout(() => { if (renderHeader.luLock){ renderHeader.luLock = false; renderHeader(); } }, 7000); return;
    }
    if (renderHeader.lastL !== L){ $('#lvlEmblem').innerHTML = emblem(L); renderHeader.lastL = L; }
    $('#lvlText').textContent = RANKS[tierOf(L)];
    $('#lvA').textContent = `Lv ${L}`; $('#lvB').textContent = `Lv ${L + 1}`;
    const fill = $('#xpFill'), txt = $('#xpText');
    $('.xpbar').classList.toggle('boss', isBossStep(L));
    $('#lvlText').classList.toggle('boss', isBossStep(L));
    if (isBossStep(L)) $('#lvlText').style.removeProperty('color'); else $('#lvlText').style.setProperty('color', TIER_COL[tierOf(L)], 'important');   // rank name in its rank colour
    if (isBossStep(L) && tierOf(L + 1) !== tierOf(L)) $('#lvlText').textContent = `${RANKS[tierOf(L)]} · Promotion to ${RANKS[tierOf(L + 1)]}`;
    if (leveled){
      // level up: run the bar to the end, flash it, then start the new level from empty
      fill.style.width = '100%'; $('.xpbar').style.setProperty('--xw', '100%'); $('.xpbar').classList.add('full'); txt.textContent = 'LEVEL UP';
      setTimeout(() => {
        const fr = fill.getBoundingClientRect(); FX.small(fr.right, fr.top + fr.height / 2);
        $('.xpbar').classList.remove('full');
        jump(fill, () => { fill.style.width = '0%'; });
        const li = levelInfo(S.xp); fill.style.width = (li.into / li.need * 100) + '%'; $('.xpbar').style.setProperty('--xw', fill.style.width);
        txt.textContent = `${fmt(li.into)} / ${fmt(li.need)} XP`; xpShown = li.into;
      }, 800);
    } else {
      fill.style.width = (into / need * 100) + '%'; $('.xpbar').style.setProperty('--xw', fill.style.width);
      if (delay && xpShown != null && xpShown < into) countUpText(txt, xpShown, into, need, 600);
      else txt.textContent = `${fmt(into)} / ${fmt(need)} XP`;
      xpShown = into;
    }
  };
  delay ? setTimeout(apply, delay) : apply();
  if (renderHeader.tween){
    renderHeader.tween = false;
    if (S.gold - (renderHeader.lvHold || 0) !== goldShown) goldRoll(S.gold - (renderHeader.lvHold || 0), 620);
  } else if (goldShown !== S.gold - (renderHeader.lvHold || 0) || !$('#gold').textContent) goldRoll(S.gold - (renderHeader.lvHold || 0), 0, true);
  $('#purse').classList.toggle('neg', S.gold < 0);   // owing gold shows in red
  goldShown = S.gold - (renderHeader.lvHold || 0);
}
function countUpText(el, from, to, need, dur){
  countTo(el, from, to, dur, { show: v => `${fmt(Math.round(v))} / ${fmt(need)} XP`, delay: 1e-6 });
}
// quests that count toward the done ring (and the group counts): things you finish once per cycle
const ringQuest = q => isVisible(q) && !['scaling', 'counter', 'tally', 'bounty', 'steps'].includes(q.kind) && !(q.kind === 'record' && q.noReset);
function renderTabs(){
  const sq = firstSteps();
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === S.tab);
    // an orange dot: a step goal bonus waiting (Progress), a set ready to claim (Collection)
    b.classList.toggle('ping', b.dataset.tab === 'progress' ? goalWaiting(sq) : b.dataset.tab === 'collection' ? colClaimable() : false);
  });
  tabHl(tabHl.last != null && tabHl.last !== S.tab);
  tabHl.last = S.tab;
}
// the box behind the open tab stretches toward the new tab, then its back end catches up
function tabHl(anim){
  const hl = document.querySelector('.tab-hl'), t = document.querySelector('.tab.on'); if (!hl || !t) return;
  const l = t.offsetLeft, w = t.offsetWidth, x0 = parseFloat(hl.style.left), w0 = parseFloat(hl.style.width);
  clearTimeout(tabHl.tm);
  if (!anim || S.reduceFx || !(w0 > 0)){ jump(hl, () => { hl.style.left = l + 'px'; hl.style.width = w + 'px'; }); return; }
  const a = Math.min(l, x0), b = Math.max(l + w, x0 + w0);
  hl.style.left = a + 'px'; hl.style.width = (b - a) + 'px';
  tabHl.tm = setTimeout(() => { hl.style.left = l + 'px'; hl.style.width = w + 'px'; }, 90);
}
// a step goal bonus waiting to be claimed (the Progress tab's dot; day-to-day step claims don't count)
function goalWaiting(q){
  if (!q || !q.goal || !(q.goalXp || q.goalGold)) return false;
  const V = valsOf(q);
  return Object.keys(V).some(k => goalDue(q, k, V[k] || 0) > 0);
}
function colClaimable(){
  if (Object.values(SCENE_DEF).some(x => x.list.length && x.list.every(sc => S.scenes[sc.id]) && !S.setClaims[x.key])) return true;
  return [...new Set(CARDS.map(c => c.set))].some(set => setReady(set));   // (Poker counts when any suit is ready)
}
// Redraw by swapping only what changed: unchanged tiles keep their elements (no flicker, no image reloads)
function morphHTML(host, html){
  const t = document.createElement('template'); t.innerHTML = html;
  if (!host.firstChild){ host.replaceChildren(...t.content.childNodes); return; }
  morphKids(host, t.content);
}
function morphSame(a, b){ return a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a.nodeType !== 1 || a.getAttribute('data-id') === b.getAttribute('data-id')); }
function morphKids(a, b){
  const o = [...a.childNodes], n = [...b.childNodes];
  if (o.length !== n.length || o.some((x, i) => !morphSame(x, n[i]))){ a.replaceChildren(...n); return; }
  o.forEach((x, i) => morphNode(x, n[i]));
}
function morphNode(a, b){
  if (a.nodeType === 3){ if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  if (a.nodeType !== 1 || a.isEqualNode(b)) return;
  if (a.namespaceURI !== 'http://www.w3.org/1999/xhtml' || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){ a.replaceWith(b); return; }   // icons and boxes you type in: swap whole
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  morphKids(a, b);
}
function renderPanel(){
  renderPanel.stamp = (renderPanel.stamp || 0) + 1; setTimeout(() => { renderPanel.lastTab = S.tab; }, 0);   // (renderPanel.lastTab: the tab drawn before this one)
  $('#boardTitle').textContent = S.tab === 'quests' && arranging ? 'Arrange' : TAB_TITLES[S.tab];
  $('#progMenu').hidden = S.tab !== 'progress';
  $('#openAllBtn').hidden = true;   // the Deck tab shows it when there is something to open
  $('#colSearchBtn').hidden = S.tab !== 'collection';
  $('#wBtn').hidden = S.tab !== 'quests' || arranging;
  renderDaily();
  $('#arBtn').hidden = S.tab !== 'quests' || !S.quests.some(q => !q.parent);
  $('#arBtn').classList.toggle('on', arranging);
  $('#colSearchBtn').classList.toggle('on', colSearch);
  $('#colSearchBox').hidden = S.tab !== 'collection' || !colSearch;
  if (S.tab !== 'progress') $('#progPop').classList.remove('open');
  if (S.tab === 'quests'){
    const visible = S.quests.filter(ringQuest);
    $('#boardSub').textContent = arranging ? '' : visible.length ? '' : 'Post a quest to begin';
    const top = S.quests.filter(q => !q.parent);
    morphHTML($('#panel'), `${!top.length ? '<div class="list qboard"><div class="empty">The board is empty.</div></div>'
      : arranging ? arrangeBoard() : questBoard()}
      <div class="board-actions">${arranging
        ? '<button class="post save" id="arrangeBtn">SAVE</button>'
        : '<button class="post" id="postBtn">+ Post a quest</button>'}</div>`);   // only the parts that changed are redrawn
  } else if (S.tab === 'progress'){
    $('#boardSub').textContent = '';
    $('#panel').innerHTML = renderProgress();
  } else if (S.tab === 'inventory'){
    $('#boardSub').textContent = '';
    $('#panel').innerHTML = renderInventory();
  } else if (S.tab === 'collection'){
    $('#boardSub').textContent = '';
    const html = renderCollection(), arrived = renderPanel.lastTab !== 'collection';
    // on arrival draw the first sets now and the rest a moment later, so switching never stalls
    let at = -1; for (let n = 0, p = 0; n < 4; n++){ p = html.indexOf('<section class="cc-fold', p + 1); if (p < 0) break; at = p; }
    const end = html.lastIndexOf('</div></div>');
    if (arrived && at > 0 && end > at){
      $('#panel').innerHTML = html.slice(0, at) + html.slice(end); const tail = html.slice(at, end), stamp = renderPanel.stamp = (renderPanel.stamp || 0) + 1;
      requestAnimationFrame(() => requestAnimationFrame(() => { const m = $('#ccMain'); if (renderPanel.stamp !== stamp || S.tab !== 'collection' || !m) return; m.insertAdjacentHTML('beforeend', tail); setupPuzzle(); afterRender(); }));
    } else { $('#panel').innerHTML = html; setupPuzzle(); }
  } else if (S.tab === 'shop'){
    $('#boardSub').textContent = '';
    $('#boardTitle').insertAdjacentHTML('beforeend', infoHTML(SHOP[0]));   // drop rates are the same for every deck
    $('#panel').innerHTML = renderShop();
  }
}
// keep the page still on redraw: if the element near the top of the screen moved, scroll by the same amount
function pageAnchor(){
  if (scrollY < 40 || S.reduceFx && false) return null;
  const el = document.elementFromPoint(innerWidth / 2, 150), t = el && el.closest('#panel [data-id], #panel .cc-fold, #panel .qb-gh, #panel [data-set]'); if (!t) return null;
  const key = t.dataset.id ? `[data-id="${t.dataset.id}"]` : t.classList.contains('cc-fold') ? null : t.dataset.set ? `[data-set="${t.dataset.set}"]` : null;
  const sel = key || (t.classList.contains('cc-fold') && t.querySelector('.cc-mid') ? `.cc-mid[data-set="${t.querySelector('.cc-mid').dataset.set}"]` : null);
  if (!sel) return null; const ref = document.querySelector('#panel ' + sel); return ref ? { sel, top:ref.getBoundingClientRect().top } : null;
}
function anchorShift(a){ try { const el = document.querySelector('#panel ' + a.sel); return el ? Math.round(el.getBoundingClientRect().top - a.top) : 0; } catch(e){ return 0; } }
function barPx(){ const d = window.devicePixelRatio || 1, r = document.documentElement.style; r.setProperty('--bh1', Math.max(1, Math.round(4 * d)) / d + 'px'); r.setProperty('--bh2', Math.max(1, Math.round(2 * d)) / d + 'px'); }   // collection bars: whole device pixels, so every row draws them equally thick
// Redraws everything from S. A failing step is logged and the rest still draws, so one bad quest can't blank the app.
function render(){
  if (tallyHold()) return;
  const keepY = window.scrollY;
  const step = (name, fn) => { try { return fn(); } catch(e){ console.error('render ' + name, e); } };
  step('prep', () => { bountyExpire(); foldSync(); repairClock(); });
  requestAnimationFrame(updateFab);
  infoOnRender();
  step('header', renderHeader);
  step('tabs', renderTabs);
  if (S.tab !== 'quests' && earnOpen){ if (infoCur && infoCur.icon.closest('.earn-i')) infoClose(); earnOpen = false; }
  if (S.tab !== 'shop') mktOpen = false;
  const anc = step('anchor', pageAnchor);
  step('panel', renderPanel);
  step('after', () => { afterRender(); if (S.tab === 'quests') fitCorners(); if (earnOpen) earnArrow(); });
  freshTile = { id:null, row:null };
  const on = document.querySelector('.chip.on'); if (on){ const box = on.parentElement; box.scrollLeft = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2; }
  const fix = anc ? step('shift', () => anchorShift(anc)) || 0 : 0;
  if (keepY > 0 && window.scrollY !== keepY + fix) window.scrollTo(0, keepY + fix);   // a redraw never jumps back to the top
}

function initRender(){
  document.addEventListener('visibilitychange', () => { document.documentElement.classList.toggle('bg', document.hidden); if (!document.hidden) goldSettle(); });
  ['load','error'].forEach(t => document.addEventListener(t, e => { const i = e.target; if (i && i.tagName === 'IMG' && i.classList.contains('fi')) i.classList.add('ld'); }, true));
  addEventListener('resize', () => tabHl(false));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => tabHl(false));
  barPx();
  addEventListener('resize', barPx);
  // Live countdowns to the second; redraw the board when any of them runs out
  every(1, () => {
    const t = now(); let expired = false;
    document.querySelectorAll('.cd').forEach(el => {
      const left = +el.dataset.until - t;
      if (left <= 0) expired = true;
      el.textContent = el.dataset.pre + fmtLeft(left) + el.dataset.post;
    });
    const busy = arDrag || document.querySelector('.modal.open') || document.activeElement?.closest?.('.rec-input, [data-tallyin]');
    if (expired && !busy) render();
    if (S.tab === 'quests' && !busy) stkTick();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !arDrag) render(); });
}
