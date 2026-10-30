// Public client configuration. The publishable key is designed to be shipped
// to browsers (like the old "anon" key). Never put a secret/service_role key here.
export const SUPABASE_URL = 'https://xojeavzrmdizganxjygj.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qe5dZItMX3X_znG6ClPn0g_hQoR1U_m';
// One shared lobby for now. Room ids from world.js (or invite codes) can become
// their own channels later, e.g. `jjimjil:room:hot` or `jjimjil:private:<code>`.
export const PUBLIC_CHANNEL = 'jjimjil:main';

// Google H5 Games Ads (Ad Placement API) for the rewarded TV in 중앙 휴게실.
// Paste the AdSense publisher id (e.g. 'ca-pub-1234567890123456') once approved.
// While empty, the TV politely says no ad is available. Keep test mode on until
// Google approves the site for H5 Games Ads.
export const ADSENSE_CLIENT = '';
export const ADS_TEST_MODE = true;
