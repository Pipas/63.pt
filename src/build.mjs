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
import render from './template.js';

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SRC, '..');
const DIST = join(ROOT, 'dist');

// Each language: its locale code, the URL it's served at, and the file it's
// written to. English is the root; every other language gets a subfolder.
const LANGS = [
  { code: 'en', url: '/', out: 'index.html' },
  { code: 'pt', url: '/pt/', out: 'pt/index.html' },
];

// Static trees copied verbatim into dist. Paths are relative to ROOT.
const COPY_DIRS = [
  ['src/styles', 'styles'],
  ['src/scripts', 'scripts'],
  ['assets', 'assets'],
  ['fonts', 'fonts'],
];

// Standalone files (legal pages, hosting metadata) copied to the dist root.
const COPY_FILES = ['privacyPolicy.html', 'termsAndConditions.html', 'app-ads.txt', 'CNAME'];

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function build() {
  // Fresh output.
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

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

    const html = render(t, { langs, cards });
    const outPath = join(DIST, lang.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html, 'utf8');
    console.log(`  ✓ ${lang.code.padEnd(3)} → dist/${lang.out}`);
  }

  // Copy static assets.
  for (const [from, to] of COPY_DIRS) {
    const src = join(ROOT, from);
    if (existsSync(src)) await cp(src, join(DIST, to), { recursive: true });
  }
  for (const file of COPY_FILES) {
    const src = join(ROOT, file);
    if (existsSync(src)) await cp(src, join(DIST, file));
  }

  console.log(`\n  Built ${LANGS.length} languages → ${DIST}`);
}

// Fallback display names, only used if a locale is missing its langName.
const LANG_NAMES = { en: 'English', pt: 'Português' };

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
