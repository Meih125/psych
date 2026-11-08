/* Reward pop-ups in the #pack overlay (daily login, birthday) and the shared "tap to continue" hints.
   Open: the card pops in (growing out of `from` when given), the amount sparkles; a tap runs onTap.
   Close: it shrinks away, the overlay clears, then `then()` pays out. popBusy blocks taps while it moves. */
const HINT = { next:'Tap to continue', open:'Tap to open', all:'Double-tap anywhere to reveal all' };
const hintHtml = (txt = HINT.next, cls = 'pk-hint') => `<div class="${cls}">${txt}</div>`;
let popBusy = false;
function popupOpen(html, { from = null, onTap } = {}){
  const pk = $('#pack');
  popBusy = true;
  pk.innerHTML = html; pk.classList.add('open', 'dl');
  const pop = pk.querySelector('.dl-pop');
  if (from){   // grow out of the button that opened it
    const r = pop.getBoundingClientRect(), dx = from.left + from.width / 2 - (r.left + r.width / 2), dy = from.top + from.height / 2 - (r.top + r.height / 2);
    pop.animate([{ transform:`translate(${dx}px,${dy}px) scale(.06)`, opacity:0 }, { transform:`translate(${dx * .1}px,${dy * .1}px) scale(1.04)`, opacity:1, offset:.7 }, { transform:'none', opacity:1 }],
      { duration:480, easing:'cubic-bezier(.2,.9,.3,1.1)' });
  } else pop.animate([{ transform:'scale(.7)', opacity:0 }, { transform:'scale(1.03)', opacity:1, offset:.7 }, { transform:'none', opacity:1 }], { duration:420, easing:'cubic-bezier(.2,.9,.3,1.1)' });
  setTimeout(() => { popBusy = false; const a = pk.querySelector('.dl-amt, .dl-card'); if (a) FX.burst(...rectMid(a.getBoundingClientRect()), .7); }, 420);
  pk.onclick = () => { if (!popBusy && onTap) onTap(); };
  return pop;
}
function popupClose(pop, then){
  popBusy = true;
  const pk = $('#pack');
  pop.animate([{ transform:'none', opacity:1 }, { transform:'scale(.85)', opacity:0 }], { duration:220, easing:'ease-in', fill:'forwards' });
  setTimeout(() => {
    pk.classList.remove('open', 'dl'); pk.innerHTML = ''; pk.onclick = null;
    try { then(); } finally { popBusy = false; }
  }, 200);
}
