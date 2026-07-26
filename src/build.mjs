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

// Umami Cloud analytics. The website ID is not a secret — it ships in the page
// source on every site that uses Umami — so it lives here rather than in a
// build secret. Leave it empty and no analytics tag is emitted at all, which is
// what keeps local builds and forks out of the stats.
//
// `data-domains` is the other half of that: even if someone serves this build
// from another host, the tracker stays silent unless the hostname matches.
// Umami is cookieless and stores no personal data, so there is no consent
// banner to add — see the note in static/privacyPolicy.html.
const UMAMI = {
  scriptUrl: 'https://cloud.umami.is/script.js',
  websiteId: '6ba0fca8-daa3-4c63-8943-d271786522fb',
  domains: '63.pt',
};

// Static trees copied verbatim into dist. Paths are relative to SRC.
const COPY_DIRS = [
  ['styles', 'styles'],
  ['scripts', 'scripts'],
  ['assets', 'assets'],
  ['fonts', 'fonts'],
];

// Standalone hosting-metadata files copied verbatim to the dist root.
const COPY_FILES = ['app-ads.txt', 'CNAME', 'robots.txt'];

// Extra URLs listed in the sitemap alongside the language pages. The /s, /st and
// /store paths are deliberately absent — they're store redirects, not content.
const SITEMAP_EXTRAS = ['/privacyPolicy.html', '/termsAndConditions.html'];

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

const SITE_URL = 'https://63.pt';

// ---------------------------------------------------------------------------
// Short tracking links (data/links.json)
// ---------------------------------------------------------------------------
//
// One short path per printed thing: 63.pt/t1 for a t-shirt design, 63.pt/k1 for
// a sticker run, 63.pt/ig for the Instagram bio. Short because it has to fit in
// a QR that still scans off fabric at arm's length.
//
// GitHub Pages can't issue a 302, so each code is built as a one-page redirect
// (dist/t1/index.html) that bounces to the real page with UTM parameters
// attached. The tracker only runs on the destination, so a hit is one clean
// pageview carrying its UTMs — no double count, and nothing to lose in the race
// between a beacon and a redirect.
//
// The group is the code's leading letters, so `t1`, `t2`, `t3` all inherit the
// t-shirt source/medium and differ only by campaign. Adding a design is one
// line in links.json; nothing here changes.
//
// Deliberately NOT in the sitemap and marked noindex: they're redirects, and an
// indexed one would put a UTM-tagged URL in search results.

// Paths already claimed by a language, an asset tree or a store redirect. A
// code that collided with one would silently overwrite it, and the failure
// would only show up as a dead link on a printed t-shirt.
const RESERVED = new Set([
  ...LANGS.map((l) => l.url.replace(/\//g, '')),
  's', 'st', 'store', 'styles', 'scripts', 'assets', 'fonts',
]);

export function expandLink(link, groups) {
  const group = /^[a-z]+/.exec(link.code)?.[0];
  const g = groups[group];
  if (!g) throw new Error(`links.json: no group "${group}" for code "${link.code}"`);

  const to = link.to || '/';
  const params = new URLSearchParams({
    utm_source: link.source || g.source,
    utm_medium: link.medium || g.medium,
    utm_campaign: link.campaign,
    // The code itself, so two designs in the same campaign stay distinguishable.
    utm_content: link.code,
  });

  // `ecc` is for qr.mjs, not for the redirect page — it rides along here so all
  // the per-link config stays in one file. Undefined means "use the default".
  return { ...link, to, group, ecc: link.ecc || g.ecc, target: `${to}?${params}` };
}

// A redirect page small enough to be a single TCP round trip. The inline script
// runs while the head is still parsing, so the bounce happens before anything
// paints; the meta refresh covers scanners and no-JS clients. Both replace the
// current entry rather than pushing one, so Back returns to wherever the
// visitor came from instead of trapping them in the redirect.
function renderRedirect(link) {
  const target = link.target.replace(/&/g, '&amp;');
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>63</title>
    <link rel="canonical" href="${SITE_URL}${link.to}" />
    <script>location.replace(${JSON.stringify(link.target)});</script>
    <meta http-equiv="refresh" content="0; url=${target}" />
  </head>
  <body>
    <p><a href="${target}">Continue to 63.pt</a></p>
  </body>
</html>
`;
}

// The sitemap, generated rather than checked in so the language list and the
// hreflang alternates can never drift from LANGS.
//
// Every language page lists the full alternate set (itself included) plus
// x-default — that is what tells Google the pages are translations of one
// another rather than duplicates. `lastmod` is the build date, which for a
// static site is genuinely when the page last changed.
function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const alternates = [
    ...LANGS.map((l) => ({ code: l.code, url: l.url })),
    { code: 'x-default', url: LANGS[0].url },
  ]
    .map(
      (a) =>
        `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${SITE_URL}${a.url}"/>`
    )
    .join('\n');

  const langUrls = LANGS.map(
    (l) => `  <url>
    <loc>${SITE_URL}${l.url}</loc>
${alternates}
    <lastmod>${today}</lastmod>
  </url>`
  );

  const extraUrls = SITEMAP_EXTRAS.map(
    (p) => `  <url>
    <loc>${SITE_URL}${p}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...langUrls, ...extraUrls].join('\n')}
</urlset>
`;
}

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
        // Which language is the root one — the template needs it for x-default.
        isDefault: l.code === LANGS[0].code,
        // Name in that language's own tongue, read from its locale.
        name: meta ? meta.langName : LANG_NAMES[l.code],
      };
    });

    const html = render(t, {
      langs,
      cards,
      isDefault: lang.code === LANGS[0].code,
      umami: UMAMI,
    });
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

  // Short tracking links → dist/<code>/index.html.
  const { groups, links } = await readJson(join(SRC, 'data', 'links.json'));
  const seen = new Set();
  for (const link of links) {
    if (RESERVED.has(link.code)) {
      throw new Error(`links.json: "${link.code}" is a reserved path`);
    }
    if (seen.has(link.code)) throw new Error(`links.json: duplicate code "${link.code}"`);
    seen.add(link.code);

    const expanded = expandLink(link, groups);
    const outPath = join(DIST, link.code, 'index.html');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, renderRedirect(expanded), 'utf8');
  }
  console.log(`  ✓ ${links.length} tracking links → /${links.map((l) => l.code).join(', /')}`);

  await writeFile(join(DIST, 'sitemap.xml'), renderSitemap(), 'utf8');
  console.log('  ✓ sitemap.xml');

  if (!UMAMI.websiteId) {
    console.log('\n  ⚠ UMAMI.websiteId is empty — built without analytics.');
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
