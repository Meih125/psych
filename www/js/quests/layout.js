/* Where tiles sit on the Quests board. Each group's layout is saved in S.layout[groupKey] as rows:
     [id]            a full-width tile
     [idL, idR]      two half slots (either may be null = an empty spot)
     [idL, [ids]]    two columns, each one tile (id) or a stack of tiles ([ids]) one under the other. A row like this needs
                     a half List in it (a List with a column of half tiles beside it, or two Lists each with tiles under it)
   Quests not placed yet go at the end (halves pair up). q.size: 'full', 'half' (even alone), or unset (half, stretches alone). */

const canHalf = q => !q.parent && (q.kind === 'standard' || q.kind === 'scaling' || q.kind === 'counter' || q.kind === 'bounty' || q.kind === 'avoid' || q.kind === 'record' || q.kind === 'tally' || q.kind === 'pair' || (q.kind === 'target' && q.need <= 10) || isTracker(q)) && !S.quests.some(c => c.parent === q.id);
// Record, Tally and List stay full until they are set to HALF (older saves keep their look)
const HALF_OPT_IN = ['record', 'tally', 'pair'];
const isWide = q => !canHalf(q) || q.size === 'full' || (HALF_OPT_IN.includes(q.kind) && q.size !== 'half');
const isHalfList = q => !!q && q.kind === 'pair' && !isWide(q);
const STACK_MAX = 8, STACK_GAP = 10;

/* Tile heights, for deciding how many half tiles fit beside a List. They are measured on the real board
   (natural height, before any stretching) just before Arrange opens; a quest never drawn uses an estimate. */
const QB_H = { w:0, h:{} };
function qbMeasure(){
  const P = $('#panel'), items = P ? [...P.querySelectorAll('.qb-item[data-id]')] : [];
  if (!items.length) return;
  P.classList.add('qb-measure');   // CSS: nothing stretches while measuring
  const h = {}; items.forEach(it => { h[it.dataset.id] = Math.round((it.firstElementChild || it).offsetHeight); });
  P.classList.remove('qb-measure');
  QB_H.w = P.clientWidth; QB_H.h = h;
}
function estimateH(q){
  if (q.kind !== 'pair') return q.note ? 148 : 106;
  const lines = t => Math.min(2, Math.max(1, Math.ceil(String(t || '').length / 22)));
  return 60 + (q.note ? 30 : 0) + listKeys(q).reduce((n, k) => n + 28 + 17 * lines(itemOf(q, k).name), 0) + 40;
}
const tileH = q => (QB_H.w === ($('#panel') || {}).clientWidth && QB_H.h[q.id]) || estimateH(q);
const colIds = c => Array.isArray(c) ? c : c ? [c] : [];   // a row's column as a list of ids
const packCol = ids => ids.length > 1 ? ids : ids[0] || null;
const colH = ids => ids.length ? ids.reduce((n, id) => n + tileH(byId(id)), 0) + STACK_GAP * (ids.length - 1) : 0;
// a row of two columns built around a half List (see the top)
const isStackRow = row => row.length === 2 && row.some(c => colIds(c).some(id => isHalfList(byId(id))));
// can `add` go into the column `mine` (the other column is `other`)? The first tile of an empty column always can; the next ones
// if at least half of them fits in the space left under it before it is as tall as the other column
function stackFits(mine, other, add){
  if (!mine.length) return true;
  if (mine.length >= STACK_MAX) return false;
  return colH(other) - colH(mine) - STACK_GAP >= tileH(add) / 2;
}

function groupRows(key, list){
  const ids = new Set(list.map(q => q.id)), seen = new Set(), ok = id => id && ids.has(id) && !seen.has(id) ? (seen.add(id), id) : null;
  const out = [];
  const L = S.layout || {};   // the old Tally / Bounties groups' arrangement carries over into Others
  (L[key] || (key === 'z-other' ? [...(L['y-bounty'] || []), ...(L['z-tally'] || [])] : [])).forEach(r => {
    if (!Array.isArray(r)) return;
    if (r.length === 2 && (Array.isArray(r[0]) || Array.isArray(r[1]))){ stackRow(r, out, ids, seen); return; }
    const [a, b] = r.length === 1 ? [ok(r[0]), null] : [ok(r[0]), ok(r[1])];
    const qa = a && byId(a), qb = b && byId(b);
    if (r.length === 1){ if (a) out.push(isWide(qa) ? [a] : [a, null]); return; }
    if (qa && isWide(qa)){ out.push([a]); if (qb) out.push(isWide(qb) ? [b] : [null, b]); return; }
    if (qb && isWide(qb)){ if (qa) out.push([a, null]); out.push([b]); return; }
    if (a || b) out.push([a, b]);
  });
  let open = null;   // a row made just now with a free right slot
  list.filter(q => !seen.has(q.id)).forEach(q => {
    if (isWide(q)){ out.push([q.id]); open = null; }
    else if (open){ open[1] = q.id; open = null; }
    else { open = [q.id, null]; out.push(open); }
  });
  return out;
}
// a saved row with stacks. Without a half List in it (gone, now full, or it has follow-ups) the tiles fall back into ordinary rows, in place.
function stackRow(r, out, ids, seen){
  const mine = new Set();
  const cols = r.map(c => colIds(c).filter(id => ids.has(id) && !seen.has(id) && !mine.has(id) && !isWide(byId(id)) && mine.add(id)).slice(0, STACK_MAX));
  const all = cols.flat(); all.forEach(id => seen.add(id));
  if (all.some(id => isHalfList(byId(id)))){ out.push(cols.map(packCol)); return; }
  let open = null;
  all.forEach(id => { if (open){ open[1] = id; open = null; } else { open = [id, null]; out.push(open); } });
}

