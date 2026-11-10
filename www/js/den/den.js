/* The Gambling Den: a ticket button in the header opens a small floating tab with two games
   (Minesweeper and Day Trader). One ticket per round, paid in gold. Tickets are earned (daily login +2, every level-up +1,
   see PsychDen.add) and never expire or run out of room.
   Everything it saves lives in S.den (inside the normal save, so backup / restore / reset include it).
   Loaded after js/main.js and uses the app's globals (S, save, render, dayKey, now, ico, fmt, $, flyCoins, infoIcon...).
   Styles: den.css. Phone back button: PsychDen.back() (called from handleBack in js/ui/nav.js). */
(function(){
'use strict';
const STAKES = [10, 25, 50, 100];
const N = 9, TRAPS = 2, SAFE = N - TRAPS;   // Minesweeper: 9 blips, 2 mines
const reduced = () => document.documentElement.classList.contains('reduce-fx');

/* ---------- saved data (S.den) ---------- */
const num = (v, d = 0) => isFinite(+v) ? +v : d;
function D(){   // always the live save (S is replaced on restore / reset), every field present and sane
  const o = S.den = S.den && typeof S.den === 'object' && !Array.isArray(S.den) ? S.den : {};
  ['stake', 'best', 'st'].forEach(k => { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; });
  o.stake.hack = STAKES.includes(o.stake.hack) ? o.stake.hack : 25; o.stake.hilo = STAKES.includes(o.stake.hilo) ? o.stake.hilo : 25;
  o.best.hack = Math.max(0, num(o.best.hack)); o.best.hilo = Math.max(0, num(o.best.hilo)); o.best.lock = Math.max(0, Math.round(num(o.best.lock)));
  o.st.w = Math.max(0, num(o.st.w)); o.st.l = Math.max(0, num(o.st.l));   // gold won / lost in the Den, all time
  o.t = Math.max(0, Math.min(1e6, Math.round(num(o.t))));
  o.b = Math.max(0, Math.min(1e9, Math.round(num(o.b))));   // Gem: Lockpick's second currency (spent in the Black Market)
  o.p = Math.max(0, Math.min(FREE_AT, Math.round(num(o.p))));   // paid plays since the last free one; at FREE_AT the next play is free
  delete o.d;   // tickets used to be refilled each day
  if (typeof o.pd !== 'string') o.pd = ''; if (typeof o.pk !== 'string') o.pk = ''; o.pn = Math.max(0, Math.min(1e9, num(o.pn)));
  if (!o.mk || typeof o.mk !== 'object' || Array.isArray(o.mk)) o.mk = {};   // Black Market stock (market.js validates it)
  if (o.sv && (typeof o.sv !== 'object' || Array.isArray(o.sv))) delete o.sv;
  return o;
}
const FREE_AT = 9;   // every 9 paid plays, the 10th is free (the shattered ticket)
const tickets = () => D().t;
const freeReady = () => D().p >= FREE_AT;
const nextMid = () => { const d = new Date(now()); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); };
/* Daily profit limit: when the day's winnings (S.den.pn) reach PROFIT_CAP the Den closes until tomorrow; the round that
   crosses it is paid in full. Losses don't lower pn, so losing never reopens room. */
const PROFIT_CAP = 1000, CAP_TEST_FREEZE = false;   // CAP_TEST_FREEZE: set true only while testing, it stops the day's profit counter from rising (the daily limit then never triggers)
function netToday(){ const o = D(), k = dayKey(); if (o.pd !== k){ o.pd = k; o.pn = 0; } return o.pn; }
const pay = (stake, m) => Math.floor(stake * m);   // what a cash-out pays: always the real win, the limit only closes the Den afterwards
const capped = () => netToday() >= PROFIT_CAP;
const odds = p => p <= 0 ? 0 : Math.min(10, Math.max(1, .95 / (p / (1 - 1 / 101))));   // Day Trader payout for a call that wins with chance p
const hmult = k => { let m = .95; for (let i = 0; i < k; i++) m *= (N - i) / (SAFE - i); return m; };   // Minesweeper multiplier after k safe scans
const fm = m => '×' + m.toFixed(2);

/* ---------- icons ---------- */
const GI = {
  hack: '<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="9"/><path d="M24 24L36.7 11.3A18 18 0 0 1 42.0 24.0z" fill="currentColor" fill-opacity="0.35" stroke="none"/><path d="M24 24L42.0 24.0"/><circle cx="36.0" cy="18.9" r="2" fill="currentColor" stroke="none"/>',
  lock: '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="4"/><path d="M24 4v9M24 35v9M4 24h9M35 24h9"/>',
  hilo: '<path d="M5 34l10-14 8 8 10-17 10 11V41H5z" fill="currentColor" fill-opacity=".18" stroke="none"/><path d="M5 34l10-14 8 8 10-17 10 11"/><circle cx="43" cy="22" r="3" fill="currentColor" stroke="none"/>'
};
const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
sprite.setAttribute('width', 0); sprite.setAttribute('height', 0); sprite.style.position = 'absolute'; sprite.setAttribute('aria-hidden', 'true');

sprite.innerHTML = `<symbol id="den-chip" viewBox="0 0 48 48"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="14" width="20" height="20" rx="3.5"/><rect x="19.5" y="19.5" width="9" height="9" rx="1.5" fill="currentColor" fill-opacity=".3"/><path d="M20 14V8M24 14V4M28 14V8M20 34v6M24 34v8M28 34v6M14 20H8M14 24H4M14 28H8M34 20h6M34 24h8M34 28h6"/><path d="M33 15l6-6M15 33l-6 6"/><circle cx="41" cy="7" r="2.2"/><circle cx="7" cy="41" r="2.2"/></g></symbol>`;
const SHC = (id, pts) => `<clipPath id="${id}"><polygon points="${pts}"/></clipPath>`;
const SHB = '<g transform="scale(.5)" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="14" width="20" height="20" rx="3.5"/><rect x="19.5" y="19.5" width="9" height="9" rx="1.5" fill="currentColor" fill-opacity=".3"/><path d="M20 14V8M24 14V4M28 14V8M20 34v6M24 34v8M28 34v6M14 20H8M14 24H4M14 28H8M34 20h6M34 24h8M34 28h6"/><path d="M33 15l6-6M15 33l-6 6"/><circle cx="41" cy="7" r="2.2"/><circle cx="7" cy="41" r="2.2"/></g>';
sprite.innerHTML += `<symbol id="den-chip-sh" viewBox="0 0 24 24"><defs>${SHC('dsa', '0,0 15,0 9,12 0,14')}${SHC('dsb', '15,0 24,0 24,18 14,13 9,12')}${SHC('dsc', '0,14 9,12 14,13 24,18 24,24 0,24')}</defs>
<g clip-path="url(#dsa)" transform="translate(-1.1 -.9) rotate(-4 8 7)">${SHB}</g><g clip-path="url(#dsb)" transform="translate(1.4 -.6) rotate(5 18 8)">${SHB}</g><g clip-path="url(#dsc)" transform="translate(-.2 1.5) rotate(-2 12 18)">${SHB}</g></symbol>`;
document.body.appendChild(sprite);
const chipSh = (cls = '') => `<svg class="den-ic ${cls}" viewBox="0 0 24 24"><use href="#den-chip-sh"/></svg>`;
// Gem: a small red octahedron that turns. One shared loop redraws every .g3 icon on screen (and stops when there are none); static with Reduce effects.
const GEM_V = [[0,-1.3,0],[0,1.3,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]], GEM_F = [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]], GEM_L = [-.35,-.5,.79];
const GEM_CT = Math.cos(-.36), GEM_ST = Math.sin(-.36);
const gemHull = pts => { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of pts){ while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of pts.reverse()){ while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up); };
const gemLp = (a, b, k) => a + (b - a) * k;
/* fa = 0..1: how far a Black Market slot gem is filled (hollow crystal -> solid faces in the edge colour) */
const gemDraw = (svg, a, fa = 0) => {
  const ca = Math.cos(a), sa = Math.sin(a), P = svg.querySelectorAll('polygon');
  const v = GEM_V.map(([x, y, z]) => { const X = x * ca + z * sa, Z = -x * sa + z * ca; return [X, y * GEM_CT - Z * GEM_ST, y * GEM_ST + Z * GEM_CT]; });
  P[0].setAttribute('points', gemHull(v.map(q => [q[0], q[1]])).map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' '));
  GEM_F.map(f => { const c = [0, 1, 2].map(k => (v[f[0]][k] + v[f[1]][k] + v[f[2]][k]) / 3), n = Math.hypot(c[0], c[1], c[2]); return { f, z: c[2], lit: Math.max(0, (c[0] * GEM_L[0] + c[1] * GEM_L[1] + c[2] * GEM_L[2]) / n) }; })
    .sort((p, q) => p.z - q.z).forEach((o, i) => { const el = P[i + 1];
      el.setAttribute('points', o.f.map(k => v[k][0].toFixed(2) + ',' + v[k][1].toFixed(2)).join(' '));
      if (o.z > 0){ const a0 = .04 + .2 * o.lit, sh = .72 + .28 * o.lit; el.setAttribute('fill', `rgba(${gemLp(255, 255 * sh, fa).toFixed(0)},${gemLp(120, 59 * sh, fa).toFixed(0)},${gemLp(145, 92 * sh, fa).toFixed(0)},${gemLp(a0, 1, fa).toFixed(2)})`); el.setAttribute('stroke', '#ff3b5c'); el.setAttribute('stroke-width', '.09'); }
      else { el.setAttribute('fill', `rgba(${gemLp(150, 125, fa).toFixed(0)},${gemLp(20, 16, fa).toFixed(0)},${gemLp(47, 38, fa).toFixed(0)},${gemLp(.1, 1, fa).toFixed(2)})`); el.setAttribute('stroke', 'rgba(255,59,92,.6)'); el.setAttribute('stroke-width', '.06'); } });
};
let gemRun = false;
let gemT = 0;
const gemFa = (s, fn, snap) => { const h = s.closest('.bm-gem'), tg = h && h.classList.contains('f') ? 1 : 0; let f = s._fa || 0; f = snap ? tg : f + (tg - f) * .14; if (Math.abs(tg - f) < .004) f = tg; s._fa = f; fn(s, gemT / 1000 * .7 + (+s.dataset.ph || 0), f); };
const gemPaint = () => document.querySelectorAll('svg.g3').forEach(s => gemFa(s, gemDraw, true));   // one redraw (Reduce effects stops the loop)
const gemTick = n => {
  const all = document.querySelectorAll('svg.g3'); if (!all.length){ gemRun = false; return; }
  gemT = n;
  all.forEach((s, i) => gemFa(s, gemDraw));
  if (document.documentElement.classList.contains('reduce-fx') || document.body.classList.contains('reduce-fx')){ gemRun = false; return; }
  requestAnimationFrame(gemTick);
};
const gemI = (cls = '') => { if (!gemRun){ gemRun = true; setTimeout(() => requestAnimationFrame(gemTick), 0); }
  return `<svg class="den-ic gem g3 ${cls}" viewBox="-1.25 -1.6 2.5 3.2" data-ph="${(Math.random() * 6).toFixed(2)}">${'<polygon fill="#12080d" stroke="none"/>' + '<polygon/>'.repeat(8)}</svg>`; };
