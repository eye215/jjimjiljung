import { cleanNickname } from './chat-rules.js?v=rpg-8';

// 카카오톡 친구 초대. The JavaScript key is a public, domain-restricted key
// (allowed sites are set in Kakao Developers), so it is safe in the browser.
export const KAKAO_JS_KEY = '550592a303d4d3172150fed087a4c2b4';
export const SITE_URL = 'https://jjimjiljung.yullul.com/';
const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';

let sdk = null;
// The SDK only loads when someone taps 초대, so entering the room stays fast.
function loadKakao() {
  if (window.Kakao?.Share) return Promise.resolve(window.Kakao);
  sdk ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = KAKAO_SDK; script.crossOrigin = 'anonymous'; script.async = true;
    const timer = setTimeout(() => reject(new Error('Kakao SDK timeout')), 8000);
    script.onload = () => { clearTimeout(timer); window.Kakao?.Share ? resolve(window.Kakao) : reject(new Error('Kakao SDK missing')); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('Kakao SDK unavailable')); };
    document.head.appendChild(script);
  }).catch(error => { sdk = null; throw error; });
  return sdk;
}

export function inviteUrl(nickname) {
  const url = new URL(SITE_URL);
  const name = cleanNickname(nickname || '');
  if (name) url.searchParams.set('from', name);
  return url.href;
}

export function createInvite({ button, getNickname, toast }) {
  async function share() {
    const name = cleanNickname(getNickname() || '');
    const url = inviteUrl(name);
    try {
      const Kakao = await loadKakao();
      if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: '♨ 찜질중 — 같이 찜질하러 갈래?',
          description: `${name ? name + '님이' : '친구가'} 따끈한 3D 찜질방에 초대했어요. 계란 까먹고 식혜 마시며 수다 떨어요!`,
          imageUrl: SITE_URL + 'assets/share.jpg', imageWidth: 800, imageHeight: 400,
          link: { mobileWebUrl: url, webUrl: url }
        },
        buttons: [{ title: '같이 찜질하기', link: { mobileWebUrl: url, webUrl: url } }]
      });
    } catch {
      // No Kakao (blocked, offline or unregistered domain): use the system share sheet or copy the link.
      try {
        if (navigator.share) { await navigator.share({ title: '찜질중', text: '같이 찜질하러 갈래? ♨', url }); return; }
      } catch (error) { if (error?.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(url); toast('카카오톡을 열 수 없어서 초대 링크를 복사했어요. 친구에게 붙여 넣어 주세요!'); }
      catch { toast(`초대 링크: ${url}`); }
    }
  }
  button.addEventListener('click', share);

  // Arriving from an invite: greet the visitor, then tidy the address bar.
  const params = new URLSearchParams(location.search);
  const from = cleanNickname(params.get('from') || '');
  if (params.has('from')) {
    params.delete('from');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }
  return { share, invitedBy: from };
}
