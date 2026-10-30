# Project workflow

Read `README.md` first: it is the full handoff (current state, rules, code map, external services, pending specs in §6, tests).

The user wants each completed development update published to GitHub Pages (https://jjimjiljung.yullul.com).
Unless the user specifically requests local-only work, finish the change, run appropriate checks (`npm run check`, `npm test`), commit, open a PR into main and merge it once tests pass (auto-deploy is pre-approved), then verify the Pages deployment and live site. Keep existing concurrent changes safe; never force-push.
Ask first before deleting features, changing important data structures, using paid services or anything security-sensitive.
UI changes: show 390px mobile mockup screenshots first and apply only after the user confirms. Report untested items as untested. Talk to the user in Korean.

Maintain the reference-inspired plush character without a crossbody bag.
The environment is an explorable procedural 3D jjimjilbang (world.js map data, environment.js builders) with an RPG quarter-view follow camera. Keep map data, collision (navigation.js) and visuals in sync, keep near-side walls cut away so the player stays visible, and check mobile portrait framing.
No CDN or external assets except the on-demand Kakao SDK and Google ad script; vendor everything else in `vendor/` with licenses. Never put secret keys (Supabase service_role/secret, NVIDIA) in the repo or frontend. Never touch the StageFlow Supabase project.
When modules change, bump the `?v=rpg-N` cache version in every import and in `index.html` together.

Parallel work: Claude Code is the main developer (characters, game features, integration). Codex only does 3D background design on its own branch. Do not rework environment.js architecture/furniture or global lighting; never edit or force-push Codex's branch; merge Codex PRs only after checking conflicts with character work and getting the user's approval, keeping both sides' changes. Keep README §4-A (status board) updated as work progresses.
