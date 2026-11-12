/* Black Market: the Den's shop. Three random UR cards a day for 1 Gem each, standing on black-and-gold monoliths.
   Window.makeMarket(env) builds it; den.js owns the edge tab that opens it. Class prefix bm-. Styles: css/den/market.css.
   A card costs 3 Gems, paid one per tap into 3 slots on its stone (left back, right back, front).
   Saved in S.den.mk = { day, ids:[3 card ids], got:[0|1 x3], fill:[0..3 x3] } (all optional, psych.v1 unchanged). */
'use strict';

/* ---- stone shards: seeded weighted Voronoi, black glossy shards with amber-gold seams (data-URI svg, cached) ---- */
function rng(s){return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}

function clip(poly,nx,ny,c){const o=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=nx*a[0]+ny*a[1]-c,db=nx*b[0]+ny*b[1]-c;if(da<=0)o.push(a);if((da<0&&db>0)||(da>0&&db<0)){const f=da/(da-db);o.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f])}}return o}
function shards(W,H,seed,K){const r=rng(seed),P=[],dmin=Math.sqrt(W*H/K.n)*.72;let tries=0;while(P.length<K.n&&tries++<600){const p=[r()*W,r()*H];if(P.every(q=>Math.hypot(p[0]-q[0],p[1]-q[1])>dmin))P.push(p)}
 const wt=P.map(()=>r()*dmin*dmin*.55),LD=[-.55,-.83];let defs='',cells='',shad='',glint='';
 const f1=n=>n.toFixed(1);
 P.forEach((pi,i)=>{let poly=[[0,0],[W,0],[W,H],[0,H]];P.forEach((pj,j)=>{if(i==j||poly.length<3)return;const nx=pj[0]-pi[0],ny=pj[1]-pi[1],c=((pj[0]**2+pj[1]**2)-(pi[0]**2+pi[1]**2)-wt[j]+wt[i])/2;poly=clip(poly,nx,ny,c)});
  if(poly.length<3)return;const g=(K.gap[0]+r()*(K.gap[1]-K.gap[0]))/2,cx=poly.reduce((s,q)=>s+q[0],0)/poly.length,cy=poly.reduce((s,q)=>s+q[1],0)/poly.length;
  const E=poly.map((a,k)=>[a,poly[(k+1)%poly.length]]);let q=poly;
  E.forEach(([a,b])=>{const onB=(a[0]<.01&&b[0]<.01)||(a[0]>W-.01&&b[0]>W-.01)||(a[1]<.01&&b[1]<.01)||(a[1]>H-.01&&b[1]>H-.01);if(onB||q.length<3)return;let nx=b[1]-a[1],ny=-(b[0]-a[0]);const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;if(nx*(cx-a[0])+ny*(cy-a[1])>0){nx=-nx;ny=-ny}q=clip(q,nx,ny,nx*a[0]+ny*a[1]-g)});
  if(q.length<3)return;
  /* chipped, uneven edges */
  const qq=[];q.forEach((a,k)=>{const b=q[(k+1)%q.length],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,px=-dy/L,py=dx/L,n=Math.max(2,Math.round(L/9));qq.push([a[0],a[1]]);for(let s=1;s<n;s++){const f=s/n,o=(r()-.5)*.9;qq.push([a[0]+dx*f+px*o,a[1]+dy*f+py*o])}});
  const d=`M${qq.map(p=>f1(p[0])+' '+f1(p[1])).join('L')}Z`;
  const an=r()*Math.PI*2,x1=.5+Math.cos(an)*.5,y1=.5+Math.sin(an)*.5;
  defs+=`<linearGradient id="g${i}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${(1-x1).toFixed(2)}" y2="${(1-y1).toFixed(2)}"><stop offset="0" stop-color="#2b2b33"/><stop offset=".42" stop-color="#09090c"/><stop offset="1" stop-color="#18181d"/></linearGradient>`;
  shad+=`<path d="${d}" fill="#000" fill-opacity=".85"/>`;
  cells+=`<path d="${d}" fill="url(#g${i})"/>`;
  q.forEach((a,k)=>{const b=q[(k+1)%q.length];let nx=b[1]-a[1],ny=-(b[0]-a[0]);const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;if(nx*(cx-a[0])+ny*(cy-a[1])>0){nx=-nx;ny=-ny}const dl=nx*LD[0]+ny*LD[1];
   if(dl>.3)glint+=`<path d="M${f1(a[0]-nx*.35)} ${f1(a[1]-ny*.35)}L${f1(b[0]-nx*.35)} ${f1(b[1]-ny*.35)}" stroke="rgba(255,236,200,${(dl*.5).toFixed(2)})" stroke-width=".8"/>`;
   else if(dl<-.3)glint+=`<path d="M${f1(a[0]-nx*.35)} ${f1(a[1]-ny*.35)}L${f1(b[0]-nx*.35)} ${f1(b[1]-ny*.35)}" stroke="rgba(0,0,0,.55)" stroke-width=".9"/>`})});
 let spk='';for(let i=0;i<W*H/38;i++){const lt=r()<.45;spk+=`<circle cx="${(r()*W).toFixed(1)}" cy="${(r()*H).toFixed(1)}" r="${(.3+r()*.9).toFixed(2)}" fill="${lt?'#ffe9a8':'#5a3208'}" fill-opacity="${(.3+r()*.45).toFixed(2)}"/>`}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${K.gold[0]}"/><stop offset=".5" stop-color="${K.gold[1]}"/><stop offset="1" stop-color="${K.gold[0]}"/></linearGradient><filter id="sh" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".9"/></filter><filter id="nz" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".16" numOctaves="3" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 .2  0 0 0 0 .1  0 0 0 0 .02  1.9 0 0 0 -.55"/></filter>${defs}</defs><rect width="${W}" height="${H}" fill="url(#gd)"/><rect width="${W}" height="${H}" filter="url(#nz)" opacity=".75"/>${spk}<g filter="url(#sh)" transform="translate(.6 .9)">${shad}</g>${cells}<g fill="none" stroke-linecap="round">${glint}</g></svg>`;
 return`url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g,'%27')}")`}

