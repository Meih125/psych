/* Collection tab: set chips, cover cards, grids, search, tile drag. */
/* ---- Collection 2: pack tabs, category chips (multi-select), overview bars, folding sets ---- */
var colSets = [], colOpen = {}, colInit = false;   // colOpen[k] === false: that set is folded (remembered in S.colOpen)
function colRing(f1, f2, c){
  const R = 9, C = 2 * Math.PI * R;
  // first lap = cards owned; once full, a gold lap shows progress to the next claim
  return `<svg class="cc-ring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="${R}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3.4"/>
    ${f1 > 0 ? `<circle cx="12" cy="12" r="${R}" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${C * f1} ${C}"/>` : ''}
    ${f1 >= 1 && f2 > 0 ? `<circle cx="12" cy="12" r="${R}" fill="none" stroke="#f5c542" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${C * f2} ${C}"/>` : ''}</svg>`;
}
function colInfo(set){
  const sd = sceneDefOf(set);
  if (sd){
    const got = sd.list.filter(sc => S.scenes[sc.id]).length, n = sd.list.length;
    return { name:sd.name, col:sd.col, got, n, f1:got / n, f2:0, ready:got === n && !S.setClaims[set] };
  }
  const list = CARDS.filter(c => c.set === set), n = list.length, r = list[0].rarity;
  const got = list.filter(c => ownedCard(c.id)).length, two = list.filter(c => ownedCard(c.id) >= 2).length;
  return { name:set === 'Joker' && !jokersOpen() ? 'Joker (Locked)' : setLabel(set), list, rar:r, col:set === 'Joker' ? '#b04bff' : RARITY[r].color, got, two, n, f1:got / n, f2:two / n, ready:setReady(set) };
}
// category header pictures: up to 3 chosen (S.cover[set]), else the 3 newest found, else card backs
function coverOk(k, id){   // is this picture still something the player has?
  const sd = sceneDefOf(k);
  if (sd) return !!S.scenes[id] && sd.list.some(sc => sc.id === id);
  if (/^HD_DUO\d+$/.test(id)){ const L = CARDS.filter(c => c.set === 'Duo').sort((a, b) => a.id.localeCompare(b.id)), n = +id.slice(6) - 1; return k === 'Duo' && !!L[n * 2] && !!L[n * 2 + 1] && ownedCard(L[n * 2].id) > 0 && ownedCard(L[n * 2 + 1].id) > 0; }
  const cid = id.replace(/_l$/, ''), c = CARD_BY_ID[cid];
  return !!c && c.set === k && ownedCard(cid) > 0;
}
function headIds(k, I, sd, duo){
  const own = sd ? sd.list.filter(sc => S.scenes[sc.id]).map(sc => sc.id) : duo ? duoPreview(I.list) : I.list.filter(c => ownedCard(c.id)).map(c => c.id);
  const cov = ((S.cover || {})[k] || []).filter(id => coverOk(k, id)).slice(0, 3);
  if (cov.length) return cov;
  if (duo) return own.slice(0, 3);
  const nw = ((S.newest || {})[k] || []).filter(id => coverOk(k, id));
  return [...nw, ...own.filter(id => !nw.includes(id))].slice(0, 3);
}
// Tap the pictures on a category header: pick up to 3 of your own cards for it. Pages swipe sideways:
// regular sets 4 x 2 per page, Realms / Chapters 2 x 3, Duo: joined art 2 x 2 and single cards 4 x 1.
function closeCover(){ const el = $('#cvp'); if (el){ el.remove(); render(); } }
function openCover(k){
  const sd = sceneDefOf(k), duo = k === 'Duo', I = colInfo(k);
  let groups;   // [{ title, ids, cols, rows, land }]
  if (sd) groups = [{ ids:sd.list.filter(sc => S.scenes[sc.id]).map(sc => sc.id), cols:2, rows:3, land:true }];
  else if (duo){
    const L = [...I.list].sort((a, b) => a.id.localeCompare(b.id)), joined = [], singles = [];
    for (let i = 0; i < L.length; i += 2){
      const a = L[i], b = L[i + 1];
      if (b && ownedCard(a.id) && ownedCard(b.id)) joined.push('HD_DUO' + String(i / 2 + 1).padStart(2, '0'));
      [a, b].forEach(c => { if (c && ownedCard(c.id)) singles.push(c.id + '_l'); });
    }
    groups = [{ title:'Joined art', ids:joined, cols:2, rows:2, land:true }, { title:'Single cards', ids:singles, cols:4, rows:1, land:true }];
  } else groups = [{ ids:I.list.filter(c => ownedCard(c.id)).map(c => c.id), cols:4, rows:2 }];
  groups = groups.filter(g => g.ids.length); if (!groups.length) return;
  const sel = ((S.cover || {})[k] || []).filter(id => coverOk(k, id));
  const el = document.createElement('div'); el.id = 'cvp'; el.className = 'cvp';
  const draw = () => {
    el.innerHTML = `<div class="cvp-sheet"><div class="cvp-t"><b>Select up to 3</b><span>${sel.length}/3</span></div>
      ${groups.map(g => { const per = g.cols * g.rows, pages = Math.ceil(g.ids.length / per);
        return `${g.title ? `<div class="cvp-h">${g.title}</div>` : ''}<div class="cvp-pg" data-pg="${pages}"><div class="cvp-sc">${Array.from({ length:pages }, (_, p) => `<div class="cvp-page" style="--cols:${g.cols}">${g.ids.slice(p * per, p * per + per).map(id => { const n = sel.indexOf(id) + 1;
          return `<button class="cvp-c${g.land ? ' l' : ''}${n ? ' on' : ''}" data-id="${id}"><img src="${cardImg(id)}" alt="">${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}</div>`).join('')}</div>${pages > 1 ? `<div class="cvp-dots">${Array.from({ length:pages }, (_, p) => `<u${p ? '' : ' class="on"'}></u>`).join('')}</div>` : ''}</div>`; }).join('')}
      <div class="cvp-dn"><button data-cv="clear">Clear</button><button class="a" data-cv="done">Done</button></div></div>`;
    el.querySelectorAll('.cvp-sc').forEach(sc => sc.addEventListener('scroll', () => { const p = Math.round(sc.scrollLeft / sc.clientWidth); sc.parentNode.querySelectorAll('.cvp-dots u').forEach((u, i) => u.classList.toggle('on', i === p)); }, { passive:true }));
  };
  const keep = () => { if (!S.cover || typeof S.cover !== 'object') S.cover = {}; if (sel.length) S.cover[k] = [...sel]; else delete S.cover[k]; save(); };
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('[data-cv="done"]')) return closeCover();
    if (e.target.closest('[data-cv="clear"]')){ sel.length = 0; keep(); const sx = [...el.querySelectorAll('.cvp-sc')].map(c => c.scrollLeft); draw(); el.querySelectorAll('.cvp-sc').forEach((c, i) => c.scrollLeft = sx[i]); return; }
    const c = e.target.closest('.cvp-c'); if (!c) return;
    const id = c.dataset.id, at = sel.indexOf(id);
    if (at >= 0) sel.splice(at, 1); else if (sel.length >= 3){ showToast('Up to 3 pictures', false); return; } else sel.push(id);
    keep(); const sx = [...el.querySelectorAll('.cvp-sc')].map(x => x.scrollLeft); draw(); el.querySelectorAll('.cvp-sc').forEach((x, i) => x.scrollLeft = sx[i]);
  });
  draw(); document.body.appendChild(el);
}
// switching pack tab: name slides in, bars and numbers animate (off with Reduce effects)
// category chips: old row slides out, new row slides in staggered
function colChipsSwap(old, dir){
  const row = document.querySelector('#panel .cc-chips'); if (!row || !old || S.reduceFx) return;
  // like folder tabs: the old row is simply gone and the new tabs rise up into place one after another
  [...row.children].forEach((c, j) => c.animate([{ transform:'translateY(130%)' }, { transform:'none' }], { duration:340, delay:j * 45, easing:'cubic-bezier(.2,.8,.3,1.1)', fill:'backwards' }));
}
// old set boxes fold shut while the new ones unfold, so the height eases
function colSetsSwap(olds){
  if (!olds || !olds.length || S.reduceFx) return;
  const secs = [...document.querySelectorAll('#panel #ccMain .cc-fold')].slice(0, 4); if (!secs.length) return;
  // transform / opacity only (animating height re-lays out the page every frame)
  const host = secs[0].parentNode, g = document.createElement('div'); g.style.cssText = `position:absolute;left:0;right:0;top:${secs[0].offsetTop}px;z-index:2;pointer-events:none;transform-origin:50% 0`;
  olds.forEach(o => g.appendChild(o)); host.appendChild(g);
  g.animate([{ opacity:1, transform:'scaleY(1)' }, { opacity:0, transform:'scaleY(.55)' }], { duration:300, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards' }); setTimeout(() => g.remove(), 340);
  secs.forEach((e, j) => { e.style.transformOrigin = '50% 0'; e.animate([{ opacity:0, transform:'scaleY(.6) translateY(-10px)' }, { opacity:1, transform:'none' }], { duration:360, delay:60 + j * 35, easing:'cubic-bezier(.2,.7,.2,1)', fill:'backwards' }); });
}
// picking / dropping a category folds the other sets shut / open
function colItems(){ const m = document.querySelector('#panel #ccMain'); if (!m) return []; return [...m.children].filter(e => e.classList.contains('cc-over') || e.classList.contains('cc-fold')).map(e => ({ key:e.classList.contains('cc-over') ? '#over' : ((e.querySelector('[data-set]') || {}).dataset || {}).set, el:e })); }
function colSnap(){ return S.reduceFx ? null : colItems().map(x => { const c = x.el.cloneNode(true); c.querySelectorAll('.cc-bd,img').forEach(n => n.remove()); return { key:x.key, h:x.el.offsetHeight, top:x.el.offsetTop, clone:c }; }); }
function colMorph(was){
  if (!was) return; const now = colItems(), host = document.querySelector('#panel #ccMain'); if (!host) return;
  const has = new Set(now.map(x => x.key)); let n = 0;
  // kept rows slide, dropped rows fade, new rows fold open (transform / opacity only)
  was.forEach(o => { if (has.has(o.key) || n >= 6) return; n++;
    const g = document.createElement('div'); g.style.cssText = `position:absolute;left:0;right:0;top:${o.top}px;z-index:2;pointer-events:none;transform-origin:50% 0`; g.appendChild(o.clone); host.appendChild(g);
    g.animate([{ opacity:1, transform:'scaleY(1)' }, { opacity:0, transform:'scaleY(.5)' }], { duration:300, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards' }); setTimeout(() => g.remove(), 340); });
  now.forEach(x => { const o = was.find(w => w.key === x.key);
    if (o){ const dy = o.top - x.el.offsetTop; if (Math.abs(dy) > 1) x.el.animate([{ transform:`translateY(${dy}px)` }, { transform:'none' }], { duration:340, easing:'cubic-bezier(.25,.9,.3,1)' }); }
    else { x.el.style.transformOrigin = '50% 0'; x.el.animate([{ opacity:0, transform:'scaleY(.6)' }, { opacity:1, transform:'none' }], { duration:340, delay:60, easing:'cubic-bezier(.25,.9,.3,1)', fill:'backwards' }); } });
}
function colSwitch(to, fdir){
  const ov = document.querySelector('#panel .cc-over'), ids = ['all', ...COLLECTIONS.map(g => g.id)], dir = fdir || (ids.indexOf(to) > ids.indexOf(colGroup) ? 1 : -1);
  const was = ov && !S.reduceFx ? { name:ov.querySelector('.cc-tt b').textContent, nums:[...ov.querySelectorAll('.cc-tt .nv')].map(x => +x.dataset.v),
    strips:[...ov.querySelectorAll('.ov-strip span')].map(x => ({ k:x.dataset.k, w:x.firstElementChild.style.width, fl:x.style.flex })),
    cols:[...ov.querySelectorAll('.ov-cols div')].map(d => ({ k:d.dataset.k, v:[...d.querySelectorAll('.nv, .pc')].map(x => +x.dataset.v) })) } : null;
  const oldSets = S.reduceFx ? [] : [...document.querySelectorAll('#panel #ccMain .cc-fold')].slice(0, 4).map(x => { const c = x.cloneNode(true); c.querySelectorAll('.cc-bd,img').forEach(n => n.remove()); return c; });   // text and bars only: pictures made the lift-off heavy
  const oldChips = !S.reduceFx && document.querySelector('#panel .cc-chips') ? document.querySelector('#panel .cc-chips').cloneNode(true) : null;
  const had = colSets.length, snap = had ? colSnap() : null;   // picked categories are dropped when the pack changes
  colSets = []; colGroup = to; render();
  colChipsSwap(oldChips, dir); if (had) colMorph(snap); else colSetsSwap(oldSets);
  const nv = document.querySelector('#panel .cc-over'); if (!was || !nv) return;
  const nb = nv.querySelector('.cc-tt b'), nw = nb.textContent;
  if (was.name !== nw){ nb.innerHTML = `<span class="nm-box"><span class="nm-o" style="--d:${-dir}">${esc(was.name)}</span><span class="nm-n" style="--d:${dir}">${esc(nw)}</span></span>`; setTimeout(() => { if (nb.isConnected) nb.textContent = nw; }, 460); }
  nv.querySelectorAll('.cc-tt .nv').forEach((x, i) => { if (was.nums[i] != null) invNumTween(x, was.nums[i], +x.dataset.v, 450); });
  nv.querySelectorAll('.ov-strip span').forEach(sp => { const f = sp.firstElementChild, old = was.strips.find(o => o.k === sp.dataset.k), fl = sp.style.flex, w = f.style.width;   // the block grows / shrinks and its fill runs from the old level to the new
    jump([sp, f], () => { if (old){ sp.style.flex = old.fl; f.style.width = old.w; } else f.style.width = '0%'; }); sp.style.flex = fl; f.style.width = w; });
  nv.querySelectorAll('.ov-cols div').forEach(d => { const old = was.cols.find(o => o.k === d.dataset.k); if (old) d.querySelectorAll('.nv, .pc').forEach((x, i) => { if (old.v[i] != null) invNumTween(x, old.v[i], +x.dataset.v, 450); }); });
}
function renderCollection(){
  const packs = COLLECTIONS.filter(g => colGroup === 'all' || colGroup === g.id);
  const keys = [];
  packs.forEach(g => { g.sets.forEach(s => keys.push(s)); if (g.sceneKey) keys.push(g.sceneKey); });
  if (colGroup === 'all'){   // all packs: rarest sets first, scenes last
    const rk = k => sceneDefOf(k) ? 99 : RARITY_ORDER.indexOf((CARDS.find(c => c.set === k) || {}).rarity);
    keys.sort((a, b) => rk(a) - rk(b));
  }
  colSets = (colSets || []).filter(k => keys.includes(k)); if (!colInit){ colInit = true; colOpen = S.colOpen && typeof S.colOpen === 'object' && !Array.isArray(S.colOpen) ? { ...S.colOpen } : {}; } colOpen = colOpen || {};   // drop picks from a pack that is no longer shown (the app can draw before these vars are set)
  const tile = colTile;
  // pack picker: one tile per pack with its card back and how many you have
  const pkCol = { all:'200,220,218', tarot:'255,107,26', mlbb:'124,92,255', hod:'255,184,58' };
  const pkTile = (id, name) => {
    const L = CARDS.filter(c => id === 'all' || COLLECTIONS.find(g => g.id === id).sets.includes(c.set));
    const art = id === 'all' ? COLLECTIONS.map(g => `<img src="${cardImg(DECKS[g.id].back)}" alt="">`).join('') : `<img class="v-ur" src="${cardImg(DECKS[id].backUR)}" alt=""><img class="v-n" src="${cardImg(DECKS[id].back)}" alt="">`;   // V: UR back behind, normal back in front
    return `<button class="pk-tile${colGroup === id ? ' on' : ''}" style="--r:${pkCol[id] || '200,220,218'}" data-act="colg" data-g="${id}">${art}<b>${esc(name)}</b><small>${L.filter(c => ownedCard(c.id)).length}/${L.length}</small></button>`;
  };
  let html = `<div class="pk-tiles">${pkTile('all', 'All')}${COLLECTIONS.map(g => pkTile(g.id, g.id === "mlbb" ? "Land of Dawn" : g.id === "hod" ? "Hand of Destiny" : g.name)).join('')}</div>`;
  // search bar (magnifying glass in the title row): results replace the sets while something is typed
  if (colSearch) html += `<div id="ccRes">${colQ ? colSearchHTML(colQ) : ''}</div>`;
  html += `<div id="ccMain"${colSearch && colQ ? ' hidden' : ''}>`;
  // category chips: tap to pick one or more, tap again to drop; none picked = show everything
  html += `<div class="cc-chips">${keys.map(k => { const I = colInfo(k);
    return `<button class="cc-chip${colSets.includes(k) ? ' on' : ''}${I.ready ? ' ready' : ''}" style="--c:${I.col}" data-act="colset" data-set="${esc(k)}">${colRing(I.f1, I.f2, I.col)}${esc(I.name)}</button>`; }).join('')}</div>`;
  // overview bars for whatever pack tab is picked (hidden while categories are picked)
  if (!colSets.length){
    const pool = CARDS.filter(c => packs.some(g => g.sets.includes(c.set)));
    const title = colGroup === 'all' ? 'All packs' : colGroup === 'mlbb' ? 'Land of Dawn' : colGroup === 'hod' ? 'Hand of Destiny' : packs[0].name;
    html += `<div class="cc-over"><div class="cc-tt"><b>${esc(title)}</b><span><i class="nv" data-v="${pool.filter(c => ownedCard(c.id)).length}">${pool.filter(c => ownedCard(c.id)).length}</i>/<i class="nv" data-v="${pool.length}">${pool.length}</i></span></div>${(() => { const rs = RARITY_ORDER.map(r => { const L = pool.filter(c => c.rarity === r); return L.length ? { r, n:L.length, g:L.filter(c => ownedCard(c.id)).length } : null; }).filter(Boolean);
      return `<div class="ov-strip">${rs.map(o => `<span data-k="${o.r}" style="flex:${o.n};--c:${RARITY[o.r].color}"><i style="width:${o.g / o.n * 100}%"></i></span>`).join('')}</div><div class="ov-cols" style="grid-template-columns:repeat(${rs.length},1fr)">${rs.map(o => `<div data-k="${o.r}" style="--c:${RARITY[o.r].color}"><b>${RARITY[o.r].name}</b><em><i class="pc" data-v="${Math.round(o.g / o.n * 100)}">${Math.round(o.g / o.n * 100)}</i><small>%</small></em><span><i class="nv" data-v="${o.g}">${o.g}</i>/<i class="nv" data-v="${o.n}">${o.n}</i></span></div>`).join('')}</div>`; })()}</div>`;
  }
  if (!keys.length) html += `<div class="empty">No cards yet.<br>This pack is coming soon.</div>`;
  (colSets.length ? keys.filter(k => colSets.includes(k)) : keys).forEach(k => {
    const I = colInfo(k), open = colOpen[k] !== false;
    const sd = sceneDefOf(k), scene = !!sd, duo = k === 'Duo', wide = scene || duo;
    const prev = headIds(k, I, sd, duo), noneOwned = !prev.length;
    const bkDeck = scene ? (k === '__realms' ? 'hod' : 'tarot') : (I.list[0].deck || 'tarot'), bkUR = !scene && I.rar === 'ultimate';
    const pay = scene ? scenePay(k) : setPay(k);
    const poker = k === 'Poker';
    const claim = poker ? '' : scene ? claimBtn(k, I.got === I.n, pay) : claimBtn(k, I.ready, pay, true);
    const payHtml = poker ? '' : claimPay2(pay, !I.ready);
    const times = setTimes(k), g2 = !scene && !poker;   // the gold bar (2 of each card) shows on every set, dimmed until it has been claimed once; numbers sit at the end of their own bar
    html += `<section class="cc-fold${open ? ' open' : ''}${I.ready ? ' ready' : ''}" style="--c:${I.col};--rows:${open ? (k === 'Puzzle' ? (pzGrid ? 3 : 1) : duo ? Math.ceil(I.n / 2) * 1.5 : FAN_SET[k] ? 1.5 : k === 'Poker' ? 4 : Math.ceil(I.n / 3) + 0) : 0}">
      <div class="cc-hd">
        <div class="cc-pv${wide && !noneOwned ? ' land' : ''} n${noneOwned ? 3 : prev.length}"${noneOwned ? '' : ` data-act="cover" data-set="${esc(k)}"`}>${noneOwned ? [0, 1, 2].map(() => `<img class="bk" src="${cardImg(DECKS[bkDeck][bkUR ? 'backUR' : 'back'])}" alt="">`).join('') : prev.map((id, i) => `<img${/^HD_DUO\d/.test(id) ? ' class="dj"' : ''} src="${cardImg(id)}" style="z-index:${prev.length - i}" alt="">`).join('')}</div>
        <div class="cc-mid" data-act="colfold" data-set="${esc(k)}"><div class="cc-nm"><b>${esc(I.name)}${g2 && times ? `<small>(${times}x)</small>` : ''}</b></div><div class="cc-br"><div class="cc-bars"><div class="cc-bar"><i style="width:${I.f1 * 100}%"></i></div>${g2 ? `<div class="cc-bar cc-bar2${times ? '' : ' dim'}"><i class="gold" style="width:${I.f2 * 100}%"></i></div>` : ''}</div>${g2 && times ? `<span class="cc-n nx" title="Progress to the next claim (2 of each card)">${I.two}/${I.n}</span>` : `<span class="cc-n">${I.got}/${I.n}</span>`}</div></div>
        ${poker ? '' : `<div class="cc-act">${claim}${payHtml}</div>`}
      </div>
      ${open ? `<div class="cc-bd">${scene
        ? `<div class="col-scenes pbd">${sd.list.map((sc, i) => {   // pin board: framed pictures, two per line, a little crooked and uneven
            const se = SCENE_EDGE[sc.id] || ['#4fe6d8', '#8fb', '#f5c542'], st = `style="--e1:${se[0]};--e2:${se[1]};--e3:${se[2]};--r:${((i * 37) % 7 - 3) * .9}deg;--ty:${((i * 53) % 5 - 2) * 3}px;--tx:${((i * 29) % 5 - 2) * 2}px"`, nm = sc.name.replace(/^Chapter \d+:\s*/, '');
            return S.scenes[sc.id]
            ? `<button class="cs pb" ${st} data-act="inspect" data-id="${sc.id}" data-scene="1"><img loading="lazy" decoding="async" src="${cardImg(sc.id)}" alt="${esc(sc.name)}"><span>${esc(nm)}</span></button>`
            : `<div class="cs pb locked" ${st}><i></i><span>???</span></div>`; }).join('')}</div>`
        : duo ? duoGrid(I.list)
        : FAN_SET[k] ? fanGrid(I.list, k)
        : poker ? pokerSuits(I.list)
        : k === 'Puzzle' ? (pzGrid ? `<div class="col-grid pz-grid">${[...I.list].sort((a, b) => a.id.localeCompare(b.id)).map(tile).join('')}</div><button class="pz-pic" data-act="pzview">Show the picture</button>` : puzzleStrip(I.list))
        : `<div class="col-grid">${orderedList(k, I.list).map(tile).join('')}</div>`}</div>` : ''}
    </section>`;
  });
  return `<div class="collection cc">${html}</div></div>`;
}
/* ---- Collection search: magnifying glass in the title row ---- */
var colSearch = false, colQ = '';
// Duo: sideways cards that come in pairs (001+002, 003+004 ...). Own both and they sit together as one picture.
// Duo: the preview in the folder header; a finished pair shows as its joined picture
function duoPreview(list){
  const L = [...list].sort((a, b) => a.id.localeCompare(b.id)), joined = [], singles = [];
  for (let i = 0; i < L.length; i += 2){
    const a = L[i], b = L[i + 1];
    if (b && ownedCard(a.id) && ownedCard(b.id)) joined.push('HD_DUO' + String(i / 2 + 1).padStart(2, '0'));
    else [a, b].forEach(c => { if (c && ownedCard(c.id)) singles.push(c.id + '_l'); });
  }
  // pairs 3 and 5 have busy art: shown in the preview only if nothing else is owned
  const busy = id => id === 'HD_DUO03' || id === 'HD_DUO05' || /^HD_PTR(05|06|09|10)_l$/.test(id);
  return [...joined, ...singles].sort((a, b) => busy(a) - busy(b));
}
const DUO_GLOW = [["255,38,145", "254,255,38"], ["38,222,255", "255,246,38"], ["255,139,38", "192,255,38"], ["86,38,255", "207,38,255"], ["255,182,38", "96,38,255"], ["255,156,38", "38,62,255"], ["38,184,255", "73,38,255"]];
function duoGrid(list){
  const L = [...list].sort((a, b) => a.id.localeCompare(b.id)), pairs = [];
  for (let i = 0; i < L.length; i += 2) pairs.push(L.slice(i, i + 2));
  const pill = n => n > 1 ? `<span class="qty">×${n}</span>` : '';
  const one = c => { const n = ownedCard(c.id); return n
    ? `<button class="cs duo-c" data-act="inspect" data-id="${c.id}" data-land="1"><img loading="lazy" decoding="async" src="${landImg(c.id)}" alt="${esc(c.name)}">${pill(n)}</button>`
    : `<div class="cs duo-c locked"><img loading="lazy" decoding="async" src="${landImg(c.id)}" alt=""></div>`; };
  return `<div class="col-duo">${pairs.map((p, k) => {
    const a = ownedCard(p[0].id), b = p[1] ? ownedCard(p[1].id) : 0, id = 'HD_DUO' + String(k + 1).padStart(2, '0');
    // both owned: the two cards join into one picture (each one's count sits in its own bottom corner)
    return a && b
      ? `<button class="duo-one" data-act="inspect" data-id="${id}" data-land="1" style="--g1:${DUO_GLOW[k][0]};--g2:${DUO_GLOW[k][1]}"><img loading="lazy" decoding="async" src="${cardImg(id)}" alt="${esc(p[0].name)} and ${esc(p[1].name)}">${a > 1 ? `<span class="qty ql">×${a}</span>` : ''}${b > 1 ? `<span class="qty">×${b}</span>` : ''}</button>`
      : `<div class="duo">${p.map(one).join('')}</div>`; }).join('')}</div>`;
}
// Two-card categories (Promo, Joker) overlap like a small fan.
const FAN_SET = { Joker:['165,60,255', '235,30,70'], Promo:['235,60,50', '255,184,58'] };
function fanGrid(list, k){
  const [g1, g2] = FAN_SET[k], locked = k === 'Joker' && !jokersOpen();
  const one = (c, cls) => {
    const n = ownedCard(c.id), img = `<img loading="lazy" decoding="async" src="${cardImg(c.id)}" alt="${n ? esc(c.name) : ''}">`;
    if (locked) return `<div class="fc ${cls} lk">${img}<b>LOCKED</b></div>`;
    return n ? `<button class="fc ${cls}" data-act="inspect" data-id="${c.id}">${img}</button>` : `<div class="fc ${cls} off">${img}</div>`;
  };
  // the ×N pills sit in the two bottom corners of the category, not on the cards
  const corner = (c, side) => { const n = locked ? 0 : ownedCard(c.id); return n > 1 ? `<span class="qty fq fq-${side}">×${n}</span>` : ''; };
  return `<div class="col-fan" style="--g1:${g1};--g2:${g2}">${list.map((c, i) => one(c, i ? 'fb' : 'fa')).join('')}${list[0] ? corner(list[0], 'l') : ''}${list[1] ? corner(list[1], 'r') : ''}</div>${locked ? '<div class="jk-note c"><span>Finish the Poker set to unlock.</span></div>' : ''}`;
}
// Poker: one line per suit with its own claim; extra copies show as stacked edges + ×N
function pokerTile(c){
  const n = ownedCard(c.id), rk = RANKS13[pokerIdx(c) % 13];
  const img = `<img src="${cardImg(c.id)}" alt="${n ? esc(c.name) : ''}">`;
  const st = n > 2 ? ' s2' : n > 1 ? ' s1' : '';
  return `<div class="pkc${st}">${n ? `<button class="ct r-${c.rarity}" data-act="inspect" data-id="${c.id}">${img}</button>` : `<div class="ct locked r-${c.rarity}">${img}</div>`}<i>${rk}</i>${n > 1 ? `<span class="qty">×${n}</span>` : ''}</div>`;
}
function pokerSuits(list){
  return `<div class="pk-suits">${POKER_SUITS.map(([key, name, sym, col]) => {
    const L = keyCards(key), got = L.filter(c => ownedCard(c.id)).length, two = L.filter(c => ownedCard(c.id) >= 2).length, t = setTimes(key), ready = setReady(key);
    const cnt = t ? `${got}/13 <span class="nx" title="Progress to the next claim (2 of each card)">${two}/13</span> (${t}x)` : `${got}/13`;
    const btn = t && !ready ? `<button class="set-claim got" disabled>Claimed</button>` : `<button class="set-claim${ready ? ' ready' : ''}" ${ready ? `data-act="setclaim" data-set="${key}"` : 'disabled'}>Claim</button>`;
    return `<div class="pk-suit" style="--sc:${col}"><div class="pk-sh"><b><em>${sym}</em> ${name}<small>${cnt}</small></b>${claimPay(POKER_SUIT_PAY, !ready)}${btn}</div><div class="pk-row">${L.map(pokerTile).join('')}</div></div>`;
  }).join('')}</div>`;
}
// cards in the player's order (S.order[set]) with big ones (S.big); new cards go last
function orderedList(k, list){
  const saved = (S.order || {})[k]; if (!Array.isArray(saved) || !saved.length) return list;
  const pos = id => { const i = saved.indexOf(id); return i < 0 ? 1e6 : i; };
  return list.map((c, n) => [c, n]).sort((a, b) => pos(a[0].id) - pos(b[0].id) || a[1] - b[1]).map(x => x[0]);
}
function colTile(c){
  if (c.joker && !jokersOpen()) return `<div class="ct locked jl r-common"><img loading="lazy" decoding="async" src="${cardImg(c.id)}" alt=""><b>LOCKED</b></div>`;
  const n = ownedCard(c.id);
  return n
    ? `<button class="ct${S.big && S.big[c.id] ? (S.big[c.id] === 2 ? ' big br' : ' big') : ''} r-${c.rarity}${CARD_EDGE[c.id] && (c.rarity === 'ultimate' || c.rarity === 'legendary') ? ' edge' : ''}"${edgeStyle(c.id)} data-act="inspect" data-id="${c.id}"><img loading="lazy" decoding="async" src="${cardImg(c.id)}" alt="${esc(c.name)}">${n > 1 ? `<span class="qty">×${n}</span>` : ''}</button>`
    : `<div class="ct locked r-${c.rarity}" data-cid="${c.id}"><img loading="lazy" decoding="async" src="${cardImg(c.id)}" alt=""></div>`;   // not owned: face up but dark, like the puzzle pieces
}
// lower-case, no accents, curly quotes made straight: "Soryu" finds "Sōryū", "its" finds "it's"
const searchNorm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');
function cardSearchText(c){
  const pack = c.deck === 'mlbb' ? 'land of dawn mlbb' : c.deck === 'hod' ? 'hand of destiny hod' : 'tarot';
  return searchNorm([c.name, c.hero, setLabel(c.set), c.joker ? 'J joker' : RARITY[c.rarity].name, pack, ownedCard(c.id) ? flavorOf(c.id) : ''].join('   '));
}
function colSearchHTML(q){
  const words = searchNorm(q).split(/\s+/).filter(Boolean);
  // every card shows up; ones you don't own are faded (owned first; their flavour text isn't searchable)
  const pool = CARDS.filter(c => (colGroup === 'all' || COLLECTIONS.find(g => g.id === colGroup).sets.includes(c.set)));
  const hits = pool.filter(c => { const t = cardSearchText(c); return words.every(w => t.includes(w)); })
    .sort((a, b) => (!ownedCard(a.id) - !ownedCard(b.id)) || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  if (!hits.length) return `<p class="cc-none">No cards match “${esc(q)}”.</p>`;
  const own = hits.filter(c => ownedCard(c.id)).length;
  return `<div class="cc-count">${hits.length} ${hits.length === 1 ? 'card' : 'cards'} · ${own} owned</div>
    <div class="col-grid cc-hits">${hits.map(c => `<div class="cc-hit${ownedCard(c.id) ? '' : ' off'}">${colTile(c)}<b>${esc(c.name)}</b><small${c.joker ? ' class="jr"' : ` style="color:${RARITY[c.rarity].color}"`}>${c.joker ? 'J' : RARITY[c.rarity].name}${c.hero && c.hero !== c.name ? ' · ' + esc(c.hero) : ' · ' + esc(setLabel(c.set))}</small></div>`).join('')}</div>`;
}
function colSearchUpdate(){
  const res = $('#ccRes'), main = $('#ccMain'); if (!res) return;
  // matches slide to their new spot, non-matches fade out, new matches fade in
  const hid = h => { const t = h.querySelector('[data-id],[data-cid]'); return t ? t.dataset.id || t.dataset.cid : ''; };
  const before = new Map();
  if (!S.reduceFx) res.querySelectorAll('.cc-hit').forEach(h => before.set(hid(h), { el:h, r:h.getBoundingClientRect() }));
  res.innerHTML = colQ ? colSearchHTML(colQ) : '';
  if (!S.reduceFx && colQ){
    const now = new Set();
    res.querySelectorAll('.cc-hit').forEach((h, i) => { const id = hid(h), b = before.get(id); now.add(id);
      if (b){ const r = h.getBoundingClientRect(), dx = b.r.left - r.left, dy = b.r.top - r.top; if (dx || dy) h.animate([{ transform:`translate(${dx}px,${dy}px)` }, { transform:'none' }], { duration:MOTION.norm, easing:MOTION.arrive }); }
      else h.animate([{ opacity:0, transform:'scale(.85)' }, { opacity:1, transform:'none' }], { duration:260, delay:before.size ? 120 : Math.min(i, 12) * 18, easing:'ease-out', fill:'backwards' }); });
    const rr2 = res.getBoundingClientRect();
    // only the ones you can see fade out, left where they were
    before.forEach((b, id) => { if (now.has(id) || b.r.bottom < 0 || b.r.top > innerHeight) return; const g = b.el;
      g.style.cssText = `position:absolute;left:${b.r.left - rr2.left}px;top:${b.r.top - rr2.top}px;width:${b.r.width}px;margin:0;pointer-events:none`;
      res.appendChild(g); g.animate([{ opacity:1, transform:'none' }, { opacity:0, transform:'scale(.85)' }], { duration:220, easing:'ease-in', fill:'forwards' }).onfinish = () => g.remove(); });
  }
  if (main) main.hidden = !!colQ;
  $('#ccClear').hidden = !colQ;
}

let colFilter = 'all', colGroup = 'all';

function initCollection(){
  // Category grid: hold + release toggles a big (2x2) card (S.big); hold + drag moves it (S.order[set]).
  // Poker, Promo, Joker, Realms keep hold = see the art.
  (function(){
    const TILE = '#panel .cc-bd .col-grid > .ct', idOf = t => t.dataset.id || t.dataset.cid;
    const setOf = g => { const m = g.closest('.cc-fold')?.querySelector('.cc-mid'); return m ? m.dataset.set : null; };
    let timer = 0, sx = 0, sy = 0, cur = null, fired = 0;
    const clearHold = () => { clearTimeout(timer); document.querySelectorAll('.ct.holding').forEach(x => x.classList.remove('holding')); };
    document.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('#panel .col-grid, #panel .sh-car')) e.preventDefault(); }, true);   // no picture ghost when dragging cards or swiping banners with a mouse
    document.addEventListener('pointerdown', e => {
      const t = e.target.closest(TILE); if (!t || e.button > 0) return;
      e.stopImmediatePropagation(); sx = e.clientX; sy = e.clientY; clearTimeout(timer);
      cur = { t, id:idOf(t), grid:t.parentNode, armed:false, drag:false, pid:e.pointerId };
      t.classList.add('holding');
      timer = setTimeout(() => { if (!cur) return; cur.armed = true; t.classList.remove('holding'); t.classList.add('armed'); try { t.setPointerCapture(cur.pid); } catch(_){} }, 380);
    }, true);
    function startDrag(e){
      const { t } = cur; cur.drag = true; t.classList.remove('armed'); t.classList.add('lifted');
      const r = t.getBoundingClientRect(), g = t.cloneNode(true); g.classList.remove('big', 'br', 'lifted', 'armed', 'holding'); g.classList.add('ghost');
      g.style.cssText = `position:fixed;left:0;top:0;width:${r.width}px;height:${r.height}px;z-index:90;pointer-events:none;margin:0;will-change:transform`;
      document.body.appendChild(g); cur.ghost = g; cur.dx = e.clientX - r.left; cur.dy = e.clientY - r.top; cur.last = 0;
    }
    // the other cards slide to their new places instead of jumping (FLIP)
    const flip = (grid, change) => {
      const kids = [...grid.children].filter(x => !x.classList.contains('ghost')), was = new Map(kids.map(x => [x, x.getBoundingClientRect()]));
      change();
      kids.forEach(x => { const a = was.get(x), b = x.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top; if (Math.abs(dx) + Math.abs(dy) > 1 && x !== cur.t) x.animate([{ transform:`translate(${dx}px,${dy}px)` }, { transform:'none' }], { duration:200, easing:MOTION.arrive }); });
    };
    document.addEventListener('pointermove', e => {
      if (!cur) return;
      if (!cur.armed){ if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10){ clearHold(); cur = null; } return; }
      e.preventDefault();
      if (!cur.drag){ if (Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return; startDrag(e); }
      cur.ghost.style.transform = `translate3d(${e.clientX - cur.dx}px,${e.clientY - cur.dy}px,0) scale(1.05)`;
      if (e.clientY < 110) scrollBy(0, -12); else if (e.clientY > innerHeight - 110) scrollBy(0, 12);   // near an edge: the page scrolls
      const t = performance.now(); if (t - cur.last < 140) return;   // let the cards finish sliding before the next move
      const grid = cur.grid, gr = grid.getBoundingClientRect(), isBig = cur.t.classList.contains('big');
      // a big card takes columns 2-3 or 1-2 depending on the pointer side
      if (isBig){ const rel = (e.clientX - gr.left) / gr.width, side = rel > .55 ? true : rel < .4 ? false : cur.t.classList.contains('br'); if (side !== cur.t.classList.contains('br')){ cur.last = t; flip(grid, () => cur.t.classList.toggle('br', side)); return; } }
      const over = document.elementsFromPoint(e.clientX, e.clientY).find(x => x !== cur.t && x.matches && x.matches('.ct') && x.parentNode === grid);
      let target = null, after = false;
      if (over){ const b = over.getBoundingClientRect(); target = over; after = e.clientX > b.left + b.width / 2 && e.clientY > b.top + b.height * .25; }
      else if (e.clientX >= gr.left && e.clientX <= gr.right && e.clientY >= gr.top - 10 && e.clientY <= gr.bottom + 10){   // empty space: next to the nearest card
        let bd = 1e9; [...grid.children].forEach(x => { if (x === cur.t || x.classList.contains('ghost')) return; const b = x.getBoundingClientRect(), d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)); if (d < bd){ bd = d; target = x; } });
        if (target){ const b = target.getBoundingClientRect(); after = e.clientY > b.bottom || (e.clientY > b.top && e.clientX > b.left + b.width / 2); }
      }
      if (!target) return;
      const ref = after ? target.nextSibling : target; if (ref === cur.t || (after && target.nextSibling === cur.t) || target.previousSibling === cur.t && !after) return;
      cur.last = t; flip(grid, () => target.parentNode.insertBefore(cur.t, ref));
    }, { capture:true, passive:false });
    const end = () => {
      clearHold(); if (!cur) return; const { t, id, drag, armed, ghost, grid } = cur; cur = null;
      t.classList.remove('armed', 'lifted'); if (ghost) ghost.remove();
      if (drag){
        const k = setOf(grid); if (k){ if (!S.order || typeof S.order !== 'object') S.order = {}; S.order[k] = [...grid.children].map(idOf).filter(Boolean); }
        if (t.classList.contains('big') && t.dataset.id){ if (!S.big || typeof S.big !== 'object') S.big = {}; S.big[id] = t.classList.contains('br') ? 2 : 1; }
        save();
        fired = performance.now();
      } else if (armed){
        fired = performance.now();
        if (t.dataset.id){ if (!S.big || typeof S.big !== 'object') S.big = {}; if (S.big[id]) delete S.big[id]; else S.big[id] = 1; save(); t.classList.toggle('big', !!S.big[id]); t.classList.remove('br'); t.classList.add('pop'); setTimeout(() => t.classList.remove('pop'), 400); }
      }
    };
    ['pointerup','pointercancel'].forEach(n => document.addEventListener(n, end, true));
    document.addEventListener('touchmove', e => { if (cur && cur.armed) e.preventDefault(); }, { passive:false, capture:true });   // a held finger must not scroll the page while a card moves
    document.addEventListener('click', e => { if (performance.now() - fired < 500 && e.target.closest(TILE)){ e.stopPropagation(); e.preventDefault(); } }, true);
    document.addEventListener('contextmenu', e => { if (e.target.closest(TILE)) e.preventDefault(); }, true);
  })();
  // hold a card tile: opens to the art; letting go shows the full view
  (function(){
    let timer = 0, sx = 0, sy = 0, on = false, quiet = 0;
    document.addEventListener('pointerdown', e => {
      const t = e.target.closest('#panel [data-act="inspect"]'); if (!t || t.matches('.cc-bd .col-grid > .ct')) return;   // (cards in the plain grids use hold = big / drag instead)
      sx = e.clientX; sy = e.clientY; clearTimeout(timer);
      timer = setTimeout(() => { on = true; quiet = performance.now(); inspectFrom = null; inspectCard(t.dataset.id, !!t.dataset.scene, !!t.dataset.land); $('#inspect').classList.add('art'); }, 350);
    });
    document.addEventListener('pointermove', e => { if (!on && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clearTimeout(timer); }, { passive:true });
    const up = () => { clearTimeout(timer); if (on){ on = false; quiet = performance.now(); $('#inspect').classList.remove('art'); } };
    ['pointerup','pointercancel'].forEach(t => document.addEventListener(t, up));
    // the tap that ends a hold must not close the view (or open it twice)
    document.addEventListener('click', e => { if (performance.now() - quiet < 450){ e.stopPropagation(); e.preventDefault(); } }, true);
    document.addEventListener('contextmenu', e => { if (e.target.closest('#panel [data-act="inspect"]')) e.preventDefault(); });
  })();
  // swipe the overview card sideways to change pack; vertical drags still scroll
  onFlick(document, { mainOnly:true, min:50, ratio:1.5, start: e => !!e.target.closest('#panel .cc-over'), onSwipe: dir => {
    const ids = ['all', ...COLLECTIONS.map(g => g.id)], i = (ids.indexOf(colGroup) + dir + ids.length) % ids.length; colSwitch(ids[i], dir);   // loops round
  } });
  $('#colSearchBtn').addEventListener('click', e => {
    e.stopPropagation();
    colSearch = !colSearch; if (!colSearch) colQ = '';
    $('#ccQ').value = colQ; $('#ccClear').hidden = !colQ;
    render();
    if (colSearch){ $('#ccQ').focus(); scrollTo({ top:0 }); }
  });
  // typing only redraws the results, so the keyboard stays open
  $('#ccQ').addEventListener('input', e => { colQ = e.target.value; colSearchUpdate(); });
  $('#ccClear').addEventListener('click', e => { e.stopPropagation(); colQ = ''; $('#ccQ').value = ''; colSearchUpdate(); $('#ccQ').focus(); });
}
