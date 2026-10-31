import { SNACKS, REST_SECONDS, scoreEggCrack, scoreOneShot } from './economy.js?v=rpg-21';

// 매점 sheet, wallet chip, empty-bag prompt and the two snack mini-games.
// scene.js owns the character; this module only calls back into it.
const $ = selector => document.querySelector(selector);

export function createShop({ wallet, eat, play, goToShop, toast, tv }) {
  const ui = {
    chip: $('#wallet'), points: $('#wallet-points'), eggs: $('#wallet-egg'), drinks: $('#wallet-drink'),
    open: $('#shop-open'), dialog: $('#shop-dialog'), close: $('#shop-close'), balance: $('#shop-balance'),
    game: $('#game'), title: $('#game-title'), sub: $('#game-sub'), body: $('#game-body'), result: $('#game-result'),
    tvBox: $('#shop-tv'), tvText: $('#shop-tv p'), tvGo: $('#shop-tv button')
  };
  function render() {
    const snap = wallet.snapshot();
    ui.points.textContent = snap.points; ui.eggs.textContent = snap.bag.egg; ui.drinks.textContent = snap.bag.drink;
    ui.balance.textContent = `♨ ${snap.points}`;
    for (const kind of Object.keys(SNACKS)) {
      const card = ui.dialog.querySelector(`[data-snack="${kind}"]`);
      card.querySelector('.bag').textContent = `가방에 ${snap.bag[kind]}개`;
      const free = card.querySelector('[data-free]'), buy = card.querySelector('[data-buy]');
      const short = snap.points < SNACKS[kind].price;
      free.hidden = !snap.freeLeft[kind]; buy.hidden = short; card.querySelector('.short').hidden = !short;
      ui.dialog.querySelector(`[data-game="${kind}"]`).disabled = snap.bag[kind] < 1;
      document.querySelector(`[data-action="${kind}"] .count`).textContent = snap.bag[kind];
      document.querySelector(`[data-action="${kind}"]`).classList.toggle('empty', snap.bag[kind] < 1);
    }
    // Not enough 온기: point to the lobby TV, or to the hot rooms once ads are used up.
    const needs = Object.keys(SNACKS).some(kind => !snap.freeLeft[kind] && snap.points < SNACKS[kind].price);
    const worth = tv?.worth();
    ui.tvBox.hidden = !needs; ui.tvGo.hidden = !worth;
    ui.tvText.textContent = worth ? '온기가 조금 모자라요 ♨ 중앙 휴게실 TV를 보고 오면 받을 수 있어요' : '온기가 조금 모자라요 ♨ 불가마나 소금방에서 쉬면 온기가 두 배로 쌓여요';
  }
  wallet.onChange(render);

  function openShop() { render(); if (!ui.dialog.open) ui.dialog.showModal(); }
  ui.open.addEventListener('click', openShop);
  ui.chip.addEventListener('click', openShop);
  ui.close.addEventListener('click', () => ui.dialog.close());
  ui.tvGo.addEventListener('click', () => { ui.dialog.close(); tv?.go(); });
  ui.dialog.addEventListener('click', event => {
    const free = event.target.closest('[data-free]'), buy = event.target.closest('[data-buy]'), game = event.target.closest('[data-game]');
    if (free) { const kind = free.closest('[data-snack]').dataset.snack; if (wallet.claimFree(kind)) toast(`오늘의 무료 ${SNACKS[kind].short}를 받았어요! 🎁`); }
    if (buy) { const kind = buy.closest('[data-snack]').dataset.snack; if (wallet.buy(kind)) toast(`${SNACKS[kind].short} 하나 샀어요 (♨ -${SNACKS[kind].price})`); }
    if (game) { const kind = game.dataset.game; if (wallet.count(kind) > 0) { ui.dialog.close(); startGame(kind); } }
  });

  // Eating from the action tray: use one from the bag, or point to the shop.
  function request(kind) {
    if (wallet.consume(kind)) { eat(kind, 'normal'); return true; }
    if (wallet.freeAvailable(kind)) toast(`가방이 비었어요. 매점에서 오늘의 무료 ${SNACKS[kind].short}를 받아 가세요!`, '매점 가기', goToShop);
    else toast(`${SNACKS[kind].short}가 다 떨어졌어요. 매점에서 사 올까요?`, '매점 가기', goToShop);
    return false;
  }

  // ---------- 계란·식혜 button: always the mini-game, then the snack is eaten ----------
  function choose(kind) {
    if (wallet.count(kind) < 1) { request(kind); return; }
    startGame(kind);
  }

  // ---------- Mini-games: a bottom sheet that leaves the character in view ----------
  let running = null, lastGame = null;
  function startGame(kind) { if (wallet.count(kind) > 0) { lastGame = kind; kind === 'egg' ? eggGame() : oneShotGame(); } }
  function showGame(title, sub, html) {
    ui.title.textContent = title; ui.sub.textContent = sub; ui.body.innerHTML = html; ui.body.hidden = false; ui.result.hidden = true; ui.game.hidden = false;
    document.body.classList.add('playing');
  }
  // The result stays until you close it or try again with the next snack.
  function finish(text, points) {
    const granted = points ? wallet.earn(points) : 0;
    ui.result.querySelector('b').textContent = text;
    ui.result.querySelector('.game-reward').textContent = granted ? `온기 +${granted}♨` : points ? '오늘 받을 수 있는 온기를 다 모았어요' : '';
    const left = wallet.count(lastGame), again = ui.result.querySelector('[data-game-again]');
    again.textContent = left ? `한 번 더 · ${SNACKS[lastGame].short} ${left}개` : `${SNACKS[lastGame].short}가 없어요`; again.disabled = !left;
    ui.body.hidden = true; ui.result.hidden = false; running = null;
  }
  // Closing mid-game puts the snack away too (the one-shot cup has no natural end).
  function cancelGame() { if (running) { running.stop(); running = null; if (snackRef()) stopSnack(); } ui.game.hidden = true; document.body.classList.remove('playing'); }
  ui.game.querySelector('#game-close').addEventListener('click', cancelGame);
  ui.result.querySelector('[data-game-close]').addEventListener('click', cancelGame);
  ui.result.querySelector('[data-game-again]').addEventListener('click', () => { const kind = lastGame; cancelGame(); startGame(kind); });

  // 이마로 계란 깨기: tap when the marker crosses the sweet spot.
  function eggGame() {
    if (!wallet.consume('egg')) return;
    showGame('🥚 이마로 계란 깨기', '금빛 칸에 왔을 때 톡!', '<div class="gauge"><i class="good"></i><i class="sweet"><span>완벽 ✨</span></i><b class="marker"></b></div><p class="game-tip">Space·Enter로도 돼요</p><button class="game-button" data-tap>톡!</button>');
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
    showGame('🥤 살얼음 식혜 원샷', '꾹 누르면 꿀꺽, 띵하기 전에 손 떼기!', '<div class="oneshot"><div class="timer-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27"/><circle class="left" cx="32" cy="32" r="27" pathLength="100"/></svg><p class="timer">10초</p></div><div class="meters"><label><span>🥤 마신 양</span><span class="meter drink"><i></i></span></label><label><span>🧊 머리 띵</span><span class="meter freeze"><i></i></span></label></div></div><button class="game-button" data-hold>꾹 누르고 있기 🥤</button>');
    const snack = play('drink', 'oneshot');
    const ring = ui.body.querySelector('.timer-ring .left'), drinkBar = ui.body.querySelector('.drink i'), freezeBar = ui.body.querySelector('.freeze i'), timer = ui.body.querySelector('.timer'), button = ui.body.querySelector('[data-hold]');
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
      ring.style.strokeDashoffset = String(100 - Math.max(0, left) * 10);
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
    request, choose, openShop, cancelGame, render,
    bind({ current, stop }) { snackRef = current; stopSnack = stop; },
    get playing() { return !ui.game.hidden; },
    // Shown only inside the 매점.
    setNearShop(near) { ui.open.hidden = !near; },
    restHint: `앉거나 누워서 ${REST_SECONDS}초마다 온기가 모여요`
  };
}