const chip = (cls = '') => `<svg class="den-ic ${cls}" viewBox="0 0 48 48"><use href="#den-chip"/></svg>`;


const coinI = () => ico('i-coin');

const gIcon = g => `<svg class="den-gi" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GI[g]}</svg>`;

/* ---------- header ticket ---------- */
const hdR = document.querySelector('.hd-right');
const tkBtn = document.createElement('button'); tkBtn.className = 'den-tkt'; tkBtn.id = 'lTkt'; tkBtn.type = 'button'; tkBtn.setAttribute('aria-label', 'Gambling Den tickets');
hdR.insertBefore(tkBtn, document.getElementById('purse'));
/* the header count: shows tickets minus the ones still flying in (tkHold), and ticks up / down to the new number (like Earned today) */
let tkShown = null, tkHold = 0, tkSafe = 0, tkStop = null;
function tkSync(){
  const t = Math.max(0, tickets() - tkHold);
  tkBtn.classList.toggle('zero', tickets() <= 0);
  let n = tkBtn.querySelector('.den-tkn');
  if (!n){ tkBtn.innerHTML = `${chip()}<span class="den-tkn">${fmt(t)}</span>`; tkShown = t; return; }
  if (tkShown === t) return;
  const from = tkShown === null ? t : tkShown; tkShown = t;
  if (tkStop){ tkStop(); tkStop = null; }
  if (reduced()){ n.textContent = fmt(t); return; }
  tkStop = countTo(n, from, t, 600, { every: 45 });
  replay(n, 'tk-pop');
}
tkSync();
tkBtn.addEventListener('click', () => openDen());
let balStop = null;
const balSync = () => {   // the in-game balance rolls from what it shows now to the new total
  const b = document.getElementById('lBal'); if (!b) return; if (balStop) balStop();
  const g0 = b.querySelector('.g'), to = S.gold, from = g0 ? parseInt(g0.textContent.replace(/[^\d-]/g, ''), 10) : to, tk = (game === 'lock' ? `<span class="gm">${gemI()}${D().b || 0}</span>` : '') + `<span class="t">${chip()}${tickets()}</span>`;
  b.innerHTML = `<span class="g">${ico('i-coin')}${fmt(isNaN(from) ? to : from)}</span><span class="row">${tk}</span>`;
  if (isNaN(from) || from === to || document.documentElement.classList.contains('reduce-fx')){ b.querySelector('.g').innerHTML = ico('i-coin') + fmt(to); return; }
  balStop = tween(from, to, 520, v => { const el = b.querySelector('.g'); if (!el || !b.isConnected) return false; el.innerHTML = ico('i-coin') + fmt(Math.round(v)); });
};
const goldDelta = (d, g = game) => { S.gold += d; if (g && GAMES[g]) bumpDen(g, GAMES[g].name, d); buyUndo = null; save(); renderHeader.tween = true; renderHeader(); balSync(); };
const useTicket = n => { D().t = Math.max(0, D().t + n); save(); tkSync(); balSync(); };


/* ---------- Den sheet ---------- */
const GAMES = {
  hack: { name:'Minesweeper', blurb:'Scan the grid, dodge the mines.', cls:'h' },
  hilo: { name:'Day Trader', blurb:'Read the line. Call the next move.', cls:'l' },
  lock: { name:'Lockpick', blurb:'Not a gamble. Beat the lock.', cls:'k' }
};
let ov = null;
/* the little (i) next to a game name: a short how-to bubble */
const INFO = {
  hack: 'Each safe scan raises your multiplier. 2 of the 9 blips are mines. Extract before hitting one.',
  hilo: 'LONG for higher, SHORT for lower. One wrong call liquidates you.',
  lock: 'Tap when the needle crosses the gap. Miss and cash out what you\u2019ve earned.'
};
/* where tickets come from; a source already taken today is greyed out with the faint line-through used on done List items */
function tixInfo(){
  const k = dayKey(), qs = (S.quests || []).filter(q => q && q.goal);
  const row = (name, n, done) => `<div class="den-tr${done ? ' dn' : ''}"><span>${name}</span><b>${chip()}+${n}</b></div>`;
  return row('Daily login', 2, typeof dlClaimed === 'function' && dlClaimed()) + row('First pack', 1, D().pk === k) + row('Step goal', 1, qs.length > 0 && qs.every(q => q.goalPaid && q.goalPaid[k])) + `<div class="den-tr fp"><span>Free entry</span><b>${chipSh()}</b></div>`;   // every 10th play costs no ticket
}
function toggleInfo(el){
  const sh = ov && ov.querySelector('.den-sheet'); if (!sh) return;
  if (infoIsOpen(el)){ infoClose(); return; }
  const g = el.dataset.g, b = document.createElement('div'); b.className = 'den-ib'; b.dataset.g = g; if (g === 'tix') b.innerHTML = tixInfo(); else b.textContent = INFO[g];
  const sr = sh.getBoundingClientRect(), r = el.getBoundingClientRect();
  b.style.top = (r.bottom - sr.top + sh.scrollTop + 10) + 'px'; b.style.setProperty('--ax', (r.left + r.width / 2 - sr.left - 14 - 5) + 'px');
  sh.appendChild(b);
  if (b.offsetTop + b.offsetHeight > sh.clientHeight - 6){ b.style.top = (r.top - sr.top + sh.scrollTop - b.offsetHeight - 10) + 'px'; b.classList.add('up'); }   // no room below: open above the name
  infoOpen(el, { inside: x => el.contains(x) || b.contains(x), close: () => b.remove() });
}
/* fade = a game is opening: the Den fades out while the game fades in (see .den-x / .den-in in den.css) instead of vanishing at once */
function closeDen(fade){ MK.close(); if (ov){ if (infoCur && ov.contains(infoCur.icon)) infoClose(); const o = ov; ov = null; if (fade){ o.classList.add('den-x'); setTimeout(() => o.remove(), 260); } else o.remove(); } }
/* stretch / shrink: the new sheet starts at the old sheet's height and eases to its own (class .den-mo in den.css) */
function morph(sheet, h0){
  if (!sheet || !h0 || reduced()) return;
  const h1 = sheet.offsetHeight; if (Math.abs(h1 - h0) < 2) return;
  sheet.style.height = h0 + 'px'; sheet.style.overflow = 'hidden'; sheet.classList.add('den-mo'); void sheet.offsetHeight;
  sheet.style.height = h1 + 'px';
  setTimeout(() => { sheet.style.height = ''; sheet.style.overflow = ''; sheet.classList.remove('den-mo'); }, 400);
}
function openDen(fromGame, h0){
  closeDen(); const t = tickets();
  ov = document.createElement('div'); ov.className = 'den-ov' + (fromGame ? ' den-in' : '');
  const w = D().st.w, lo = D().st.l, tot = w + lo, p = tot ? w / tot * 100 : 50, nt = w - lo;
  const fmt0 = n => n.toLocaleString('en-US'), np = netToday();
  ov.innerHTML = `<div class="den-sheet"><div class="den-hd"><h2>The Den${infoIcon('Where tickets come from', 'data-g="tix"')}</h2><div class="den-cap"${capped() ? ' hidden' : ''}>${ico('i-coin')}${np > PROFIT_CAP ? `<b class="o">${fmt0(np)}</b><b>/${PROFIT_CAP}</b>` : `<b>${fmt0(np)}/${PROFIT_CAP}</b>`}</div></div><div class="den-tch">${Array.from({ length:FREE_AT }, (_, i) => `<span class="den-tc${i < D().p ? ' on' : ''}">${chip()}</span>`).join('')}<span class="den-tc shat${freeReady() ? ' on' : ''}">${chipSh()}</span></div>
    <div class="den-st"><div class="den-sn w"><i>WON</i><b>${fmt0(w)}</b></div><div class="den-sb"><div class="den-sbd" style="left:${p}%;transform:translateX(${p < 20 ? '-4px' : p > 80 ? 'calc(-100% + 4px)' : '-50%'})">${ico('i-coin')}${nt > 0 ? '+' : nt < 0 ? '−' : ''}${fmt0(Math.abs(nt))}</div><div class="den-spt" style="left:${p}%">▼</div><div class="den-sbar"><i class="${tot ? 'a' : 'z'}" style="width:${p}%"></i><i class="${tot ? 'b' : 'z'}" style="width:${100 - p}%"></i></div></div><div class="den-sn l"><i>LOST</i><b>${fmt0(lo)}</b></div></div>
    <div class="den-gl${capped() ? ' lock' : ''}${S.leftHand ? ' lh' : ''}">${Object.keys(GAMES).map(g => `<button class="den-gc ${GAMES[g].cls}" data-g="${g}" type="button"><span class="den-gic">${gIcon(g)}</span><span class="den-gtx"><b>${GAMES[g].name}${infoIcon('How to play', `data-g="${g}"`)}</b><em>${GAMES[g].blurb}</em></span><span class="den-gb">BEST<br>${D().best[g] ? (g === 'lock' ? 'LV ' + D().best[g] : '×' + D().best[g].toFixed(1)) : '—'}</span></button>`).join('')}${capped() ? `<div class="den-lim"><div>${ico('i-coin')}<b class="${np > PROFIT_CAP ? 'o' : ''}">${fmt0(np)}</b><b>/${PROFIT_CAP}</b></div><small>${cd(nextMid(), 'resets in ')}</small></div>` : ''}<button class="den-edge" type="button" aria-label="Black Market"><i></i><span>BLACK MARKET</span></button></div>
  </div>`;
  ov.addEventListener('click', e => {
    const inf = e.target.closest('.info-btn'), ib = ov.querySelector('.den-ib');
    if (inf){ e.stopPropagation(); toggleInfo(inf); return; }
    if (ib){ infoClose(); if (e.target.closest('.den-ib')) return; }
    if (e.target.closest('.den-edge')){ MK.open(); return; }
    const b = e.target.closest('.den-gc'); if (b && !capped()){ const h0 = ov.firstChild.offsetHeight; closeDen(true); openGame(b.dataset.g, h0); return; }
    if (e.target === ov) closeDen();
  });
  document.body.appendChild(ov);
  morph(ov.firstChild, h0);
}


