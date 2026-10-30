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
- Full-screen mobile layout, safe-area spacing, reduced-motion support, optional user-activated synthesized ambience, and the last outfit saved locally when storage is available.
- Clear loading, missing-module, unsupported-WebGL and context-loss states, with a retry button. Rendering and sound pause while the page is hidden.

- **Multiplayer and public chat (Phase 2).** Pick a nickname (or look around alone), then see other visitors walk, sit, lie down and change outfits in real time, with name tags over their heads and a live visitor count. The 💬 chat opens a portrait-first bottom sheet on phones (a side panel on PC and in landscape) that stays above the on-screen keyboard. Messages also pop up as speech bubbles. Visitors get join/leave notices and an unread badge. Messages are capped at 120 characters, rate-limited (at least 1.2 s apart, at most 5 per 10 s, and receivers drop floods), and a first-line word filter masks rude words with ♨. Typing never moves the character.

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

## Run / deploy

This is a buildless static site. Serve the repository root over HTTP (for example `python -m http.server 8000`), then open `http://localhost:8000`. Opening `index.html` as a local file will not load ES modules.

GitHub Pages serves `main` / repository root. No secret, build service, external model, font or CDN is required; the only external service is Supabase Realtime for multiplayer. Three.js **0.170.0** is vendored in `vendor/`, with its MIT license. All textures and geometry are generated locally at startup. Module URLs carry a `?v=` version so returning visitors get matching files after a deploy; bump it in `index.html` and the imports when modules change.

`assets/sauna-room-v1.png` is the earlier 2.5D environment plate. It is no longer loaded and is kept only as the art-direction reference for colours and props.

## Checks

Use Node.js and install the pinned development dependency with `npm install`, then `npx playwright install chromium`, `npm run check` and `npm test`. Alternatively set `BROWSER_PATH` to an installed Chromium/Chrome executable. `TEST_URL` can target the deployed site instead of the local test server. Test screenshots go to ignored `test-results/`.

- `tests/navigation.cjs`: every room-to-room route through doorways, routes never leave the floor or cut furniture (sampled every centimetre), blocked/off-map taps, walls block, doorways open, sliding, wall glide, anti-tunnelling.
- `tests/chat.cjs`: text cleaning, length cap, profanity masking including spacing tricks (and no false positives on everyday words), nickname rules, rate limits, incoming validation.
- `tests/multiplayer.cjs`: two tabs over the local transport: nickname validation, seeing each other, count and name tags, movement/pose/outfit sync, chat both ways with bubbles and unread badge, throttling, masking, typing does not walk, leaving.
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

### Phase 4 — private chat rooms and AI moderation (Supabase Edge Functions)
- Private chat: create a room, get a short invite code, and share it; anyone who enters the code joins. Codes are generated on the server with an expiry, and membership is enforced with Row Level Security and Realtime authorization, so a code cannot be guessed or bypassed from the browser.
- AI moderation: chat messages go through an Edge Function that calls an NVIDIA safety model (e.g. NemoGuard content safety, via build.nvidia.com/NIM). Inappropriate messages are blocked or masked before anyone sees them. The NVIDIA API key lives only in Supabase secrets.
- Report, mute and block buttons.
- To check before starting: the current free-tier terms and rate limits of the NVIDIA API, and how well the safety model handles Korean (the local filter stays as a fallback).

### Phase 5 — voice chat and speech-to-text
- Voice chat over WebRTC with Supabase Realtime for connection setup (signaling): push-to-talk or a toggled mic, speaking indicators over heads, per-person mute, and nearby-only or room-only audio. Peer-to-peer suits small groups; mobile networks may need a TURN relay (free tiers are limited).
- STT: the browser's Web Speech API (Korean, free, works in iOS Safari and Chrome) turns speech into chat text or live captions. Transcripts pass through the same AI moderation. Live voice audio itself cannot be filtered in real time, so mute/report/block and push-to-talk are the safeguards there.

### Later — AI residents
Characters share one factory and every room has an id, so AI residents (shopkeeper, chatty guest, counsellor) can be added as actors whose replies come from an LLM (e.g. NVIDIA NIM) through a server-side function.
