# 찜질중 ♨

A tiny, warm 3D jjimjilbang for a quiet break. Open [the live room](https://eye215.github.io/jjimjiljung/).

## Experience

- A plush two-head-tall chibi with tiny dot eyes, a deep terrycloth cap, soft folded towel rolls, short mitten hands and legs, and a sauna emblem. Three coordinated towel/outfit palettes; no crossbody bag.
- **An explorable 3D jjimjilbang (Phase 1).** Six connected rooms built in real 3D: 중앙 휴게실 (wood floor, mats, TV, low tables, trees), 불가마 (brick dome, glowing hearth, steam, orange light), 소금방 (pink salt bricks, a warm salt bed, salt lamps), 얼음방 (ice blocks and a snowman in a sheep-towel cap), 매점 (counter with eggs, sikhye and ramen, a drinks fridge) and 수면실 (night-sky wall, sleeping mats). Residents rest in several rooms; the shopkeeper waves back.
- **RPG quarter-view camera.** The camera follows the player smoothly at an angle. Walls on the camera side of the current room drop to a low ledge (dollhouse cutaway), and anything else that would hide the player turns translucent. Each room has its own light; the ambient light eases into the room's mood as you walk through a door, and the badge/toast shows where you are.
- **Movement and collision.** Walls, door openings and solid furniture are shared map data (`world.js`); `navigation.js` keeps the plush body clear of them, plans tap-to-walk routes from room to room through the doorways, and lets joystick/keyboard movement slide along edges.
- **Controls.** Mobile: thumb joystick (camera-relative), tap the floor to walk, drag to orbit the camera, pinch to zoom. PC: WASD / arrow keys (hold to walk), click to walk, drag to orbit, wheel to zoom, Q/E to turn, Home or 내 위치 to reset the view. 둘러보기 walks you into any room.
- Sit, lie down with a pillow, eat a roasted egg, drink sikhye, or wave hello. Arriving in a room picks a fitting pose (sit by the hearth, lie on the salt or a sleeping mat). Faces blink and close their eyes to rest.
- Full-screen mobile layout, safe-area spacing, reduced-motion support, optional user-activated synthesized ambience, and the last outfit saved locally when storage is available.
- Clear loading, missing-module, unsupported-WebGL and context-loss states, with a retry button. Rendering and sound pause while the page is hidden.

Not yet implemented: multiplayer, group chat and NPC conversation (see the roadmap below).

## Code map

| File | Role |
| --- | --- |
| `world.js` | Map data: rooms, doors, furniture footprints, destinations, `roomAt()`. Pure data, shared by rendering and navigation (and later by networking/zone chat). |
| `navigation.js` | Walkable area (rooms + doorways − furniture, inflated by the actor radius), exact segment checks, A* routes, sliding movement. No Three.js. |
| `environment.js` | Builds the 3D rooms from `world.js`: canvas-drawn textures, walls with cutaway/fade metadata, furniture, signs, lights, steam. Static props are merged per material. |
| `character.js` | The plush character factory and pose animation. Each character owns its outfit materials, so several visitors can wear different palettes (needed for remote players). |
| `scene.js` | Renderer, follow camera, input, actions, residents, room detection, wall cutaway/fading, error handling. |

### Performance notes (mobile)

- Static scenery is merged per material and does not cast real-time shadows; soft baked blobs sit under furniture. Only characters cast shadows, from one shadow map that follows the player.
- Each character merges its non-animated parts per material (about 16 draw calls instead of about 60).
- Pixel ratio is capped (1.5 on touch devices), all shaders are compiled before entering, and rendering pauses while the tab is hidden.

## Run / deploy

This is a buildless static site. Serve the repository root over HTTP (for example `python -m http.server 8000`), then open `http://localhost:8000`. Opening `index.html` as a local file will not load ES modules.

GitHub Pages serves `main` / repository root. No secret, backend, build service, external model, font or CDN is required. Three.js **0.170.0** is vendored in `vendor/`, with its MIT license. All textures and geometry are generated locally at startup. Module URLs carry a `?v=` version so returning visitors get matching files after a deploy; bump it in `index.html` and the imports when modules change.

`assets/sauna-room-v1.png` is the earlier 2.5D environment plate. It is no longer loaded and is kept only as the art-direction reference for colours and props.

## Checks

Use Node.js and install the pinned development dependency with `npm install`, then `npx playwright install chromium`, `npm run check` and `npm test`. Alternatively set `BROWSER_PATH` to an installed Chromium/Chrome executable. `TEST_URL` can target the deployed site instead of the local test server. Test screenshots go to ignored `test-results/`.

- `tests/navigation.cjs`: every room-to-room route through doorways, routes never leave the floor or cut furniture (sampled every centimetre), blocked/off-map taps, walls block, doorways open, sliding, wall glide, anti-tunnelling.
- `tests/smoke.cjs`: desktop, 390px and 320px mobile, 820px tablet and landscape layouts; joystick/tray overlap; all poses and waving; drag orbit, wheel zoom and recenter; the six-room travel dialog and focus handling; camera-relative joystick movement, release and cancel; wall collision; walking through the 불가마 door with the room badge updating; wall cutaway/fading; tap-to-walk; held-key walking; outfit persistence; audio; reduced motion; local-only assets; WebGL context loss/retry; failed module; unavailable WebGL; loading guard.

Chromium uses software WebGL in CI-like environments, so these tests are slow but functional. They do not replace testing on physical iOS Safari or low-memory Android devices.

## Roadmap

### Phase 2 — multiplayer and group chat (planned, needs a Supabase project)

Plan: Supabase Realtime only (free tier), no database tables required for the first version.

- **Presence** on a channel such as `room:main` tracks who is in the jjimjilbang (nickname, outfit, current room) → visitor count, join/leave.
- **Broadcast** sends position updates (`x`, `z`, facing, action, walking) at ~8 Hz while moving; remote characters are drawn with `character.js` and interpolated.
- **Broadcast** chat messages (length and rate limited on the client) → chat panel + speech bubbles over heads. The channel name is the extension point for per-room (`world.js` room ids) or private chats later.
- Only the Supabase project URL and the public **anon** key would be used in the browser (they are designed to be public). No service-role keys or other secrets go in the frontend.

Setup the owner needs to do (not done yet): create a **new** Supabase project dedicated to 찜질중 on the free plan (do not reuse the StageFlow project), then share its Project URL and anon public key.

### Later — NPC conversation

Characters already share one factory and pose animation, and every room has an id, so AI-driven residents (shopkeeper, chatty guest, counsellor) can be added as extra actors. Calls to an LLM API (e.g. NVIDIA NIM) must go through a server-side function so API keys never reach the browser.
