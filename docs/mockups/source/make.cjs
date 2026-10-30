const fs = require('fs');
const ic = (n, s = 22, w = 2.5) => fs.readFileSync(`lucide-static-1.55.0/package/icons/${n}.svg`, 'utf8').replace(/<!--.*?-->/s, '').replace(/class="[^"]*"/, '').replace(/width="24"/, `width="${s}"`).replace(/height="24"/, `height="${s}"`).replace(/stroke-width="2"/, `stroke-width="${w}"`).replace(/\s+/g, ' ');
const PAL = [['피치','#F6B49B'],['살구','#F5C79F'],['버터','#F3DD9E'],['민트','#AEDCC6'],['세이지','#BACBA6'],['하늘','#ABCDEA'],['라벤더','#C6BBE8'],['라일락','#DDB9DC'],['핑크','#F3B7C6'],['크림','#F4EBDC'],['코코아','#B08D78'],['차콜','#77707A']];
const base = `
@import url(fontsource-jua-5.2.5/package/index.css);@import url(fontsource-dongle-5.2.5/package/700.css);
@font-face{font-family:Pretendard;src:url(pretendard-1.3.9/package/dist/web/variable/woff2/PretendardVariable.woff2) format('woff2');font-weight:45 920}
:root{--glass:rgba(255,250,245,.55);--ink:#5B4A42;--ink2:#7A6558;--peach:#FFB59A;--mint:#BFE3D0;--lav:#D8CCF2;--butter:#FFE6A7;--line:rgba(255,255,255,.7);--shadow:0 8px 32px rgba(120,80,60,.12)}
*{box-sizing:border-box}body{margin:0;width:390px;height:844px;overflow:hidden;font-family:Pretendard,sans-serif;color:var(--ink);background:url(bg.png) center/390px 844px;position:relative;font-size:13px}
.g{background:var(--glass);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);border:1px solid var(--line);box-shadow:var(--shadow),inset 0 1px 0 rgba(255,255,255,.9),inset 0 -8px 16px rgba(255,255,255,.18)}
.pill{border-radius:999px}.row{display:flex;align-items:center}
svg{display:block}
`;
function page(variant, sheet) {
  const A = variant === 'A';
  const display = A ? "'Jua'" : "'Dongle'"; const weight = A ? 400 : 700;
  const tiles = [['footprints','산책',true],['armchair','앉기'],['moon','눕기'],['egg','계란','1'],['cup-soda','식혜','0'],['hand','인사']];
  const css = base + `
.top{position:absolute;top:54px;left:14px;right:14px;justify-content:space-between}
.logo{font-weight:${weight};gap:6px;padding:8px 14px 8px 12px;font-family:${display},sans-serif;font-size:${A ? 21 : 30}px;line-height:1;${A ? '' : 'padding-top:6px;padding-bottom:4px;'}}
.logo .mark{width:28px;height:28px;border-radius:50%;background:linear-gradient(145deg,#FFD3C2,var(--peach));display:grid;place-items:center;color:#fff;font-size:16px;font-family:Pretendard}
.chip{gap:6px;padding:7px 12px;font-size:13px;font-weight:600}
.dot{width:8px;height:8px;border-radius:50%}
.menu{width:44px;height:44px;border-radius:50%;display:grid;place-items:center}
.stats{gap:10px;padding:7px 13px;font-size:13px;font-weight:700}.stats span{display:flex;align-items:center;gap:4px}
.hint{position:absolute;left:50%;transform:translateX(-50%);padding:9px 16px;font-size:13px;font-weight:600;white-space:nowrap}
.joy{position:absolute;left:18px;width:96px;height:96px;border-radius:50%;display:grid;place-items:center}
.joy i{width:42px;height:42px;border-radius:50%;background:linear-gradient(160deg,#fff,#FFE9DF);box-shadow:0 4px 12px rgba(120,80,60,.2),inset 0 1px 0 #fff}
.fab{position:absolute;right:18px;width:60px;height:60px;border-radius:50%;display:grid;place-items:center;flex-direction:column}
.fab small{font-size:13px;font-weight:700;margin-top:-2px}
.badge{position:absolute;top:-3px;right:-3px;min-width:22px;height:22px;border-radius:11px;background:var(--butter);border:2px solid #fff;font-size:12px;font-weight:800;display:grid;place-items:center}
.tile{display:flex;flex-direction:column;align-items:center;gap:3px;font-weight:700;font-size:13px;position:relative}
.tile .cnt{position:absolute;top:-4px;right:2px;min-width:18px;height:18px;border-radius:9px;background:#fff;border:1px solid var(--line);font-size:11px;font-weight:800;display:grid;place-items:center;box-shadow:0 2px 6px rgba(120,80,60,.15)}
.sel .jelly{background:linear-gradient(160deg,#FFD0BD,var(--peach));transform:scale(1.08);box-shadow:0 10px 22px rgba(255,140,110,.35),inset 0 2px 0 rgba(255,255,255,.75),inset 0 -6px 10px rgba(255,140,110,.25)}
.jelly{display:grid;place-items:center;transition:transform .2s}
`;
  const top = `<div class="top row">
    <div class="row" style="gap:6px"><div class="g pill logo row"><span class="mark">♨</span>찜질중</div>
    <div class="g pill chip row"><i class="dot" style="background:#7FC4A2"></i>중앙 휴게실</div></div>
    <button class="g menu" style="border:1px solid var(--line);padding:0;color:var(--ink)">${ic('menu', 22)}</button></div>`;
  const stats = `<div class="g pill stats row" style="position:absolute;top:110px;left:14px"><span>${ic('flame', 16)}10</span><span>${ic('egg', 16)}1</span><span>${ic('cup-soda', 16)}0</span><span style="border-left:1.5px solid rgba(91,74,66,.18);padding-left:9px;gap:5px"><i class="dot" style="background:#9FD3B7"></i>3명</span></div>`;
  let bottom;
  if (A) {
    bottom = `<div class="hint g pill" style="bottom:206px">바닥을 눌러 이동해요 ✦</div>
    <div class="g joy" style="bottom:216px"><i></i></div>
    <div class="g fab" style="bottom:222px">${ic('message-circle', 24)}<span class="badge">2</span></div>
    <div class="g" style="position:absolute;left:12px;right:12px;bottom:28px;border-radius:28px;padding:12px 12px 14px">
      <div class="row" style="justify-content:space-between;padding:0 4px 10px;border-bottom:1px solid rgba(255,255,255,.65)"><span style="font-size:13px;font-weight:600">어서 와요, 푹 쉬다 가요.</span>
      <button class="pill row" style="gap:5px;border:1px solid var(--line);background:rgba(255,255,255,.6);padding:7px 13px;font:700 13px Pretendard;color:var(--ink);box-shadow:inset 0 1px 0 #fff">${ic('shirt', 16)}옷장</button></div>
      <div class="row" style="justify-content:space-between;padding-top:12px">${tiles.map(([i, l, x]) => `<div class="tile ${x === true ? 'sel' : ''}"><div class="jelly" style="width:50px;height:46px;border-radius:18px;${x === true ? '' : 'background:rgba(255,255,255,.55);border:1px solid var(--line);box-shadow:inset 0 1px 0 #fff,0 4px 10px rgba(120,80,60,.08)'}">${ic(i, 22)}</div>${typeof x === 'string' ? `<span class="cnt">${x}</span>` : ''}${l}</div>`).join('')}</div>
    </div>`;
  } else {
    bottom = `<div class="hint g pill" style="bottom:236px">바닥을 눌러 이동해요 ✦</div>
    <div class="g joy" style="bottom:120px"><i></i></div>
    <div class="g fab" style="bottom:196px">${ic('message-circle', 24)}<span class="badge">2</span></div>
    <div class="g fab" style="bottom:124px;background:rgba(255,250,245,.6)">${ic('shirt', 22)}<small>옷장</small></div>
    <div class="g pill" style="position:absolute;left:50%;transform:translateX(-50%);bottom:122px;padding:9px 16px;font-size:13px;font-weight:600;white-space:nowrap">어서 와요, 푹 쉬다 가요.</div>
    <div class="row" style="position:absolute;left:10px;right:10px;bottom:28px;justify-content:space-between">${tiles.map(([i, l, x]) => `<div class="tile ${x === true ? 'sel' : ''}"><div class="g jelly" style="width:56px;height:56px;border-radius:50%;${x === true ? 'border:1px solid #fff' : ''}">${ic(i, 23)}</div>${typeof x === 'string' ? `<span class="cnt">${x}</span>` : ''}<span class="g pill" style="padding:2px 9px;font-size:13px">${l}</span></div>`).join('')}</div>`;
  }
  let sheetHtml = '';
  if (sheet) {
    const parts = A ? ['양머리 수건', '상의', '하의', '어깨 수건'] : [['양머리', 'sparkles'], ['상의', 'shirt'], ['하의', 'footprints'], ['어깨 수건', 'hand-heart']];
    const chips = PAL.map(([n, c], k) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-size:${A ? 13 : 13}px;font-weight:600"><span style="width:${A ? 42 : 46}px;height:${A ? 42 : 46}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.7),transparent 45%),${c};box-shadow:0 0 0 ${k === 1 ? '3px #fff,0 0 0 6px ' + 'var(--peach)' : '2px #fff'},0 4px 10px rgba(120,80,60,.15);display:grid;place-items:center;color:#5B4A42">${k === 1 ? ic('check', 18, 3) : ''}</span>${n}</div>`).join('');
    const saved = [['#F5C79F', '#FFF2E2', '#F6B49B', '#AEDCC6'], ['#C6BBE8', '#F4EBDC', '#DDB9DC', '#F3DD9E'], null].map(s => s ? `<span class="row" style="gap:2px;padding:6px 8px;border-radius:999px;background:rgba(255,255,255,.65);border:1px solid var(--line)">${s.map(c => `<i style="width:12px;height:12px;border-radius:50%;background:${c};box-shadow:0 0 0 1px #fff"></i>`).join('')}</span>` : `<span class="row" style="gap:4px;padding:6px 10px;border-radius:999px;border:1.5px dashed rgba(91,74,66,.25);font-size:13px;color:var(--ink2)">${ic('heart', 14)}빈 칸</span>`).join('');
    sheetHtml = `<div style="position:absolute;inset:0;background:rgba(91,74,66,.12)"></div>
    <div class="g" style="position:absolute;left:0;right:0;bottom:0;border-radius:28px 28px 0 0;padding:10px 18px 30px;background:rgba(255,250,245,.72)">
      <div style="width:40px;height:5px;border-radius:3px;background:rgba(91,74,66,.18);margin:0 auto 12px"></div>
      <div class="row" style="justify-content:space-between"><div style="font-family:${display};font-weight:${weight};font-size:${A ? 24 : 38}px;line-height:1">옷장</div>
      <div class="row" style="gap:8px"><button class="pill row" style="gap:6px;border:1px solid var(--line);background:var(--butter);padding:9px 14px;font:800 13px Pretendard;color:var(--ink);box-shadow:inset 0 1px 0 #fff,0 4px 12px rgba(200,150,60,.25)">${ic('dices', 17)}랜덤</button>
      <button class="g menu" style="width:38px;height:38px;padding:0;color:var(--ink)">${ic('x', 18)}</button></div></div>
      <div class="row" style="gap:6px;margin:16px 0 14px;${A ? 'background:rgba(255,255,255,.45);border-radius:999px;padding:4px;border:1px solid var(--line)' : ''}">
      ${parts.map((p, k) => A ? `<span class="pill" style="flex:1;text-align:center;padding:9px 0;font-weight:700;font-size:13px;${k === 1 ? 'background:var(--lav);box-shadow:inset 0 1px 0 #fff,0 3px 8px rgba(120,90,160,.18)' : ''}">${p}</span>` : `<span class="g pill row" style="gap:5px;padding:8px 12px;font-weight:700;font-size:13px;${k === 1 ? 'background:var(--lav)' : ''}">${ic(p[1], 15)}${p[0]}</span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px 4px">${chips}</div>
      <div class="row" style="justify-content:space-between;margin-top:18px;gap:8px"><div class="row" style="gap:6px">${saved}</div></div>
      <button class="pill row" style="margin-top:16px;width:100%;justify-content:center;gap:6px;border:1px solid #fff;background:linear-gradient(160deg,#FFD0BD,var(--peach));padding:14px;font:800 15px Pretendard;color:var(--ink);box-shadow:0 10px 24px rgba(255,140,110,.35),inset 0 2px 0 rgba(255,255,255,.7)">${ic('heart', 18)}이 조합 하트로 저장</button>
    </div>`;
  }
  return `<!doctype html><meta charset=utf-8><style>${css}</style>${top}${stats}${sheet ? '' : bottom}${sheetHtml}`;
}
for (const v of ['A', 'B']) for (const s of [0, 1]) fs.writeFileSync(`mock-${v}${s}.html`, page(v, s));
