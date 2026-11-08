/* Confirm dialog and the toast (with Undo). */
let toastTimer;
function showToast(text, canUndo){
  if (QUIET) return;
  // capitalise the first word after a colon: "Floss: Complete", "Submit Assignment: Claim #8 this week"
  $('#toastText').textContent = String(text).replace(/: (\p{Ll})/gu, (m, c) => ': ' + c.toUpperCase());
  $('#toastUndo').hidden = !canUndo;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, canUndo ? 3000 : 1600);   // short, like the mock; a bit longer when it has Undo
}
function hideToast(){ $('#toast').classList.remove('show'); }
let askResolve = null;
function ask(title, text, yes = 'Confirm', cls = 'btn-danger'){
  $('#ask .dialog').className = 'dialog'; $('#askArt').innerHTML = ''; $('#askYes').className = 'btn-plain ' + cls;
  $('#askTitle').textContent = title; $('#askText').textContent = text; $('#askYes').textContent = yes;
  $('#askNo').style.display = yes === 'OK' ? 'none' : '';
  $('#ask').classList.add('open');
  return new Promise(res => { askResolve = res; });
}
// buying a deck: its picture, the amount, the price with the coin icon and what's left after
function askBuy(it, q, cost){
  const p = ask(`Buy ${q} ${it.name}${q > 1 ? 's' : ''}?`, '', 'Buy');
  $('#ask .dialog').className = `dialog buy th-${it.deck}`;
  $('#askYes').className = 'btn-buy';
  $('#askArt').innerHTML = `<div class="ab-stack">${[0, 1, 2].map(() => `<img src="${deckOf(it).cover}" alt="">`).join('')}${q > 1 ? `<b>×${q}</b>` : ''}</div>`;
  $('#askText').innerHTML = `<span class="ab-price">${ico('i-coin')}${fmt(cost)}</span><span class="ab-left">${ico('i-coin')}${fmt(S.gold - cost)} left after</span>`;
  return p;
}
function answer(v){ $('#ask').classList.remove('open'); if (askResolve){ const r = askResolve; askResolve = null; r(v); } }

function initDialog(){
  $('#askYes').addEventListener('click', () => answer(true));
  $('#askNo').addEventListener('click', () => answer(false));
  $('#ask').addEventListener('click', e => { if (e.target.id === 'ask') answer(false); });
  // swipe the toast sideways to dismiss it (works with a finger or a mouse drag)
  { const t = $('#toast');
    onDrag(t, { axis:'free', capture:true,
      start: e => e.target.closest('button') ? null : { el:t, dx:0 },
      begin: () => { t.style.transition = 'none'; },
      move: (s, dx) => { s.dx = dx; t.style.transform = `translate(calc(-50% + ${dx}px),0)`; t.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / 220)); },
      end: ({ dx }) => {
      t.style.transition = '';
      if (Math.abs(dx) > 70){
        t.style.transform = `translate(calc(-50% + ${dx > 0 ? 420 : -420}px),0)`; t.style.opacity = '0';
        setTimeout(() => { hideToast(); t.style.transform = ''; t.style.opacity = ''; }, 220);
      } else { t.style.transform = ''; t.style.opacity = ''; }
    } });
    t.style.touchAction = 'pan-y';
  }
  $('#toastUndo').addEventListener('click', () => { const b = buyUndo; buyUndo = null; hideToast(); if (!b || packCount(b.id) < b.q) return; S.gold += b.cost; S.inv[b.id] = packCount(b.id) - b.q; renderHeader.tween = true; save(); render(); });
}
