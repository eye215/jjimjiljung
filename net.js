// Realtime transports with one small interface, so the game does not care
// whether it talks to Supabase Realtime or (for local testing) other tabs:
//   connect({ id, presence, onPresence, onMessage, onStatus }) → { track, send, leave }
// onPresence receives an array of presence payloads (one per visitor).
// onStatus receives 'connecting' | 'online' | 'offline'.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, PUBLIC_CHANNEL } from './config.js?v=rpg-27';

const EVENTS = ['state', 'chat', 'trade', 'greet', 'chatreq', 'chatans'];

function loadSupabase() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/supabase.umd.js?v=2.117.3', import.meta.url).href;
    script.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('Supabase client missing'));
    script.onerror = () => reject(new Error('Supabase client unavailable'));
    document.head.appendChild(script);
  });
}

export async function connectSupabase({ id, presence, onPresence, onMessage, onStatus, channelName = PUBLIC_CHANNEL }) {
  onStatus('connecting');
  const { createClient } = await loadSupabase();
  // An invisible anonymous account (kept on this device) identifies the visitor to the
  // group-chat functions and private channels; no email or password is ever asked.
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'jjimjiljung-auth' },
    realtime: { params: { eventsPerSecond: 12 } }
  });
  let uid = null;
  try {
    const { data } = await client.auth.getSession();
    uid = data.session?.user?.id || (await client.auth.signInAnonymously()).data?.user?.id || null;
    if (uid) await client.realtime.setAuth();
  } catch { uid = null; }
  const channel = client.channel(channelName, { config: { broadcast: { self: false, ack: false }, presence: { key: id } } });
  let current = presence;
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    onPresence(Object.values(state).map(metas => metas[metas.length - 1]).filter(Boolean));
  });
  for (const event of EVENTS) channel.on('broadcast', { event }, message => onMessage(event, message.payload));
  channel.subscribe(async status => {
    if (status === 'SUBSCRIBED') { onStatus('online'); await channel.track(current).catch(() => {}); }
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus('offline');
  });
  const one = async query => { const { data, error } = await query; if (error) throw error; return data; };
  const groups = uid && {
    uid,
    requestChat: target => one(client.rpc('request_chat', { target })),
    pendingFrom: async from => (await one(client.from('chat_requests').select('id,created_at').eq('to_user', uid).eq('from_user', from).eq('status', 'pending').order('created_at', { ascending: false }).limit(1)))[0] || null,
    answer: (request, accept, myName, theirName) => one(client.rpc('answer_chat', { request, accept, my_name: myName, their_name: theirName })),
    myGroup: async () => (await one(client.from('group_members').select('group_id').eq('user_id', uid).limit(1)))[0]?.group_id || null,
    members: group => one(client.from('group_members').select('user_id,nickname').eq('group_id', group)),
    leave: () => one(client.rpc('leave_group')),
    joinGroup(group, onMessage) {
      const ch = client.channel('group:' + group, { config: { private: true, broadcast: { self: false } } });
      for (const event of ['msg', 'member']) ch.on('broadcast', { event }, message => onMessage(event, message.payload));
      ch.subscribe();
      return { send: (event, payload) => ch.send({ type: 'broadcast', event, payload }).catch(() => {}), leave: () => client.removeChannel(ch).catch(() => {}) };
    }
  };
  return {
    groups,
    track(next) { current = next; return channel.track(next).catch(() => {}); },
    send(event, payload) { return channel.send({ type: 'broadcast', event, payload }).catch(() => {}); },
    async leave() { await channel.untrack().catch(() => {}); await client.removeChannel(channel).catch(() => {}); }
  };
}

