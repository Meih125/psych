/* Small shared helpers: DOM lookup, escaping, number formatting, icons, reward chips, countdowns. */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NUMF = new Intl.NumberFormat(undefined, { maximumFractionDigits:2 });
const fmt = n => NUMF.format(Number(n));
const CORNERS = ['tl','tr','bl','br'].map(c => `<svg class="cn ${c}" viewBox="0 0 40 40"><use href="#i-corner"/></svg>`).join('');
const ico = (id, vb = '0 0 32 32') => `<svg viewBox="${vb}"><use href="#${id}"/></svg>`;
// equal XP and gold share one chip (gem + coin + one number); different amounts get one chip each
const rewBoth = n => `<span class="rw-both">${ico('i-gem')}${ico('i-coin')}<b>+${n}</b></span>`;
function rewPair(xp, gold, num = fmtShort){
  return +xp === +gold ? rewBoth(num(xp)) : `<span class="xp-r">${ico('i-gem')}+${num(xp)}</span><span class="gold-r">${ico('i-coin')}+${num(gold)}</span>`;
}
function rewardsHtml(xp, gold, extra = ''){
  return `<div class="rewards${+xp === +gold ? ' same' : ''}">${extra}${rewPair(xp, gold)}</div>`;
}
// the unit word after a number: 1 card, 2 cards (own plural for irregular words: pl(n, 'entry', 'entries'))
const pl = (n, one, many = one + 's') => n === 1 ? one : many;
const cd = (until, pre = '', post = '') => `<span class="cd" data-until="${until}" data-pre="${esc(pre)}" data-post="${esc(post)}">${esc(pre)}${fmtLeft(until - now())}${esc(post)}</span>`;
// under 10,000 in full (1,280); above, 2 decimals rounded down: 12.34k, 5.55M, 1.20B, 3.00T
function fmtShort(v){
  const a = Math.abs(v), u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']].find(([n]) => a >= n && a >= 1e4);
  return u ? (Math.floor(v / u[0] * 100) / 100).toFixed(2) + u[1] : fmt(v);
}
