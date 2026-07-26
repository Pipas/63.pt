# 63.pt landing page

The landing page source. A tiny zero-dependency static-site generator: it renders
one HTML file **per language** from a shared template + translation files, so the
design lives in one place and the copy lives in JSON.

## Layout

```
src/
  template.js          The page markup as a pure function of a locale object.
  build.mjs            Renders every language and copies assets → ../dist.
  locales/
    en.json            All user-facing copy for English.
    pt.json            All user-facing copy for Portuguese.
  qr.mjs               Generates QR artwork for the short links (local only).
  data/
    cards.en.json      Hero-demo deck for English.
    cards.pt.json      Hero-demo deck for Portuguese.
    links.json         Short tracking links (/t1, /k1, /ig…) → UTM campaigns.
  styles/
    base.css           Fonts, variables, shared components.
    landing.css        Landing-specific layout.
    hero-demo.css      The in-game hero animation.
  scripts/
    store-cta.js       Point CTAs at the right app store on mobile.
    sticky-cta.js      Show/hide the sticky mobile CTA on scroll.
    hero-demo.js       The auto-playing hero card demo.
  static/              Standalone HTML pages (legal, store redirect).
  assets/              Images, icons, emoji, webmanifest → copied to dist.
  fonts/               Web fonts → copied to dist.
```

## Build

```
cd src
npm run build      # → ../dist  (deployable static site)
npm run preview    # build + serve dist at http://localhost:8080
```

Output:

- `dist/index.html` → served at **63.pt/** (Português, the default)
- `dist/en/index.html` → served at **63.pt/en/** (English)
- `dist/{styles,scripts,assets,fonts}` and the legal pages
- `dist/CNAME` and `dist/app-ads.txt` at the site root (hosting metadata)

`dist/` is fully self-contained — deploy it as-is.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs
`node src/build.mjs` and publishes `dist/` to GitHub Pages — no local build or
committed output needed (`dist/` is gitignored). `app-ads.txt` and `CNAME` ride
along at the site root.

One-time setup: in the repo's **Settings → Pages**, set **Source** to
**GitHub Actions**.

## Analytics

Traffic is measured with [Umami](https://umami.is) Cloud — cookieless, no
personal data, so no consent banner. Paste the website ID from **Umami Cloud →
Settings → Websites** into `UMAMI.websiteId` in `build.mjs`. It's public (it
ships in the page source), so it belongs in the file, not in a secret.

While it's empty, no analytics tag is emitted — that's what keeps local builds
and forks out of the dashboard. `data-domains="63.pt"` is the backstop.

## Short tracking links and QR codes

`data/links.json` maps a short path to a UTM campaign. Each one builds to a
redirect page (`dist/t1/index.html`) that bounces to the destination with the
tags attached — GitHub Pages can't issue a 302, so this is the static
equivalent:

```
63.pt/t1  →  63.pt/?utm_source=tshirt&utm_medium=merch&utm_campaign=tee-front&utm_content=t1
```

Codes are grouped by their leading letters: `t*` t-shirts, `k*` stickers, and
`ig` / `rd` / `ph` / `pr` for Instagram, Reddit, Product Hunt and press. Adding
a design is one line in `links.json`; the group supplies source and medium, and
`utm_content` is always the code, so two designs in one campaign stay apart in
the dashboard.

Groups can also set `ecc`, the QR error-correction level, because the right
answer depends on how big the thing gets printed:

| | level | modules | why |
|---|---|---|---|
| Stickers, bio links | Q (25%) | 25×25 | At ~3cm a 29-module code is 0.9mm per module. Resolution is the binding constraint, and if the camera can't resolve the grid, error correction never gets a chance to help. |
| T-shirts | H (30%) | 29×29 | At 8cm+ modules are ~2.75mm either way, so size stops mattering and the extra recovery is free protection against creases, stretch, ink bleed and washing. |

Both land on QR version 2/3, which each carry one alignment pattern, so the
smaller code gives up nothing on distortion correction.

```
npm run qr      # → ../qr/{t1,k1,…}.svg + .png + a proof sheet
```

The codes are drawn with rounded corners: `qr.mjs` takes the module matrix from
`qrcode` and renders its own SVG. Two knobs:

- `RADIUS` (0–0.5) rounds each module, but only at corners where both touching
  modules are light — so isolated modules become dots and runs become pills.
- `EYE_RADIUS` (0–3.5) rounds the three finder patterns in the corners. These
  are drawn as whole shapes rather than 49 modules each, which is what lets them
  round further than one module's worth. 2.5 is a squircle, 3.5 a full circle.
  The centre scales with the ring so both stay the same shape.

Every code is rasterised and read back with a real decoder before it's written,
so a styling change can't quietly break one on its way to a print run.

That check has a known limit worth understanding: **every** `EYE_RADIUS` from 0
to 3.5 passes it, so it will happily wave through a fully circular eye. It
catches gross breakage, not marginal scannability. Rounding the eyes works
because decoders find a finder by the 1:1:3:1:1 run-length ratio through its
centre, and rounding only removes corner material those scan lines never touch —
but past about 2 the rendered corners genuinely stop matching the module grid
(12 modules differ at 2.5, 48 at 3.5). Real scanners vary far more than one JS
decoder, so test on actual phones before committing to a print run.

Hand the printer the **SVG** (vector, stays sharp at any size); the PNG is for
mockups. Open `qr/index.html` and scan every code off the screen before sending
artwork out — and keep the white quiet zone around the code, since cropping it
is the usual reason a printed QR won't scan. `qr/` is gitignored and never runs
in CI.

## Adding a language

1. Copy `locales/en.json` → `locales/<code>.json` and translate the values.
2. Copy `data/cards.en.json` → `data/cards.<code>.json` (localize the deck).
3. Add `{ code: '<code>', url: '/<code>/', out: '<code>/index.html' }` to
   `LANGS` in `build.mjs`.
4. `npm run build`.

Nothing else changes: the template reads only from the locale, so a new
language is just data. `hreflang` alternates and the footer language switcher
update automatically.
