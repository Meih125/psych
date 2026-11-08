/* Info (i) icons and their bubbles.
   Every (i) in the app is made by infoIcon() and opened through infoOpen(), so the icon, its open colour and
   the closing rules live here (look: css/ui/info.css). One bubble is open at a time.
   Bubble kinds (each keeps its own look):
   - inline: the bubble sits inside the icon's .info wrapper (Shop title, All packs, drop rates)
   - float:  a bubble added to <body> under the icon (streak bonus, Settings tips, quest form tips)
   - panel:  Earned today (quests/board.js) and the Den (den.js) draw their own bubble and register it here */

// The icon itself. `label` is what a screen reader says; `attrs` adds attributes (data-*).
function infoIcon(label, attrs = '', open = false){
  return `<span class="info-btn${open ? ' open' : ''}" role="button" tabindex="0" aria-label="${esc(label)}"${attrs ? ' ' + attrs : ''}>i</span>`;
}

// the open bubble: { icon, inside(el) -> bool, close(), float, onRender }
let infoCur = null;
function infoOpen(icon, opt){
  infoClose();
  icon.classList.add('open');
  infoCur = Object.assign({ icon, inside: el => icon.contains(el), close(){} }, opt);
}
function infoClose(){
  const c = infoCur; if (!c) return;
  infoCur = null; c.icon.classList.remove('open');
  try { c.close(); } catch(e){ console.error('info close', e); }
}
const infoIsOpen = icon => !!infoCur && infoCur.icon === icon;

// inline bubble: the wrapper (.info) gets .open and CSS shows its .info-pop
function infoToggleInline(wrap){
  const icon = wrap.querySelector('.info-btn'); if (!icon) return false;
  if (infoIsOpen(icon)){ infoClose(); return false; }
  infoOpen(icon, { inside: el => wrap.contains(el), close: () => wrap.classList.remove('open') });
  wrap.classList.add('open');
  return true;
}

// floating bubble under the icon: 'sk' = card from a <template> (streak, Settings), 'tip' = plain text (quest form)
let infoTip = null;   // the quest form's text bubble, made once
function infoToggleFloat(icon, kind, content){
  if (infoIsOpen(icon)){ infoClose(); return; }
  const r = icon.getBoundingClientRect();
  if (kind === 'tip'){
    const pop = infoTip, w = Math.min(280, innerWidth - 24);
    pop.textContent = content; pop.classList.add('open');
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left - 20)) + 'px';
    pop.style.top = (r.bottom + 8) + 'px';
    infoOpen(icon, { float: true, formTip: true, close: () => pop.classList.remove('open') });
    return;
  }
  const pop = document.createElement('div'); pop.id = 'skPop'; pop.className = 'info-pop sk-pop'; pop.dataset.for = 'on';
  pop.innerHTML = content;
  pop.style.top = (r.bottom + scrollY + 6) + 'px'; pop.style.left = Math.max(8, Math.min(innerWidth - 216, r.left - 2)) + 'px';
  document.body.appendChild(pop);
  const wrap = icon.closest('.info') || icon;
  infoOpen(icon, { float: true, onRender: true, inside: el => wrap.contains(el) || pop.contains(el), close: () => pop.remove() });
}
// a .sk-info wrapper holds its bubble in a <template>
const infoToggleTemplate = wrap => infoToggleFloat(wrap.querySelector('.info-btn'), 'sk', wrap.querySelector('template').innerHTML);
// render() redraws the panel, so a floating bubble anchored in it would point at nothing
function infoOnRender(){ if (infoCur && infoCur.onRender) infoClose(); }

// Streak bonus explained, each row with the flame you'd have by then
function streakInfo(){
  const row = (pct, txt, t) => `<div class="sk-row"><b style="--c:${tierCol(t)[0]}">${pct}</b><span>${txt}</span><span class="sk-fl">${flameSvg(t, 26, true)}</span></div>`;
  return `<div class="info sk-info" data-act="skinfo">${infoIcon('Streak bonus')}
    <template><div class="info-title">Streak bonus</div>${row('+10%', 'every 5', 1)}${row('+200%', 'at 100', 4)}${row('+250%', 'at 200', 5)}</template></div>`;
}
const tipInfo = text => `<div class="info sk-info">${infoIcon('Info')}<template><div class="tip-t">${esc(text)}</div></template></div>`;

// quest form: every <p class="help"> becomes an (i) after its field's label
function infoFormHints(){
  infoTip = document.createElement('div'); infoTip.className = 'cy-tip'; document.body.appendChild(infoTip);
  document.querySelectorAll('#form p.help').forEach(p => {
    if (p.id === 'kindHelp') return;
    const field = p.closest('.field');
    let host = field ? field.querySelector(':scope > label, :scope > .lbl, :scope > div > label:not(.cy-ico)') : null;
    if (!host){ let prev = p.previousElementSibling; while (prev && !host){ host = prev.querySelector('label:not(.cy-ico), .lbl'); prev = prev.previousElementSibling; } }
    if (!host) return;
    p.classList.add('cy-hint-src');
    let btn = host.querySelector('.info-btn');
    if (!btn){
      host.insertAdjacentHTML('beforeend', infoIcon('Info'));
      btn = host.lastElementChild; btn._src = [];
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        infoToggleFloat(btn, 'tip', btn._src.map(x => x.textContent.trim()).filter(Boolean).join('\n\n'));
      });
    }
    btn._src.push(p);
  });
}

function initInfo(){
  // a tap outside the open bubble (and its icon) closes it
  document.addEventListener('click', e => { if (infoCur && !infoCur.inside(e.target)) infoClose(); }, true);
  // floating bubbles close when the page scrolls under them (a form tip only when the form itself scrolls)
  document.addEventListener('scroll', e => { if (infoCur && infoCur.float && (!infoCur.formTip || (e.target.closest && e.target.closest('.sheet')))) infoClose(); }, true);
  // the (i) next to the Shop title sits outside the panel
  $('#boardTitle').addEventListener('click', e => { const el = e.target.closest('.info'); if (el) infoToggleInline(el); });
  // Settings and form tips: the host's data-tip (or fixed text) is the bubble
  const host = (el, html) => { if (!el) return; el.innerHTML = html;
    el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); infoToggleTemplate(el.querySelector('.sk-info')); }); };
  document.querySelectorAll('.tip-host').forEach(el => host(el, tipInfo(el.dataset.tip)));
  host($('#fResetInfo'), tipInfo('Off: Log as many attempts as you like, any time.'));
  host($('#fStreakInfo'), streakInfo());
}
