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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    // Instrument only the test response, keeping debug state out of production.
    await page.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.__characterTestState = () => ({ action, arms: arms.map(a => [a.rotation.x,a.rotation.z]), legs: legs.map(a => [a.rotation.x,a.rotation.z]), position: [hero.position.x,hero.position.z], target: [target.x,target.z], joystick: [joystickInput.x,joystickInput.z], destination: activeDestination?.id || null, routeRemaining: route.length, expression: Object.entries(faces).find(([,texture]) => texture === faceMaterial.map)?.[0] });' });
    });
    // Reproduce a stale first RAF timestamp after slow shader compilation.
    await page.addInitScript(() => {
      const original = window.requestAnimationFrame; let first = true;
      window.requestAnimationFrame = callback => original.call(window, timestamp => {
        if (first) { first = false; callback(timestamp - 1000); } else callback(timestamp);
      });
    });
    const errors = [], failed = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failed.push(request.url()));
    page.on('request', request => { if (new URL(request.url()).origin !== new URL(base).origin) external.push(request.url()); });
    await page.goto(base);
    await page.waitForSelector('#viewport[data-ready="true"]');
    await page.waitForTimeout(800);
    const initialRig = await page.evaluate(() => window.__characterTestState());
    assert(initialRig.arms.flat().every(angle => Number.isFinite(angle) && Math.abs(angle) < .2), 'Stale initial RAF must not destabilize resting arms');
    assert.equal(await page.locator('#loading').isVisible(), false);
    assert.equal(await page.locator('#error').isVisible(), false);
    assert(await page.locator('#backdrop').evaluate(img => img.complete && img.naturalWidth > 1000), 'Reference background must load before ready');
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    for (const size of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 820, height: 1180 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      const [controller, tray] = await Promise.all([page.locator('#joystick').boundingBox(), page.locator('.controls').boundingBox()]);
      assert(controller.x + controller.width <= tray.x || controller.x >= tray.x + tray.width || controller.y + controller.height <= tray.y || controller.y >= tray.y + tray.height, 'Action tray never covers the joystick');
      for (const action of ['sit', 'lie', 'egg', 'drink', 'wave', 'stand']) {
        await page.locator(`[data-action="${action}"]`).click();
        assert.equal(await page.locator(`[data-action="${action}"]`).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.actions [aria-pressed="true"]').count(), 1);
        const joints = await page.evaluate(() => window.__characterTestState());
        assert([...joints.arms.flat(), ...joints.legs.flat()].every(angle => Number.isFinite(angle) && Math.abs(angle) < 3.2), 'Joint rotations stay within natural pose limits');
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const panBefore = await page.locator('#viewport').getAttribute('data-pan');
    await page.mouse.move(300, 370); await page.mouse.down();
    await page.mouse.move(80, 370, { steps: 8 }); await page.mouse.up();
    assert.notEqual(await page.locator('#viewport').getAttribute('data-pan'), panBefore, 'Drag pans the shared background/actor camera');
    await page.locator('#recenter').click();
    assert.notEqual(await page.locator('#viewport').getAttribute('data-pan'), '1.000', 'Recenter returns toward the player');
    // Every location is a reachable point in front of a room, not an invented interior.
    for (const destination of ['salt', 'ice', 'hot', 'shop', 'rest']) {
      await page.locator('#places-open').click();
      assert.equal(await page.locator('#places-dialog').evaluate(dialog => dialog.open), true);
      await page.locator(`[data-place="${destination}"]`).click();
      assert.equal(await page.locator('#places-dialog').evaluate(dialog => dialog.open), false);
      const journey = await page.evaluate(() => window.__characterTestState());
      assert.equal(journey.destination, destination);
      assert.equal(journey.action, 'stand');
      assert(journey.target.every(Number.isFinite), 'Destination has a finite ground position');
    }
    await page.locator('#places-open').click();
    await page.screenshot({ path: path.join(output, 'places.png'), fullPage: true });
    const paused = await page.evaluate(() => window.__characterTestState());
    assert.equal(paused.routeRemaining, 0, 'Opening the dialog cancels walking');
    assert.deepEqual(paused.joystick, [0, 0]);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const stillPaused = await page.evaluate(() => window.__characterTestState());
    assert(Math.hypot(...stillPaused.position.map((value, i) => value - paused.position[i])) < .01, 'No movement behind a modal');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#places-dialog').evaluate(dialog => dialog.open), false);
    assert.equal(await page.locator('#places-open').evaluate(button => document.activeElement === button), true, 'Escape restores focus');
    await page.locator('#places-open').click();
    await page.locator('#places-close').click();
    assert.equal(await page.locator('#places-open').evaluate(button => document.activeElement === button), true, 'Close button restores focus');

    // Check real actor displacement and stop behavior, not only button labels.
    await page.locator('[data-action="stand"]').click();
    const joystick = await page.locator('#joystick').boundingBox();
    assert(joystick && joystick.width >= 40 && joystick.height >= 40, 'Thumb controller has a usable hit target');
    const center = { x: joystick.x + joystick.width / 2, y: joystick.y + joystick.height / 2 };
    const beforeJoystick = await page.evaluate(() => window.__characterTestState().position);
    await page.mouse.move(center.x, center.y); await page.mouse.down();
    await page.mouse.move(center.x + joystick.width * .32, center.y, { steps: 4 });
    await page.waitForFunction(() => window.__characterTestState().joystick[0] > .3, null, { timeout: 8000 });
    await page.waitForFunction(x => window.__characterTestState().position[0] > x + .025, beforeJoystick[0], { timeout: 8000 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__characterTestState().joystick.every(value => value === 0), null, { timeout: 8000 });
    const stopped = await page.evaluate(() => window.__characterTestState());
    await page.waitForTimeout(250);
    const afterRelease = await page.evaluate(() => window.__characterTestState());
    assert(Math.hypot(...afterRelease.position.map((value, i) => value - stopped.position[i])) < .025, 'Releasing joystick stops the actor');
    await page.mouse.move(center.x, center.y); await page.mouse.down();
    await page.mouse.move(center.x - joystick.width * .32, center.y);
    await page.waitForFunction(() => window.__characterTestState().joystick[0] < -.3, null, { timeout: 8000 });
    await page.locator('#joystick').dispatchEvent('pointercancel', { pointerId: 1 });
    assert.deepEqual(await page.evaluate(() => window.__characterTestState().joystick), [0, 0], 'Cancelled pointer clears movement');
    await page.mouse.up();

    await page.locator('#places-open').click();
    await page.locator('[data-place="hot"]').click();
    const headingToRoom = await page.evaluate(() => window.__characterTestState());
    const startingDistance = Math.hypot(...headingToRoom.position.map((value, i) => value - headingToRoom.target[i]));
    await page.waitForFunction(distance => {
      const state = window.__characterTestState();
      return Math.hypot(...state.position.map((value, i) => value - state.target[i])) < distance - .025;
    }, startingDistance, { timeout: 8000 });
    await page.waitForFunction(() => {
      const state = window.__characterTestState();
      return state.destination === 'hot' && state.routeRemaining === 0 && Math.hypot(state.position[0] - .35, state.position[1] + 1.7) < .02;
    }, null, { timeout: 45000 });
    assert.match(await page.locator('#status').textContent(), /불가마 앞이에요/);
    await page.screenshot({ path: path.join(output, 'arrival.png'), fullPage: true });
    await page.locator('[data-action="stand"]').click();
    await page.locator('[data-color="mint"]').click();
    await page.reload();
    await page.waitForSelector('#viewport[data-ready="true"]');
    assert.equal(await page.locator('[data-color="mint"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-color="peach"]').click();
    await page.locator('[data-action="sit"]').click();
    await page.locator('#viewport').click({ position: { x: 235, y: 360 } });
    assert.equal(await page.locator('[data-action="stand"]').getAttribute('aria-pressed'), 'true', 'Tap resumes walking');
    await page.locator('[data-action="stand"]').click();
    const beforeKeyboard = await page.evaluate(() => window.__characterTestState().position);
    await page.locator('#viewport').focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(x => window.__characterTestState().position[0] < x - .025, beforeKeyboard[0], { timeout: 8000 });
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    for (const action of ['sit', 'lie', 'egg', 'drink', 'wave']) {
      await page.locator(`[data-action="${action}"]`).click();
      await page.waitForTimeout(1200);
      if (action === 'wave') {
        await page.waitForFunction(() => {
          const state = window.__characterTestState();
          return state.expression === 'happy' && state.arms.flat().some(angle => Math.abs(angle) > .5);
        }, null, { timeout: 8000 });
      }
      await page.screenshot({ path: path.join(output, `${action}.png`), fullPage: true });
    }
    await page.locator('#sound').click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    await page.locator('#sound').click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-action="stand"]').click();
    assert.deepEqual(errors, [], 'No JS errors');
    assert.deepEqual(failed, [], 'All assets load');
    assert.deepEqual(external, [], 'No external asset dependencies');
    // Force a real WebGL context loss and verify a usable recovery screen.
    await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); gl.getExtension('WEBGL_lose_context').loseContext(); });
    await page.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#places-open').isDisabled(), true, 'Error screen locks keyboard controls as well as pointer controls');
    await page.locator('#retry').click();
    await page.waitForSelector('#viewport[data-ready="true"]');
    assert.equal(await page.locator('#error').isVisible(), false);
    // Failed module fetch must not leave the visitor on an infinite spinner.
    const broken = await browser.newPage();
    await broken.route('**/scene.js*', route => route.abort());
    await broken.goto(base);
    await broken.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await broken.locator('#loading').isVisible(), false);
    const missingBackground = await browser.newPage();
    await missingBackground.route('**/assets/sauna-room-v1.png', route => route.abort());
    await missingBackground.goto(base);
    await missingBackground.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await missingBackground.locator('#loading').isVisible(), false);
    const noWebGL = await browser.newPage();
    await noWebGL.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); }; });
    await noWebGL.goto(base);
    await noWebGL.locator('#error').waitFor({ state: 'visible' });
    assert.match(await noWebGL.locator('#error-message').textContent(), /Safari/);
    const loading = await browser.newPage();
    let releaseModule;
    const moduleGate = new Promise(resolve => { releaseModule = resolve; });
    await loading.route('**/scene.js*', async route => { await moduleGate; await route.continue(); });
    await loading.goto(base, { waitUntil: 'domcontentloaded' });
    assert.equal(await loading.locator('body').evaluate(body => body.classList.contains('room-ready')), false);
    assert.equal(await loading.locator('.controls').evaluate(element => getComputedStyle(element).pointerEvents), 'none', 'Game controls cannot be used before loading finishes');
    releaseModule();
    await loading.waitForSelector('#viewport[data-ready="true"]');
    assert.equal(await loading.locator('body').evaluate(body => body.classList.contains('room-ready')), true);
    console.log('PASS: desktop, 390px/320px mobile, landscape, background/pan/recenter/failure, stable initial joints, all poses/wave, destination dialog/travel/focus, joystick movement/release/cancel, keyboard movement, palette, audio, reduced motion, loading guard, local assets, context loss/retry, failed module, unavailable WebGL.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
