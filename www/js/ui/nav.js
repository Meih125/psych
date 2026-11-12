/* Tabs, swipe between tabs, back button, floating + button. */
const TAB_ORDER = ['quests', 'progress', 'inventory', 'collection', 'shop'];
// the new page fades in (opacity only: sliding heavy pages stuttered)
function pageSlide(d){
  if (!d || S.reduceFx) return;
  [$('#panel'), document.querySelector('.board-head')].filter(Boolean).forEach(el => el.animate([{ opacity:0 }, { opacity:1 }], { duration:140, easing:'ease-out' }));
}
/*    Order: card view → pack → confirm dialog → edit/settings sheet → arrange mode → other tab → exit (press twice). */
let lastBackPress = 0;
function handleBack(){
  if (window.PsychDen && PsychDen.back()) return;   // the Gambling Den (den.js): game -> Den -> closed
  if (lvShown){ lvShown.go(); return; }   // level-up screen: back = CONTINUE
  if ($('#inspect').classList.contains('open')) return closeInspect();
  if (opening){   // a finished pack (or the Open all summary) closes like its Done button; mid-reveal waits
    if (opening.done) return afterReveal();
    return;
  }
  if ($('#pack').classList.contains('dl')){ const pk = $('#pack'); if (pk.onclick) pk.onclick(); return; }   // daily reward: back = tap (open the card, then continue)
  if ($('#cvp')) return closeCover();
  if ($('#lvlPop').classList.contains('open')) return toggleLvlPop(false);
  if ($('#ask').classList.contains('open')) return answer(false);
  if ($('#pki')) return closePackInfo();   // after the buy dialog, which sits on top of it
  if ($('#modal').classList.contains('open')) return closeSheet();
  if ($('#wPick').classList.contains('open')) return $('#wPick').classList.remove('open');
  if ($('#widgets').classList.contains('open')) return closeWidgets();
  if ($('#pn').classList.contains('open')) return closePatchNotes();   // Settings > Patch notes sits on top of Settings
  if ($('#settings').classList.contains('open')) return closeSettings();
  if (arranging){ arranging = false; return render(); }
  if (S.tab !== 'quests'){ const from = TAB_ORDER.indexOf(S.tab); S.tab = 'quests'; save(); render(); window.scrollTo({ top:0 }); pageSlide(0 - from); return; }   // the page slides back the way it came
  if (now() - lastBackPress < 2000){
    const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (A) A.exitApp();
    return;
  }
  lastBackPress = now();
  showToast('Press back again to exit', false);
}
/* ---- Reduce effects (Settings, off by default): fewer sparks, no glow, no bloom ---- */
/* ---- Floating "Post a quest" (Quests tab): left or right corner (Settings > Left handed), hidden near the bottom ---- */
// hidden while scrolling, back 0.6 s after scrolling stops
var fabScroll = false, fabTimer = 0;
function updateFab(){
  const f = $('#fabAdd'), post = $('#postBtn');
  const near = post && post.getBoundingClientRect().top < innerHeight - 70;   // the + Post a quest button at the bottom is on screen
  f.hidden = S.tab !== 'quests' || arranging;
  f.classList.toggle('left', !!S.leftHand);
  f.classList.toggle('away', !f.hidden && (!!near || fabScroll));
}

function initNav(){
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    const from = TAB_ORDER.indexOf(S.tab);
    S.tab = b.dataset.tab; arranging = false; if (S.tab === 'progress') weekOffset = 0; save(); render(); window.scrollTo({ top:0 });
    pageSlide(TAB_ORDER.indexOf(S.tab) - from);
  }));
  // swipe the tab bar sideways to change tab (loops: past the last one comes the first)
  const bar = document.querySelector('.tabs');
  bar.style.touchAction = 'pan-y'; bar.style.userSelect = 'none';
  onFlick(bar, { mainOnly:true, untilDown:true, min:40, ratio:1.5, swallow:() => true, onSwipe: dir => {
    const n = TAB_ORDER.length, i = (TAB_ORDER.indexOf(S.tab) + dir + n) % n;
    document.querySelector(`.tab[data-tab="${TAB_ORDER[i]}"]`).click();
  } });
  $('#fabAdd').addEventListener('click', () => openSheet(null));
  addEventListener('scroll', () => {
    fabScroll = true; clearTimeout(fabTimer);
    fabTimer = setTimeout(() => { fabScroll = false; updateFab(); }, 600);
    updateFab();
  }, { passive:true });
  addEventListener('resize', updateFab);
}
