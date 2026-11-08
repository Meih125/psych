// CSS class/id prefix -> stylesheet. The table is also the naming guide (AGENTS.md).
// Order of AREAS = load order in index.html.
const AREAS = ['base', 'ui/sheet', 'ui/header', 'ui/nav', 'ui/info', 'ui/dialog', 'ui/fx', 'ui/rank', 'ui/date-picker', 'ui/number-field',
  'cards/cards', 'quests/board', 'quests/tally', 'quests/arrange', 'quests/form', 'progress/progress', 'progress/hero', 'progress/steps-hud',
  'shop/shop', 'shop/pack-info', 'shop/market', 'cards/opening', 'cards/inspect', 'cards/collection', 'cards/inventory',
  'system/settings', 'system/widgets', 'events/daily-login', 'events/birthday', 'den/den', 'overrides'];
const PREFIX = {
  'ui/sheet': ['modal', 'sheet', 'btn-plain', 'btn-main', 'btn-row', 'actions', 'pick-actions'],
  'ui/header': ['num-pop', 'g-up', 'g-dn', 'top', 'top-in', 'brand', 'purse', 'gold', 'lvl', 'lvlEmblem', 'lvlText', 'xpbar', 'xpfill', 'xphead', 'xpnum', 'xplabel', 'stats', 'gear', 'hd', 'boss', 'seg', 'up-btn', 'dl-btn', 'w-btn', 'ar-btn'],
  'ui/nav': ['dot-hl', 'tabs', 'tabs-inner', 'tab', 'tab-hl', 'fab-add', 'board-head', 'boardTitle', 'boardSub', 'flourish', 'board-actions', 'panel'],
  'ui/info': ['info', 'info-btn', 'info-pop', 'info-title', 'info-foot', 'cy-tip', 'sk-pop', 'sk-host', 'tip', 'tip-host', 'cy-hint'],
  'ui/dialog': ['ask', 'askArt', 'askText', 'askYes', 'askNo', 'dialog', 'toast', 'toastUndo', 'btn-danger', 'btn-buy', 'ab'],
  'ui/fx': ['fx', 'fly', 'float', 'swirl', 'rays', 'shake', 'rc-ink', 'rc-edge', 'fxc'],
  'ui/rank': ['em', 'emu', 'ranks', 'lvl-pop', 'lvlPop', 'lp', 'emb', 'hlu', 'rank'],
  'ui/date-picker': ['datePick', 'dpk', 'dk'],
  'ui/number-field': ['stp', 'stepper'],
  'cards/cards': ['r', 'rtag', 'rdot', 'jr', 'rarity'],
  'quests/board': ['vac-note', 'qboard', 'qb', 'card', 'cy-count', 'cy-streak', 'ep', 'earn-i', 'bonus', 'rewards', 'rw-both', 'xp-r', 'gold-r', 'group', 'fol', 'fold', 'k', 'tg', 'bt', 'av', 'rec', 'rec-input', 'list', 'item', 'note', 'claim', 'badge', 'urgent', 'slipped', 'soon', 'kt', 'cn', 'ql', 'pair', 'record', 'counter', 'scaling', 'standard', 'target', 'bounty', 'avoid', 'steps', 'tally', 'link', 'wire', 'stack', 'meta-line', 'cd', 'board'],
  'quests/tally': ['tl', 'tally-card'],
  'quests/arrange': ['ar', 'arrangeBtn'],
  'quests/form': ['form', 'field', 'lbl', 'kind', 'kh', 'kindHead', 'kindHelp', 'days', 'daysPick', 'daysField', 'daysHelp', 'dp', 'pin', 'pinBtn', 'fx', 'list-add', 'list-more', 'cy-ico', 'cy-select', 'cy-sel', 'cy', 'unit', 'unit-in', 'meta', 'help', 'group-title', 'row2', 'row3f', 'inlabel', 'date-btn', 'formTitle', 'formMeta', 'nameLbl', 'chunkLbl', 'startField', 'histField', 'hist', 'needPick', 'fListMore', 'saveBtn', 'cancelBtn', 'deleteBtn', 'histBtn', 'size'],
  'progress/progress': ['log', 'q-top', 'di', 'pv', 'pvl', 'rose', 'prog', 'progMenu', 'progPop', 'pp', 'stat', 'sum', 'dayinfo', 'chart', 'chips', 'chip', 'bk', 'shx', 'sh-cols', 'sh-col', 'in-l', 'in-r', 'rc', 'recent'],
  'progress/hero': ['hx', 'sk', 'cal', 'flame', 'fl', 'skPop'],
  'progress/steps-hud': ['hud', 'st-sync', 'sync-tag', 'hud-wk'],
  'shop/shop': ['u-r', 'sx-img', 'sh', 'shop', 'slot', 'price', 'qty', 'own', 'pity', 'opened', 'rate', 'ur1', 'bgl', 'stub', 'ban', 'sh-car', 'sh-dots', 'sh-qty', 'sh-latest', 'tk'],
  'shop/pack-info': ['pki', 'pz-sig'],
  'shop/market': ['mkt'],
  'cards/opening': ['oa2', 'pack', 'pk', 'rv', 'sc', 'oa', 'jku', 'ptk', 'oaTray', 'scene', 'deal'],
  'cards/inspect': ['inspect', 'in'],
  'cards/collection': ['fc', 'pkc', 'ov', 'jk', 'ccRes', 'fa', 'fb', 'cc', 'col', 'ccMain', 'ct', 'duo', 'fan', 'pz', 'pzStrip', 'set-claim', 'cvp', 'cs', 'nm', 'colSearchBox', 'ccQ', 'ccClear', 'colSearchBtn', 'cc-search', 'col-search', 'search'],
  'cards/inventory': ['inv', 'dka', 'nbw', 'wh', 'ur', 'open-all', 'openAllBtn', 'th', 'deck'],
  'system/settings': ['settings', 'up', 'upInfo', 'sync', 'sync-status', 'danger-block', 'toggle', 'resetProgress', 'resetAll', 'bgRow', 'syncConnect', 'syncNowBtn', 'leftHand', 'reduceFx', 'vacation', 'exportBtn', 'importBtn'],
  'system/widgets': ['ns', 'bc', 'w', 'wt', 'wb', 'wv', 'widgets', 'wPick', 'wBody'],
  'events/daily-login': ['dl'],
  'events/birthday': ['bd'],
  'den/den': ['den', 'lTkt'],
};
// state / modifier words never decide the area
const GENERIC = new Set(['on', 'open', 'ready', 'done', 'dim', 'hot', 'go', 'big', 'reduce-fx', 'idle', 'busy', 'bg', 'offs', 'neg', 'full', 'half', 'wide', 'locked', 'empty', 'new', 'off', 'red', 'green', 'gold', 'a', 'b', 'c', 'd', 'l', 'r', 'h', 'n', 's', 't', 'x', 'g', 'u', 'z', 'k', 'q', 'f', 'o', 'w', 'sl', 'up', 'dn', 'in', 'out', 'land', 'joker', 'last', 'first', 'now', 'cur', 'sel', 'sm', 'lg', 'center', 'left', 'right', 'flipped', 'front', 'back', 'show', 'gone', 'pop', 'tap', 'same', 'two', 'free', 'ok', 'bad', 'warn', 'late', 'short', 'deny', 'shine', 'glow', 'edge', 'flash', 'burst', 'gain', 'lift', 'lifted', 'moving', 'drag', 'dragging', 'sliding', 'closing', 'press', 'away', 'split', 'tall', 'whole', 'zero', 'none', 'claimed', 'earned', 'got', 'best', 'pick', 'dark', 'alt', 'blank', 'just', 'nx', 'nt', 'nr', 'sw', 'td', 'ty', 'dj', 'lk', 'nn', 'et', 'rl', 'mo', 'pb', 'od', 'fi', 'rt', 'sn', 'hw', 'huge', 'lose', 'ice', 'cnt', 'pin-on', 'th-tarot', 'th-mlbb', 'th-hod']);
for (const k of ['t1','t2','t3','t4','t5','n1','n2','n3','s2','s5','c1','c2','fq-l','fq-r','k-steps','k-scaling','k-tally','k-record','k-pair','k-target','k-bounty','k-avoid','k-counter']) GENERIC.add(k);
const exact = {}; const pre = [];
for (const [area, list] of Object.entries(PREFIX)) for (const p of list){ exact[p] = area; pre.push([p, area]); }
pre.sort((a, b) => b[0].length - a[0].length);
function areaOfToken(tok){
  if (GENERIC.has(tok)) return null;
  if (exact[tok]) return exact[tok];
  for (const [p, a] of pre) if (tok.startsWith(p + '-')) return a;
  return null;
}
// area of one selector part: rightmost compound first, then leftwards
function areaOfPart(part){
  const comps = part.replace(/:(not|is|where|has)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '').split(/\s*[\s>+~]\s*/).filter(Boolean);
  for (let i = comps.length - 1; i >= 0; i--){
    const toks = [...comps[i].matchAll(/[.#]([\w-]+)/g)].map(m => m[1]);
    for (const t of toks){ const a = areaOfToken(t); if (a) return a; }
  }
  // fall back to tokens inside functional pseudo-classes
  for (const m of part.matchAll(/[.#]([\w-]+)/g)){ const a = areaOfToken(m[1]); if (a) return a; }
  return null;
}
module.exports = { AREAS, PREFIX, areaOfPart, areaOfToken };
