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
  data/
    cards.en.json      Hero-demo deck for English.
    cards.pt.json      Hero-demo deck for Portuguese.
  styles/
    base.css           Fonts, variables, shared components.
    landing.css        Landing-specific layout.
    hero-demo.css      The in-game hero animation.
  scripts/
    store-cta.js       Point CTAs at the right app store on mobile.
    sticky-cta.js      Show/hide the sticky mobile CTA on scroll.
    hero-demo.js       The auto-playing hero card demo.
```

## Build

```
cd src
npm run build      # → ../dist  (deployable static site)
npm run preview    # build + serve dist at http://localhost:8080
```

Output:

- `dist/index.html` → served at **63.pt/** (English)
- `dist/pt/index.html` → served at **63.pt/pt/** (Portuguese)
- `dist/{styles,scripts,assets,fonts}` and the legal pages / `CNAME`

`dist/` is fully self-contained — deploy it as-is (e.g. GitHub Pages).

## Adding a language

1. Copy `locales/en.json` → `locales/<code>.json` and translate the values.
2. Copy `data/cards.en.json` → `data/cards.<code>.json` (localize the deck).
3. Add `{ code: '<code>', url: '/<code>/', out: '<code>/index.html' }` to
   `LANGS` in `build.mjs`.
4. `npm run build`.

Nothing else changes: the template reads only from the locale, so a new
language is just data. `hreflang` alternates and the footer language switcher
update automatically.
