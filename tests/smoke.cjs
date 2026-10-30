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
  const ready = async page => {
    await page.waitForSelector('#viewport[data-ready="true"]', { timeout: 120000 });
    // Play solo: the nickname prompt is covered by tests/multiplayer.cjs.
    if (await page.locator('#join-dialog').evaluate(dialog => dialog.open).catch(() => false)) await page.locator('#join-solo').click();
  };
  const state = page => page.evaluate(() => window.__characterTestState());
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    // Software WebGL can take several seconds per frame on a busy CI machine.
    page.setDefaultTimeout(120000);
    // Instrument only the test response, keeping debug state out of production.
    await page.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.__characterTestState = () => ({ action, arms: arms.map(a => [a.rotation.x,a.rotation.z]), legs: legs.map(a => [a.rotation.x,a.rotation.z]), position: [hero.position.x,hero.position.z], target: [target.x,target.z], joystick: [joystickInput.x,joystickInput.z], destination: activeDestination?.id || null, routeRemaining: route.length, expression: player.expression(), room: currentRoom.id, yaw: view.yaw, zoom: view.zoom, faded: world.fadeUnits.filter(unit => unit.opacity < .9 || unit.cut < .5).length, camera: [camera.position.x, camera.position.y, camera.position.z] });\nwindow.__teleport = (x, z) => { route.length = 0; activeDestination = null; hero.position.set(x, 0, z); view.focus.set(x, 0, z); target.copy(hero.position); };' });
    });
    // A well-stocked snack bag, so pose checks can eat freely (the shop has its own test).
    await page.addInitScript(() => localStorage.setItem('jjimjiljung-wallet-v1', JSON.stringify({ points: 500, bag: { egg: 99, drink: 99 }, free: { egg: '', drink: '' } })));
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
    await ready(page);
    await page.waitForTimeout(800);
    const initialRig = await state(page);
    // Resting arms hang slightly lowered from the plush bind pose (about .55 rad).
    assert(initialRig.arms.flat().every(angle => Number.isFinite(angle) && Math.abs(angle) < .8), 'Stale initial RAF must not destabilize resting arms');
    assert.equal(initialRig.room, 'lobby', 'Visitors start in the central lobby');
    assert.match(await page.locator('.room-badge').textContent(), /중앙 휴게실/);
    assert.equal(await page.locator('#loading').isVisible(), false);
    assert.equal(await page.locator('#error').isVisible(), false);
    assert(initialRig.camera[1] > 3 && distance([initialRig.camera[0], initialRig.camera[2]], initialRig.position) > 4, 'Quarter-view camera sits above and behind the player');
    await page.screenshot({ path: path.join(output, 'desktop.png') });
    for (const size of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 820, height: 1180 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      const [controller, tray] = await Promise.all([page.locator('#joystick').boundingBox(), page.locator('.controls').boundingBox()]);
      assert(controller.x + controller.width <= tray.x || controller.x >= tray.x + tray.width || controller.y + controller.height <= tray.y || controller.y >= tray.y + tray.height, 'Action tray never covers the joystick');
      for (const action of ['sit', 'lie', 'egg', 'drink', 'wave', 'stand']) {
        await page.locator(`[data-action="${action}"]`).click();
        // Snack buttons open their mini-game; the snack starts when you play (egg: tap, sikhye: at once).
        if (action === 'egg') await page.locator('#game [data-tap]').click();
        assert.equal(await page.locator(`[data-action="${action}"]`).getAttribute('aria-pressed'), 'true');
        if (action === 'egg' || action === 'drink') await page.locator(action === 'egg' ? '#game [data-game-close]' : '#game-close').click();
        // A snack layers on a pose (e.g. 앉기 + 계란), so at most two can be pressed.
        const pressed = await page.locator('.actions [aria-pressed="true"]').count();
        assert(pressed >= 1 && pressed <= 2);
        const joints = await state(page);
        assert([...joints.arms.flat(), ...joints.legs.flat()].every(angle => Number.isFinite(angle) && Math.abs(angle) < 3.2), 'Joint rotations stay within natural pose limits');
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // Dragging the room orbits the follow camera; recentering restores the view.
    const yawBefore = (await state(page)).yaw;
    await page.mouse.move(300, 370); await page.mouse.down();
    await page.mouse.move(120, 390, { steps: 8 }); await page.mouse.up();
    const turned = await state(page);
    assert(Math.abs(turned.yaw - yawBefore) > .3, 'Drag rotates the camera around the player');
    assert.equal(turned.routeRemaining, 0, 'A drag is not mistaken for a tap-to-walk');
    await page.mouse.move(200, 400); await page.mouse.wheel(0, 400);
    await page.waitForFunction(() => window.__characterTestState().zoom > 1.1, null, { timeout: 8000 });
    await page.locator('#recenter').click();
    const recentred = await state(page);
    assert(Math.abs(recentred.yaw - yawBefore) < 1e-6 && recentred.zoom === 1, 'Recenter restores the default quarter view');
    // Every room is reachable from the travel dialog.
    for (const destination of ['hot', 'salt', 'shop', 'sleep', 'ice', 'lobby']) {
      await page.locator('#places-open').click();
      assert.equal(await page.locator('#places-dialog').evaluate(dialog => dialog.open), true);
      await page.locator(`[data-place="${destination}"]`).click();
      assert.equal(await page.locator('#places-dialog').evaluate(dialog => dialog.open), false);
      const journey = await state(page);
      assert.equal(journey.destination, destination);
      assert.equal(journey.action, 'stand');
      assert(journey.routeRemaining > 0 && journey.target.every(Number.isFinite), 'Destination has a planned route');
    }
    await page.locator('#places-open').click();
    await page.screenshot({ path: path.join(output, 'places.png') });
    const paused = await state(page);
    assert.equal(paused.routeRemaining, 0, 'Opening the dialog cancels walking');
    assert.deepEqual(paused.joystick, [0, 0]);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const stillPaused = await state(page);
    assert(distance(stillPaused.position, paused.position) < .01, 'No movement behind a modal');
    await page.keyboard.press('KeyW');
    assert(distance((await state(page)).position, paused.position) < .01, 'Keyboard walking is ignored behind a modal');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#places-dialog').evaluate(dialog => dialog.open), false);
    assert.equal(await page.locator('#places-open').evaluate(button => document.activeElement === button), true, 'Escape restores focus');
    await page.locator('#places-open').click();
    await page.locator('#places-close').click();
    assert.equal(await page.locator('#places-open').evaluate(button => document.activeElement === button), true, 'Close button restores focus');

    // Check real actor displacement and stop behavior, not only button labels.
    await page.evaluate(() => window.__teleport(0, 2));
    await page.locator('[data-action="stand"]').click();
    const joystick = await page.locator('#joystick').boundingBox();
    assert(joystick && joystick.width >= 40 && joystick.height >= 40, 'Thumb controller has a usable hit target');
    const center = { x: joystick.x + joystick.width / 2, y: joystick.y + joystick.height / 2 };
    const beforeJoystick = (await state(page)).position;
    await page.mouse.move(center.x, center.y); await page.mouse.down();
    await page.mouse.move(center.x + joystick.width * .32, center.y, { steps: 4 });
    await page.waitForFunction(() => window.__characterTestState().joystick[0] > .3, null, { timeout: 8000 });
    await page.waitForFunction(start => { const p = window.__characterTestState().position; return Math.hypot(p[0] - start[0], p[1] - start[1]) > .05; }, beforeJoystick, { timeout: 20000 });
    const pushed = await state(page);
    // "Right" on the stick is screen-right: perpendicular to the camera's view direction.
    const move = [pushed.position[0] - beforeJoystick[0], pushed.position[1] - beforeJoystick[1]];
    const screenRight = [Math.cos(pushed.yaw), -Math.sin(pushed.yaw)];
    assert((move[0] * screenRight[0] + move[1] * screenRight[1]) / Math.hypot(...move) > .9, 'Joystick moves relative to the camera');
    await page.mouse.up();
    await page.waitForFunction(() => window.__characterTestState().joystick.every(value => value === 0), null, { timeout: 8000 });
    const stopped = await state(page);
    await page.waitForTimeout(400);
    assert(distance((await state(page)).position, stopped.position) < .03, 'Releasing joystick stops the actor');
    await page.mouse.move(center.x, center.y); await page.mouse.down();
    await page.mouse.move(center.x - joystick.width * .32, center.y);
    await page.waitForFunction(() => window.__characterTestState().joystick[0] < -.3, null, { timeout: 8000 });
    await page.locator('#joystick').dispatchEvent('pointercancel', { pointerId: 1 });
    assert.deepEqual((await state(page)).joystick, [0, 0], 'Cancelled pointer clears movement');
    await page.mouse.up();

    // Walls stop the player; open doorways let them through into another room.
    await page.evaluate(() => window.__teleport(-6.5, 2.2));
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(2500);
    await page.keyboard.up('KeyA');
    const blocked = await state(page);
    assert(blocked.position[0] > -7.55 && blocked.room === 'lobby', 'The lobby wall blocks walking');
    await page.evaluate(() => window.__teleport(-1.5, -3.8));
    await page.locator('#places-open').click();
    await page.locator('[data-place="hot"]').click();
    await page.waitForFunction(() => window.__characterTestState().room === 'hot', null, { timeout: 90000 });
    assert.match(await page.locator('.room-badge').textContent(), /불가마/, 'Room badge follows the player through the door');
    await page.waitForFunction(() => { const s = window.__characterTestState(); return s.destination === 'hot' && s.routeRemaining === 0 && s.action === 'sit'; }, null, { timeout: 90000 });
    assert.match(await page.locator('#status').textContent(), /불가마 안이에요/);
    await page.screenshot({ path: path.join(output, 'arrival-hot.png') });
    // A wall between the camera and the player fades so the player stays visible.
    await page.evaluate(() => window.__teleport(.5, -5.9));
    await page.waitForFunction(() => window.__characterTestState().faded > 0, null, { timeout: 20000 });
    await page.screenshot({ path: path.join(output, 'wall-fade.png') });
    await page.evaluate(() => window.__teleport(0, 2));
    await page.waitForFunction(() => window.__characterTestState().room === 'lobby', null, { timeout: 8000 });

    await page.locator('[data-action="stand"]').click();
    // One tap re-dyes the whole outfit at random; 되돌리기 restores it; it survives a reload.
    const outfitCode = () => page.locator('#viewport').getAttribute('data-outfit');
    const firstOutfit = await outfitCode();
    assert.match(firstOutfit, /^[0-9a-f]{6}\.[0-9a-f]{6}\.[0-9a-f]{6}\.0$/, 'Newcomers start without a towel cap');
    assert.equal(await page.locator('#cap-toggle').isHidden(), true, 'No cap toggle before the towel game');
    await page.locator('#outfit-random').click();
    const dyed = await outfitCode();
    assert.notEqual(dyed.slice(0, 13), firstOutfit.slice(0, 13), 'Top and bottom change together');
    assert.match(await page.locator('#toast span').textContent(), /새 옷/);
    await page.locator('#toast button').click();
    assert.equal(await outfitCode(), firstOutfit, 'Undo restores the previous outfit');
    await page.locator('#outfit-random').click();
    const kept = await outfitCode();
    await page.reload();
    await ready(page);
    assert.equal(await outfitCode(), kept, 'The outfit is remembered on this device');
    await page.locator('[data-action="sit"]').click();
    await page.locator('#viewport').click({ position: { x: 235, y: 360 } });
    assert.equal(await page.locator('[data-action="stand"]').getAttribute('aria-pressed'), 'true', 'Tap resumes walking');
    assert((await state(page)).routeRemaining > 0, 'Tapping the floor plans a walk');
    await page.locator('[data-action="stand"]').click();
    const beforeKeyboard = (await state(page)).position;
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(start => { const p = window.__characterTestState().position; return Math.hypot(p[0] - start[0], p[1] - start[1]) > .05; }, beforeKeyboard, { timeout: 20000 });
    await page.keyboard.up('ArrowUp');
    const afterKeyboard = await state(page);
    await page.waitForTimeout(400);
    assert(distance((await state(page)).position, afterKeyboard.position) < .03, 'Releasing a key stops walking');
    await page.screenshot({ path: path.join(output, 'mobile.png') });
    for (const action of ['sit', 'lie', 'egg', 'drink', 'wave']) {
      await page.locator(`[data-action="${action}"]`).click();
      if (action === 'egg') await page.locator('#game [data-tap]').click();
      await page.waitForTimeout(1200);
      if (action === 'wave') {
        await page.waitForFunction(() => {
          const s = window.__characterTestState();
          return s.expression === 'happy' && s.arms.flat().some(angle => Math.abs(angle) > 1);
        }, null, { timeout: 8000 });
      }
      await page.screenshot({ path: path.join(output, `${action}.png`) });
      if (action === 'egg') await page.locator('#game [data-game-close]').click();
      if (action === 'drink') await page.locator('#game-close').click();
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
    await ready(page);
    assert.equal(await page.locator('#error').isVisible(), false);
    await page.close();
    // Failed module fetch must not leave the visitor on an infinite spinner.
    const broken = await browser.newPage();
    await broken.route('**/environment.js*', route => route.abort());
    await broken.goto(base);
    await broken.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await broken.locator('#loading').isVisible(), false);
    await broken.close();
    const noWebGL = await browser.newPage();
    await noWebGL.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); }; });
    await noWebGL.goto(base);
    await noWebGL.locator('#error').waitFor({ state: 'visible' });
    assert.match(await noWebGL.locator('#error-message').textContent(), /Safari/);
    await noWebGL.close();
    const loading = await browser.newPage();
    let releaseModule;
    const moduleGate = new Promise(resolve => { releaseModule = resolve; });
    await loading.route('**/scene.js*', async route => { await moduleGate; await route.continue(); });
    await loading.goto(base, { waitUntil: 'domcontentloaded' });
    assert.equal(await loading.locator('body').evaluate(body => body.classList.contains('room-ready')), false);
    assert.equal(await loading.locator('.controls').evaluate(element => getComputedStyle(element).pointerEvents), 'none', 'Game controls cannot be used before loading finishes');
    releaseModule();
    await ready(loading);
    assert.equal(await loading.locator('body').evaluate(body => body.classList.contains('room-ready')), true);
    console.log('PASS: desktop, 390px/320px mobile, tablet, landscape, quarter-view camera, drag orbit/wheel zoom/recenter, all poses/wave, six-room travel dialog/focus, camera-relative joystick movement/release/cancel, wall collision, walking through a door into 불가마 with room badge, wall fading, tap-to-walk, held-key walking, palette, audio, reduced motion, loading guard, local assets, context loss/retry, failed module, unavailable WebGL.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
