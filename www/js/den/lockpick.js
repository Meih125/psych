/* Den game 3: Lockpick (from mock-den-lockpick-hairline). Costs 1 ticket (or the free 10th play), no gold stake.
   A needle sweeps a ring; tap while it is inside the gap. Each hit = next level (smaller gap, faster needle, spinning ring from round 2).
   A miss ends the run and pays the reward of the highest level reached (a miss never loses money).
   A live run is saved when you back out (o.sv.lock) and resumed on reopening.
   Uses the Den's shared globals (D, S, save, tickets, useTicket, balSync, goldDelta, chip, chipSh, heatRgb, heatSheet, $, game, pg).
   The reward ladder numbers are PLACEHOLDERS (to be decided). The run lives in `lk`, not in the Den's `run`. */
window.makeLockpick = env => {
  const { $, D, save, tickets, freeReady, chip, chipSh, useTicket, balSync, goldDelta, heatSheet, bar, reduced, HEAT, HEAT_E, CAP_TEST_FREEZE, netToday, tween, fly } = env, game = env.game, pg = env.pg;
const LK_GOLD = [0, 1, 2, 3, 4, 5, 10, 12, 15, 18, 22, 27, 35, 40, 45, 50, 55, 60, 75], LK_MS = [6, 12, 18], LK_HEAT = 18;   // reward ladder: gold TOTAL paid for reaching each level (past 18: +10 per level); borders at 6 / 12 / 18
const lkGold = n => n <= 0 ? 0 : n < LK_GOLD.length ? LK_GOLD[n] : 75 + 10 * (n - 18), lkBug = n => n >= 18 ? 3 : n >= 12 ? 1 : 0;   // Gem ("bug"): rewards add up: level 12 earns 1, level 18 earns 2 more (3 in total); the ladder only shows B on those two rows
/* rewards ADD UP: every level you clear adds its own amount (the ladder shows that step; lkGold(n) is the running total that gets paid) */
const lkStep = n => lkGold(n) - lkGold(n - 1);
const lkPay = (n, tot) => `<em class="g">${tot}</em>` + (n === 12 || n === 18 ? `<em class="b">${env.gem()}${n === 12 ? 1 : 2}</em>` : '');   // the running total only (+ the B earned on 12 / 18)
const LK_P = { zone0:78, zoneShrink:.93, zoneMin:7, speed0:170, speedAdd:18, speedMax:450, ringFrom:3, ringBase:25, ringAdd:12, ringMax:150 }, LK_OFF = 2,
  LK_HARD = { blend:7, from:10, zoneShrink:.9, speedAdd:24, speedMax:560, ease:[1.3, 1.2, 1.1] };   // level 10 and up: the original ramp with a wider green zone: x1.3 at 10, x1.2 at 11, x1.1 from 12 (about 30 / 20 / 10% easier); levels 7-9 blend into the level 10 value
const lkHeat = (t, icy = true) => { const LK_STOPS = [...(icy ? [[150, 225, 255]] : []), ...(env.heatE() ? HEAT_E : HEAT)];   // icy white at level 0, then the Minesweeper heat ladder
  t = Math.min(1, Math.max(0, t)); const n = LK_STOPS.length - 1, x = t * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, A = LK_STOPS[i], B = LK_STOPS[i + 1]; return A.map((v, j) => v + (B[j] - v) * f); };
let lk = null;
const lkRad = d => d * Math.PI / 180, lkNorm = a => ((a % 360) + 360) % 360, lkDiff = (a, b) => { const d = Math.abs(lkNorm(a) - lkNorm(b)); return d > 180 ? 360 - d : d; };
const LK_C = 340, LK_RI = 226, LK_RO = 310;

function lockBody(){
  return `<div class="lk-split"><div class="lk-rs" id="lkRs"></div><div class="lk-rail" id="lkRail"></div></div>
  <div class="lk-chips"><div class="lk-chip">LEVEL<b id="lkLv">0</b></div><div class="lk-chip"><span id="lkBl">BEST</span><b id="lkBest">0</b></div></div>`;
}
function lockInit(){
  lockStop(true);
  const cv = document.createElement('canvas'); cv.width = cv.height = 680; $('#lkRs').appendChild(cv);
  lk = { cv, g:cv.getContext('2d'), lvl:0, run:false, over:false, needle:0, dir:1, speed:0, zc:0, zw:0, ring:0, ringSpd:0, za:1, oz:null, fx:0, miss:0, last:performance.now(), HR:lkHeat(0), raf:0 };
  /* idle: the dial already turns like the second round (needle speed, gap size, spinning ring), so the screen looks alive; Start carries on from the same needle and ring angle */
  const d2 = 1 + LK_OFF;
  lk.zw = Math.max(LK_P.zoneMin, LK_P.zone0 * Math.pow(LK_P.zoneShrink, d2)); lk.zc = 60;
  lk.idle = { speed:Math.min(LK_P.speedMax, LK_P.speed0 + d2 * LK_P.speedAdd), ring:Math.min(LK_P.ringMax, LK_P.ringBase + (d2 - LK_P.ringFrom) * LK_P.ringAdd) * (Math.random() < .5 ? -1 : 1) };
  const loop = t => { if (!lk || !pg()) return; lkFrame(t); lk.raf = requestAnimationFrame(loop); };
  lk.raf = requestAnimationFrame(loop); lkRestore(); lkRender();
}
function lkSnap(){   // a live run is kept exactly as it is (like Minesweeper / Day Trader) when you back out or the app is closed
  if (!lk || !lk.run) return; const o = D(); if (!o.sv) o.sv = {};
  o.sv.lock = { lvl:lk.lvl, zc:lk.zc, ring:lk.ring, zw:lk.zw, needle:lk.needle, dir:lk.dir, speed:lk.speed, ringSpd:lk.ringSpd }; save();
}
function lkRestore(){
  const s = D().sv && D().sv.lock; if (!s || typeof s !== 'object') return; const f = k => Number.isFinite(+s[k]) ? +s[k] : null;
  const v = { lvl:f('lvl'), zc:f('zc'), ring:f('ring'), zw:f('zw'), needle:f('needle'), dir:f('dir'), speed:f('speed'), ringSpd:f('ringSpd') };
  if (Object.values(v).some(x => x == null) || v.lvl < 0 || v.lvl > 1000 || v.zw <= 0 || v.zw > 360 || (v.dir !== 1 && v.dir !== -1)){ delete D().sv.lock; return; }
  v.lvl = Math.round(v.lvl); Object.assign(lk, v, { run:true, over:false, za:1 });
  lk.HR = lkHeat(lk.lvl / LK_HEAT); heatSheet(lk.lvl / LK_HEAT);
}
function lockStop(quiet){
  if (!lk) return; cancelAnimationFrame(lk.raf); lkSnap(); lk = null; bgPause(false);
}
function lkNewRound(first){
  const d = lk.lvl + LK_OFF;
  lk.zw = Math.max(LK_P.zoneMin, LK_P.zone0 * Math.pow(LK_P.zoneShrink, d)); lk.speed = Math.min(LK_P.speedMax, LK_P.speed0 + d * LK_P.speedAdd);
  if (lk.lvl >= LK_HARD.blend){
    const hz = Math.max(LK_P.zoneMin, LK_P.zone0 * Math.pow(LK_HARD.zoneShrink, d)) * LK_HARD.ease[Math.min(2, Math.max(0, lk.lvl - LK_HARD.from))], hs = Math.min(LK_HARD.speedMax, LK_P.speed0 + d * LK_HARD.speedAdd);
    const t = Math.min(1, (lk.lvl - LK_HARD.blend + 1) / (LK_HARD.from - LK_HARD.blend + 1));   // 0.25, 0.5, 0.75, then 1 from level 10
    lk.zw += (hz - lk.zw) * t; lk.speed += (hs - lk.speed) * t;
  }
  lk.ringSpd = d >= LK_P.ringFrom ? Math.min(LK_P.ringMax, LK_P.ringBase + (d - LK_P.ringFrom) * LK_P.ringAdd) * (Math.random() < .5 ? -1 : 1) : 0;
  if (!first) lk.dir *= -1; lk.zc = lkNorm(lk.needle - lk.ring + (60 + Math.random() * 240) * lk.dir); lk.za = 0;
}
function lockStart(){   // called by start() after the cost was paid
  if (D().sv) delete D().sv.lock;
  if (lk.over) lk.oz = { a:lk.zc + lk.ring, w:lk.zw, t:1 };   // after a miss, the gap you missed flashes white as the new run starts (like the mock)
  const hadOz = lk.oz; lk.lvl = 0; lk.run = true; lk.over = false; lk.missPx = null; lk.dir = 1; lkNewRound(true); lk.oz = hadOz; lk.last = performance.now();
  heatSheet(0); lkRender(); bar();
}
function lockPick(){
  if (!lk || !lk.run) return; const hit = lkDiff(lk.needle, lk.zc + lk.ring) <= lk.zw / 2;
  if (hit){ lk.oz = { a:lk.zc + lk.ring, w:lk.zw, t:1 }; lk.lvl++; lk.fx = 1; lkNewRound(false); heatSheet(lk.lvl / LK_HEAT); }
  else { lk.miss = 1; lk.missPx = Math.max(1, Math.round((lkDiff(lk.needle, lk.zc + lk.ring) - lk.zw / 2) * Math.PI / 180 * ((LK_RI + LK_RO) / 2) * (lk.cv.clientWidth / 680))); lkEnd(false); }
  lkRender();
}
function lkEnd(leaving){
  const L = lk.lvl, g = lkGold(L), x = lkBug(L); lk.run = false; lk.over = true;
  const o = D(); o.best.lock = Math.max(o.best.lock || 0, L); if (o.sv) delete o.sv.lock;
  if (g && !CAP_TEST_FREEZE){ netToday(); o.pn = Math.min(1e9, o.pn + g); }   // counts toward the daily profit limit, but NOT toward the Den's won / lost totals (those are for gambling only)
  o.b += x; save();
  let paid = false; const pay = () => { if (!paid){ paid = true; if (g) goldDelta(g, 'lock'); balSync(); if (!leaving) setTimeout(release, 350); } };   // the gold always lands (even if you leave while the coins fly)
  const release = () => { if (lk && lk.hold){ lk.hold = false; if (lk.over && !lk.run && pg()) bar(); } };
  if (!leaving) lk.hold = true;   // the Start button stays locked until the coins have landed, so a double tap on PICK can't start the next run
  const rs = $('#lkRs'), quiet = leaving || reduced() || !rs || !rs.animate || !g;
  if (quiet) pay(); else { lkPopup(rs, L, g, x); fly($('#lkRail .c') || rs, g, pay);   // the coins leave the current ladder row
    setTimeout(pay, 2200); }
  if (!leaving){ lkRender();
    const s = $('#lkRs'); if (s && s.animate && !reduced()) s.animate([{ transform:'translateX(0)' }, { transform:'translateX(-7px)' }, { transform:'translateX(7px)' }, { transform:'none' }], { duration:280 });
    bar(); }
}
/* the payout after a miss: a big gold number counts up over the ring, then the coins fly up into the balance */
function lkPopup(rs, L, g, b){
  const ov = document.createElement('div'); ov.className = 'lk-pop'; ov.innerHTML = `<small>LEVEL ${L} CLEARED</small><b>${env.coin()}<span>+0</span></b>${b ? `<i>${env.gem()}+${b}</i>` : ''}`; rs.appendChild(ov);
  const big = ov.querySelector('b'), num = big.querySelector('span'), lab = ov.querySelector('small');
  lab.animate([{ opacity:0 }, { opacity:1 }], { duration:300, fill:'both' }); lab.animate([{ opacity:1 }, { opacity:0 }], { duration:300, delay:1500, fill:'both' });
  ov.querySelectorAll('i').forEach(e => { e.animate([{ opacity:0 }, { opacity:1 }], { duration:300, delay:700, fill:'both' }); e.animate([{ opacity:1 }, { opacity:0 }], { duration:300, delay:1500, fill:'both' }); });
  big.animate([{ opacity:0, transform:'scale(.6)' }, { opacity:1, transform:'scale(1.1)', offset:.3 }, { opacity:1, transform:'scale(1)', offset:.5 }, { opacity:1, transform:'scale(1)', offset:.8 }, { opacity:0, transform:'scale(.7)' }], { duration:1800, delay:200, easing:'ease-out', fill:'both' });
  setTimeout(() => tween(0, g, 700, v => { num.textContent = '+' + Math.round(v); return big.isConnected; }), 300);
  setTimeout(() => ov.remove(), 2300);
}
function lkFrame(t){
  const dt = Math.min(.05, (t - lk.last) / 1000); lk.last = t;
  if (lk.run){ lk.needle = lkNorm(lk.needle + lk.dir * lk.speed * dt); lk.ring = lkNorm(lk.ring + lk.ringSpd * dt); }
  else if (lk.idle && !reduced()){ lk.needle = lkNorm(lk.needle + lk.dir * lk.idle.speed * dt); lk.ring = lkNorm(lk.ring + lk.idle.ring * dt); }
  if (lk.za < 1) lk.za = Math.min(1, lk.za + dt / .42); if (lk.oz){ lk.oz.t -= dt * 4.5; if (lk.oz.t <= 0) lk.oz = null; }
  if (lk.fx > 0) lk.fx = Math.max(0, lk.fx - dt * 2.4); if (lk.miss > 0) lk.miss = Math.max(0, lk.miss - dt * 1.6);
  const tg = lkHeat(lk.lvl / LK_HEAT), k = 1 - Math.exp(-dt * 3); lk.HR = lk.HR.map((v, i) => v + (tg[i] - v) * k);
  const g = lk.g; g.clearRect(0, 0, 680, 680); lkDraw(g);
}
function lkDraw(g){
  const C = LK_C, RI = LK_RI, RO = LK_RO, HR = lk.HR, H = HR.map(Math.round).join(','), RG = 'rgb(' + H + ')';
  const tint = f => `rgb(${HR.map(v => Math.round(v + (255 - v) * f))})`, L = tint(.6), W = tint(.85);
  const circ = (r, f, s, w) => { g.beginPath(); g.arc(C, C, r, 0, 7); if (f){ g.fillStyle = f; g.fill(); } if (s){ g.strokeStyle = s; g.lineWidth = w || 2; g.stroke(); } };
  const ln = (a, r0, r1, w, c) => { const r = lkRad(a - 90); g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(C + Math.cos(r) * r0, C + Math.sin(r) * r0); g.lineTo(C + Math.cos(r) * r1, C + Math.sin(r) * r1); g.stroke(); };
  const sec = (a0, a1, r0, r1, fill) => { g.beginPath(); g.arc(C, C, r1, lkRad(a0 - 90), lkRad(a1 - 90)); g.arc(C, C, r0, lkRad(a1 - 90), lkRad(a0 - 90), true); g.closePath(); g.fillStyle = fill; g.fill(); };
  const e = (() => { const c = 1.5, t = lk.za - 1; return Math.max(0, 1 + (c + 1) * t * t * t + c * t * t); })(), w = lk.zw * e, z0 = lk.zc + lk.ring - w / 2, z1 = lk.zc + lk.ring + w / 2;
  circ(336, '#020a10', 'rgba(' + H + ',.28)', 3);
  const R = [RI, RI + 20, RI + 40, RI + 60, RO];
  R.forEach((r, k) => { g.strokeStyle = 'rgba(' + H + ',' + (k % 2 ? .6 : .95) + ')'; g.lineWidth = k % 2 ? 3 : 4;
    for (let j = 0; j < 4; j++){ const a0 = lk.ring + j * 90 + ((k * 23 + j * 31) % 40), len = 30 + ((k * 17 + j * 13) % 38); g.beginPath(); g.arc(C, C, r, lkRad(a0 - 90), lkRad(a0 + len - 90)); g.stroke(); const p = lkRad(a0 + len - 90); g.fillStyle = L; g.fillRect(C + Math.cos(p) * r - 4, C + Math.sin(p) * r - 4, 8, 8); } });
  g.save(); g.translate(C, C); g.rotate(lkRad(lk.ring)); g.fillStyle = 'rgba(' + H + ',.55)'; for (let i = 0; i < 60; i++){ g.rotate(2 * Math.PI / 60); g.fillRect(-1, -330, 2, 8); } g.restore();
  sec(z0, z1, RI - 6, RO + 6, 'rgba(' + H + ',.18)'); ln(z0, RI - 8, RO + 8, 3, W); ln(z1, RI - 8, RO + 8, 3, W);
  if (!reduced()){ g.shadowColor = RG; g.shadowBlur = 14; } g.strokeStyle = W; g.lineWidth = 6; for (const r of R){ g.beginPath(); g.arc(C, C, r, lkRad(z0 - 90), lkRad(z1 - 90)); g.stroke(); } g.shadowBlur = 0;
  if (lk.oz){ const a = lk.oz.a, ww = lk.oz.w * lk.oz.t; sec(a - ww / 2, a + ww / 2, RI - 6, RO + 6, `rgba(255,255,255,${lk.oz.t * .55})`); }
  if (lk.fx > 0) circ(RI - 10 + (1 - lk.fx) * 130, null, `rgba(${H},${lk.fx})`, 8);
  if (lk.miss > 0) circ(334, `rgba(255,59,92,${lk.miss * .28})`);
  for (let i = 10; i > 0; i--){ const a = lk.needle - lk.dir * i * 1.4; sec(a - .84, a + .84, 0, RO - 6, `rgba(${H},${(1 - i / 10) * .3})`); }
  if (!reduced()){ g.shadowColor = RG; g.shadowBlur = 12; } ln(lk.needle, 0, RO + 10, 3, '#fff'); g.shadowBlur = 0; circ(8, '#fff');
}
function lkRender(){
  if (!lk) return; const L = lk.lvl, set = (id, v) => { const e = $('#' + id); if (e) e.innerHTML = v; };
  const lost = lk.over && !lk.run && lk.missPx != null; set('lkLv', L); set('lkBl', lost ? 'MISSED BY' : 'BEST'); set('lkBest', lost ? lk.missPx + 'px' : Math.max(D().best.lock || 0, L));
  const bb = $('#lkBest'); if (bb) bb.style.color = lost ? 'rgb(' + lk.HR.map(Math.round).join(',') + ')' : '';
  const cur = Math.min(L, 19), hi = Math.min(19, Math.max(1, cur - 2) + 6), lo = Math.max(1, hi - 6), rows = [];   // levels 19 and up share one "19+" row (+10 each, the total keeps climbing)
  for (let n = lo; n <= hi; n++){ const t = n === 19 ? lkGold(Math.max(19, L)) : lkGold(n), hn = n === 19 ? Math.max(19, L) : n;
    rows.push(`<div class="${n < cur ? 'p' : n === cur ? 'c' : ''}${LK_MS.includes(n) ? ' m' : ''}" style="--rc:${lkHeat(hn / LK_HEAT, false).map(Math.round).join(',')}"><span>${n === 19 ? '19+' : n}</span><span>${lkPay(n, t)}</span></div>`); }
  set('lkRail', rows.join(''));
}
/* PICK circuit: traces come in from the four outside corners and end in nodes, a spark orbits the inner edge. Colour = the heat (--heat on the sheet) */
function lkCircuit(w){
  const W = w.clientWidth + 28, H = 124, X = 'http://www.w3.org/2000/svg';
  const tr = (d, t) => `<path class="lc-tr" pathLength="1" d="${d}" style="--d:${t}s"/><path class="lc-pu" pathLength="100" d="${d}" style="--d:${t}s"/>`;
  const sq = (x, y, t) => `<rect class="lc-nd" x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" style="--d:${t}s"/>`, rg = (x, y, t) => `<circle class="lc-nd r" cx="${x}" cy="${y}" r="4" style="--d:${t}s"/>`;
  const orb = `M24,14 H${W - 24} V110 H24 Z`;
  const svg = document.createElementNS(X, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'lc'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path class="lc-in" d="${orb}"/>` + tr('M2,2 L22,22 H80 L96,38 H118', 0.12) + sq(122, 38, 0.12) + tr(`M${W - 2},2 L${W - 22},22 H${W - 80} L${W - 96},38 H${W - 118}`, 0.22) + sq(W - 122, 38, 0.22)
    + tr(`M2,${H - 2} L22,${H - 22} H80 L96,${H - 38} H118`, 0.32) + rg(122, H - 38, 0.32) + tr(`M${W - 2},${H - 2} L${W - 22},${H - 22} H${W - 80} L${W - 96},${H - 38} H${W - 118}`, 0.42) + rg(W - 122, H - 38, 0.42)
    + `<circle class="lc-or" r="3"><animateMotion dur="5s" repeatCount="indefinite" path="${orb}"/></circle>`;
  w.appendChild(svg); requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('go')));
}
/* the bottom bar: idle = just the ticket cost (no gold stake); running = PICK */
function lockBar(w, capped){
  bgPause(!!(lk && lk.run));   // everything outside the Den holds still while a run is on
  const sh = pg() && pg().parentNode; if (sh) sh.classList.toggle('lk-big', !!(lk && lk.run));   // a taller PICK while a run is on: the panel border slides down with it
  if (lk && lk.run){ w.innerHTML = '<button class="den-cash lk-pick" id="lPick" type="button">PICK</button>'; if (!reduced()) lkCircuit(w); return; }
  if (capped){ w.innerHTML = '<div class="den-go off"><span>DAILY LIMIT REACHED</span></div>'; return; }
  const free = freeReady(), noTk = tickets() <= 0 && !free;
  w.innerHTML = `<div class="den-go${noTk ? ' short' : ''}${lk && lk.hold ? ' hold' : ''}" id="lGo"><button class="den-mid" id="lPlay" type="button"><span class="t${noTk || free ? ' red' : ''}">${free ? chipSh() + '0' : chip() + '1'}</span></button></div>`;
}
document.addEventListener('pointerdown', e => {
  if (game() !== 'lock' || !pg() || !pg().contains(e.target) || !lk || !lk.run) return;
  if (e.target.closest('#lkRs, #lPick')){ e.preventDefault(); lockPick(); }
});
addEventListener('keydown', e => { if (e.code === 'Space' && game() === 'lock' && lk && lk.run){ e.preventDefault(); lockPick(); } });
  return { snap:lkSnap, body:lockBody, init:lockInit, stop:lockStop, start:lockStart, held:() => !!(lk && lk.hold), bar:lockBar, get:() => lk, pick:lockPick };
};
