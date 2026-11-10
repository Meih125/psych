/* In-game patch notes: what the Patch notes screen in Settings shows (newest version first).
   Edit this with the in-game patch notes tool (tools/patchnotes.js), not by hand.
   A note: k = new | chg | fix (the orb colour), t = title, d = the grey line under it, snip = 1 shows a snippet card
   (img = a file in img/notes/, how = its numbered steps). Notes show in the order written. */
const PATCH_NOTES = [
{"v":"1.5.1","date":"Nov 10","tag":"Patch notes and step goal tickets","notes":[
{"k":"new","t":"Added Patch notes in Settings","d":"Every version, with snippets.","snip":0,"how":[]},
{"k":"chg","t":"Made half-size Tally tiles tidier","d":"Carried over sits on the right.","snip":0,"how":[]},
{"k":"fix","t":"Fixed the Goal button not coming back","d":"Walk another full goal and claim again. A ticket each time.","snip":0,"how":[]},
{"k":"fix","t":"Fixed the Black Market sitting in the wrong place after zooming","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed the Black Market on very narrow screens","d":"","snip":0,"how":[]}
]},
{"v":"1.5.0","date":"Nov 10","tag":"Lockpick, Gems and the Black Market","notes":[
{"k":"new","t":"Added Lockpick","d":"A third Den game.","snip":1,"img":"v150-lockpick.jpg","how":[]},
{"k":"new","t":"Added the Black Market","d":"Spend 3 Gems for a UR card.","snip":1,"img":"v150-added-the-black-market.jpg","how":[]},
{"k":"new","t":"Added half-size Record, Tally and List tiles","d":"Lists can have a column of neighbours.","snip":1,"img":"v150-added-half-size-record-tally.jpg","how":[]},
{"k":"new","t":"Added a Goal button on the step card.","d":"","snip":1,"img":"crop-goal.jpg","how":[]},
{"k":"new","t":"Added The Den to Earned today","d":"One row per game, with the gold won or lost.","snip":1,"img":"v150-added-the-den-to-earned-toda.jpg","how":[]},
{"k":"new","t":"Added Gems","d":"Earned in Lockpick at levels 12 and 18.","snip":0,"how":[]},
{"k":"new","t":"Added a free play","d":"Every tenth Den play costs no ticket.","snip":0,"how":[]},
{"k":"chg","t":"Reworked the NEW tag for pack opening","d":"","snip":0,"how":[]},
{"k":"chg","t":"Made all hint bubbles use one font","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed the Record and Tally boxes keeping the old number","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed the Black Market sitting off-centre on big screens","d":"","snip":0,"how":[]}
]},
{"v":"1.4.1","date":"Nov 8","tag":"Step sync fixes","notes":[
{"k":"chg","t":"Changed the gold and ticket counter animation","d":"","snip":0,"how":[]},
{"k":"chg","t":"Step sync reads every day on its own","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed step sync after a time zone change","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed step counts being a few steps low","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed the gold sometimes showing half digits","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed background step sync","d":"","snip":0,"how":[]}
]},
{"v":"1.4.0","date":"Nov 8","tag":"The Market and the Den","notes":[
{"k":"new","t":"Added the Market","d":"Cards you do not own, for sale. Use tickets to reroll.","snip":1,"img":"v140-added-the-market-2.jpg","how":[]},
{"k":"new","t":"Added the Gambling Den","d":"Use tickets to play.","snip":1,"img":"v140-den.jpg","how":[]},
{"k":"new","t":"Added tickets","d":"Earned from daily login, level-ups, the daily first pack, and step goals.","snip":0,"how":[]},
{"k":"chg","t":"Reworked the Shop look","d":"","snip":1,"img":"v140-shop.jpg","how":[]},
{"k":"chg","t":"Merged the reward chip","d":"One chip when XP and gold match.","snip":1,"img":"v140-merged-the-reward-chip.jpg","how":[]},
{"k":"chg","t":"Reworked the info icon look","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed Undo and late claims breaking streaks","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed Claimed? letting you claim days before a quest existed","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed the header gold showing a wrong amount","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed some List and widget bugs","d":"","snip":0,"how":[]}
]},
{"v":"1.3.1","date":"Nov 5","tag":"Animations and pack details","notes":[
{"k":"new","t":"Added a quest claim animation","d":"","snip":1,"img":"v131-added-quest-claim-animation-2.gif","how":[]},
{"k":"new","t":"Added a level-up animation","d":"","snip":1,"img":"v131-added-level-up-animation.gif","how":[]},
{"k":"new","t":"Added a Claimed? button in Progress","d":"","snip":1,"img":"v131-claimed.jpg","how":[]},
{"k":"new","t":"Added a Reset toggle to Record quests","d":"Record as many times as you like.","snip":1,"img":"v131-reset.jpg","how":[]},
{"k":"new","t":"Added a card view button","d":"View a card without effects.","snip":1,"img":"v131-added-card-view-button.jpg","how":[]},
{"k":"new","t":"Added a pack opening animation","d":"Tap to skip.","snip":0,"how":[]},
{"k":"new","t":"Added the Chibi set","d":"20 rare chibi cards in H.O.D.","snip":0,"how":[]},
{"k":"chg","t":"Reworked pack details","d":"","snip":1,"img":"v131-add-pack-details.jpg","how":[]},
{"k":"chg","t":"Reworked the Collection overview tab","d":"","snip":1,"img":"v131-overview.jpg","how":[]},
{"k":"fix","t":"Fixed Biweekly quests so they reset on every other Monday","d":"","snip":0,"how":[]}
]},
{"v":"1.3.0","date":"Nov 2","tag":"Hand of Destiny pack and holo cards","notes":[
{"k":"new","t":"Added the Hand of Destiny pack","d":"119 new cards.","snip":1,"img":"v130-added-the-hand-of-destiny-pa.jpg","how":[]},
{"k":"new","t":"Added holo cards","d":"UR, SSR and Joker.","snip":1,"img":"v130-holo.gif","how":[]},
{"k":"new","t":"Added collection arranging","d":"Hold a card to enlarge or move it.","snip":1,"img":"v130-arrange.jpg","how":["Hold a card","Release to enlarge it or drag it to move it"]},
{"k":"new","t":"Added header pictures","d":"Select up to 3 per set.","snip":1,"img":"v130-header.jpg","how":["Tap the header","Select up to 3"]},
{"k":"new","t":"Added pack details","d":"Tap a Shop banner.","snip":0,"how":[]},
{"k":"chg","t":"Reworked the collection display","d":"Pin board style.","snip":1,"img":"v130-reworked-the-collection-disp.jpg","how":[]},
{"k":"fix","t":"Fixed Weekly quests so they reset on Monday","d":"","snip":0,"how":[]}
]},
{"v":"1.2.1","date":"Nov 1","tag":"Counter, List and pinned quests","notes":[
{"k":"new","t":"Added the Counter quest","d":"Claim multiple times without a reset timer.","snip":1,"img":"v121-counter.jpg","how":[]},
{"k":"new","t":"Added pinned quests","d":"They sit at the top.","snip":1,"img":"v121-pin-form.jpg","how":["Open a quest to edit it","Tap the pin icon at the top right"],"img2":"v121-pin-board.jpg"},
{"k":"new","t":"Added the Earned today breakdown","d":"","snip":1,"img":"v121-add-earned-today-breakdown.jpg","how":[]},
{"k":"new","t":"Added a floating Add Quest button","d":"Switch sides with Left handed mode in Settings.","snip":1,"img":"v121-add-button.jpg","how":[]},
{"k":"new","t":"Added background step sync","d":"Widgets update every 15 minutes.","snip":1,"img":"v121-step-sync.jpg","how":[]},
{"k":"new","t":"Added step goal bonus multiplier","d":"Reach double your step goal and claim it ×2.","snip":1,"img":"v121-goal-bonus.jpg","how":[]},
{"k":"new","t":"Added Avoid auto-claim","d":"Clean days are claimed for you.","snip":1,"img":"v121-avoid-auto.jpg","how":[]},
{"k":"chg","t":"Changed Pair quest to List","d":"2 to 8 quests, bonus for all.","snip":1,"img":"v121-changed-pair-quest-to-list.jpg","how":[]},
{"k":"chg","t":"Reworked the 4x4 widget","d":"Pages, slimmer rows, Due Soon cards.","snip":1,"img":"v121-widget-4x4.jpg","how":[]},
{"k":"fix","t":"Fixed the tab bar on Android 16","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed the app icon size","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed some widget bugs","d":"","snip":0,"how":[]},
{"k":"fix","t":"Optimized battery use","d":"","snip":0,"how":[]}
]},
{"v":"1.2.0","date":"Oct 29","tag":"Daily login and widgets","notes":[
{"k":"new","t":"Added a daily login reward","d":"Gold, XP or a card.","snip":1,"img":"v120-daily.jpg","how":[]},
{"k":"new","t":"Added more widget sizes","d":"Up to 4×4.","snip":1,"img":"v120-widgets.jpg","how":[]},
{"k":"chg","t":"Changed Tally and Recurring UI","d":"","snip":1,"img":"v120-tally.jpg","how":[]},
{"k":"fix","t":"Fixed some bugs","d":"","snip":0,"how":[]},
{"k":"fix","t":"Optimized code","d":"","snip":0,"how":[]}
]},
{"v":"1.1.2","date":"Oct 28","tag":"Update check","notes":[
{"k":"new","t":"Added update check","d":"Once a day, with a banner on Quests.","snip":1,"img":"v112-update-banner.jpg","how":[]},
{"k":"new","t":"Added Settings > App","d":"Shows your version and a Check button.","snip":1,"img":"v112-settings-app.jpg","how":[]}
]},
{"v":"1.1.1","date":"Oct 28","tag":"Follow-up quests","notes":[
{"k":"chg","t":"Reworked follow-up quests","d":"They sit under their quest and unlock one at a time.","snip":1,"img":"v111-follow-ups.jpg","how":["Add a quest, then add a follow-up under it","The next one unlocks when the first is done"]},
{"k":"chg","t":"Updated the app icon","d":"","snip":0,"how":[]},
{"k":"fix","t":"Fixed some bugs","d":"","snip":0,"how":[]},
{"k":"fix","t":"Optimized code","d":"","snip":0,"how":[]}
]},
{"v":"1.1.0","date":"Oct 27","tag":"Widgets and Arrange","notes":[
{"k":"new","t":"Added undo for more claims","d":"","snip":1,"img":"v110-added-undo-for-more-claims.jpg","how":["Claim something","Tap UNDO in the toast that appears"]},
{"k":"new","t":"Added home-screen widgets","d":"6 layouts, 4 sizes.","snip":0,"how":[]},
{"k":"chg","t":"Reworked Arrange mode","d":"Opens from the icon next to Quests.","snip":1,"img":"v110-arrange.jpg","how":["Tap the Arrange icon next to Quests","Drag the dots to move a quest","HALF / FULL sets its size"]},
{"k":"chg","t":"Reworked animations","d":"Claims, packs and rewards.","snip":0,"how":[]},
{"k":"fix","t":"Fixed some bugs","d":"","snip":0,"how":[]}
]}
];