// Same rules as supabase/migrations/20261031_groups.sql, kept in this browser's storage
// so the local transport (tests, demos) behaves like the server.
function localGroups(uid) {
  const KEY = 'jjimjiljung-local-server';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { requests: [], members: [] }; } catch { return { requests: [], members: [] }; } };
  const write = db => localStorage.setItem(KEY, JSON.stringify(db));
  const expire = db => { const now = Date.now(); for (const r of db.requests) if (r.status === 'pending' && now - r.at > 60000) { r.status = 'expired'; r.answered = now; } };
  const groupOf = (db, user) => db.members.find(m => m.user === user)?.group || null;
  return {
    uid,
    async requestChat(target) {
      const db = read(); expire(db); const now = Date.now();
      if (!target || target === uid) return 'invalid';
      if (db.requests.filter(r => r.from === uid && now - r.at < 60000).length >= 3) return 'rate_limited';
      if (db.requests.filter(r => r.from === uid && r.to === target && ['declined', 'expired'].includes(r.status) && now - r.answered < 600000).length >= 3) return 'cooling_down';
      if (db.requests.some(r => r.from === uid && r.to === target && r.status === 'pending')) return 'pending';
      const mine = groupOf(db, uid); if (mine && db.members.filter(m => m.group === mine).length >= 6) return 'group_full';
      db.requests.push({ id: Math.random().toString(36).slice(2), from: uid, to: target, status: 'pending', at: now }); write(db); return 'sent';
    },
    async pendingFrom(from) { const db = read(); expire(db); write(db); const r = db.requests.filter(x => x.to === uid && x.from === from && x.status === 'pending').pop(); return r ? { id: r.id, created_at: new Date(r.at).toISOString() } : null; },
    async answer(request, accept, myName, theirName) {
      const db = read(); expire(db); const r = db.requests.find(x => x.id === request && x.to === uid && x.status === 'pending');
      if (!r) { write(db); return null; }
      r.status = accept ? 'accepted' : 'declined'; r.answered = Date.now();
      if (!accept) { write(db); return null; }
      let group = groupOf(db, r.from);
      if (!group) { group = 'g' + Math.random().toString(36).slice(2); db.members.push({ group, user: r.from, nickname: theirName }); }
      if (db.members.filter(m => m.group === group).length >= 6) { write(db); return null; }
      db.members = db.members.filter(m => m.user !== uid); db.members.push({ group, user: uid, nickname: myName }); write(db); return group;
    },
    async myGroup() { return groupOf(read(), uid); },
    async members(group) { return read().members.filter(m => m.group === group).map(m => ({ user_id: m.user, nickname: m.nickname })); },
    async leave() { const db = read(); db.members = db.members.filter(m => m.user !== uid); write(db); },
    joinGroup(group, onMessage) {
      const bus = new BroadcastChannel('local:group:' + group);
      bus.onmessage = ({ data }) => { if (data && data.from !== uid && groupOf(read(), uid) === group) onMessage(data.event, data.payload); };
      return { send: (event, payload) => bus.postMessage({ from: uid, event, payload }), leave: () => bus.close() };
    }
  };
}

// Same-browser transport (BroadcastChannel) used by tests and local demos via
// `?net=local`. Presence is rebuilt from heartbeats that expire after 4 s.
export async function connectLocal({ id, presence, onPresence, onMessage, onStatus, channelName = PUBLIC_CHANNEL }) {
  onStatus('connecting');
  const bus = new BroadcastChannel('local:' + channelName);
  const peers = new Map();
  let current = presence;
  const publish = () => onPresence([current, ...[...peers.values()].map(peer => peer.presence)]);
  const hello = () => bus.postMessage({ kind: 'hello', id, presence: current });
  bus.onmessage = ({ data }) => {
    if (!data || data.id === id) return;
    if (data.kind === 'hello') {
      const known = peers.has(data.id); peers.set(data.id, { presence: data.presence, seen: Date.now() });
      if (!known) { hello(); publish(); } else publish();
    } else if (data.kind === 'bye') { if (peers.delete(data.id)) publish(); }
    else if (data.kind === 'event') onMessage(data.event, data.payload);
  };
  const beat = setInterval(() => {
    hello();
    let changed = false; for (const [peer, info] of peers) if (Date.now() - info.seen > 4000) { peers.delete(peer); changed = true; }
    if (changed) publish();
  }, 1000);
  const bye = () => bus.postMessage({ kind: 'bye', id });
  addEventListener('pagehide', bye);
  setTimeout(() => { onStatus('online'); hello(); publish(); }, 50);
  return {
    groups: localGroups('local-' + id),
    track(next) { current = next; hello(); publish(); },
    send(event, payload) { bus.postMessage({ kind: 'event', id, event, payload }); },
    async leave() { clearInterval(beat); bye(); removeEventListener('pagehide', bye); bus.close(); }
  };
}

export function connect(options) {
  const local = new URLSearchParams(location.search).get('net') === 'local';
  return local ? connectLocal(options) : connectSupabase(options);
}
