// 사주방: today's fortune from the birth day pillar (日柱) and today's pillar (日辰),
// computed in the browser for fun. The birth date never leaves the device.
export const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const ELEMENTS = ['목', '화', '토', '금', '수'];
const KEY = 'jjimjiljung-saju';

// Julian day number of a calendar date (proleptic Gregorian).
function julianDay(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
// Sexagenary day index, 0 = 갑자 (2000-01-01 is 무오, index 54).
export function dayPillar(y, m, d) {
  const i = ((julianDay(y, m, d) - 11) % 60 + 60) % 60;
  return { index: i, stem: i % 10, branch: i % 12, name: STEMS[i % 10] + BRANCHES[i % 12], element: ELEMENTS[Math.floor(i % 10 / 2)] };
}
// How today's element relates to mine: same, I feed it, it feeds me, I control it, it controls me.
export function relation(mine, today) {
  const a = ELEMENTS.indexOf(mine), b = ELEMENTS.indexOf(today);
  return ['same', 'output', 'wealth', 'power', 'support'][((b - a) % 5 + 5) % 5];
}
const READ = {
  same: { title: '든든한 동료의 날', total: 4, money: 3, love: 4, health: 4, text: '비슷한 마음을 가진 사람과 잘 통해요. 함께하면 일이 술술 풀려요.' },
  output: { title: '표현이 빛나는 날', total: 4, money: 3, love: 5, health: 3, text: '말과 재주가 반짝여요. 마음을 솔직하게 전해 보세요.' },
  wealth: { title: '작은 행운이 굴러오는 날', total: 4, money: 5, love: 3, health: 3, text: '꼼꼼히 챙긴 만큼 돌아와요. 계획했던 일을 시작하기 좋아요.' },
  power: { title: '차분히 다지는 날', total: 3, money: 3, love: 3, health: 4, text: '서두르지 말고 한 걸음씩. 따뜻한 찜질로 몸을 풀어 주세요.' },
  support: { title: '도움을 받는 날', total: 5, money: 4, love: 4, health: 5, text: '주변의 응원이 큰 힘이 돼요. 고마운 사람에게 인사를 건네요.' }
};
const COLORS = { 목: ['초록', '#8fcf9b'], 화: ['다홍', '#f28b6b'], 토: ['노랑', '#f2c95c'], 금: ['하양', '#f4efe6'], 수: ['남색', '#6f8fd8'] };
// Element that feeds mine: wearing its colour "supports" me today.
const FEEDS = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };

// birth = 'YYYY-MM-DD', hour = 0..23 or null; today = Date (Korea day is used).
export function fortune(birth, hour, today = new Date()) {
  const [y, m, d] = birth.split('-').map(Number);
  if (!y || !m || !d) return null;
  const mine = dayPillar(y, m, d);
  const k = new Date(today.getTime() + 9 * 3600000);
  const day = dayPillar(k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate());
  const rel = relation(mine.element, day.element), r = READ[rel];
  // The birth hour nudges one area, so two people born the same day still differ a little.
  const nudge = hour == null ? 0 : (hour + day.index) % 4;
  const bump = (v, i) => Math.max(1, Math.min(5, v + (nudge === i ? 1 : 0) - (nudge === (i + 2) % 4 && v > 2 ? 1 : 0)));
  const [color, hex] = COLORS[FEEDS[mine.element]];
  return {
    mine: mine.name, element: mine.element, today: day.name, todayElement: day.element, relation: rel, title: r.title, text: r.text,
    scores: { 총운: bump(r.total, 0), 재물: bump(r.money, 1), 연애: bump(r.love, 2), 건강: bump(r.health, 3) },
    color, hex, number: (mine.index + day.index) % 9 + 1
  };
}
export function loadBirth(storage = globalThis.localStorage) { try { return JSON.parse(storage.getItem(KEY) || 'null'); } catch { return null; } }
export function saveBirth(value, storage = globalThis.localStorage) { try { if (value) storage.setItem(KEY, JSON.stringify(value)); else storage.removeItem(KEY); } catch { /* storage may be unavailable */ } }
