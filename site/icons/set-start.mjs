// Points each game's web app manifest at its own game page.
//
// The shared app-icons script (make-icons.mjs, in the app-icons skill) starts
// every app at the folder its manifest sits in. All the games live in one
// folder, games/, so each game's manifest sits with its pictures in
// icons/<id>/ instead, and this sets its start_url to the page named by
// `start` in app-icons.json. Run it right after make-icons.mjs:
//
//   node <skill>/make-icons.mjs --sheet && node site/icons/set-start.mjs
//
// test/icons.test.js fails if a game's manifest does not start at its page.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const spec = JSON.parse(readFileSync(join(root, 'app-icons.json'), 'utf8'));

for (const app of spec.apps) {
  if (!app.start) continue;
  const file = join(root, app.dir, 'app.webmanifest');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.start_url = relative(join(root, app.dir), join(root, app.start)).split('\\').join('/');
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${app.id}: starts at ${manifest.start_url}`);
}
