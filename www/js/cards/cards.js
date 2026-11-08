/* Card model: decks, rarities, images, rolling a pack. */
// rarity colours, used by the drop-rate panel now and by the cards later
const RARITY = {
  ultimate: { name:'UR', color:'#c8242f', glow:'235,60,50' }, legendary:{ name:'SSR', color:'#f08a24', glow:'245,150,50' },
  epic:     { name:'SR',     color:'#a855c8', glow:'176,90,230' }, rare:     { name:'R',      color:'#1ea4e6', glow:'40,165,240' },
  common:   { name:'C',   color:'#3fd47a', glow:'63,212,122' }
};
// per deck: card backs (normal / UR), the picture on the deck box, and its glow colours
var DECKS = {
  tarot:{ back:'backs/tarot', backUR:'backs/tarot-ur', cover:'img/packs/tarot.webp', scenes:true,
    glow:{ mid:'#ff6b1a', deep:'#c2410c', mote:'#ffc49a', ember:'#ffb07a', star:'#fff6ee', frame:'gBronze' } },
  mlbb: { back:'backs/mlbb', backUR:'backs/mlbb-ur', cover:'img/packs/mlbb.webp', scenes:false,
    glow:{ mid:'#7c5cff', deep:'#3b4bd8', mote:'#c4b5ff', ember:'#9fb8ff', star:'#eef0ff', frame:'gDawn' } },
  // Hand of Destiny (H.O.D.)
  hod:  { back:'backs/hod', backUR:'backs/hod-ur', cover:'img/packs/hod.webp', scenes:false,
    glow:{ mid:'#ffb83a', deep:'#b8741a', mote:'#ffe2a0', ember:'#ffcf6a', star:'#fff8e6', frame:'gBronze' } }
};
function deckOf(it){ return DECKS[(it && it.deck) || "tarot"]; }
// a deck without cards yet can't be bought or opened
const deckReady = it => CARDS.some(c => c.deck === ((it && it.deck) || 'tarot'));
// a rarity written inline: coloured diamond + name
// the Jokers keep Common's drop rate but are their own rarity, J (purple to blood red)
const rarBadge = c => c.joker ? '<b class="jr">J</b>' : `<b style="color:${RARITY[c.rarity].color}">${RARITY[c.rarity].name}</b>`;
const rtag = r => `<span class="rtag" style="--c:${RARITY[r].color}"><i class="rdot"></i>${RARITY[r].name}</span>`;
const CARDS = CARD_DATA.cards.concat(MLBB_CARDS, HOD_CARDS), SCENES = CARD_DATA.scenes;
// bonus pictures that drop from a pack of their own deck: Chapters (Tarot) and Realms (Hand of Destiny)
const SCENE_DEF = {
  tarot:{ key:'__scenes', list:SCENES, name:'Chapter', one:'Chapter', col:'#9db2b0' },
  hod:  { key:'__realms', list:REALMS, name:'Realm', one:'Realm', col:'#9db2b0' }
};
const sceneDefOf = k => Object.values(SCENE_DEF).find(x => x.key === k);
const sceneDefById = id => Object.values(SCENE_DEF).find(x => x.list.some(sc => sc.id === id));
const landImg = id => cardImg(id + '_l');
const SCENE_EDGE = {"RM01":["#8eb2e0","#6583ac","#666f7f"],"RM02":["#168dae","#0c7d92","#2c6d7f"],"RM03":["#5f67ae","#45468c","#43337f"],"RM04":["#a38b77","#a38063","#7f6e6b"],"RM05":["#4b6b7f","#4d778c","#50637f"],"RM06":["#54b6c1","#4e9393","#6a7f7a"],"RM07":["#61387f","#974f60","#702a7f"],"RM08":["#6e5a7f","#8c688b","#7f5e7c"],"RM09":["#71797f","#48748c","#919598"],"RM10":["#5d787f","#336d8c","#667d87"],"RM11":["#708190","#62748c","#777f7c"],"RM12":["#741a7f","#8c294c","#7f3f5e"],"RM13":["#6f2d7f","#8c2149","#7f1930"],"RM14":["#2b69af","#1e539b","#4a5d9b"],"RM15":["#3a527f","#3c568c","#344b7f"],"RM16":["#4e73a1","#3e608c","#1f4b7f"],"RM17":["#8b9ea3","#8c7e61","#7c7f71"],"RM18":["#737f7e","#46808c","#769793"],"RM19":["#68707f","#8c8686","#7f7a77"],"RM20":["#cfcad3","#898c6f","#6c787f"],"RM21":["#c7bab1","#9e8877","#7f6e62"],"RM22":["#a28f99","#976e5d","#946d5a"],"RM23":["#a9cbe3","#619cc9","#68a1cf"],"RM24":["#95b2d3","#4e8aba","#709abf"],"SC01":["#7f332a","#8c3b21","#7f2e1a"],"SC02":["#7f7253","#8c4a32","#7f463a"],"SC03":["#7f7464","#8c7857","#7f7461"],"SC04":["#757f74","#8c7358","#7d7f71"],"SC05":["#7f654d","#8c694b","#7f6749"],"SC06":["#7a7f7d","#8c7663","#7a7a7f"],"SC07":["#647c7f","#7a8c78","#7f7d6c"],"SC08":["#777b7f","#7f808c","#7f7e7a"],"SC09":["#7f6b44","#8c7b53","#7f6c48"],"SC10":["#6c7f7f","#61788c","#747e7f"],"SC11":["#7f4335","#8c512b","#7f4e44"],"SC12":["#7d7f7a","#8c826a","#7f7f7b"],"SC13":["#5a7e7f","#8c8469","#73767f"],"SC14":["#767f78","#898c7e","#6c7f75"],"SC15":["#737f7a","#8c4644","#777f7b"],"SC16":["#7f5b54","#8c5036","#7f432c"]};   // pin-board border per Realm / Chapter picture: its own top-left, most striking and bottom-right colours
const edgeStyle = id => { const e = CARD_EDGE[id]; return e ? ` style="--e1:${e[0]};--e2:${e[1]};--e3:${e[2]}"` : ''; };
const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
const flavorOf = id => FLAVOR[id] || ML_FLAVOR[id] || HD_FLAVOR[id] || '';
const RARITY_ORDER = ['ultimate','legendary','epic','rare','common'];
const POOL = Object.fromEntries(Object.keys(DECKS).map(d => [d, Object.fromEntries(RARITY_ORDER.map(r => [r, CARDS.filter(c => c.deck === d && c.rarity === r)]))]));
// Jokers (Hand of Destiny Poker): locked until all 52 Poker cards are owned
const rkey = c => c && c.joker ? 'joker' : c.rarity;
const glowOf = c => c && c.joker ? '190,60,230' : RARITY[c.rarity].glow;
const rarRank = c => c.joker ? 0.5 : RARITY_ORDER.indexOf(c.rarity);   // reveal order: UR Joker SSR SR R C
const jokersOpen = () => !!(S && S.jokerOpen);
function checkJokers(){
  if (S.jokerOpen) return false;
  const list = CARDS.filter(c => c.set === 'Poker');
  if (list.length && list.every(c => cardTotal(c.id) > 0)){ S.jokerOpen = true; return true; }
  return false;
}
const setsOf = d => { const a = [...new Set(CARDS.filter(c => c.deck === d).map(c => c.set))], i = a.indexOf('Angels'), j = a.indexOf('Deity'); if (i >= 0 && j > i){ a[i] = 'Deity'; a[j] = 'Angels'; } return a; };   // Deity is listed above Angels
const backOf = (c, ur) => DECKS[c.deck || 'tarot'][ur ? 'backUR' : 'back'];
// Images: img/cards/tarot, img/cards/mlbb (ML_…), img/scenes (SC01…), img/backs + img/packs (ids with a slash)
const imgPath = id => id.includes('/') ? id : id.startsWith('ML_') ? 'cards/mlbb/' + id : id.startsWith('HD_') ? 'cards/hod/' + id : /^(SC|RM)\d/.test(id) ? 'scenes/' + id : 'cards/tarot/' + id;
const cardImg = id => (window.CARD_IMG && window.CARD_IMG[id]) || `img/${imgPath(id)}.webp`;
const ownedCard = id => (S.cards && S.cards[id]) || 0;
const pickFrom = a => a[Math.floor(Math.random() * a.length)];
// Roll one deck: 5 cards; at least one Rare or better; the 10th deck without an Ultimate gets one.
function rollDeck(item){
  const o = item.odds, cuts = [o.ultimate, o.ultimate + o.legendary, o.ultimate + o.legendary + o.epic, o.ultimate + o.legendary + o.epic + o.rare];
  const roll = () => { const r = Math.random() * 100; return r < cuts[0] ? 'ultimate' : r < cuts[1] ? 'legendary' : r < cuts[2] ? 'epic' : r < cuts[3] ? 'rare' : 'common'; };
  const rar = Array.from({ length:item.cards }, roll);
  if (!rar.some(r => r !== 'common')) rar[Math.floor(Math.random() * rar.length)] = 'rare';
  const pity = (S.pity[item.id] || 0) + 1;
  let pityHit = false;
  if (!rar.includes('ultimate') && pity >= item.pity){ rar[Math.floor(Math.random() * rar.length)] = 'ultimate'; pityHit = true; }
  S.pity[item.id] = rar.includes('ultimate') ? 0 : pity;
  // no duplicates in a pack; an owned UR / SSR drops again only once all of that rarity are owned
  const pool = POOL[item.deck || 'tarot'], used = new Set();
  const pick = r => {
    let list = pool[r].filter(c => !used.has(c.id) && (!c.joker || jokersOpen()));
    if (r === 'ultimate' || r === 'legendary'){ const missing = list.filter(c => !ownedCard(c.id)); if (missing.length) list = missing; }
    const c = pickFrom(list.length ? list : pool[r].filter(x => !x.joker || jokersOpen())); used.add(c.id); return c;
  };
  const cards = rar.map(pick);
  if (window.__jokerAlways && item.deck === 'hod'){   // test button in the preview: a Joker in every pack, whatever the rules say
    const js = pool.common.filter(c => c.joker && !used.has(c.id));
    if (js.length){ let i = cards.findIndex(c => c.rarity === 'common'); if (i < 0) i = Math.floor(Math.random() * cards.length); cards[i] = pickFrom(js); }
  }
  // the cards sit in random spots (a fair shuffle), so the best one is not always in the same place
  for (let i = cards.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  // Scene bonus: 15% per deck, never a duplicate, stops once all are collected
  const sdef = SCENE_DEF[item.deck || 'tarot'], missing = sdef ? sdef.list.filter(sc => !S.scenes[sc.id]) : [];
  const scene = missing.length && Math.random() < .15 ? pickFrom(missing) : null;
  return { cards, scene, pityHit };
}
