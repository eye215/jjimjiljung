// Quiet onboarding: use the existing scene hint for timed warmth, not new popups.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req,res) => {
  const u = new URL(req.url,'http://localhost');
  const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(e,buf)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream');res.end(buf);});
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const create=async({cap=false,viewport={width:390,height:844}}={})=>{
      const page=await browser.newPage({viewport});
      page.setDefaultTimeout(60000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(cap=>{
        localStorage.setItem('jjimjiljung-key','49');
        localStorage.setItem('jjimjiljung-tour-v1',JSON.stringify({done:[],off:true}));
        if(cap){
          const d=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
          localStorage.setItem('jjimjiljung-wallet-v1',JSON.stringify({points:16,bag:{egg:1,drink:2},free:{egg:d,drink:d},earnedDay:d,earned:60}));
        }
      },cap);
      await page.route('**/scene.js*',async route=>{
        const response=await route.fetch();
        await route.fulfill({response,body:(await response.text())+
          '\nwindow.__warmthQA={position:(x,z)=>{route.length=0;hero.position.set(x,0,z);target.copy(hero.position);view.focus.set(x,0,z)},setRest:n=>{restTimer=n},wallet:()=>wallet.snapshot(),toast:(...args)=>toast(...args)};' });
      });
      await page.goto(process.env.TEST_URL||`http://127.0.0.1:${server.address().port}/`);
      await page.waitForSelector('#viewport[data-ready="true"]');
      if(await page.locator('#join-dialog').evaluate(x=>x.open))await page.locator('#join-solo').click();
      return {page,errors};
    };
    const {page,errors}=await create();
    assert.equal(await page.evaluate(()=>localStorage.getItem('jjimjiljung-key')),'49');
    await page.locator('[data-action="sit"]').click();
    await page.waitForFunction(()=>/초 뒤 온기 \+1/.test(document.querySelector('#hint').textContent));
    assert.match(await page.locator('#hint').textContent(),/모아서 식혜·계란을 살 수 있어요/);
    assert.equal(await page.locator('#hint').evaluate(x=>x.classList.contains('warmth-active')),true,'No additional reward popup needed');
    let css=await page.evaluate(()=>{
      const nodes=['.brand','#wallet','.controls','#joystick','#chat-form','.scene-hint','#game','#tour'];
      return nodes.map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return {selector:s,glass:c.backdropFilter||c.webkitBackdropFilter,bg:c.backgroundImage,radius:c.borderRadius};});
    });
    assert(css.every(x=>/blur\(/.test(x.glass)), 'All HUD, sheets and input bars share frosted backdrop');
    assert(css.filter(x=>!['#game','#tour'].includes(x.selector)).every(x=>x.bg.includes('gradient')), 'Liquid glass gradients use one visual language');
    await page.screenshot({path:path.join(output,'warmth-glass-mobile.png')});
    await page.evaluate(()=>window.__warmthQA.setRest(29.4));
    await page.waitForFunction(()=>window.__warmthQA.wallet().points>=11);
    assert.equal(await page.locator('#toast').isVisible(),false,'Routine warmth reward is not another popup');
    assert.equal(await page.evaluate(()=>localStorage.getItem('jjimjiljung-key')),'49','Resting must not reset locker key');
    await page.locator('[data-action="stand"]').click();
    await page.waitForFunction(()=>!document.querySelector('#hint').classList.contains('warmth-active'));
    await page.evaluate(()=>window.__warmthQA.position(3.1,-8.4));
    await page.waitForFunction(()=>document.querySelector('#viewport').dataset.room==='hot');
    await page.locator('[data-action="sit"]').click();
    await page.waitForFunction(()=>/초 뒤 온기 \+2/.test(document.querySelector('#hint').textContent));
    await page.evaluate(()=>window.__warmthQA.setRest(29.4));
    const before=await page.evaluate(()=>window.__warmthQA.wallet().points);
    await page.waitForFunction(before=>window.__warmthQA.wallet().points>=before+2,before);
    await page.evaluate(()=>window.__warmthQA.toast('UI 정리 검증'));
    const rects=await page.evaluate(()=>{
      const r=s=>document.querySelector(s).getBoundingClientRect(),a=r('#toast');
      const overlap=b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      return {overlapWallet:overlap(r('#wallet')),overlapControls:overlap(r('.controls')),overlapNav:overlap(r('.room-badge'))};
    });
    assert(!Object.values(rects).some(Boolean),'Toast must not obscure the wallet, room name or bottom controls');
    await page.screenshot({path:path.join(output,'warmth-glass-toast-mobile.png')});
    assert.deepEqual(errors,[],'Mobile UI has no runtime errors');await page.close();
    const capped=await create({cap:true});
    await capped.page.locator('[data-action="sit"]').click();
    await capped.page.waitForFunction(()=>/오늘 모을 수 있는 온기는 다 모았어요/.test(document.querySelector('#hint').textContent));
    await capped.page.evaluate(()=>window.__warmthQA.setRest(29.4));
    await capped.page.waitForTimeout(1000);
    assert.equal((await capped.page.evaluate(()=>window.__warmthQA.wallet())).points,16,'Daily capped user receives no extra points');
    assert.deepEqual(capped.errors,[]);await capped.page.close();
    const desktop=await create({viewport:{width:1280,height:800}});
    await desktop.page.locator('[data-action="lie"]').click();
    await desktop.page.waitForFunction(()=>/초 뒤 온기 \+1/.test(document.querySelector('#hint').textContent));
    await desktop.page.screenshot({path:path.join(output,'warmth-glass-desktop.png')});
    assert.deepEqual(desktop.errors,[]);await desktop.page.close();
    console.log('PASS: 390px iPhone-sized + desktop unified frosted glass, countdown, shopping tip, +1/+2 rewards, no routine reward toast, capped daily rewards, no saved key reset, no HUD overlap');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
