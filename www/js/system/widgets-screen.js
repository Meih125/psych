/* Widgets screen: pick, place and preview home-screen widgets. */
/* ---- Widgets screen (the button next to the Quests title) ---- */
let wEdit = null;   // the widget being edited (a copy), or null for the list
function openWidgets(){ wEdit = null; renderWidgets(); $('#widgets').classList.add('open'); refreshPlaced(); }
function closeWidgets(){ $('#widgets').classList.remove('open'); $('#wPick').classList.remove('open'); }
// previews use the same data the phone gets, so they match the home screen
function wTileHTML(sl, half, tall, board){
  const btns = (sl.btn || []).map(b => `<span class="wt-b ${b.style}"${b.color ? ` style="--bc:${b.color}"` : ''}>${esc(b.label)}</span>`).join('');
  const orbs = sl.need ? `<span class="wt-orbs">${Array.from({ length:sl.need }, (_, i) => `<i class="${i < sl.hits ? 'on' : ''}${sl.hits >= sl.need ? ' gold' : ''}"></i>`).join('')}</span>` : '';
  const rew = sl.norew ? '' : `<span class="wt-rew"><span class="xp-r">${ico('i-gem')}${esc(sl.xp)}</span><span class="gold-r">${ico('i-coin')}${esc(sl.gold)}</span></span>`;
  const icon = `<span class="wt-ic" style="--kc:${sl.color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${qbIcons()[sl.kind] || qbIcons().standard}</svg></span>`;
  const st = `${sl.mult ? `<span class="wt-mult" style="color:${sl.streakColor}">${esc(sl.mult)}</span>` : ''}<span class="wt-st${/^0×/.test(sl.streak || '') ? ' z' : ''}">${esc(sl.streak || '')}</span>`;
  const clk = sl.due ? `<span class="wt-due">${CLOCK_SVG}${esc(sl.due)}</span>` : '';
  const inBar = !half && sl.pct != null && sl.sub, sub = sl.sub && !inBar ? `<span class="wt-sub">${esc(sl.sub)}</span>` : half ? clk : '', bar = sl.pct != null ? (inBar ? `<span class="wt-barrow"><span class="wt-bar"><i style="width:${sl.pct}%"></i></span><b>${esc(sl.sub)}</b></span>` : `<span class="wt-bar"><i style="width:${sl.pct}%"></i></span>`) : '';
  const segs = sl.segs != null ? `<span class="wt-segs">${Array.from({ length:sl.segMax || 7 }, (_, i) => `<i class="${i < sl.segs ? 'on' : ''}"></i>`).join('')}</span>` : '';
  if (half) return `<div class="wt h${sl.done ? ' done' : ''}${sl.urgent ? ' urgent' : ''}${board ? ' bd' : ''}">${board ? `<div class="wt-r1">${icon}<b class="wt-t">${esc(sl.name)}</b></div>` : `<div class="wt-r1">${icon}<span class="wt-gap"></span>${st}</div><b class="wt-t">${esc(sl.name)}</b>`}${sub}${bar}<span class="wt-fill"></span>${orbs ? `<div class="wt-r3 orb">${orbs}</div>` : ''}<div class="wt-r3">${(sl.btn || []).length >= 2 ? '' : rew}<span class="wt-gap"></span>${btns}</div></div>`;
  const li = h => `<div class="wt-li${h.done ? ' dn' : ''}"><i></i><b>${esc(h.label)}</b><span class="wt-rew"><span class="xp-r">${ico('i-gem')}${esc(h.xp)}</span><span class="gold-r">${ico('i-coin')}${esc(h.gold)}</span></span></div>`;
  const pair = sl.items ? `<div class="wt-list" style="--kc:${sl.color}">${(tall ? sl.items : sl.short).map(li).join('')}</div>` : '';
  if (board && sl.tap === 'tally' && sl.sub) return `<div class="wt f${sl.done ? ' done' : ''}${tall ? ' tall' : ''}"><div class="wt-r1">${icon}<b class="wt-t">${esc(sl.name)}</b>${btns}</div><span class="wt-fill"></span><div class="wt-subrow"><span class="wt-sub">${esc(sl.sub)}</span>${rew}<span class="wt-note">${esc(sl.note || '')}</span></div><span class="wt-fill"></span></div>`;
  return `<div class="wt f${sl.done ? ' done' : ''}${sl.urgent ? ' urgent' : ''}${tall ? ' tall' : ''}"><div class="wt-r1">${icon}<b class="wt-t">${esc(sl.name)}</b>${btns}</div><span class="wt-fill"></span>${sub}${bar}${segs}${pair}<span class="wt-fill"></span><div class="wt-r2">${rew}<span class="wt-note">${esc(sl.note || '').replace(/(\+\d+%)/, `<b style="color:${sl.color}">$1</b>`)}</span>${orbs}${clk}${board ? '' : st}</div></div>`;
}
// 4x4 preview (counts and ring computed like the phone)
const wTab = {};   // the tab shown in each 4x4 preview
const wLeft = ms => { const m = Math.max(0, Math.floor(ms / 6e4)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`; };
const wClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${pad2(Math.floor(s % 3600 / 60))}:${pad2(s % 60)}`; };
function wCount(g){ const sl = g.rows.flat().filter(x => x && x.counts); return [sl.filter(x => x.done).length + g.hidDone, sl.length + g.hidN]; }
// Paging for the 4x4 (keep in step with slimOk / rowHeight / paginate in PsychWidgetProvider.java)
const wPage = {};   // the page shown in each 4x4 preview
const wSlimOk = s => !!s && !s.bcard && s.kind !== 'scaling' && !s.half && !s.isHdr && !('need' in s) && !('needN' in s) && !('segs' in s) && !('pct' in s) && !s.items && !s.sub && (s.btn || []).length === 1;
function wRowH(row){
  const f = row.find(Boolean); if (!f) return 0;
  if (f.isHdr) return 27;
  if (row.length === 2){ let h = 0; row.forEach(s => { if (!s) return; h = Math.max(h, 68 + (s.need ? 18 : 0) + (s.sub || s.due ? 18 : 0) + (s.pct != null ? 11 : 0)); }); return h + 5; }
  if (f.bcard) return 90;
  if (wSlimOk(f)) return 48 + (f.due && !f.done ? 19 : 0);
  if (f.items) return 77 + 28 * f.items.length + 5;
  if (f.tap === 'tally' && f.sub) return 75;
  return 65 + (f.needN ? 0 : f.sub ? 18 : 0) + (f.pct != null ? (f.needN ? 20 : 38) : 0) + (f.segs != null ? 14 : 0) + 5;
}
function wPaginate(rows, avail){
  const pages = []; let cur = [], used = 0, hdr = null, real = 0;
  rows.forEach((r, i) => {
    if (!r.some(Boolean)) return;
    const isH = !!(r[0] && r[0].isHdr);
    let h = wRowH(r); if (isH && rows[i + 1]) h += wRowH(rows[i + 1]);
    if (real && used + h > avail){
      pages.push(cur); cur = []; used = 0; real = 0;
      if (!isH && hdr){ cur.push(hdr); used += wRowH(hdr); }   // a new page says which cycle it's in
    }
    if (isH) hdr = r; else real++;
    cur.push(r); used += wRowH(r);
  });
  if (cur.length || !pages.length) pages.push(cur);
  return pages;
}
// DUE SOON row: the Quests-page bounty card, CLAIM without the dot
function wBountyHTML(sl){
  const icon = `<span class="wt-ic" style="--kc:${sl.color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${qbIcons()[sl.kind] || qbIcons().standard}</svg></span>`;
  const b = (sl.btn || [])[0], btn = b ? `<span class="wt-b ${b.style}"${b.color ? ` style="--bc:${b.color}"` : ''}>${esc(b.label)}</span>` : '';
  const warn = sl.warn && !sl.done ? `<span class="bc-warn"><svg viewBox="0 0 24 24" fill="none" stroke="#ff6b4a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg></span>` : '';
  return `<div class="bc${sl.done ? ' done' : ''}"><div class="bc-hd">${icon}<div class="bc-nm"><b class="wt-t">${esc(sl.name)}</b><span class="bc-due">${esc(sl.dueOn || '')} · <span class="bc-left">${CLOCK_SVG}${esc(sl.due || '')}</span></span></div>${warn}</div>
    <div class="bc-ft"><span class="wt-rew"><span class="xp-r">${ico('i-gem')}${esc(sl.xp)}</span><span class="gold-r">${ico('i-coin')}${esc(sl.gold)}</span></span><span class="wt-gap"></span>${btn}</div></div>`;
}
function wSlimHTML(sl){
  const col = sl.color, icon = `<span class="wt-ic" style="--kc:${col}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${qbIcons()[sl.kind] || qbIcons().standard}</svg></span>`;
  const b = (sl.btn || [])[0], btn = b ? `<span class="wt-b ${b.style}"${b.color ? ` style="--bc:${b.color}"` : ''}>${esc(b.label)}</span>` : '';
  const urgent = sl.urgent && !sl.done, due = sl.due && !sl.done ? `<div class="ns-due${urgent ? ' red' : ''}">${CLOCK_SVG}${esc(sl.due)}</div>` : '';
  return `${due}<div class="ns${sl.done ? ' done' : ''}${urgent ? ' urgent' : ''}">${icon}<b class="wt-t">${esc(sl.name)}</b>${sl.norew ? '' : `<span class="wt-rew"><span class="xp-r">${ico('i-gem')}${esc(sl.xp)}</span><span class="gold-r">${ico('i-coin')}${esc(sl.gold)}</span></span>`}${btn}</div>`;
}
function wBoardHTML(w){
  const b = wBoard(), tabKey = b.groups.some(g => g.key === wTab[w.id]) ? wTab[w.id] : (b.groups[0] || {}).key, g = b.groups.find(x => x.key === tabKey);
  const tot = b.groups.filter(x => x.count).map(wCount).reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]);
  const r = 15, c = 2 * Math.PI * r, k = tot[1] ? tot[0] / tot[1] : 0, full = tot[1] > 0 && tot[0] >= tot[1];
  const ring = `<span class="wb-ring"><svg viewBox="0 0 38 38"><circle cx="19" cy="19" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="4"/><circle cx="19" cy="19" r="${r}" fill="none" stroke="${full ? '#3fd47a' : '#ff6b1a'}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c * k).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 19 19)"/></svg><b>${tot[0]}/${tot[1]}</b></span>`;
  const clock = `<span class="wb-clock">${ico('i-hourglass', '0 0 16 16')}`, st = b.steps;
  const sum = `<div class="wb-sum">${ring}<div class="wb-st">
    ${st ? `<div class="wb-l"><span>Steps</span><b>${esc(st.text)}</b></div><span class="wb-bar"><i style="width:${st.pct}%"></i></span>` : ''}
    <div class="wb-ft"><span class="wb-tm">${clock}${wClock(b.reset - now())}</span>${st ? `<small class="${st.syncWarn ? 'warn' : ''}">${esc(st.sync)}</small>` : ''}</span>
    ${st && (st.btn || []).length ? `<span class="wt-b cy">CLAIM</span>` : ''}</div></div></div>`;
  const tabs = `<div class="wb-tabs">${b.groups.map(x => { return `<button type="button" class="${x.key === tabKey ? 'on' : ''}${x.red ? ' red' : ''}" data-wtab="${x.key}" data-wid="${w.id}"><b>${esc(x.tab)}</b></button>`; }).join('')}</div>`;
  const leftOf = (ends, time) => ends > now() ? wLeft(ends - now()) : time || '';   // days / hours / minutes, no seconds, like the phone
  const ghLabel = !g ? '' : g.key === 'due' ? '// DUE SOON' : g.key === 'daily' ? '// RESETS IN' : g.key === 'others' ? '// OTHERS' : '';
  const gh = g && ghLabel ? `<div class="wb-gh${g.key === 'due' ? ' red' : ''}"><span>${ghLabel}</span>${g.key === 'daily' && g.ends ? `<span class="wb-gh-time">${clock}${wLeft(g.ends - now())}</span></span>` : ''}</div>` : '';
  const av = ghLabel ? 312 : 336, all1 = wPaginate(g ? g.rows : [], av + 40), pages = all1.length === 1 ? all1 : wPaginate(g ? g.rows : [], av);   // one page needs no pager, so it gets that room too
  if (wPage[w.id + ':' + tabKey] == null || wPage[w.id + ':' + tabKey] >= pages.length) wPage[w.id + ':' + tabKey] = Math.min(wPage[w.id + ':' + tabKey] || 0, pages.length - 1);
  const pg = wPage[w.id + ':' + tabKey] || 0;
  const rowHTML = row => row[0] && row[0].isHdr
    ? `<div class="wb-gh sub"><span>${esc(row[0].title)}</span>${leftOf(row[0].ends, row[0].time) ? `<span class="wb-gh-time">${clock}${esc(leftOf(row[0].ends, row[0].time))}</span></span>` : ''}</div>`
    : row.length === 1 && row[0] && row[0].bcard ? wBountyHTML(row[0])
    : row.length === 1 && wSlimOk(row[0]) ? wSlimHTML(row[0])
    : `<div class="wv-row${row.length === 2 ? ' two' : ''}${row[0] && row[0].items && !row[0].half ? ' lst' : ''}">${row.map(sl => `<div class="wv-cell">${sl ? wTileHTML(sl, sl.half, true, true) : ''}</div>`).join('')}</div>`;
  const list = g && g.rows.length ? pages[pg].map(rowHTML).join('') : '<p class="wb-none">No quests yet</p>';
  const pager = pages.length > 1 ? `<div class="wb-pgr"><button type="button" data-wpage="-1" data-wid="${w.id}" data-wkey="${tabKey}" data-wn="${pages.length}">‹</button><span class="dots">${pages.map((_, i) => `<i class="${i === pg ? 'on' : ''}"></i>`).join('')}</span><button type="button" data-wpage="1" data-wid="${w.id}" data-wkey="${tabKey}" data-wn="${pages.length}">›</button></div>` : '';
  return `<div class="wb"><div class="wb-top"><b class="wb-logo">PSYCH</b><span class="wb-lv">Lv ${b.lv}</span><span class="wb-xp"><i style="width:${b.xpPct}%"></i></span><span class="gold-r">${ico('i-coin')}${esc(b.gold)}</span></div>
    ${sum}${b.groups.length ? tabs : ''}${gh}<div class="wb-list wv">${list}</div>${pager}</div>`;
}
function wPreview(w, edit){
  if (isBoardW(w)) return wBoardHTML(w);
  const two = wWidth(w) === 2;
  const spot = (id, r, c, half) => { const sl = wSlot(id && byId(id));
    const inner = sl ? wTileHTML(sl, half, false) : `<div class="wv-add">${edit ? '+' : ''}</div>`;
    return edit ? `<div class="wv-spot${sl ? '' : ' empty'}" data-wslot="${r},${c}">${inner}</div>` : `<div class="wv-cell">${inner}</div>`; };
  const tall = false;
  return `<div class="wv${two ? ' wv-narrow' : ''}">${w.rows.map((row, ri) => `<div class="wv-row${row.length === 2 ? ' two' : ''}${tall ? ' tall' : ''}">${row.length === 2
    ? spot(row[0], ri, 0, true) + spot(row[1], ri, 1, true) : spot(row[0], ri, 0, two)}</div>`).join('')}</div>`;
}
let wPlaced = null;   // ids of widgets that are on the home screen (asked from the phone)
async function refreshPlaced(){
  const P = widgetPlugin(); if (!P || !P.placed) return;
  try { const r = await P.placed(); const list = String((r && r.ids) || '').split(',').filter(Boolean);
    const set = new Set(list.filter(x => !x.startsWith('size:')));
    list.filter(x => x.startsWith('size:')).forEach(x => { const w = (S.widgets || []).find(w => w.size === x.slice(5)); if (w) set.add(w.id); });
    wPlaced = set; if (!wEdit && $('#widgets').classList.contains('open')) renderWidgets();
  } catch(e){}
}
const wShapeDraw = t => `<span class="w-shape${t.w === 2 ? ' narrow' : ''}${t.board ? ' board' : ''}">${t.draw.map(r => `<span class="w-srow">${r[0].map(k => `<i class="${k}"></i>`).join('')}</span>`).join('')}</span>`;
function renderWidgets(){
  const box = $('#wBody');
  if (!wEdit){
    const ws = S.widgets || [];
    box.innerHTML = `<h2>Widgets</h2>
      <p class="help">Your widgets as they look on the home screen. Tap one to change it.</p>
      <div class="w-lab">Yours</div>
      <div class="w-wall">${ws.map(w => `<div class="w-card" role="button" tabindex="0" data-wedit="${w.id}">${wPreview(w, false)}
        <span class="w-cap"><span>${esc(w.name || 'Widget')} · ${wShapeOf(w).name}</span>${wPlaced ? (wPlaced.has(w.id) ? '<em class="on">On home screen</em>' : '<em>Not placed</em>') : ''}</span></div>`).join('')}
        <button class="w-newbox" data-wnew="1">+ New widget</button></div>
      <div class="actions"><button type="button" class="btn-plain" data-wclose="1">Close</button></div>`;
    return;
  }
  const w = wEdit, cur = wShapeOf(w).key, editing = (S.widgets || []).some(x => x.id === w.id);
  box.innerHTML = `<h2>${editing ? 'Edit widget' : 'New widget'}</h2>
    <p class="help">${isBoardW(w) ? 'Pick a size. 4×4 shows the whole Quests page: a tab for each group, and it scrolls.' : 'Pick a size, then tap a spot on the preview to put a quest in it.'}</p>
    <div class="w-lab">Name</div><input class="w-name" id="wName" maxlength="24" value="${esc(w.name || '')}" placeholder="Morning, Gym…">
    <div class="w-lab">Size</div>
    <div class="w-sizes">${W_SHAPES.map(t => `<button class="w-sc${cur === t.key ? ' on' : ''}" data-wshape="${t.key}">${wShapeDraw(t)}<b>${t.name}</b><small>${t.sub}</small></button>`).join('')}</div>
    <div class="w-lab">${isBoardW(w) ? 'Preview' : 'Tap a spot'}</div><div class="w-prev">${wPreview(w, true)}</div>
    <div class="w-acts"><button class="w-place" data-wsave="place">Save &amp; place on home screen</button>
      <button class="w-save" data-wsave="1">Save</button>
      ${editing ? '<button class="w-del" data-wdel="1">Delete</button>' : ''}
      <button class="btn-plain" data-wback="1">Back</button></div>`;
}
// change the shape, keeping the quests that still fit (full spots first, then half spots)
function wReshape(w, key){
  const t = W_SHAPES.find(x => x.key === key); if (!t) return;
  const keep = w.rows.flat().filter(id => id && byId(id));
  w.size = t.size; w.rows = t.rows.map(r => r.map(() => null));
  w.rows.forEach((r, ri) => r.forEach((_, ci) => {
    const half = wHalfSpot(w, ri), i = keep.findIndex(id => wFits(byId(id), half));
    if (i >= 0){ r[ci] = keep[i]; keep.splice(i, 1); }
  }));
}
function wPickOpen(r, c){
  const used = new Set(wEdit.rows.flat().filter(Boolean)), half = wHalfSpot(wEdit, r);
  const list = S.quests.filter(q => !used.has(q.id) && wFits(q, half));
  $('#wPick').innerHTML = `<div class="w-pick"><b>${half ? 'Choose a half-size quest' : 'Choose a quest'}</b>${list.map(q => `<button data-wq="${q.id}" style="--kc:${KIND_COL[q.kind]}"><span>${esc(q.name)}</span><small>${(KIND_NAME[q.kind] || 'Quest').toUpperCase()}</small></button>`).join('') || '<p class="help">No more quests fit here.</p>'}
    <button data-wq="" class="w-clear">Empty this spot</button><button class="btn-plain" data-wpclose="1">Cancel</button></div>`;
  $('#wPick').dataset.slot = r + ',' + c; $('#wPick').classList.add('open');
}