/* ---------- game page ---------- */
let gov = null, pg = null, game = null, run = null, swiped = false, tn = null, segK = 0, resetT = 0, resetId = 0;
/* multiplier with the × hanging outside, so the number itself is what sits centred / aligned; values tick up/down smoothly */
const mH = v => `<b class="den-m"><s>×</s>${v.toFixed(2)}</b>`;
function tweenM(el, to, html, dur){
  if (!el) return; const from = el._cur != null ? el._cur : el._v; if (el._r) el._r(); el._v = to; html = html || mH;
  if (from == null || from === to || reduced()){ el._cur = to; el.innerHTML = html(to); return; }
  // always continues from the number on screen now, never from an earlier target
  el._r = tween(from, to, dur || 420, v => { if (!el.isConnected) return false; el._cur = v; el.innerHTML = html(v); });
}
const stakeNow = () => D().stake[game];

/* ---------- a paid, unfinished round is kept (also after leaving the game or closing the app) and picked up again when the game is reopened ---------- */
const clearSaved = g => { g = g || game; const o = D(); if (o.sv && o.sv[g]){ delete o.sv[g]; save(); } };
function snapRun(){
  if (!pg || !run || run.over) return;
  const s = { run:{ stake:run.stake, k:run.k, m:run.m } };
  if (game === 'hack'){ if (!lay) return; Object.assign(s.run, { ice:[...run.ice], opened:[...run.opened] }); s.lay = lay; }
  else Object.assign(s.run, { n:run.n, hist:run.hist.map(h => ({ n:h.n, w:h.w })) });
  const o = D(); if (!o.sv) o.sv = {}; o.sv[game] = s; save();
}
function cleanSaved(g){   // a saved round is checked before it is used; anything odd is thrown away
  const s = D().sv && D().sv[g]; if (!s || typeof s !== 'object') return null;
  const r = s.run && typeof s.run === 'object' ? s.run : {}, o = { stake:r.stake, k:Math.round(num(r.k, -1)), m:num(r.m, 0), over:false };
  let ok = STAKES.includes(o.stake) && o.k >= 0 && o.m >= 1 && o.m <= 1e4, ly = null;
  if (ok && g === 'hack'){
    const ice = Array.isArray(r.ice) ? r.ice.filter(i => Number.isInteger(i) && i >= 0 && i < N) : [], op = Array.isArray(r.opened) ? r.opened.filter(i => Number.isInteger(i) && i >= 0 && i < N) : [];
    o.ice = new Set(ice); o.opened = op; o.m = hmult(o.k);
    const l = s.lay, pos = l && Array.isArray(l.pos) ? l.pos : null;
    ok = o.ice.size === TRAPS && ice.length === TRAPS && o.k < SAFE && op.length === o.k && new Set(op).size === op.length && !op.some(i => o.ice.has(i))
      && pos && pos.length === N && pos.every(p => Array.isArray(p) && p.length === 3 && p.every(v => isFinite(v) && v > -1000 && v < 2000))
      && Array.isArray(l.a) && l.a.length === N && l.a.every(isFinite) && num(l.H) >= 100 && num(l.H) <= 600;
    if (ok){ o.lastI = op[op.length - 1]; ly = +l.H === HACK_H ? { pos:pos.map(p => p.map(Number)), H:+l.H, a:l.a.map(Number) } : null; }   // a round saved with the old taller field gets a fresh layout (blips are by number, so the round itself is unchanged)
  } else if (ok){
    o.n = Math.round(num(r.n, -1)); ok = o.n >= 0 && o.n <= 100;
    o.hist = (Array.isArray(r.hist) ? r.hist : []).slice(-8).map(h => ({ n:Math.max(0, Math.min(100, Math.round(num(h && h.n)))), w:!!(h && h.w) }));
  }
  if (!ok){ clearSaved(g); return null; }
  return { run:o, lay:ly };
}
function restoreRun(g, s){
  run = s.run;
  if (g === 'hack'){
    buildGrid(false, s.lay);
    const total = run.k; run.k = 0; run.opened.forEach(i => { run.k++; face(i, false, true); }); run.k = total;   // the opened blips come back without their ring effects
    [...$('#lGrid').children].forEach(n => { n.disabled = n.classList.contains('open'); });
  } else {
    const nn = $('#lNum'); nn.style.color = ''; nn.textContent = run.n; nn.classList.remove('idle'); chStart();
    const to = Math.min(5, fracIdx(run.m)); renderTh(to, Math.max(1, muOf(to) + Math.max(0, run.m - 10) * (to >= 5 ? 1 : 0)));
  }
  bar(); readouts();
}

function openGame(g, h0){
  closeGame(true); game = g; run = null;
  gov = document.createElement('div'); gov.className = 'den-ov den-in';
  gov.innerHTML = '<div class="den-sheet den-gsheet"></div>';
  pg = document.createElement('div'); pg.id = 'lDen'; pg.className = 'den-pg ' + g;
  gov.firstChild.appendChild(pg);
  gov.addEventListener('click', e => { if (e.target === gov && !(run && !run.over) && !(game === 'lock' && (LKG.held() || (LKG.get() && LKG.get().run)))) closeGame(); });   // Lockpick: stray taps beside / below the shrinking panel don't close it during a run or the payout hold
  document.body.appendChild(gov);
  if (g === 'hack'){ tn = document.createElement('div'); tn.className = 'den-tens'; tn.innerHTML = '<i></i>'; document.body.appendChild(tn); }
  const keep = g === 'lock' ? null : cleanSaved(g); segK = 0; paint(); if (keep) restoreRun(g, keep);
  morph(gov.firstChild, h0);
}
function closeGame(quiet){
  if (!pg) return;
  if (run && !run.over) snapRun(); else if (run) clearSaved();   // leaving mid-run: the round is kept exactly as it is
  if (game === 'lock') LKG.stop();
  if (thRaf) thRaf(); th = null; clearTimeout(resetT); resetId++; if (tn){ tn.remove(); tn = null; }
  const h0 = quiet ? 0 : gov.firstChild.offsetHeight;
  if (quiet) gov.remove();
  else { const o = gov; const lp = o.querySelector('#lDen'); if (lp) lp.removeAttribute('id'); o.classList.add('den-x'); setTimeout(() => o.remove(), 260); }   // fades out while the Den fades in
  gov = null; pg = null; run = null;
  if (!quiet) openDen(true, h0);
}
const hideSave = () => { snapRun(); LKG.snap(); flushSave(); };
addEventListener('pagehide', hideSave); document.addEventListener('visibilitychange', () => { if (document.hidden) hideSave(); });

function paint(){
  const g = game, isH = g === 'hack', isK = g === 'lock';
  pg.innerHTML = `<div class="den-head"><button class="den-back" type="button" aria-label="Back to the Den"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><span class="den-gic sm">${gIcon(g)}</span><h3>${GAMES[g].name}</h3><div class="den-bal" id="lBal"></div></div>
  <div class="den-body">${isH ? hackBody() : isK ? LKG.body() : hiloBody()}</div>
  <div class="den-barwrap" id="lBar"></div>`;
  if (isH) buildGrid(); else if (isK){ LKG.init(); heatSheet(0); } else { buildTh(); chStart(); }
  bar(); readouts(); balSync();
}
const hackBody = () => `<div class="den-board sn fr-full"><i class="den-sweep"></i><div class="den-grid free" id="lGrid"></div></div>
  <div class="lab-rb" id="lSeg"><div class="rb-top"><small>RISK CHANCE</small><em id="lSs">OK</em></div><div class="rb-mid"><div class="rb-t" id="lSn" data-t="—">—</div><div class="rb-st" id="lSt"></div></div><div class="rb-tape"><b class="tp"></b><b class="cv"></b></div></div>`;
/* Higher / Lower screen: a 20-segment parallelogram thermometer on the side (right side in left-hand mode), number, two buttons */
const hiloBody = () => `<div class="den-lrow${S.leftHand ? ' rt' : ''}"><div class="den-th" id="lLad"><div class="den-trk"></div></div>
  <div class="den-lmid"><div class="den-disp" id="lDisp"><svg id="lChart" aria-hidden="true"></svg><div class="den-dh"><b id="lNum" class="idle">–</b><i id="lDelta"></i></div></div>
    <button class="den-hb up" id="lUp" type="button" disabled><span id="oh">LONG —</span></button>
    <button class="den-hb dn" id="lDn" type="button" disabled><span id="ol">SHORT —</span></button></div></div>`;
