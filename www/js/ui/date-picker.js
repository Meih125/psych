/* Calendar pop-up for due dates and start dates. */
/* ---- Date picker (bounty due date, avoid start) ---- */
function setDateField(id, t){
  t = startOfDay(t || now());
  $('#' + id).value = t;
  const btn = $('#' + id + 'Btn'); if (!btn) return;
  const d = Math.round((t - startOfDay()) / 864e5);
  btn.querySelector('span').textContent = new Date(t).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  btn.querySelector('small').textContent = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 0 ? `in ${d} days` : `${-d} days ago`;
}
var dpkState = null;
function openDatePicker(value, opt, done){
  const v = startOfDay(value || now()), d = new Date(v);
  dpkState = { y:d.getFullYear(), m:d.getMonth(), sel:v, min:opt.min ?? -Infinity, max:opt.max ?? Infinity, done, title:opt.title || 'Pick a date' };
  drawDatePicker(); $('#datePick').classList.add('open');
}
function drawDatePicker(){
  const st = dpkState, first = new Date(st.y, st.m, 1), lead = (first.getDay() + 6) % 7, n = new Date(st.y, st.m + 1, 0).getDate(), today = startOfDay();
  let cells = ['M','T','W','T','F','S','S'].map(x => `<span class="dk-dow">${x}</span>`).join('') + '<i></i>'.repeat(lead);
  for (let i = 1; i <= n; i++){
    const t = new Date(st.y, st.m, i).getTime(), off = t < st.min || t > st.max;
    cells += `<button type="button" class="dk-d${t === st.sel ? ' sel' : ''}${t === today ? ' td' : ''}"${off ? ' disabled' : ` data-t="${t}"`}>${i}</button>`;
  }
  const canPrev = new Date(st.y, st.m, 0).getTime() >= st.min, canNext = new Date(st.y, st.m + 1, 1).getTime() <= st.max;
  $('#dpk').innerHTML = `<div class="dk-t">${esc(st.title)}</div>
    <div class="dk-h"><button type="button" data-dm="-1"${canPrev ? '' : ' disabled'} aria-label="Previous month">‹</button><b>${first.toLocaleDateString(undefined, { month:'long', year:'numeric' })}</b><button type="button" data-dm="1"${canNext ? '' : ' disabled'} aria-label="Next month">›</button></div>
    <div class="dk-g">${cells}</div>
    <div class="dk-f"><button type="button" class="btn-plain" data-dtoday="1"${today < st.min || today > st.max ? ' disabled' : ''}>Today</button><button type="button" class="btn-plain" data-dclose="1">Cancel</button></div>`;
}

function initDatePicker(){
  $('#datePick').addEventListener('click', e => {
    e.stopPropagation();
    const st = dpkState; if (!st) return;
    const m = e.target.closest('[data-dm]'); if (m){ st.m += +m.dataset.dm; if (st.m < 0){ st.m = 11; st.y--; } if (st.m > 11){ st.m = 0; st.y++; } drawDatePicker(); return; }
    const dd = e.target.closest('[data-t]') || (e.target.closest('[data-dtoday]') && { dataset:{ t:startOfDay() } });
    if (dd){ st.done(+dd.dataset.t); $('#datePick').classList.remove('open'); return; }
    if (e.target.closest('[data-dclose]') || e.target.id === 'datePick') $('#datePick').classList.remove('open');
  });
  $('#fDueBtn').addEventListener('click', () => openDatePicker(+$('#fDue').value, { min:startOfDay(), title:'Due date' }, t => setDateField('fDue', t)));
  $('#fSinceBtn').addEventListener('click', () => openDatePicker(+$('#fSince').value, { max:startOfDay(), title:'Clean since' }, t => setDateField('fSince', t)));
}
