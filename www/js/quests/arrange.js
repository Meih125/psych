/* Arrange mode: drag tiles around their group. */
let dragScroll = null;
let arDrag = null;
// the grip dots drag at once; elsewhere on a tile a short hold starts the drag (swipes still scroll)
function arStart(item, cx, cy){
  const box = item.closest('.ar-grid'), r = item.getBoundingClientRect(), e = { clientX:cx, clientY:cy };
  const ph = document.createElement('div'); ph.className = 'ar-ph' + (item.classList.contains('w') ? ' w' : '');
  item.parentElement.insertBefore(ph, item);
  Object.assign(item.style, { position:'fixed', left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', height:r.height + 'px', zIndex:50, pointerEvents:'none' });
  item.classList.add('drag');
  arDrag = { item, box, ph, dx:e.clientX - r.left, dy:e.clientY - r.top, x:e.clientX, y:e.clientY };

  dragScroll = setInterval(() => { if (!arDrag) return; if (arDrag.y < 170) scrollBy(0, -10); else if (arDrag.y > innerHeight - 110) scrollBy(0, 10); else return; arMove(); }, 16);
}
function arMove(){
  const { item, box, dx, dy, x, y } = arDrag;
  item.style.left = (x - dx) + 'px'; item.style.top = (y - dy) + 'px';
  const hit = document.elementFromPoint(x, y), t = hit && hit.closest('[data-r]');
  const ok = t && t !== item && box.contains(t) && !t.classList.contains('pin') ? t : null;
  if (arDrag.hov !== ok){ arDrag.hov && arDrag.hov.classList.remove('hov'); ok && ok.classList.add('hov'); arDrag.hov = ok; }
}
function arEnd(){
  if (!arDrag) return;
  const { item, box, ph, hov } = arDrag; arDrag = null; clearInterval(dragScroll);
  if (hov){ const key = box.dataset.g, g = boardGroups().find(x => x.key === key);
    if (g) moveTile(key, g.list, item.dataset.id, +hov.dataset.r, +hov.dataset.c, hov.dataset.s); }
  ph.remove(); save(); const y = scrollY; render(); scrollTo(0, y);
}
/* Arrange: the board in outline. Drag the dots to move a quest inside its group; HALF / FULL sets its tile size.
   A bounty in "Due soon" is pinned (red, no dots). */
const KIND_COL = { standard:'#ff8a45', pair:'#5cabff', scaling:'#ff7a7a', counter:'#4dd0a0', record:'#a98bff', tally:'#ffc94a', steps:'#2ee6d6', target:'#2ee6d6', bounty:'#b6e85a', avoid:'#ff8fb1' };
function arrangeBoard(){
  qbMeasure();   // real tile heights, so "does it fit beside the List" is answered the way the board will draw it
  const kidsOf = (q, d = 1) => S.quests.filter(c => c.parent === q.id).flatMap(c => [{ q:c, d }, ...kidsOf(c, d + 1)]);   // follow-ups, one step in per level
  return `<div class="qb ar">${boardGroups().map(g => {
    const pinned = g.key === 'a-due', cells = [];
    rowCells(groupRows(g.key, g.list), !pinned).forEach(c => { cells.push(c); if (c.q) kidsOf(c.q).forEach(k => cells.push({ q:k.q, w:true, kid:k.d })); });
    // one outline tile. at = the spot it stands for: data-r (row), data-c (column), data-s (place in the column beside a List)
    const tile = (q, w, at, kid, tall) => {
      const p = parentOf(q), kind = (KIND_NAME[q.kind] || 'Quest').toUpperCase();
      const sub = pinned ? `${kind} · ${dueIn(q) < 0 ? 'OVERDUE' : dueIn(q) === 0 ? 'DUE TODAY' : 'DUE TOMORROW'}`
        : p ? `${kind} · AFTER ${esc(p.name).toUpperCase()}` : q.kind === 'target' ? `${kind} · ${fmt(q.need)}` : kind;
      const size = canHalf(q) ? `<span class="ar-sz"><button data-act="arsize" data-id="${q.id}" data-size="half" class="${w ? '' : 'on'}">HALF</button><button data-act="arsize" data-id="${q.id}" data-size="full" class="${w ? 'on' : ''}">FULL</button></span>`
        : `<span class="ar-al">ALWAYS FULL</span>`;
      return `<div class="item ar-t${w ? ' w' : ''}${pinned ? ' pin' : ''}${kid ? ' fol' : ''}${tall ? ' tall' : ''}" data-id="${q.id}"${kid ? '' : at} style="--kc:${KIND_COL[q.kind] || '#ff8a45'}${kid ? `;--fd:${Math.min(kid, 4)}` : ''}">
        <b class="ar-n">${esc(q.name)}</b>${pinned || p ? '' : '<span class="ar-grip" aria-label="Drag to move"></span>'}
        <div class="ar-ft"><span class="ar-k">${sub}</span>${pinned ? '' : size}</div></div>`;
    };
    const slot = (r, c, add, s) => `<div class="ar-slot${add ? ' add w' : ''}${s != null ? ' end' : ''}" data-r="${r}" data-c="${c}"${s != null ? ` data-s="${s}"` : ''}>${add || s != null ? '+' : ''}</div>`;
    return `<section class="qb-g${pinned ? ' due' : ''}"><div class="qb-gh"><b>${g.title}</b></div><div class="ar-grid" data-g="${g.key}">${cells.map(c => {
      if (c.gap) return slot(c.r, c.c, c.add);
      if (c.stk){   // a row built around a half List: two columns, each ends with a spot to drop more tiles into
        return `<div class="ar-stk">${c.cols.map((col, ci) => `<div class="ar-col">${col.map((q, i) => tile(q, false, ` data-r="${c.r}" data-c="${ci}" data-s="${i}"`, 0, isHalfList(q))).join('')}${!col.length || (col.length < STACK_MAX && colH(c.cols[1-ci].map(q => q.id)) - colH(col.map(q => q.id)) - STACK_GAP >= 53) ? slot(c.r, ci, false, col.length) : ''}</div>`).join('')}</div>`;
      }
      return tile(c.q, c.w, ` data-r="${c.r}" data-c="${c.w ? -1 : c.c}"`, c.kid);
    }).join('')}</div></section>`;
  }).join('')}</div>`;
}

function initArrange(){
  const tile = e => { if (!arranging || arDrag) return null; const item = e.target.closest('.ar-t'); return item && !item.classList.contains('pin') && item.querySelector('.ar-grip') ? item : null; };
  // the grip dots drag at once
  $('#panel').addEventListener('pointerdown', e => { const item = tile(e); if (item && e.target.closest('.ar-grip')){ e.preventDefault(); arStart(item, e.clientX, e.clientY); } });
  // anywhere else on the tile: a short hold first (a quick swipe still scrolls)
  onHold($('#panel'), { target:window, slop:8, swallow:false, ms: e => e.pointerType === 'mouse' ? 140 : 280,
    start: e => { const item = tile(e); return item && !e.target.closest('.ar-grip, button') ? item : null; },
    onHold: (item, e, x, y) => arStart(item, x, y) });
  // while dragging, the finger moves the tile, not the page
  window.addEventListener('touchmove', e => { if (arDrag && e.cancelable) e.preventDefault(); }, { passive:false });
  $('#panel').addEventListener('contextmenu', e => { if (arranging && e.target.closest('.ar-t')) e.preventDefault(); });
  window.addEventListener('pointermove', e => { if (!arDrag) return; arDrag.x = e.clientX; arDrag.y = e.clientY; arMove(); });
  window.addEventListener('pointerup', arEnd);
  window.addEventListener('pointercancel', arEnd);
}
