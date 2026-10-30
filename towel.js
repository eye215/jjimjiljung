import { randomPart } from './outfit.js?v=rpg-8';

// 양머리 만들기: a three-step mini-game at the 매점 towel shelf.
// 1) swipe the towel down to fold it, 2) tap left/right in turn to roll both
// ends, 3) done: choose whether to wear the new sheep cap right away.
const ROLLS = 10;
const $ = selector => document.querySelector(selector);

export function createTowelGame({ onDone, onOpen, onClose }) {
  const sheet = $('#towel-game'), step = $('#towel-step'), title = $('#towel-title'), note = $('#towel-note'), body = $('#towel-body'), dots = [...sheet.querySelectorAll('.towel-dots i')];
  // `gift` is set while making a copy of my towel for someone who asked to trade.
  let color = '#f2a7c3', stage = 0, rolls = 0, last = '', gift = null;
  function show(n) {
    stage = n; sheet.dataset.stage = String(n); step.textContent = `양머리 만들기 · ${n}/3`;
    dots.forEach((dot, i) => dot.classList.toggle('on', i === n - 1));
  }
  function fold() {
    if (stage !== 1) return;
    body.querySelector('.towel-cloth').classList.add('folded');
    setTimeout(roll, 450);
  }
  function stageFold() {
    show(1); title.textContent = '수건을 반으로 접어요'; note.textContent = '수건을 위에서 아래로 쓸어내려요';
    body.innerHTML = `<div class="towel-stage"><div class="towel-cloth" role="button" tabindex="0" aria-label="수건 접기"><i class="towel-fold-line"></i><span class="towel-swipe" aria-hidden="true">👆<b>⌄⌄</b></span></div></div><p class="towel-tip">${gift ? '내 수건과 똑같은 색이에요' : '받은 수건 색은 랜덤이에요'}</p>`;
    const cloth = body.querySelector('.towel-cloth'); cloth.style.setProperty('--towel', color);
    let startY = null;
    cloth.addEventListener('pointerdown', e => { startY = e.clientY; cloth.setPointerCapture(e.pointerId); });
    cloth.addEventListener('pointermove', e => { if (startY !== null && e.clientY - startY > 40) { startY = null; fold(); } });
    cloth.addEventListener('pointerup', () => { startY = null; });
    cloth.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); fold(); } });
  }
  function roll() {
    show(2); rolls = 0; last = ''; title.textContent = '양쪽을 돌돌 말아요'; note.textContent = '왼쪽·오른쪽을 번갈아 톡톡!';
    body.innerHTML = `<div class="towel-stage"><div class="towel-roll"><i class="bun left"></i><i class="strip"></i><i class="bun right"></i></div></div>
      <div class="towel-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${ROLLS}" aria-valuenow="0"><i></i></div>
      <div class="towel-buttons"><button type="button" data-side="left">↺ 왼쪽</button><button type="button" data-side="right" class="hot">오른쪽 ↻</button></div>`;
    const stageEl = body.querySelector('.towel-roll'), bar = body.querySelector('.towel-progress');
    stageEl.style.setProperty('--towel', color);
    for (const button of body.querySelectorAll('[data-side]')) button.addEventListener('click', () => {
      const side = button.dataset.side;
      if (side === last) { note.textContent = '이번엔 반대쪽을 눌러요!'; return; }
      last = side; rolls++; note.textContent = rolls < ROLLS ? '좋아요, 계속 번갈아 톡톡!' : '다 말았어요!';
      stageEl.style.setProperty('--roll', String(rolls / ROLLS));
      bar.setAttribute('aria-valuenow', String(rolls)); bar.firstElementChild.style.width = `${rolls / ROLLS * 100}%`;
      if (rolls >= ROLLS) { body.querySelectorAll('[data-side]').forEach(b => { b.disabled = true; }); setTimeout(done, 500); }
    });
  }
  function done() {
    show(3); title.textContent = '양머리 완성! ✨';
    note.textContent = gift ? `${gift.name}님에게 똑같은 양머리를 선물해요` : '이제 이 수건은 내 거예요. 다른 손님과 바꿀 수도 있어요';
    body.innerHTML = `<div class="towel-stage"><div class="towel-cap" aria-hidden="true"><i class="dome"></i><i class="bun left"></i><i class="bun right"></i></div></div>
      ${gift ? '' : '<label class="towel-wear"><span>🐑 바로 쓰기</span><input type="checkbox" id="towel-wear" checked role="switch"></label>'}
      <button type="button" id="towel-finish" class="towel-primary">${gift ? '🎁 선물하기' : '좋아요'}</button>`;
    body.querySelector('.towel-cap').style.setProperty('--towel', color);
    body.querySelector('#towel-finish').addEventListener('click', () => {
      const made = gift; gift = null;
      if (made) { close(); made.onDone(color); return; }
      const wear = body.querySelector('#towel-wear').checked; close(); onDone(color, wear);
    });
  }
  // open() hands out a random towel; open({ color, name, onDone, onCancel }) copies one as a gift.
  function open(options = null) {
    gift = options?.onDone ? options : null;
    color = gift ? gift.color : randomPart('towel'); sheet.style.setProperty('--towel', color);
    sheet.hidden = false; document.body.classList.add('towel-playing'); stageFold(); onOpen?.();
    body.querySelector('.towel-cloth').focus({ preventScroll: true });
  }
  function close() {
    if (sheet.hidden) return; sheet.hidden = true; document.body.classList.remove('towel-playing'); stage = 0;
    if (gift) { const cancelled = gift; gift = null; cancelled.onCancel?.(); }
    onClose?.();
  }
  $('#towel-close').addEventListener('click', close);
  sheet.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  return { open, close, fold, get stage() { return stage; }, get isOpen() { return !sheet.hidden; } };
}
