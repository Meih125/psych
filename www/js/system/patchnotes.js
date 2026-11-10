/* Patch notes screen: Settings > Patch notes. The notes come from patchnotes-data.js (PATCH_NOTES).
   pnBody() only builds HTML from data, so the in-game patch notes tool (tools/patchnotes.js) reuses it for its preview. */
const pnEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let pnImgSrc = f => 'img/notes/' + encodeURI(f);   // the tool swaps this for the pictures it carries inside its own file
const pnOpen = { v:new Set(), n:new Set() };         // versions and snippet cards that are unfolded
function pnMedia(n){
  const one = f => `<div class="pn-media"><img src="${pnImgSrc(f)}" alt=""></div>`;
  return (n.img ? one(n.img) : '<div class="pn-media noimg"><span>no snippet yet</span></div>') + (n.img2 ? `<div class="pn-sub">Result</div>${one(n.img2)}` : '');
}
const pnSteps = n => (n.how || []).length ? `<ol class="pn-how">${n.how.map(h => `<li>${pnEsc(h)}</li>`).join('')}</ol>` : '';
const pnLine = (n, id) => `<div class="pn-ln" data-pn-id="${id}"><i class="pn-kd ${n.k}"></i><span><b>${pnEsc(n.t)}</b>${n.d ? ' <em>' + pnEsc(n.d) + '</em>' : ''}</span></div>`;
const pnCard = (n, id) => `<div class="pn-fr${pnOpen.n.has(id) ? ' open' : ''}" data-pn-id="${id}"><button type="button" class="pn-fh" data-pn-fh><i class="pn-kd ${n.k}"></i><span><b>${pnEsc(n.t)}</b>${n.d ? `<small>${pnEsc(n.d)}</small>` : ''}</span><span class="pn-cv">›</span></button><div class="pn-fx"><div class="pn-in"><div class="pn-pad">${pnMedia(n)}${pnSteps(n)}</div></div></div></div>`;
function pnBody(V){
  if (!V.length) return '<p class="pn-empty">Nothing here yet.</p>';
  return V.map((v, vi) => {
    const cnt = k => v.notes.filter(n => n.k === k).length;
    let rows = '', run = '';
    const flush = () => { if (run){ rows += `<div class="pn-ls">${run}</div>`; run = ''; } };
    v.notes.forEach((n, i) => { if (n.snip){ flush(); rows += pnCard(n, v.v + '-' + i); } else run += pnLine(n, v.v + '-' + i); });
    flush();
    return `<div class="pn-vr${vi === 0 ? ' latest' : ''}${pnOpen.v.has(v.v) ? ' open' : ''}" data-pn-v="${pnEsc(v.v)}"><button type="button" class="pn-vh" data-pn-vh><div><div class="pn-vn">v${pnEsc(v.v)}${vi === 0 ? ' <span class="pn-pill">LATEST</span>' : ''}</div><span class="pn-vt">${pnEsc(v.tag)}</span><div class="pn-vd">${pnEsc(v.date)} · ${cnt('new')} new · ${cnt('chg')} changed · ${cnt('fix')} fixed</div></div><span class="pn-vc">›</span></button><div class="pn-vl"><div class="pn-in"><div class="pn-pad">${rows}</div></div></div></div>`;
  }).join('');
}
// tap a version to fold it, a snippet card to open its picture and steps
function pnClick(e){
  const vh = e.target.closest('[data-pn-vh]');
  if (vh){ const r = vh.parentElement, v = r.dataset.pnV; r.classList.toggle('open'); r.classList.contains('open') ? pnOpen.v.add(v) : pnOpen.v.delete(v); return true; }
  const fh = e.target.closest('[data-pn-fh]');
  if (fh){ const r = fh.parentElement, id = r.dataset.pnId; r.classList.toggle('open'); r.classList.contains('open') ? pnOpen.n.add(id) : pnOpen.n.delete(id); return true; }
  return false;
}
let pnScroll = 0;
function openPatchNotes(){
  pnOpen.v = new Set(PATCH_NOTES.length ? [PATCH_NOTES[0].v] : []); pnOpen.n.clear();   // the newest version starts open
  const sh = $('#pn').parentElement, b = $('#pnBody'); b.innerHTML = pnBody(PATCH_NOTES); b.scrollTop = 0;
  pnScroll = sh.scrollTop; sh.style.height = Math.max(sh.offsetHeight, Math.min(560, innerHeight * .92)) + 'px';   // the card keeps its size
  sh.classList.add('pn-on'); sh.scrollTop = 0; $('#pn').classList.add('open');
}
function closePatchNotes(){
  const sh = $('#pn').parentElement; if (!sh.classList.contains('pn-on')) return;
  $('#pn').classList.remove('open'); sh.classList.remove('pn-on'); sh.style.height = ''; sh.scrollTop = pnScroll;
}
if (document.getElementById('pn')){
  $('#pnRow').addEventListener('click', openPatchNotes);
  $('#pnBack').addEventListener('click', closePatchNotes);
  $('#pnBody').addEventListener('click', pnClick);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#pn').classList.contains('open')) closePatchNotes(); }, true);
}
