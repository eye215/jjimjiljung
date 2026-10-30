# 찜질중 ♨

A tiny, warm 3D jjimjilbang for a quiet break. Open [the live room](https://eye215.github.io/jjimjiljung/).

## Experience

- A plush two-head-tall chibi with tiny dot eyes, a deep terrycloth cap, soft folded towel rolls, short mitten hands and legs, and a sauna emblem. Three coordinated towel/outfit palettes; no crossbody bag.
- **An explorable 3D jjimjilbang (Phase 1).** Six connected rooms built in real 3D: 중앙 휴게실 (wood floor, mats, TV, low tables, trees), 불가마 (brick dome, glowing hearth, steam, orange light), 소금방 (pink salt bricks, a warm salt bed, salt lamps), 얼음방 (ice blocks and a snowman in a sheep-towel cap), 매점 (counter with eggs, sikhye and ramen, a drinks fridge) and 수면실 (night-sky wall, sleeping mats). Residents rest in several rooms; the shopkeeper waves back.
- **RPG quarter-view camera.** The camera follows the player smoothly at an angle. Walls on the camera side of the current room drop to a low ledge (dollhouse cutaway), and anything else that would hide the player turns translucent. Each room has its own light; the ambient light eases into the room's mood as you walk through a door, and the badge/toast shows where you are.
- **Movement and collision.** Walls, door openings and solid furniture are shared map data (`world.js`); `navigation.js` keeps the plush body clear of them, plans tap-to-walk routes from room to room through the doorways, and lets joystick/keyboard movement slide along edges.
- **Controls.** Mobile: thumb joystick (camera-relative), tap the floor to walk, drag to orbit the camera, pinch to zoom. PC: WASD / arrow keys (hold to walk), click to walk, drag to orbit, wheel to zoom, Q/E to turn, Home or 내 위치 to reset the view. 둘러보기 walks you into any room.
- Sit, lie down with a pillow, eat a roasted egg, drink sikhye, or wave hello. Arriving in a room picks a fitting pose (sit by the hearth, lie on the salt or a sleeping mat). Faces blink and close their eyes to rest.
- **수면실 dream mode (Phase 3).** Lie down on a 수면실 mat and the camera glides into a first-person view under a ceiling of glow-in-the-dark stars while a soft lullaby starts. The lullaby is generated in the browser, so no audio file is downloaded and there is no licence to manage. After 30 quiet seconds the room fades into a slowly turning galaxy. 일어나기, 산책, a tap on the floor or the joystick wakes you up. A music on/off button is remembered. Reduced-motion users get a still galaxy.
- **중앙 휴게실 TV: rewarded ads.**
  - **On screen:** the lobby TV runs its own little channel (a steaming roasted egg, bobbing sikhye, a fortune teaser). Sitting on the mat in front of it turns the camera to the screen and shows **📺 광고 보고 온기 받기 (+3♨)**.
  - **The ad:** it is a Google H5 Games rewarded ad (`adBreak({type: 'reward'})`). Watching to the end (`adViewed`) gives +3♨ with a cheer and sparkles. Closing early (`adDismissed`) gives nothing ("다음에 또 봐요"). With no ad available, the TV quietly says "지금은 볼 수 있는 광고가 없어요".
  - **Limits:** 3 ads a Korea day, at least 2 minutes apart, separate from the 60/day earning cap. Rendering and sound pause during the ad.
  - **From the 매점:** when you are short of 온기, the 매점 offers **📺 TV 보러 가기** (walks you to the mat and sits you down). Once ads are used up or unavailable, it suggests resting in 불가마/소금방 instead.
- **카카오톡 친구 초대.** The yellow 💛 친구 초대 button next to the visitor count shares a 카카오톡 feed card (a preview image of the lobby, "같이 찜질하기") with a link to https://jjimjiljung.yullul.com/?from=<nickname>. Invited friends are greeted by name. The official Kakao JavaScript SDK (2.7.2) loads from Kakao's CDN only when the button is tapped. If it cannot load, the system share sheet or a copied link is used instead. The JavaScript key is public and domain-restricted. The site domain must be registered under the app's Web platform in Kakao Developers.
- **매점 & 간식 (Phase 4).**
  - **Eating:** eggs and sikhye are eaten in your current pose, so you can sit and snack. Both hands hold a roasted 맥반석 egg (speckled shell → crack → peeled, three bites showing the yolk) or a paper cup of 살얼음 식혜 (rice grains, straw, the level drops with each sip). The face munches with puffed cheeks, shell bits fly, and sparkles mark the finish. Others see you eat.
  - **Getting snacks:** they come from your 간식 가방. An empty bag offers a walk to the 매점, which opens on arrival. There, claim **one free egg and one free sikhye per day** (Korea time) or buy more for 5 온기 ♨.
  - **Earning 온기:** sitting or lying earns 온기 every 30 s (double in 불가마/소금방). Newcomers start with 10, and earning is capped at 60 a day.
  - **Mini-games:** "이마로 계란 깨기" (tap in the golden zone; the character cracks the egg on their forehead) and "식혜 원샷" (hold to drink, rest before brain freeze). Each uses one snack and rewards up to 3 ♨.
  - **Saving:** the bag and points are saved on this device for now (moving to the server in Phase 5).
- Full-screen mobile layout, safe-area spacing, reduced-motion support, optional user-activated synthesized ambience, and the last outfit saved locally when storage is available.
- Clear loading, missing-module, unsupported-WebGL and context-loss states, with a retry button. Rendering and sound pause while the page is hidden.

- **Multiplayer and public chat (Phase 2).** Pick a nickname (a cosy jjimjilbang name such as 따끈한양머리 is suggested; 🎲 offers another and it stays editable), or look around alone, then see other visitors walk, sit, lie down and change outfits in real time, with name tags over their heads and a live visitor count. The 💬 chat opens a frosted-glass, portrait-first bottom sheet on phones (a side panel on PC and in landscape) that stays above the on-screen keyboard. Messages also pop up as speech bubbles. Visitors get join/leave notices and an unread badge. Messages are capped at 120 characters, rate-limited (at least 1.2 s apart, at most 5 per 10 s, and receivers drop floods), and a first-line word filter masks rude words with ♨. Typing never moves the character.

Not yet implemented: private rooms, AI moderation, voice chat/STT and NPC conversation (see the roadmap below).

## Code map

| File | Role |
| --- | --- |
| `world.js` | Map data: rooms, doors, furniture footprints, destinations, `roomAt()`. Pure data, shared by rendering and navigation (and later by networking/zone chat). |
| `navigation.js` | Walkable area (rooms + doorways − furniture, inflated by the actor radius), exact segment checks, A* routes, sliding movement. No Three.js. |
| `environment.js` | Builds the 3D rooms from `world.js`: canvas-drawn textures, walls with cutaway/fade metadata, furniture, signs, lights, steam. Static props are merged per material. |
| `character.js` | The plush character factory and pose animation. Each character owns its outfit materials, so several visitors can wear different palettes (needed for remote players). |
| `sleep.js` | 수면실 dream mode: first-person blend, starry ceiling, galaxy dome and spiral, generated lullaby (Web Audio). |
| `social.js` | Remote visitors (shared character model, interpolation), name tags, speech bubbles, chat panel, nickname entry, connection status. |
| `net.js` | Realtime transports: Supabase Realtime (Presence and Broadcast) in production; a BroadcastChannel transport between tabs for tests (`?net=local`). |
| `chat-rules.js` | Pure chat rules: text cleaning, 120-character cap, profanity masking, nickname rules, rate limits, incoming validation. |
| `config.js` | Public Supabase URL, publishable key and channel name. |
| `economy.js` | Wallet rules: snack bag, 온기 points, daily free snack (Korea day), earning cap, mini-game scoring. Pure and unit-tested. |
| `shop.js` | 매점 sheet, wallet chip, empty-bag prompt, both mini-games. |
| `invite.js` | 카카오톡 share (lazy SDK load, feed message, fallbacks) and the invite greeting. |
| `ads.js` | Google Ad Placement API wrapper for the rewarded TV (lazy script, reward flow, pause/resume, states). |
| `privacy.html` | 개인정보처리방침 (saved data, Supabase, Kakao, Google ad cookies, opt-out links, clear-device button). |
| `scene.js` | Renderer, follow camera, input, actions, residents, room detection, wall cutaway/fading, error handling. |

### Performance notes (mobile)

- Static scenery is merged per material and does not cast real-time shadows; soft baked blobs sit under furniture. Only characters cast shadows, from one shadow map that follows the player.
- Each character merges its non-animated parts per material (about 16 draw calls instead of about 60).
- Pixel ratio is capped (1.5 on touch devices), all shaders are compiled before entering, and rendering pauses while the tab is hidden.

## Supabase setup (Phase 2)

- Project: `xojeavzrmdizganxjygj`, dedicated to 찜질중 on the Free plan. The StageFlow project is separate and untouched.
- The browser only uses the project URL and the **publishable** key in `config.js`. Publishable keys are meant to be public. Never commit a secret/service_role key or the database password.
- No tables are needed: visitors use Realtime **Presence** (who is here) and **Broadcast** (`state` about 5 times a second while moving with an idle heartbeat, and `chat`) on the channel `jjimjil:main`.
- If visitors never connect, check **Realtime → Settings** in the dashboard and make sure public channel access is allowed (the app does not sign users in yet).
- Free-plan limits: 200 concurrent connections and a monthly message quota. Movement updates are throttled to stay well inside it for small groups.
- `supabase-js` **2.117.3** is vendored as `vendor/supabase.umd.js` (MIT, see `vendor/SUPABASE-LICENSE.txt`) and only loads after the room is ready, so a slow network never blocks entering.

## Google AdSense setup (TV ads)

External scripts are avoided everywhere **except** two on-demand ones:
- **Google's ad script** (`pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`) loads only the first time a visitor sits at the lobby TV, and only when `ADSENSE_CLIENT` is set in `config.js`. It cannot be vendored, because Google serves it.
- The **Kakao SDK** loads only when 친구 초대 is tapped.

The site stays fully usable without either.

Owner steps:
1. **AdSense account and site:** sign up at https://adsense.google.com, add `jjimjiljung.yullul.com` under *Sites*, and verify ownership (AdSense offers an ads.txt or meta-tag method).
2. **Apply for H5 Games Ads:** rewarded ads in web games are only allowed through H5 Games Ads (Ad Placement API). Request access through Google's H5 Games Ads page (https://developers.google.com/ad-placement), naming this site as a game. Approval can take days or weeks.
3. **Publisher id:** copy your `ca-pub-…` id into `ADSENSE_CLIENT` in `config.js`. Keep `ADS_TEST_MODE = true` (it adds `data-adbreak-test="on"`, so Google shows test ads) until approval, then set it to `false`.
4. **ads.txt:** add a file named `ads.txt` at the repository root (served at https://jjimjiljung.yullul.com/ads.txt) with one line: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` (your number without `ca-`).
5. **EU/UK/Swiss consent:** in AdSense, open *Privacy & messaging → European regulations*, create and publish a GDPR consent message (Google-certified CMP) for this site. Optionally also set up the *US state regulations* message.
6. **Privacy policy:** `privacy.html` already explains ad cookies and opt-outs. AdSense asks for its URL: https://jjimjiljung.yullul.com/privacy.html

## Run / deploy

This is a buildless static site. Serve the repository root over HTTP (for example `python -m http.server 8000`), then open `http://localhost:8000`. Opening `index.html` as a local file will not load ES modules.

GitHub Pages serves `main` / repository root. No secret, build service, external model, font or CDN is required; the only external service is Supabase Realtime for multiplayer. Three.js **0.170.0** is vendored in `vendor/`, with its MIT license. All textures and geometry are generated locally at startup. Module URLs carry a `?v=` version so returning visitors get matching files after a deploy; bump it in `index.html` and the imports when modules change.

`assets/sauna-room-v1.png` is the earlier 2.5D environment plate. It is no longer loaded and is kept only as the art-direction reference for colours and props.

## Checks

Use Node.js and install the pinned development dependency with `npm install`, then `npx playwright install chromium`, `npm run check` and `npm test`. Alternatively set `BROWSER_PATH` to an installed Chromium/Chrome executable. `TEST_URL` can target the deployed site instead of the local test server. Test screenshots go to ignored `test-results/`.

- `tests/navigation.cjs`: every room-to-room route through doorways, routes never leave the floor or cut furniture (sampled every centimetre), blocked/off-map taps, walls block, doorways open, sliding, wall glide, anti-tunnelling.
- `tests/chat.cjs`: text cleaning, length cap, profanity masking including spacing tricks (and no false positives on everyday words), nickname rules, rate limits, incoming validation.
- `tests/multiplayer.cjs`: two tabs over the local transport: nickname validation, seeing each other, count and name tags, movement/pose/outfit sync, chat both ways with bubbles and unread badge, throttling, masking, typing does not walk, leaving.
- `tests/economy.cjs`: welcome points, free snack once per Korea day, buying, persistence, tamper sanitising, daily cap, mini-game scores, TV ad limits.
- `tests/shop.cjs`: empty-bag prompt walks to the 매점, daily free claims, buying, eating while sitting, finishing, putting snacks away, both mini-games.
- `tests/invite.cjs`: Kakao init with the JS key, feed content and links on the registered domain, copy-link fallback, invite greeting, rude names ignored.
- `tests/tv.cjs`: stand-in for Google's ad script. Ad button when seated (script loads only then), shop shortage → walk to the TV, reward after a full view with rendering paused, nothing when closed early, 2-minute gap, 3 a day, rest tip afterwards, midnight reset, no-ad and no-publisher-id fallbacks.
- `tests/sleep.cjs`: dream mode only in 수면실, first-person camera, lullaby on/mute, 30-second galaxy, wake-up.
- `tests/smoke.cjs`: desktop, 390px and 320px mobile, 820px tablet and landscape layouts; joystick/tray overlap; all poses and waving; drag orbit, wheel zoom and recenter; the six-room travel dialog and focus handling; camera-relative joystick movement, release and cancel; wall collision; walking through the 불가마 door with the room badge updating; wall cutaway/fading; tap-to-walk; held-key walking; outfit persistence; audio; reduced motion; local-only assets; WebGL context loss/retry; failed module; unavailable WebGL; loading guard.

Chromium uses software WebGL in CI-like environments, so these tests are slow but functional. They do not replace testing on physical iOS Safari or low-memory Android devices.

## Roadmap

Each phase ships only after design QA, tests and a verified Pages deploy.

### Phase 2 — multiplayer and public text chat ✅ done
- Supabase Realtime (free plan): **Presence** for nickname, outfit, current room, visitor count, join/leave; **Broadcast** for positions (~8 Hz while moving, interpolated) and chat.
- Portrait-first mobile chat: a bottom-sheet chat panel that sits above the on-screen keyboard (`visualViewport`), speech bubbles over heads, nickname labels, recent history, open/close. Landscape and PC stay supported.
- Basic safety from day one: message length and send-rate limits, plus a local Korean/English profanity filter.
- Only the project URL and the public anon key are used in the browser.

### Phase 3 — 수면실 immersion ✅ done
- Lying down in 수면실 moves the camera smoothly into a first-person view looking up at a starry ceiling (the room gains a ceiling only in this view).
- Calm sleep music starts automatically. Lying down is a tap, so browsers allow the sound to play. Music is generated in the browser or uses a properly licensed track, with a volume control and mute.
- After 30 seconds of lying still, the view fades into a slowly turning galaxy (stars, nebula, and a gentle shader). Waking up (the button, walking, or tapping the floor) fades back to the room. Reduced-motion users get a static starfield.

### Phase 4 — 매점 & 간식 ✅ done
- **Eat while sitting:** egg and sikhye become something you do in a pose, so you can sit (or stand) and snack. Other visitors see it too.
- **Buy at the 매점:** walk up to the counter and a 매점 button appears. Pick 구운 계란 or 식혜 and they go into a small snack bag in the action tray (계란 ×2). With an empty bag, the snack buttons point you to the shop.
- **One free each per day:** one free egg and one free sikhye every day, resetting at midnight Korea time. Anything more costs 온기 points (♨), earned by resting in 불가마/소금방, chatting and the mini-games.
- **Proper snack art and animation:**
  - Roasted egg (speckled brown shell): crack and peel it, then take bites.
  - Sikhye in a cup with floating rice grains and a straw: hold it in both hands.
  - Bringing food to the mouth, puffed chewing cheeks, a happy face, crumbs and sparkles, then an empty cup or shell.
- **Mini-games:**
  - "이마로 계란 깨기": tap when the gauge hits the sweet spot for a clean crack.
  - "식혜 원샷": hold to drink and keep the meter in the safe zone to avoid brain freeze.
  - Both reward 온기 points. Optional quick reactions for others watching.
- Saved on the device at first. The daily free item and points move to the server in Phase 5 (with Supabase tables) so they cannot be faked.

### Phase 5 — invisible accounts, cloud save, private chat and AI moderation (Supabase)
- **Signing up without noticing:** the first visit silently creates an anonymous Supabase account (Anonymous Sign-ins), so nickname, outfit, snacks, points and progress are saved on the server with no email, phone or password.
- **Same character on any device:** to open your save elsewhere, the settings show a short **이어하기 코드** or QR (an expiring one-time code). Optionally the anonymous account can later be linked to Kakao or Google with one tap (requires app keys from those services).
- **Minimal personal data:** only a random user id, the nickname and game data. Birth date and time for 사주 stay on the device unless you choose to sync them. A 'delete my data' button is included. Abuse protection with CAPTCHA (Cloudflare Turnstile, free) when needed.
- Owner setup: enable **Anonymous sign-ins** in Supabase Authentication; tables and RLS policies are provided as SQL in the repo.
- Private chat: create a room, get a short invite code, and share it; anyone who enters the code joins. Codes are generated on the server with an expiry, and membership is enforced with Row Level Security and Realtime authorization, so a code cannot be guessed or bypassed from the browser.
- AI moderation: chat messages go through an Edge Function that calls an NVIDIA safety model (e.g. NemoGuard content safety, via build.nvidia.com/NIM). Inappropriate messages are blocked or masked before anyone sees them. The NVIDIA API key lives only in Supabase secrets.
- Report, mute and block buttons.
- Anonymous sign-in plus a small profile table, so 매점 points, daily free snacks and nicknames are checked on the server.
- To check before starting: the current free-tier terms and rate limits of the NVIDIA API, and how well the safety model handles Korean (the local filter stays as a fallback).

### Phase 6 — 새 공간: 입구·탈의실·목욕탕·세신실·마사지방·사주방
- **입구 카운터:** check in, get a locker key and a 찜질복. A short welcome scene, with the key shown in the UI.
- **탈의실:** wooden lockers. Open yours to change into the 찜질복, which is where outfit colours are chosen.
- **목욕탕:** hot and cold tubs with steam, shower stations and small stools. Sitting in a tub shows a soak pose and shoulder-deep water.
- **세신실 / 마사지방:** lie on the bed and a friendly NPC attendant gives a 때밀이 or massage, as a short animation or light rhythm game that rewards 온기 points.
- **사주방:** enter your birth date and (optional) time to get a free **오늘의 운세**.
  - It works out the day pillar and today's 일진 locally and builds a fortune from the five-element (오행) relation: overall, money, love, health, lucky colour and number.
  - It is presented as entertainment. The birth data stays on the device.
  - An NVIDIA AI fortune-teller voice can be added later.
- New rooms extend `world.js`, so collision, travel and the cutaway work as before.

### Phase 7 — voice chat and speech-to-text
- Voice chat over WebRTC with Supabase Realtime for connection setup (signaling): push-to-talk or a toggled mic, speaking indicators over heads, per-person mute, and nearby-only or room-only audio. Peer-to-peer suits small groups; mobile networks may need a TURN relay (free tiers are limited).
- STT: the browser's Web Speech API (Korean, free, works in iOS Safari and Chrome) turns speech into chat text or live captions. Transcripts pass through the same AI moderation. Live voice audio itself cannot be filtered in real time, so mute/report/block and push-to-talk are the safeguards there.

### Later — AI residents
Characters share one factory and every room has an id, so AI residents (shopkeeper, chatty guest, counsellor) can be added as actors whose replies come from an LLM (e.g. NVIDIA NIM) through a server-side function.
