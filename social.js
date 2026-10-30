import * as THREE from './vendor/three.module.min.js';
import { connect } from './net.js?v=rpg-4';
import { PALETTES } from './character.js?v=rpg-4';
import { NAV_BOUNDS } from './navigation.js?v=rpg-4';
import { cleanText, maskProfanity, cleanNickname, createRateLimit, readChat, suggestNickname, MAX_MESSAGE } from './chat-rules.js?v=rpg-4';

// Multiplayer presence, movement sync, name tags, speech bubbles and the
// public chat. Rendering stays in scene.js; this module only adds visitors.
const ACTIONS = ['stand', 'sit', 'lie', 'egg', 'drink', 'wave'];
const MOVE_INTERVAL = 200, IDLE_INTERVAL = 2500, HISTORY = 60;
const $ = selector => document.querySelector(selector);
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function createSocial({ scene, camera, kit, viewport, getLocal, makeShadow, actorScale, onLocalBubble }) {
  const id = newId();
  const ui = {
    online: $('#online'), onlineText: $('#online-text'), chat: $('#chat'), log: $('#chat-log'), form: $('#chat-form'), input: $('#chat-input'),
    note: $('#chat-note'), open: $('#chat-open'), close: $('#chat-close'), unread: $('#chat-unread'), count: $('#chat-count'),
    labels: $('#labels'), join: $('#join-dialog'), joinForm: $('#join-form'), nickname: $('#nickname'), joinNote: $('#join-note'),
    solo: $('#join-solo'), rename: $('#chat-rename'), reroll: $('#nickname-reroll')
  };
  let nickname = ''; try { nickname = cleanNickname(localStorage.getItem('jjimjiljung-nickname') || ''); } catch { /* storage may be unavailable */ }
  let link = null, status = 'solo', presence = [], unread = 0, lastSent = 0, lastSignature = '';
  const remotes = new Map(), seenMessages = new Set(), senderLimits = new Map();
  const limit = createRateLimit();
  const projected = new THREE.Vector3();

  // ---------- Name tags and speech bubbles (DOM, crisp Korean text) ----------
  function makeLabel(name, self = false) {
    const tag = document.createElement('div'); tag.className = 'nametag' + (self ? ' self' : '');
    tag.innerHTML = '<span class="bubble" hidden></span><b></b>';
    tag.querySelector('b').textContent = name; ui.labels.appendChild(tag); return tag;
  }
  const selfLabel = makeLabel(nickname || '나', true); selfLabel.hidden = true;
  function say(label, text) {
    const bubble = label.querySelector('.bubble'); bubble.textContent = text; bubble.hidden = false;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    clearTimeout(label.bubbleTimer); label.bubbleTimer = setTimeout(() => { bubble.hidden = true; }, Math.min(9000, 4500 + text.length * 60));
  }
  function place(label, position, visible) {
    projected.set(position.x, 1.72, position.z).project(camera);
    const show = visible && projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
    label.style.visibility = show ? 'visible' : 'hidden';
    if (show) label.style.transform = `translate(${(projected.x + 1) / 2 * viewport.clientWidth}px,${(1 - projected.y) / 2 * viewport.clientHeight}px) translate(-50%,-100%)`;
  }

  // ---------- Remote visitors ----------
  function ensureRemote(info) {
    let remote = remotes.get(info.id);
    if (!remote) {
      const colors = PALETTES[info.outfit] || PALETTES.peach;
      const character = kit.createCharacter(colors);
      character.root.scale.setScalar(actorScale); character.root.visible = false; scene.add(character.root);
      remote = { id: info.id, character, outfit: info.outfit, name: info.name, label: makeLabel(info.name), shadow: makeShadow(), target: { x: 0, z: 0, f: 0 }, action: 'stand', walking: false, placed: false };
      remote.shadow.visible = false; remotes.set(info.id, remote);
    }
    if (info.name && info.name !== remote.name) { remote.name = info.name; remote.label.querySelector('b').textContent = info.name; }
    if (info.outfit && info.outfit !== remote.outfit && PALETTES[info.outfit]) { remote.outfit = info.outfit; remote.character.setColors(PALETTES[info.outfit]); }
    return remote;
  }
  function removeRemote(remoteId) {
    const remote = remotes.get(remoteId); if (!remote) return;
    scene.remove(remote.character.root); scene.remove(remote.shadow); remote.label.remove();
    remote.character.root.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    remotes.delete(remoteId);
  }
  function readPresence(entry) {
    if (!entry || typeof entry.id !== 'string' || entry.id === id) return null;
    return { id: entry.id.slice(0, 40), name: cleanNickname(entry.name) || '손님', outfit: PALETTES[entry.outfit] ? entry.outfit : 'peach' };
  }
  function onPresence(list) {
    const next = list.map(readPresence).filter(Boolean);
    const before = new Set(presence.map(entry => entry.id)), after = new Set(next.map(entry => entry.id));
    for (const entry of next) if (!before.has(entry.id) && presence.length) system(`${entry.name}님이 들어왔어요`);
    for (const entry of presence) if (!after.has(entry.id)) system(`${entry.name}님이 나갔어요`);
    presence = next;
    for (const entry of next) ensureRemote(entry);
    for (const remoteId of [...remotes.keys()]) if (!after.has(remoteId)) removeRemote(remoteId);
    // Newcomers need to know where everyone is standing right away.
    if (next.some(entry => !before.has(entry.id))) lastSent = 0;
    renderStatus();
  }
  function onState(payload) {
    if (!payload || typeof payload.id !== 'string' || payload.id === id || !remotes.has(payload.id)) return;
    const remote = remotes.get(payload.id);
    remote.target.x = THREE.MathUtils.clamp(finite(payload.x), NAV_BOUNDS.minX, NAV_BOUNDS.maxX);
    remote.target.z = THREE.MathUtils.clamp(finite(payload.z), NAV_BOUNDS.minZ, NAV_BOUNDS.maxZ);
    remote.target.f = finite(payload.f);
    remote.action = ACTIONS.includes(payload.a) ? payload.a : 'stand';
    remote.walking = payload.w === true;
    if (PALETTES[payload.o] && payload.o !== remote.outfit) { remote.outfit = payload.o; remote.character.setColors(PALETTES[payload.o]); }
    if (!remote.placed) {
      remote.placed = true; remote.character.root.visible = true; remote.shadow.visible = true;
      remote.character.root.position.set(remote.target.x, 0, remote.target.z); remote.character.root.rotation.y = remote.target.f;
    }
  }

  // ---------- Chat ----------
  function stamp(ts) { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
  function append(item) {
    const row = document.createElement('li'); row.className = item.kind;
    if (item.kind === 'system') row.textContent = item.text;
    else {
      const name = document.createElement('b'), text = document.createElement('span'), time = document.createElement('time');
      name.textContent = item.name; text.textContent = item.text; time.textContent = stamp(item.ts);
      row.append(name, text, time);
    }
    ui.log.appendChild(row);
    while (ui.log.children.length > HISTORY) ui.log.firstElementChild.remove();
    ui.log.scrollTop = ui.log.scrollHeight;
    if (item.kind !== 'system' && ui.chat.hidden) { unread++; renderUnread(); }
  }
  function system(text) { append({ kind: 'system', text }); }
  function renderUnread() { ui.unread.hidden = !unread; ui.unread.textContent = unread > 9 ? '9+' : String(unread); }
  function onChat(payload) {
    const message = readChat(payload); if (!message || message.id === id || seenMessages.has(message.mid)) return;
    seenMessages.add(message.mid); if (seenMessages.size > 300) seenMessages.delete(seenMessages.values().next().value);
    // Drop floods from any one sender even if their browser skips its own limit.
    const senderLimit = senderLimits.get(message.id) || createRateLimit({ count: 8, windowMs: 10000, gapMs: 300 });
    senderLimits.set(message.id, senderLimit);
    if (senderLimit.check()) return; senderLimit.hit();
    const remote = remotes.get(message.id);
    append({ kind: 'them', name: remote?.name || message.name, text: message.text, ts: message.ts });
    if (remote) say(remote.label, message.text);
  }
  function note(text) { ui.note.textContent = text; ui.note.hidden = !text; clearTimeout(note.timer); if (text) note.timer = setTimeout(() => { ui.note.hidden = true; }, 3000); }
  ui.form.addEventListener('submit', event => {
    event.preventDefault();
    const raw = cleanText(ui.input.value);
    if (!raw) return;
    if (status !== 'online') { note('아직 연결되지 않았어요. 잠시 뒤에 다시 보내 주세요.'); return; }
    const wait = limit.check(); if (wait) { note(`조금만 천천히 말해 주세요 (${Math.ceil(wait / 1000)}초)`); return; }
    const { text, flagged } = maskProfanity(raw);
    limit.hit(); ui.input.value = '';
    const message = { id, name: nickname, text, mid: newId(), room: getLocal().room };
    link.send('chat', message);
    append({ kind: 'me', name: nickname, text, ts: Date.now() });
    say(selfLabel, text); onLocalBubble?.(text);
    note(flagged ? '고운 말로 바꿔서 보냈어요 ♨' : '');
  });
  ui.input.maxLength = MAX_MESSAGE;

  // Keep the sheet above the on-screen keyboard (iOS Safari and Android).
  function fitKeyboard() {
    const vv = window.visualViewport; if (!vv) return;
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--keyboard', covered + 'px');
    document.body.classList.toggle('keyboard-open', covered > 80);
  }
  window.visualViewport?.addEventListener('resize', fitKeyboard); window.visualViewport?.addEventListener('scroll', fitKeyboard);
  ui.input.addEventListener('focus', () => { fitKeyboard(); setTimeout(fitKeyboard, 350); });
  ui.input.addEventListener('blur', () => setTimeout(fitKeyboard, 100));

  function openChat(focus = true) {
    if (status === 'solo') { openJoin(); return; }
    ui.chat.hidden = false; document.body.classList.add('chat-open'); ui.open.setAttribute('aria-expanded', 'true');
    unread = 0; renderUnread(); ui.log.scrollTop = ui.log.scrollHeight;
    if (focus) ui.input.focus({ preventScroll: true });
  }
  function closeChat() {
    ui.chat.hidden = true; document.body.classList.remove('chat-open'); ui.open.setAttribute('aria-expanded', 'false');
    ui.input.blur(); ui.open.focus({ preventScroll: true });
  }
  ui.open.addEventListener('click', () => ui.chat.hidden ? openChat() : closeChat());
  ui.close.addEventListener('click', closeChat);
  ui.chat.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closeChat(); } });
  ui.online.addEventListener('click', () => { if (status === 'offline') reconnect(); else openChat(false); });

  // ---------- Nickname and joining ----------
  // A cosy suggestion is filled in for newcomers; it stays fully editable.
  function openJoin() {
    ui.nickname.value = nickname || suggestNickname(); ui.joinNote.textContent = '';
    if (!ui.join.open) ui.join.showModal();
    ui.nickname.focus(); ui.nickname.select();
  }
  ui.reroll.addEventListener('click', () => {
    let next = suggestNickname(); for (let i = 0; i < 5 && next === ui.nickname.value; i++) next = suggestNickname();
    ui.nickname.value = next; ui.joinNote.textContent = ''; ui.nickname.focus();
  });
  ui.joinForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = cleanNickname(ui.nickname.value);
    if (!name) { ui.joinNote.textContent = cleanText(ui.nickname.value) ? '다른 닉네임을 골라 주세요.' : '닉네임을 적어 주세요 (최대 10자).'; return; }
    nickname = name; try { localStorage.setItem('jjimjiljung-nickname', name); } catch { /* storage may be unavailable */ }
    selfLabel.querySelector('b').textContent = name;
    ui.join.close();
    if (link) link.track(presencePayload()); else start();
  });
  ui.solo.addEventListener('click', () => { ui.join.close(); renderStatus(); });
  ui.rename.addEventListener('click', openJoin);

  function presencePayload() { return { id, name: nickname, outfit: getLocal().outfit }; }
  async function start() {
    status = 'connecting'; renderStatus();
    try {
      link = await connect({ id, presence: presencePayload(), onPresence, onStatus: next => { status = next; renderStatus(); if (next === 'online') lastSent = 0; }, onMessage: (event, payload) => event === 'state' ? onState(payload) : event === 'chat' ? onChat(payload) : null });
      selfLabel.hidden = false;
      if (!ui.log.children.length) system(`${nickname}님, 찜질방에 오신 걸 환영해요!`);
    } catch { status = 'offline'; renderStatus(); }
  }
  async function reconnect() { if (link) { await link.leave(); link = null; } for (const remoteId of [...remotes.keys()]) removeRemote(remoteId); presence = []; start(); }
  function renderStatus() {
    const count = presence.length + 1;
    ui.online.dataset.status = status;
    ui.onlineText.textContent = status === 'online' ? `${count}명 접속 중` : status === 'connecting' ? '연결 중…' : status === 'offline' ? '오프라인 · 다시 연결' : '혼자 쉬는 중 · 입장하기';
    ui.count.textContent = status === 'online' ? `${count}명` : '';
    viewport.dataset.online = status === 'online' ? String(count) : status;
  }
  addEventListener('pagehide', () => { link?.leave(); });
  renderStatus();
  if (nickname) start(); else openJoin();

  return {
    get status() { return status; }, get count() { return presence.length + 1; }, remotes, id,
    isChatOpen: () => !ui.chat.hidden,
    outfitChanged() { if (link && status === 'online') { link.track(presencePayload()); lastSent = 0; } },
    update(dt, reducedMotion) {
      const local = getLocal();
      // Send my state ~5×/s while moving or changing pose, and a heartbeat when idle.
      const now = performance.now();
      if (link && status === 'online') {
        const signature = `${local.action}|${local.walking}|${local.outfit}`;
        const due = now - lastSent > (local.walking ? MOVE_INTERVAL : IDLE_INTERVAL) || signature !== lastSignature;
        if (due && now - lastSent > 120) {
          lastSent = now; lastSignature = signature;
          link.send('state', { id, x: +local.x.toFixed(2), z: +local.z.toFixed(2), f: +local.facing.toFixed(2), a: local.action, w: local.walking, o: local.outfit, r: local.room });
        }
      }
      place(selfLabel, local, local.visible && !selfLabel.hidden);
      for (const remote of remotes.values()) {
        const root = remote.character.root;
        if (remote.placed) {
          const dx = remote.target.x - root.position.x, dz = remote.target.z - root.position.z, gap = Math.hypot(dx, dz);
          // Smoothly follow the latest network position; jump if far behind.
          if (gap > 5) root.position.set(remote.target.x, 0, remote.target.z);
          else { root.position.x = THREE.MathUtils.damp(root.position.x, remote.target.x, 7, dt); root.position.z = THREE.MathUtils.damp(root.position.z, remote.target.z, 7, dt); }
          let turn = remote.target.f - root.rotation.y; turn = Math.atan2(Math.sin(turn), Math.cos(turn)); root.rotation.y += turn * Math.min(1, dt * 10);
          remote.shadow.position.set(root.position.x, .012, root.position.z);
          remote.character.animate(remote.action, remote.walking || gap > .05, dt, reducedMotion, 1.3);
        }
        place(remote.label, root.position, remote.placed);
      }
    }
  };
}
