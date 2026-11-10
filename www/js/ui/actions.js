/* Tap handling for everything inside the panel (data-act). */

function initActions(){
  $('#panel').addEventListener('click', e => {
    if (e.target.closest('#postBtn')) return openSheet(null);
    if (e.target.closest('#arrangeBtn')){ arranging = false; render(); window.scrollTo({ top:0 }); return; }
    if (arranging){
      const sz = e.target.closest('[data-act="arsize"]');
      if (sz){ const q = byId(sz.dataset.id); if (q){ q.size = sz.dataset.size === 'full' ? 'full' : 'half'; save(); const y = scrollY; render(); scrollTo(0, y); } }
      return;
    }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, rect = el.getBoundingClientRect();
    if (act === 'upget'){ openUpdate(); return; }
    if (act === 'upclose'){ if (S.update){ S.update.dismissed = S.update.latest; save(); } render(); return; }
    if (act === 'fold'){ const q = byId(el.dataset.id); if (!q) return; S.folded ||= {}; S.folded[q.id] = { open:folded(q), day:dayKey() }; save(); const y = scrollY; render(); scrollTo(0, y); return; }
    if (act === 'stepsexact'){ stepsExact = !stepsExact; render(); return; }
    if (act === 'distunit'){ S.distUnit = S.distUnit === 'mi' ? 'km' : 'mi'; save(); render(); return; }
    if (act === 'pv'){ S.pview = el.dataset.pv; monthOffset = 0; selDay = null; save(); render(); return; }
    if (act === 'mo-prev'){ monthOffset++; selDay = null; render(); return; }
    if (act === 'mo-next'){ monthOffset = Math.max(0, monthOffset - 1); selDay = null; render(); return; }
    if (act === 'hday'){ if (el.classList.contains('fut') || el.classList.contains('pre')) return; selDay = selDay === el.dataset.day ? null : el.dataset.day; render(); return; }
    if (act === 'wk-prev'){ weekOffset++; render(); return; }
    if (act === 'wk-next'){ weekOffset = Math.max(0, weekOffset - 1); render(); return; }
    if (act === 'progress'){ S.tab = 'progress'; weekOffset = 0; save(); render(); window.scrollTo({ top:0 }); return; }
    if (act === 'info'){ if (infoToggleInline(el)) return; }
    if (act === 'packinfo'){ openPackInfo(el.dataset.item, el); return; }
    if (act === 'qty'){ changeQty(el.dataset.item, +el.dataset.d); return; }
    if (act === 'buy'){ tryBuy(el.dataset.item, el); return; }
    if (act === 'mkfold'){ mktFold(el.closest('.mkt')); return; }
    if (act === 'mkbuy'){ mktBuy(+el.dataset.i, el); return; }
    if (act === 'mkfz'){ mktFreeze(+el.dataset.i); return; }
    if (act === 'mkrr'){ mktReroll(el); return; }
    if (act === 'useitem'){ useItem(el.dataset.item); return; }
    if (act === 'inspect'){ inspectFrom = el; inspectCard(el.dataset.id, !!el.dataset.scene, !!el.dataset.land); return; }
    if (act === 'setclaim'){ claimSet(el.dataset.set, el); return; }
    if (act === 'cover'){ openCover(el.dataset.set); return; }
    if (act === 'colg'){ if (colGroup === el.dataset.g) return; colSwitch(el.dataset.g); return; }
    if (act === 'colf'){ colFilter = el.dataset.r; render(); return; }
    if (act === 'colset'){ const k = el.dataset.set, i = colSets.indexOf(k); if (i < 0) colSets.push(k); else colSets.splice(i, 1); const y = scrollY, was = colSnap(); render(); scrollTo(0, y); colMorph(was); return; }
    if (act === 'pzview'){ pzGrid = !pzGrid; const y = scrollY; render(); scrollTo(0, y); return; }
    if (act === 'colfold'){ const k = el.dataset.set, opening = colOpen[k] === false, sec = el.closest('.cc-fold'), bd = sec && sec.querySelector('.cc-bd');
      const apply = () => { colOpen[k] = opening; S.colOpen = Object.fromEntries(Object.entries(colOpen).filter(([, v]) => v === false)); save(); const y = scrollY; render(); scrollTo(0, y); };
      if (S.reduceFx) return apply();
      if (!opening && bd){   // closing: the cards ease shut first, then the page redraws
        if (sec.dataset.anim) return; sec.dataset.anim = 1; bd.style.overflow = 'hidden';
        bd.animate([{ height:bd.offsetHeight + 'px', opacity:1 }, { height:'0px', opacity:0, paddingTop:'0px', paddingBottom:'0px' }], { duration:280, easing:MOTION.leave, fill:'forwards' }).onfinish = apply;
        return;
      }
      apply();   // opening: draw it open, then ease the cards open from nothing
      const s2 = [...document.querySelectorAll('.cc-mid')].find(m => m.dataset.set === k), b2 = s2 && s2.closest('.cc-fold').querySelector('.cc-bd');
      if (b2){ const h = b2.offsetHeight; b2.style.overflow = 'hidden'; b2.animate([{ height:'0px', opacity:0 }, { height:h + 'px', opacity:1 }], { duration:340, easing:MOTION.arrive }).onfinish = () => { b2.style.overflow = ''; }; }
      return; }
    if (act === 'opensettings'){ openSettings(); return; }
    if (act === 'earn'){ earnToggle(!earnOpen); return; }
    if (act === 'earnpop') return;
    if (act === 'skinfo'){ infoToggleTemplate(el); return; }
    if (act === 'autoslip' && el.dataset.q){ const q = byId(el.dataset.q); if (q) autoSlip(q, +el.dataset.t); return; }
    if (act === 'bkpick' && el.dataset.q){ const id = el.dataset.q + '|' + selDay, st = bkSel[id]; if (st){ st.has(el.dataset.k) ? st.delete(el.dataset.k) : st.add(el.dataset.k); render(); } return; }
    if (act === 'undoback' && el.dataset.q){ const q = byId(el.dataset.q); if (q) undoBack(q, +el.dataset.t, +el.dataset.at, el.dataset.w); return; }
    if (act === 'backclaimlist' && el.dataset.q){ const q = byId(el.dataset.q); if (q) backClaimList(q, el.dataset.day); return; }
    if (act === 'backclaim' && el.dataset.q){ const q = byId(el.dataset.q); if (q) backClaim(q, el.dataset.day); return; }
    if (act === 'unslip' && el.dataset.q){ const q = byId(el.dataset.q); if (q) undoSlip(q); return; }
    if (act === 'lastundo'){ const q = byId(el.dataset.q); if (q) undoLast(q); return; }
    if (act === 'dayundo'){ const q = byId(el.dataset.q); if (q) undoDay(q, el.dataset.day); return; }
    if (act === 'hxundo'){ const q = byId(el.dataset.q); if (q) reopen(q, el.dataset.k || undefined); return; }
    if (act === 'claimall'){ const q = byId(el.dataset.q); if (q) claimAll(q, rect); return; }
    if (act === 'claimday'){ const q = byId(el.dataset.q); if (q) claimDay(q, el.dataset.day, rect); return; }
    if (act === 'goalnow'){ const q = byId(el.dataset.q); if (q) claimGoal(q, el.dataset.day, rect, { onBar:true }); return; }   // the Goal button on the Quests step card
    if (act === 'goalclaim'){ const q = byId(el.dataset.q); if (q) claimGoal(q, el.dataset.day, rect); return; }
    const item = el.closest('.item'); if (!item) return;
    const q = byId(item.dataset.id); if (!q) return;
    if (act !== 'edit' && act !== 'reopen' && !isVisible(q)){ return; }   // locked follow-up: its quest isn't done yet
    if (act === 'edit') openSheet(q.id);
    else if (act === 'reopen') reopen(q, el.dataset.row);
    else if (act === 'record') submitRecord(q, el.closest('.card').querySelector('.rec-input input'), rect);
    else if (act === 'tally') claimTally(q, el.closest('.card').querySelector('[data-tallyin]'), rect);
    else if (act === 'claim'){
      if (q.kind === 'pair') claimPair(q, el.dataset.row, rect);
      else claimQuest(q, rect);
    }
    else if (act === 'tunhit') targetUnhit(q);
    else if (act === 'unslip') undoSlip(q);
    else if (act === 'thit'){ const n = el.dataset.n; if (n === 'type') return targetType(q, el); targetHit(q, +n, rect); }
    else if (act === 'slip'){ slipAvoid(q);
    }
  });
  // typing an amount (tally) or a value (record) updates its button straight away
  $('#panel').addEventListener('input', e => {
    const tin = e.target.closest('[data-tallyin]'); if (tin){ updateTally(tin); return; }
    const rin = e.target.closest('.rec-input input'); if (rin){ rin.parentElement.querySelector('[data-act="record"]').classList.toggle('off', !(parseFloat(rin.value) > 0)); return; }
  });
  $('#panel').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.closest('[data-tallyin]')){ e.preventDefault(); e.target.closest('.card').querySelector('[data-act=tally]').click(); return; }
    if (!e.target.closest('.rec-input')) return;
    e.preventDefault();
    e.target.closest('.rec-input').querySelector('[data-act=record]').click();
  });
}
