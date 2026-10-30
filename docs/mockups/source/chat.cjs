const fs = require('fs');
const ic = (n, s = 22, w = 2.5) => fs.readFileSync(`lucide-static-1.55.0/package/icons/${n}.svg`, 'utf8').replace(/<!--.*?-->/s, '').replace(/class="[^"]*"/, '').replace(/width="24"/, `width="${s}"`).replace(/height="24"/, `height="${s}"`).replace(/stroke-width="2"/, `stroke-width="${w}"`).replace(/\s+/g, ' ');
const css = `
@import url(fontsource-jua-5.2.5/package/index.css);
@font-face{font-family:Pretendard;src:url(pretendard-1.3.9/package/dist/web/variable/woff2/PretendardVariable.woff2) format('woff2');font-weight:45 920}
:root{--glass:rgba(255,250,245,.55);--ink:#5B4A42;--ink2:#7A6558;--peach:#FFB59A;--mint:#BFE3D0;--lav:#D8CCF2;--butter:#FFE6A7;--line:rgba(255,255,255,.7);--shadow:0 8px 32px rgba(120,80,60,.12)}
*{box-sizing:border-box}body{margin:0;width:390px;height:844px;overflow:hidden;font-family:Pretendard,sans-serif;color:var(--ink);background:url(bg2.png) center/390px 844px;position:relative;font-size:13px}
.g{background:var(--glass);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);border:1px solid var(--line);box-shadow:var(--shadow),inset 0 1px 0 rgba(255,255,255,.9)}
.pill{border-radius:999px}.row{display:flex;align-items:center}svg{display:block}
.peach{background:linear-gradient(160deg,#FFD0BD,var(--peach));border:1px solid #fff;box-shadow:0 8px 20px rgba(255,140,110,.32),inset 0 2px 0 rgba(255,255,255,.7)}
.btn{white-space:nowrap;border-radius:999px;padding:10px 16px;font:700 14px Pretendard;color:var(--ink);display:flex;align-items:center;gap:6px;justify-content:center}
.soft{background:rgba(255,255,255,.62);border:1px solid var(--line);box-shadow:inset 0 1px 0 #fff}
.top{position:absolute;top:54px;left:14px;right:14px;justify-content:space-between}
.logo{gap:6px;padding:8px 14px 8px 12px;font-family:Jua;font-size:21px;line-height:1}.logo .mark{width:28px;height:28px;border-radius:50%;background:linear-gradient(145deg,#FFD3C2,var(--peach));display:grid;place-items:center;color:#fff;font-size:16px;font-family:Pretendard}
.chip{gap:6px;padding:7px 12px;font-size:13px;font-weight:600}.dot{width:8px;height:8px;border-radius:50%}
.menu{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;padding:0;color:var(--ink)}
.tag{position:absolute;white-space:nowrap;transform:translate(-50%,-100%);font-size:13px;font-weight:700;padding:3px 10px}
.bubble{position:absolute;white-space:nowrap;transform:translate(-50%,-100%);max-width:220px;padding:8px 13px;border-radius:18px;font-size:14px;line-height:1.4;font-weight:600;text-align:center}
.bubble:after{content:"";position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:rgba(255,250,245,.85)}
.kb{position:absolute;left:0;right:0;bottom:0;height:300px;background:#D5D8DE;padding:8px 3px 0}
.kb .r{display:flex;gap:6px;justify-content:center;margin-bottom:11px}.kb i{font-style:normal;width:32px;height:43px;border-radius:5px;background:#fff;display:grid;place-items:center;font-size:20px;color:#222;box-shadow:0 1px 0 #898a8d}
.kb i.d{background:#ABB0BA;font-size:15px}
.composer{position:absolute;left:10px;right:10px;bottom:308px;gap:8px}
.input{flex:1;height:48px;border-radius:999px;padding:0 16px;font-size:16px;display:flex;align-items:center}
.round{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;color:var(--ink)}
.sub{position:absolute;left:18px;right:18px;font-size:15px;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(70,45,30,.65),0 0 10px rgba(70,45,30,.35);line-height:1.5}
.sub b{font-weight:800}
`;
const top = (extra = '') => `<div class="top row"><div class="row" style="gap:6px"><div class="g pill logo row"><span class="mark">♨</span>찜질중</div><div class="g pill chip row"><i class="dot" style="background:#7FC4A2"></i>중앙 휴게실</div></div><button class="g menu">${ic('menu')}</button></div>${extra}`;
const kb = () => `<div class="kb">${[['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],['⇧','ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ','⌫']].map((r, k) => `<div class="r">${r.map(c => `<i class="${c === '⇧' || c === '⌫' ? 'd' : ''}" style="${c === '⇧' || c === '⌫' ? 'width:42px' : ''}">${c}</i>`).join('')}</div>`).join('')}<div class="r"><i class="d" style="width:44px">123</i><i class="d" style="width:44px">🙂</i><i style="width:180px;font-size:15px">스페이스</i><i class="d" style="width:88px">보내기</i></div></div>`;
const group = `<div class="g pill row" style="position:absolute;top:110px;left:14px;gap:8px;padding:6px 6px 6px 12px;font-weight:700"><span class="row" style="gap:5px">${ic('users-round', 16)}그룹 3명</span><span class="row" style="gap:-6px">${['#AEDCC6', '#F5C79F', '#DDB9DC'].map((c, i) => `<i style="width:20px;height:20px;border-radius:50%;background:${c};border:2px solid #fff;margin-left:${i ? -6 : 0}px"></i>`).join('')}</span><span class="soft pill row" style="gap:4px;padding:4px 9px;font-size:13px">${ic('flag', 13)}신고</span><span class="soft pill row" style="gap:4px;padding:4px 9px;font-size:13px">${ic('log-out', 13)}나가기</span></div>`;
const composer = (mode) => `<div class="composer row"><button class="g round" aria-label="표시 방식">${ic(mode === 'bubble' ? 'message-square-quote' : 'captions', 21)}</button><div class="g input">${mode === 'bubble' ? '응 좋아! 식혜 마시자 <span style="display:inline-block;width:2px;height:20px;background:#E58C68;margin-left:2px"></span>' : '<span style="color:#9a877c">그룹에 한마디…</span>'}</div><button class="round peach" aria-label="보내기">${ic('arrow-up', 22, 3)}</button></div>`;
const pages = {
  C1: `${top()}
  <span class="g pill tag" style="left:130px;top:296px">몽글온돌</span>
  <div class="g" style="position:absolute;left:14px;top:112px;width:262px;border-radius:24px;padding:14px">
    <div class="row" style="gap:10px;margin-bottom:12px"><i style="width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,transparent 50%),#AEDCC6;border:2px solid #fff"></i><div><div style="font-family:Jua;font-size:18px">몽글온돌</div><div style="font-size:13px;color:var(--ink2)">중앙 휴게실에서 쉬는 중</div></div></div>
    <div class="row" style="gap:8px"><button class="btn peach" style="flex:1.3">${ic('message-circle', 17)}대화 신청</button><button class="btn soft" style="flex:1">${ic('hand', 17)}인사</button></div>
    <button class="row" style="margin:10px auto 0;gap:5px;background:none;border:0;font:600 13px Pretendard;color:var(--ink2)">${ic('ban', 14)}차단하기</button>
    <span style="position:absolute;left:107px;bottom:-9px;width:18px;height:18px;background:rgba(255,250,245,.8);transform:rotate(45deg);border-right:1px solid var(--line);border-bottom:1px solid var(--line)"></span>
  </div>`,
  C2: `${top()}
  <div class="g" style="position:absolute;left:12px;right:12px;top:108px;border-radius:24px;padding:14px">
    <div class="row" style="gap:12px">
      <svg width="54" height="54" viewBox="0 0 54 54" style="flex-shrink:0"><circle cx="27" cy="27" r="23" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="5"/><circle cx="27" cy="27" r="23" fill="none" stroke="#FFB59A" stroke-width="5" stroke-linecap="round" stroke-dasharray="144.5" stroke-dashoffset="43" transform="rotate(-90 27 27)"/><text x="27" y="32" text-anchor="middle" font-family="Pretendard" font-weight="800" font-size="14" fill="#5B4A42">0:42</text></svg>
      <div style="flex:1"><div style="font-size:15px;font-weight:800">보들식혜님이 대화를 신청했어요</div><div style="font-size:13px;color:var(--ink2);margin-top:2px">1분 안에 답하지 않으면 자동으로 넘어가요</div></div></div>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn soft" style="flex:1">거절</button><button class="btn peach" style="flex:1.4">${ic('check', 17, 3)}수락하고 대화하기</button></div>
  </div>
  <span class="g pill tag" style="left:338px;top:338px">보들식혜</span>
  <div class="g" style="position:absolute;right:18px;bottom:222px;width:60px;height:60px;border-radius:50%;display:grid;place-items:center">${ic('message-circle', 24)}<i style="position:absolute;top:6px;right:8px;width:12px;height:12px;border-radius:50%;background:#FF9A7A;border:2px solid #fff"></i></div>
`,
  C3: `${top(group)}
  <div class="g bubble" style="left:130px;top:212px;opacity:.55;font-size:13px">어디 갈까?</div>
  <div class="g bubble" style="left:130px;top:258px;background:rgba(255,250,245,.85)">불가마 가자 🔥</div>
  <span class="g pill tag" style="left:130px;top:294px">몽글온돌</span>
  <div class="g bubble" style="left:318px;top:300px;background:rgba(255,250,245,.85)">나도 갈래!</div>
  <span class="g pill tag" style="left:338px;top:338px">보들식혜</span>
  <span class="g pill tag" style="left:195px;top:352px;background:rgba(255,213,192,.7)">말랑양머리</span>
  ${composer('bubble')}${kb()}`,
  C4: `${top(group)}
  <span class="g pill tag" style="left:130px;top:294px">몽글온돌</span><span class="g pill tag" style="left:338px;top:338px">보들식혜</span><span class="g pill tag" style="left:195px;top:352px;background:rgba(255,213,192,.7)">말랑양머리</span>
  <div class="sub" style="bottom:372px;opacity:.35"><b>몽글온돌:</b> 어디 갈까?</div>
  <div class="sub" style="bottom:348px;opacity:.6"><b>말랑양머리:</b> 계란 먹고 싶다</div>
  <div class="sub" style="bottom:324px;opacity:.85"><b>몽글온돌:</b> 불가마 가자 🔥</div>
  <div class="sub" style="bottom:300px;opacity:0"></div>
  ${composer('caption').replace('bottom:308px', 'bottom:308px')}
  <div class="sub" style="bottom:362px;display:none"></div>${kb()}`.replace('<div class="composer row">', '<div class="sub" style="bottom:368px;opacity:.95;display:none"></div><div class="composer row">'),
  C5: `${top(group)}
  <div style="position:absolute;left:0;right:0;bottom:84px;height:330px;border-radius:28px 28px 0 0;background:linear-gradient(rgba(255,250,245,.12),rgba(255,250,245,.42));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding:14px 18px;border-top:1px solid rgba(255,255,255,.6)">
    <div style="width:40px;height:5px;border-radius:3px;background:rgba(91,74,66,.25);margin:0 auto 10px"></div>
    ${[['몽글온돌', '안녕하세요! 처음 왔어요', 0], ['말랑양머리', '반가워요 ☺️ 여기 식혜 맛있어요', 1], ['보들식혜', '저도 합류했어요!', 0], ['몽글온돌', '어디 갈까?', 0], ['말랑양머리', '계란 먹고 싶다', 1], ['몽글온돌', '불가마 가자 🔥', 0]].map(([n, t, me]) => `<div style="display:flex;justify-content:${me ? 'flex-end' : 'flex-start'};margin:6px 0"><span style="max-width:75%;padding:7px 12px;border-radius:16px;font-size:14px;font-weight:600;${me ? 'background:rgba(255,213,192,.8)' : 'background:rgba(255,255,255,.7)'};border:1px solid rgba(255,255,255,.8)">${me ? '' : `<b style="font-size:13px;color:var(--ink2);display:block">${n}</b>`}${t}</span></div>`).join('')}
  </div>
  <div class="row" style="position:absolute;left:10px;right:10px;bottom:24px;gap:8px"><button class="g round">${ic('message-square-quote', 21)}</button><div class="g input"><span style="color:#9a877c">그룹에 한마디…</span></div><button class="round peach">${ic('arrow-up', 22, 3)}</button></div>`
};
for (const [k, v] of Object.entries(pages)) fs.writeFileSync(`chat-${k}.html`, `<!doctype html><meta charset=utf-8><style>${css}</style>${v}`);
