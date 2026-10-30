const fs = require('fs');
const ic = (n, s = 22, w = 2.5) => fs.readFileSync(`lucide-static-1.55.0/package/icons/${n}.svg`, 'utf8').replace(/<!--.*?-->/s, '').replace(/class="[^"]*"/, '').replace(/width="24"/, `width="${s}"`).replace(/height="24"/, `height="${s}"`).replace(/stroke-width="2"/, `stroke-width="${w}"`).replace(/\s+/g, ' ');
const PAL = [['피치','#F6B49B'],['살구','#F5C79F'],['버터','#F3DD9E'],['민트','#AEDCC6'],['세이지','#BACBA6'],['하늘','#ABCDEA'],['라벤더','#C6BBE8'],['라일락','#DDB9DC'],['핑크','#F3B7C6'],['크림','#F4EBDC'],['코코아','#B08D78'],['차콜','#77707A']];
const css = (bg) => `
@import url(fontsource-dongle-5.2.5/package/700.css);
@font-face{font-family:Pretendard;src:url(pretendard-1.3.9/package/dist/web/variable/woff2/PretendardVariable.woff2) format('woff2');font-weight:45 920}
:root{--glass:rgba(255,250,245,.55);--ink:#5B4A42;--ink2:#7A6558;--peach:#FFB59A;--mint:#BFE3D0;--lav:#D8CCF2;--butter:#FFE6A7;--line:rgba(255,255,255,.7);--shadow:0 8px 32px rgba(120,80,60,.12)}
*{box-sizing:border-box}body{margin:0;width:390px;height:844px;overflow:hidden;font-family:Pretendard,sans-serif;color:var(--ink);background:url(${bg}) center/390px 844px;position:relative;font-size:13px}
.g{background:var(--glass);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);border:1px solid var(--line);box-shadow:var(--shadow),inset 0 1px 0 rgba(255,255,255,.9)}
.pill{border-radius:999px}.row{display:flex;align-items:center}svg{display:block}
.peach{background:linear-gradient(160deg,#FFD0BD,var(--peach));border:1px solid #fff;box-shadow:0 8px 20px rgba(255,140,110,.32),inset 0 2px 0 rgba(255,255,255,.7)}
.btn{white-space:nowrap;border-radius:999px;padding:11px 16px;font:700 14px Pretendard;color:var(--ink);display:flex;align-items:center;gap:6px;justify-content:center}
.soft{background:rgba(255,255,255,.62);border:1px solid var(--line);box-shadow:inset 0 1px 0 #fff}
.top{position:absolute;top:54px;left:14px;right:14px;justify-content:space-between}
.logo{gap:6px;padding:5px 14px 3px 10px;font-family:Dongle;font-weight:700;font-size:31px;line-height:1}.logo .mark{width:28px;height:28px;border-radius:50%;background:linear-gradient(145deg,#FFD3C2,var(--peach));display:grid;place-items:center;color:#fff;font-size:16px;font-family:Pretendard;margin-bottom:2px}
.chip{gap:6px;padding:7px 12px;font-size:13px;font-weight:600}.dot{width:8px;height:8px;border-radius:50%}
.menu{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;padding:0;color:var(--ink)}
.stats{position:absolute;top:110px;left:14px;gap:10px;padding:7px 13px;font-size:13px;font-weight:700}.stats span{display:flex;align-items:center;gap:4px}
.tag{position:absolute;white-space:nowrap;transform:translate(-50%,-100%);font-size:13px;font-weight:700;padding:3px 10px}
.fab{position:absolute;right:18px;width:60px;height:60px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center}
.fab small{font-size:13px;font-weight:700;margin-top:-1px}
.tiles{position:absolute;left:8px;right:8px;bottom:22px;display:flex;justify-content:space-between}
.tile{width:60px;display:flex;flex-direction:column;align-items:center;gap:5px;position:relative}
.tile .j{width:56px;height:56px;border-radius:50%;display:grid;place-items:center}
.tile .l{font-size:13px;font-weight:800;color:#4E3E37;text-shadow:0 1px 0 #FFF8F0,1px 0 0 #FFF8F0,-1px 0 0 #FFF8F0,0 -1px 0 #FFF8F0,0 0 4px rgba(255,248,240,.9)}
.tile.sel .j{background:linear-gradient(160deg,#FFD0BD,var(--peach));transform:scale(1.08);border:1px solid #fff;box-shadow:0 10px 22px rgba(255,140,110,.35),inset 0 2px 0 rgba(255,255,255,.75)}
.tile .cnt{position:absolute;top:-3px;right:2px;min-width:18px;height:18px;border-radius:9px;background:#fff;border:1px solid var(--line);font-size:11px;font-weight:800;display:grid;place-items:center;box-shadow:0 2px 6px rgba(120,80,60,.15)}
.joy{position:absolute;left:18px;bottom:150px;width:96px;height:96px;border-radius:50%;display:grid;place-items:center}.joy i{width:42px;height:42px;border-radius:50%;background:linear-gradient(160deg,#fff,#FFE9DF);box-shadow:0 4px 12px rgba(120,80,60,.2),inset 0 1px 0 #fff}
.toast{position:absolute;left:50%;transform:translateX(-50%);padding:10px 18px;font-size:14px;font-weight:700;white-space:nowrap}
`;
const top = `<div class="top row"><div class="row" style="gap:6px"><div class="g pill logo row"><span class="mark">♨</span>찜질중</div><div class="g pill chip row"><i class="dot" style="background:#7FC4A2"></i>중앙 휴게실</div></div><button class="g menu">${ic('menu')}</button></div>`;
const stats = (group) => `<div class="g pill stats row"><span>${ic('flame', 16)}10</span><span>${ic('egg', 16)}1</span><span>${ic('cup-soda', 16)}0</span><span style="border-left:1.5px solid rgba(91,74,66,.18);padding-left:9px;gap:5px">${group ? ic('users-round', 15) + '그룹 3명' : '<i class="dot" style="background:#9FD3B7"></i>3명'}</span></div>`;
const tiles = (sel = 'footprints') => `<div class="tiles">${[['footprints','산책'],['armchair','앉기'],['moon','눕기'],['egg','계란','1'],['cup-soda','식혜','0'],['hand','인사']].map(([i, l, c]) => `<div class="tile ${i === sel ? 'sel' : ''}"><div class="g j" ${i === sel ? 'style="border:1px solid #fff"' : ''}>${ic(i, 23)}</div>${c ? `<span class="cnt">${c}</span>` : ''}<span class="l">${l}</span></div>`).join('')}</div>`;
const fabs = `<div class="g fab" style="bottom:236px">${ic('message-circle', 24)}</div><div class="g fab" style="bottom:166px">${ic('shirt', 22)}<small>옷장</small></div>`;
const names = `<span class="g pill tag" style="left:130px;top:296px">몽글온돌</span><span class="g pill tag" style="left:338px;top:338px">보들식혜</span><span class="g pill tag" style="left:195px;top:356px;background:rgba(255,213,192,.7)">말랑양머리</span>`;
const pages = {
  G1: ['bg2.png', `${top}${stats()}${names}<div class="g pill toast" style="bottom:262px;font-weight:600">${ic('footprints', 16)}</div>`.replace(`<div class="g pill toast" style="bottom:262px;font-weight:600">${ic('footprints', 16)}</div>`, `<div class="g pill toast row" style="bottom:270px;gap:6px;font-weight:600">${ic('hand', 16)}바닥을 눌러 이동해요</div>`) + `<div class="g joy"><i></i></div>${fabs}${tiles()}`],
  G2: ['bgW.png', `<div class="row" style="position:absolute;top:54px;left:14px;right:14px;justify-content:space-between"><div class="g pill chip row" style="font-weight:700">${ic('shirt', 16)}옷장</div><button class="g menu">${ic('x', 20)}</button></div>
    <div class="g" style="position:absolute;left:0;right:0;bottom:0;height:430px;border-radius:28px 28px 0 0;padding:10px 18px 26px;background:rgba(255,250,245,.74)">
      <div style="width:40px;height:5px;border-radius:3px;background:rgba(91,74,66,.18);margin:0 auto 10px"></div>
      <div class="row" style="justify-content:space-between"><div style="font-family:Dongle;font-weight:700;font-size:38px;line-height:.8">오늘의 찜질복</div>
      <button class="pill row" style="gap:6px;border:1px solid var(--line);background:var(--butter);padding:9px 14px;font:800 14px Pretendard;color:var(--ink);box-shadow:inset 0 1px 0 #fff,0 4px 12px rgba(200,150,60,.25)"><span style="font-size:17px">🎲</span>랜덤</button></div>
      <div class="row" style="gap:6px;margin:14px 0 14px">${[['양머리','sparkles'],['상의','shirt'],['하의','footprints'],['어깨 수건','hand-heart']].map(([p, i], k) => `<span class="g pill row" style="gap:5px;padding:8px 12px;font-weight:700;font-size:13px;${k === 1 ? 'background:var(--lav)' : ''}">${ic(i, 15)}${p}</span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px 4px">${PAL.map(([n, c], k) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-size:13px;font-weight:600"><span style="width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.7),transparent 45%),${c};box-shadow:0 0 0 ${k === 1 ? '3px #fff,0 0 0 6px var(--peach)' : '2px #fff'},0 4px 10px rgba(120,80,60,.15);display:grid;place-items:center">${k === 1 ? ic('check', 18, 3) : ''}</span>${n}</div>`).join('')}</div>
      <div class="row" style="gap:6px;margin-top:14px">${[['#F5C79F','#FFF2E2','#F6B49B','#AEDCC6'],['#C6BBE8','#F4EBDC','#DDB9DC','#F3DD9E'],null].map(s => s ? `<span class="row" style="gap:2px;padding:6px 8px;border-radius:999px;background:rgba(255,255,255,.65);border:1px solid var(--line)">${s.map(c => `<i style="width:12px;height:12px;border-radius:50%;background:${c};box-shadow:0 0 0 1px #fff"></i>`).join('')}</span>` : `<span class="row" style="gap:4px;padding:6px 10px;border-radius:999px;border:1.5px dashed rgba(91,74,66,.25);font-size:13px;color:var(--ink2)">${ic('heart', 14)}빈 칸</span>`).join('')}</div>
      <button class="btn peach" style="margin-top:14px;width:100%">${ic('heart', 18)}이 조합 하트로 저장</button></div>`],
  G3: ['bg2.png', `${top}${stats(true)}
    <div class="g pill row" style="position:absolute;top:156px;left:50%;transform:translateX(-50%);gap:8px;padding:6px 6px 6px 16px;font-weight:700;font-size:14px;white-space:nowrap">👋 인사할 사람을 골라요<span class="soft pill" style="padding:6px 12px;font-size:13px">취소</span></div>
    ${[[130, 248], [338, 290]].map(([x, y]) => `<div style="position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-100%)"><div style="position:absolute;inset:-9px;border-radius:50%;border:2.5px solid rgba(255,181,154,.75);box-shadow:0 0 0 7px rgba(255,181,154,.22)"></div><div class="g" style="width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:27px;background:rgba(255,250,245,.82)">👋</div></div>`).join('')}
    ${names}
    <button class="btn row" style="position:absolute;left:50%;transform:translateX(-50%);bottom:122px;background:var(--lav);border:1px solid #fff;box-shadow:0 8px 20px rgba(130,100,190,.25),inset 0 1px 0 #fff">${ic('users-round', 17)}우리 그룹에게 인사</button>
    ${tiles('hand')}`],
  G4: ['bg2.png', `${top}${stats()}${names}
    <div class="g" style="position:absolute;left:12px;right:12px;top:108px;border-radius:24px;padding:14px 14px 0;overflow:hidden">
      <div class="row" style="gap:12px"><span style="font-size:30px">👋</span><div style="flex:1"><div style="font-size:15px;font-weight:800">몽글온돌님이 인사했어요</div><div style="font-size:13px;color:var(--ink2);margin-top:2px">받아주면 하이파이브!</div></div><button class="btn peach">👋 받아주기</button></div>
      <div style="height:4px;margin:12px -14px 0;background:rgba(255,255,255,.6)"><i style="display:block;height:100%;width:62%;background:var(--peach);border-radius:0 2px 2px 0"></i></div></div>
    <svg style="position:absolute;left:0;top:0" width="390" height="844"><path d="M150 330 Q 175 300 188 370" fill="none" stroke="rgba(255,181,154,.85)" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/></svg>
    <span style="position:absolute;left:172px;top:318px;font-size:26px;filter:drop-shadow(0 3px 6px rgba(120,80,60,.3))">👋</span>
    <div class="g joy"><i></i></div>${fabs}${tiles()}`],
  G5: ['bgH.png', `<div class="g pill toast row" style="top:60px;gap:6px;background:rgba(255,236,190,.8)">🤚 하이파이브! <b style="color:#B4632D">온기 +1 ♨</b></div>
    <div style="position:absolute;left:195px;top:385px;transform:translate(-50%,-50%);width:220px;height:220px">
      ${[['💛', 0, -88, 30], ['💗', -78, -40, 26], ['💖', 74, -46, 28], ['✨', -96, 22, 26], ['✨', 92, 12, 24], ['💕', 0, 70, 22], ['⭐', -40, -96, 18], ['⭐', 52, -92, 16]].map(([e, x, y, s]) => `<span style="position:absolute;left:${110 + x}px;top:${110 + y}px;font-size:${s}px;transform:translate(-50%,-50%);filter:drop-shadow(0 2px 4px rgba(120,80,60,.25))">${e}</span>`).join('')}
      <span style="position:absolute;left:50%;top:50%;width:70px;height:70px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,240,200,.95),rgba(255,210,170,.4) 55%,transparent 70%)"></span></div>
    <span class="g pill tag" style="left:96px;top:200px;background:rgba(255,213,192,.7)">말랑양머리</span><span class="g pill tag" style="left:300px;top:200px">몽글온돌</span>
    <div class="g" style="position:absolute;left:12px;right:12px;bottom:30px;border-radius:24px;padding:16px">
      <div style="font-size:15px;font-weight:800;text-align:center">몽글온돌님과 인사를 나눴어요 ☺️</div>
      <div style="font-size:13px;color:var(--ink2);text-align:center;margin:3px 0 12px">오늘 처음 나눈 인사라 온기를 받았어요</div>
      <div class="row" style="gap:8px"><button class="btn soft" style="flex:1">나중에</button><button class="btn peach" style="flex:1.6">${ic('message-circle', 17)}대화 신청</button></div></div>`]
};
for (const [k, [bg, body]] of Object.entries(pages)) fs.writeFileSync(`greet-${k}.html`, `<!doctype html><meta charset=utf-8><style>${css(bg)}</style>${body}`);
