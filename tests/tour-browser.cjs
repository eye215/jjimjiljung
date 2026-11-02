// Tour integration through real UI handlers. Teleport only shortens room travel;
// navigation/door collisions have their own 144-route and browser smoke checks.
const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),output=path.join(root,'test-results','tour');fs.mkdirSync(output,{recursive:true});
const probe=`
window.__tourQA={
 state:()=>({room:currentRoom.id,step:tour.step,done:loadTour().done,plush:kit.plush,route:route.length,destination:activeDestination?.id,action,snack:!!player.snack}),
 tp:(x,z)=>{setAction('stand');route.length=0;activeDestination=null;hero.position.set(x,0,z);view.focus.set(x,0,z);target.copy(hero.position);},
 place:id=>{const p=id==='tv'?TV_SEAT:id==='towel'?TOWEL_SPOT:DESTINATIONS[id];window.__tourQA.tp(p.x,p.z);},
 finishTimedActivity:()=>{if(soak)soak.t=.01;if(scrubbing)scrubbing=.01;},
 stats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,pixelRatio:renderer.getPixelRatio()})
};`;
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(file===path.join(root,'scene.js')?b.toString()+probe:b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await context.addInitScript(()=>{if(!localStorage.getItem('jjimjiljung-wallet-v1'))localStorage.setItem('jjimjiljung-wallet-v1',JSON.stringify({points:100,bag:{egg:3,drink:3},free:{egg:'',drink:''}}));});
  if(process.argv.includes('--drink-only'))await context.addInitScript(()=>{localStorage.setItem('jjimjiljung-key','31');localStorage.setItem('jjimjiljung-tour-v1',JSON.stringify({done:['desk','bath','locker','towel','lobby','hot','tv','egg','ice'],off:false}));});
  const page=await context.newPage(),errors=[],layout=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
  const ready=async()=>{await page.waitForSelector('#viewport[data-ready="true"]');if(await page.locator('#join-dialog').evaluate(d=>d.open))await page.locator('#join-solo').click();};
  const state=()=>page.evaluate(()=>window.__tourQA.state());
  const step=async id=>{await page.waitForFunction(id=>window.__tourQA.state().step===id,id);console.log('STEP',id);};
  const done=id=>page.waitForFunction(id=>window.__tourQA.state().done.includes(id),id);
  const place=async id=>{await page.evaluate(id=>window.__tourQA.place(id),id);await page.waitForFunction(id=>window.__tourQA.state().room===id,id==='tv'?'lobby':id==='towel'?'shop':id);};
  const tp=(x,z)=>page.evaluate(([x,z])=>window.__tourQA.tp(x,z),[x,z]);
  const checkLayout=async label=>{await page.locator('#tour').waitFor({state:'visible'});const overlaps=await page.evaluate(()=>{const tour=document.querySelector('#tour').getBoundingClientRect();return ['#joystick','.controls','#dress button','#spot-action'].flatMap(s=>[...document.querySelectorAll(s)]).filter(el=>{const b=el.getBoundingClientRect();return b.width&&b.height&&getComputedStyle(el).visibility!=='hidden'&&tour.left<b.right&&tour.right>b.left&&tour.top<b.bottom&&tour.bottom>b.top;}).map(e=>e.id||e.className);});layout.push({label,overlaps});await page.screenshot({path:path.join(output,label+'.png')});};
  await page.goto(base+'/?net=local&tour=1');await ready();
  if(process.argv.includes('--drink-only')){
    await step('drink');await page.locator('[data-tour-go]').click();await page.locator('#game-result').waitFor({state:'visible'});await page.locator('#game [data-game-close]').click();await page.waitForFunction(()=>!window.__tourQA.state().snack);
    assert((await state()).done.includes('drink'),'Finished sikhye mini-game completes the drink tour step');console.log('PASS: completed sikhye marks tour drink step');return;
  }
  await step('desk');assert.equal((await state()).room,'entrance');assert((await state()).plush);
  await checkLayout('mobile-new-visitor');await page.locator('[data-tour-go]').click();await page.locator('#spot-action',{hasText:'열쇠'}).click();await step('locker');
  const key=await page.evaluate(()=>localStorage.getItem('jjimjiljung-key'));assert(+key>=1&&+key<=120);
  assert.equal(await page.evaluate(()=>localStorage.getItem('jjimjiljung-issued-towel-v1')),'1','The entrance hands out a raw towel');
  await tp(-6,11);await page.locator('#spot-action',{hasText:'사물함'}).click();await step('towel');
  await page.reload();await ready();await step('towel');assert.equal(await page.evaluate(()=>localStorage.getItem('jjimjiljung-key')),key);
  // Use the entrance-issued towel where the visitor changes; the shop shelf still works afterwards.
  await page.locator('[data-tour-go]').click();await page.locator('#towel-game').waitFor({state:'visible'});
  const cloth=await page.locator('.towel-cloth').boundingBox();await page.mouse.move(cloth.x+cloth.width/2,cloth.y+20);await page.mouse.down();await page.mouse.move(cloth.x+cloth.width/2,cloth.y+120,{steps:6});await page.mouse.up();await page.locator('#towel-step',{hasText:'2/3'}).waitFor();
  for(let i=0;i<5;i++){await page.locator('[data-side=left]').click();await page.locator('[data-side=right]').click();}await page.locator('#towel-finish').click();await done('towel');await step('bath');
  await page.locator('[data-tour-go]').click();assert.equal((await state()).destination,'bath');assert((await state()).route>0);
  await tp(.6,9.7);await page.locator('#spot-action',{hasText:'온탕'}).click();
  await done('bath');await step('lobby'); // Soak entry counts immediately, reward still runs separately.
  await page.evaluate(()=>window.__tourQA.finishTimedActivity());await page.locator('[data-action="stand"]').click();
  await place('lobby');await step('hot');await checkLayout('mobile-lobby');
  await page.setViewportSize({width:1280,height:800});await checkLayout('desktop-lobby');await page.setViewportSize({width:390,height:844});
  await place('hot');await step('tv');await place('tv');await page.locator('[data-tour-go]').click();await step('egg');
  await page.locator('[data-tour-go]').click();await page.locator('#game [data-tap]').click();await page.locator('#game-result').waitFor();await page.locator('#game [data-game-close]').click();await done('egg');await step('ice');
  await place('ice');await step('drink');
  // Cancellation must not complete the tour, but finishing the mini-game must.
  await page.locator('[data-tour-go]').click();await page.locator('#game-close').click();assert(!(await state()).done.includes('drink'));
  await page.locator('[data-tour-go]').click();await page.locator('#game [data-hold]').waitFor();await page.locator('#game-result').waitFor({state:'visible'});await page.locator('#game [data-game-close]').click();
  await done('drink');await step('salt');await place('salt');await step('fortune');
  await tp(-11.5,11.8);await page.locator('#spot-action',{hasText:'운세'}).click();await page.locator('#fortune-dialog[open]').waitFor();await page.locator('#fortune-close').click();await step('scrub');
  await tp(11.5,11);await page.locator('#spot-action',{hasText:'세신'}).click();await page.evaluate(()=>window.__tourQA.finishTimedActivity());await done('scrub');await page.locator('[data-action="stand"]').click();await step('sleep');
  await place('sleep');await page.locator('[data-action="lie"]').click();await done('sleep');assert.equal((await state()).done.length,14);assert.equal((await state()).step,null);
  await page.reload();await ready();assert.equal((await state()).done.length,14);assert.equal((await state()).step,null);
  const savedBag=await page.evaluate(()=>localStorage.getItem('jjimjiljung-wallet-v1'));
  const savedOutfit=await page.evaluate(()=>localStorage.getItem('jjimjiljung-outfit-v2'));
  // Explicit replay is allowed, but no save-data key except the tutorial changes.
  await page.locator('#places-open').click();await page.locator('#tour-restart').click();await step('desk');
  assert.equal(await page.evaluate(()=>localStorage.getItem('jjimjiljung-key')),key);
  assert.equal(await page.evaluate(()=>localStorage.getItem('jjimjiljung-wallet-v1')),savedBag);
  assert.equal(await page.evaluate(()=>localStorage.getItem('jjimjiljung-outfit-v2')),savedOutfit);
  await page.reload();await ready();await step('desk');
  // A pre-tour visitor with a locker key must retain the lobby start and no nudge.
  await page.evaluate(()=>{localStorage.removeItem('jjimjiljung-tour-v1');localStorage.setItem('jjimjiljung-key','31');});await page.reload();await ready();assert.equal((await state()).room,'lobby');assert.equal((await state()).step,null);
  const stats=await page.evaluate(()=>window.__tourQA.stats());
  const frames=await page.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now();function tick(t){times.push(t-last);last=t;if(times.length<60)requestAnimationFrame(tick);else resolve(times);}requestAnimationFrame(tick);}));
  const moduleVersions=await page.evaluate(()=>{const byPath={};for(const e of performance.getEntriesByType('resource')){const u=new URL(e.name);if(u.pathname.endsWith('.js'))(byPath[u.pathname]??=new Set()).add(u.search);}return Object.entries(byPath).filter(([,v])=>v.size>1).map(([p,v])=>[p,[...v]]);});
  const report={layout,stats,frameMs:{mean:frames.reduce((a,b)=>a+b,0)/frames.length,p95:frames.slice().sort((a,b)=>a-b)[56]},moduleVersions,errors};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(moduleVersions,[],'No duplicate module versions');assert(layout.every(x=>x.overlaps.length===0),'Tour must not cover controls: '+JSON.stringify(layout));
  console.log('PASS browser tour: key+towel+outfit → locker → sheep cap → bath → lobby; immediate bath completion, 14 hooks, replay preserves belongings, legacy visitors unaffected');console.log(JSON.stringify(report));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