const BM_K = { n:7, gap:[2,3], gold:['#a0651c', '#e2a63c'] };
const bmShardCache = {};
const bmStone = (key, w, h, seed, n) => { const k = key + w + 'x' + h; return bmShardCache[k] || (bmShardCache[k] = shards(w, h, seed, n ? Object.assign({}, BM_K, { n }) : BM_K)); };
const BM_R='#ff4a5a',BM_TXT='font-family="JetBrains Mono,ui-monospace,monospace" font-weight="800" text-anchor="middle"';
const BM_INK=`<svg viewBox="0 0 100 100"><defs><filter id="gr" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -11 6.2" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter></defs><g transform="rotate(-11 50 50)" filter="url(#gr)"><text x="50" y="57" font-family="Montserrat,Arial Black,sans-serif" font-weight="900" font-size="31" text-anchor="middle" fill="${BM_R}" letter-spacing="1">SOLD</text><text x="50" y="69" ${BM_TXT} font-size="6.4" letter-spacing="3.4" fill="${BM_R}">NO REFUND</text><rect x="14" y="62" width="72" height="1.4" fill="${BM_R}"/></g></svg>`;

const BM_GEM = '<svg viewBox="0 0 64 64"><polygon points="32,6 52,34 32,58 12,34" fill="#12080d"/><polygon points="32,6 12,34 32,39" fill="rgba(255,208,216,.22)" stroke="#ff3b5c" stroke-width="2"/><polygon points="32,6 32,39 52,34" fill="rgba(255,124,146,.15)" stroke="#ff3b5c" stroke-width="2"/><polygon points="12,34 32,58 32,39" fill="rgba(228,47,79,.14)" stroke="#ff3b5c" stroke-width="2"/><polygon points="52,34 32,58 32,39" fill="rgba(142,17,45,.14)" stroke="#ff3b5c" stroke-width="2"/></svg>';
/* the three slots, in mock pixels (a 380 px wide screen): x centre, stone top, stone width, card width, delay of the gem fall */
const BM_SL = [{ id:'A', x:64, top:270, w:100, cw:94, gd:.2, seed:65 * 977 + 7 * 131 + 7 }, { id:'B', x:190, top:230, w:108, cw:100, gd:0, seed:66 * 977 + 7 * 131 + 7 }, { id:'D', x:316, top:270, w:100, cw:94, gd:.4, seed:12714, n:6 }];
const BM_GSL = [{ dx:-27, dy:-5, gb:1 }, { dx:27, dy:-5, gb:1 }, { dx:0, dy:0, gb:0 }];   // the 3 gem slots of a stone: fill order back-left, back-right, front (gb = back gem: 88% size, 62% opacity)
const BM_NEED = 3, BM_HOVER = 62;   // gems per card; px the card hovers above the stone top (was 56)
const BM_GAP = 22, BM_PED = 84;   // px from the title block to the top card; height of the short pedestals
const bmHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const bmFmt = n => (typeof fmt === 'function' ? fmt(n) : String(n));