function initWidgetsScreen(){
  $('#widgets').addEventListener('click', async e => {
    if (e.target.id === 'widgets' || e.target.closest('[data-wclose]')) return closeWidgets();
    const t = e.target.closest('[data-wtab], [data-wslot], [data-wedit], button'); if (!t) return;
    if (t.dataset.wtab){ wTab[t.dataset.wid] = t.dataset.wtab; wPage[t.dataset.wid + ':' + t.dataset.wtab] = 0; return renderWidgets(); }   // switch tabs in a 4x4 preview
    if (t.dataset.wpage){ const k = t.dataset.wid + ':' + t.dataset.wkey, n = +t.dataset.wn || 99, d = +t.dataset.wpage; wPage[k] = d > 0 ? ((wPage[k] || 0) + 1 >= n ? 0 : (wPage[k] || 0) + 1) : Math.max(0, (wPage[k] || 0) - 1); return renderWidgets(); }
    const keepName = () => { const n = $('#wName'); if (n && wEdit) wEdit.name = n.value.trim().slice(0, 24); };
    if (t.dataset.wnew){ wEdit = { id:uid(), name:'', size:'4x1', rows:[[null]] }; return renderWidgets(); }
    if (t.dataset.wedit){ const w = (S.widgets || []).find(x => x.id === t.dataset.wedit); if (w){ wEdit = JSON.parse(JSON.stringify(w)); renderWidgets(); } return; }
    if (t.dataset.wback){ wEdit = null; return renderWidgets(); }
    if (t.dataset.wshape){ keepName(); wReshape(wEdit, t.dataset.wshape); return renderWidgets(); }
    if (t.dataset.wslot){ keepName(); const [r, c] = t.dataset.wslot.split(',').map(Number); return wPickOpen(r, c); }
    if (t.dataset.wdel){ if (!await ask('Delete this widget?', 'It disappears from your home screen too.', 'Delete')) return;
      S.widgets = (S.widgets || []).filter(x => x.id !== wEdit.id); save(); wEdit = null; return renderWidgets(); }
    if (t.dataset.wsave){
      keepName();
      if (!isBoardW(wEdit) && !wEdit.rows.flat().some(Boolean)){ showToast('Add at least one quest', false); return; }
      S.widgets ||= []; const i = S.widgets.findIndex(x => x.id === wEdit.id);
      if (i >= 0) S.widgets[i] = wEdit; else S.widgets.push(wEdit);
      save();
      const P = widgetPlugin(), placed = wEdit;
      wEdit = null; renderWidgets();
      if (t.dataset.wsave !== 'place') return showToast('Widget saved', false);
      if (!P) return inPhoneApp()
        ? ask('Widget part missing', 'This build of the app doesn’t include the widget code. On the PC run npm run widget, then npm run sync, and build the APK again.', 'OK')
        : ask('Saved', 'Placing on the home screen works in the phone app. Open this widget there and tap Save & place.', 'OK');
      try { await P.update({ data:JSON.stringify(widgetSnapshot()) }); const r = await P.pin({ size:placed.size, id:placed.id });
        setTimeout(refreshPlaced, 4000);
        if (!(r && r.pinned)) await ask('Add it from the home screen', 'Your launcher doesn’t let apps place widgets. Long-press an empty spot on the home screen, tap Widgets, find Psych, and drag this size in.', 'OK');
      } catch(err){ showToast('Couldn’t place the widget', false); }
    }
  });
  $('#wPick').addEventListener('click', e => {
    if (e.target.id === 'wPick' || e.target.closest('[data-wpclose]')) return $('#wPick').classList.remove('open');
    const b = e.target.closest('[data-wq]'); if (!b) return;
    const [r, c] = $('#wPick').dataset.slot.split(',').map(Number);
    wEdit.rows[r][c] = b.dataset.wq || null;
    $('#wPick').classList.remove('open'); renderWidgets();
  });
  $('#wBtn').addEventListener('click', openWidgets);
  // in Arrange the same icon saves and goes back to the quests
  $('#arBtn').addEventListener('click', () => { arranging = !arranging; save(); render(); window.scrollTo({ top:0 }); });
  // the navigation bar stays visible: Android 15+ draws under it, so pages pad with --safe-area-inset-* and a black strip sits behind it
  { const P0 = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if (P0 && P0.addListener){ P0.addListener('resume', () => applyWidgetActions()); P0.addListener('appStateChange', st => { if (st && st.isActive) applyWidgetActions(); }); } }
  setTimeout(() => { applyWidgetActions(); pushWidgets(true); }, 600);
}
