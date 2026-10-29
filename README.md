# 찜질중 ♨

A tiny, warm 3D jjimjilbang for a quiet break. Open [the live room](https://eye215.github.io/jjimjiljung/).

## Experience

- A plush two-head-tall chibi with tiny dot eyes, a deep terrycloth cap, soft folded towel rolls, short mitten hands and legs, and a sauna emblem. Three coordinated towel/outfit palettes; no crossbody bag.
- Tap the floor (or focus the room and use arrow keys) to walk. Sit, lie down with a pillow, eat a roasted egg, or drink sikhye. Faces blink, smile and close their eyes to rest.
- A reference-derived environment plate with salt and ice rooms, a glowing brick sauna, wooden snack shop, terracotta floor, plants and cushions. Real-time 3D characters and shadows are composited over this fixed-camera background; this is a 2.5D room, not a free-orbit 3D building.
- Full-screen mobile layout, drag-to-pan background exploration, a return-to-player button, safe-area spacing, keyboard controls, reduced-motion support and optional user-activated synthesized ambience. The last outfit is saved locally, when storage is available.
- Clear loading, missing-module, unsupported-WebGL and context-loss states, with a retry button. Rendering and sound pause while the page is hidden.

## Run / deploy

This is a buildless static site. Serve the repository root over HTTP (for example `python -m http.server 8000`), then open `http://localhost:8000`. Opening `index.html` as a local file will not load ES modules.

GitHub Pages serves `main` / repository root. No secret, backend, build service, external model, font or CDN is required. Three.js **0.170.0** is vendored in `vendor/`, with its MIT license. Character textures and geometry are generated locally at startup. The environment PNG is served from assets/; its provenance and exact generation prompt are recorded in assets/README.md.

## Checks

Use Node.js and install the pinned development dependency with `npm install`, then `npx playwright install chromium`, `npm run check` and `npm test`. Alternatively set `BROWSER_PATH` to an installed Chromium/Chrome executable. `TEST_URL` can target the deployed site instead of the local test server. Test screenshots go to ignored `test-results/`.

Tests cover desktop, 390px and 320px mobile layouts, landscape, action selection, walking input, outfit persistence, audio controls, reduced motion, local asset requests, real WebGL context loss/retry, missing JavaScript, missing background images, unavailable WebGL, background panning/recentering, and stale first-frame timestamps that must not destabilize joints. Screenshots should also be visually reviewed. Chromium mobile emulation does not replace testing on physical iOS Safari or low-memory Android devices.
