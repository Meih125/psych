/* Birthday pop-up. */
/*    Hard-coded days (month, day). The first time the app opens on one of them (once a year) a pop-up like the daily one
   comes up by itself: 3 of every pack on sale + 200 gold. S.bday = { y: the year it was taken }. Nothing is paid until
   "tap to continue" (so closing the app early just shows it again next time). */
const BDAYS = [[12, 17]];
const BD_GOLD = 200, BD_PACKS = 3;
let bdTimer = 0;
function bdToday(){ const d = new Date(now()); return BDAYS.some(([m, dd]) => d.getMonth() + 1 === m && d.getDate() === dd) ? d.getFullYear() : 0; }
function bdAuto(){
  const y = bdToday();
  if (!y || (S.bday && S.bday.y === y) || popBusy || opening || $('#pack').classList.contains('open')) return;
  bdOpen();
}
function bdOpen(){
  const pk = $('#pack'); if (pk.classList.contains('open')) return;
  const packs = SHOP;
  const its = packs.map(it => ({ cover:deckOf(it).cover, name:it.name.replace(/ Pack$/, ''), col:deckOf(it).glow.mid }));
  const face = (k, e) => k.q ? `<span class="c q ${e}"><i>?</i></span>` : `<span class="c ${e}" style="background-image:url(${k.cover})"></span>`;
  const pop = popupOpen(`<div class="dl-pop bd-pop"><div class="bd-rays"></div><div class="bd-cf">${Array.from({ length:22 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-duration:${3 + (i % 5) * .7}s;animation-delay:-${(i * .37) % 4}s;width:${5 + i % 4}px;background:${['#ffc94a', '#ffe9a0', '#c98a14', '#fff'][i % 4]}${i % 3 ? '' : ';border-radius:50%'}"></i>`).join('')}</div>
    <div class="dl-head"><b>Happy Birthday</b><small>A gift for you</small></div>
    <div class="bd-fl">${its.map((k, i) => `<div class="bd-it" style="--gc:${k.col}"><div class="bd-stk">${face(k, 'c1')}${face(k, 'c2')}${face(k, 'c3')}</div><span class="bd-nm">${esc(k.name)} ×${BD_PACKS}</span></div>`).join('')}</div>
    <div class="dl-amt"><svg viewBox="0 0 32 32"><use href="#i-coin"/></svg><b>${BD_GOLD}</b></div>${hintHtml(HINT.next, 'dl-hint')}</div>`, { onTap: () => bdClose(pop, packs) });
  const el = [...pop.querySelectorAll('.bd-it')], n = el.length;
  let cur = 0;
  const place = () => el.forEach((e, i) => { const d = (i - cur + n) % n; e.className = 'bd-it ' + (d === 0 ? 'c' : d === 1 ? 'r' : d === n - 1 ? 'l' : 'h'); });
  place(); clearInterval(bdTimer);
  bdTimer = setInterval(() => { cur = (cur + 1) % n; place(); }, 3000);
}
function bdClose(pop, packs){
  clearInterval(bdTimer);
  const from = pop.querySelector('.dl-amt').getBoundingClientRect(), y = new Date(now()).getFullYear();
  S.bday = { y };
  packs.forEach(it => { S.inv[it.id] = packCount(it.id) + BD_PACKS; });
  popupClose(pop, () => {
    earnTag = { k:'daily', n:'Daily reward', kind:'daily', part:'birthday' };
    grant({ xp:0, gold:BD_GOLD }, from);   // the coins fly to the purse, like the daily reward
    showToast('Birthday gift: ' + packs.map(it => `+${BD_PACKS} ${it.name.replace(/ Pack$/, '')}`).join(', '), false);
  });
}

function initBirthday(){
  { const P1 = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if (P1 && P1.addListener) P1.addListener('appStateChange', st => { if (st && st.isActive) setTimeout(bdAuto, 500); }); }
  setTimeout(bdAuto, 1200);
}