// the cells to draw, in order: a tile (full or half), an empty spot, or a List with its column ({ stk, a, ac, list })
function rowCells(rows, withGaps){
  const cells = [];
  rows.forEach((r, ri) => {
    if (r.length === 1){ cells.push({ q:byId(r[0]), w:true, r:ri, c:-1 }); return; }
    if (isStackRow(r)){ cells.push({ stk:true, r:ri, cols:r.map(c => colIds(c).map(id => byId(id)).filter(Boolean)) }); return; }
    const one = (r[0] ? 1 : 0) + (r[1] ? 1 : 0) === 1, lone = byId(r[0] || r[1]);
    if (one && lone.size !== 'half'){ cells.push({ q:lone, w:true, r:ri, c:r[0] ? 0 : 1 }); return; }   // never set to HALF: stretch
    r.forEach((id, c) => cells.push(id ? { q:byId(id), w:false, r:ri, c } : { gap:true, r:ri, c }));
  });
  if (withGaps) cells.push({ gap:true, add:true, r:rows.length, c:0 });
  return cells;
}
// the same cells as a flat list of tiles in reading order (widgets and the editor don't care about columns)
function flatCells(cells){
  return cells.flatMap(c => !c.stk ? [c] : c.cols.flat().map((q, i) => ({ q, w:false, r:c.r, c:i % 2 })));
}

// Move a quest to row tr, column tc (-1 = a row of its own); ts = its place in that column when the row has a half List.
// On a plain row a half dropped on a half swaps; so does a drop on a tile of another column in a List's row. On a List's row it goes into the column at ts (the end if no ts), if it fits.
function moveTile(key, list, id, tr, tc, ts){
  const copy = rs => rs.map(r => r.map(c => Array.isArray(c) ? c.slice() : c));
  const rows = copy(groupRows(key, list)), q = byId(id); if (!q) return;
  let sr = -1, sc = -1, si = -1;
  rows.forEach((r, i) => r.forEach((c, j) => { if (c === id){ sr = i; sc = j; si = -1; } else if (Array.isArray(c) && c.includes(id)){ sr = i; sc = j; si = c.indexOf(id); } }));
  tr = Math.max(0, Math.min(rows.length, Math.floor(+tr) || 0)); tc = [-1, 0, 1].includes(+tc) ? +tc : -1;   // only real spots
  ts = ts !== null && ts !== '' && Number.isInteger(+ts) && +ts >= 0 ? +ts : -1;
  if (sr < 0 || (sr === tr && sc === tc && si === ts)) return;
  const back = copy(rows);   // to undo when it doesn't fit
  // take it out of where it was (a column is shortened, a single spot is left empty)
  if (si >= 0) rows[sr][sc].splice(si, 1); else rows[sr][sc] = null;
  if (tr >= rows.length) rows.push([null, null]);
  const T = rows[tr];
  if (isWide(q)){ rows.splice(tr > sr ? tr + 1 : tr, 0, [id]); }
  else if (T.length === 1 || tc < 0){ rows.splice(tr > sr ? tr + 1 : tr, 0, [id, null]); }
  else if (isStackRow(T)){
    const mine = colIds(T[tc]).slice(), other = colIds(T[1 - tc]);
    if (sr === tr && sc === tc && si >= 0 && si < ts) ts--;   // it left a place above the one it was dropped on
    if (!(sr === tr && sc === tc) && ts >= 0 && ts < mine.length){   // dropped on a tile of another column: they trade places
      const occ = mine[ts]; mine[ts] = id; T[tc] = packCol(mine);
      if (si >= 0) rows[sr][sc].splice(si, 0, occ); else { rows[sr][sc] = occ; if (rows[sr].length === 1) rows[sr].push(null); }
      byId(occ).size = 'half';
    } else {
    if (!(sr === tr && sc === tc) && !stackFits(mine, other, q)){ back.forEach((r, i) => { rows[i] = r; }); return; }   // inside its own column nothing gets taller
    mine.splice(ts >= 0 ? Math.min(ts, mine.length) : mine.length, 0, id); T[tc] = packCol(mine);
    }
  }
  else if (Array.isArray(T[tc])){ rows.splice(tr + 1, 0, [id, null]); }   // a column whose List just left: the new row goes below
  else { const other = T[tc]; T[tc] = id; if (other){ if (si >= 0) rows[sr][sc].splice(si, 0, other); else rows[sr][sc] = other; } }
  // a column of one tile is just a tile; columns with no half List in the row fall apart into ordinary rows
  const done = [];
  rows.forEach(r => {
    const hadColumn = r.some(Array.isArray);
    r = r.map(c => Array.isArray(c) ? packCol(c) : c);
    if (hadColumn && !isStackRow(r)){ const m = r.flat().filter(Boolean); for (let i = 0; i < m.length; i += 2) done.push([m[i], m[i + 1] || null]); return; }
    done.push(r);
  });
  const placed = done.find(r => r.includes(id));
  if (placed && placed.length === 2 && !(placed[0] && placed[1])) q.size = 'half';   // put next to an empty spot on purpose: keep it half
  (S.layout ||= {})[key] = done.filter(r => r.some(c => Array.isArray(c) ? c.length : c));
}
