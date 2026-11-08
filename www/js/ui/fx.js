/* Effects canvas: sparks, flying coins and gems, floating text. */
/*    A see-through canvas over the whole screen draws sparks, glints, embers and light rings.
   Nothing moves the screen itself. */
const FX = (() => {
  const cv = document.createElement('canvas'); cv.id = 'fx'; document.body.appendChild(cv);
  const g = cv.getContext('2d');
  let W = 0, H = 0, parts = [], running = false, last = 0;
  // soft glows don't need full phone resolution: 1.2x keeps them sharp enough at a fraction of the work
  function size(){ const d = Math.min(1.2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(d, 0, 0, d, 0, 0); }
  size(); addEventListener('resize', size);
  const GOLD = ['255,170,100','255,130,60','255,210,160','255,245,230'];
  const BLUE = ['200,228,245','150,195,225','235,246,252','120,170,210'];
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
  // glow sprites are drawn once and reused (cheaper than a gradient per particle per frame)
  const SPR = {};
  function sprite(c, hot){
    const key = c + (hot ? 'h' : ''); if (SPR[key]) return SPR[key];
    const sz = 64, cnv = document.createElement('canvas'); cnv.width = cnv.height = sz;
    const x = cnv.getContext('2d'), gr = x.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    gr.addColorStop(0, hot ? 'rgba(255,248,240,1)' : `rgba(${c},1)`); gr.addColorStop(hot ? .4 : .35, `rgba(${c},${hot ? .45 : .45})`); gr.addColorStop(1, `rgba(${c},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, sz, sz); return SPR[key] = cnv;
  }
  // a 4-point twinkle star, drawn once (glints used to build a path + a glow every frame)
  let STAR = null;
  function starSprite(){
    if (STAR) return STAR;
    const sz = 64, h = sz / 2, cnv = document.createElement('canvas'); cnv.width = cnv.height = sz; const x = cnv.getContext('2d');
    x.drawImage(sprite('255,255,255'), sz * .05, sz * .05, sz * .9, sz * .9);
    x.fillStyle = 'rgba(255,248,240,1)'; x.beginPath();
    x.moveTo(h, 0); x.quadraticCurveTo(h, h, sz, h); x.quadraticCurveTo(h, h, h, sz); x.quadraticCurveTo(h, h, 0, h); x.quadraticCurveTo(h, h, h, 0); x.fill();
    return STAR = cnv;
  }
  const MAX = 140;
  // draw the glow images during quiet time at startup, so the first claim doesn't pay for it
  (window.requestIdleCallback || setTimeout)(() => { [...GOLD, ...BLUE, '255,255,255'].forEach(c => sprite(c)); sprite('255,130,60', true); starSprite(); });
  function add(p){ if (parts.length >= MAX || (S.reduceFx && p.type !== 'ring' && p.type !== 'flash' && Math.random() < .65)) return; parts.push(Object.assign({ vx:0, vy:0, g:0, drag:0, age:0, alpha:1 }, p)); if (!running){ running = true; last = performance.now(); requestAnimationFrame(tick); } }
  // only the area particles touched last frame is cleared (not the whole screen)
  let box = null;
  function tick(t){
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    if (box) g.clearRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    g.globalCompositeOperation = S.reduceFx ? 'source-over' : 'lighter'; g.lineCap = 'round';
    let n = 0;
    for (let i = 0; i < parts.length; i++){
      const p = parts[i];
      p.age += dt; if (p.age >= p.life) continue;
      parts[n++] = p; if (p.age < 0) continue;
      const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy = p.vy * f + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const R = draw(p) || 0, cx = p.type === 'orbit' ? p.cx : p.x, cy = p.type === 'orbit' ? p.cy : p.y;
      if (cx - R < x0) x0 = cx - R; if (cy - R < y0) y0 = cy - R; if (cx + R > x1) x1 = cx + R; if (cy + R > y1) y1 = cy + R;
    }
    parts.length = n;
    g.globalCompositeOperation = 'source-over';
    box = x1 > x0 ? [Math.max(0, x0 - 4), Math.max(0, y0 - 4), Math.min(W, x1 + 4), Math.min(H, y1 + 4)] : box;
    if (parts.length) requestAnimationFrame(tick); else { running = false; g.clearRect(0, 0, W, H); box = null; }
  }
  function draw(p){
    const k = 1 - p.age / p.life;
    if (p.type === 'spark'){
      const sp = Math.hypot(p.vx, p.vy) || 1, len = Math.min(22, sp * .04) + 2, a = p.alpha * k;
      g.strokeStyle = `rgba(${p.c},${a})`; g.lineWidth = p.r * (.4 + .6 * k);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * len, p.y - p.vy / sp * len); g.stroke();
      return len + p.r;
    } else if (p.type === 'ember'){
      const a = p.alpha * Math.min(1, k * 2) * (.75 + .25 * Math.sin(p.age * 14 + p.x)), r = p.r * 3;
      g.globalAlpha = a; g.drawImage(sprite(p.c), p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1;
      return r;
    } else if (p.type === 'glint'){
      const a = p.alpha * Math.sin(Math.PI * p.age / p.life), r = p.r * (.6 + .4 * Math.sin(Math.PI * p.age / p.life));
      g.globalAlpha = a; g.drawImage(starSprite(), p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1;
      return r;
    } else if (p.type === 'ring'){
      const e = 1 - Math.pow(k, 3), r = p.r + (p.r2 - p.r) * e;
      g.strokeStyle = `rgba(${p.c},${p.alpha * k})`; g.lineWidth = p.w * k + .5; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke();
      return r + p.w;
    } else if (p.type === 'orbit'){   // a mote circling a point while spiralling in
      const e = p.age / p.life, ang = p.a0 + p.spin * e, r = p.r0 + (p.r1 - p.r0) * e, a = p.alpha * Math.sin(Math.PI * e);
      const x = p.cx + Math.cos(ang) * r, y = p.cy + Math.sin(ang) * r, rr = p.r * 3;
      g.strokeStyle = `rgba(${p.c},${a * .7})`; g.lineWidth = p.r * .9;
      g.beginPath(); g.arc(p.cx, p.cy, r, ang - .5 * Math.sign(p.spin), ang, p.spin < 0); g.stroke();
      g.globalAlpha = a; g.drawImage(sprite(p.c), x - rr, y - rr, rr * 2, rr * 2); g.globalAlpha = 1;
      return r + rr;
    } else if (p.type === 'flash'){
      const a = p.alpha * Math.pow(k, 2), r = p.r * (1 + (1 - k) * .6);
      g.globalAlpha = a; g.drawImage(sprite('255,130,60', true), p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1;
      return r;
    }
  }
  return {
    // the main claim burst: a flash, a ring of light, sparks flying out, and a few twinkling stars
    burst(x, y, power = 1){
      power = Math.max(.6, Math.min(3, power));
      add({ type:'flash', x, y, r:70 * Math.sqrt(power), life:.45, alpha:.9 });
      add({ type:'ring', x, y, r:8, r2:60 * Math.sqrt(power), w:3.5, c:'255,170,110', life:.55 });
      const n = Math.round(16 * power);
      for (let i = 0; i < n; i++){
        const a = rnd(0, Math.PI * 2), sp = rnd(170, 430) * Math.sqrt(power);
        add({ type:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 80, g:560, drag:2.4, r:rnd(1.4, 2.8), c:pick(GOLD), life:rnd(.45, .9) });
      }
      for (let i = 0; i < Math.round(4 * power); i++)
        add({ type:'glint', x:x + rnd(-60, 60) * Math.sqrt(power), y:y + rnd(-45, 30) * Math.sqrt(power), vy:rnd(-30, -8), r:rnd(6, 12), c:'255,240,225', age:-rnd(.05, .4), life:rnd(.45, .8) });
      for (let i = 0; i < Math.round(5 * power); i++)
        add({ type:'ember', x:x + rnd(-30, 30), y:y + rnd(-10, 10), vx:rnd(-40, 40), vy:rnd(-120, -50), g:-10, drag:.8, r:rnd(1, 2.2), c:pick(GOLD), age:-rnd(0, .3), life:rnd(.8, 1.5), alpha:.9 });
    },
    // a small swirl of gold motes circling in on one spot (goal coin claim)
    swirl(x, y){
      for (let i = 0; i < 10; i++)
        add({ type:'orbit', x, y, cx:x, cy:y, a0:i / 10 * Math.PI * 2, spin:Math.PI * 2.2, r0:30, r1:4, r:rnd(1.2, 2), c:pick(GOLD), life:.75, age:-i * .015 });
      add({ type:'ring', x, y, r:4, r2:24, w:2, c:'255,201,74', life:.45, age:-.5 });
      add({ type:'flash', x, y, r:26, life:.35, alpha:.7, age:-.55 });
    },
    // coloured burst / ring for card reveals: pal = list of 'r,g,b'
    burstC(x, y, power, pal){
      power = Math.max(.6, Math.min(3.5, power));
      add({ type:'ring', x, y, r:8, r2:70 * Math.sqrt(power), w:3.5, c:pal[0], life:.6 });
      const n = Math.round(12 * power);
      for (let i = 0; i < n; i++){ const a = rnd(0, Math.PI * 2), sp = rnd(180, 460) * Math.sqrt(power);
        add({ type:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 80, g:520, drag:2.2, r:rnd(1.4, 3), c:pick(pal), life:rnd(.5, 1) }); }
      for (let i = 0; i < Math.round(3 * power); i++)
        add({ type:'glint', x:x + rnd(-70, 70) * Math.sqrt(power), y:y + rnd(-60, 40) * Math.sqrt(power), vy:rnd(-30, -8), r:rnd(6, 13), c:'255,250,245', age:-rnd(.05, .5), life:rnd(.5, .9) });
    },
    ringC(x, y, r2, life, w, c, delay = 0){ add({ type:'ring', x, y, r:10, r2, w, c, life, age:-delay }); },
    embersC(x, y, n, pal){ for (let i = 0; i < n; i++) add({ type:'ember', x:x + rnd(-60, 60), y:y + rnd(-20, 40), vx:rnd(-50, 50), vy:rnd(-220, -80), g:-12, drag:.6, r:rnd(1.2, 3), c:pick(pal), age:-rnd(0, .6), life:rnd(1.2, 2.4), alpha:.95 }); },
    small(x, y, tint){
      const P = tint === 'blue' ? BLUE : GOLD;
      add({ type:'ring', x, y, r:4, r2:26, w:2.5, c:tint === 'blue' ? '190,220,240' : '255,170,110', life:.4 });
      for (let i = 0; i < 8; i++){ const a = rnd(0, Math.PI * 2), sp = rnd(90, 220);
        add({ type:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 40, g:420, drag:3, r:rnd(1, 2), c:pick(P), life:rnd(.3, .55) }); }
    },
    glints(x, y, w, h, n){ for (let i = 0; i < n; i++) add({ type:'glint', x:x + rnd(0, w), y:y + rnd(0, h), r:rnd(5, 10), c:'255,240,225', age:-rnd(0, .6), life:rnd(.4, .7) }); },
    fountain(x, y, n){ for (let i = 0; i < n; i++){ const a = rnd(-Math.PI * .85, -Math.PI * .15), sp = rnd(300, 680);
      add({ type:'spark', x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, g:620, drag:1.2, r:rnd(1.6, 3.2), c:pick(GOLD), age:-rnd(0, .25), life:rnd(1, 1.7) }); } },
    flash(x, y, r, life = .6){ add({ type:'flash', x, y, r, life, alpha:1 }); }
  };
})();
const rectMid = r => [r.left + r.width / 2, r.top + r.height / 2];
// claim: a bright line races along the top and bottom edges while the quest's own colour fills in
// right behind it, then the colour fades and the tile settles into done
function racingEdge(card){
  const w = card.offsetWidth, h = card.offsetHeight, NS = 'http://www.w3.org/2000/svg';
  const kc = getComputedStyle(card).getPropertyValue('--kc').trim() || '255,107,26';
  const ink = document.createElement('span'); ink.className = 'rc-ink'; ink.style.background = `linear-gradient(90deg,rgba(${kc},.38),rgba(${kc},.14))`;
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'rc-edge'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `<path d="M1 1.2H${w - 1}"/><path d="M1 ${h - 1.2}H${w - 1}"/>`;
  svg.style.color = `rgb(${kc})`; card.append(ink, svg);
  svg.querySelectorAll('path').forEach(p => { p.style.strokeDasharray = w; p.animate([{ strokeDashoffset:w }, { strokeDashoffset:0 }], { duration:520, easing:MOTION.move, fill:'forwards' }); });
  ink.animate([{ transform:'scaleX(0)', opacity:1 }, { transform:'scaleX(1)', opacity:1, offset:.72 }, { transform:'scaleX(1)', opacity:0 }], { duration:780, easing:MOTION.move, fill:'forwards' });
  svg.animate([{ opacity:1 }, { opacity:1, offset:.6 }, { opacity:0 }], { duration:850, fill:'forwards' }).onfinish = () => { ink.remove(); svg.remove(); };
}
// n copies of an icon arc up from rect `from` and into rect `to` (coins to a purse, tickets to the header count).
// onLand(i) runs as each one arrives.
function flyArc(from, to, n, { html, cls = 'fly', stagger = 60, z = 0, onLand } = {}){
  const sx = from.left + from.width / 2 - 11, sy = from.top + from.height / 2 - 11;
  const tx = to.left + to.width / 2 - 11, ty = to.top + to.height / 2 - 11;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div');
    el.className = cls; el.innerHTML = html; if (z) el.style.zIndex = z;
    document.body.appendChild(el);
    const rx = (Math.random() - .5) * 90, ry = (Math.random() - .5) * 40;
    el.animate([
      { transform:`translate(${sx}px,${sy}px) scale(.5)`, opacity:0 },
      { transform:`translate(${sx + rx}px,${sy - 50 + ry}px) scale(1.15)`, opacity:1, offset:.35 },
      { transform:`translate(${tx}px,${ty}px) scale(.8)`, opacity:1 }
    ], { duration:750, delay:i * stagger, easing:'cubic-bezier(.45,0,.6,1)', fill:'both' }).onfinish = () => { el.remove(); if (onLand) onLand(i); };
  }
}
const coinCount = amount => Math.min(6, Math.max(2, Math.ceil(amount / 6)));
// gold coins fly into the header purse; done() runs as the first lands (the purse starts counting then)
function flyCoins(from, amount, done){
  const n = coinCount(amount);
  flyArc(from, $('#purse svg').getBoundingClientRect(), n, { html: ico('i-coin'), onLand: i => {
    replay($('#purse'), ['bump', 'glow']);
    const ci = $('#purse svg'); ci.classList.remove('coin-pop'); void ci.getBoundingClientRect(); ci.classList.add('coin-pop');
    if (i === 0 && done) done();
    if (i === n - 1){ const r = $('#purse svg').getBoundingClientRect(); FX.small(r.left + r.width / 2, r.top + r.height / 2); }
  } });
}
// XP gems arc up from the quest into the XP bar; the bar fills as they land
function flyGems(from, xp){
  const bar = $('.xpbar').getBoundingClientRect(), fill = $('#xpFill').getBoundingClientRect();
  const n = Math.min(5, Math.max(2, Math.ceil(xp / 8)));
  const sx = from.left + from.width / 2 - 9, sy = from.top + from.height / 2 - 9;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div');
    el.className = 'fly gem'; el.innerHTML = ico('i-gem');
    document.body.appendChild(el);
    const tx = Math.max(bar.left + 4, Math.min(bar.right - 22, fill.right - 9 + (Math.random() - .5) * 40)), ty = bar.top + bar.height / 2 - 9;
    const rx = (Math.random() - .5) * 120, up = 70 + Math.random() * 50;
    el.animate([
      { transform:`translate(${sx}px,${sy}px) scale(.4) rotate(0deg)`, opacity:0 },
      { transform:`translate(${sx + rx}px,${sy - up}px) scale(1.2) rotate(${rx > 0 ? 160 : -160}deg)`, opacity:1, offset:.38 },
      { transform:`translate(${tx}px,${ty}px) scale(.7) rotate(${rx > 0 ? 360 : -360}deg)`, opacity:1 }
    ], { duration:720, delay:i * 55, easing:'cubic-bezier(.45,0,.55,1)', fill:'both' }).onfinish = () => {
      el.remove();
      FX.small(tx + 9, ty + 9, 'blue');
      replay($('.xpbar'), 'gain');
    };
  }
}
function floatText(from, text, cls){
  if (QUIET) return;
  const el = document.createElement('div');
  el.className = 'float' + (cls ? ' ' + cls : ''); el.textContent = text;
  document.body.appendChild(el);
  const w = el.offsetWidth, c = from.left + from.width / 2;
  let x = cls === 'gold' ? c + 6 : cls === 'big' ? c - w / 2 : c - w - 6, y = from.top - 14;
  x = Math.max(6, Math.min(innerWidth - w - 6, x));
  el.animate([
    { transform:`translate(${x}px,${y + 6}px) scale(.4)`, opacity:0 },
    { transform:`translate(${x}px,${y - 22}px) scale(1.25)`, opacity:1, offset:.18 },
    { transform:`translate(${x}px,${y - 34}px) scale(1)`, opacity:1, offset:.45 },
    { transform:`translate(${x}px,${y - 78}px) scale(.95)`, opacity:0 }
  ], { duration:1300, easing:MOTION.arrive, fill:'both' }).onfinish = () => el.remove();
}