/* synthwave heat ladders: Minesweeper (cyan -> blue -> magenta -> pink-red, no violet): one stop per scan 0..6, blended linearly in RGB; t = 0..1 */
const HEAT_E = [[46,230,214],[127,240,230],[232,255,252],[255,214,224],[255,138,160],[255,92,120],[255,59,92]];   // Day Trader: cyan -> white-hot -> red
const HEAT = [[46,230,214],[46,194,255],[79,141,255],[255,79,216],[255,61,154],[255,61,110],[255,59,92]];
const heatRgb = t => { const x = Math.min(1, Math.max(0, t)) * 6, i = Math.min(5, Math.floor(x)), f = x - i, L = game === 'hilo' ? HEAT_E : HEAT, a = L[i], b = L[i + 1]; return a.map((v, j) => Math.round(v + (b[j] - v) * f)); };
const heatColor = t => `rgb(${heatRgb(t)})`, heatA = (t, a) => `rgba(${heatRgb(t)},${a})`;
const THC = heatColor;
/* the sheet border, title, icon box and board border follow the heat (class l-heat + --heat); the last-tile red state keeps priority */
function heatSheet(t){ const sh = gov && gov.firstChild; if (!sh) return; sh.classList.toggle('l-heat', t > 0); sh.style.setProperty('--heat', heatRgb(t).join(',')); }
const RUNGS = [1, 2, 4, 6, 8, 10], TN = 20, TPER = TN / 5;
const fracIdx = mu => { let i = 0; RUNGS.forEach((r, k) => { if (mu >= r - .005) i = k; }); return i >= RUNGS.length - 1 ? RUNGS.length - 1 : i + (mu - RUNGS[i]) / (RUNGS[i + 1] - RUNGS[i]); };
const muOf = fi => { const i = Math.min(4, Math.floor(fi + 1e-9)); return RUNGS[i] + (RUNGS[i + 1] - RUNGS[i]) * (fi - i); };
let th = null, thF = 0, thRaf = null;
function buildTh(){
  const el = $('#lLad'), trk = el && el.firstChild; if (!trk) return; th = { segs:[], ticks:[] };
  const sgs = document.createElement('div'); sgs.className = 'den-sgs'; trk.appendChild(sgs);
  for (let k = 0; k < TN; k++){ const sg = document.createElement('div'); sg.className = 'den-sg'; sg.style.bottom = (k / TN * 100) + '%'; sg.style.height = `calc(${100 / TN}% - 3px)`;
    const f = document.createElement('i'); f.style.background = `linear-gradient(to top,${THC(k / TN)},${THC((k + 1) / TN)})`; sg.appendChild(f); sgs.appendChild(sg); th.segs.push(f); }
  RUNGS.forEach((r, i) => { const t = document.createElement('div'); t.className = 'den-tk'; t.textContent = '×' + r; t.style.bottom = (i * 20) + '%'; t.style.setProperty('--c', THC(i / 5)); trk.appendChild(t); th.ticks.push(t); });
  th.bub = document.createElement('div'); th.bub.className = 'den-bub'; trk.appendChild(th.bub); renderTh(0, 1);
}
function renderTh(f, mu){
  if (!th) return; thF = f; th.segs.forEach((el, k) => { el.style.transform = `scaleY(${Math.max(0, Math.min(1, f * TPER - k))})`; });
  th.ticks.forEach((t, i) => t.classList.toggle('rch', f >= i - 1e-6 && f > 0));
  heatSheet(Math.min(1, f / 5));
  const c = THC(f / 5); th.bub.style.display = f > 0 ? 'block' : 'none'; th.bub.textContent = '×' + mu.toFixed(2); th.bub.style.color = c; th.bub.style.borderColor = c; th.bub.style.bottom = (f * 20) + '%';
}
function animTh(from, to, dur, ease, frame, done){
  if (thRaf) thRaf();
  if (dur <= 0 || reduced()){ frame && frame(to, 1); done && done(); return; }
  thRaf = tween(from, to, dur, (v, k) => { if (!pg || !th) return false; frame && frame(v, k); if (k >= 1 && done) done(); }, { ease });
}
function ladder(){   // follow the live multiplier (smooth climb); a lost round is driven by loseHilo instead
  if (!th || (run && run.lost)) return; const m = run ? run.m : 1, to = Math.min(5, fracIdx(m));
  if (Math.abs(to - thF) < 1e-6) return;
  animTh(thF, to, 550, easeOut, f => renderTh(f, Math.max(1, muOf(Math.min(5, f)) + Math.max(0, m - 10) * (f >= 5 ? 1 : 0))));
  if (to >= 5) setTimeout(() => { if (th && run) renderTh(5, m); }, 560);
}
/* free layouts start empty; a radar sweep reveals the blips one by one when a round starts */
let scanA = [], scanT = [], scanRaf = 0, scanAn = null;
function scanClear(){ scanT.forEach(clearTimeout); scanT = []; cancelAnimationFrame(scanRaf); if (scanAn){ scanAn.playbackRate = 1; scanAn = null; } }
function scan(){
  const g = $('#lGrid'), sw = $('.den-sweep'); if (!g) return; scanClear();
  const nodes = [...g.children], fast = reduced(), PEAK = 3.6, P = 4000;
  const an = sw && !fast && sw.getAnimations ? sw.getAnimations()[0] : null;
  if (!an){ nodes.forEach((n, i) => scanT.push(setTimeout(() => { if (n.isConnected) n.classList.remove('hid'); }, i * 40))); return; }
  /* one turn of the sweep that eases up to a quick speed and back down; a blip appears when the bright edge reaches it */
  scanAn = an; const ang = () => ((an.currentTime % P) / P) * 360, a0 = ang(); let prev = a0, turned = 0; const pend = new Set(nodes.keys());
  const tick = () => {
    if (!g.isConnected || scanAn !== an) return;
    const a = ang(); turned += (a - prev + 360) % 360; prev = a;
    pend.forEach(i => { if (turned >= 360 || (scanA[i] - a0 + 360) % 360 <= turned){ nodes[i].classList.remove('hid'); pend.delete(i); } });
    if (turned >= 360){ an.playbackRate = 1; scanAn = null; return; }
    an.playbackRate = 1 + (PEAK - 1) * Math.sin(Math.PI * turned / 360);
    scanRaf = requestAnimationFrame(tick);
  };
  tick();
}
const HACK_H = 204;   // height of the Minesweeper radar field in px (the Den and all games are one size, see --den-h in den.css)
let lay = null;   // where the nine blips sit this round: { pos:[[x,y,size]...], H, a:[angle of each blip from the centre] }
function newLayout(board){
  const W = Math.max(240, board.clientWidth - 20 || 330), H = HACK_H, sz = 60, D = sz * 1.1, r = Math.random;
  const x0 = sz / 2 + 6, x1 = W - sz / 2 - 6, y0 = sz / 2 + 6, y1 = H - sz / 2 - 6, pts = [];
  for (let i = 0; i < N; i++) pts.push([x0 + r() * (x1 - x0), y0 + r() * (y1 - y0)]);   // nine blips scattered at random, then pushed apart until none touch (the field is small, so random retries alone fail)
  for (let it = 0; it < 120; it++){
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++){
      const dx = pts[b][0] - pts[a][0], dy = pts[b][1] - pts[a][1], d = Math.hypot(dx, dy) || .01;
      if (d < D){ const f = (D - d) / 2 / d; pts[a][0] -= dx * f; pts[a][1] -= dy * f; pts[b][0] += dx * f; pts[b][1] += dy * f; }
    }
    pts.forEach(p => { p[0] = Math.min(x1, Math.max(x0, p[0])); p[1] = Math.min(y1, Math.max(y0, p[1])); });
  }
  return { pos:pts.map(p => [p[0] - sz / 2, p[1] - sz / 2, sz]), H, a:pts.map(p => (Math.atan2(p[0] - W / 2, -(p[1] - H / 2)) * 180 / Math.PI + 360) % 360) };
}
function buildGrid(hidden, keep){
  const g = $('#lGrid'), board = $('.den-board'); if (!g) return;
  scanClear(); lay = keep || newLayout(board); scanA = lay.a; g.style.height = lay.H + 'px';
  g.innerHTML = lay.pos.map((p, i) => `<button class="den-nd${hidden ? ' hid' : ''}" data-i="${i}" type="button" disabled style="left:${p[0]}px;top:${p[1]}px;width:${p[2]}px;height:${p[2]}px"><i class="den-cv" data-a="0x${(0x1A + i * 7).toString(16).toUpperCase().padStart(2, '0')}"></i><i class="den-fc"></i></button>`).join('');
}
/* the bottom bar: idle = [ ‹ | G 25  T 1 | › ] (tap arrows or swipe to change the stake); in a run = CASH OUT */
function bar(){
  const w = $('#lBar'); if (!w) return;
  const t = tickets(), st = stakeNow(), live = run && !run.over;
  if (game === 'lock'){ LKG.bar(w, capped()); return; }
  if (live){ snapRun();
    const val = pay(run.stake, run.m), can = run.k > 0;
    w.innerHTML = `<button class="den-cash" id="lCash" type="button"${can ? '' : ' disabled'}>${can ? `${game === 'hilo' ? 'TAKE PROFIT' : 'EXTRACT'} · <span class="g">${coinI()}${fmt(val)}</span>` : (game === 'hack' ? 'SCAN A BLIP' : 'CALL TO START')}</button>`;
    return;
  }
  if (run && run.maxed && game === 'hilo'){ w.innerHTML = '<button class="den-go den-rst" id="lReset" type="button">NEW MARKET</button>'; return; }
  if (capped()){ w.innerHTML = `<div class="den-go off"><span>DAILY LIMIT REACHED</span></div>`; return; }
  const i = STAKES.indexOf(st), poor = S.gold < st, free = freeReady(), noTk = t <= 0 && !free;   // short on gold / tickets: that number turns red and the button fades
  w.innerHTML = `<div class="den-go${poor || noTk ? ' short' : ''}" id="lGo"><button class="den-ar" data-d="-1" type="button" aria-label="Lower stake"${i <= 0 ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button class="den-mid" id="lPlay" type="button"><span class="g${poor ? ' red' : ''}">${coinI()}${st}</span><span class="t${noTk || free ? ' red' : ''}">${free ? chipSh() + '0' : chip() + '1'}</span></button><button class="den-ar" data-d="1" type="button" aria-label="Higher stake"${i >= STAKES.length - 1 ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
}
/* Higher / Lower button: word + × on the left half, the number on the right half, so both numbers line up */
const hbHtml = w => v => `<span class="hw"><i class="tri">${w === 'LONG' ? '▲' : '▼'}</i>${w}${v == null ? '' : ' ×'}</span><span class="hn">${v == null ? '—' : v.toFixed(2)}</span>`;
function hbSet(el, w, v){ if (!el) return; if (v == null){ if (el._r) el._r(); el._v = el._cur = null; el.innerHTML = hbHtml(w)(null); } else tweenM(el, v, hbHtml(w), 420); }
function readouts(){
  if (game === 'lock') return;
  if (game === 'hack'){
    const live = run && !run.over, k = run ? run.k : 0;
    if (live) segK = k;   // after a round ends the bar holds its last fill until the board resets
    const sn = $('#lSn'); if (!sn) return;
    const pct = live && k < SAFE ? Math.round(TRAPS / (N - k) * 100) + '%' : '—';   // chance that the next blip is a mine: mines left / blips left
    sn.textContent = pct; sn.dataset.t = pct; $('#lSt').textContent = live && k < SAFE ? (SAFE - k === 1 ? 'FINAL BLIP' : (SAFE - k) + ' SAFE BLIPS') : '';
    const last = live && k === SAFE - 1, hit = !!(run && run.hit);
    $('#lSs').textContent = hit ? 'HIT' : last ? '! DANGER !' : segK ? 'CAUTION' : 'OK';
    $('#lSeg').classList.toggle('hot', last || hit); $('#lSeg').classList.toggle('hit', hit);
    setTension(segK, last);
  } else {
    const live = run && !run.over, u = $('#lUp'), d = $('#lDn'); if (!u) return;
    ladder();
    if (live){ const pu = (100 - run.n) / 101, pd = run.n / 101; u.disabled = pu <= 0; d.disabled = pd <= 0;
      hbSet($('#oh'), 'LONG', pu > 0 ? odds(pu) : null); hbSet($('#ol'), 'SHORT', pd > 0 ? odds(pd) : null); }
    else { u.disabled = d.disabled = true; hbSet($('#oh'), 'LONG', null); hbSet($('#ol'), 'SHORT', null); }
  }
}
/* danger: the NEXT TILE box fills as safe tiles open (max at the 6th), heartbeat edges on the last 3, red radar sweep on the last tile */
const STEPS = 6;
function setTension(k, last){
  const t = Math.min(1, k / STEPS), seg = $('#lSeg'), board = $('.den-board'); if (!seg) return;
  const risk = Math.round(200 / (N - Math.min(k, SAFE))), r = Math.min(100, risk);
  seg.style.setProperty('--cc', heatColor(t)); seg.style.setProperty('--r', (r / 100).toFixed(3));
  seg.style.setProperty('--P', (1.7 / (1 + r / 70)).toFixed(2) + 's'); seg.style.setProperty('--D', (5.5 - r / 100 * 4).toFixed(1) + 's');
  heatSheet(t);
  if (board && board.classList.contains('red') !== !!last) dangerMode(!!last, board);
  if (tn){ tn.style.opacity = run && !run.over && k >= 4 ? (.12 + .2 * ((k - 4) / 2)) : 0; tn.style.setProperty('--p', (1.7 - 1.1 * t) + 's'); }
}
/* full clear: the bar and its border turn gold (instead of staying red) until the board resets */
const winGold = () => { const seg = $('#lSeg'); if (seg) seg.style.setProperty('--cc', 'hsl(44,100%,58%)'); };
const tensOff = () => { if (tn) tn.style.opacity = 0; const b = $('.den-board'); if (b) dangerMode(false, b); };
/* last tile: the tab border, title, scan bar and the opened blips turn red */
function dangerMode(on, board){
  if (gov && gov.firstChild) gov.firstChild.classList.toggle('den-dng', on);
  board.classList.toggle('red', on);
}
/* after a round the bar empties; the finished board stays up until the next Play */
function scheduleReset(ms){ clearTimeout(resetT); resetT = setTimeout(resetBoard, ms); }
function resetBoard(){
  if (!pg || game !== 'hack' || (run && !run.over)) return;
  segK = 0; setTension(0, false);
}
function step(d){
  if (game === 'lock') return;
  const i = STAKES.indexOf(stakeNow()), j = Math.max(0, Math.min(STAKES.length - 1, i + d));
  if (j === i) return; D().stake[game] = STAKES[j]; save(); bar();
}

/* ---------- start / end ---------- */
function start(){
  const t = tickets(), st = stakeNow(), go = $('#lGo');
  if (capped() || (game === 'lock' && LKG.held())) return;
  if (game === 'lock'){ const free = freeReady(); if (t <= 0 && !free){ deny(go); return; }
    if (free){ D().p = 0; save(); balSync(); } else { useTicket(-1); D().p = Math.min(FREE_AT, D().p + 1); save(); }
    LKG.start(); return; }
  const free = freeReady();
  if ((t <= 0 && !free) || S.gold < st){ deny(go); return; }
  goldDelta(-st); if (free){ D().p = 0; save(); balSync(); } else { useTicket(-1); D().p = Math.min(FREE_AT, D().p + 1); save(); } clearTimeout(resetT); resetId++;
  if (game === 'hack'){ segK = 0;
    const ice = new Set(); while (ice.size < TRAPS) ice.add(Math.floor(Math.random() * N));
    run = { stake:st, ice, k:0, m:1, over:false, opened:[] };
    /* old blips fade out one by one, then a fresh random set is revealed by the radar sweep */
    const me = run, old = [...($('#lGrid') || { children:[] }).children].filter(n => !n.classList.contains('hid'));
    const reveal = () => { if (run !== me || !$('#lGrid')) return; buildGrid(true); [...$('#lGrid').children].forEach(n => n.disabled = false); scan(); };
    scanClear(); old.forEach((n, i) => scanT.push(setTimeout(() => n.classList.add('hid'), i * 45)));
    scanT.push(setTimeout(reveal, old.length ? old.length * 45 + 450 : 0));
  } else { if (thRaf) thRaf(); run = { stake:st, n:Math.floor(Math.random() * 101), k:0, m:1, over:false, hist:[] }; renderTh(0, 1); const nn = $('#lNum'); nn.style.color = ''; nn.textContent = run.n; nn.classList.remove('idle'); setDisp(''); chStart(true); }
  bar(); readouts();
}
function payout(defer){
  const full = Math.floor(run.stake * run.m), amt = pay(run.stake, run.m), cur = netToday(); if (!defer) goldDelta(amt); run.over = true; clearSaved();
  const net = amt - run.stake, o = D(); if (net > 0) o.st.w += net; else o.st.l += -net;
  if (!CAP_TEST_FREEZE) o.pn = Math.max(0, cur + full - run.stake);
  o.best[game] = Math.max(o.best[game] || 0, run.m); save(); return amt;
}
/* cash-out celebration: coin burst + flash + big "+N G" count-up (transform/opacity only; skipped with Reduce effects) */
function celebrate(profit, mult, from, jack){
  if (!gov || reduced() || !gov.animate) return;
  const big = mult >= 5, huge = mult >= 10, n = huge ? 34 : big ? 24 : 14;
  const fx = document.createElement('div'); fx.className = 'den-fx' + (huge ? ' huge' : big ? ' big' : ''); gov.appendChild(fx);
  const W = innerWidth, H = innerHeight, ox = from ? from.x : W / 2, oy = from ? from.y : H / 2;
  const dm = document.createElement('i'); dm.className = 'den-dim'; fx.appendChild(dm);
  dm.animate([{ opacity:0 }, { opacity:1, offset:.15 }, { opacity:1, offset:.75 }, { opacity:0 }], { duration:1700 });
  const fl = document.createElement('i'); fl.className = 'den-flash'; fx.appendChild(fl);
  fl.animate([{ opacity:0 }, { opacity:huge ? .55 : .35, offset:.18 }, { opacity:0 }], { duration:620, easing:'ease-out' });
  const pop = document.createElement('div'); pop.className = 'den-pop';
  pop.innerHTML = `<small>${game === 'hilo' ? (jack ? 'MOONSHOT' : 'PROFIT') : (jack ? 'FLAWLESS' : 'EXTRACTED')}</small><b>${ico('i-coin')}<span id="lPopN">+0</span></b><u>${fm(mult)}</u>`;
  fx.appendChild(pop);
  pop.animate([
    { transform:'translate(-50%,-50%) scale(.3)', opacity:0 },
    { transform:'translate(-50%,-50%) scale(1.25)', opacity:1, offset:.22 },
    { transform:'translate(-50%,-50%) scale(1)', opacity:1, offset:.34 },
    { transform:'translate(-50%,-50%) scale(1)', opacity:1, offset:.8 },
    { transform:'translate(-50%,calc(-50% - 40px)) scale(1)', opacity:0 }
  ], { duration:1700, easing:'ease-out', fill:'both' });
  const el = pop.querySelector('#lPopN');
  tween(0, profit, 650, v => { el.textContent = '+' + fmt(Math.round(v)); return el.isConnected; });
  const bal = document.querySelector('#lBal .g'); if (bal) bal.animate([{ transform:'scale(1)' }, { transform:'scale(1.35)' }, { transform:'scale(1)' }], { duration:520, delay:500, easing:'ease-out' });
  setTimeout(() => fx.remove(), 2300);
}
/* the 7th tile: lock-break finale. shockwaves teal -> gold, gold ripple across every tile, spinning halo, board fades softly behind FIELD CLEARED + the gold, coins fly to the purse */
function finaleD1(net, lastI){
  if (!gov || !gov.animate) return;
  const fx = document.createElement('div'); fx.className = 'den-fx'; gov.appendChild(fx);
  const board = $('.den-board'), br = board.getBoundingClientRect(), cx = br.left + br.width / 2, cy = br.top + br.height / 2, nodes = [...$('#lGrid').children];
  const el = (cls, css) => { const e = document.createElement('i'); e.className = cls; e.style.cssText = css || ''; fx.appendChild(e); return e; };
  ['#2ee6d6', '#ffc94a', '#ffc94a'].forEach((c, i) => el('den-fring', `left:${cx}px;top:${cy}px;width:120px;height:120px;margin:-60px;border-width:${6 - i * 1.5}px;border-color:${c};box-shadow:0 0 12px ${c}`)
    .animate([{ transform:'scale(.2)', opacity:.6 }, { transform:'scale(6)', opacity:0 }], { duration:900, delay:i * 220, easing:'ease-out', fill:'both' }));
  const q = (nodes[lastI] || nodes[0]).getBoundingClientRect();
  nodes.map(n => { const p = n.getBoundingClientRect(); return { n, p, d:Math.hypot(p.left - q.left, p.top - q.top) }; }).forEach(o => setTimeout(() => {
    if (!o.n.classList.contains('bad')) o.n.animate([{ transform:'scale(1)' }, { transform:'scale(1.3)' }, { transform:'scale(1)' }], { duration:420, easing:'cubic-bezier(.3,1.6,.5,1)' });
    el('den-fring', `left:${o.p.left + o.p.width / 2}px;top:${o.p.top + o.p.height / 2}px;width:70px;height:70px;margin:-35px`).animate([{ transform:'scale(.5)', opacity:.5 }, { transform:'scale(2.4)', opacity:0 }], { duration:650, easing:'ease-out', fill:'both' });
  }, o.d * 2.2));
  const w = br.width * .96;
  el('den-fhalo', `left:${cx}px;top:${cy}px;width:${w}px;height:${w}px;margin:${-w / 2}px`).animate([{ transform:'rotate(0deg) scale(.8)', opacity:0 }, { transform:'rotate(180deg) scale(1)', opacity:.55, offset:.25 }, { transform:'rotate(540deg) scale(1)', opacity:.55, offset:.8 }, { transform:'rotate(720deg) scale(1.05)', opacity:0 }], { duration:3200, easing:'ease-in-out', fill:'both' });
  $('#lGrid').animate([{ opacity:1 }, { opacity:.5, offset:.08 }, { opacity:.5, offset:.9 }, { opacity:1 }], { duration:3800, easing:'ease-in-out' });   // blips stay dimmed until the coins have flown
  const tx = el('den-ftx', `left:${cx}px;top:${cy}px`); tx.innerHTML = `<b class="ty"></b><u>${ico('i-coin')}<span>+0</span></u>`;
  const ty = tx.querySelector('.ty'), u = tx.querySelector('u');
  [...'FIELD CLEARED'].forEach((ch, i) => { const sp = document.createElement('span'); sp.textContent = ch === ' ' ? '\u00a0' : ch; ty.appendChild(sp);
    sp.animate([{ transform:'translateY(-40px) scale(1.6)', opacity:0 }, { transform:'none', opacity:1 }], { duration:260, delay:400 + i * 60, easing:'cubic-bezier(.3,1.5,.5,1)', fill:'both' }); });
  u.animate([{ opacity:0, transform:'translateY(8px)' }, { opacity:1, transform:'none' }], { duration:300, delay:1200, fill:'both' });
  setTimeout(() => tween(0, net, 1000, v => { u.querySelector('span').textContent = '+' + fmt(Math.round(v)); return u.isConnected; }), 1200);
  tx.animate([{ opacity:1 }, { opacity:1, offset:.85 }, { opacity:0 }], { duration:3150, fill:'both' });
  setTimeout(() => fx.remove(), 4300);
}
/* coins fly to the gold balance shown inside the game tab (not the header purse behind it) */
function flyToBal(from, amount, done){
  const t = document.querySelector('#lBal .g svg');
  if (!t) return flyCoins(from, amount, done);
  flyArc(from, t.getBoundingClientRect(), coinCount(amount), { html: ico('i-coin'), z: 60, onLand: i => {
    if (i === 0 && done) done();
    const g = document.querySelector('#lBal .g'); if (g) g.animate([{ transform:'scale(1)' }, { transform:'scale(1.3)' }, { transform:'scale(1)' }], { duration:260, easing:'ease-out' });
  } });
}
function cash(auto){
  if (!run || run.over || run.k < 1) return;
  const cb = document.getElementById('lCash'), r = cb && cb.getBoundingClientRect(), from = r ? { x:r.left + r.width / 2, y:r.top + r.height / 2 } : null;
  const quiet = !gov || reduced() || !document.body.animate;
  const fin = auto && game === 'hack' && !quiet, brd = $('.den-board'), bb = brd && brd.getBoundingClientRect();
  const lastNode = fin ? [...$('#lGrid').children].find(n => n.classList.contains('open') && !n.classList.contains('bad')) : null;
  const amt = payout(!quiet); if (fin) finaleD1(amt - run.stake, run.lastI); else celebrate(amt - run.stake, run.m, from, auto);
  if (!quiet){   // the coins fly up into the purse (same flight as claiming a quest); the gold lands when the first one arrives
    const rc = fin && bb ? { left:bb.left + bb.width / 2, top:bb.top + bb.height / 2, width:0, height:0 } : { left:innerWidth / 2, top:innerHeight * .44, width:0, height:0 }, waves = run.m >= 10 ? 3 : run.m >= 5 ? 2 : 1, d0 = fin ? 2300 : 900;
    for (let w = 0; w < waves; w++) setTimeout(() => flyToBal(rc, amt, w === 0 ? () => goldDelta(amt) : null), d0 + w * 260);
  }
  if (game === 'hack') revealAll();
  if (auto && game === 'hilo') run.maxed = true;   // top of the ladder: the button becomes Reset first
  bar(); readouts(); tensOff(); if (auto && game === 'hack') winGold(); if (game === 'hack') scheduleReset(auto ? 3800 : 1800);
}
function lose(){
  if (run && !run.over){ const o = D(); o.st.l += run.stake; save(); }
  if (game === 'hilo'){ loseHilo(); return; }
  run.over = true; run.hit = true; clearSaved();
  { const bd = $('.den-board'); if (bd){ const q = document.createElement('div'); q.className = 'den-liq'; q.innerHTML = '<small>SIGNAL LOST</small>'; bd.appendChild(q); if (q.animate && !reduced()) q.animate([{ opacity:0, transform:'scale(.9)' }, { opacity:1, transform:'none', offset:.12 }, { opacity:1, offset:.8 }, { opacity:0 }], { duration:1600, fill:'both' }); setTimeout(() => q.remove(), 1600); } }
  bar(); readouts(); tensOff(); scheduleReset(1800);
}

/* Hack the Lock */
/* tiles 4-6: two bigger rings + sparks on top of the normal ring, a bit stronger each tap */
function burst(n, lvl){
  const board = $('.den-board'); if (!board) return;
  const br = board.getBoundingClientRect(), q = n.getBoundingClientRect(), cx = q.left - br.left + q.width / 2, cy = q.top - br.top + q.height / 2, S = [1, 1.8, 2.8][lvl - 1];
  const add = css => { const e = document.createElement('i'); e.className = 'den-bfx'; e.style.cssText = css; board.appendChild(e); return e; };
  [[2.2 + lvl * .8, 600 + lvl * 150, 0, 2 + lvl], [3 + lvl * 1.1, 900, 110, 2 + lvl]].forEach(([to, dur, dl, w]) =>
    add(`left:${cx - q.width / 2}px;top:${cy - q.height / 2}px;width:${q.width}px;height:${q.height}px;border:${w}px solid rgb(var(--den-gold));box-shadow:0 0 12px rgba(var(--den-gold),.7);border-radius:50%`)
      .animate([{ transform:'scale(.6)', opacity:.9 }, { transform:`scale(${to})`, opacity:0 }], { duration:dur, delay:dl, easing:'ease-out', fill:'both' }).onfinish = ev => ev.target.effect.target.remove());
  const cnt = 4 + lvl * 4;
  for (let i = 0; i < cnt; i++){
    const a = 2 * Math.PI * i / cnt + Math.random() * .3, d = 40 * S * (.7 + Math.random() * .5);
    add(`left:${cx - 3}px;top:${cy - 3}px;width:6px;height:6px;border-radius:50%;background:rgb(var(--den-gold));box-shadow:0 0 8px rgb(var(--den-gold))`)
      .animate([{ transform:'translate(0,0) scale(1)', opacity:1 }, { transform:`translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.2)`, opacity:0 }], { duration:600 + lvl * 120, easing:'cubic-bezier(.1,.7,.3,1)', fill:'both' }).onfinish = ev => ev.target.effect.target.remove();
  }
}
function pulseFx(n, bad){
  if (!n.animate || reduced()) return;
  const sh = gov && gov.firstChild;
  if (!bad){
    const r = document.createElement('i'); r.className = 'den-ring'; n.appendChild(r);
    r.animate([{ transform:'scale(1)', opacity:.9 }, { transform:'scale(2.3)', opacity:0 }], { duration:700, easing:'ease-out' }).onfinish = () => r.remove();
    n.animate([{ transform:'scale(1)' }, { transform:'scale(1.28)' }, { transform:'scale(1)' }], { duration:500, easing:'cubic-bezier(.3,1.6,.5,1)' });
    if (run && run.k >= 4 && run.k <= 6) burst(n, run.k - 3);
    return;
  }
  const board = $('.den-board'), br = board.getBoundingClientRect(), q = n.getBoundingClientRect();
  const w = document.createElement('i'); w.className = 'den-shock'; w.style.left = (q.left - br.left + q.width / 2) + 'px'; w.style.top = (q.top - br.top + q.height / 2) + 'px'; board.appendChild(w);
  w.animate([{ transform:'scale(.4)', opacity:1 }, { transform:'scale(9)', opacity:0 }], { duration:700, easing:'ease-out' }).onfinish = () => w.remove();
  [...$('#lGrid').children].forEach(x => { if (x === n) return; const p = x.getBoundingClientRect(), dx = p.left - q.left, dy = p.top - q.top, d = Math.hypot(dx, dy) || 1;
    x.animate([{ transform:'none' }, { transform:`translate(${dx / d * 14}px,${dy / d * 14}px)` }, { transform:'none' }], { duration:420, easing:'ease-out' }); });
}
const MINE_SVG = '<svg class="den-mi" viewBox="0 0 48 48" aria-label="Mine"><polygon points="37.9,32.0 24.0,40.0 10.1,32.0 10.1,16.0 24.0,8.0 37.9,16.0"/><path d="M37.9 32.0L42.2 34.5"/><path d="M24.0 40.0L24.0 45.0"/><path d="M10.1 32.0L5.8 34.5"/><path d="M10.1 16.0L5.8 13.5"/><path d="M24.0 8.0L24.0 3.0"/><path d="M37.9 16.0L42.2 13.5"/><polygon points="43.5,35.2 24.0,46.5 4.5,35.3 4.5,12.8 24.0,1.5 43.5,12.8" stroke-opacity=".3" stroke-width="1.6"/><g transform="translate(9.1 9.1) scale(.62)"><path d="M13 23c0-7 5-12 11-12s11 5 11 12c0 3-2 5-4 6v5H17v-5c-2-1-4-3-4-6z" fill="currentColor" stroke="none"/><circle cx="19" cy="23" r="3" fill="#2a0a12" stroke="none"/><circle cx="29" cy="23" r="3" fill="#2a0a12" stroke="none"/><path d="M22.5 30l1.5-3 1.5 3" stroke="#2a0a12" stroke-width="2.4"/></g></svg>';
function face(i, bad, quiet){ const n = $('#lGrid').children[i]; if (!quiet) pulseFx(n, bad); n.classList.add('open'); if (bad) n.classList.add('bad'); n.querySelector('.den-fc').innerHTML = bad ? MINE_SVG : mH(hmult(run.k)); }
function revealAll(){ [...$('#lGrid').children].forEach((n, i) => { if (!n.classList.contains('open')){ n.classList.add('open'); if (run.ice.has(i)){ n.classList.add('bad'); n.querySelector('.den-fc').innerHTML = MINE_SVG; } else { n.classList.add('dim'); n.querySelector('.den-fc').textContent = '·'; } } n.disabled = true; }); }
function pick(i){
  if (!run || run.over) return; const n = $('#lGrid').children[i]; if (n.classList.contains('open')) return;
  if (run.ice.has(i)){ face(i, true); revealAll(); lose(); return; }
  const prevM = run.m; run.k++; run.m = hmult(run.k); run.lastI = i; run.opened.push(i); face(i, false);
  if (run.k >= SAFE){ cash(true); return; }
  bar(); readouts(); countCashBtn(pay(run.stake, prevM), pay(run.stake, run.m));
}
/* Higher / Lower */
/* ---------- Higher / Lower "price line" chart: every call adds a point, like a live price ---------- */
const CH_SL = 7, CH_GOLD = '255,201,74';
let chEm = false, chRaf = null, chSer = [];
const chSeries = () => (chEm || !run || !run.hist) ? [] : run.hist.map(h => h.n).concat(run.n);
function chStart(fresh){ chEm = false; chFade(1); chSer = chSeries(); if (fresh && chSer.length === 1) chAnim(chSer, 0, 700); else chDraw(1, 0); }
function chEmpty(){ chEm = true; chSer = []; chFade(1); chDraw(1, 0); }
function chFade(p){ const c = $('#lChart'); if (c) c.style.opacity = p >= 1 ? '' : String(.15 + .85 * Math.max(0, p)); }
function chAnim(arr, from, dur = 480){
  if (chRaf) chRaf(); chSer = arr.slice(-CH_SL - 1);
  if (reduced()){ chDraw(1, from); return; }
  chRaf = tween(0, 1, dur, p => chDraw(p, from));
}
function chDraw(p, from){
  const d = $('#lDisp'), svg = $('#lChart'); if (!d || !svg) return;
  const W = d.clientWidth || 260, H = d.clientHeight || 120, v = chSer, n = v.length, A = 44, B = H - 12, X0 = 12, X1 = W - 44, y = q => B - q / 100 * (B - A);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let s = '<g stroke="rgba(' + CH_GOLD + ',.1)">';
  for (let i = 0; i <= 4; i++){ const gy = A + (B - A) * i / 4; s += `<line x1="0" x2="${W}" y1="${gy}" y2="${gy}"/>`; }
  for (let i = 0; i < CH_SL; i++){ const gx = X0 + (X1 - X0) * i / (CH_SL - 1); s += `<line x1="${gx}" x2="${gx}" y1="${A}" y2="${B}"/>`; }
  s += '</g>';
  if (n){
    const anim = p < 1, cur = anim ? from + (v[n - 1] - from) * p : v[n - 1];
    const up = n < 2 || Math.round(cur) >= Math.round(anim ? from : v[n - 2]), col = up ? '61,220,132' : '255,59,92'; d.style.borderColor = `rgb(${col})`;
    const sx = i => X0 + (X1 - X0) * (i === n - 1 ? CH_SL - 1 : i - (n - 1) + (CH_SL - 1) + (anim ? 1 - p : 0)) / (CH_SL - 1);
    const pts = v.map((q, i) => [sx(i), y(i === n - 1 ? cur : q)]).filter(q => q[0] >= -4);
    if (n <= CH_SL) pts.unshift([X0, B]);   /* the line starts at the origin (bottom-left) and rises to the price */
    const dd = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' '), ly = y(cur);
    s += `<defs><linearGradient id="lChg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${col})" stop-opacity=".32"/><stop offset="1" stop-color="rgb(${col})" stop-opacity="0"/></linearGradient></defs>`;
    if (pts.length > 1) s += `<path d="${dd} L${pts[pts.length - 1][0].toFixed(1)} ${B} L${pts[0][0].toFixed(1)} ${B}Z" fill="url(#lChg)"/><path d="${dd}" fill="none" stroke="rgb(${col})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<line x1="0" x2="${W}" y1="${ly}" y2="${ly}" stroke="rgba(${CH_GOLD},.7)" stroke-dasharray="3 3"/><circle cx="${X1}" cy="${ly}" r="4" fill="rgb(${col})"/><rect x="${W - 38}" y="${ly - 7.5}" width="34" height="15" fill="#0a1812"/><rect x="${W - 38}" y="${ly - 7.5}" width="34" height="15" fill="rgba(${CH_GOLD},.16)" stroke="rgba(${CH_GOLD},.8)" stroke-width="1"/><text x="${W - 21}" y="${ly + 3.5}" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10.5" fill="rgb(${CH_GOLD})">${Math.round(cur)}</text>`;
    const dl = $('#lDelta'); if (dl){ if (n > 1){ const df = Math.round(cur) - Math.round(anim ? from : v[n - 2]); dl.style.color = df >= 0 ? 'rgb(var(--den-grn))' : 'rgb(var(--den-red))'; dl.textContent = (df >= 0 ? '▲ +' : '▼ −') + Math.abs(df); } else dl.textContent = ''; }
  } else { d.style.borderColor = 'rgb(61,220,132)'; const dl = $('#lDelta'); if (dl) dl.textContent = ''; }
  svg.innerHTML = s;
}
function setDisp(c){ const d = $('#lDisp'); if (!d) return; d.className = 'den-disp ' + c; void d.offsetWidth; }
function guess(dir){
  if (!run || run.over) return;
  const prevOn = Math.floor(fracIdx(run.m) + 1e-6), prevM = run.m;
  const p = dir > 0 ? (100 - run.n) / 101 : run.n / 101, o = odds(p);
  let nx = Math.floor(Math.random() * 101);
  run.hist.push({ n:run.n, w:true }); if (run.hist.length > 8) run.hist.shift();
  const num = $('#lNum'); num.textContent = nx; replay(num, 'pop'); chAnim(run.hist.map(h => h.n).concat(nx), run.n);
  if (nx === run.n) setDisp('push');   // flat: nothing won, nothing lost
  else if (dir > 0 ? nx > run.n : nx < run.n){ run.k++; run.m *= o; run.n = nx; setDisp('win'); hiPop(prevOn); if (run.m >= 10){ cash(true); return; } }
  else { run.hist[run.hist.length - 1].w = false; run.n = nx; setDisp('lose'); lose(); return; }
  bar(); readouts(); countCashBtn(pay(run.stake, prevM), pay(run.stake, run.m));
}

