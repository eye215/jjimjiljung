import { ADSENSE_CLIENT, ADS_TEST_MODE } from './config.js?v=rpg-9';
import { AD_REWARD } from './economy.js?v=rpg-9';

// Rewarded TV ads through Google H5 Games Ads (Ad Placement API).
// This is the one external script the site loads, and only after the visitor
// first sits in front of the lobby TV. See README for the AdSense steps.
const SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
let loading = null;
function loadPlacementApi() {
  if (!ADSENSE_CLIENT) return Promise.reject(new Error('No AdSense publisher id'));
  loading ||= new Promise((resolve, reject) => {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = options => window.adsbygoogle.push(options);
    const script = document.createElement('script');
    script.async = true; script.crossOrigin = 'anonymous';
    script.src = `${SCRIPT}?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
    script.dataset.adFrequencyHint = '120s';
    if (ADS_TEST_MODE) script.dataset.adbreakTest = 'on';
    script.onload = () => { window.adConfig({ preloadAdBreaks: 'on', sound: 'on' }); resolve(); };
    script.onerror = () => { loading = null; reject(new Error('Ad script unavailable')); };
    document.head.appendChild(script);
  });
  return loading;
}

// States: idle → loading → ready | none | cooldown | done.
export function createTvAds({ wallet, button, onPause, onResume, onReward, onDismiss }) {
  let state = 'idle', showAd = null, attempt = 0;
  const label = button.querySelector('span');
  function render() {
    const status = wallet.adStatus();
    button.dataset.state = state;
    button.disabled = state !== 'ready';
    label.textContent = state === 'ready' ? `📺 광고 보고 온기 받기 (+${AD_REWARD}♨)`
      : state === 'loading' ? '📺 광고를 불러오는 중…'
      : state === 'cooldown' ? `📺 ${Math.ceil(status.waitMs / 60000)}분 뒤에 또 볼 수 있어요`
      : state === 'done' ? '📺 오늘 광고는 다 봤어요. 내일 또 만나요'
      : '📺 지금은 볼 수 있는 광고가 없어요';
  }
  // Asks Google for a rewarded break; `beforeReward` means an ad is ready to show.
  async function prepare() {
    const status = wallet.adStatus();
    if (!status.left) { state = 'done'; render(); return; }
    if (status.waitMs) { state = 'cooldown'; render(); return; }
    if (state === 'ready' || state === 'loading') return;
    state = 'loading'; render();
    const mine = ++attempt;
    const settle = next => { if (mine === attempt) { state = next; render(); } };
    const timer = setTimeout(() => { if (state === 'loading') settle('none'); }, 8000);
    try { await loadPlacementApi(); } catch { clearTimeout(timer); settle('none'); return; }
    let offered = false;
    window.adBreak({
      type: 'reward', name: 'tv-onki',
      beforeAd: () => onPause(),
      afterAd: () => onResume(),
      beforeReward: show => { offered = true; showAd = show; clearTimeout(timer); settle('ready'); },
      adViewed: () => { const granted = wallet.rewardAd(); onReward(granted); },
      adDismissed: () => onDismiss(),
      adBreakDone: () => {
        clearTimeout(timer); showAd = null;
        if (!offered) { settle('none'); return; }
        const after = wallet.adStatus(); settle(!after.left ? 'done' : after.waitMs ? 'cooldown' : 'idle');
      }
    });
  }
  button.addEventListener('click', () => { if (state === 'ready' && showAd) { const show = showAd; showAd = null; state = 'playing'; render(); show(); } });
  render();
  return {
    prepare,
    get state() { return state; },
    // True when the shop should suggest the TV rather than resting.
    get worthVisiting() { const s = wallet.adStatus(); return !!ADSENSE_CLIENT && s.left > 0 && state !== 'none'; },
    retry() { if (state === 'none') { state = 'idle'; prepare(); } },
    leave() { if (state !== 'playing') { attempt++; showAd = null; state = 'idle'; } }
  };
}
