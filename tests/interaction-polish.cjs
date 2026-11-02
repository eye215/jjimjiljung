const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const output = path.join(root,'test-results');
fs.mkdirSync(output,{recursive:true});
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost'), file = path.resolve(root, '.' + (u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname)));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, contents) => {
    if (err) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'})[path.extname(file)] || 'application/octet-stream');
    res.end(contents);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    page.setDefaultTimeout(40000);
    const errors = []; page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('jjimjiljung-key','30');
      localStorage.setItem('jjimjiljung-nickname','방문자');
      localStorage.setItem('jjimjiljung-wallet-v1',JSON.stringify({points:30,bag:{egg:2,drink:2},free:{egg:'2026-10-30',drink:'2026-10-30'}}));
    });
    await page.route('**/scene.js*', async request => {
      const response = await request.fetch();
      await request.fulfill({response,body:(await response.text())+
        '\nwindow.__p = {tp:(x,z)=>{route.length=0;hero.position.set(x,0,z);target.copy(hero.position);view.focus.set(x,0,z)},state:()=>({action,waveTimer,posture:action,chair:seatedChair?.id||null,position:hero.position.toArray(),fortuneNPC:residents.some(r=>r.config.fortuneTeller),snack:player.snack?.kind||null,holder:player.snackRoot?.parent?.name||"none"})};'});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/?net=local`);
    await page.waitForSelector('#viewport[data-ready="true"]');
    await page.waitForFunction(()=>document.querySelector('#online').dataset.status==='online');
    await page.locator('#online').click();
    assert.equal(await page.locator('#visitor-stats').isVisible(),true,'Click online chip opens stats');
    assert.match(await page.locator('#visitor-live').textContent(),/명/,'Live presence count');
    assert.equal(await page.locator('#visitor-today').textContent(),'—','Offline/local counts are not invented');
    await page.locator('#visitor-stats-close').click();
    await page.locator('[data-action="sit"]').click();
    await page.locator('[data-action="wave"]').click();
    assert.equal((await page.evaluate(()=>window.__p.state())).action,'sit','Greeting while seated retains posture');
    await page.locator('[data-action="lie"]').click();
    assert.equal(await page.locator('[data-action="egg"]').isDisabled(),true,'Lying blocks eggs');
    assert.equal(await page.locator('[data-action="drink"]').isDisabled(),true,'Lying blocks drinks');
    await page.locator('[data-action="wave"]').click();
    assert.equal((await page.evaluate(()=>window.__p.state())).action,'lie','Greeting while lying retains posture');
    await page.screenshot({path:path.join(output,'lying-greeting-mobile.png')});
    await page.locator('[data-action="stand"]').click();
    assert.equal(await page.locator('[data-action="egg"]').isDisabled(),false,'Standing enables egg');
    await page.locator('[data-action="egg"]').click();
    await page.locator('#game [data-tap]').click();
    await page.waitForFunction(()=>window.__p.state().snack==='egg');
    assert.equal((await page.evaluate(()=>window.__p.state())).action,'stand','Egg game keeps standing posture');
    await page.locator('#game-close').click();
    await page.locator('[data-action="drink"]').click();
    await page.waitForFunction(()=>window.__p.state().snack==='drink');
    assert.equal((await page.evaluate(()=>window.__p.state())).action,'stand','Drinking keeps standing posture');
    const prop=await page.evaluate(()=>({parentIsBone:!!player.snackRoot.parent?.isBone, visible:player.snackRoot.visible, relativeToHead:player.snackRoot.getWorldPosition(new THREE.Vector3()).distanceTo(player.head.getWorldPosition(new THREE.Vector3()))}));
    assert.equal(prop.parentIsBone,false,'Sikhye cup must be anchored to the torso, not the shoulder-rotating hand bone');
    assert.equal(prop.visible,true,'Sikhye cup remains visible while drinking');
    assert(prop.relativeToHead<2.5,'Sikhye cup stays near the mouth and upper body');
    await page.screenshot({path:path.join(output,'standing-sikhye-cup-mobile.png')});
    await page.locator('#game-close').click();
    await page.evaluate(()=>window.__p.tp(-1.1,5.48));
    await page.locator('#spot-action',{hasText:'의자'}).waitFor({state:'visible'});
    await page.locator('#spot-action').click();
    await page.waitForFunction(()=>window.__p.state().chair!==null);
    assert.equal((await page.evaluate(()=>window.__p.state())).action,'sit','Clicking chair puts character onto real bench');
    await page.locator('[data-action="stand"]').click();
    assert.equal((await page.evaluate(()=>window.__p.state())).chair,null,'Standing leaves furniture at walkable approach');
    await page.evaluate(()=>window.__p.tp(-11.5,11.7));
    await page.locator('#spot-action',{hasText:'운세'}).click();
    assert.equal((await page.evaluate(()=>window.__p.state())).fortuneNPC,true,'Fortune teller waits in room');
    await page.locator('#fortune-date').fill('1994-02-15');
    await page.locator('#fortune-time').fill('17:59');
    await page.locator('#fortune-go').click();
    await page.locator('#fortune-result').waitFor({state:'visible'});
    assert.match(await page.locator('#fortune-result').textContent(),/사주 선생님이 들려주는 오늘의 이야기/);
    assert.match(await page.locator('#fortune-result').textContent(),/행운의 숫자/);
    assert.deepEqual(errors,[], 'No runtime errors on iPhone-sized viewport');
    console.log('PASS stats popover, chair sitting, snack blocking when reclining, standing snacks, sit/lie greetings and dynamic fortune teller');
    await page.close();
  } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