/* the Cash Out amount ticks up after a win */
let cashShown = null, cashRun = null, cashStop = null;
function countCashBtn(from, to){
  if (cashStop) cashStop(); if (cashRun !== run){ cashRun = run; cashShown = null; }
  const start = cashShown != null ? cashShown : from;   // continue from the number on the button now
  cashShown = to;
  if (start === to || reduced()) return;
  cashStop = tween(start, to, 420, (v, k) => { const el = $('#lCash .g'); if (!el) return false; cashShown = k < 1 ? Math.round(v) : to; el.innerHTML = coinI() + fmt(cashShown); });
}
/* win pop: a soft bloom behind the number every win; the full pop (panel ring + ring on the ladder step) only when you reach a new step */
function hiPop(prevOn){
  if (!gov || !gov.animate || reduced()) return;
  const on = Math.floor(fracIdx(run.m) + 1e-6), cross = on !== prevOn, col = THC(Math.min(1, on / 5)), colA = a => heatA(Math.min(1, on / 5), a);
  const d = $('#lDisp'); if (!d) return; const r = d.getBoundingClientRect();
  const fx = document.createElement('div'); fx.className = 'den-fx'; gov.appendChild(fx);
  const add = css => { const e = document.createElement('i'); e.className = 'den-bfx'; e.style.cssText = css; fx.appendChild(e); return e; };
  add(`left:${r.left - 20}px;top:${r.top - 20}px;width:${r.width + 40}px;height:${r.height + 40}px;border-radius:50%;background:radial-gradient(circle,${colA(.55)},transparent 70%)`)
    .animate([{ opacity:0, transform:'scale(.8)' }, { opacity:cross ? 1 : .3, offset:.25 }, { opacity:0, transform:'scale(1.25)' }], { duration:800, fill:'both' });
  if (cross){
    const ring = (x, y, sz, to, dur) => add(`left:${x - sz / 2}px;top:${y - sz / 2}px;width:${sz}px;height:${sz}px;border-radius:50%;border:2px solid ${col};box-shadow:0 0 14px ${colA(.8)}`)
      .animate([{ transform:'scale(.5)', opacity:.9 }, { transform:`scale(${to})`, opacity:0 }], { duration:dur, easing:'ease-out', fill:'both' });
    ring(r.left + r.width / 2, r.top + r.height / 2, r.height, 2.4, 800);
    const t = th && th.ticks[on]; if (t){ const q = t.getBoundingClientRect(); ring(q.left + q.width / 2, q.top + q.height / 2, 26, 2.2, 620); }
  }
  setTimeout(() => fx.remove(), 1000);
}
/* after reaching the top: Reset empties the ladder (top-first, number falls with it) and then the Start bar returns */
function resetHilo(){
  if (!run || !run.maxed) return; const b = $('#lReset'); if (b) b.disabled = true;
  const n = $('#lNum'), v = run.n, f0 = thF, id = ++resetId, gold = [255, 201, 74], grey = [95, 116, 114];
  const fin = () => { if (!pg || id !== resetId) return; run = null; n.style.color = ''; n.textContent = '–'; n.classList.add('idle'); setDisp(''); chEmpty(); if (n.animate) n.animate([{ opacity:0 }, { opacity:1 }], { duration:320 }); bar(); readouts(); };
  if (reduced() || !n.animate){ renderTh(0, 1); fin(); return; }
  animTh(f0, 0, 590, k => k, (f, k) => { const p = f0 ? f / f0 : 0; renderTh(f, Math.max(1, muOf(Math.max(0, f)))); n.textContent = Math.round(v * p); chFade(p); n.style.color = `rgb(${gold.map((r, i) => Math.round(grey[i] + (r - grey[i]) * p))})`; },
    () => { n.textContent = 0; setTimeout(fin, 260); });
}
/* a lost round: the panel holds red, then the bar empties top-first while the number falls in step with it and cools red -> grey, then -, then the Start bar returns */
function loseHilo(){
  run.over = true; run.lost = true; clearSaved();
  { const d = $('#lDisp'); if (d){ const q = document.createElement('div'); q.className = 'den-liq'; q.innerHTML = `<small>LIQUIDATED</small>`; d.appendChild(q); if (q.animate && !reduced()) q.animate([{ opacity:0, transform:'scale(.9)' }, { opacity:1, transform:'none', offset:.15 }, { opacity:1, offset:.8 }, { opacity:0 }], { duration:1500, fill:'both' }); setTimeout(() => q.remove(), 1500); } } const cb = $('#lCash'); if (cb) cb.disabled = true; readouts();
  const n = $('#lNum'), v = run.n, f0 = thF, red = [255, 59, 92], grey = [95, 116, 114], id = ++resetId;
  const fin = () => { if (!pg || id !== resetId) return; n.style.color = ''; n.textContent = '–'; n.classList.add('idle'); setDisp(''); chEmpty(); if (n.animate) n.animate([{ opacity:0 }, { opacity:1 }], { duration:320 }); bar(); readouts(); };
  if (reduced() || !n.animate){ renderTh(0, 1); fin(); return; }
  setTimeout(() => { if (!pg || id !== resetId) return;
    animTh(f0, 0, 590, k => k, (f, k) => { const p = f0 ? f / f0 : 0; renderTh(f, Math.max(1, muOf(Math.max(0, f)))); n.textContent = Math.round(v * p); chFade(p); n.style.color = `rgb(${red.map((r, i) => Math.round(grey[i] + (r - grey[i]) * p))})`; },
      () => { n.textContent = 0; setTimeout(fin, 260); });
  }, 500);
}
/* Lockpick lives in lockpick.js; it gets the Den's helpers here */
const LKG = makeLockpick({ $, D, save, tickets, freeReady, chip, chipSh, useTicket, balSync, goldDelta, gem:gemI, heatSheet, bar, reduced, coin:coinI, HEAT, HEAT_E, CAP_TEST_FREEZE, netToday, tween, fly:(el, amt, done) => { const r = el.getBoundingClientRect(); setTimeout(() => flyToBal({ left:r.left, top:r.top, width:r.width, height:r.height }, amt, done), 1300); }, heatE:() => false, game:() => game, pg:() => pg });
const MK = makeMarket({ D, gem:gemI, gemPaint, reduced, nextMid });   // the Black Market shop (edge tab on the Den page)
/* ---------- events ---------- */
document.addEventListener('click', e => {
  if (!pg || !pg.contains(e.target)) return;
  if (e.target.closest('.den-back')){ closeGame(); return; }
  const ar = e.target.closest('.den-ar'); if (ar){ step(+ar.dataset.d); return; }
  if (e.target.closest('#lReset')){ resetHilo(); return; }
  if (e.target.closest('#lPlay')){ if (swiped){ swiped = false; return; } start(); return; }
  if (e.target.closest('#lCash')){ cash(false); return; }
  const nd = e.target.closest('.den-nd'); if (nd){ pick(+nd.dataset.i); return; }
  if (e.target.closest('#lUp')) guess(1); else if (e.target.closest('#lDn')) guess(-1);
});
/* swipe the Start bar sideways to change the stake (right = more, left = less) */
{
  const lift = () => { document.querySelectorAll('.den-go.press').forEach(g => g.classList.remove('press')); setTimeout(() => { swiped = false; }, 60); };
  onDrag(document, { axis:'free',
    start: e => { const go = e.target.closest && e.target.closest('#lGo'); if (!go) return null;
      if (e.target.closest('.den-mid')) go.classList.add('press'); swiped = false; return { base:0 }; },
    move: (s, dx) => { if (Math.abs(dx - s.base) < 34) return; step(dx - s.base > 0 ? 1 : -1); s.base = dx; swiped = true; },   // one stake step per 34 px
    end: lift });
}

