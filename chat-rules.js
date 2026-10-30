// Pure chat rules shared by senders and receivers. Receivers apply them again,
// because anyone can bypass a browser's own checks.
export const MAX_MESSAGE = 120;
export const MAX_NICKNAME = 10;

// A small first-line filter. AI moderation (Phase 4) runs on the server later.
const BLOCKED = ['시발', '씨발', '씨바', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '개새끼', '개새', '새끼', '좆', 'ㅈ같', '존나', '졸라', '지랄', 'ㅈㄹ', '닥쳐', '미친놈', '미친년', '꺼져', '엠창', '느금', '니애미', 'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cunt'];
// Allow separators between letters so "씨 발" or "f.u.c.k" are caught too.
const SEPARATOR = '[\\s._\\-*~!@#$%^&+=|/\\\\0-9]*';
const PATTERNS = BLOCKED.map(word => new RegExp([...word].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(SEPARATOR), 'giu'));

export function cleanText(value, max = MAX_MESSAGE) {
  if (typeof value !== 'string') return '';
  // Strip control characters and collapse whitespace; keep emoji and Korean.
  return [...value.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('');
}

export function maskProfanity(text) {
  let masked = text, flagged = false;
  for (const pattern of PATTERNS) masked = masked.replace(pattern, match => { flagged = true; return '♨'.repeat(Math.min(3, [...match].length)); });
  return { text: masked, flagged };
}

export function cleanNickname(value) {
  const text = cleanText(value, MAX_NICKNAME);
  if (!text || maskProfanity(text).flagged) return '';
  return text;
}

// Sliding-window limiter: at most `count` sends per `windowMs`, and at least
// `gapMs` between two sends. Returns 0 when allowed, otherwise ms to wait.
export function createRateLimit({ count = 5, windowMs = 10000, gapMs = 1200 } = {}) {
  const times = [];
  return {
    check(now = Date.now()) {
      while (times.length && now - times[0] > windowMs) times.shift();
      const gap = times.length ? gapMs - (now - times[times.length - 1]) : 0;
      const full = times.length >= count ? windowMs - (now - times[0]) : 0;
      return Math.max(0, gap, full);
    },
    hit(now = Date.now()) { times.push(now); }
  };
}

// Validates an incoming chat payload; returns null for anything malformed.
export function readChat(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const id = typeof payload.id === 'string' ? payload.id.slice(0, 40) : '';
  const name = cleanNickname(payload.name) || '손님';
  const text = maskProfanity(cleanText(payload.text)).text;
  const mid = typeof payload.mid === 'string' ? payload.mid.slice(0, 40) : '';
  if (!id || !text || !mid) return null;
  return { id, name, text, mid, room: typeof payload.room === 'string' ? payload.room.slice(0, 20) : 'lobby', ts: Date.now() };
}

// Cosy jjimjilbang nickname suggestions: a soft feeling + a sauna thing.
// Pure word combinations (no network); always ≤ MAX_NICKNAME characters.
const FEELINGS = ['말랑', '뽀송', '따끈', '노곤', '포근', '몽글', '보들', '나른', '촉촉', '살랑', '느긋', '꿀잠', '사르르', '보송', '토닥', '푹신', '훈훈', '도란'];
const THINGS = ['양머리', '식혜', '맥반석', '구운계란', '불가마', '소금방', '수건', '찜질러', '온돌', '황토', '편백', '김모락', '목침', '살얼음', '꿀잠러', '반신욕', '세신러', '토끼수건'];
export function suggestNickname(random = Math.random) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const feeling = FEELINGS[Math.floor(random() * FEELINGS.length)], thing = THINGS[Math.floor(random() * THINGS.length)];
    const name = random() < .35 ? `${feeling}한${thing}` : feeling + thing;
    if ([...name].length <= MAX_NICKNAME && !name.includes('한한')) return name;
  }
  return '말랑양머리';
}
