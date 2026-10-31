import * as THREE from './vendor/three.module.min.js';
import { connect } from './net.js?v=rpg-25';
import { decodeOutfit, outfitColors, capOn } from './outfit.js?v=rpg-25';
import { NAV_BOUNDS } from './navigation.js?v=rpg-25';
import { cleanText, maskProfanity, cleanNickname, createRateLimit, readChat, suggestNickname, MAX_MESSAGE } from './chat-rules.js?v=rpg-25';

// Multiplayer presence, movement sync, name tags, speech bubbles and the
// public chat. Rendering stays in scene.js; this module only adds visitors.
const ACTIONS = ['stand', 'sit', 'lie', 'wave'];
const MOVE_INTERVAL = 200, IDLE_INTERVAL = 2500, HISTORY = 60;
const $ = selector => document.querySelector(selector);
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

const dress = (character, code) => { const outfit = decodeOutfit(code) || decodeOutfit('peach'); character.setColors(outfitColors(outfit)); character.setTowel(capOn(outfit)); };

export function createSocial({ scene, camera, kit, viewport, getLocal, makeShadow, actorScale, onLocalBubble, onTrade, onGreet, notify = () => {} }) {
  const id = newId();
  const ui = {
    online: $('#online'), onlineText: $('#online-text'), chat: $('#chat'), log: $('#chat-log'), form: $('#chat-form'), input: $('#chat-input'),
    note: $('#chat-note'), open: $('#chat-open'), close: $('#chat-close'), unread: $('#chat-unread'), count: $('#chat-count'),
    labels: $('#labels'), join: $('#join-dialog'), joinForm: $('#join-form'), nickname: $('#nickname'), joinNote: $('#join-note'),
    solo: $('#join-solo'), rename: $('#chat-rename'), reroll: $('#nickname-reroll'), mode: $('#chat-mode'), history: $('#chat-history')
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
      const character = kit.createCharacter(); dress(character, info.outfit);
      character.root.scale.setScalar(actorScale); character.root.visible = false; scene.add(character.root);
      remote = { id: info.id, character, outfit: info.outfit, name: info.name, label: makeLabel(info.name), shadow: makeShadow(), target: { x: 0, z: 0, f: 0 }, action: 'stand', walking: false, placed: false };
      remote.shadow.visible = false; remotes.set(info.id, remote);
    }
    if (info.uid) remote.uid = info.uid;
    if (info.name && info.name !== remote.name) { remote.name = info.name; remote.label.querySelector('b').textContent = info.name; }
    if (info.outfit && info.outfit !== remote.outfit) { remote.outfit = info.outfit; dress(remote.character, info.outfit); }
    return remote;
  }
  function removeRemote(remoteId) {
    const remote = remotes.get(remoteId); if (!remote) return;
    scene.remove(remote.character.root); scene.remove(remote.shadow); remote.label.remove();
    if (remote.character.dispose) remote.character.dispose(); else remote.character.root.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    remotes.delete(remoteId);
  }
  function readPresence(entry) {
    if (!entry || typeof entry.id !== 'string' || entry.id === id) return null;
    return { id: entry.id.slice(0, 40), uid: typeof entry.uid === 'string' ? entry.uid.slice(0, 64) : null, name: cleanNickname(entry.name) || '손님', outfit: decodeOutfit(entry.outfit) ? entry.outfit : 'peach' };
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
    remote.walking = payload.w === true; remote.room = typeof payload.r === 'string' ? payload.r.slice(0, 12) : remote.room;
    // Snack signature `kind:style:serial` restarts the eating animation once.
    const snack = typeof payload.s === 'string' ? payload.s.slice(0, 40) : '';
    if (snack !== remote.snack) {
      remote.snack = snack;
      const [kind, style] = snack.split(':');
      if (kind === 'egg' || kind === 'drink') remote.character.startSnack(kind, { style: style === 'forehead' ? 'forehead' : 'normal' });
      else if (remote.character.snack) remote.character.stopSnack();
    }
    if (typeof payload.o === 'string' && payload.o !== remote.outfit && decodeOutfit(payload.o)) { remote.outfit = payload.o; dress(remote.character, payload.o); }
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
    if (remote && group && remote.uid && !group.members.has(remote.uid)) return;
    append({ kind: 'them', name: remote?.name || message.name, text: message.text, ts: message.ts });
    if (remote) say(remote.label, message.text);
  }
  function note(text) { ui.note.textContent = text; ui.note.hidden = !text; clearTimeout(note.timer); if (text) note.timer = setTimeout(() => { ui.note.hidden = true; }, 3000); }
  ui.form.addEventListener('submit', event => {
    event.preventDefault();
    const raw = cleanText(ui.input.value);
    if (!raw) return;
    if (status !== 'online') { note('아직 연결되지 않았어요. 잠시 뒤에 다시 보내 주세요.'); return; }
    if (!group) { note('다른 손님을 눌러 대화를 신청하고, 수락받으면 이야기할 수 있어요 💬'); return; }
    const wait = limit.check(); if (wait) { note(`조금만 천천히 말해 주세요 (${Math.ceil(wait / 1000)}초)`); return; }
    const { text, flagged } = maskProfanity(raw);
    limit.hit(); ui.input.value = '';
    const message = { id, name: nickname, text, mid: newId(), room: getLocal().room };
    group.channel.send('msg', message);
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
    ui.chat.classList.remove('history'); ui.history.setAttribute('aria-pressed', 'false');
    ui.chat.hidden = true; document.body.classList.remove('chat-open'); ui.open.setAttribute('aria-expanded', 'false');
    ui.input.blur(); ui.open.focus({ preventScroll: true });
  }
  ui.open.addEventListener('click', () => ui.chat.hidden ? openChat() : closeChat());
  ui.close.addEventListener('click', closeChat);
  // No panel: a composer above the keyboard. Messages show as bubbles over heads (default)
  // or as fading subtitles above the composer; swipe up / ⌃ shows the history.
  let mode = 'bubble'; try { if (localStorage.getItem('jjimjiljung-chat-mode') === 'subtitle') mode = 'subtitle'; } catch { /* storage may be unavailable */ }
  function setMode(next) {
    mode = next; ui.chat.dataset.mode = mode; ui.mode.textContent = mode === 'bubble' ? '💭' : '💬';
    ui.mode.setAttribute('aria-label', mode === 'bubble' ? '자막 모드로 보기' : '말풍선 모드로 보기');
    try { localStorage.setItem('jjimjiljung-chat-mode', mode); } catch { /* storage may be unavailable */ }
  }
  function setHistory(on) { ui.chat.classList.toggle('history', on); ui.history.setAttribute('aria-pressed', String(on)); if (on) ui.log.scrollTop = ui.log.scrollHeight; }
  ui.mode.addEventListener('click', () => setMode(mode === 'bubble' ? 'subtitle' : 'bubble'));
  ui.history.addEventListener('click', () => setHistory(!ui.chat.classList.contains('history')));
  let swipeY = null;
  ui.form.addEventListener('pointerdown', event => { swipeY = event.clientY; });
  ui.form.addEventListener('pointerup', event => { if (swipeY !== null && swipeY - event.clientY > 40) setHistory(true); else if (swipeY !== null && event.clientY - swipeY > 40) setHistory(false); swipeY = null; });
  // Tapping anywhere else puts the composer away.
  document.addEventListener('pointerdown', event => { if (!ui.chat.hidden && !ui.chat.contains(event.target) && !ui.open.contains(event.target)) closeChat(); }, true);
  setMode(mode);
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

  // Towel trades are addressed to one visitor; anyone else ignores them.
  function readTrade(payload) {
    if (!payload || payload.to !== id || typeof payload.from !== 'string' || !remotes.has(payload.from)) return;
    if (!['offer', 'accept', 'decline', 'cancel', 'making', 'gift'].includes(payload.type)) return;
    const towel = typeof payload.towel === 'string' && /^#[0-9a-f]{6}$/.test(payload.towel) ? payload.towel : null;
    if (['offer', 'accept', 'gift'].includes(payload.type) && !towel) return;
    onTrade?.({ type: payload.type, from: payload.from, name: remotes.get(payload.from).name, towel, tid: String(payload.tid || '').slice(0, 40) });
  }
  function readGreet(payload) {
    if (!payload || payload.to !== id || typeof payload.from !== 'string' || !remotes.has(payload.from)) return;
    if (!['hello', 'accept'].includes(payload.type)) return;
    onGreet?.({ type: payload.type, from: payload.from, name: remotes.get(payload.from).name, gid: String(payload.gid || '').slice(0, 40) });
  }
  // ---------- Request-based group chat (server rules: supabase/migrations/20261031_groups.sql) ----------
  // Asking someone: the server records the request and enforces the limits; a broadcast
  // only nudges the other visitor to look it up. Accepting puts both in one group (≤ 6),
  // whose messages travel on a members-only private channel.
  let group = null, outgoing = null, incoming = null;
  const ui2 = { card: $('#chatreq-card'), name: $('#chatreq-name'), left: $('#chatreq-left'), accept: $('#chatreq-accept'), decline: $('#chatreq-decline'), leave: $('#chat-leave') };
  const NO_ANSWER = '응답이 없어요';
  const RESULT = { sent: null, pending: '이미 신청했어요. 답을 기다려요', rate_limited: '조금 뒤에 다시 신청해요 (1분에 3번까지)', group_full: '그룹이 꽉 찼어요 (최대 6명)', cooling_down: NO_ANSWER, unavailable: NO_ANSWER, invalid: NO_ANSWER };
  async function requestChat(remoteId) {
    const remote = remotes.get(remoteId), api = link?.groups;
    if (!remote || !api || status !== 'online') { notify('연결된 뒤에 대화를 신청할 수 있어요'); return; }
    if (!remote.uid) { notify(NO_ANSWER); return; }
    if (group?.members.has(remote.uid)) { notify(`${remote.name}님과 이미 같은 그룹이에요`); return; }
    let result; try { result = await api.requestChat(remote.uid); } catch { result = 'invalid'; }
    if (result !== 'sent') { notify(RESULT[result] || NO_ANSWER); return; }
    link.send('chatreq', { from: id, to: remoteId });
    clearTimeout(outgoing?.timer);
    outgoing = { to: remoteId, timer: setTimeout(() => { outgoing = null; notify(NO_ANSWER); }, 61000) };
    notify(`${remote.name}님에게 대화를 신청했어요 💬`);
  }
  function closeIncoming() { clearInterval(incoming?.timer); incoming = null; ui2.card.hidden = true; }
  async function onChatSignal(event, payload) {
    if (!payload || payload.to !== id || typeof payload.from !== 'string' || !remotes.has(payload.from)) return;
    const remote = remotes.get(payload.from), api = link?.groups; if (!api || !remote.uid) return;
    if (event === 'chatreq') {
      let request = null; try { request = await api.pendingFrom(remote.uid); } catch { /* not verified, ignore */ }
      if (!request || incoming) return;
      const left = () => Math.max(0, Math.ceil(60 - (Date.now() - new Date(request.created_at).getTime()) / 1000));
      incoming = { from: payload.from, request, timer: setInterval(() => { ui2.left.textContent = `${left()}초`; if (!left()) closeIncoming(); }, 500) };
      ui2.name.textContent = `${remote.name}님이 대화를 신청했어요`; ui2.left.textContent = `${left()}초`; ui2.card.hidden = false;
    } else if (outgoing?.to === payload.from) {
      clearTimeout(outgoing.timer); outgoing = null;
      // Trust only the server: am I really in that group now?
      const mine = payload.group ? await api.myGroup().catch(() => null) : null;
      if (mine && mine === payload.group) { await joinGroup(mine); notify(`${remote.name}님과 대화가 시작됐어요 💬`); }
      else notify(NO_ANSWER);
    }
  }
  async function answer(accept) {
    if (!incoming) return; const { from, request } = incoming, remote = remotes.get(from), api = link.groups; closeIncoming();
    let gid = null; try { gid = await api.answer(request.id, accept, nickname, remote?.name || '손님'); } catch { gid = null; }
    link.send('chatans', { from: id, to: from, group: gid });
    if (gid) { await joinGroup(gid); notify(`${remote?.name || '손님'}님과 대화가 시작됐어요 💬`); }
  }
  ui2.accept.addEventListener('click', () => answer(true));
  ui2.decline.addEventListener('click', () => answer(false));
  async function refreshMembers() {
    if (!group) return;
    const list = await link.groups.members(group.id).catch(() => []);
    group.members = new Set(list.map(m => m.user_id));
    if (!group.members.has(link.groups.uid)) { dropGroup(); return; }
    ui.count.textContent = `우리 그룹 ${list.length}명`; ui2.leave.hidden = false;
    viewport.dataset.group = String(list.length);
  }
  async function joinGroup(gid) {
    if (group?.id === gid) { await refreshMembers(); group.channel.send('member', { id }); return; }
    if (group) dropGroup();
    group = { id: gid, members: new Set(), channel: link.groups.joinGroup(gid, (event, payload) => event === 'msg' ? onChat(payload) : refreshMembers()) };
    await refreshMembers(); group.channel.send('member', { id });
    system('그룹 대화가 시작됐어요. 말풍선은 우리 그룹에게만 보여요');
  }
  function dropGroup() { group?.channel.leave(); group = null; ui2.leave.hidden = true; ui.count.textContent = ''; viewport.dataset.group = '0'; }
  async function restoreGroup() { const gid = await link?.groups?.myGroup().catch(() => null); if (gid) await joinGroup(gid); }
  ui2.leave.addEventListener('click', async () => {
    if (!group) return; const channel = group.channel; channel.send('member', { id });
    dropGroup(); await link.groups.leave().catch(() => {}); channel.send?.('member', { id }); system('그룹에서 나왔어요'); notify('그룹에서 나왔어요');
  });

  const pickHits = [];
  function presencePayload() { return { id, uid: link?.groups?.uid || null, name: nickname, outfit: getLocal().outfit }; }
  async function start() {
    status = 'connecting'; renderStatus();
    try {
      link = await connect({ id, presence: presencePayload(), onPresence, onStatus: next => { status = next; renderStatus(); if (next === 'online') lastSent = 0; }, onMessage: (event, payload) => event === 'state' ? onState(payload) : event === 'chatreq' || event === 'chatans' ? onChatSignal(event, payload) : event === 'trade' ? readTrade(payload) : event === 'greet' ? readGreet(payload) : null });
      selfLabel.hidden = false; link.track(presencePayload());
      if (!ui.log.children.length) system(`${nickname}님, 찜질방에 오신 걸 환영해요! 다른 손님을 눌러 대화를 신청해 보세요`);
      restoreGroup();
    } catch { status = 'offline'; renderStatus(); }
  }
  async function reconnect() { if (link) { await link.leave(); link = null; } for (const remoteId of [...remotes.keys()]) removeRemote(remoteId); presence = []; start(); }
  function renderStatus() {
    const count = presence.length + 1;
    ui.online.dataset.status = status;
    ui.onlineText.textContent = status === 'online' ? `${count}명 접속 중` : status === 'connecting' ? '연결 중…' : status === 'offline' ? '다시 연결' : '함께하기';
    if (!group) ui.count.textContent = '';
    viewport.dataset.online = status === 'online' ? String(count) : status;
  }
  addEventListener('pagehide', () => { link?.leave(); });
  renderStatus();
  if (nickname) start(); else openJoin();

  return {
    get status() { return status; }, get nickname() { return nickname; }, get count() { return presence.length + 1; }, remotes, id,
    isChatOpen: () => !ui.chat.hidden,
    // The nearest visible visitor under a ray, for tapping someone on screen.
    pick(raycaster) {
      let best = null, bestDistance = Infinity;
      for (const remote of remotes.values()) {
        if (!remote.placed || !remote.character.root.visible) continue;
        pickHits.length = 0; raycaster.intersectObject(remote.character.root, true, pickHits);
        if (pickHits.length && pickHits[0].distance < bestDistance) { bestDistance = pickHits[0].distance; best = remote; }
      }
      return best;
    },
    requestChat,
    get group() { return group ? { id: group.id, size: group.members.size } : null; },
    sendGreet(to, type, gid) { if (link && status === 'online') link.send('greet', { from: id, to, type, gid }); },
    sendTrade(to, type, towel = null, tid = '') { if (link && status === 'online') link.send('trade', { from: id, to, type, towel, tid }); },
    outfitChanged() { if (link && status === 'online') { link.track(presencePayload()); lastSent = 0; } },
    update(dt, reducedMotion) {
      const local = getLocal();
      // Send my state ~5×/s while moving or changing pose, and a heartbeat when idle.
      const now = performance.now();
      if (link && status === 'online') {
        const signature = `${local.action}|${local.walking}|${local.outfit}|${local.snack}`;
        const due = now - lastSent > (local.walking ? MOVE_INTERVAL : IDLE_INTERVAL) || signature !== lastSignature;
        if (due && now - lastSent > 120) {
          lastSent = now; lastSignature = signature;
          link.send('state', { id, x: +local.x.toFixed(2), z: +local.z.toFixed(2), f: +local.facing.toFixed(2), a: local.action, s: local.snack, w: local.walking, o: local.outfit, r: local.room });
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