/* keep the pill and the page in step when the app re-renders (new day = new tickets) */
const _render = render;
render = function(){ const r = _render.apply(this, arguments); try { tkSync(); if (pg && !(run && !run.over)) bar(); } catch (e) {} return r; };

/* phone back button (called first by handleBack): game -> Den -> closed */
window.PsychDen = {
  back(){ if (MK.isOpen()){ MK.close(); return true; } if (pg){ closeGame(); return true; } if (ov){ closeDen(); return true; } return false; },
  count: tickets,
  icon: (cls = '') => chip(cls),
  /* earn tickets: saved at once, but the header count waits (tkHold) until land() so it can roll when the flying tickets arrive */
  add(n){ n = Math.max(0, Math.round(n)); if (!n) return 0; D().t += n; tkHold += n; save();
    clearTimeout(tkSafe); tkSafe = setTimeout(() => { tkHold = 0; tkSync(); }, 9000); return n; },
  land(n){ tkHold = Math.max(0, tkHold - n); if (!tkHold) clearTimeout(tkSafe); tkSync(); if (ov) openDen(); },
  gain(n){ n = this.add(n); this.land(n); },                      // quiet: no flight
  take(n){ const o = D(); o.t = Math.max(0, o.t - Math.max(0, Math.round(n))); save(); tkSync(); },   // a reward was undone
  packFirst(){ const o = D(), k = dayKey(); if (o.pk === k) return 0; o.pk = k; return this.add(1); },   // 1 ticket for the first pack opened each day
  /* a ticket fades in and pops at a spot (e.g. the claimed step goal), then flies up to the header count */
  pop(from, n){
    if (reduced() || !document.body.animate){ this.fly(from, n); return; }
    const el = document.createElement('div'); el.className = 'fly den-ftk den-ptk'; el.innerHTML = chip(); document.body.appendChild(el);
    const x = from.left + from.width / 2 - 17, y = from.top + from.height / 2 - 17;
    el.style.transform = `translate(${x}px,${y}px)`;
    el.animate([{ transform:`translate(${x}px,${y}px) scale(.3)`, opacity:0 }, { transform:`translate(${x}px,${y}px) scale(1.3)`, opacity:1, offset:.5 }, { transform:`translate(${x}px,${y}px) scale(1)`, opacity:1 }], { duration:480, easing:'ease-out', fill:'both' }).onfinish = () => setTimeout(() => { el.remove(); PsychDen.fly(from, n); }, 260);
  },
  spend(n){ const o = D(); if (o.t < n) return false; o.t -= n; save(); tkSync(); return true; },
  /* tickets fly from a screen rectangle up into the header count (like the coins into the purse); the count rolls when the first one lands */
  fly(from, n){
    const tgt = tkBtn.querySelector('svg'); if (!tgt || reduced() || !document.body.animate){ this.land(n); return; }
    flyArc(from, tgt.getBoundingClientRect(), Math.min(3, Math.max(1, n)), { html: chip(), cls: 'fly den-ftk', stagger: 80, onLand: i => { if (i === 0) PsychDen.land(n); } });
  }
};
})();
