/* Preview-only test buttons for the Gambling Den (added to the purple test bar by tools/make-preview.js; never in www/ or the zip).
   make-preview.js also patches two lines of js/den/den.js in the preview so "No mines" and "Hilo win" work. */
window.__dT = { noMine:false, hiWin:false, heatE:false };   // heatE: Lockpick uses heat ladder E instead of the Minesweeper one
(function(){
  let tries = 0;
  const t = setInterval(() => { if (add() || ++tries > 40) clearInterval(t); }, 250);
  function add(){
    const bar = document.getElementById('demoBar'); if (!bar || document.getElementById('dTix')) return !!bar;
    const css = 'background:#7c43b0;color:#fff;border:1px solid #a77fd0;border-radius:4px;padding:2px 6px;font:inherit;flex:none;cursor:pointer';
    const mk = (id, txt, fn) => { const b = document.createElement('button'); b.id = id; b.textContent = txt; b.style.cssText = css; b.onclick = () => fn(b); return b; };
    const tog = (k, name) => b => { __dT[k] = !__dT[k]; b.textContent = name + ': ' + (__dT[k] ? 'ON' : 'off'); b.style.background = __dT[k] ? '#2a9d5c' : '#7c43b0'; };
    const btns = [
      mk('dTix', '+5 Tickets', () => PsychDen.gain(5)),
      mk('dGem', '+5 Gems', () => __dGem(5)),
      mk('dMine', 'No mines: off', tog('noMine', 'No mines')),
      mk('dWin', 'Hilo win: off', tog('hiWin', 'Hilo win')),
      mk('dHeat', 'Lock heat E: off', tog('heatE', 'Lock heat E'))
    ];
    const hide = [...bar.children].find(c => c.textContent === 'Hide bar'); let ref = hide ? hide.nextSibling : null;
    btns.forEach(b => bar.insertBefore(b, ref));
    return true;
  }
})();
