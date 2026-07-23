// Static-site build for 63.pt.
//
// Reads the locale files, renders template.js once per language, and writes a
// fully self-contained site into ../dist:
//
//   dist/index.html      → English  (served at 63.pt/)
//   dist/pt/index.html   → Português (served at 63.pt/pt/)
//   dist/styles, /scripts, /assets, /fonts, legal pages, CNAME…
//
// Adding a language: drop src/locales/<code>.json + src/data/cards.<code>.json
// and add an entry to LANGS below.

import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SRC, '..');
const DIST = join(ROOT, 'dist');

// Each language: its locale code, the URL it's served at, and the file it's
// written to. Portuguese is the default (root); every other language gets a
// subfolder. The first entry is treated as the default — its page carries the
// browser-language sniff that bounces non-PT visitors to their language.
const LANGS = [
  { code: 'pt', url: '/', out: 'index.html' },
  { code: 'en', url: '/en/', out: 'en/index.html' },
];

// Static trees copied verbatim into dist. Paths are relative to SRC.
const COPY_DIRS = [
  ['styles', 'styles'],
  ['scripts', 'scripts'],
  ['assets', 'assets'],
  ['fonts', 'fonts'],
];

// Standalone hosting-metadata files copied verbatim to the dist root.
const COPY_FILES = ['app-ads.txt', 'CNAME'];

// Static HTML pages authored in src/static, each written to one or more URLs in
// dist. The store-redirect page is emitted to three short paths (/s, /st,
// /store) so existing links keep working from a single source file.
const STATIC_PAGES = [
  ['privacyPolicy.html', 'privacyPolicy.html'],
  ['termsAndConditions.html', 'termsAndConditions.html'],
  ['store.html', 's/index.html'],
  ['store.html', 'st/index.html'],
  ['store.html', 'store/index.html'],
];

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

export async function build() {
  // Fresh output.
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // Import the template fresh each build so the dev server picks up edits to
  // template.js without a restart (ESM caches static imports; the cache-busting
  // query defeats that). Adds no cost to a one-shot `npm run build`.
  const { default: render } = await import(`./template.js?t=${Date.now()}`);

  // Render each language.
  for (const lang of LANGS) {
    const t = await readJson(join(SRC, 'locales', `${lang.code}.json`));
    const cards = await readJson(join(SRC, 'data', `cards.${lang.code}.json`));

    const langs = LANGS.map((l) => {
      const meta = l.code === lang.code ? t : null;
      return {
        code: l.code,
        url: l.url,
        current: l.code === lang.code,
        // Name in that language's own tongue, read from its locale.
        name: meta ? meta.langName : LANG_NAMES[l.code],
      };
    });

    const html = render(t, { langs, cards, isDefault: lang.code === LANGS[0].code });
    const outPath = join(DIST, lang.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html, 'utf8');
    console.log(`  ✓ ${lang.code.padEnd(3)} → dist/${lang.out}`);
  }

  // Copy static assets (COPY_DIRS are relative to SRC).
  for (const [from, to] of COPY_DIRS) {
    const src = join(SRC, from);
    if (existsSync(src)) await cp(src, join(DIST, to), { recursive: true });
  }
  for (const file of COPY_FILES) {
    const src = join(ROOT, file);
    if (existsSync(src)) await cp(src, join(DIST, file));
  }

  // Render static pages from src/static to their dist URLs.
  for (const [from, to] of STATIC_PAGES) {
    const outPath = join(DIST, to);
    await mkdir(dirname(outPath), { recursive: true });
    await cp(join(SRC, 'static', from), outPath);
  }

  console.log(`\n  Built ${LANGS.length} languages → ${DIST}`);
}

// Fallback display names, only used if a locale is missing its langName.
const LANG_NAMES = { en: 'English', pt: 'Português' };

// Run the build when invoked directly (`node build.mjs`), but not when this
// module is imported by the dev server.
if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
