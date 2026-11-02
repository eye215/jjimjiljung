const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const T = await import(pathToFileURL(path.resolve(__dirname, '..', 'tour.js')).href);
  const mem = () => ({ d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } });
  const node = () => ({ textContent: '', disabled:false, attrs:{}, handlers: {}, setAttribute(k,v){this.attrs[k]=v;}, addEventListener(t, f) { this.handlers[t] = f; }, click() { if(!this.disabled) this.handlers.click?.(); } });
  const element = () => { const parts = { span: node(), '[data-tour-go]': node(), '[data-tour-close]': node() }; return { hidden: true, dataset: {}, querySelector: s => parts[s], parts }; };
  // A newcomer: the intro in order, then every room and feature.
  let storage = mem(), el = element(), went = [], toasts = [];
  let tour = T.createTour({ storage, isNew: true, el, onGo: id => went.push(id), toast: t => toasts.push(t) });
  tour.render();
  assert.equal(el.hidden, false); assert.equal(tour.step, 'desk'); assert.match(el.parts.span.textContent, /열쇠.*1\/5/);
  el.parts['[data-tour-go]'].click(); assert.deepEqual(went, ['desk'], '가기 walks to the current step');
  tour.arrived('desk'); assert.equal(el.parts['[data-tour-go]'].disabled, true, 'Cannot press Go again after reaching desk');
  assert.equal(el.parts['[data-tour-go]'].textContent, '도착 ✓');
  el.parts['[data-tour-go]'].click(); assert.deepEqual(went, ['desk'], 'Disabled arrival button cannot repeat route');
  tour.done('desk'); assert.equal(tour.step, 'locker');
  assert.equal(el.parts['[data-tour-go]'].disabled, false);
  assert.equal(el.parts['[data-tour-go]'].textContent, '다음 장소 가기');
  tour.arrived('locker'); assert.equal(el.parts['[data-tour-go]'].disabled, true);
  tour.retry('locker'); assert.equal(el.parts['[data-tour-go]'].disabled, false);
  tour.done('bath'); assert.equal(tour.step, 'locker', 'Early bath visits are saved but do not skip changing');
  tour.done('locker'); assert.equal(tour.step, 'towel');
  tour.arrived('towel'); assert.equal(el.parts['[data-tour-go]'].disabled, true, 'Crafting a sheep cap disables redundant go button');
  tour.retry('towel'); assert.equal(el.parts['[data-tour-go]'].disabled, false, 'Canceling craft allows a retry');
  tour.done('towel'); assert.equal(tour.step, 'lobby', 'Using the towel before the bath is the new onboarding order');
  tour.done('lobby'); assert.equal(tour.step, 'hot'); assert.match(toasts.at(-1), /둘러봐요/);
  assert.match(el.parts.span.textContent, /1\/9/, 'The explore list counts on its own');
  for (const s of T.EXPLORE) tour.done(s.id);
  assert.equal(tour.active, false); assert.equal(el.hidden, true); assert.match(toasts.at(-1), /한 바퀴/);
  // Progress survives a reload.
  tour = T.createTour({ storage, isNew: true, el: element(), onGo: () => {} }); assert.equal(tour.active, false);
  // Visitors from before the tour never see it.
  storage = mem(); tour = T.createTour({ storage, isNew: false, el: element(), onGo: () => {} }); assert.equal(tour.active, false);
  // A returning visitor may replay from the beginning without resetting resources.
  const saved = mem();
  for (const [key, value] of Object.entries({
    'jjimjiljung-key': '37',
    'jjimjiljung-issued-towel-v1': '1',
    'jjimjiljung-outfit-v2': '{"top":"#aabbcc","hasTowel":true}',
    'jjimjiljung-wallet-v1': '{"points":42,"bag":{"egg":3,"drink":2},"ads":{"count":2}}'
  })) saved.setItem(key, value);
  saved.setItem('jjimjiljung-tour-v1', JSON.stringify({done:['desk','bath','locker'],off:true}));
  tour = T.createTour({ storage: saved, isNew: false, el: element(), onGo: () => {} });
  assert.equal(tour.active, false, 'Completed or dismissed tutorials stay dismissed after updates');
  tour.restart();
  assert.equal(tour.step, 'desk', 'Replay must start from step one regardless of owned key');
  assert.deepEqual(T.loadTour(saved).done, [], 'Only tour progress resets on explicit replay');
  for(const key of ['jjimjiljung-key','jjimjiljung-issued-towel-v1','jjimjiljung-outfit-v2','jjimjiljung-wallet-v1']) {
    assert.equal(saved.getItem(key), ({
      'jjimjiljung-key':'37',
      'jjimjiljung-issued-towel-v1':'1',
      'jjimjiljung-outfit-v2':'{"top":"#aabbcc","hasTowel":true}',
      'jjimjiljung-wallet-v1':'{"points":42,"bag":{"egg":3,"drink":2},"ads":{"count":2}}'
    })[key], `Progress reset must not change saved ${key}`);
  }
  tour.done('desk'); assert.equal(tour.step, 'locker');
  assert.equal(T.loadTour(saved).done.length, 1);
  // ✕ turns it off for good.
  storage = mem(); el = element(); tour = T.createTour({ storage, isNew: true, el, onGo: () => {} }); tour.render();
  el.parts['[data-tour-close]'].click(); assert.equal(el.hidden, true); assert.equal(T.loadTour(storage).off, true);
  console.log('PASS: first tour receives key+towel+outfit → locker → sheep cap → bath → lobby; out-of-order saves, 14 steps, replay preserves user resources and progress persists across updates.');
})().catch(error => { console.error(error); process.exit(1); });
