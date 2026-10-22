// Every page can be saved to a phone's home screen with its own icon: it links
// an icon, an apple-touch-icon and a web app manifest that exist, and its
// manifest's icons exist and it starts at that same page. A new game page
// without these lines fails here (add it to app-icons.json; site/README.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', ...readdirSync(join(site, 'games')).filter((f) => f.endsWith('.html')).map((f) => `games/${f}`)];

// A URL inside the site, as the file Pages would serve for it.
const fileOf = (url) => {
  let p = fileURLToPath(url);
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  return p;
};
const href = (html, rel) => html.match(new RegExp(`<link rel="${rel}" href="([^"]+)"`))?.[1];

for (const page of pages) {
  test(`${page} has its own home-screen icon and manifest`, () => {
    const pageUrl = pathToFileURL(join(site, page));
    const html = readFileSync(fileOf(pageUrl), 'utf8');
    for (const rel of ['icon', 'apple-touch-icon', 'manifest']) {
      const h = href(html, rel);
      assert.ok(h, `${page}: no <link rel="${rel}">`);
      assert.ok(existsSync(fileOf(new URL(h, pageUrl))), `${page}: ${rel} ${h} is missing`);
    }
    assert.match(html, /<meta name="apple-mobile-web-app-title" content="[^"]+">/);

    const manifestUrl = new URL(href(html, 'manifest'), pageUrl);
    const m = JSON.parse(readFileSync(fileOf(manifestUrl), 'utf8'));
    assert.ok(m.name && m.short_name, `${page}: manifest has no name`);
    assert.ok(m.icons.some((i) => i.sizes === '512x512'), `${page}: manifest has no 512 icon`);
    for (const icon of m.icons) assert.ok(existsSync(fileOf(new URL(icon.src, manifestUrl))), `${page}: manifest icon ${icon.src} is missing`);

    const start = new URL(m.start_url, manifestUrl);
    assert.equal(fileOf(start), fileOf(pageUrl), `${page}: its manifest starts at ${m.start_url}, not this page (run site/icons/set-start.mjs)`);
    assert.ok(start.href.startsWith(new URL(m.scope, manifestUrl).href), `${page}: start_url is outside the manifest's scope`);
  });
}
