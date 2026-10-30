// 매점 wallet: snack bag, 온기 points (♨) and one free egg and sikhye a day.
// Saved on this device for now; Phase 5 moves it to the server so it can't be edited.
export const SNACKS = Object.freeze({
  egg: Object.freeze({ id: 'egg', name: '맥반석 구운 계란', short: '계란', price: 5 }),
  drink: Object.freeze({ id: 'drink', name: '살얼음 식혜', short: '식혜', price: 5 })
});
export const WELCOME_POINTS = 10, DAILY_EARN_CAP = 60, REST_SECONDS = 30;
const KEY = 'jjimjiljung-wallet-v1';

// Days roll over at midnight Korea time, wherever the visitor is.
export const koreaDay = (date = new Date()) => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
const whole = (value, fallback = 0) => Number.isInteger(value) && value >= 0 && value < 100000 ? value : fallback;

export function createWallet({ storage = globalThis.localStorage, now = () => new Date() } = {}) {
  let state;
  try { state = JSON.parse(storage?.getItem(KEY) || 'null'); } catch { state = null; }
  state = {
    points: whole(state?.points, WELCOME_POINTS),
    bag: { egg: whole(state?.bag?.egg), drink: whole(state?.bag?.drink) },
    free: { egg: typeof state?.free?.egg === 'string' ? state.free.egg : '', drink: typeof state?.free?.drink === 'string' ? state.free.drink : '' },
    earnedDay: typeof state?.earnedDay === 'string' ? state.earnedDay : '', earned: whole(state?.earned)
  };
  const listeners = new Set();
  const save = () => { try { storage?.setItem(KEY, JSON.stringify(state)); } catch { /* storage may be unavailable */ } for (const fn of listeners) fn(wallet.snapshot()); };
  const known = kind => Object.hasOwn(SNACKS, kind);
  const wallet = {
    snapshot: () => ({ points: state.points, bag: { ...state.bag }, freeLeft: { egg: wallet.freeAvailable('egg'), drink: wallet.freeAvailable('drink') }, earnedToday: state.earnedDay === koreaDay(now()) ? state.earned : 0 }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    freeAvailable: kind => known(kind) && state.free[kind] !== koreaDay(now()),
    count: kind => known(kind) ? state.bag[kind] : 0,
    claimFree(kind) {
      if (!wallet.freeAvailable(kind)) return false;
      state.free[kind] = koreaDay(now()); state.bag[kind]++; save(); return true;
    },
    buy(kind) {
      if (!known(kind) || state.points < SNACKS[kind].price) return false;
      state.points -= SNACKS[kind].price; state.bag[kind]++; save(); return true;
    },
    consume(kind) {
      if (!known(kind) || state.bag[kind] < 1) return false;
      state.bag[kind]--; save(); return true;
    },
    // Points from resting and mini-games, capped per Korea day. Returns the amount granted.
    earn(amount) {
      const today = koreaDay(now());
      if (state.earnedDay !== today) { state.earnedDay = today; state.earned = 0; }
      const granted = Math.max(0, Math.min(whole(amount), DAILY_EARN_CAP - state.earned));
      if (granted) { state.points += granted; state.earned += granted; save(); }
      return granted;
    }
  };
  return wallet;
}

// Mini-game scoring, kept pure so it can be tested.
// Egg: `position` 0..1 of the moving marker when tapped; the sweet spot is the centre.
export function scoreEggCrack(position) {
  const off = Math.abs(position - .5);
  return off <= .07 ? { grade: 'perfect', points: 3 } : off <= .17 ? { grade: 'good', points: 1 } : { grade: 'miss', points: 0 };
}
// Sikhye one-shot: finished in time without brain freeze (peak = highest freeze meter).
export function scoreOneShot({ finished, frozen, peak }) {
  if (frozen || !finished) return { grade: 'miss', points: 0 };
  return peak < .7 ? { grade: 'perfect', points: 3 } : { grade: 'good', points: 2 };
}
