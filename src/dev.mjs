// Dev server for 63.pt with live reload.
//
// Watches the source tree (locales, data, styles, scripts, template, assets,
// fonts, legal pages) and re-runs the static build on every change, then
// reloads the browser automatically. No manual rebuilds.
//
//   npm run dev   → builds, serves ../dist, opens the browser, watches sources
//
// The served page is exactly what `npm run build` produces; Browsersync only
// injects a tiny reload snippet into the served HTML (dist on disk is untouched).

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import browserSync from 'browser-sync';
import chokidar from 'chokidar';
import { build } from './build.mjs';

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SRC, '..');
const DIST = join(ROOT, 'dist');

// Everything a page is rendered from. A change to any of these triggers a
// rebuild + reload.
const WATCH = [
  join(SRC, 'locales'),
  join(SRC, 'data'),
  join(SRC, 'styles'),
  join(SRC, 'scripts'),
  join(SRC, 'template.js'),
  join(SRC, 'build.mjs'),
  join(ROOT, 'assets'),
  join(ROOT, 'fonts'),
  join(ROOT, 'privacyPolicy.html'),
  join(ROOT, 'termsAndConditions.html'),
  join(ROOT, 'app-ads.txt'),
];

const bs = browserSync.create();

async function rebuild() {
  const start = Date.now();
  try {
    await build();
    console.log(`  ↻ rebuilt in ${Date.now() - start}ms\n`);
    bs.reload();
  } catch (err) {
    console.error('  ✗ build failed:\n', err);
  }
}

await rebuild();

bs.init({
  server: DIST,
  // Serve /en/ etc. cleanly and fall back to the root index.
  startPath: '/',
  open: true,
  notify: true,
  ui: false,
  logLevel: 'info',
});

let timer = null;
chokidar
  .watch(WATCH, { ignoreInitial: true })
  .on('all', (event, path) => {
    // Debounce bursts of file events (e.g. a save that touches several files).
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`  • ${event}: ${path.replace(ROOT + '/', '')}`);
      rebuild();
    }, 100);
  });

console.log('\n  Watching src + assets — edit and save, the browser reloads.\n');