window.makeMarket = env => {
  const { D, gem, reduced, gemPaint } = env;
  let fr = null, bo = null, slots = [], press = null, animT = 0, poorT = [], day = '', zoom = null, shown = 0, refT = 0, idleT = 0, gen = 0, fl = 0;

  /* ---- stock: 3 different random UR cards, seeded by the local date; kept in the save so a reopen never re-rolls ---- */
  const pool = () => CARDS.filter(c => c.rarity === 'ultimate').map(c => c.id).sort();
  function pickIds(k){
    const p = pool(), r = rng(bmHash(k)), out = [];
    while (out.length < 3 && p.length) out.push(p.splice(Math.floor(r() * p.length), 1)[0]);
    return out;
  }
  function stock(){
    const o = D().mk, k = dayKey();
    const ok = o.day === k && Array.isArray(o.ids) && o.ids.length === 3 && o.ids.every(id => typeof id === 'string' && CARD_BY_ID[id]);
    if (!ok){ settle(); o.day = k; o.ids = pickIds(k); o.got = [0, 0, 0]; o.fill = [0, 0, 0]; save(); }
    if (!Array.isArray(o.got) || o.got.length !== 3) o.got = [0, 0, 0];
    o.got = o.got.map(v => v ? 1 : 0);
    if (!Array.isArray(o.fill) || o.fill.length !== 3) o.fill = [0, 0, 0];
    o.fill = o.fill.map((v, i) => o.got[i] ? 0 : Math.max(0, Math.min(BM_NEED - 1, Math.round(+v) || 0)));
    return o;
  }
  /* gems paid into a card that is not bought yet go back to the balance (silently) when the shop opens or closes, and when the day changes */
  function settle(){
    const o = D().mk; if (!o || !Array.isArray(o.fill)) return;
    const n = o.fill.reduce((s, v, i) => s + (o.got && o.got[i] ? 0 : Math.max(0, Math.min(BM_NEED - 1, Math.round(+v) || 0))), 0);
    if (n){ D().b = Math.min(1e9, D().b + n); o.fill = [0, 0, 0]; save(); if (typeof render === 'function') try { render(); } catch (e) {} }
  }
  const bal = () => D().b;
  const poor = () => bal() <= 0;

  /* ---- layout (mock px scaled to the real screen width) ---- */
  function stageHtml(W, H, s){
    const m = stock();
    let out = '';
    /* the cards and pedestals sit in the middle of the free area (between the title and the bottom fade); the stones still run down to the bottom */
    const top0 = Math.min(...BM_SL.map(o => o.top - BM_HOVER - o.cw * s * 1.4)), dy = Math.round(BM_GAP - top0);   // the highest card sits BM_GAP below the title
    const ox = Math.max(0, (W - 380 * s) / 2);   // wide screens (tablet, big phone, the PC preview): the three stones stay centred
    slots = BM_SL.map((o, i) => {
      const idx = i, id = m.ids[idx], sold = !!m.got[idx], c = CARD_BY_ID[id];
      const cw = o.cw * s, ch = cw * 1.4, x = o.x * s + ox, w = o.w * s, top = o.top + dy, cy = top - BM_HOVER - ch, sh = BM_PED;
      out += `<i class="bm-mono" style="left:${x - w / 2}px;top:${top}px;width:${w}px;height:${sh}px"><b class="bm-vn" style='background-image:${bmStone(o.id, Math.round(w), Math.round(sh), o.seed, o.n)}'></b></i>`;
      BM_GSL.forEach((g, k) => { const gt = top - 39 + g.dy, gx = x + g.dx, gd = (o.gd + k * .07).toFixed(2);
        out += `<i class="bm-gem${g.gb ? ' gb' : ''}${sold ? ' off' : ''}" data-i="${i}" data-k="${k}" style="left:${gx}px;top:${gt}px;--gd:${gd}s">${gem()}</i><i class="bm-land${g.gb ? ' gb' : ''}" style="left:${gx}px;top:${gt + 31}px;--gd:${gd}s"></i>`; });
      out += `<div class="bm-it${!ownedCard(id) && !sold ? ' isnew' : ''}${sold ? ' sold rest' : ''}" data-i="${i}" data-k="${idx}" data-n="${esc(c.name)}" data-fill="0" data-res="0" data-cx="${x}" data-cy="${cy + ch / 2}" data-w="${o.cw}" style="--gd:${o.gd}s;left:${x - cw / 2}px;top:${cy}px;width:${cw}px;height:${ch}px;--dl:${(-i * 1.7).toFixed(1)}s"><div class="bm-cd"><img src="${cardImg(id)}" alt=""></div><span class="bm-nw">NEW</span><span class="bm-seal">${BM_INK}</span><span class="bm-shock"></span></div>`;
      return { o, idx, x, cy, ch };
    });
    return out + '<div class="bm-dim"></div>';
  }
  function layout(){
    const stg = fr.querySelector('.bm-stage'), W = stg.clientWidth, H = stg.clientHeight, s = Math.max(.6, Math.min(1.25, W / 380));
    zoom = { W, s };
    stg.innerHTML = stageHtml(W, H, s);
    shown = bal(); fr.querySelector('.bm-bv').textContent = bmFmt(shown);
  }

  /* ---- gem count + states ---- */
  const setBal = () => { const b = fr && fr.querySelector('.bm-bv'); if (b) b.textContent = bmFmt(shown); };
  const bmPlay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const shakeBal = () => bmPlay(fr.querySelector('.bm-bal'), 'deny');   // can't afford: the gem and the number shake, the number turns red
  function applyPoor(imm){
    fr.classList.add('poor'); fr.querySelectorAll('.bm-it.sel').forEach(x => x.classList.remove('sel'));
    poorT.forEach(clearTimeout); poorT = [];
    fr.querySelectorAll('.bm-gem').forEach(g => {
      if (g.classList.contains('off')) return;
      if (imm){ g.classList.add('off'); return; }
      const gd = parseFloat(g.style.getPropertyValue('--gd')) || 0;
      poorT.push(setTimeout(() => g.classList.add('off'), (gd + .2 + 1.1 + .25) * 1000));
    });
  }
  function anim(){
    fr.classList.remove('pre', 'anim'); void fr.offsetWidth; fr.classList.add('anim');
    if (poor()) applyPoor(false);
    clearTimeout(animT); animT = setTimeout(() => fr && fr.classList.remove('anim'), 3400);
  }
  function skip(){ if (!fr || !fr.classList.contains('anim')) return; clearTimeout(animT); fr.classList.remove('anim'); if (fr.classList.contains('poor')) applyPoor(true); }

  /* ---- paying: every tap on the selected card pays 1 Gem into the next free slot (back-left, back-right, front) ---- */
  /* a small gem arcs between two spots (balance -> slot when paying, slot -> balance when refunding) */
  function arcFly(from, to, cb, rev){
    if (reduced() || !document.body.animate){ setTimeout(cb, 60); return; }
    const f0 = fr.getBoundingClientRect(), A = from.getBoundingClientRect(), G = to.getBoundingClientRect();
    const sx = A.x + A.width / 2 - f0.x, sy = A.y + A.height / 2 - f0.y, ex = G.x + G.width / 2 - f0.x, ey = G.y + G.height / 2 - f0.y, mx = (sx + ex) / 2 + (rev ? -46 : 46), my = (sy + ey) / 2 - 44;
    const els = [], op = [1, .45, .28, .14];
    for (let n = 0; n < 4; n++){
      const f = document.createElement('span'); f.className = 'bm-fly'; f.innerHTML = BM_GEM; f.style.opacity = n ? 0 : 1; fr.appendChild(f); els.push(f);
      const an = f.animate([{ transform:`translate(${sx}px,${sy}px) scale(${rev ? .85 : 1.5}) rotate(0deg)`, opacity:op[n], offset:0 }, { transform:`translate(${mx}px,${my}px) scale(1.15) rotate(200deg)`, opacity:op[n], offset:.5 }, { transform:`translate(${ex}px,${ey}px) scale(${rev ? 1.5 : .85}) rotate(400deg)`, opacity:op[n], offset:1 }], { duration:850, delay:n * 55, easing:'cubic-bezier(.45,0,.25,1)', fill:'both' });
      if (!n) an.onfinish = () => { els.forEach(e => e.remove()); cb(); };
    }
  }
  const slotG = (c, k) => fr.querySelector('.bm-gem[data-i="' + c.dataset.i + '"][data-k="' + k + '"]');
  const hitGem = g => { const land = g.nextElementSibling; bmPlay(g, 'catch'); if (land) bmPlay(land, 'hit'); };
  const partial = () => [...fr.querySelectorAll('.bm-it:not(.sold)')].some(c => (+c.dataset.fill || 0) > 0);
  function payOne(c){
    const k = +c.dataset.k, res = +c.dataset.res || 0; if (res >= BM_NEED) return;
    if (poor()){ shakeBal(); return; }
    const i = +c.dataset.i, m = stock(), id = m.ids[k], gn = gen;
    c.dataset.res = res + 1; fl++; D().b = Math.max(0, D().b - 1); shown = Math.max(0, shown - 1); setBal();
    if (res + 1 >= BM_NEED){ m.got[k] = 1; m.fill[k] = 0; gainCard(id); lvSchedule(1800, 'Shop purchase'); } else m.fill[k] = res + 1;   // saved at the tap; the picture catches up when the gem lands
    save(); if (typeof render === 'function') try { render(); } catch (e) {}
    const g = slotG(c, res);
    arcFly(fr.querySelector('.bm-bal svg.g3'), g.querySelector('svg'), () => {
      if (gn !== gen || !fr) return;
      fl--; g.classList.add('f'); if (reduced() && gemPaint) gemPaint(); hitGem(g); c.dataset.fill = (+c.dataset.fill || 0) + 1;
      if (+c.dataset.fill >= BM_NEED) setTimeout(() => { if (fr && gn === gen) sold(c, id); }, 350); else afterSpend();
    });
  }
  function sold(c, id){
    c.classList.remove('sel', 'isnew'); c.classList.add('sold');
    fr.querySelectorAll('.bm-gem[data-i="' + c.dataset.i + '"]').forEach(g => { g.classList.remove('f'); g.classList.add('off'); });
    if (reduced() && gemPaint) gemPaint();
    if (!reduced() && typeof mktUp === 'function') setTimeout(() => { if (fr && c.isConnected) mktUp(id); }, 1000);   // after the SOLD stamp: the Collection tab shows +UR (no flying card)
    afterSpend();
  }
  /* out of Gems with a card part filled: the paid gems stay 2 s, then fly back (see refund) */
  function afterSpend(){
    if (fl > 0 || bal() > 0) return;
    if (partial()){ clearTimeout(refT); refT = setTimeout(refund, 2000); } else applyPoor(true);
  }
  /* change of mind: 3 s after the latest tap on a card with nothing bought, every paid gem flies back to the count and its slot empties */
  function armIdle(){
    clearTimeout(idleT);
    idleT = setTimeout(function go(){ if (!fr) return; if (fl > 0){ idleT = setTimeout(go, 400); return; } if (partial()) refund(); }, 3000);
  }
  function refund(){
    clearTimeout(refT); clearTimeout(idleT); if (!fr) return;
    const m = stock(), list = [], gn = gen;
    fr.querySelectorAll('.bm-it:not(.sold)').forEach(c => { const n = +c.dataset.fill || 0; for (let k = n - 1; k >= 0; k--) list.push([c, k]); c.dataset.fill = 0; c.dataset.res = 0; c.classList.remove('sel'); });
    if (!list.length) return;
    D().b = Math.min(1e9, D().b + list.length); m.fill = [0, 0, 0]; save(); if (typeof render === 'function') try { render(); } catch (e) {}   // the balance is whole again at once; the count catches up as each gem lands
    fr.classList.add('refunding'); let done = 0;
    list.forEach(([c, k], n) => setTimeout(() => {
      if (!fr || gn !== gen) return;
      const g = slotG(c, k); g.classList.remove('f'); if (reduced() && gemPaint) gemPaint();
      arcFly(g.querySelector('svg'), fr.querySelector('.bm-bal svg.g3'), () => {
        if (!fr || gn !== gen) return;
        shown++; setBal(); bmPlay(fr.querySelector('.bm-bal'), 'bup'); if (++done === list.length) fr.classList.remove('refunding');
      }, true);
    }, reduced() ? 0 : n * 150));
  }

  /* ---- hold = zoom view ---- */
  function view(c, on){
    const nm = fr.querySelector('.bm-nmz');
    if (on){
      const tw = Math.min(214, zoom.W * .62), cyT = 54 + tw * 1.4 / 2 - fr.querySelector('.bm-stage').offsetTop;   // the zoomed card sits under the top bar and clear of the name at the bottom
      c.style.setProperty('--tx', (zoom.W / 2 - +c.dataset.cx) + 'px'); c.style.setProperty('--ty', (cyT - +c.dataset.cy) + 'px'); c.style.setProperty('--ps', tw / +c.dataset.w);
      c.classList.add('view'); nm.textContent = c.dataset.n.toUpperCase(); fr.classList.add('pv');
    } else { c.classList.remove('view'); c.style.removeProperty('--tx'); c.style.removeProperty('--ty'); fr.classList.remove('pv'); }
  }
  function down(e){
    if (!fr || !fr.contains(e.target)) return;
    if (!e.target.closest('.bm-bk')) skip();
    const c = e.target.closest('.bm-it'); if (!c) return;
    press = { c, held:false, t:setTimeout(() => { if (press){ press.held = true; view(c, true); } }, 320) };
  }
  function up(){
    if (!press) return; const { c, held, t } = press; clearTimeout(t); press = null;
    if (held){ view(c, false); return; }
    if (c.classList.contains('sold') || fr.classList.contains('refunding')) return;
    armIdle();
    if (fr.classList.contains('poor') || poor()){ shakeBal(); return; }
    if (c.classList.contains('sel')){ payOne(c); return; }
    fr.querySelectorAll('.bm-it.sel').forEach(x => x.classList.remove('sel')); c.classList.add('sel');
  }
  const cancel = () => { if (press){ clearTimeout(press.t); if (press.held) view(press.c, false); press = null; } };
  const noMenu = e => { if (fr && e.target.closest && e.target.closest('.bm-it')) e.preventDefault(); };

  /* ---- reset countdown (local midnight); at zero the stock refreshes at once ---- */
  const p2 = n => String(n).padStart(2, '0');
  function tick(){
    if (!fr) return;
    const s = Math.max(0, Math.floor((env.nextMid() - now()) / 1000));
    fr.querySelector('.bm-cd2').textContent = p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s % 3600 / 60)) + ':' + p2(s % 60);
    if (day !== dayKey()) refresh(true);
  }
  function refresh(replay){
    day = dayKey(); cancel(); poorT.forEach(clearTimeout); poorT = []; gen++; fl = 0; clearTimeout(refT); clearTimeout(idleT);
    fr.classList.remove('pv', 'poor', 'refunding'); layout();
    if (replay) anim(); else if (poor()) applyPoor(true);
  }

  // the Black Market sits exactly over the Den card; measured again whenever the window changes size
  function place(){
    if (!bo || !fr) return;
    const dsh = document.querySelector('.den-ov:not(.den-x) .den-sheet'), dr = dsh && dsh.getBoundingClientRect();
    const bw = dr ? dr.width : Math.min(348, innerWidth - 32), bh = dr ? dr.height : 446, bl = dr ? dr.left : (innerWidth - bw) / 2, bt = dr ? dr.top : (innerHeight - bh) / 2;
    const cl = bo.firstChild, moved = cl.style.width !== bw + 'px' || cl.style.height !== bh + 'px';
    cl.style.cssText = `left:${bl}px;top:${bt}px;width:${bw}px;height:${bh}px`;
    if (moved && zoom) layout();
  }
  function open(){
    if (fr) return;
    settle(); gen++; fl = 0;
    fr = document.createElement('div'); fr.className = 'bm-fr pre';
    fr.innerHTML = `<div class="bm-hd"><div class="bm-top"><button class="bm-bk" type="button" aria-label="Back to the Den">‹</button><div class="bm-bal"><span class="bm-rst">Resets in <b class="bm-cd2">--:--:--</b></span>${gem()}<span class="bm-bv">0</span></div></div><div class="bm-ttl"><div class="bm-tt" data-t="BLACK MARKET"><span>BLACK</span> <span>MARKET</span>${infoIcon('Where Gems come from')}</div></div></div><div class="bm-stage"></div><div class="bm-ft"><span>Tap to select</span><em>Hold to view</em></div><div class="bm-nmz"></div>`;
    bo = document.createElement('div'); bo.className = 'bm-ov' + (S.leftHand ? ' lh' : '');
    const cl = document.createElement('div'); cl.className = 'bm-clip';
    cl.appendChild(fr); bo.appendChild(cl); document.body.appendChild(bo); place();
    addEventListener('resize', place); if (window.visualViewport) visualViewport.addEventListener('resize', place);   // zooming or resizing the window moves the Den card, so the Black Market follows it
    bo.addEventListener('click', e => { if (e.target === bo) close(); });   // a tap beside the card goes back to the Den
    day = dayKey(); layout(); tick();
    fr.addEventListener('click', e => {
      if (e.target.closest('.bm-bk')) close();
      else if (e.target.closest('.info-btn')) infoToggleFloat(e.target.closest('.info-btn'), 'sk', `<div class="tip-t bm-tip">Earn ${gem()} in Lockpick.</div>`);
    });
    document.addEventListener('pointerdown', down); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel); document.addEventListener('contextmenu', noMenu);
    if (reduced()) anim(); else animT = setTimeout(anim, 300);   // the gems start to fall once the card has slid in
  }
  function close(){
    if (!fr) return;
    infoClose(); const f = fr; fr = null; cancel(); clearTimeout(animT); clearTimeout(refT); clearTimeout(idleT); poorT.forEach(clearTimeout); poorT = []; gen++; fl = 0; settle();
    removeEventListener('resize', place); if (window.visualViewport) visualViewport.removeEventListener('resize', place);
    document.removeEventListener('pointerdown', down); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); document.removeEventListener('contextmenu', noMenu);
    const o = bo; bo = null; o.classList.add('out'); setTimeout(() => o.remove(), 320);
  }
  every(1, tick);
  return { open, close, isOpen: () => !!fr };
};
