const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.png': 'image/png' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain');
    res.end(data);
  });
});
const FAKE_ADS = `(function () {
  const queue = Array.isArray(window.adsbygoogle) ? window.adsbygoogle : [];
  const handle = o => {
    if (!o || o.type !== 'reward') return;
    const mode = window.__adMode || 'viewed';
    setTimeout(() => {
      if (mode === 'none') { o.adBreakDone && o.adBreakDone({ breakStatus: 'noAdPreloaded' }); return; }
      o.beforeReward(() => {
        o.beforeAd && o.beforeAd(); window.__adShowing = true;
        setTimeout(() => {
          window.__adShowing = false;
          if (mode === 'viewed') o.adViewed(); else o.adDismissed();
          o.afterAd && o.afterAd(); o.adBreakDone({ breakStatus: mode });
        }, 600);
      });
    }, 150);
  };
  window.adsbygoogle = { push: handle };
  queue.forEach(handle);
})();`;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async ({ mode = 'viewed', wallet = null, client = 'ca-pub-0000000000000000' } = {}) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    page.setDefaultTimeout(120000);
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    // Shift wall-clock time (not animation time) to test the 2-minute gap and midnight.
    await page.addInitScript(([mode, wallet]) => {
      window.__timeShift = 0; window.__adMode = mode;
      const RealDate = Date;
      window.Date = class extends RealDate { constructor(...args) { if (args.length) super(...args); else super(RealDate.now() + window.__timeShift); } static now() { return RealDate.now() + window.__timeShift; } };
      if (wallet) localStorage.setItem('jjimjiljung-wallet-v1', JSON.stringify(wallet));
      localStorage.setItem('jjimjiljung-nickname', '');
    }, [mode, wallet]);
    await page.route('**/config.js*', async route => { const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace("ADSENSE_CLIENT = ''", `ADSENSE_CLIENT = '${client}'`) }); });
    await page.route('https://pagead2.googlesyndication.com/**', route => route.fulfill({ contentType: 'text/javascript', body: FAKE_ADS }));
    await page.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.__tv = { state: () => ({ action, room: currentRoom.id, points: wallet.snapshot().points, ads: wallet.adStatus(), tv: tvAds.state, playing: adPlaying }), teleport: (x, z) => { route.length = 0; hero.position.set(x, 0, z); view.focus.set(x, 0, z); target.copy(hero.position); } };' });
    });
    await page.goto(base);
    await page.waitForSelector('#viewport[data-ready="true"]');
    if (await page.locator('#join-dialog').evaluate(d => d.open)) await page.locator('#join-solo').click();
    return { page, requests, errors };
  };
  const state = page => page.evaluate(() => window.__tv.state());
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  try {
    // 1. Short of 온기 in the shop → walk to the TV, sit, and the ad button appears.
    const { page, requests, errors } = await open({ wallet: { points: 0, bag: { egg: 0, drink: 0 }, free: { egg: today, drink: today } } });
    await page.locator('#wallet').click();
    assert.match(await page.locator('#shop-tv p').textContent(), /TV를 보고 오면/);
    assert.equal(await page.locator('[data-snack="egg"] .short').isVisible(), true, 'Buy button is replaced when 온기 is short');
    assert(!requests.some(url => url.includes('googlesyndication')), 'No ad script before sitting at the TV');
    await page.evaluate(() => window.__tv.teleport(-3.2, 2.6));
    await page.locator('#shop-tv button').click();
    await page.waitForFunction(() => { const s = window.__tv.state(); return s.action === 'sit' && s.tv === 'ready'; });
    assert.match(await page.locator('#tv-ad').textContent(), /광고 보고 온기 받기 \(\+3♨\)/);
    assert(requests.some(url => url.includes('googlesyndication') && url.includes('client=ca-pub-')), 'Ad script loads on sitting');
    await page.screenshot({ path: path.join(output, 'tv-ready.png') });
    // 2. Watched to the end → +3 and a cheer; rendering pauses during the ad.
    await page.locator('#tv-ad').click();
    await page.waitForFunction(() => window.__adShowing === true);
    assert.equal((await state(page)).playing, true, 'Rendering and sound pause during the ad');
    await page.waitForFunction(() => window.__tv.state().points === 3);
    assert.match(await page.locator('#toast span').textContent(), /온기 \+3/);
    await page.waitForFunction(() => window.__tv.state().tv === 'cooldown');
    assert.match(await page.locator('#tv-ad').textContent(), /분 뒤에 또/, 'Ads are 2 minutes apart');
    await page.screenshot({ path: path.join(output, 'tv-reward.png') });
    // 3. Closed early → nothing.
    await page.evaluate(() => { window.__timeShift += 121000; window.__adMode = 'dismissed'; });
    await page.waitForFunction(() => window.__tv.state().tv === 'ready');
    await page.locator('#tv-ad').click();
    await page.waitForFunction(() => /다음에 또 봐요/.test(document.querySelector('#toast span').textContent));
    assert.equal((await state(page)).points, 3, 'Closing early gives nothing');
    // 4. Three a day, then the day is done; midnight resets it.
    await page.evaluate(() => { window.__adMode = 'viewed'; });
    for (const expected of [6, 9]) {
      await page.evaluate(() => { window.__timeShift += 121000; });
      await page.waitForFunction(() => window.__tv.state().tv === 'ready');
      await page.locator('#tv-ad').click();
      await page.waitForFunction(points => window.__tv.state().points === points, expected);
    }
    await page.evaluate(() => { window.__timeShift += 121000; });
    await page.waitForFunction(() => window.__tv.state().tv === 'done');
    assert.match(await page.locator('#tv-ad').textContent(), /오늘 광고는 다 봤어요/);
    // The shop now suggests resting instead.
    await page.locator('#wallet').click();
    await page.locator('[data-snack="egg"] [data-buy]').click();
    assert.match(await page.locator('#shop-tv p').textContent(), /불가마나 소금방에서 쉬면 온기가 두 배/, 'Rest tip once ads are used up');
    assert.equal(await page.locator('#shop-tv button').isVisible(), false);
    await page.locator('#shop-close').click();
    await page.evaluate(() => { window.__timeShift += 24 * 3600000; });
    await page.waitForFunction(() => window.__tv.state().ads.left === 3);
    await page.waitForFunction(() => window.__tv.state().tv === 'ready', null, { timeout: 30000 });
    assert.deepEqual(errors, [], 'No JS errors');
    await page.close();
    // 5. No ad available → a gentle message, no error; the shop suggests resting.
    const none = await open({ mode: 'none', wallet: { points: 0, bag: { egg: 0, drink: 0 }, free: { egg: today, drink: today } } });
    await none.page.evaluate(() => window.__tv.teleport(-4.6, 2.4));
    await none.page.locator('[data-action="sit"]').click();
    await none.page.waitForFunction(() => window.__tv.state().tv === 'none');
    assert.match(await none.page.locator('#tv-ad').textContent(), /지금은 볼 수 있는 광고가 없어요/);
    assert.equal(await none.page.locator('#tv-ad').isDisabled(), true);
    await none.page.locator('#wallet').click();
    assert.match(await none.page.locator('#shop-tv p').textContent(), /불가마나 소금방/);
    assert.deepEqual(none.errors, []);
    await none.page.close();
    // 6. Without a publisher id the ad script never loads.
    const noId = await open({ client: '' });
    await noId.page.evaluate(() => window.__tv.teleport(-4.6, 2.4));
    await noId.page.locator('[data-action="sit"]').click();
    await noId.page.waitForFunction(() => window.__tv.state().tv === 'none');
    assert(!noId.requests.some(url => url.includes('googlesyndication')), 'No ad script without a publisher id');
    console.log('PASS: TV ad button when seated, script loads only then, shop shortage → walk to TV, reward on full view with pause, nothing on dismiss, 2-minute gap, 3 a day, rest tip after, midnight reset, no-ad and no-id fallbacks.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
