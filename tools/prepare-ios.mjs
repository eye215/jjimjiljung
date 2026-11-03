// Prepare the existing static site for an offline-bundled Capacitor iOS app.
// Never copy tests, credentials, Node dependencies, docs or Git metadata.
import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'www');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const extensions = new Set(['.js', '.css', '.html', '.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.mp3', '.wav', '.ogg']);
let copied = 0;
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile() || !extensions.has(extname(entry.name).toLowerCase())) continue;
  copyFileSync(join(root, entry.name), join(out, entry.name));
  copied += 1;
}
for (const folder of ['assets', 'vendor']) {
  if (existsSync(join(root, folder)) && statSync(join(root, folder)).isDirectory()) {
    cpSync(join(root, folder), join(out, folder), { recursive: true });
  }
}
if (!existsSync(join(out, 'index.html')) || !existsSync(join(out, 'scene.js'))) {
  throw new Error('Required web assets are missing from www/');
}
console.log('Prepared iOS web assets in www/ (' + copied + ' top-level files + assets/vendor).');
