/* Preview-only test button for the step goal claim on the Quests page (added to the purple test bar by tools/make-preview.js; never in www/ or the zip).
   ON: today's steps stay at 10 000 and the goal never counts as claimed, so the Goal button can be pressed again and again. */
window.__gT = { on:false };
(function(){
  const _render = render;
  render = function(){
    if (window.__gT.on){ const q = firstSteps(); if (q){ const k = dayKey(); S.steps[k] = 10000; (q.goalPaid ||= {})[k] = false; } }
    return _render.apply(this, arguments);
  };
  let tries = 0;
  const t = setInterval(() => { if (add() || ++tries > 40) clearInterval(t); }, 250);
  function add(){
    const bar = document.getElementById('demoBar'); if (!bar || document.getElementById('gTest')) return !!bar;
    const b = document.createElement('button'); b.id = 'gTest'; b.textContent = 'Goal test: off';
    b.style.cssText = 'background:#7c43b0;color:#fff;border:1px solid #a77fd0;border-radius:4px;padding:2px 6px;font:inherit;flex:none;cursor:pointer';
    b.onclick = () => { __gT.on = !__gT.on; b.textContent = 'Goal test: ' + (__gT.on ? 'ON' : 'off'); b.style.background = __gT.on ? '#2a9d5c' : '#7c43b0'; render(); };
    const hide = [...bar.children].find(c => c.textContent === 'Hide bar'); bar.insertBefore(b, hide ? hide.nextSibling : null);
    return true;
  }
})();
