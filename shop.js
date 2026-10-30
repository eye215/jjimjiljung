import { SNACKS, REST_SECONDS, scoreEggCrack, scoreOneShot } from './economy.js?v=rpg-5';

// 매점 sheet, wallet chip, empty-bag prompt and the two snack mini-games.
// scene.js owns the character; this module only calls back into it.
const $ = selector => document.querySelector(selector);

export function createShop({ wallet, eat, play, goToShop, toast }) {
  const ui = {
    chip: $('#wallet'), points: $('#wallet-points'), eggs: $('#wallet-egg'), drinks: $('#wallet-drink'),
    open: $('#shop-open'), dialog: $('#shop-dialog'), close: $('#shop-close'), balance: $('#shop-balance'),
    game: $('#game'), title: $('#game-title'), body: $('#game-body'), result: $('#game-result')
  };
  function render() {
    const snap = wallet.snapshot();
    ui.points.textContent = snap.points; ui.eggs.textContent = snap.bag.egg; ui.drinks.textContent = snap.bag.drink;
    ui.balance.textContent = `♨ ${snap.points}`;
    for (const kind of Object.keys(SNACKS)) {
      const card = ui.dialog.querySelector(`[data-snack="${kind}"]`);
      card.querySelector('.bag').textContent = `가방에 ${snap.bag[kind]}개`;
      const free = card.querySelector('[data-free]'), buy = card.querySelector('[data-buy]');
      free.hidden = !snap.freeLeft[kind]; buy.disabled = snap.points < SNACKS[kind].price;
      ui.dialog.querySelector(`[data-game="${kind}"]`).disabled = snap.bag[kind] < 1;
      document.querySelector(`[data-action="${kind}"] .count`).textContent = snap.bag[kind];
      document.querySelector(`[data-action="${kind}"]`).classList.toggle('empty', snap.bag[kind] < 1);
    }
  }
  wallet.onChange(render);

  function openShop() { render(); if (!ui.dialog.open) ui.dialog.showModal(); }
  ui.open.addEventListener('click', openShop);
  ui.chip.addEventListener('click', openShop);
  ui.close.addEventListener('click', () => ui.dialog.close());
  ui.dialog.addEventListener('click', event => {
    const free = event.target.closest('[data-free]'), buy = event.target.closest('[data-buy]'), game = event.target.closest('[data-game]');
    if (free) { const kind = free.closest('[data-snack]').dataset.snack; if (wallet.claimFree(kind)) toast(`오늘의 무료 ${SNACKS[kind].short}를 받았어요! 🎁`); }
    if (buy) { const kind = buy.closest('[data-snack]').dataset.snack; if (wallet.buy(kind)) toast(`${SNACKS[kind].short} 하나 샀어요 (♨ -${SNACKS[kind].price})`); }
    if (game) { const kind = game.dataset.game; if (wallet.count(kind) > 0) { ui.dialog.close(); kind === 'egg' ? eggGame() : oneShotGame(); } }
  });

  // Eating from the action tray: use one from the bag, or point to the shop.
  function request(kind) {
    if (wallet.consume(kind)) { eat(kind, 'normal'); return true; }
    if (wallet.freeAvailable(kind)) toast(`가방이 비었어요. 매점에서 오늘의 무료 ${SNACKS[kind].short}를 받아 가세요!`, '매점 가기', goToShop);
    else toast(`${SNACKS[kind].short}가 다 떨어졌어요. 매점에서 사 올까요?`, '매점 가기', goToShop);
    return false;
  }

  // ---------- Mini-games ----------
  let running = null;
  function showGame(title, html) {
    ui.title.textContent = title; ui.body.innerHTML = html; ui.result.hidden = true; ui.game.hidden = false;
    document.body.classList.add('playing');
  }
  function finish(text, points) {
    const granted = points ? wallet.earn(points) : 0;
    ui.result.textContent = text + (granted ? `  +${granted}♨` : points ? '  (오늘 받을 수 있는 온기를 다 모았어요)' : '');
    ui.result.hidden = false; running = null;
    setTimeout(() => { ui.game.hidden = true; document.body.classList.remove('playing'); }, 2200);
  }
  function cancelGame() { if (running) { running.stop(); running = null; } ui.game.hidden = true; document.body.classList.remove('playing'); }

  // 이마로 계란 깨기: tap when the marker crosses the sweet spot.
  function eggGame() {
    if (!wallet.consume('egg')) return;
    showGame('🥚 이마로 계란 깨기', '<p>가운데 금빛 칸에서 톡! 하면 깔끔하게 깨져요.</p><div class="gauge"><i class="good"></i><i class="sweet"></i><b class="marker"></b></div><button class="game-button" data-tap>톡!</button>');
    const marker = ui.body.querySelector('.marker'), start = performance.now();
    let position = 0, raf = 0, done = false;
    const loop = now => { const t = (now - start) / 1000; position = .5 + .5 * Math.sin(t * (2.6 + t * .35)); marker.style.left = `${position * 100}%`; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const tap = () => {
      if (done) return; done = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', key);
      const score = scoreEggCrack(position);
      play('egg', 'forehead');
      finish(score.grade === 'perfect' ? '쩍! 완벽하게 깨졌어요 ✨' : score.grade === 'good' ? '톡! 잘 깨졌어요' : '앗, 아야… 그래도 맛있게 먹어요', score.points);
    };
    const key = event => { if (event.code === 'Space' || event.key === 'Enter') { event.preventDefault(); tap(); } };
    ui.body.querySelector('[data-tap]').addEventListener('click', tap); window.addEventListener('keydown', key);
    running = { stop() { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); } };
  }

  // 식혜 원샷: hold to drink; release before the brain-freeze meter fills.
  function oneShotGame() {
    if (!wallet.consume('drink')) return;
    showGame('🥤 살얼음 식혜 원샷', '<p>꾹 누르면 마셔요. 머리가 띵하기 전에 잠깐씩 쉬어 주세요!</p><label>마신 양<span class="meter drink"><i></i></span></label><label>머리 띵 지수<span class="meter freeze"><i></i></span></label><p class="timer">10초</p><button class="game-button" data-hold>꾹 눌러 마시기</button>');
    const snack = play('drink', 'oneshot');
    const drinkBar = ui.body.querySelector('.drink i'), freezeBar = ui.body.querySelector('.freeze i'), timer = ui.body.querySelector('.timer'), button = ui.body.querySelector('[data-hold]');
    let drunk = 0, freeze = 0, peak = 0, holding = false, last = performance.now(), left = 10, raf = 0;
    const hold = value => event => { event.preventDefault(); holding = value; button.classList.toggle('active', value); };
    button.addEventListener('pointerdown', hold(true)); for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, hold(false));
    const key = event => { if (event.code === 'Space') { event.preventDefault(); holding = event.type === 'keydown'; button.classList.toggle('active', holding); } };
    window.addEventListener('keydown', key); window.addEventListener('keyup', key);
    const end = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); };
    const loop = now => {
      const dt = Math.min(.1, (now - last) / 1000); last = now; left -= dt;
      if (holding) { drunk += dt * .2; freeze += dt * .26; } else freeze = Math.max(0, freeze - dt * .34);
      peak = Math.max(peak, freeze); drunk = Math.min(1, drunk);
      drinkBar.style.width = `${drunk * 100}%`; freezeBar.style.width = `${Math.min(1, freeze) * 100}%`; freezeBar.classList.toggle('hot', freeze > .7);
      timer.textContent = `${Math.max(0, Math.ceil(left))}초`;
      if (snack) { snack.hold = holding; snack.level = 1 - drunk; }
      const frozen = freeze >= 1, finished = drunk >= 1;
      if (frozen || finished || left <= 0) {
        end(); if (snack) { snack.hold = false; snack.frozen = frozen; snack.finished = true; }
        const score = scoreOneShot({ finished, frozen, peak });
        finish(score.grade === 'perfect' ? '캬~ 완벽한 원샷! ✨' : score.grade === 'good' ? '캬! 원샷 성공' : frozen ? '으앗, 머리가 띵~ 😵' : '시간이 다 됐어요. 천천히 마셔요', score.points);
        setTimeout(() => snack && snack === snackRef() && stopSnack(), 1800);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    running = { stop: end };
  }
  let snackRef = () => null, stopSnack = () => {};

  render();
  return {
    request, openShop, cancelGame, render,
    bind({ current, stop }) { snackRef = current; stopSnack = stop; },
    get playing() { return !ui.game.hidden; },
    // Shown only inside the 매점.
    setNearShop(near) { ui.open.hidden = !near; },
    restHint: `앉거나 누워서 ${REST_SECONDS}초마다 온기가 모여요`
  };
}
