import { koreaDay } from './economy.js?v=rpg-23';

// 인사: pick a nearby visitor (auto when only one), wave at them, and they can
// accept within 10 s for a high-five. Same person: once per 30 s. The first
// mutual greeting with each partner per Korea day gives +1 온기, up to +5.
export const GREET_COOLDOWN = 30000, GREET_EXPIRE = 10000, GREET_RANGE = 6, GREET_DAILY = 5;
const KEY = 'jjimjiljung-greet-v1';

export function createGreetLog(storage = globalThis.localStorage, now = () => new Date()) {
  let state = { day: '', partners: [] };
  try { const saved = JSON.parse(storage.getItem(KEY) || 'null'); if (saved && Array.isArray(saved.partners)) state = { day: String(saved.day), partners: saved.partners.slice(0, GREET_DAILY).map(String) }; } catch { /* storage may be unavailable */ }
  const sent = new Map();
  return {
    // Milliseconds until I may greet `id` again (0 = now).
    wait(id, at = Date.now()) { return Math.max(0, (sent.get(id) || 0) + GREET_COOLDOWN - at); },
    sent(id, at = Date.now()) { sent.set(id, at); },
    // Records a completed greeting; true when it earns 온기 (new partner today, under the cap).
    reward(id) {
      const today = koreaDay(now());
      if (state.day !== today) state = { day: today, partners: [] };
      if (state.partners.includes(id) || state.partners.length >= GREET_DAILY) return false;
      state.partners.push(id);
      try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* storage may be unavailable */ }
      return true;
    }
  };
}

// Nearby visitors in the same room, closest first.
export function greetTargets(remotes, me, room, range = GREET_RANGE) {
  return [...remotes.values()]
    .filter(r => r.placed && r.room === room && Math.hypot(r.character.root.position.x - me.x, r.character.root.position.z - me.z) <= range)
    .sort((a, b) => Math.hypot(a.character.root.position.x - me.x, a.character.root.position.z - me.z) - Math.hypot(b.character.root.position.x - me.x, b.character.root.position.z - me.z));
}
