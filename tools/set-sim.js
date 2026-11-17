/* Average packs to finish each collection set, by simulation. Used to price set rewards (see HANDOFF.md, "Collection rewards").
   Usage: node tools/set-sim.js [runs] [deck]      e.g. node tools/set-sim.js 1500 glory
   Mirrors rollDeck in www/js/cards/cards.js: 5 cards a pack, odds UR 1.1 / SSR 4 / SR 10 / R 25 / rest C, one Rare or better
   guaranteed, UR pity every 10th pack, no duplicates inside a pack, UR and SSR prefer cards you do not own yet.
   Jokers drop only after the deck's Poker set is complete (their number is "packs from pack 1", subtract the Poker time).
   Bonus-card sets (Chapters, Realms, Glory Promo) are not simulated. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { window:{} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../www/js/data/cards-data.js'), 'utf8') + ';this.ALL=CARD_DATA.cards.concat(MLBB_CARDS,HOD_CARDS,GLORY_CARDS);', ctx);
const RUNS = +process.argv[2] || 1000, ONLY = process.argv[3];
const GATE = { hod:'Poker', glory:'Golden Poker' };
const decks = [...new Set(ctx.ALL.map(c => c.deck || 'tarot'))].filter(d => !ONLY || d === ONLY);
decks.forEach(d => {
  const cs = ctx.ALL.filter(c => (c.deck || 'tarot') === d), sets = {};
  cs.forEach(c => (sets[c.set] = sets[c.set] || []).push(c));
  const names = Object.keys(sets), tot = {}; names.forEach(s => tot[s] = 0);
  for (let n = 0; n < RUNS; n++){
    const own = new Set(), done = {}; let pity = 0, packs = 0, open = !GATE[d];
    while (Object.keys(done).length < names.length && packs < 30000){
      packs++;
      const rar = Array.from({ length:5 }, () => { const r = Math.random() * 100; return r < 1.1 ? 'ultimate' : r < 5.1 ? 'legendary' : r < 15.1 ? 'epic' : r < 40.1 ? 'rare' : 'common'; });
      if (!rar.some(x => x !== 'common')) rar[Math.floor(Math.random() * 5)] = 'rare';
      pity++; if (!rar.includes('ultimate') && pity >= 10) rar[Math.floor(Math.random() * 5)] = 'ultimate';
      pity = rar.includes('ultimate') ? 0 : pity;
      const used = new Set();
      rar.forEach(r => {
        let l = cs.filter(c => c.rarity === r && !used.has(c.id) && (!c.joker || open));
        if (r === 'ultimate' || r === 'legendary'){ const m = l.filter(c => !own.has(c.id)); if (m.length) l = m; }
        const c = l[Math.floor(Math.random() * l.length)]; used.add(c.id); own.add(c.id);
      });
      if (!open && sets[GATE[d]].every(c => own.has(c.id))) open = true;
      names.forEach(s => { if (!done[s] && sets[s].every(c => own.has(c.id))){ done[s] = packs; tot[s] += packs; } });
    }
  }
  console.log('== ' + d);
  names.forEach(s => console.log(s.padEnd(20), String(sets[s].length).padStart(3), 'cards', sets[s][0].rarity.padEnd(10), Math.round(tot[s] / RUNS), 'packs'));
});
