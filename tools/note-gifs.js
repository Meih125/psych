const {chromium}=require('playwright');const {execSync}=require('child_process');const fs=require('fs');
const path=require('path'),os=require('os');const ROOT=path.join(__dirname,'..'),TAG=process.env.TAG||'v131',OUT=path.join(ROOT,'docs','screenshots','notes')+'/',TMP=fs.mkdtempSync(path.join(os.tmpdir(),'psych-gif-'))+'/';
// Records short GIFs for the patch notes from Psych-preview.html (run `node tools/make-preview.js` first). Usage: TAG=v132 node tools/note-gifs.js [scene]
// Edit `scenes` for each release: what to do on screen, the crop (w:h:x:y of the 401x824 screen) and the length in seconds.
const scenes={
 pages:{crop:'401:824:0:0',dur:4.2,run:async (p,mk)=>{for(const t of ['progress','inventory','collection','shop','quests']){await p.evaluate(t=>{const b=document.querySelector(`[data-tab="${t}"]`)||document.querySelector(`[data-tab="${t==='inventory'?'pack':t}"]`);b.click()},t);await p.waitForTimeout(850)}}},
 claim:{crop:'401:300:0:0',dur:3.6,run:async (p,mk)=>{await p.evaluate(()=>{S.tab='quests';render()});await p.waitForTimeout(500);
  mk();await p.evaluate(()=>{const it=[...document.querySelectorAll('#panel .item[data-id]')].find(e=>e.querySelector('[data-act="claim"]')||e.querySelector('.card'));(it.querySelector('[data-act="claim"]')||it.querySelector('.card')).click()});await p.waitForTimeout(2000);
  await p.evaluate(()=>{const u=document.querySelector('#toastUndo');u&&u.click()});await p.waitForTimeout(1800)}},
 levelup:{crop:'401:300:0:0',dur:4.5,run:async (p,mk)=>{await p.evaluate(()=>{let x=0;while(levelInfo(x).L<19)x+=1;S.xp=x-5;S.rewardedLevel=18;render()});await p.waitForTimeout(500);
  mk();await p.evaluate(()=>{let x=0;while(levelInfo(x).L<20)x+=1;S.xp=x-5;render();grant({xp:30,gold:0},null)});await p.waitForTimeout(5000)}},
 packswipe:{crop:'401:640:0:110',dur:3.6,run:async (p,mk)=>{await p.evaluate(()=>{invItems().forEach((i,k)=>S.inv[i.id]=k==1?1:12);S.tab='inventory';invIdx=0;render()});await p.waitForTimeout(600);
  await p.evaluate(()=>invSlide(1));await p.waitForTimeout(1000);await p.evaluate(()=>invSlide(1));await p.waitForTimeout(1000);await p.evaluate(()=>invSlide(-1));await p.waitForTimeout(900)}},
 deal:{crop:'401:700:0:50',dur:4.2,run:async (p,mk)=>{await p.evaluate(()=>{S.inv[invItems()[0].id]=3;S.tab='inventory';invIdx=0;render()});await p.waitForTimeout(500);
  mk();await p.evaluate(()=>openDeck(invItems()[0].id));await p.waitForTimeout(1900);for(let i=0;i<2;i++){await p.evaluate(i=>{const c=document.querySelectorAll('#pack .pk-card')[i];c&&c.click()},i);await p.waitForTimeout(900)}}},
 openall:{crop:'401:760:0:60',dur:4.6,run:async (p,mk)=>{await p.evaluate(()=>{const id=invItems()[2].id;S.inv[id]=12;S.tab='inventory';invIdx=2;render()});await p.waitForTimeout(400);
  mk();await p.evaluate(()=>openAll(invItems()[2].id));await p.waitForTimeout(1500);for(let i=0;i<2;i++){await p.evaluate(()=>document.querySelector('#pack .oa-c.front').click());await p.waitForTimeout(500);await p.evaluate(()=>document.querySelector('#pack .oa-c.front').click());await p.waitForTimeout(700)}}},
 collection:{crop:'401:560:0:60',dur:5.6,run:async (p,mk)=>{await p.evaluate(()=>{S.tab='collection';render()});await p.waitForTimeout(900);
  await p.evaluate(()=>colSwitch('tarot'));await p.waitForTimeout(1100);await p.evaluate(()=>colSwitch('mlbb'));await p.waitForTimeout(1100);await p.evaluate(()=>document.querySelectorAll('.cc-chip')[0].click());await p.waitForTimeout(1000);await p.evaluate(()=>document.querySelector('.cc-chip.on').click());await p.waitForTimeout(900)}}
,
 holo:{crop:'401:640:0:90',dur:3.2,run:async (p,mk)=>{await p.evaluate(()=>inspectCard('HD_PR02'));await p.waitForTimeout(900);mk();
  for(const [x,y] of [[120,300],[280,260],[300,480],[140,500],[200,380]]){await p.mouse.move(x,y,{steps:14});await p.waitForTimeout(250)}}},
};
(async()=>{const b=await chromium.launch();const only=process.argv[2];
for(const [name,sc] of Object.entries(scenes)){if(only&&only!==name)continue;
 const ctx=await b.newContext({viewport:{width:401,height:824},recordVideo:{dir:TMP+name,size:{width:401,height:824}}});const p=await ctx.newPage();const t0=Date.now();
 await p.goto('file://'+path.join(ROOT,'Psych-preview.html'));await p.waitForTimeout(1500);await p.evaluate(()=>{ask=async()=>true;const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Hide bar');b&&b.click()});await p.waitForTimeout(300);
 let T=(Date.now()-t0)/1000;let M=null;await sc.run(p,()=>{M=(Date.now()-t0)/1000});if(M!==null)T=M;await ctx.close();
 const f=fs.readdirSync(TMP+name).find(x=>x.endsWith('.webm'));
 execSync(`ffmpeg -v error -y -ss ${T.toFixed(2)} -t ${sc.dur} -i ${TMP}${name}/${f} -vf "crop=${sc.crop},setpts=${sc.slow||1.5}*PTS,fps=12,scale=230:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" ${OUT}${TAG}-${name}.gif`);
 console.log(name,(fs.statSync(OUT+TAG+'-'+name+'.gif').size/1024|0)+'KB')}
await b.close()})()
