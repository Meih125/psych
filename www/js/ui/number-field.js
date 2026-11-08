/* Number inputs: digits only, caps, and the -/+ steppers. */
// − / + around a number box (rewards in the quest form)
function addStepper(inp, st){
  if (!inp || inp.closest('.stp')) return;
  const w = document.createElement('div'); w.className = 'stp';
  inp.parentNode.insertBefore(w, inp);
  const mk = d => { const b = document.createElement('button'); b.type = 'button'; b.textContent = d < 0 ? '−' : '+';
    b.addEventListener('click', () => { const k = st || 5; inp.value = Math.max(0, (Math.round((+inp.value || 0) / k) * k) + d * k); inp.dispatchEvent(new Event('input', { bubbles:true })); });
    return b; };
  w.append(mk(-1), inp, mk(1));
}

function initNumberField(){
  /* ---- Number fields: digits only (a dot where decimals make sense), never negative, never past the field's max ----
     Works for every number box, including ones drawn later. Typing, pasting and the phone keyboard all go through it. */
  (function(){
    const isNum = el => el && el.tagName === 'INPUT' && el.type === 'number';
    const decimalOK = el => el.inputMode === 'decimal' || /any|\./.test(el.getAttribute('step') || '');
    const maxOf = el => { const m = parseFloat(el.getAttribute('max')); return isFinite(m) ? m : decimalOK(el) ? VALUE_CAP : 99999; };
    const okText = (el, t) => decimalOK(el) ? /^[0-9]*[.,]?[0-9]*$/.test(t) : /^[0-9]*$/.test(t);
    document.addEventListener('keydown', e => {
      if (!isNum(e.target) || e.ctrlKey || e.metaKey || e.key.length !== 1) return;
      if (!/[0-9]/.test(e.key) && !(decimalOK(e.target) && /[.,]/.test(e.key))) e.preventDefault();
    }, true);
    document.addEventListener('beforeinput', e => {
      if (!isNum(e.target) || e.data == null) return;
      if (!okText(e.target, e.data)) e.preventDefault();
    }, true);
    document.addEventListener('paste', e => {
      if (!isNum(e.target)) return;
      const t = ((e.clipboardData && e.clipboardData.getData('text')) || '').trim().replace(/,/g, decimalOK(e.target) ? '.' : '');
      e.preventDefault();
      if (!t || !okText(e.target, t)) return;
      e.target.value = t; e.target.dispatchEvent(new Event('input', { bubbles:true }));
    }, true);
    document.addEventListener('wheel', e => { if (isNum(document.activeElement) && e.target === document.activeElement) e.preventDefault(); }, { passive:false });
    document.addEventListener('input', e => {
      const el = e.target; if (!isNum(el) || el.value === '') return;
      let v = parseFloat(el.value), fix = null;
      if (!isFinite(v)) fix = '';
      else if (v < 0) fix = String(Math.abs(v));
      else if (v > maxOf(el)) fix = String(maxOf(el));
      else if (!decimalOK(el) && v % 1) fix = String(Math.trunc(v));
      else if (/\.\d{3,}/.test(el.value)) fix = el.value.replace(/(\.\d\d)\d+/, '$1');
      if (fix !== null && fix !== el.value) el.value = fix;   // runs before the field's own handlers, so they see the fixed value
    }, true);
  })();
}
