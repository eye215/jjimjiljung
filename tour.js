// 첫 방문 안내: a newcomer starts at the 입구 and is led through the 찜질방 one step at a
// time: key, towel and outfit → changing room → sheep cap → bath → central lounge,
// then every other room and feature once. Each step can also be done out of order; the
// nudge always shows the first one still open. Progress stays on this device.
const KEY = 'jjimjiljung-tour-v1';
export const INTRO = Object.freeze([
  { id: 'desk', text: '🔑 입구에서 열쇠·수건·찜질복 받기' },
  { id: 'locker', text: '👕 탈의실에서 찜질복 갈아입기' },
  { id: 'towel', text: '🐑 받은 수건으로 양머리 만들기' },
  { id: 'bath', text: '♨ 목욕탕에서 몸 녹이기' },
  { id: 'lobby', text: '🏠 중앙 휴게실로 가기' }
]);
export const EXPLORE = Object.freeze([
  { id: 'hot', text: '🔥 불가마에 들어가 보기' },
  { id: 'tv', text: '📺 휴게실 TV 앞에 앉아 보기' },
  { id: 'egg', text: '🥚 맥반석 계란 먹어 보기' },
  { id: 'ice', text: '🧊 얼음방에서 열 식히기' },
  { id: 'drink', text: '🥤 살얼음 식혜 마셔 보기' },
  { id: 'salt', text: '🧂 소금방에 누워 보기' },
  { id: 'fortune', text: '🔮 사주방에서 오늘의 운세 보기' },
  { id: 'scrub', text: '🧽 세신실에서 세신 받기' },
  { id: 'sleep', text: '😴 수면실에서 한숨 자기' }
]);
const ALL = [...INTRO, ...EXPLORE];

export function loadTour(storage = globalThis.localStorage) {
  try { const saved = JSON.parse(storage.getItem(KEY) || 'null'); if (saved && Array.isArray(saved.done)) return { done: saved.done.filter(id => ALL.some(s => s.id === id)), off: !!saved.off, fresh: false }; } catch { /* storage may be unavailable */ }
  return { done: [], off: false, fresh: true };
}

// `isNew`: no tour record and no locker key yet → start at the 입구 and run the tour.
// Existing visitors keep their spot and see no tour.
export function createTour({ storage = globalThis.localStorage, isNew, el, onGo, blocked = () => false, toast = () => {} }) {
  const state = loadTour(storage);
  if (state.fresh && !isNew) state.off = true;
  const save = () => { try { storage.setItem(KEY, JSON.stringify({ done: state.done, off: state.off })); } catch { /* storage may be unavailable */ } };
  save();
  const text = el.querySelector('span'), go = el.querySelector('[data-tour-go]'), close = el.querySelector('[data-tour-close]');
  const next = () => (state.off ? null : ALL.find(s => !state.done.includes(s.id)) || null);
  function render() {
    const step = next();
    el.hidden = !step || blocked();
    if (!step) return;
    const intro = INTRO.includes(step), list = intro ? INTRO : EXPLORE, n = list.filter(s => state.done.includes(s.id)).length;
    text.textContent = `${step.text} · ${n + 1}/${list.length}`;
    el.dataset.step = step.id;
  }
  function done(id) {
    if (state.off || state.done.includes(id) || !ALL.some(s => s.id === id)) return;
    const before = next();
    state.done.push(id); save();
    const after = next();
    if (before?.id === 'lobby' && id === 'lobby') toast('입장 완료! 이제 찜질방 곳곳을 둘러봐요 ♨');
    else if (!after && before) toast('찜질방을 한 바퀴 다 둘러봤어요! 이제 마음껏 쉬어요 ♨');
    render();
  }
  go.addEventListener('click', () => { const step = next(); if (step) onGo(step.id); });
  close.addEventListener('click', () => { state.off = true; save(); render(); });
  // Replay only the tour. Existing account, key, outfits, towels, snack bag and warmth
  // are never touched by a replay or by updates to the tutorial.
  function restart() { state.done.length = 0; state.off = false; save(); render(); }
  return { done, render, restart, get active() { return !!next(); }, get step() { return next()?.id || null; }, get fresh() { return isNew && state.fresh; } };
}
