/* Start-up. Every script before this one only defines things; this file loads the save, wires each feature
   (the init* functions, in this order), then draws the app once. js/den/den.js loads after it. */
load();
S.tab = 'quests';   // the app always opens on Quests

initNative();   // the phone bridge first: start-up jobs below (backup check, step sync) use it
autoSync(true);
// core
initClock();
initState();
initHealth();
// features (order matters only for listeners on the same element, e.g. #panel and #pack)
initTally();
initProgress();
initOpening();
initRender();
initInspect();
initDialog();
initArrange();
initForm();
initSettings();
initBackup();
initInfo();
initActions();
initNav();
initCollection();
initRank();
initInventory();
initShop();
initBoard();
initDatePicker();
initNumberField();
initUpdates();
initDailyLogin();
initWidgetsScreen();
initBirthday();
initKinds();

if (!S.lvSwept) { lvSweep(); save(); }   // old spare copies level up right away; their screen shows with the first pack
render();
tickStart();
