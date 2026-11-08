/* Tunable numbers: XP curve, caps, storage key, tab order.
   The app is plain scripts loaded in index.html order (no build step); js/main.js starts it. */
// XP from level L to L+1: 100, +25 per level. Every step into a 10th level is a rank trial costing 1.5× (9→10 = 450).
const isBossStep = L => L % 10 === 9;
const WSIZES_OK = ['2x1', '4x1', '2x2', '4x2', '4x4'];
const XP_CAP = 1e9, GOLD_CAP = 1e12, REWARD_CAP = 1e6, VALUE_CAP = 1e7;
const xpToNext = L => { const base = 100 + 25 * (L - 1); return isBossStep(L) ? Math.round(base * 1.5 / 5) * 5 : base; };
// gold for reaching level L: 10 × its place in its band of 10, +5 per band; every 10th level pays 150, +50 per band
function levelReward(L){
  if (L < 2) return 0;
  const band = Math.floor((L - 1) / 10), k = L - band * 10;
  return k === 10 ? 150 + 50 * band : 10 * k + 5 * band;
}
const STORE_KEY = 'psych.v1';
const TABS = ['quests','progress','inventory','collection','shop'];
