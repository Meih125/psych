/* Collection rewards: set completion, poker suits, puzzle. */
/* ---- Collection ---- */
// each collection is its own group; new ones (other decks) get added here
const COLLECTIONS = [{ id:'tarot', name:'Lord of Mysteries', sets:setsOf('tarot'), sceneKey:'__scenes' }, { id:'mlbb', name:'MLBB', sets:setsOf('mlbb') }, { id:'hod', name:'Hand of Destiny', sets:setsOf('hod'), sceneKey:'__realms' }];
// finishing a whole set pays this much XP and gold (by the set's rarity)
const SET_REWARD = { common:20, rare:35, epic:50, legendary:100, ultimate:200 };
const SET_BONUS = { 'Artist Series':1200, 'Special':1200, 'SSR':600, 'Gilded':450, 'Promo':350, 'Joker':150,
  'Prestige':1000, 'Cards of Blasphemy':450, 'Legends':350, 'Regions':750, 'Starlight':500, 'Angels':500, 'Deity':500, 'Puzzle':500,
  'SR':250, 'Tarot Club':250, 'Shiny':200, 'Duo':300, 'Chibi':300, 'Poker':200, 'Objects':200, 'Pathways':200, 'Classic':200, 'Origin':200 };   // what each set pays (XP and gold)   // sets with their own reward
