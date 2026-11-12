/* Card stars: markup for the star bar and the Collection level strip (levels in cards/sets.js, look in css/cards/stars.css).
   `lv` is the level 1-16: the five stars show it (LV 1 empty, then gold, red, purple filling one by one). */
const STAR_KIND = lv => { const n = lv - 1, a = []; for (let i = 0; i < 5; i++) a.push(n === 0 ? 'e' : n <= 5 ? (i < n ? 'g' : 'e') : n <= 10 ? (i < n - 5 ? 'r' : 'g') : (i < n - 10 ? 'p' : 'r')); return a; };
const starAt = lv => lv <= 6 ? lv - 2 : lv <= 11 ? lv - 7 : lv - 12;   // which of the five stars changes when a card reaches this level (0-4)
const starSvg = k => `<svg viewBox="0 0 24 24"><use href="#st-${k}"/></svg>`;
const STAR_SPK = [0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2; return `<i class="spk" style="--dx:${Math.round(Math.cos(a) * 18)};--dy:${Math.round(Math.sin(a) * 18)}"></i>`; }).join('');
// pop: 'all' (every star) or the index of the one star that pops; ignored with Reduce effects
function starBar(lv, o = {}){
  const ks = STAR_KIND(lv), pop = S.reduceFx ? null : o.pop;
  return `<span class="sbar ${lvColor(lv)}${o.size ? ' ' + o.size : ''}">${ks.map((k, i) => { const p = pop === 'all' || pop === i;
    return `<span class="sst ${k}${p ? ' pop' : ''}">${starSvg(k)}${p ? starSvg(k).replace('<svg ', '<svg class="fl" ') + '<i class="shock"></i>' + STAR_SPK : ''}</span>`; }).join('')}</span>`;
}
// the Collection mark: a framed star bar inside the bottom edge of a card (no number; look in css/cards/stars.css)
const lvStrip = (lv, x = '') => `<span class="lvs ${x}">${starBar(lv)}</span>`;
