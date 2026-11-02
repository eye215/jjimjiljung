const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const T = await import(pathToFileURL(path.resolve(__dirname, '..', 'tour.js')).href);
  const mem = () => ({ d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } });
  const node = () => ({ textContent: '', handlers: {}, addEventListener(t, f) { this.handlers[t] = f; }, click() { this.handlers.click?.(); } });
  const element = () => { const parts = { span: node(), '[data-tour-go]': node(), '[data-tour-close]': node() }; return { hidden: true, dataset: {}, querySelector: s => parts[s], parts }; };
  // A newcomer: the intro in order, then every room and feature.
  let storage = mem(), el = element(), went = [], toasts = [];
  let tour = T.createTour({ storage, isNew: true, el, onGo: id => went.push(id), toast: t => toasts.push(t) });
  tour.render();
  assert.equal(el.hidden, false); assert.equal(tour.step, 'desk'); assert.match(el.parts.span.textContent, /열쇠.*1\/5/);
  el.parts['[data-tour-go]'].click(); assert.deepEqual(went, ['desk'], '가기 walks to the current step');
  tour.done('desk'); assert.equal(tour.step, 'bath');
  tour.done('towel'); assert.equal(tour.step, 'bath', 'Steps done early are skipped later, the first open one shows');
  tour.done('bath'); tour.done('locker'); assert.equal(tour.step, 'lobby');
  tour.done('lobby'); assert.equal(tour.step, 'hot'); assert.match(toasts.at(-1), /둘러봐요/);
  assert.match(el.parts.span.textContent, /1\/9/, 'The explore list counts on its own');
  for (const s of T.EXPLORE) tour.done(s.id);
  assert.equal(tour.active, false); assert.equal(el.hidden, true); assert.match(toasts.at(-1), /한 바퀴/);
  // Progress survives a reload.
  tour = T.createTour({ storage, isNew: true, el: element(), onGo: () => {} }); assert.equal(tour.active, false);
  // Visitors from before the tour never see it.
  storage = mem(); tour = T.createTour({ storage, isNew: false, el: element(), onGo: () => {} }); assert.equal(tour.active, false);
  // ✕ turns it off for good.
  storage = mem(); el = element(); tour = T.createTour({ storage, isNew: true, el, onGo: () => {} }); tour.render();
  el.parts['[data-tour-close]'].click(); assert.equal(el.hidden, true); assert.equal(T.loadTour(storage).off, true);
  console.log('PASS: 첫 방문 안내 — 입구 열쇠 → 목욕탕 → 탈의실 → 양머리 → 휴게실, then 9 rooms/features; out-of-order steps, saved progress, old visitors skipped, ✕ off.');
})().catch(error => { console.error(error); process.exit(1); });
