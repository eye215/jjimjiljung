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
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
    const errors = [];
    const ready = async page => {
      page.setDefaultTimeout(120000);
      page.on('pageerror', error => errors.push(error.message));
      await page.waitForSelector('#viewport[data-ready="true"]');
    };
    // 1. Kakao SDK available: the feed message carries the invite link and preview image.
    const page = await context.newPage();
    await page.route('https://t1.kakaocdn.net/**', route => route.fulfill({ contentType: 'text/javascript', body: 'window.Kakao={_init:null,isInitialized(){return !!this._init},init(k){this._init=k},Share:{sendDefault(o){window.__kakaoShared=o}}};' }));
    await page.goto(base);
    await ready(page);
    await page.locator('#nickname').fill('보들식혜');
    await page.locator('#join-enter').click();
    assert.equal(await page.locator('#invite').isVisible(), true, 'Invite button is visible');
    const [invite, online] = await Promise.all([page.locator('#invite').boundingBox(), page.locator('.room-badge').boundingBox()]);
    const apart = invite.x + invite.width <= online.x || online.x + online.width <= invite.x || invite.y + invite.height <= online.y || online.y + online.height <= invite.y;
    assert(apart, 'Invite button does not cover the room badge');
    await page.locator('#invite').click();
    await page.waitForFunction(() => window.__kakaoShared);
    const shared = await page.evaluate(() => ({ message: window.__kakaoShared, key: window.Kakao._init }));
    assert.equal(shared.key, '550592a303d4d3172150fed087a4c2b4');
    assert.equal(shared.message.objectType, 'feed');
    assert.equal(shared.message.content.imageUrl, 'https://jjimjiljung.yullul.com/assets/share.jpg');
    const link = new URL(shared.message.buttons[0].link.mobileWebUrl);
    assert.equal(link.origin, 'https://jjimjiljung.yullul.com', 'Links point at the registered domain');
    assert.equal(link.searchParams.get('from'), '보들식혜', 'Invite carries the sender nickname');
    assert.match(shared.message.content.description, /보들식혜님이/);
    await page.screenshot({ path: path.join(output, 'invite.png') });
    // 2. SDK blocked: the link is copied instead.
    const offline = await context.newPage();
    await offline.route('https://t1.kakaocdn.net/**', route => route.abort());
    await offline.goto(base);
    await ready(offline);
    await offline.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined }); });
    await offline.locator('#invite').click();
    await offline.locator('#toast').waitFor({ state: 'visible' });
    assert.match(await offline.locator('#toast span').textContent(), /링크를 복사/);
    assert.match(await offline.evaluate(() => navigator.clipboard.readText()), /^https:\/\/jjimjiljung\.yullul\.com\/\?from=/);
    // 3. Arriving from an invite greets the visitor and tidies the address.
    const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await guest.goto(base + '?from=' + encodeURIComponent('보들식혜'));
    await ready(guest);
    assert.match(await guest.locator('#join-intro').textContent(), /보들식혜님의 초대로/);
    assert.equal(new URL(guest.url()).searchParams.has('from'), false, 'Invite parameter is removed from the address');
    const rude = await browser.newPage();
    await rude.goto(base + '?from=' + encodeURIComponent('씨발'));
    await ready(rude);
    assert.doesNotMatch(await rude.locator('#join-intro').textContent(), /씨발/, 'Rude invite names are ignored');
    assert.deepEqual(errors, [], 'No JS errors');
    console.log('PASS: 카카오톡 invite (SDK init with JS key, feed with preview image, links on jjimjiljung.yullul.com with sender), copy-link fallback when the SDK is blocked, invite greeting, address cleanup, rude names ignored, layout.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
