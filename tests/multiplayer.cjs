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
  const base = (process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/`) + '?net=local';
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    // Two visitors in one browser talk over BroadcastChannel (`?net=local`), which
    // exercises the same presence/state/chat code paths as Supabase Realtime.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await context.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.__mp = { state: () => ({ status: social.status, count: social.count, remotes: [...social.remotes.values()].map(r => ({ name: r.name, placed: r.placed, x: r.character.root.position.x, z: r.character.root.position.z, action: r.action, outfit: r.outfit, snack: r.character.snack?.kind || null })), me: [hero.position.x, hero.position.z] }), ask: () => social.requestChat([...social.remotes.keys()][0]), block: () => social.block([...social.remotes.keys()][0]), group: () => social.group, teleport: (x, z) => { route.length = 0; hero.position.set(x, 0, z); view.focus.set(x, 0, z); target.copy(hero.position); } };' });
    });
    await context.addInitScript(() => localStorage.setItem('jjimjiljung-wallet-v1', JSON.stringify({ points: 50, bag: { egg: 5, drink: 5 }, free: { egg: '', drink: '' } })));
    const errors = [];
    const open = async name => {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(name + ': ' + error.message));
      await page.goto(base);
      await page.waitForSelector('#viewport[data-ready="true"]', { timeout: 120000 });
      assert.equal(await page.locator('#join-dialog').evaluate(dialog => dialog.open), true, 'First visit asks for a nickname');
      const suggested = await page.locator('#nickname').inputValue();
      assert(suggested.length >= 2 && suggested.length <= 10, 'A cosy nickname is suggested');
      await page.locator('#nickname-reroll').click();
      assert.notEqual(await page.locator('#nickname').inputValue(), suggested, 'Dice offers another suggestion');
      await page.locator('#nickname').fill('');
      await page.locator('#join-enter').click();
      assert.match(await page.locator('#join-note').textContent(), /닉네임/, 'Empty nickname is rejected');
      await page.locator('#nickname').fill('씨발');
      await page.locator('#join-enter').click();
      assert.match(await page.locator('#join-note').textContent(), /다른 닉네임/, 'Rude nickname is rejected');
      await page.locator('#nickname').fill(name);
      await page.locator('#join-enter').click();
      assert.equal(await page.locator('#join-dialog').evaluate(dialog => dialog.open), false);
      return page;
    };
    const mp = page => page.evaluate(() => window.__mp.state());
    // Both tabs share localStorage, so the second one must not reuse the first nickname silently.
    const a = await open('보리');
    await a.evaluate(() => localStorage.removeItem('jjimjiljung-nickname'));
    const b = await open('율무');
    // 1. Each visitor sees the other one.
    for (const [page, other] of [[a, '율무'], [b, '보리']]) {
      await page.waitForFunction(name => { const s = window.__mp.state(); return s.status === 'online' && s.count === 2 && s.remotes.some(r => r.name === name && r.placed); }, other, { timeout: 60000 });
      assert.match(await page.locator('#online-text').textContent(), /2명 접속 중/, 'Visitor count is shown');
      assert.equal(await page.locator('.nametag:not(.self) b', { hasText: other }).count(), 1, 'Name tag is shown');
    }
    // 2. Movement and poses arrive and are interpolated.
    await a.evaluate(() => window.__mp.teleport(-3, 1.5));
    await a.locator('[data-action="sit"]').click();
    await b.waitForFunction(() => { const r = window.__mp.state().remotes[0]; return Math.hypot(r.x + 3, r.z - 1.5) < .1 && r.action === 'sit'; }, null, { timeout: 60000 });
    // Eating while sitting is visible to others.
    await a.locator('[data-action="egg"]').click();
    await a.locator('#game [data-tap]').click();
    await b.waitForFunction(() => { const r = window.__mp.state().remotes[0]; return r.snack === 'egg' && r.action === 'sit'; }, null, { timeout: 60000 });
    await a.locator('#game [data-game-close]').click();
    await a.locator('#outfit-random').dispatchEvent('click');
    const dyed = await a.locator('#viewport').getAttribute('data-outfit');
    await b.waitForFunction(code => window.__mp.state().remotes[0].outfit === code, dyed, { timeout: 30000 });
    // 2b. 인사: the only visitor nearby is greeted at once; they high-five back.
    await a.locator('[data-action="wave"]').click();
    await b.waitForFunction(() => /보리님이 인사했어요/.test(document.querySelector('#toast span').textContent), null, { timeout: 30000 });
    await b.locator('#toast button').click();
    await a.waitForFunction(() => /율무님과 하이파이브/.test(document.querySelector('#toast span').textContent), null, { timeout: 30000 });
    assert.match(await a.locator('#toast span').textContent(), /온기 \+1/, 'First greeting with a partner today gives 온기');
    await a.locator('[data-action="wave"]').click();
    assert.match(await a.locator('#toast span').textContent(), /초 뒤에 다시 인사/, 'Same person: 30-second cooldown');
    // 3. No public chat: talking needs a request the other visitor accepts (server rules, local mock here).
    await a.locator('#chat-open').click();
    assert.equal(await a.locator('#chat').isVisible(), true);
    await a.locator('#chat-input').fill('혹시 들리나요?');
    await a.locator('#chat-input').press('Enter');
    assert.match(await a.locator('#chat-note').textContent(), /대화를 신청/, 'Strangers cannot be messaged');
    await a.locator('#chat-close').click();
    await a.evaluate(() => window.__mp.ask());
    await b.locator('#chatreq-card').waitFor({ state: 'visible', timeout: 30000 });
    assert.match(await b.locator('#chatreq-name').textContent(), /보리님이 대화를 신청/);
    await b.locator('#chatreq-accept').click();
    await a.waitForFunction(() => window.__mp.group()?.size === 2, null, { timeout: 30000 });
    await b.waitForFunction(() => window.__mp.group()?.size === 2, null, { timeout: 30000 });
    await a.evaluate(() => window.__mp.ask());
    assert.match(await a.locator('#toast span').textContent(), /이미 같은 그룹/);
    // Group chat travels both ways, with a speech bubble over the sender.
    await a.locator('#chat-open').click();
    await a.locator('#chat-input').fill('안녕하세요! 식혜 드실래요?');
    await a.locator('#chat-input').press('Enter');
    await b.waitForFunction(() => [...document.querySelectorAll('#chat-log li.them span')].some(el => el.textContent.includes('식혜 드실래요')), null, { timeout: 30000 });
    await b.waitForFunction(() => [...document.querySelectorAll('.nametag:not(.self) .bubble')].some(el => !el.hidden && el.textContent.includes('식혜')), null, { timeout: 10000 });
    assert.equal(await b.locator('#chat-unread').textContent(), '1', 'Unread badge counts new messages');
    await b.screenshot({ path: path.join(output, 'multiplayer-bubble.png') });
    // 4. Rate limit and profanity masking.
    const burst = await a.evaluate(() => {
      const input = document.querySelector('#chat-input'), form = document.querySelector('#chat-form'), notes = [];
      for (const text of ['하나', '둘']) { input.value = text; form.requestSubmit(); notes.push(document.querySelector('#chat-note').textContent); }
      return notes;
    });
    assert.match(burst[1], /천천히/, 'Rapid messages are throttled');
    await a.waitForTimeout(1300);
    await a.locator('#chat-input').fill('이 씨 발 게임 좋아');
    await a.locator('#chat-input').press('Enter');
    await b.waitForFunction(() => [...document.querySelectorAll('#chat-log li.them span')].some(el => el.textContent.includes('♨') && !el.textContent.includes('발')), null, { timeout: 30000 });
    await b.locator('#chat-open').click();
    await b.locator('#chat-input').fill('반가워요 😊');
    await b.locator('#chat-input').press('Enter');
    await a.waitForFunction(() => [...document.querySelectorAll('#chat-log li.them')].some(el => el.textContent.includes('율무') && el.textContent.includes('반가워요')), null, { timeout: 30000 });
    assert.equal(await a.locator('#chat-input').evaluate(input => input.maxLength), 120, 'Message length is capped');
    // Two display modes (saved on the device) and the swipe-up history.
    await a.locator('#chat-mode').click();
    assert.equal(await a.locator('#chat').getAttribute('data-mode'), 'subtitle');
    assert.equal(await a.evaluate(() => localStorage.getItem('jjimjiljung-chat-mode')), 'subtitle');
    await a.screenshot({ path: path.join(output, 'multiplayer-subtitles.png') });
    await a.locator('#chat-history').click();
    assert.equal(await a.locator('#chat').evaluate(el => el.classList.contains('history')), true, 'History opens');
    assert(await a.locator('#chat-log').evaluate(el => el.getBoundingClientRect().height <= innerHeight * .41), 'History stays under 40% of the screen');
    await a.screenshot({ path: path.join(output, 'multiplayer-history.png') });
    await a.locator('#chat-history').click();
    await a.locator('#chat-mode').click();
    assert.equal(await a.locator('#chat').getAttribute('data-mode'), 'bubble');
    await a.screenshot({ path: path.join(output, 'multiplayer-chat.png') });
    // Typing in chat must not move the character.
    const before = (await mp(a)).me;
    await a.locator('#chat-input').fill('wasd');
    assert.deepEqual((await mp(a)).me, before, 'Typing WASD in chat does not walk');
    await a.locator('#chat-close').click();
    assert.equal(await a.locator('#chat').isVisible(), false);
    // Tapping outside puts the composer away.
    await a.locator('#chat-open').click();
    await a.mouse.click(195, 300);
    assert.equal(await a.locator('#chat').isVisible(), false, 'Outside tap closes the composer');
    // Safety: after b blocks a, a's request goes unanswered ("응답이 없어요") and no card appears.
    await a.locator('#chat-open').click(); await a.locator('#chat-history').click();
    await a.locator('#chat-leave').click();
    await a.waitForFunction(() => !window.__mp.group(), null, { timeout: 30000 });
    await b.evaluate(() => window.__mp.block());
    await a.evaluate(() => window.__mp.ask());
    await a.waitForFunction(() => /응답이 없어요/.test(document.querySelector('#toast span').textContent), null, { timeout: 30000 });
    assert.equal(await b.locator('#chatreq-card').isVisible(), false, 'Blocked visitors cannot send requests');
    // 5. Leaving updates the other visitor.
    await b.close();
    await a.waitForFunction(() => { const s = window.__mp.state(); return s.count === 1 && s.remotes.length === 0; }, null, { timeout: 30000 });
    assert.match(await a.locator('#online-text').textContent(), /1명 접속 중/);
    assert(await a.locator('#chat-log li.system', { hasText: '율무님이 나갔어요' }).count() >= 1, 'Leave notice appears');
    assert.deepEqual(errors, [], 'No JS errors');
    console.log('PASS (local transport): nickname suggestion/reroll/validation, two visitors see each other with name tags and count, movement/pose/outfit/snack sync, greeting with auto target, high-five, 온기 and cooldown, chat request → accept → group chat both ways with bubbles and unread badge (no public chat), blocking, panel-less composer (bubble/subtitle modes, history, outside tap), rate limit, profanity masking, length cap, typing does not walk, leave handling.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
