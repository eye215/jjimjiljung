// Public client configuration. The publishable key is designed to be shipped
// to browsers (like the old "anon" key). Never put a secret/service_role key here.
export const SUPABASE_URL = 'https://xojeavzrmdizganxjygj.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qe5dZItMX3X_znG6ClPn0g_hQoR1U_m';
// One shared lobby for now. Room ids from world.js (or invite codes) can become
// their own channels later, e.g. `jjimjil:room:hot` or `jjimjil:private:<code>`.
export const PUBLIC_CHANNEL = 'jjimjil:main';
