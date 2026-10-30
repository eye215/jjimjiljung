// Realtime transports with one small interface, so the game does not care
// whether it talks to Supabase Realtime or (for local testing) other tabs:
//   connect({ id, presence, onPresence, onMessage, onStatus }) → { track, send, leave }
// onPresence receives an array of presence payloads (one per visitor).
// onStatus receives 'connecting' | 'online' | 'offline'.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, PUBLIC_CHANNEL } from './config.js?v=rpg-19';

const EVENTS = ['state', 'chat', 'trade', 'greet'];

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
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 12 } }
  });
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
  return {
    track(next) { current = next; return channel.track(next).catch(() => {}); },
    send(event, payload) { return channel.send({ type: 'broadcast', event, payload }).catch(() => {}); },
    async leave() { await channel.untrack().catch(() => {}); await client.removeChannel(channel).catch(() => {}); }
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
    track(next) { current = next; hello(); publish(); },
    send(event, payload) { bus.postMessage({ kind: 'event', id, event, payload }); },
    async leave() { clearInterval(beat); bye(); removeEventListener('pagehide', bye); bus.close(); }
  };
}

export function connect(options) {
  const local = new URLSearchParams(location.search).get('net') === 'local';
  return local ? connectLocal(options) : connectSupabase(options);
}
