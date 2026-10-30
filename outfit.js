// Outfits: a top, a bottom and (once made in the towel game) a sheep-cap towel.
// One tap re-dyes every part with its own random colour; nothing is matched.
// Shared by the player, residents, remote visitors and the network payload.
const KEY = 'jjimjiljung-outfit-v2', LEGACY_KEY = 'jjimjiljung-outfit';
// The pre-v2 palettes (top, bottom, towel) so returning visitors keep their look.
const LEGACY = { peach: ['#e6a05b', '#cf874b', '#fff2db'], mint: ['#bdcaa2', '#9cab80', '#b7c89a'], lilac: ['#c8b2d8', '#a88dbc', '#c7b0d5'] };

export function hex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
// Hue anchors are spread by how colours look: greens span a wide HSL arc,
// so a uniform hue would pick green far too often.
const HUES = [0, 12, 24, 34, 44, 54, 95, 150, 175, 192, 205, 218, 232, 248, 265, 282, 300, 318, 335, 348];
const NEUTRALS = ['#fbf8f3', '#f1e9de', '#e4dccf', '#cfc6bb', '#a99a8c', '#8a7a70'];
// [saturation min, max, lightness min, max]: muted plush tops, pale bottoms, bright towels.
const RANGES = { top: [45, 72, 62, 77], bottom: [25, 50, 72, 88], towel: [62, 92, 64, 78] };
const NEUTRAL_CHANCE = { top: .12, bottom: .35, towel: .07 };
export function randomPart(part, rnd = Math.random) {
  if (rnd() < NEUTRAL_CHANCE[part]) return NEUTRALS[Math.floor(rnd() * NEUTRALS.length)];
  const [s0, s1, l0, l1] = RANGES[part];
  return hex(HUES[Math.floor(rnd() * HUES.length)] + (rnd() - .5) * 12, s0 + rnd() * (s1 - s0), l0 + rnd() * (l1 - l0));
}
export function randomOutfit(rnd = Math.random, extra = {}) {
  const towel = randomPart('towel', rnd);
  return { top: randomPart('top', rnd), bottom: randomPart('bottom', rnd), towel, hasTowel: false, wear: false, towels: [], shoulder: false, shoulderColor: towel, ...extra };
}
// ---------- My towel collection ----------
// Towels I made or received; the one I wear is always in it. A towel given
// away in a swap leaves it. The oldest drop out past MAX_TOWELS.
export const MAX_TOWELS = 24;
const HEX = /^#[0-9a-f]{6}$/;
export function addTowel(outfit, color) {
  const towels = [...outfit.towels, color].slice(-MAX_TOWELS);
  return { ...outfit, towels, towel: color, hasTowel: true, shoulderColor: towels.includes(outfit.shoulderColor) ? outfit.shoulderColor : color };
}
export function removeTowel(outfit, color) {
  const towels = [...outfit.towels], at = towels.lastIndexOf(color);
  if (at >= 0) towels.splice(at, 1);
  // A shoulder towel in the colour that left switches to one I still own.
  const shoulderColor = towels.includes(outfit.shoulderColor) ? outfit.shoulderColor : towels[towels.length - 1] || outfit.towel;
  return { ...outfit, towels, shoulderColor };
}
// The re-dye button picks one of my own towels, preferring a different one.
// The shoulder towel is also one of mine, chosen independently of the cap.
export function pickShoulder(outfit, rnd = Math.random) {
  if (!outfit.towels.length) return outfit.shoulderColor || outfit.towel;
  return outfit.towels[Math.floor(rnd() * outfit.towels.length)];
}
export function pickTowel(outfit, rnd = Math.random) {
  if (!outfit.hasTowel || !outfit.towels.length) return outfit.towel;
  const others = outfit.towels.filter(color => color !== outfit.towel);
  const pool = others.length ? others : outfit.towels;
  return pool[Math.floor(rnd() * pool.length)];
}
// A deterministic generator for residents, so they look the same every visit.
export function seeded(seed) {
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function shade(color, amount) {
  const n = parseInt(color.slice(1), 16), mix = amount < 0 ? 0 : 255, t = Math.abs(amount);
  return '#' + [n >> 16, n >> 8 & 255, n & 255].map(c => Math.round(c + (mix - c) * t).toString(16).padStart(2, '0')).join('');
}
// [cloth, trouser, trim, towel, seam] as character.js expects.
export function outfitColors(outfit) {
  return [outfit.top, outfit.bottom, shade(outfit.top, .35), outfit.towel, shade(outfit.towel, -.12)];
}
export const capOn = outfit => !!(outfit.hasTowel && outfit.wear);

export const SHOULDER_ENABLED = false;
// Network form: "top.bottom.towel.flags[.shoulder]" with 6-digit hex; flags 1 = has a towel,
// 2 = wearing the sheep cap, 4 = wearing a shoulder towel (its colour is the 5th part).
const CODE = /^([0-9a-f]{6})\.([0-9a-f]{6})\.([0-9a-f]{6})\.([0-7])(?:\.([0-9a-f]{6}))?$/;
export function encodeOutfit(o) {
  // The shoulder towel is switched off for now (flag 4 is never sent; old codes still decode).
  const flags = (o.hasTowel ? 1 : 0) | (o.wear ? 2 : 0) | (SHOULDER_ENABLED && o.hasTowel && o.shoulder ? 4 : 0);
  return `${o.top.slice(1)}.${o.bottom.slice(1)}.${o.towel.slice(1)}.${flags}` + (flags & 4 ? `.${o.shoulderColor.slice(1)}` : '');
}
export function decodeOutfit(code) {
  if (typeof code !== 'string') return null;
  if (LEGACY[code]) { const [top, bottom, towel] = LEGACY[code]; return { top, bottom, towel, hasTowel: true, wear: true, shoulder: false, shoulderColor: towel }; }
  const m = CODE.exec(code.slice(0, 31)); if (!m) return null;
  const flags = +m[4], has = !!(flags & 1);
  return { top: '#' + m[1], bottom: '#' + m[2], towel: '#' + m[3], hasTowel: has, wear: has && !!(flags & 2), shoulder: has && !!(flags & 4) && !!m[5], shoulderColor: m[5] ? '#' + m[5] : '#' + m[3] };
}
const valid = o => o && /^#[0-9a-f]{6}$/.test(o.top) && /^#[0-9a-f]{6}$/.test(o.bottom) && /^#[0-9a-f]{6}$/.test(o.towel);

// Newcomers get random clothes and no towel yet. Visitors from before v2
// keep their palette colours and the towel cap they were already wearing.
export function loadOutfit(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(KEY) || 'null');
    if (valid(saved)) {
      const towels = Array.isArray(saved.towels) ? saved.towels.filter(color => HEX.test(color)).slice(-MAX_TOWELS) : [];
      if (saved.hasTowel && !towels.includes(saved.towel)) towels.push(saved.towel);
      const shoulderColor = HEX.test(saved.shoulderColor) && towels.includes(saved.shoulderColor) ? saved.shoulderColor : saved.towel;
      return { top: saved.top, bottom: saved.bottom, towel: saved.towel, hasTowel: !!saved.hasTowel, wear: !!saved.hasTowel && saved.wear !== false, towels, shoulder: !!saved.hasTowel && !!saved.shoulder, shoulderColor };
    }
    const legacy = storage.getItem(LEGACY_KEY);
    if (LEGACY[legacy]) { const outfit = decodeOutfit(legacy); outfit.towels = [outfit.towel]; outfit.shoulderColor = outfit.towel; saveOutfit(outfit, storage); return outfit; }
  } catch { /* storage may be unavailable */ }
  const outfit = randomOutfit(); saveOutfit(outfit, storage); return outfit;
}
export function saveOutfit(outfit, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(outfit)); } catch { /* storage may be unavailable */ }
}
