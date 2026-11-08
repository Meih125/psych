/* Pack details sheet: drop rates, featured cards, signature cards. */
/* ---- Pack details pop-up: what the pack holds, the cards, and the buy controls ---- */
function closePackInfo(now){
  const p = $('#pki'); if (!p) return;
  if (now === true || S.reduceFx || !p._inv || !p._from || !p._from.isConnected || p.dataset.closing){ p.remove(); return; }
  p.dataset.closing = 1; p.style.pointerEvents = 'none'; const box = p.querySelector('.pki-box');
  box.animate([{ transform:'none', opacity:1 }, { transform:p._inv, opacity:.3 }], { duration:MOTION.norm, easing:MOTION.leave, fill:'forwards' });
  p.animate([{ backgroundColor:'rgba(3,6,12,.72)' }, { backgroundColor:'rgba(3,6,12,0)' }], { duration:300, fill:'forwards' }).onfinish = () => p.remove();
}
// pack details intro: title types out, line draws, then chips, tray, cards and buy bar
// ---- pack advert: UR band + hero + badge (what makes each pack different) ----
const PKI_FEAT = {
  hod:{ h:{ t:'DUO PAIRS', s:'Two cards join into one picture', v:'duo' }, b:{ t:'2 JOKERS', s:'Hidden somewhere in the deck', v:'jk' } },
  tarot:{ h:{ t:'PUZZLE PICTURE', s:'8 cards line up into 1 wide picture', v:'pz' }, b:{ t:'2 CHAPTERS', s:'Wide story scenes to unlock', v:'sc' } },
  mlbb:{ h:{ t:'ARTIST SERIES', s:'10 cards of featured art', v:'art' }, b:{ t:'HUGE PAYOUTS', s:'1,200 a set<br>4,500 for all', v:'tot' } }
};
const PKI_GEM = '<svg width="W" height="W" viewBox="0 0 32 32"><path d="M16 2.5l11 6.8v13.4L16 29.5 5 22.7V9.3z" fill="rgba(143,217,207,.25)" stroke="#8fd9cf" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 9.3L16 16l11-6.7M16 16v13.5" fill="none" stroke="#8fd9cf" stroke-width="1.2"/></svg>';
const PKI_COIN = '<svg width="W" height="W" viewBox="0 0 20 20"><path d="M10 1.5 L17.5 5.8 V14.2 L10 18.5 L2.5 14.2 V5.8Z" fill="#3a2a06" stroke="#f0b93a" stroke-width="1.5"/><text x="10" y="13.6" text-anchor="middle" font-family="Montserrat" font-weight="700" font-size="9" fill="#f6c453">G</text></svg>';
function pkiVis(v, w, h, fx){
  const bob = (i, r) => `${r !== undefined ? '--r:' + r + 'deg;' : ''}${fx ? `animation:pkiBob ${(3.2 + i * .5).toFixed(1)}s ease-in-out ${(-i * .9).toFixed(1)}s infinite alternate` : ''}`;
  const im = (src, st, cls = 'pki-fi') => `<img class="${cls}" src="${src}" alt="" style="${st}">`;
  const bx = inner => `<div style="position:relative;width:${w}px;height:${h}px">${inner}</div>`;
  if (v === 'duo'){
    const a = landImg('HD_PTR01'), b = landImg('HD_PTR02'), j = cardImg('HD_DUO01');
    return bx(`<div class="pki-duo" style="position:absolute;inset:0"><div class="pki-mv" style="position:absolute;inset:0;${bob(0)}"><img class="dl" src="${a}" alt="" style="position:absolute;left:0;top:${h * .1}px;height:${h * .8}px;border-radius:5px;box-shadow:0 4px 10px #000a${fx ? '' : ';opacity:0'}"><img class="dr" src="${b}" alt="" style="position:absolute;right:0;top:${h * .1}px;height:${h * .8}px;border-radius:5px;box-shadow:0 4px 10px #000a${fx ? '' : ';opacity:0'}"><img class="dj" src="${j}" alt="" style="position:absolute;left:50%;top:${h * .05}px;height:${h * .9}px;transform:translateX(-50%)${fx ? ' scale(.7);opacity:0' : ''};border-radius:6px;box-shadow:0 0 18px rgba(255,184,58,.8),0 4px 10px #000a"><i class="dfl" style="position:absolute;left:50%;top:50%;width:${h * 1.8}px;height:${h * 1.8}px;margin:-${h * .9}px 0 0 -${h * .9}px;border-radius:50%;background:radial-gradient(closest-side,#fff,rgba(255,236,170,.7) 40%,transparent);opacity:0;pointer-events:none"></i></div></div>`);
  }
  if (v === 'jk') return bx(
    im(cardImg('HD_R53'), `left:${w * .14}px;top:0;height:${h}px;aspect-ratio:480/672;border-radius:4px;box-shadow:0 5px 12px #000c,0 0 12px rgba(200,60,255,.55);transform:rotate(-8deg);${bob(0, -8)}`, 'pki-fi pki-mv') +
    im(cardImg('HD_R54'), `right:${w * .14}px;top:0;height:${h}px;aspect-ratio:480/672;border-radius:4px;box-shadow:0 5px 12px #000c,0 0 12px rgba(235,30,70,.55);transform:rotate(7deg);${bob(1, 7)}`, 'pki-fi pki-mv'));
  if (v === 'pz'){
    const sl = Array.from({ length:8 }, (_, i) => `<div class="sl"><img src="${cardImg('SCR0' + (i + 1))}" alt=""></div>`).join('');
    return `<div class="pki-cin" style="width:${w}px;height:${h}px"><div class="pki-trk" style="--p:${(8 * (h - 14) * 480 / 672).toFixed(1)}px">${sl}${sl}</div><div class="cgl"></div></div>`;
  }
  if (v === 'sc') return bx(
    im(cardImg('SC16'), `left:${w * .02}px;top:${h * .28}px;width:${w * .62}px;border-radius:4px;box-shadow:0 5px 12px #000c;transform:rotate(-6deg);${bob(0, -6)}`, 'pki-fi pki-mv') +
    im(cardImg('SC01'), `right:${w * .02}px;top:${h * .06}px;width:${w * .62}px;border-radius:4px;box-shadow:0 5px 12px #000c;transform:rotate(5deg);${bob(1, 5)}`, 'pki-fi pki-mv'));
  if (v === 'art') return bx(['ML_AS01', 'ML_AS04', 'ML_AS08'].map((id, i) =>
    im(cardImg(id), `left:${w * (.1 + i * .26)}px;top:${i === 1 ? 0 : h * .06}px;height:${h * .9}px;aspect-ratio:480/672;border-radius:4px;box-shadow:0 5px 12px #000c;transform:rotate(${(i - 1) * 8}deg);z-index:${i === 1 ? 2 : 1};${bob(i, (i - 1) * 8)}`, 'pki-fi pki-mv')).join(''));
  // payouts: see-through coin columns + XP cube heap, faint rain of coins and gems behind
  const coin = (cx, cy, R, t) => { const a = .87 * R, b = .55 * R; return `<g transform="translate(${cx} ${cy})"><path d="M${-a} ${-b / 2} L${-a} ${b / 2 + t} L0 ${b + t} L${a} ${b / 2 + t} L${a} ${-b / 2} L0 ${b} Z" fill="rgba(246,196,83,.22)" stroke="#f0b93a" stroke-width=".7"/><path d="M0 ${b} V${b + t}" stroke="#f0b93a" stroke-width=".6" opacity=".7"/><path d="M0 ${-b} L${a} ${-b / 2} L${a} ${b / 2} L0 ${b} L${-a} ${b / 2} L${-a} ${-b / 2}Z" fill="rgba(246,196,83,.16)" stroke="#f6c453" stroke-width="1"/><text y="${b * .5}" text-anchor="middle" font-family="Montserrat" font-weight="700" font-size="${R * .62}" fill="#f6c453" transform="scale(1 .62)" style="transform-origin:0 0">G</text></g>`; };
  const stk = (cx, base, R, t, n, rot = 0) => `<g transform="rotate(${rot} ${cx} ${base})">${Array.from({ length:n }, (_, i) => coin(cx, base - i * t, R, t)).join('')}</g>`;
  const cub = (cx, cy, S, rot = 0, glow = 0) => { const a = .87 * S; return `<g transform="translate(${cx} ${cy}) rotate(${rot} 0 ${-S})"${glow ? ' style="filter:drop-shadow(0 0 5px rgba(143,217,207,.8))"' : ''}><path d="M0 0 L${-a} ${-S / 2} L${-a} ${-1.5 * S} L0 ${-S}Z" fill="rgba(143,217,207,.2)" stroke="#8fd9cf" stroke-width=".7"/><path d="M0 0 L${a} ${-S / 2} L${a} ${-1.5 * S} L0 ${-S}Z" fill="rgba(143,217,207,.1)" stroke="#8fd9cf" stroke-width=".7"/><path d="M0 ${-S} L${-a} ${-1.5 * S} L0 ${-2 * S} L${a} ${-1.5 * S}Z" fill="rgba(190,255,248,.34)" stroke="#d6fff9" stroke-width=".7"/></g>`; };
  const rain = fx ? Array.from({ length:30 }, (_, i) => `<i class="pki-rn" style="left:${(2 + i * 3.2).toFixed(1)}%;animation-duration:${(2.4 + (i * 37 % 20) / 10).toFixed(1)}s;animation-delay:-${((i * 53 % 40) / 10).toFixed(1)}s">${(i % 2 ? PKI_GEM : PKI_COIN).replace(/W/g, 9 + (i % 3) * 2)}</i>`).join('') : '';
  const sv = `<svg viewBox="0 0 108 84" width="${w}" height="${h}" style="position:absolute;left:0;top:0">${cub(78, 36, 13, -16, 1)}${[[60, 56, 8, 10], [72, 52, 7, -8], [86, 54, 8, 12], [98, 56, 6, -14], [54, 68, 7, -8], [66, 66, 8, 12], [78, 68, 8, -6], [90, 68, 8, 10], [101, 70, 6, -6], [72, 62, 7, 4]].map(c => cub(c[0], c[1], c[2], c[3])).join('')}${stk(15, 72, 10, 4.2, 4, -5)}${stk(37, 74, 10, 4.2, 6, 2)}${stk(57, 76, 10, 4.2, 3, 6)}${coin(8, 80, 6, 3)}${coin(98, 80, 5, 2.5)}${cub(46, 82, 4, 20)}${cub(104, 80, 4, -20)}</svg>`;
  return `<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden"><div style="position:absolute;inset:0;opacity:.5">${rain}</div><div class="pki-mv" style="position:absolute;inset:0;${bob(0)}">${sv}</div></div>`;
}
// the three pieces under the title: the UR band, the hero picture, the small badge
function pkiFeatHtml(deck, urSets, fx, st){
  const f = PKI_FEAT[deck]; if (!f) return '';
  const total = urSets.reduce((a, r) => a + r.n, 0), multi = urSets.length > 1;
  const txt = urSets.map(r => r.n + ' ' + setLabel(r.set)).join(' · ');
  const sub = multi ? txt : setLabel(urSets[0].set), fs = Math.max(9, Math.min(11, Math.floor(300 / (txt.length * .62))));
  const ft = x => `<b class="pki-ft${x.v === 'jk' ? ' jk' : ''}">${x.t}</b><div class="pki-fs">${x.s}</div>`;
  const HW = { pz:[224, 62], duo:[180, 76], art:[170, 64] }, BW = { jk:[96, 64], sc:[96, 60], tot:[108, 58] };
  const [hw, hh] = HW[f.h.v], [bw, bh] = BW[f.b.v];
  const soft = (cls, l, t, w, h, rot, inner) => `<div class="pki-soft ${cls}${st}" style="left:${l}px;top:${t}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg)"><i class="pki-glow"></i><div class="pki-sin">${inner}</div></div>`;
  return `<i class="pki-ln${fx ? ' fl0' : ''}"></i>` +
    `<div class="pki-bt${st}"><b class="n">${total}</b><div><b class="u">UR</b><div class="s" style="font-size:${fs}px">${esc(sub)}</div></div></div>` +
    soft('pki-hero', 14, 172, 240, 118, -3.5, `<div style="display:flex;justify-content:center;padding-top:2px">${pkiVis(f.h.v, hw, hh, fx)}</div><div style="padding:6px 8px 0;text-align:center">${ft(f.h)}</div>`) +
    soft('pki-badge', deck === 'tarot' ? 258 : 246, 170, 108, 108, 2.5, `<div style="display:flex;flex-direction:column;align-items:center;height:100%"><div>${pkiVis(f.b.v, bw, bh, fx)}</div><div style="margin-top:6px;text-align:center">${ft(f.b)}</div></div>`);
}
// Duo merge: two cards bob, slide together and flash into the joined picture (once per open)
function pkiDuo(b, now){
  const my = b._t = (b._t || 0) + 1, dl = b.querySelector('.dl'), dr = b.querySelector('.dr'), dj = b.querySelector('.dj'), fl = b.querySelector('.dfl');
  [dl, dr, dj, fl].forEach(e => e.getAnimations().forEach(a => a.cancel()));
  if (now){ dl.style.opacity = dr.style.opacity = 0; dj.style.opacity = 1; dj.style.transform = 'translateX(-50%)'; return; }
  const ok = () => b._t === my && b.isConnected;
  setTimeout(() => { if (!ok()) return;
    const d = b.offsetWidth / 2 - dl.offsetWidth / 2 - 4;
    const o = { duration:520, easing:'cubic-bezier(.5,0,.8,.4)', fill:'forwards' };
    dl.animate([{ transform:'none' }, { transform:`translateX(${d}px)` }], o); dr.animate([{ transform:'none' }, { transform:`translateX(${-d}px)` }], o);
    setTimeout(() => { if (!ok()) return;
      fl.animate([{ opacity:0, transform:'scale(.4)' }, { opacity:1, transform:'scale(1)', offset:.3 }, { opacity:0, transform:'scale(1.5)' }], { duration:480, easing:'ease-out' });
      dl.style.opacity = dr.style.opacity = 0;
      dj.animate([{ opacity:0, transform:'translateX(-50%) scale(.7)' }, { opacity:1, transform:'translateX(-50%) scale(1.06)', offset:.6 }, { opacity:1, transform:'translateX(-50%) scale(1)' }], { duration:420, easing:'ease-out', fill:'forwards' });
    }, 500); }, 2000);
}
// LoM only: the quill signs over the Featured cards 6 s after opening (off with Reduce effects)
const PKI_SIG_COLS = [50.0, 50.0, 49.5, 49.5, 49.0, 49.0, 48.5, 48.0, 48.0, 47.5, 47.0, 47.0, 46.5, 46.5, 46.5, 46.5, 46.0, 46.0, 45.0, 45.0, 45.0, 44.0, 44.0, 43.5, 43.0, 43.0, 42.5, 42.0, 60.0, 66.5, 65.2, 59.1, 56.4, 54.2, 52.0, 51.5, 49.6, 47.1, 46.3, 45.4, 44.5, 44.1, 42.8, 42.5, 42.5, 41.1, 40.1, 38.7, 37.0, 35.8, 35.0, 34.1, 31.2, 30.3, 30.8, 31.4, 30.4, 29.6, 26.5, 23.6, 28.4, 27.8, 25.5, 27.3, 47.9, 52.0, 54.1, 52.4, 47.8, 45.1, 45.6, 45.7, 48.5, 52.0, 49.9, 48.7, 52.0, 50.8, 50.6, 52.2, 50.0, 49.5, 50.2, 50.0, 46.3, 44.7, 47.4, 51.7, 59.3, 60.1, 60.5, 60.4, 61.0, 61.7, 60.8, 61.7, 61.7, 61.6, 61.0, 59.0, 59.5, 59.0, null, 66.0, 62.8, 62.0, 61.5, 61.5, 61.0, 60.0, 59.0, 58.0, 57.0, 56.5, 55.5, 57.5, 60.5, 62.5, 65.0, 68.0, null, null, null, null, null, null, null, null, null, null, 64.0, 61.0, 59.0, 55.9, 52.5, 49.8, 47.8, 43.3, 35.0, 32.0, 28.5, 26.0, 22.5, 20.5, 18.5, 17.0, 18.0, 20.0, 22.0, 25.0, 28.0, 30.0, 32.0, 33.5, 35.5, 37.0, 38.0, 39.0, 40.0, 40.5, 41.5, 42.0, 42.0, 43.0, 43.0, 43.0, 43.0, 43.0, 43.0, 43.5, 43.5, 43.0, 43.0, 43.0, 43.0, 42.5, 42.0, 42.0, 42.0, 41.0, 60.6, 60.4, 55.1, 48.8, 47.2, 44.4, 42.5, 40.5, 38.5, 37.0, 35.0, 32.5, 31.5, 30.0, 35.6, 34.2, 30.2, 34.0, 34.9, 35.9, 34.2, 34.9, 35.3, 33.2, 28.5, 25.9, 25.2, 23.6, 21.3, 25.0, 24.3, 23.2, 22.0, 17.7, 24.8, 30.2, 34.8, 44.9, 43.2, 42.0, 42.0, 43.4, 42.9, 42.9, 42.5, 44.7, 45.2, 44.8, 44.2, 44.0, 43.3, 42.7, 42.2, 40.6, 40.9, 41.5, 38.7, 38.1, 38.5, 36.9, 42.2, 41.7, 38.2, 36.3, 33.7, 31.5, 30.5, 28.5, 27.0, 28.7, 37.4, 36.5, 33.0, 30.7, 30.6, 35.3, 34.0, 32.7, 30.2, 29.0, 27.7, 26.5, 25.5, 24.0, 33.0, 34.2, 33.8, 31.5, 28.6, 28.1, 27.7, 23.1, 17.6, 16.5, 16.6, 17.0, 20.0, 20.0, 19.5, 19.0, 19.0, 19.0, 19.0, 18.5, 18.0, 18.0, 18.0, 18.0, 17.0, 17.0, 17.0, 17.0, 17.0, 17.0, 17.0, 16.5, 16.0, 16.0, 15.5, 15.5, 15.5, 15.0, 15.0, 15.0, 15.0, 15.0, 14.5, 14.5, 14.5, 14.5, 14.5, 14.5, 14.5, 14.0, 14.0, 14.0, 13.5, 13.5, 13.5, 13.5, 13.5, 13.5, 13.0];
const PKI_SIG_SEG = [{ t:850, a:0, b:118 }, { t:350, hop:1, a:118, b:130 }, { t:1150, a:130, b:321 }];   // "Klein", a hop, "Moretti"
function pkiSignHtml(){ return `<div class="pki-sgn"><div class="pki-sgw"><img src="img/fx/sig.webp" alt=""></div><div class="pki-qw"><i class="pki-sp"></i><img class="pki-q" src="img/fx/quill.webp" alt=""></div></div>`; }
function pkiSign(mk){
  const o = mk.querySelector('.pki-sgn'); if (!o) return;
  const cols = PKI_SIG_COLS; let last = null; const Y = cols.map(c => (c != null && (last = c), last)); let nx = null;
  for (let i = Y.length - 1; i >= 0; i--){ if (cols[i] != null) nx = cols[i]; if (Y[i] == null) Y[i] = nx; }
  const sm = Y.map((_, i) => { let a = 0, n = 0; for (let k = -6; k <= 6; k++){ const v = Y[i + k]; if (v != null){ a += v; n++; } } return a / n; });
  const w = o.querySelector('.pki-sgw'), qw = o.querySelector('.pki-qw'), sp = o.querySelector('.pki-sp'), ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const place = (x, l) => { qw.style.transform = `translate(${x}px,${sm[Math.max(0, Math.min(sm.length - 1, Math.round(x)))] - l}px)`; };
  const alive = () => mk.isConnected && !mk.dataset.closing;
  qw.animate([{ opacity:0, transform:`translate(-30px,${Y[0] + 20}px)` }, { opacity:1, transform:`translate(0px,${Y[0]}px)` }], { duration:450, easing:'ease-out', fill:'forwards' }).onfinish = () => {
    if (!alive()) return; qw.getAnimations().forEach(a => a.cancel()); qw.style.opacity = 1; const T0 = performance.now();
    const fr = t => {
      if (!alive()) return; const el = t - T0; let acc = 0, g = null, u = 0;
      for (const k of PKI_SIG_SEG){ if (el < acc + k.t){ g = k; u = (el - acc) / k.t; break; } acc += k.t; }
      if (!g){ w.style.setProperty('--x', '420px'); sp.style.opacity = 0; qw.animate([{ transform:qw.style.transform, opacity:1 }, { transform:'translate(353px,-60px)', opacity:0 }], { duration:800, easing:'ease-in', fill:'forwards' }); return; }
      const x = g.a + (g.b - g.a) * ease(u); let l;
      if (g.hop){ l = 16 * Math.sin(Math.PI * u); sp.style.opacity = 0; }
      else { const gap = cols[Math.max(0, Math.min(cols.length - 1, Math.round(x)))] == null; l = (gap ? 9 : 0) + Math.sin(el / 27) * 1.2; sp.style.opacity = gap ? 0 : .9; w.style.setProperty('--x', (x + 26) + 'px'); }
      place(x, l); requestAnimationFrame(fr);
    };
    requestAnimationFrame(fr);
  };
}
async function pkiBoot(mk){
  const inn = mk.querySelector('.pki-in'), txt = inn.querySelector('.txt'), cur = inn.querySelector('.cur'), full = inn.dataset.title, ul = inn.querySelector('.pki-ul'), ln = inn.querySelector('.pki-ln'), duo = inn.querySelector('.pki-duo');
  const wait = ms => new Promise(r => setTimeout(r, ms)), live = () => mk.isConnected && !mk.dataset.closing && !mk._skip;
  const done = () => { txt.textContent = full; ul.classList.add('draw'); if (ln){ ln.getAnimations().forEach(a => a.cancel()); ln.classList.remove('fl0'); } if (duo) pkiDuo(duo, true); inn.querySelectorAll('.st').forEach(e => e.classList.add('on')); cur.classList.remove('blink'); cur.classList.add('gone'); };
  mk._finish = () => { mk._skip = 1; mk._finish = null; done(); };   // a tap on the advert shows everything at once
  await wait(250);
  for (const ch of full){ if (!live()) return; txt.append(ch); await wait(31.5 + Math.random() * 31.5); }
  if (!live()) return; ul.classList.add('draw');
  if (ln){   // the UR band switches on like a neon sign: background and border only, then its text
    await ln.animate([{ opacity:0 }, { opacity:.85, offset:.06 }, { opacity:.1, offset:.12 }, { opacity:.7, offset:.2 }, { opacity:0, offset:.27 }, { opacity:0, offset:.38 }, { opacity:.95, offset:.42 }, { opacity:.25, offset:.5 }, { opacity:.9, offset:.56 }, { opacity:.4, offset:.64 }, { opacity:1, offset:.7 }, { opacity:1 }].map(k => ({ ...k, easing:'steps(1)' })), { duration:650, easing:'linear' }).finished.catch(() => {});
    if (!live()) return; ln.classList.remove('fl0');
  }
  for (const e of inn.querySelectorAll('.pki-bt.st,.pki-hero.st,.pki-badge.st,.pki-tray.st,.pki-tag.st,.pki-fc.st,.pki-buy.st')){
    if (!live()) return; e.classList.add('on');
    if (e.classList.contains('pki-hero') && duo) pkiDuo(duo);
    await wait(e.matches('.pki-bt') ? 450 : e.matches('.pki-fc') ? 70 : e.matches('.pki-hero,.pki-badge') ? 130 : 30);
  }
  await wait(1500); if (!live()) return; cur.classList.remove('blink'); cur.classList.add('gone'); mk._finish = null;
}
function openPackInfo(id, from){
  const it = SHOP.find(x => x.id === id); if (!it) return; closePackInfo(true);
  const by = {};
  CARDS.filter(c => c.deck === it.deck).forEach(c => { (by[c.set] ||= { set:c.set, rar:c.rarity, n:0 }).n++; });
  const urSets = Object.values(by).filter(r => r.rar === 'ultimate').sort((a, b) => a.n - b.n || a.set.localeCompare(b.set));
  const q = shopQty[id] || 1, nm = esc(it.name.replace(/ Pack$/, '')).toUpperCase(), fx = !S.reduceFx;
  const fan = it.pop.map((c, k) => { const d = k - 2.5; return `<img class="pki-fc${fx ? ' st' : ''}" src="${cardImg(c)}" alt="" style="left:calc(50% + ${(d * 50.16).toFixed(1)}px - 33px);top:${(322 + Math.abs(d) * 2).toFixed(1)}px;transform:rotate(${(d * 3.5).toFixed(1)}deg);z-index:${10 - Math.round(Math.abs(d) * 2)};--r:rotate(${(d * 3.5).toFixed(1)}deg)">`; }).join('');
  const stub = `<svg class="pki-stub" width="34" height="14" viewBox="0 0 34 14" fill="none" stroke="rgba(var(--acr),.95)" stroke-width="1.2"><path d="M0 7 H20 L26 1 H34"/><rect x="24" y="8.5" width="4" height="4" fill="rgba(var(--acr),.95)" stroke="none" transform="rotate(45 26 10.5)"/></svg>`;
  const stars = Array.from({ length:34 }, (_, k) => `<i style="left:${(k * 37.7 % 100).toFixed(1)}%;top:${(k * 61.3 % 100).toFixed(1)}%;animation-duration:${(2.6 + k % 5 * .8).toFixed(1)}s;animation-delay:-${(k % 7 * .9).toFixed(1)}s;opacity:${(.25 + k % 4 * .15).toFixed(2)}"></i>`).join('');
  const sparks = fx ? Array.from({ length:16 }, (_, k) => `<i style="left:${(k * 53.3 % 100).toFixed(1)}%;top:${(25 + k * 29.7 % 65).toFixed(1)}%;width:${2 + k % 3}px;height:${2 + k % 3}px;animation-duration:${(7 + k % 6 * 1.3).toFixed(1)}s;animation-delay:-${(k % 9 * 1.4).toFixed(1)}s"></i>`).join('') : '';
  const mk = document.createElement('div'); mk.id = 'pki'; mk.className = 'pki th-' + it.deck;
  mk.innerHTML = `<div class="pki-box" data-buyhost data-item="${id}"><div class="pki-in" data-title="${nm}">
    <div class="pki-stars">${stars}</div><div class="pki-sparks">${sparks}</div><i class="pki-mist"></i>
    <i class="pki-br a"></i><i class="pki-br b"></i><i class="pki-br c"></i><i class="pki-br d"></i>
    <div class="pki-bg"><img src="${cardImg(it.pbg[0])}" alt=""><img src="${cardImg(it.pbg[1])}" alt=""><img src="${cardImg(it.pbg[2])}" alt=""></div>
    <div class="pki-tt">${stub}<div class="pki-term"><span class="bkt">[</span><span class="txt">${fx ? '' : nm}</span><span class="cur${fx ? ' blink' : ' gone'}"></span><span class="bkt">]</span></div>${stub}</div><i class="pki-ul${fx ? '' : ' draw'}"></i>
    ${pkiFeatHtml(it.deck, urSets, fx, fx ? ' st' : '')}
    <div class="pki-tray${fx ? ' st' : ''}"></div><span class="pki-tag${fx ? ' st' : ''}">// FEATURED</span>${fan}
    ${fx && it.deck === 'tarot' ? pkiSignHtml() : ''}
    <div class="pki-buy${fx ? ' st' : ''}"><div class="sh-qty"><button data-act="qty" data-d="-1" data-item="${id}" aria-label="Fewer"${q <= 1 ? ' disabled' : ''}>‹</button><b data-plain>${q}</b><button data-act="qty" data-d="1" data-item="${id}" aria-label="More"${q >= 99 ? ' disabled' : ''}>›</button></div>${shopBuy(it)}</div>
  </div></div>`;
  mk.addEventListener('click', async e => {
    if (mk._finish && e.target !== mk && !e.target.closest('button')){ mk._finish(); return; }
    if (e.target === mk) return closePackInfo();
    const qb = e.target.closest('[data-act="qty"]'); if (qb) return changeQty(id, +qb.dataset.d);
    const b = e.target.closest('[data-act="buy"]');
    if (b){ e.stopPropagation(); const had = packCount(id); await tryBuy(id, b); if (packCount(id) > had) closePackInfo(true); }
  });
  document.body.appendChild(mk);
  { const s = Math.min(1, innerWidth * .94 / 372, innerHeight * .92 / 500), box = mk.querySelector('.pki-box'); box.style.setProperty('--s', s); box.style.width = 375 * s + 'px'; box.style.height = 503 * s + 'px'; mk.querySelector('.pki-in').style.transform = `scale(${s})`; }
  if (!S.reduceFx){ pkiBoot(mk); if (it.deck === 'tarot') setTimeout(() => { if (mk.isConnected && !mk.dataset.closing) pkiSign(mk); }, 6000); }
  // grows out of the banner you tapped (and shrinks back into it on close)
  if (from && !S.reduceFx){ const box = mk.querySelector('.pki-box'), a = from.getBoundingClientRect(), t = box.getBoundingClientRect();
    mk._from = from; mk._inv = `translate(${a.left - t.left}px,${a.top - t.top}px) scale(${a.width / t.width},${a.height / t.height})`;
    box.style.transformOrigin = '0 0';
    box.animate([{ transform:mk._inv, opacity:.5 }, { transform:'none', opacity:1 }], { duration:MOTION.norm, easing:MOTION.arrive });
    mk.animate([{ backgroundColor:'rgba(3,6,12,0)' }, { backgroundColor:'rgba(3,6,12,.72)' }], { duration:300 }); }
}
