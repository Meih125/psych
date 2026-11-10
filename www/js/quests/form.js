/* Post / edit sheet: kind picker, every field, list items, saving and deleting. */
const KIND_HELP = {
  standard:'Claim once per cycle. It resets at midnight after the number of days you pick.',
  pair:'A list of quests (2 to 8) that share one cycle, like a routine. Each pays its own reward, and finishing the whole list in the same cycle pays a bonus.',
  scaling:'Claim as often as you like. Each extra claim in the same period pays more. Rewards drop back to the base when the period resets.',
  record:'Log a number. The first entry sets your starting point. You earn a reward each time you pass another step from that starting point, and never twice for the same one.',
  tally:'Whenever it happens, type the amount and claim. No daily reset. Anything below the reward step carries over to next time.',
  target:'Hit it a number of times before its timer runs out. Each tap lights one; claim when they are all lit.',
  bounty:'A one-off task with a due date. It jumps to the top in red the day before it’s due, and disappears once claimed.',
  avoid:'For a habit you are quitting. Claim each day you stayed clean; Slipped starts the count over (your best is kept).',
  counter:'Tap it every time you do it. Every tap pays the same, nothing resets, and the total keeps growing.',
  steps:'Tracks your daily steps from your phone’s step counter (connect it in Settings). Each day’s reward waits for you to claim it, so walking past midnight is never lost.'
};
let editingId = null;
const radios = name => [...document.querySelectorAll(`input[name=${name}]`)];
const getRadio = name => (radios(name).find(r => r.checked) || {}).value;
const setRadio = (name, v) => radios(name).forEach(r => r.checked = r.value === String(v));
const toInt = (v, max = 9999) => Math.max(0, Math.min(max, Math.round(parseFloat(v)) || 0));
const DEFAULTS = { standard:{ xp:10, gold:5 }, scaling:{ xp:10, gold:10 }, counter:{ xp:5, gold:5 }, target:{ xp:30, gold:15 }, bounty:{ xp:60, gold:30 }, avoid:{ xp:10, gold:5 } };
function isDescendant(q, ancestorId){ let p = parentOf(q), n = 0; while (p && n++ < 60){ if (p.id === ancestorId) return true; p = parentOf(p); } return false; }
function fillParentOptions(selfId, current){
  const opts = S.quests.filter(q => q.kind === 'standard' && q.id !== selfId && !(selfId && isDescendant(q, selfId)));
  $('#fParent').innerHTML = `<option value="">Always available</option>` + opts.map(q => `<option value="${q.id}"${q.id === current ? ' selected' : ''}>${esc(q.name)}</option>`).join('');
}
// "Resets every": any number of days (1–60), with − / + and quick picks
function setDays(n){
  n = +n === MONTHLY ? MONTHLY : Math.max(1, Math.min(60, Math.round(+n) || 1));
  $('#fDays').value = n; $('#fDaysShow').value = n === MONTHLY ? '' : n; sizeDaysBox();
  $('#fDaysUnit').textContent = n === MONTHLY ? 'Monthly' : n === 1 ? 'day' : 'days';
  $('#daysPick').classList.toggle('mo', n === MONTHLY);
  document.querySelectorAll('.dp-quick button').forEach(b => b.classList.toggle('on', +b.dataset.days === n));
  $('#daysHelp').textContent = n === MONTHLY ? 'Resets on the 1st of each month, at midnight.' : n === 1 ? 'Resets at midnight.' : n === 7 ? 'Resets every Monday at midnight.' : n === 14 ? 'Resets every second Monday at midnight.' : 'Counts from the day you claim it. Resets at midnight.';
}
// the number box is as wide as its digits, so "5 days" sits in the middle
function sizeDaysBox(){ $('#fDaysShow').style.setProperty('width', (Math.max(1, String($('#fDaysShow').value).length) + 1) + 'ch', 'important'); }
// HALF / FULL next to the kind name in the editor, for quests that can be half width
let formSize = 'full', formSizeSet = false;
function sizeOkForm(){
  const k = getRadio('kind'), q = editingId && byId(editingId);
  if (q && S.quests.some(c => c.parent === q.id)) return false;
  if ((k === 'standard' || k === 'counter' || k === 'record' || k === 'tally' || k === 'pair') && $('#fParent').value) return false;
  return k === 'standard' || k === 'scaling' || k === 'counter' || k === 'avoid' || k === 'bounty' || k === 'record' || k === 'tally' || k === 'pair' || (k === 'target' && +$('#fNeed').value <= 10);
}
function renderFormSize(){
  const el = $('#khSize'); if (!el) return;
  el.hidden = !sizeOkForm();
  el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.sz === formSize));
}
// the kind hint keeps the tallest hint's height so Next / Cancel never move
let helpMax = 0;
function padHelp(){
  const el = $('#kindHelp'); if (!el || !$('#form').classList.contains('pick')) return;
  if (!helpMax || padHelp.w !== el.clientWidth){
    padHelp.w = el.clientWidth; el.style.marginBottom = '0'; const keep = el.textContent;
    helpMax = Math.max(...Object.values(KIND_HELP).map(t => { el.textContent = t; return el.offsetHeight; })); el.textContent = keep;
  }
  el.style.marginBottom = '0'; el.style.marginBottom = Math.max(0, helpMax - el.offsetHeight) + 'px';
}
function updateForm(){
  renderFormSize();
  const kind = getRadio('kind');
  document.querySelectorAll('#form [data-show]').forEach(el => el.style.display = el.dataset.show.split(' ').includes(kind) ? '' : 'none');
  if ((kind === 'standard' || kind === 'record') && $('#fParent').value) $('#daysField').style.display = 'none';
  const nrShow = kind === 'record' && !$('#fParent').value, nrOn = nrShow && !$('#fReset').checked;   // the toggle is "Resets every" (on = resets, the default); off = no reset, any number of attempts
  $('#noResetRow').style.display = nrShow ? '' : 'none'; $('#noResetRow').style.marginTop = '14px';
  $('#daysField').classList.toggle('nr', nrOn);
  const q = editingId && byId(editingId);
  if (kind === 'record'){
    $('#startField').style.display = q ? 'none' : '';
    $('#histField').style.display = q && q.entries.length ? '' : 'none';
    const u = $('#fUnit').value.trim() || 'unit', st = parseFloat($('#fStep').value) || 1;
    $('#stepHelp').textContent = `You earn the reward each time you pass another ${fmt(st)} ${u} from your starting point, once per milestone.`;
    $('#fStepUnit') && ($('#fStepUnit').textContent = $('#fUnit').value.trim() || 'unit');
  }
  if (kind === 'steps' || kind === 'tally'){
    const tmp = { kind, unit:$('#fTUnit').value.trim() };
    const c = Math.max(0.01, parseFloat($('#fChunk').value) || 1);
    const ex = kind === 'steps' ? 10000 : c * 10, n = Math.floor(ex / c + 1e-9);
    $('#chunkLbl').firstChild.nodeValue = 'Every';   // only the text, keep the (i) button
    $('#fChunkUnit').textContent = kind === 'steps' ? 'steps' : (tmp.unit || 'unit');
    $('#chunkHelp').textContent = `${fmtU(tmp, ex)} would pay +${fmt(n * toInt($('#fStXp').value))} XP and +${fmt(n * toInt($('#fStGold').value))} gold.`;
  }
  $('#kindHelp').textContent = KIND_HELP[kind]; padHelp();
  $('#nameLbl').textContent = kind === 'pair' ? 'List title' : 'Title';
  $('#xpLbl').textContent = kind === 'scaling' ? 'Base XP' : 'XP';
  $('#goldLbl').textContent = kind === 'scaling' ? 'Base gold' : 'Gold';
  if (kind === 'scaling'){
    const tmp = { xp:toInt($('#fXp').value), gold:toInt($('#fGold').value), growth:toInt($('#fGrowth').value, 500) };
    const xs = [1,2,3,4,5].map(n => scaledReward(tmp, n).xp);
    $('#growthPreview').textContent = `Each claim in the same period pays more than the one before.\nWith these numbers: 1st claim +${xs[0]} XP, 2nd +${xs[1]}, 3rd +${xs[2]}, 4th +${xs[3]}, 5th +${xs[4]}.`;
  }
}
let formPin = false;
function renderPin(){ const b = $('#pinBtn'); if (b){ b.classList.toggle('on', formPin); b.setAttribute('aria-pressed', formPin); } }
function openSheet(id){
  editingId = id || null;
  const q = id ? byId(id) : null;
  // new quest: FULL; a quest never sized by hand shows what the board shows (a lone one stretches to full)
  formSize = !q || q.size === 'full' || (!q.size && boardSections().some(s => s.tiles.some(c => c.q === q && c.w))) ? 'full' : 'half'; formSizeSet = false;
  const kind = q ? q.kind : 'standard';
  $('#formTitle').textContent = q ? 'Edit Quest' : 'Post a Quest';
  $('#saveBtn').textContent = q ? 'Save Changes' : 'Post Quest';
  $('#deleteBtn').style.display = q && !isTracker(q) ? '' : 'none';   // Steps stays
  $('#histBtn').style.display = 'none';
  radios('kind').forEach(r => { r.checked = r.value === kind; r.disabled = !!q; });
  $('#fName').value = q ? q.name : '';
  formPin = !!(q && q.pinned); renderPin(); $('#pinBtn').hidden = !!(q && isTracker(q));
  $('#fNote').value = (q && q.note) || '';
  fillParentOptions(q ? q.id : null, q ? q.parent : null);
  setDays(q ? (q.kind === 'scaling' ? periodOf(q) : q.days || 1) : 1);
  const base = q && ['standard','scaling','counter','target','bounty','avoid'].includes(q.kind) ? q : DEFAULTS[kind] || DEFAULTS.standard;
  $('#fNeed').value = q && q.kind === 'target' ? q.need : 5;
  setDateField('fDue', q && q.kind === 'bounty' ? q.due : addDays(startOfDay(), 7));
  setDateField('fSince', q && q.kind === 'avoid' ? q.since : startOfDay());
  $('#fXp').value = base.xp; $('#fGold').value = base.gold;
  $('#fGrowth').value = q && q.kind === 'scaling' ? q.growth : 50;
  const pq = q && q.kind === 'pair' ? q : null;
  $('#fAName').value = pq ? pq.a.name : ''; $('#fAXp').value = pq ? pq.a.xp : 10; $('#fAGold').value = pq ? pq.a.gold : 5;
  $('#fBName').value = pq ? pq.b.name : ''; $('#fBXp').value = pq ? pq.b.xp : 10; $('#fBGold').value = pq ? pq.b.gold : 5;
  $('#fBonusXp').value = pq ? pq.bonus.xp : 15; $('#fBonusGold').value = pq ? pq.bonus.gold : 15;
  listExtraRender(pq ? (pq.extra || []).map((r, i) => ({ name:r.name, xp:r.xp, gold:r.gold, src:i })) : []);
  const rq = q && q.kind === 'record' ? q : null;
  $('#fUnit').value = rq ? rq.unit : 'kg';
  setRadio('better', rq ? rq.better : 'lower');
  $('#fStep').value = rq ? rq.step : 1;
  $('#fXpPer').value = rq ? rq.xpPer : 10; $('#fGoldPer').value = rq ? rq.goldPer : 10;
  $('#fStart').value = '';
  const sq = q && (isTracker(q) || q.kind === 'tally') ? q : null;
  $('#fTUnit').value = sq && sq.kind === 'tally' ? sq.unit : '$';
  $('#fChunk').value = sq ? sq.chunk : 100; $('#fStXp').value = sq ? sq.xpPer : 1; $('#fStGold').value = sq ? sq.goldPer : 1;
  $('#fGoal').value = sq ? sq.goal : 10000; $('#fShowDays').value = sq ? sq.showDays : 3;
  $('#fGoalXp').value = sq && sq.goalXp != null ? sq.goalXp : GOAL_BONUS; $('#fGoalGold').value = sq && sq.goalGold != null ? sq.goalGold : GOAL_BONUS;
  $('#fShowCount').checked = q ? showsCount(q) : true;
  $('#fTracked').checked = q ? isTracked(q) : false;
  $('#fReset').checked = !(q && q.kind === 'record' && q.noReset);
  $('#hist').innerHTML = rq ? [...rq.entries].reverse().map(e => {
    const d = new Date(e.t);
    return `<div><span>${d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}</span><b class="${e.v === rq.best ? 'best' : ''}">${fmt(e.v)} ${esc(rq.unit)}</b></div>`;
  }).join('') : '';
  // edit mode: no kind picker and no meta line; the "Available after" dropdown shows the quest's parent
  document.querySelector('#form input[name="kind"]').closest('.field').style.display = q ? 'none' : '';
  $('#form').classList.toggle('editing', !!q);
  if (infoCur && infoCur.formTip) infoClose();
  $('#formMeta').textContent = ''; $('#formMeta').style.display = q ? 'none' : '';
  updateForm();
  $('#modal').classList.add('open');
  $('#form').scrollTop = 0;
  if (window.cyParentSync) cyParentSync();
  setNeed($('#fNeed').value); setPick(!id);   // a new quest starts at the kind picker
  if (!id){ helpMax = 0; padHelp(); }
}
function closeSheet(){ $('#modal').classList.remove('open'); editingId = null; }
function saveForm(){
  if (!$('#modal').classList.contains('open') || $('#form').classList.contains('pick')) return;   // closing, or still choosing a kind
  const kind = getRadio('kind');
  const name = $('#fName').value.trim();
  if (!name){ shake($('#fName')); return; }
  const common = { name, note:$('#fNote').value.trim(), showCount:$('#fShowCount').checked, tracked:$('#fTracked').checked };
  const days = +$('#fDays').value === MONTHLY ? MONTHLY : toInt($('#fDays').value || 1, 60) || 1;
  const parent = $('#fParent').value || null;
  let q = editingId ? byId(editingId) : null;
  const isNew = !q;
  if (kind === 'pair'){
    const an = $('#fAName').value.trim(), bn = $('#fBName').value.trim();
    if (!an){ shake($('#fAName')); return; }
    if (!bn){ shake($('#fBName')); return; }
    const more = listExtraRead(), empty = more.find(r => !r.name);
    if (empty){ shake(empty.el.querySelector('.fx-name')); return; }
    if (isNew) q = { id:uid(), kind, cycleEnd:0, bonusCount:0, bonusUntil:0, created:now(),
      a:{ count:0, until:0, undo:null }, b:{ count:0, until:0, undo:null }, extra:[] };
    Object.assign(q, common, { days, bonus:{ xp:toInt($('#fBonusXp').value), gold:toInt($('#fBonusGold').value) } });
    Object.assign(q.a, { name:an, xp:toInt($('#fAXp').value), gold:toInt($('#fAGold').value) });
    Object.assign(q.b, { name:bn, xp:toInt($('#fBXp').value), gold:toInt($('#fBGold').value) });
    // quests 3+: keep each one's progress if it was already on the list
    const old = Array.isArray(q.extra) ? q.extra : [];
    q.extra = more.map(r => Object.assign(r.src >= 0 && old[r.src] ? old[r.src] : { count:0, until:0, undo:null, log:[] }, { name:r.name, xp:r.xp, gold:r.gold }));
  } else if (kind === 'scaling'){
    if (isNew) q = { id:uid(), kind, week:0, weekClaims:0, count:0, created:now() };
    Object.assign(q, common, { xp:toInt($('#fXp').value), gold:toInt($('#fGold').value), growth:toInt($('#fGrowth').value, 500), period:days });
  } else if (kind === 'counter'){
    if (isNew) q = { id:uid(), kind, count:0, log:[], created:now() };
    Object.assign(q, common, { xp:toInt($('#fXp').value), gold:toInt($('#fGold').value), parent });
  } else if (kind === 'record'){
    if (isNew){
      const start = round2(parseFloat($('#fStart').value));
      const s0 = isFinite(start) && start > 0 ? Math.min(VALUE_CAP, start) : null;
      q = { id:uid(), kind, entries:[], start:s0, best:s0, paidTo:s0, doneUntil:0, count:0, undo:null, created:now() };
    }
    const st = round2(parseFloat($('#fStep').value));
    Object.assign(q, common, { unit:$('#fUnit').value.trim() || 'unit', better:getRadio('better') || 'lower', step:isFinite(st) && st > 0 ? Math.min(VALUE_CAP, st) : 1,
      xpPer:toInt($('#fXpPer').value), goldPer:toInt($('#fGoldPer').value), parent, days, noReset:!$('#fReset').checked });
    if (q.noReset) q.doneUntil = 0;
  } else if (kind === 'tally'){
    if (isNew) q = { id:uid(), kind, log:[], carry:0, total:0, count:0, created:now() };
    const ch = round2(parseFloat($('#fChunk').value));
    Object.assign(q, common, { unit:$('#fTUnit').value.trim(), chunk:isFinite(ch) && ch > 0 ? Math.min(VALUE_CAP, ch) : 1, xpPer:toInt($('#fStXp').value), goldPer:toInt($('#fStGold').value) });
  } else if (kind === 'steps'){
    if (isNew) q = { id:uid(), kind, paid:{ ...(S.stepsMemo || {}).paid }, goalPaid:{ ...(S.stepsMemo || {}).goalPaid }, created:now() };
    Object.assign(q, common, { chunk:Math.max(1, toInt($('#fChunk').value, 100000)), xpPer:toInt($('#fStXp').value), goldPer:toInt($('#fStGold').value),
      goal:toInt($('#fGoal').value, 200000), showDays:toInt($('#fShowDays').value, 14), goalXp:toInt($('#fGoalXp').value), goalGold:toInt($('#fGoalGold').value) });
  } else if (kind === 'target'){
    if (isNew) q = { id:uid(), kind, doneUntil:0, count:0, undo:null, hits:0, cycleEnd:0, log:[], created:now() };
    const need = Math.max(1, toInt($('#fNeed').value || 1, 999));
    if (!isNew && q.days !== days){ q.cycleEnd = 0; q.doneUntil = 0; }   // a new timer length starts a fresh cycle
    Object.assign(q, common, { xp:toInt($('#fXp').value), gold:toInt($('#fGold').value), days, need });
  } else if (kind === 'bounty'){
    if (isNew) q = { id:uid(), kind, doneUntil:0, doneAt:0, count:0, undo:null, log:[], created:now() };
    Object.assign(q, common, { xp:toInt($('#fXp').value), gold:toInt($('#fGold').value), due:+$('#fDue').value });
  } else if (kind === 'avoid'){
    if (isNew) q = { id:uid(), kind, doneUntil:0, count:0, undo:null, slips:[], best:0, log:[], created:now() };
    Object.assign(q, common, { xp:toInt($('#fXp').value), gold:toInt($('#fGold').value), days:1, since:+$('#fSince').value });
  } else {
    if (isNew) q = { id:uid(), kind, doneUntil:0, count:0, undo:null, created:now() };
    Object.assign(q, common, { xp:toInt($('#fXp').value), gold:toInt($('#fGold').value), parent, days });
  }
  if (q.kind !== 'steps') q.pinned = formPin || undefined;   // pinned quests get their own section on the Quests page
  if (isNew) S.quests.push(q);
  if ((formSizeSet || isNew) && sizeOkForm()) q.size = formSize;   // new quests are full unless HALF is picked
  save(); closeSheet(); render();
  showToast(isNew ? `Posted “${name}”` : 'Changes saved', false);
}
/* ---- List quest editor: quests 3–8 ("+ Add a quest" adds one, × takes it off) ---- */
function listExtraHtml(r, i){
  return `<div class="group fx-item" data-src="${r.src == null ? -1 : r.src}"><div class="group-title">Quest ${i + 3}<button type="button" class="fx-rm" aria-label="Remove quest ${i + 3}">×</button></div>
    <div class="field"><input type="text" class="fx-name" maxlength="80" placeholder="Quest ${i + 3}" value="${esc(r.name || '')}"></div>
    <div class="field row2"><div><label class="inlabel cy-ico" aria-label="XP">${ico('i-gem')}</label><input type="number" class="fx-xp" min="0" max="9999" inputmode="numeric" value="${r.xp ?? 10}"></div>
      <div><label class="inlabel cy-ico" aria-label="Gold">${ico('i-coin')}</label><input type="number" class="fx-gold" min="0" max="9999" inputmode="numeric" value="${r.gold ?? 5}"></div></div></div>`;
}
function listExtraRender(list){
  const box = $('#fListMore'); if (!box) return;
  box.innerHTML = list.map(listExtraHtml).join('');
  box.querySelectorAll('input[type="number"]').forEach(inp => addStepper(inp));
  $('#fListAdd').hidden = 2 + list.length >= LIST_MAX;
}
function listExtraRead(){
  return [...document.querySelectorAll('#fListMore .fx-item')].map(el => ({ el, src:+el.dataset.src,
    name:el.querySelector('.fx-name').value.trim(), xp:toInt(el.querySelector('.fx-xp').value), gold:toInt(el.querySelector('.fx-gold').value) }));
}
// "Times to hit" stepper
function setNeed(n){ n = Math.max(1, Math.min(999, Math.round(+n) || 1)); $('#fNeed').value = n; $('#fNeedUnit').textContent = n === 1 ? 'time' : 'times'; renderFormSize(); }   // HALF / FULL only shows while it is 10 or fewer
/* ---- Post a quest in two steps: pick a kind (3×3), then set it up ---- */
function kindHead(editing){
  const k = getRadio('kind');
  $('#kindHeadIc').className = 'kh-ic k-' + k;
  { const c = KIND_COL[k] || '#ff8a45'; $('#kindHeadIc').style.cssText = `color:${c};background:${c}1f`; }   // its type colour, like the tile's icon
  $('#kindHeadIc').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${qbIcons()[k] || ''}</svg>`;
  $('#kindHeadT').textContent = (editing ? 'Edit ' : '') + KIND_NAME[k];
  $('#kindHeadS').textContent = KIND_HELP[k].split('. ')[0].replace(/\.$/, '') + '.';
  $('#kindBack').hidden = editing;
  renderFormSize();
}
function setPick(on){ $('#form').classList.toggle('pick', on); if (!on) kindHead(!!editingId); $('#form').scrollTop = 0; }

function initForm(){
  $('#daysPick').addEventListener('click', e => { const b = e.target.closest('[data-dd]'); if (!b) return;
    const cur = +$('#fDays').value; setDays(cur === MONTHLY ? (+b.dataset.dd > 0 ? 31 : 30) : cur + +b.dataset.dd); });
  $('#fDaysShow').addEventListener('change', () => setDays($('#fDaysShow').value));
  $('#fDaysShow').addEventListener('input', () => { sizeDaysBox(); const v = Math.round(+$('#fDaysShow').value); if (v >= 1){ $('#fDays').value = Math.min(60, v); document.querySelectorAll('.dp-quick button').forEach(b => b.classList.toggle('on', +b.dataset.days === Math.min(60, v))); } });
  document.querySelector('.dp-quick').addEventListener('click', e => { const b = e.target.closest('[data-days]'); if (b) setDays(b.dataset.days); });
  $('#khSize').addEventListener('click', e => { const b = e.target.closest('[data-sz]'); if (!b) return; formSize = b.dataset.sz; formSizeSet = true; renderFormSize(); });
  $('#pinBtn').addEventListener('click', () => { formPin = !formPin; renderPin(); });
  $('#form').addEventListener('input', updateForm);
  $('#form').addEventListener('change', e => {
    if (e.target.name === 'kind' && !editingId){
      const d = DEFAULTS[e.target.value];
      if (d){ $('#fXp').value = d.xp; $('#fGold').value = d.gold; }
      $('#fShowCount').checked = e.target.value !== 'record';
      if (!editingId) setDays(e.target.value === 'scaling' || e.target.value === 'target' ? 7 : 1);
      $('#fTracked').checked = e.target.value === 'record' || e.target.value === 'tally';
      if (e.target.value === 'tally'){ $('#fChunk').value = 10; $('#fStXp').value = 5; $('#fStGold').value = 5; $('#fGoal').value = 100; }
      if (e.target.value === 'steps'){ $('#fChunk').value = 100; $('#fStXp').value = 1; $('#fStGold').value = 1; $('#fGoal').value = 10000; }
    }
    updateForm();
  });
  $('#saveBtn').addEventListener('click', saveForm);
  $('#form').addEventListener('submit', e => { e.preventDefault(); saveForm(); });
  $('#form').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.repeat && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox'){ e.preventDefault(); saveForm(); } });
  $('#cancelBtn').addEventListener('click', closeSheet);
  $('#deleteBtn').addEventListener('click', async () => {
    const q = byId(editingId); if (!q) return;
    const kids = S.quests.filter(c => c.parent === q.id);
    let msg = q.kind === 'steps' ? 'Your step history is kept for the Progress tab.' : q.kind === 'tally' ? 'Its entries and total will be lost.' : `Its count${q.kind === 'record' ? ' and history' : ''} will be lost.`;
    if (kids.length) msg += ` ${kids.length} follow-up quest${kids.length > 1 ? 's' : ''} will become always available.`;
    if (!await ask(`Remove “${q.name}”?`, msg, 'Remove')) return;
    kids.forEach(c => c.parent = null);
    // a re-added Steps quest keeps what it already paid, so nothing pays twice
    if (isTracker(q)) S.stepsMemo = { paid:{ ...(S.stepsMemo || {}).paid, ...q.paid }, goalPaid:{ ...(S.stepsMemo || {}).goalPaid, ...q.goalPaid } };
    S.quests = S.quests.filter(x => x.id !== q.id);
    save(); closeSheet(); render();
  });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeSheet(); });
  $('#fListAdd').addEventListener('click', () => {
    const L = listExtraRead().map(({ el, ...r }) => r); if (2 + L.length >= LIST_MAX) return;
    L.push({ name:'', xp:10, gold:5, src:-1 }); listExtraRender(L);
    const all = document.querySelectorAll('#fListMore .fx-name'); all[all.length - 1].focus();
  });
  $('#fListMore').addEventListener('click', e => {
    const b = e.target.closest('.fx-rm'); if (!b) return;
    const items = [...document.querySelectorAll('#fListMore .fx-item')], i = items.indexOf(b.closest('.fx-item'));
    const L = listExtraRead().map(({ el, ...r }) => r); L.splice(i, 1); listExtraRender(L);
  });
  /* ---- Quest form: icon tiles for the kind, a headline title, − / + steppers on rewards ---- */
  (function cyberForm(){
    const ICON = {
      standard:'<circle cx="12" cy="12" r="8"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>',
      pair:'<rect x="7" y="3" width="10" height="7.5" rx="1.6"/><rect x="7" y="13.5" width="10" height="7.5" rx="1.6"/><path d="M12 10.5v3"/>',
      scaling:'<path d="M5 19V9M10 19V6M15 19v-8M20 19V4"/>',
      counter:'<circle cx="12" cy="12" r="8"/><path d="M12 8.5v7M8.5 12h7"/>',
      record:'<path d="M12 3v3M5.6 6.6l2 2M18.4 6.6l-2 2"/><path d="M4 18a8 8 0 0 1 16 0z"/><path d="M12 18l3.5-5"/>',
      steps:'<path d="M8 3c2 0 3 2.5 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5zM6 15h4v2a2 2 0 0 1-4 0z"/><path d="M16 8c2 0 3 2.5 3 5s-1 4-3 4-3-1.5-3-4 1-5 3-5z" transform="translate(0 2)"/>',
      tally:'<path d="M5 5v14M9 5v14M13 5v14M17 5v14M3 15l18-6"/>',
      target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
      bounty:'<path d="M7 3h10v18l-5-3.2L7 21z"/><path d="M10 8.5h4M10 12h4"/>',
      avoid:'<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>',
    };
    document.querySelectorAll('#form input[name="kind"]').forEach(r => {
      const span = r.nextElementSibling;
      span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[r.value] || ''}</svg>${span.textContent}`;
    });
    $('#fName').placeholder = 'Name your quest';
    // − / + around reward numbers
    const STEP = { fGrowth:10 };
    ['fXp','fGold','fGrowth','fAXp','fAGold','fBXp','fBGold','fBonusXp','fBonusGold','fXpPer','fGoldPer','fStXp','fStGold','fGoalXp','fGoalGold'].forEach(id => addStepper(document.getElementById(id), STEP[id]));
  })();
  /* ---- Custom dropdown for "Available after" ---- */
  (function cyberEdit(){
    // custom dropdown that mirrors the hidden <select id="fParent">
    const sel = $('#fParent'), box = document.createElement('div');
    box.className = 'cy-select'; box.innerHTML = '<button type="button" class="cy-sel-btn"><span></span><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="cy-sel-list"></div>';
    sel.after(box); sel.style.display = 'none';
    const btn = box.querySelector('.cy-sel-btn'), list = box.querySelector('.cy-sel-list');
    window.cyParentSync = () => {
      const o = sel.options[sel.selectedIndex];
      btn.querySelector('span').textContent = o ? o.textContent : 'Always available';
      list.innerHTML = [...sel.options].map((x, i) => `<button type="button" data-i="${i}" class="${i === sel.selectedIndex ? 'on' : ''}">${i ? `<b class="cy-dot" style="background:${KIND_COL[(byId(x.value) || {}).kind] || '#ff8a45'}"></b>` : '<i>◇</i>'}${esc(x.textContent)}</button>`).join('');
    };
    btn.addEventListener('click', e => { e.stopPropagation(); cyParentSync(); box.classList.toggle('open'); });
    list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; sel.selectedIndex = +b.dataset.i; sel.dispatchEvent(new Event('change', { bubbles:true })); box.classList.remove('open'); cyParentSync(); });
    document.addEventListener('click', () => box.classList.remove('open'));
    // XP and gold on one line: [crystal][− n +]  [coin][− n +]
    document.querySelectorAll('#form .row2, #form .row3f').forEach(row => {
      row.querySelectorAll('label.inlabel').forEach(l => { l.classList.add('cy-ico'); l.querySelectorAll('span').forEach(s => s.hidden = true); [...l.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); }); });
    });
  })();
  infoFormHints();   // (i) tips next to field labels (js/ui/info.js)
  $('#needPick').addEventListener('click', e => { const b = e.target.closest('[data-dn]'); if (b) setNeed(+$('#fNeed').value + +b.dataset.dn); });
  $('#fNeed').addEventListener('change', () => setNeed($('#fNeed').value));
  $('#fNeed').addEventListener('input', renderFormSize);
  $('#pickNext').addEventListener('click', () => { if (!getRadio('kind')) return; setPick(false); });
  $('#pickCancel').addEventListener('click', closeSheet);
  $('#kindBack').addEventListener('click', () => setPick(true));
}
