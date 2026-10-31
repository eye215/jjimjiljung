import { randomPart } from './outfit.js?v=rpg-22';

// 양머리 만들기: a three-step mini-game at the 매점 towel shelf.
// 1) the towel unfurls, then swipe it down to fold it, 2) tap left/right in turn
// to roll both ends, 3) done: choose whether to wear the new sheep cap right away.
// Step 2 is a 2.5D scene (CSS 3D + SVG): each tap rolls that side's end inwards,
// so the flat middle narrows and the roll grows. The shapes follow the state,
// not a looping animation, so fast taps or skipping ahead always end correct.
const ROLLS = 10, PER_SIDE = ROLLS / 2;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// An Archimedean spiral for a roll's end, tighter as more towel is wound on.
function spiral(turns) {
  const points = [], steps = Math.round(turns * 28);
  for (let i = 0; i <= steps; i++) { const a = i / 28 * Math.PI * 2, r = 4 + 40 * i / steps; points.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`); }
  return 'M' + points.join('L');
}
const rollEnd = side => `<svg class="roll-end" viewBox="-50 -50 100 100" aria-hidden="true"><circle r="48" class="roll-face"/><path class="roll-spiral" data-spiral="${side}" d="${spiral(1)}"/><circle r="48" class="roll-rim"/></svg>`;
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
    body.innerHTML = `<div class="towel-stage"><div class="towel-cloth unfurl" role="button" tabindex="0" aria-label="수건 접기"><i class="towel-fold-line"></i><span class="towel-swipe" aria-hidden="true">👆<b>⌄⌄</b></span></div></div><p class="towel-tip">${gift ? '내 수건과 똑같은 색이에요' : '받은 수건 색은 랜덤이에요'}</p>`;
    const cloth = body.querySelector('.towel-cloth'); cloth.style.setProperty('--towel', color);
    // The towel arrives folded and unfurls before you fold it lengthwise.
    if (!reduced()) cloth.animate([
      { transform: 'perspective(500px) rotateX(70deg) scaleY(.25)', opacity: .4, offset: 0 },
      { transform: 'perspective(500px) rotateX(-8deg) scaleY(1.04)', opacity: 1, offset: .7 },
      { transform: 'perspective(500px) rotateX(0deg) scaleY(1)', opacity: 1 }
    ], { duration: 700, easing: 'cubic-bezier(.3,.9,.4,1)' });
    let startY = null;
    cloth.addEventListener('pointerdown', e => { startY = e.clientY; cloth.setPointerCapture(e.pointerId); });
    cloth.addEventListener('pointermove', e => { if (startY !== null && e.clientY - startY > 40) { startY = null; fold(); } });
    cloth.addEventListener('pointerup', () => { startY = null; });
    cloth.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); fold(); } });
  }
  const wound = { left: 0, right: 0 }, spin = { left: 0, right: 0 }, hops = {};
  function renderRoll() {
    const scene = body.querySelector('.roll-scene'); if (!scene) return;
    for (const side of ['left', 'right']) {
      const n = wound[side];
      scene.style.setProperty(`--${side}`, String(n / PER_SIDE));
      scene.querySelector(`[data-spiral="${side}"]`).setAttribute('d', spiral(1 + n * .7));
      scene.querySelector(`[data-spiral="${side}"]`).style.transform = `rotate(${spin[side]}deg)`;
    }
    scene.dataset.left = String(wound.left); scene.dataset.right = String(wound.right);
  }
  function roll() {
    show(2); rolls = 0; last = ''; wound.left = wound.right = 0; spin.left = spin.right = 0;
    title.textContent = '양쪽을 돌돌 말아요'; note.textContent = '왼쪽·오른쪽을 번갈아 톡톡!';
    body.innerHTML = `<div class="towel-stage roll-stage"><div class="roll-scene" style="--towel:${color}"><div class="roll-floor">
        <i class="roll-strip"></i>
        ${['left', 'right'].map(side => `<div class="roll ${side}"><i class="roll-shadow"></i><div class="roll-hop"><i class="roll-body"></i>${rollEnd(side)}</div></div>`).join('')}
      </div></div></div>
      <div class="towel-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${ROLLS}" aria-valuenow="0"><i></i></div>
      <div class="towel-buttons"><button type="button" data-side="left">↺ 왼쪽</button><button type="button" data-side="right" class="hot">오른쪽 ↻</button></div>`;
    const bar = body.querySelector('.towel-progress');
    renderRoll();
    for (const button of body.querySelectorAll('[data-side]')) button.addEventListener('click', () => {
      const side = button.dataset.side;
      if (stage !== 2 || rolls >= ROLLS) return;
      if (side === last) { note.textContent = '이번엔 반대쪽을 눌러요!'; return; }
      last = side; rolls++; wound[side] = Math.min(PER_SIDE, wound[side] + 1);
      // Rolling inwards turns the left end clockwise and the right one counter-clockwise.
      spin[side] += side === 'left' ? 150 : -150;
      note.textContent = rolls < ROLLS ? '좋아요, 계속 번갈아 톡톡!' : '다 말았어요!';
      bar.setAttribute('aria-valuenow', String(rolls)); bar.firstElementChild.style.width = `${rolls / ROLLS * 100}%`;
      renderRoll();
      // A little hop as the roll tumbles over; a new tap replaces the previous hop.
      if (!reduced()) {
        hops[side]?.cancel();
        hops[side] = body.querySelector(`.roll.${side} .roll-hop`).animate([{ transform: 'translateZ(0)' }, { transform: 'translateZ(14px)' }, { transform: 'translateZ(0)' }], { duration: 320, easing: 'cubic-bezier(.3,.7,.4,1)' });
      }
      if (rolls >= ROLLS) { body.querySelectorAll('[data-side]').forEach(b => { b.disabled = true; }); setTimeout(() => { if (stage === 2) done(); }, reduced() ? 150 : 650); }
    });
  }
  function done() {
    show(3); title.textContent = '양머리 완성! ✨';
    note.textContent = gift ? `${gift.name}님에게 똑같은 양머리를 선물해요` : '이제 이 수건은 내 거예요. 다른 손님과 바꿀 수도 있어요';
    body.innerHTML = `<div class="towel-stage"><div class="towel-cap" aria-hidden="true"><i class="dome"><i class="dome-band"></i></i><span class="bun left">${rollEnd('capl')}</span><span class="bun right">${rollEnd('capr')}</span>${[[-96, -54, 22], [92, -60, 18], [-70, 52, 14], [96, 40, 20], [0, -88, 16]].map(([x, y, s], i) => `<b class="spark" style="--x:${x}px;--y:${y}px;--s:${s}px;--d:${i * 90}ms">✦</b>`).join('')}</div></div>
      ${gift ? '' : '<label class="towel-wear"><span>🐑 바로 쓰기</span><input type="checkbox" id="towel-wear" checked role="switch"></label>'}
      <button type="button" id="towel-finish" class="towel-primary">${gift ? '🎁 선물하기' : '좋아요'}</button>`;
    const capArt = body.querySelector('.towel-cap'); capArt.style.setProperty('--towel', color);
    for (const id of ['capl', 'capr']) capArt.querySelector(`[data-spiral="${id}"]`).setAttribute('d', spiral(4.5));
    // The finished cap pops up with a soft bounce and a few sparkles.
    if (!reduced()) capArt.animate([{ transform: 'translateY(30px) scale(.6)', opacity: 0 }, { transform: 'translateY(-14px) scale(1.06)', opacity: 1, offset: .6 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.3,.9,.4,1)' });
    else capArt.classList.add('still');
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
  return { open, close, fold, get stage() { return stage; }, get isOpen() { return !sheet.hidden; }, get wound() { return { ...wound }; } };
}