const SCENE_REWARD = 500;
const SCENE_PAY = {};   // a bonus-card set that pays more than the default
const scenePay = k => SCENE_PAY[k] || SCENE_REWARD;
// A set can be claimed again and again: the first time needs one of every card,
// each later claim needs ×2 of every card and uses one copy of each (×2 → ×1, ×3 → ×2 ...).
const setTimes = key => +S.setClaims[key] || 0;   // how many times this set has been claimed (old saves stored true = once)
// next claim of a set: its reward; repeat UR / SSR claims pay double (their duplicates are much rarer)
function setPay(set){
  if (set.startsWith('Poker:')) return POKER_SUIT_PAY;
  const list = keyCards(set), r = list.length ? list[0].rarity : 'common', base = SET_BONUS[set] || SET_REWARD[r];
  return setTimes(set) && (r === 'ultimate' || r === 'legendary') ? base * 2 : base;
}
// Poker is claimed per suit (13 cards): ids R01-13 Spades, R14-26 Hearts, R27-39 Clubs, R40-52 Diamonds.
const POKER_SUITS = [['Poker:H','Hearts','♥','#ff5a6e',14],['Poker:D','Diamonds','♦','#ff8a5c',40],['Poker:S','Spades','♠','#cfe0ff',1],['Poker:C','Clubs','♣','#9fe3b0',27]];
const POKER_SUIT_PAY = 75;
const RANKS13 = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function pokerIdx(c){ return c.set === 'Poker' && /^HD_R\d+$/.test(c.id) ? +c.id.slice(4) - 1 : -1; }
const pokerKeyOf = c => { const i = pokerIdx(c); return i < 0 ? null : POKER_SUITS.find(x => i >= x[4] - 1 && i < x[4] + 12)[0]; };
const claimKeyOf = c => pokerKeyOf(c) || c.set;
const keyCards = key => key.startsWith('Poker:') ? CARDS.filter(c => pokerKeyOf(c) === key) : CARDS.filter(c => c.set === key);
function setReady(set){
  if (set === 'Poker') return POKER_SUITS.some(x => setReady(x[0]));
  const list = keyCards(set), need = setTimes(set) ? 2 : 1;
  return list.length > 0 && list.every(c => ownedCard(c.id) >= need);
}
function claimBtn(key, done, rw, repeat){
  const times = setTimes(key), again = repeat && times > 0;
  if (times && !(again && done)) return `<button class="set-claim got" disabled>Claimed</button>`;
  return `<button class="set-claim${done ? ' ready' : ''}" ${done ? `data-act="setclaim" data-set="${esc(key)}"` : 'disabled'}>Claim</button>`;
}
// claim reward under the progress bar (dimmed after a claim until the next is ready)
const claimPay = (rw, dim) => `<div class="cc-pay${dim ? ' dim' : ''}">${rewardsHtml(rw, rw)}</div>`;   // Poker suit lines: same look as a quest's reward
// category headers: under the Claim button, one gradient "+500" (cyan to gold) for both XP and gold
const claimPay2 = (rw, dim) => `<div class="cc-pay2${dim ? ' dim' : ''}">${ico('i-gem')}${ico('i-coin')}<b>+${fmtShort(rw)}</b></div>`;
// copies ever collected (old saves: estimated from owned + copies used by claims)
function cardTotal(id){
  if (S.cardsGot && S.cardsGot[id] != null) return S.cardsGot[id];
  const c = CARD_BY_ID[id], used = c ? Math.max(0, setTimes(claimKeyOf(c)) - 1) : 0;
  return ownedCard(id) + used;
}
// the newest pictures found per category (header default); S.newest[setKey] = up to 3 ids, newest first
function recordNew(key, id){
  if (!S.newest || typeof S.newest !== 'object') S.newest = {};
  S.newest[key] = [id, ...(S.newest[key] || []).filter(x => x !== id)].slice(0, 3);
}
function gainCard(id){
  if (!S.cardsGot) S.cardsGot = {};
  if (!cardTotal(id) && CARD_BY_ID[id]) recordNew(CARD_BY_ID[id].set, id);
  S.cardsGot[id] = cardTotal(id) + 1;
  S.cards[id] = ownedCard(id) + 1;
}
function claimSet(set, el){
  const sdc = sceneDefOf(set);
  if (sdc){
    if (S.setClaims[set] || !sdc.list.every(sc => S.scenes[sc.id])) return;
    S.setClaims[set] = true;
    earnTag = { k:'scenes:' + set, n:'All ' + sdc.name.toLowerCase() + 's' };
    return grant({ xp:scenePay(set), gold:scenePay(set) }, el.getBoundingClientRect(), null, null, 1.6);
  }
  const list = keyCards(set);
  if (!list.length || !setReady(set)) return;
  buyUndo = null;
  const n = setPay(set), times = setTimes(set);
  if (times) list.forEach(c => S.cards[c.id] = ownedCard(c.id) - 1);   // repeat claims use up one copy of each card
  S.setClaims[set] = times + 1;
  earnTag = { k:'set:' + set, n:setLabel(set), kind:'set' };
  grant({ xp:n, gold:n }, el.getBoundingClientRect(), null, null, 1.6);
}
// Puzzle: 8 pieces as one endlessly looping picture; tap to see them one by one
var pzGrid = false;   // the Puzzle set shows its pieces as a grid (with ×2, ×3 like other cards) instead of the picture
function puzzleStrip(list){
  let pieces = [...list].sort((a, b) => a.id.localeCompare(b.id));
  const po = Array.isArray(S.pzOrder) ? S.pzOrder : []; if (po.length) pieces = pieces.map((c, n) => [c, n]).sort((a, b) => { const x = po.indexOf(a[0].id), y = po.indexOf(b[0].id); return (x < 0 ? 1e6 : x) - (y < 0 ? 1e6 : y) || a[1] - b[1]; }).map(x => x[0]);
  const one = pieces.map(c => `<div class="pz${ownedCard(c.id) ? '' : ' dark'}" data-pz="${c.id}"><img loading="lazy" decoding="async" src="${cardImg(c.id)}" alt=""></div>`).join('');
  return `<div class="pz-strip" id="pzStrip" data-act="pzview"><div class="pz-track">${one}${one}${one}</div></div>`;   // tap: the pieces laid out with their counts
}
function setupPuzzle(){
  const el = $('#pzStrip'); if (!el || el._pz) return; el._pz = 1;
  const tr = el.querySelector('.pz-track'); if (!tr) return;
  // the strip drifts left (transform, sub-pixel smooth); dragging moves it with a little momentum
  const SPEED = 9;   // px per second
  let off = 0, vel = 0, down = null, moved = false, hold = 0, holdT = 0, last = performance.now();
  let tw = 0, vis = true, looping = false;   // one copy's width (cached: reading it every frame forces a layout); on screen?
  const third = () => { if (!tw) tw = tr.offsetWidth / 3; return tw || 1; };
  if (setupPuzzle.obs) setupPuzzle.obs.forEach(o => o.disconnect());   // the previous strip's watchers (it was redrawn away)
  const rso = new ResizeObserver(() => { tw = 0; }); rso.observe(tr);
  const draw = () => { const t = third(); off = ((off % t) + t) % t; tr.style.transform = `translate3d(${-(off + t).toFixed(2)}px,0,0)`; };
  const frame = now_ => {
    if (!el.isConnected || !vis || BG_PAUSED){ looping = false; return; }   // off screen: stop until it scrolls back into view
    const dt = Math.min(.05, (now_ - last) / 1000); last = now_;
    if (!down){
      if (Math.abs(vel) > 8){ off += vel * dt; vel *= Math.pow(.04, dt); } else vel = 0;
      if (!hold && !ro && !document.hidden) off += SPEED * dt;
    }
    draw(); requestAnimationFrame(frame);
  };
  const start = () => { if (looping) return; looping = true; last = performance.now(); requestAnimationFrame(frame); };
  const io = new IntersectionObserver(es => { vis = es[es.length - 1].isIntersecting; if (vis) start(); }); io.observe(el);
  setupPuzzle.obs = [rso, io]; setupPuzzle.resume = () => { if (vis) start(); };   // back from a Lockpick run (bgPause)
  start();
  const stopHold = () => { clearTimeout(holdT); hold = 1; holdT = setTimeout(() => { hold = 0; }, 1500); };
  // hold then drag a piece to reorder (saved in S.pzOrder)
  let ro = null, rt = 0, rsx = 0, rsy = 0;
  const copies = () => { const k = tr.children.length / 3; return [0, 1, 2].map(c => [...tr.children].slice(c * k, c * k + k)); };
  el.addEventListener('pointerdown', e => {
    down = { x:e.clientX, off0:off, lx:e.clientX, lt:performance.now(), id:e.pointerId }; moved = false; vel = 0; clearTimeout(holdT); hold = 1; el.classList.add('drag');
    const pz = e.target.closest('.pz'); if (!pz) return; rsx = e.clientX; rsy = e.clientY; clearTimeout(rt);
    rt = setTimeout(() => {
      const k = tr.children.length / 3, idx = [...tr.children].indexOf(pz) % k;
      down = null; moved = false; el.classList.remove('drag'); try { el.setPointerCapture(e.pointerId); } catch(_){}
      ro = { k, cur:idx }; tr.querySelectorAll('.pz').forEach((x, i) => { if (i % k === idx) x.classList.add('lift'); }); el.classList.add('moving');
    }, 450);
  });
  el.addEventListener('pointermove', e => {
    if (!ro){ if (!down && Math.hypot(e.clientX - rsx, e.clientY - rsy) > 10) clearTimeout(rt); else if (down && Math.hypot(e.clientX - rsx, e.clientY - rsy) > 10) clearTimeout(rt); return; }
    e.preventDefault();
    const r = el.getBoundingClientRect();
    if (e.clientX < r.left + 50) off -= 6; else if (e.clientX > r.right - 50) off += 6;   // near an edge: the strip moves
    const hit = [...tr.children].map((c, i) => [i, c.getBoundingClientRect()]).find(([, b]) => e.clientX >= b.left && e.clientX <= b.right);
    if (!hit) return; const over = hit[0] % ro.k; if (over === ro.cur) return;
    copies().forEach(c => { const held = c[ro.cur], ref = c[over]; if (over > ro.cur) ref.after(held); else ref.before(held); });
    ro.cur = over;
  }, { passive:false });
  el.addEventListener('pointermove', e => {
    if (!down || ro) return;
    const dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) > 5){ moved = true; try { el.setPointerCapture(down.id); } catch(_){} }
    if (moved){ off = down.off0 - dx; const t = performance.now(); if (t - down.lt > 16){ vel = -(e.clientX - down.lx) / ((t - down.lt) / 1000); down.lx = e.clientX; down.lt = t; } }
  });
  const roEnd = () => { clearTimeout(rt); if (!ro) return; tr.querySelectorAll('.lift').forEach(x => x.classList.remove('lift')); el.classList.remove('moving');
    S.pzOrder = [...tr.children].slice(0, ro.k).map(x => x.dataset.pz); save(); ro = null; moved = true; setTimeout(() => { moved = false; }, 400); stopHold(); };
  ['pointerup','pointercancel'].forEach(n => el.addEventListener(n, roEnd));
  el.addEventListener('touchmove', e => { if (ro) e.preventDefault(); }, { passive:false });
  el.addEventListener('contextmenu', e => e.preventDefault());
  const up = () => { if (!down) return; down = null; el.classList.remove('drag'); if (!moved) vel = 0; stopHold(); };
  ['pointerup','pointercancel','lostpointercapture'].forEach(n => el.addEventListener(n, up));
  el.addEventListener('wheel', e => { const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; off += d; stopHold(); e.preventDefault(); }, { passive:false });
  el.addEventListener('click', e => { if (moved){ e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}

addEventListener('bgresume', () => { if (setupPuzzle.resume) setupPuzzle.resume(); });
