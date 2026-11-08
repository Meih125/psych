/* Ranks and the level emblem: tiers, the next-levels pop-up, level-up animation. */
/*    A new rank name and emblem colour every 10 levels (the emblem itself is drawn by emblem(), further down). */
const RANKS = ['Rookie','Runner','Netrunner','Operator','Specialist','Enforcer','Ghost','Phantom','Overclock','Singularity','Legend',
  'Mythic','Ascendant','Eternal','Celestial','Transcendent','Paragon','Apex','Divine','Infinite','Omega'];   // a new rank every 10 levels, Omega at 200+
// a new rank every 10 levels, reached by the promotion step: Rookie 1–9, Runner 10–19 … Omega 200+
const tierOf = L => Math.min(RANKS.length - 1, Math.floor(L / 10));
function star(n, R, r, cx = 30, cy = 40, rot = -90){
  let d = '';
  for (let i = 0; i < n * 2; i++){
    const a = (rot + i * 180 / n) * Math.PI / 180, rad = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + (cx + rad * Math.cos(a)).toFixed(2) + ' ' + (cy + rad * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}
// Cyber emblem: a neon hex badge. Every 10 levels it changes colour, gains a new core mark,
// then side fins, an outer ring and finally a crown.
const TIER_COL = ['#8fd9cf','#4fb3c8','#3b82d6','#6d7ff0','#ffd27a','#ffb44a','#ff8a40','#ff6b1a','#ff4d2a','#ff3b30','#ffd84a',
  '#ff5fa2','#d46bff','#9a7dff','#6fd3ff','#5ff0c8','#b8ff6a','#fff07a','#ffffff','#ff7ae0','#ffffff'];
// second colour for ranks past Legend (two-tone parts: crown, wings, outer ring)
const TIER_COL2 = [,,,,,,,,,,,'#ffd84a','#ff5fa2','#6fd3ff','#ffffff','#6fd3ff','#ffd84a','#ff6b1a','#ffd84a','#6fd3ff','#ffd84a'];
const hexPts = (cx, cy, r) => Array.from({ length:6 }, (_, i) => { const a = (-90 + i * 60) * Math.PI / 180; return (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2); }).join(' ');
// Level up in the header (plays even with Reduce effects): emblem grows and changes, "LEVEL UP" / "RANK UP" + reward,
// gold flies to the purse, then the new bar colour sweeps across and the bar starts the new level.
let hluT = [];
// emblem upgrade: sparks in the new rank colour gather in the centre, the new emblem opens outward, a soft ring goes out
function emblemUpgrade(host, L){
  renderHeader.lastL = L;
  const old = host.innerHTML; host.innerHTML = `<div class="emu-o">${old}</div><div class="emu-n">${emblem(L)}</div>`;
  const o = host.querySelector('.emu-o'), n = host.querySelector('.emu-n'), col = TIER_COL[tierOf(L)];
  const r = host.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2;
  for (let k = 0; k < 14; k++){ const p = document.createElement('i'); p.className = 'emu-sp'; p.style.background = col; p.style.boxShadow = `0 0 6px ${col}`; p.style.left = cx + 'px'; p.style.top = cy + 'px'; host.appendChild(p);
    const a = k / 14 * Math.PI * 2, d = r.width * .9 + Math.random() * 20;
    p.animate([{ transform:`translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`, opacity:0 }, { opacity:1, offset:.3 }, { transform:'translate(0,0)', opacity:1 }], { duration:520 + Math.random() * 160, easing:'cubic-bezier(.5,0,.8,.5)', fill:'forwards' }).onfinish = () => p.remove(); }
  n.style.opacity = 0;
  setTimeout(() => {
    n.style.opacity = 1; n.animate([{ clipPath:'circle(0% at 50% 50%)', filter:'brightness(2.2)' }, { clipPath:'circle(80% at 50% 50%)', filter:'none' }], { duration:600, easing:'ease-out' });
    o.animate([{ opacity:1 }, { opacity:0 }], { duration:450, fill:'forwards' });
    const ring = document.createElement('i'); ring.className = 'emu-ring'; ring.style.borderColor = col; host.appendChild(ring);
    ring.animate([{ transform:'translate(-50%,-50%) scale(.3)', opacity:1 }, { transform:'translate(-50%,-50%) scale(1.8)', opacity:0 }], { duration:650, easing:'ease-out' }).onfinish = () => ring.remove();
    setTimeout(() => { if (host.querySelector('.emu-n')) host.innerHTML = emblem(L); }, 700);
  }, 650);
}
function hdrLevelUp(L, gold, tix){
  hluT.forEach(clearTimeout); hluT = [];
  if (hdrLevelUp.rel) hdrLevelUp.rel();   // an earlier level-up that never delivered its coins: pay it now
  let paidOut = false;
  const rel = hdrLevelUp.rel = () => { if (paidOut) return; paidOut = true; hdrLevelUp.rel = null; renderHeader.lvHold = Math.max(0, (renderHeader.lvHold || 0) - (gold || 0)); const g = S.gold - renderHeader.lvHold; if (g !== goldShown){ goldRoll(g, 0); goldShown = g; } };   // the purse counts up the moment the first coin lands (no 620 ms wait like a quest claim)
  const top = document.querySelector('.top'), stats = top.querySelector('.stats'), rankUp = L % 10 === 0 && L <= (RANKS.length - 1) * 10;
  let m = stats.querySelector('.hlu-msg'); if (m) m.remove();
  m = document.createElement('div'); m.className = 'hlu-msg';
  m.innerHTML = `<div class="hlu-big">${rankUp ? 'RANK UP' : 'LEVEL UP'}</div><div class="hlu-rws">${gold ? `<div class="hlu-rw">${ico('i-coin')}<b>+${fmt(gold)}</b></div>` : ''}${tix && window.PsychDen ? `<div class="hlu-rw hlu-tk">${PsychDen.icon()}<b>+${tix}</b></div>` : ''}</div><div class="hlu-nr" style="color:${isBossStep(L) ? '#ff5a4e' : TIER_COL[tierOf(L)]}">${rankUp ? 'New rank: ' + RANKS[tierOf(L)] : isBossStep(L) ? 'Promotion level' : 'Level ' + L}</div>`;
  stats.appendChild(m); void m.offsetWidth; top.classList.add('hlu');
  const T = (f, ms) => hluT.push(setTimeout(f, ms));
  T(() => emblemUpgrade($('#lvlEmblem'), L), 260);
  T(() => { const rw = m.querySelector('.hlu-rw svg'); if (rw && gold) flyCoins(rw.getBoundingClientRect(), gold, rel); else rel(); }, 550);
  T(() => { const tk = m.querySelector('.hlu-tk svg'); if (tk && tix) PsychDen.fly(tk.getBoundingClientRect(), tix); }, 800);   // the ticket follows the coins up to the Den count
  T(rel, 3600);   // safety: never leave the purse short
  T(() => {
    top.classList.remove('hlu'); setTimeout(() => m.remove(), 400);
    const bar = $('.xpbar'), fill = $('#xpFill'), boss = isBossStep(L), col = boss ? '#e0392d' : '#2ee6d6';
    const lt = $('#lvlText'), name = RANKS[tierOf(L)] + (boss && tierOf(L + 1) !== tierOf(L) ? ` · Promotion to ${RANKS[tierOf(L + 1)]}` : '');
    // the rank line slides up to the new one, in its new colour
    lt.animate([{ transform:'none', opacity:1 }, { transform:'translateY(-60%)', opacity:0 }], { duration:220, easing:'ease-in' }).onfinish = () => {
      lt.textContent = name; lt.classList.toggle('boss', boss); if (boss) lt.style.removeProperty('color'); else lt.style.setProperty('color', TIER_COL[tierOf(L)], 'important');
      lt.animate([{ transform:'translateY(60%)', opacity:0 }, { transform:'none', opacity:1 }], { duration:260, easing:'ease-out' }); };
    // a wave of the new colour runs across the full bar, then the bar starts the new level
    const u = document.createElement('i'); u.className = 'hlu-wave'; u.style.background = col; bar.appendChild(u);
    u.animate([{ width:'0%' }, { width:'100%' }], { duration:650, easing:MOTION.leave, fill:'forwards' }).onfinish = () => {
      bar.classList.remove('full'); bar.classList.toggle('boss', boss);
      const li = levelInfo(S.xp); $('#lvA').textContent = `Lv ${li.L}`; $('#lvB').textContent = `Lv ${li.L + 1}`;
      jump(fill, () => { fill.style.width = '0%'; });
      fill.style.width = (li.into / li.need * 100) + '%'; bar.style.setProperty('--xw', fill.style.width);
      $('#xpText').textContent = `${fmt(li.into)} / ${fmt(li.need)} XP`; xpShown = li.into;
      u.animate([{ opacity:1 }, { opacity:0 }], { duration:250, fill:'forwards' }).onfinish = () => u.remove();
      renderHeader.luLock = false; clearTimeout(renderHeader.luSafe); renderHeader();
    };
  }, 2300);
}
function renderLvlPop(){
  const { L, into, need } = levelInfo(S.xp);
  let toGo = need - into, rows = '';
  for (let n = L + 1; n <= L + 3; n++){
    const newRank = tierOf(n) !== tierOf(n - 1), gold = levelReward(n);
    rows += `<div class="lp-row${n % 10 === 0 ? ' milestone' : ''}">
      <div class="lp-l"><b>Level ${n}${newRank ? ' <span class="lp-boss">Promotion</span>' : ''}</b>${newRank ? `<span class="lp-rank">New rank: ${RANKS[tierOf(n)]}</span>` : ''}<small>${fmt(toGo)} XP to go</small></div>
      <div class="lp-g">${ico('i-coin')}<span>${fmt(gold)}</span></div></div>`;
    toGo += xpToNext(n);
  }
  $('#lvlPop').innerHTML = `<div class="lp-title">Next levels</div>${rows}<div class="lp-foot">Gold is paid automatically when you level up.</div>`;
}
function toggleLvlPop(force){
  const p = $('#lvlPop'), open = force ?? !p.classList.contains('open');
  if (open) renderLvlPop();
  p.classList.toggle('open', open);
}
/* ---- Rank emblem: circuit starburst + hex runner + light rays, animated.
   Ranks past Legend add crown points, a second ring, two-tone colour, wings, a shockwave and a colour-shifting prism.
   Glow filters only sit on parts that don't move (moving parts with a blur filter would be redrawn every frame). ---- */
function embEnd(d){
  const m = d.match(/-?[\d.]+/g).map(Number); let x = m[0], y = m[1];
  d.slice(1).split(/(?=[VvHhLl])/).slice(1).forEach(sg => { const k = sg[0], v = (sg.slice(1).match(/-?[\d.]+/g) || []).map(Number);
    if (k === 'V') y = v[0]; else if (k === 'v') y += v[0]; else if (k === 'H') x = v[0]; else if (k === 'h') x += v[0]; else if (k === 'l'){ x += v[0]; y += v[1]; } else if (k === 'L'){ x = v[0]; y = v[1]; } });
  return [x, y];
}
function embMark(t, c){
  const chev = y => `<path d="M31 ${y + 4}l9-6 9 6" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (t < 3) return [chev(44), chev(40) + chev(49), chev(36) + chev(44) + chev(52)][t];
  if (t < 5) return `<path d="M40 33l10 13-10 13-10-13z" fill="${c}33" stroke="${c}" stroke-width="2.2"/><circle cx="40" cy="46" r="2.8" fill="${c}"/>`;
  if (t < 7) return `<path d="${star(4, 14, 4, 40, 46)}" fill="${c}44" stroke="${c}" stroke-width="1.8"/>`;
  if (t < 9) return `<path d="M40 32l13 22H27z" fill="${c}33" stroke="${c}" stroke-width="2"/><circle cx="40" cy="47" r="3.4" fill="${c}"/>`;
  if (t < 11) return `<path d="${star(t > 9 ? 8 : 6, 15, 5.5, 40, 46)}" fill="${c}55" stroke="${c}" stroke-width="1.6"/><circle cx="40" cy="46" r="3.6" fill="#fff"/>`;
  if (t < 15) return `<path d="${star(8, 16, 6, 40, 46)}" fill="${c}55" stroke="${c}" stroke-width="1.6"/><path d="${star(4, 9, 3, 40, 46)}" fill="#fff" opacity=".9"/>`;
  if (t < 20) return `<path d="${star(12, 17, 7, 40, 46)}" fill="${c}55" stroke="${c}" stroke-width="1.4"/><circle cx="40" cy="46" r="6" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="40" cy="46" r="2.6" fill="#fff"/>`;
  return `<path d="M32 56h5.5v-2.5c-4-1.8-6.5-5.5-6.5-9.5 0-6 4-10.5 9-10.5s9 4.5 9 10.5c0 4-2.5 7.7-6.5 9.5V56H48" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>`;   // Ω
}
function emblem(L){
  // everything lives inside the function: the header is drawn before the rest of the file has run
  emblem.n = (emblem.n || 0) + 1;
  const t = tierOf(L), c = TIER_COL[t], c2 = TIER_COL2[t] || c, id = 'emb' + emblem.n;
  const BURST = ['M40 27V16l-6-6V2','M40 65v11l6 6v8','M23.5 36.5l-9-5H4','M56.5 36.5l9-5h11','M23.5 55.5l-9 5-6 10','M56.5 55.5l9 5 6 10','M30 30l-9-9h-8','M50 62l9 9h8'];
  const lines = BURST.slice(0, Math.min(8, 2 + t));
  const R = 30 + Math.min(t, 14) * 1.4, nr = 8 + (t >= 6 ? 4 : 0) + (t >= 17 ? 8 : 0);
  const rays = Array.from({ length:nr }, (_, i) => `<path d="M40 46L38.4 ${46 - R * (i % 2 ? .7 : 1)}L41.6 ${46 - R * (i % 2 ? .7 : 1)}Z" fill="url(#${id}y)" transform="rotate(${i * 360 / nr} 40 46)"/>`).join('');
  const track = 'M' + hexPts(40, 46, 25).split(' ').join('L') + 'Z', runners = Math.min(5, 1 + Math.floor(t / 4));
  // a moving dot: a soft halo circle + a bright dot (no blur filter, so it's cheap to animate)
  const ride = (d, col, dur, beg, r) => `<g><circle r="${r * 2.2}" fill="${col}" opacity=".25"/><circle r="${r}" fill="${col}"/><animateMotion dur="${dur}s" begin="${beg}s" repeatCount="indefinite" path="${d}"/></g>`;
  let back = '', front = '';
  if (t >= 14){   // circuit wings
    const w = 6 + (t - 14) * 1.6;
    const wing = s => { const x0 = 40 + s * 27; return [[-8, w], [-1, w * 1.3], [6, w]].map(([dy, len], i) => { const d = `M${x0} ${46 + dy}h${s * len * .45}l${s * 4} ${dy * .35}h${s * len * .55}`;
      return `<path d="${d}" fill="none" stroke="${c2}" stroke-width="1" opacity=".35"/>`; }).join(''); };
    back += `<g class="em-flap">${wing(-1)}${wing(1)}</g>`;
  }
  if (t >= 16) back += `<polygon class="em-shock" points="${hexPts(40, 46, 20)}" fill="none" stroke="${c2}" stroke-width="2"/>`;
  if (t >= 12) back += `<polygon class="em-spin em-rev" points="${hexPts(40, 46, 31)}" fill="none" stroke="${c2}" stroke-width="1" stroke-dasharray="4 3" opacity=".75"/>`;
  if (t >= 11){   // crown points
    const k = Math.min(5, 1 + Math.floor((t - 10) / 2) * 2);
    front += Array.from({ length:k }, (_, i) => { const a = (-90 + (i - (k - 1) / 2) * 20) * Math.PI / 180, r1 = 21, r2 = 33 + (i === (k - 1) / 2 ? 5 : 0) + (t - 10) * .5;
      return `<path d="M${(40 + r1 * Math.cos(a) - 2).toFixed(1)} ${(46 + r1 * Math.sin(a)).toFixed(1)}L${(40 + r2 * Math.cos(a)).toFixed(1)} ${(46 + r2 * Math.sin(a)).toFixed(1)}L${(40 + r1 * Math.cos(a) + 2).toFixed(1)} ${(46 + r1 * Math.sin(a)).toFixed(1)}Z" fill="${c2}66" stroke="${c2}" stroke-width="1"/>`; }).join('');
    front = `<g filter="url(#${id}g)">${front}</g>`;
  }
  return `<svg viewBox="0 0 80 92" aria-hidden="true"><defs>
      <filter id="${id}g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="${id}y" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <g class="em-spin" style="opacity:.5">${rays}</g>${back}
    ${lines.map((d, i) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="3.6" opacity=".15"/>`).join('')}
    ${lines.map((d, i) => ride(d, '#fff', 1.6 + (i % 3) * .4, -i * .37, 1.3)).join('')}
    ${lines.map(d => { const [x, y] = embEnd(d); return `<rect x="${x - 2}" y="${y - 2}" width="4" height="4" fill="#071114" stroke="${c}" stroke-width="1.2"/>`; }).join('')}
    <path d="${track}" fill="none" stroke="${c}" stroke-width=".8" opacity=".35"/>
    ${Array.from({ length:runners }, (_, i) => ride(track, i % 2 && t >= 13 ? c2 : c, 4.5, -i * 4.5 / runners, 2.3)).join('')}
    <g filter="url(#${id}g)">
      <polygon points="${hexPts(40, 46, 19)}" fill="#071114" stroke="${t >= 13 ? `url(#${id}d)` : c}" stroke-width="2"/>
      <polygon points="${hexPts(40, 46, 14)}" fill="none" stroke="${c}" stroke-width=".7" opacity=".4"/>
      <g transform="translate(40 46) scale(.73) translate(-40 -46)">${embMark(t, c)}</g>
    </g>${front}
  </svg>`;
}

function initRank(){
  $('#lvlEmblem').addEventListener('click', e => { e.stopPropagation(); toggleLvlPop(); });
  document.addEventListener('click', e => { if (!e.target.closest('#lvlPop')) toggleLvlPop(false); });
}
