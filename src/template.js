// HTML template for the 63 landing page.
//
// Pure function: given a locale object (src/locales/<lang>.json) and some build
// context, it returns the full HTML string for that language. All copy comes
// from the locale — there are no hard-coded user-facing strings here — so a new
// language is just a new JSON file. See build.mjs for how this is invoked.

const SITE_URL = 'https://63.pt';

// og:locale expects an underscore locale (language_TERRITORY), not the bare
// hreflang code we use elsewhere. Map each supported language to its region.
const OG_LOCALES = { pt: 'pt_PT', en: 'en_GB' };

// App-store deep links (same for every language).
const PLAY_URL = 'https://play.google.com/store/apps/details?id=pt.app63';
const APPLE_URL = 'https://apps.apple.com/app/63/id6449913779';

// Localized store-badge artwork lives next to the default in /assets.
function badgeSrc(base, lang) {
  return lang === 'en' ? `/assets/${base}.png` : `/assets/${base}_${lang}.png`;
}

// A pair of store badges (Google Play + App Store), reused in the hero and the
// final CTA. `alt`/`label` text stays English here — it's the official badge
// wording, not page copy.
function storeBadges(lang) {
  const play = badgeSrc('google_play_badge', lang);
  const apple = badgeSrc('app_store_badge', lang);
  return `
          <div class="stores">
            <a class="store-btn apple" href="${APPLE_URL}" aria-label="Download on the App Store">
              <img src="${apple}" alt="Download on the App Store" />
            </a>
            <a class="store-btn play" href="${PLAY_URL}" aria-label="Get it on Google Play">
              <img src="${play}" alt="Get it on Google Play" />
            </a>
          </div>`;
}

// The community pack tiles: preview colours + emoji artwork mirror the real
// packs published on packs.63.pt (colour and the two pack emojis come straight
// from each pack's definition). Names/meta live in the locale so they stay
// translatable, and the order here must match the locale's `community.tiles`.
const TILE_ART = [
  { color: '#FFC857', back: 'popcorn', front: 'clapper-board' }, // Top 100 Movies
  { color: '#1E3A5F', back: 'world-map', front: 'globe-showing-europe-africa' }, // World Countries
  { color: '#B43E8F', back: 'high-voltage', front: 'person-superhero' }, // Superheroes
  { color: '#57CC99', back: 'elephant', front: 'grinning-cat-with-smiling-eyes' }, // Animals
  { color: '#2D9CDB', back: 'person-running', front: 'sports-medal' }, // Olympic Sports
  { color: '#F76F8E', back: 'artist-palette', front: 'television' }, // Animated Characters
];

const HEART_SVG =
  '<svg class="i-heart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/></svg>';

function packTiles(t) {
  return t.community.tiles
    .map((tile, i) => {
      const art = TILE_ART[i];
      let meta = `${tile.cards} ${t.community.cardsWord}`;
      if (tile.likes != null) meta += ` · ${HEART_SVG} ${tile.likes}`;
      if (tile.flag) meta += ` · ${tile.flag}`;
      return `
              <div class="pack-tile">
                <div class="pack-preview" style="background: ${art.color};">
                  <img class="pe back" src="/assets/emoji/${art.back}.svg" alt="" />
                  <img class="pe front" src="/assets/emoji/${art.front}.svg" alt="" />
                </div>
                <div class="pack-info">
                  <span class="name">${tile.name}</span>
                  <span class="meta">${meta}</span>
                </div>
              </div>`;
    })
    .join('');
}

// Feature icons for the packs.63.pt section, keyed to the locale's feature order.
const FEATURE_ICONS = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1"/><path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M17 10h2a2 2 0 0 1 2 2v1"/><path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M3 13v-1a2 2 0 0 1 2 -2h2"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M8.7 10.7l6.6 -3.4"/><path d="M8.7 13.3l6.6 3.4"/></svg>',
];

function packFeatures(t) {
  return t.make.features
    .map(
      (f, i) => `
            <div class="pf">
              <div class="icon" aria-hidden="true">${FEATURE_ICONS[i]}</div>
              <h4>${f.title}</h4>
              <p>${f.body}</p>
            </div>`
    )
    .join('');
}

// A speech bubble: the provided SVG (assets/speech_bubble.svg) is the box's
// background, kept to its own ratio, with the clue centred inside. `.bubble-2`
// is round 1's mirrored reply. Sizing lives in base.css.
function bubble(inner, cls) {
  return `<div class="bubble${cls ? ` ${cls}` : ''}"><span class="clue">${inner}</span></div>`;
}

// A round's clue is either text or a Fluent emoji (same 3D artwork as the
// pack tiles), depending on which the locale provides.
function clue(r) {
  return r.clueImg
    ? `<img class="clue-emoji" src="/assets/emoji/${r.clueImg}.svg" alt="${r.clue || ''}" />`
    : r.clue;
}

function roundCards(t) {
  return t.how.rounds
    .map((r, i) => {
      const bubbles = r.clue2
        ? bubble(clue(r)) + bubble(r.clue2, 'bubble-2')
        : bubble(clue(r));
      return `
          <article class="round r${i + 1}">
            <div class="r-num"><span class="r-word">${t.how.roundWord}</span><span class="r-digit">${i + 1}</span></div>
            <div class="r-copy">
              <h3>${r.title}</h3>
              <p class="r-sub">${r.body}</p>
            </div>
            <div class="r-example">
              <div class="bubbles">${bubbles}</div>
            </div>
            <span class="r-for">${t.how.exampleFor}</span>
          </article>`;
    })
    .join('');
}

// hreflang alternates + a small footer language switcher.
function alternateLinks(langs) {
  return langs
    .map((l) => `    <link rel="alternate" hreflang="${l.code}" href="${SITE_URL}${l.url}" />`)
    .join('\n');
}

function langSwitch(langs) {
  return langs
    .map((l) =>
      l.current
        ? `<span class="lang-current">${l.name}</span>`
        : `<a href="${l.url}" hreflang="${l.code}">${l.name}</a>`
    )
    .join(' · ');
}

// First-load language sniff, inlined in the <head> of the default (root) page
// only. The site is static (GitHub Pages), so this runs client-side before
// paint: a visitor whose browser isn't Portuguese is bounced to /en/ once per
// session. The sessionStorage guard means we never fight a manual choice — if
// someone picks a language from the footer switcher, we won't bounce them back.
function langRedirect(langs, isDefault) {
  if (!isDefault) return '';
  const fallback = langs.find((l) => !l.current); // the non-default language
  if (!fallback) return '';
  return `
    <script>
      (function () {
        try {
          if (sessionStorage.getItem('lang-redirect')) return;
          sessionStorage.setItem('lang-redirect', '1');
          var lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
          if (lang.indexOf('pt') !== 0) location.replace('${fallback.url}');
        } catch (e) {}
      })();
    </script>`;
}

export default function render(t, ctx) {
  const { langs } = ctx;
  const self = langs.find((l) => l.current);
  const cards = JSON.stringify(ctx.cards);

  return `<!DOCTYPE html>
<html lang="${t.lang}" dir="${t.dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />${langRedirect(langs, ctx.isDefault)}
    <title>${t.meta.title}</title>

    <!-- Primary Meta Tags -->
    <meta name="title" content="${t.meta.title}" />
    <meta name="description" content="${t.meta.description}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="63" />
    <meta property="og:locale" content="${OG_LOCALES[t.lang] || 'en_GB'}" />
    <meta property="og:url" content="${SITE_URL}${self.url}" />
    <meta property="og:title" content="${t.meta.title}" />
    <meta property="og:description" content="${t.meta.description}" />
    <meta property="og:image" content="${SITE_URL}/assets/meta_preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="627" />
    <meta property="og:image:alt" content="${t.meta.title}" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${SITE_URL}${self.url}" />
    <meta property="twitter:title" content="${t.meta.title}" />
    <meta property="twitter:description" content="${t.meta.description}" />
    <meta property="twitter:image" content="${SITE_URL}/assets/meta_preview.png" />
    <meta property="twitter:image:alt" content="${t.meta.title}" />

    <link rel="canonical" href="${SITE_URL}${self.url}" />
${alternateLinks(langs)}

    <!-- Fonts are self-hosted via @font-face in styles/base.css -->

    <link rel="stylesheet" type="text/css" href="/styles/base.css" />
    <link rel="stylesheet" type="text/css" href="/styles/landing.css" />
    <link rel="stylesheet" type="text/css" href="/styles/hero-demo.css" />
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png" />
    <link rel="manifest" href="/assets/site.webmanifest" />
  </head>
  <body>
    <div class="page">

      <!-- NAV -->
      <header class="nav">
        <div class="nav-inner">
          <span class="logo63 logo">63</span>
          <nav class="nav-links">
            <a href="#how">${t.nav.how}</a>
            <a href="#packs">${t.nav.packs}</a>
            <a href="#get">${t.nav.get}</a>
          </nav>
          <a href="#get" class="btn primary js-store-cta" style="padding: 10px 20px; font-size: 15px;">${t.nav.cta}</a>
        </div>
      </header>

      <!-- HERO -->
      <section class="bg-green hero" id="top">
        <div class="hero-inner">
          <div>
            <div class="pill-row">
              <span class="pill solid">${t.hero.pills[0]}</span>
              <span class="pill">${t.hero.pills[1]}</span>
              <span class="pill">${t.hero.pills[2]}</span>
            </div>
            <div class="logo63 logo-giant" aria-hidden="true">63</div>
            <h1 class="tagline">${t.hero.taglineTop}<br />${t.hero.taglineBottom}</h1>
            <p class="sub">${t.hero.sub}</p>
${storeBadges(t.lang)}
          </div>
          <!--
            HERO DEMO — the live in-game screen, recreated in HTML/CSS/JS.
            A deck of cards (embedded below as JSON) auto-plays: the top card is
            guessed (✓, pack-colour reveal from the points corner) or skipped
            (golden reveal from the bottom-left) and swings off the stack —
            bursting past the phone frame on mobile. Falls back to a static top
            card under prefers-reduced-motion.
          -->
          <div class="hero-phone-wrap" id="hero-demo">
            <div class="phone hgame-phone">
              <div class="screen">
                <div class="hbg" aria-hidden="true"></div>
                <div class="hgame" aria-hidden="true">
                  <div class="hgame-timer"><span class="t" id="hgame-time">63</span></div>
                  <div class="hgame-body">
                    <div class="hgame-center">
                      <div class="hdeck" id="hgame-deck" data-skip-label="${t.hero.skipLabel}"></div>
                    </div>
                  </div>
                  <div class="hgame-buttons">
                    <button class="hbtn skip" id="hgame-skip" type="button" tabindex="-1">${t.hero.skipLabel}</button>
                    <button class="hbtn guess" id="hgame-guess" type="button" tabindex="-1" aria-label="Guessed">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="facts">
          <span class="fact"><b>1</b>&nbsp;${t.facts.phone}</span>
          <span class="sep"></span>
          <span class="fact"><b>2</b>&nbsp;${t.facts.teams}</span>
          <span class="sep"></span>
          <span class="fact"><b>3</b>&nbsp;${t.facts.rounds}</span>
          <span class="sep"></span>
          <span class="fact"><b>63</b>&nbsp;${t.facts.seconds}</span>
          <span class="sep"></span>
          <span class="fact"><b>∞</b>&nbsp;${t.facts.packs}</span>
        </div>
      </section>

      <!-- HOW TO PLAY -->
      <section class="section bg-white" id="how">
        <div class="packs-tags"><span class="pill tint">${t.how.chip}</span></div>
        <h2 class="section-title">${t.how.titleTop}<br /><span class="underline-yellow">${t.how.titleBottom}</span></h2>
        <p class="section-lead">${t.how.lead}</p>

        <div class="rounds">${roundCards(t)}
        </div>

      </section>

      <!-- MAKE YOUR OWN · NEW -->
      <section class="bg-green" id="make" style="padding: 96px 0;">
        <div style="max-width: 1280px; margin: 0 auto; padding: 0 32px;">
          <div class="packs-hero">
            <div class="copy">
              <div class="packs-tags">
                <span class="pill red"><b style="font-weight: 600;">${t.make.new}</b></span>
                <span class="pill">${t.make.companion}</span>
              </div>
              <h2 class="section-title">${t.make.titleTop}<br />${t.make.titleBottom} <span style="color: var(--yellow);">packs.63.pt</span></h2>
              <p class="section-lead" style="color: rgba(255, 255, 255, 0.9);">
                ${t.make.lead}
              </p>
              <div class="packs-url">
                <a href="https://packs.63.pt" class="url-bubble">
                  packs.63.pt <span class="arrow">→</span>
                </a>
                <span style="font-size: 15px;">${t.make.noInstall}</span>
              </div>
            </div>
            <div class="packs-phones">
              <div class="phone back">
                <div class="screen">
                  <img src="/assets/packs_publish_tab_${t.lang}.png" alt="packs.63.pt" loading="lazy" />
                </div>
              </div>
              <div class="phone front">
                <div class="screen">
                  <img src="/assets/packs_card_tab_${t.lang}.png" alt="packs.63.pt" loading="lazy" />
                </div>
              </div>
            </div>
          </div>

          <div class="packs-features">${packFeatures(t)}
          </div>
        </div>
      </section>

      <!-- COMMUNITY PACKS -->
      <section class="bg-paper" id="packs">
        <div class="section community">
          <div>
            <div class="packs-tags"><span class="pill tint">${t.community.chip}</span></div>
            <h2 class="section-title">${t.community.titleTop}<br />${t.community.titleBottom}</h2>
            <p class="section-lead">${t.community.lead}</p>
            <p class="free-callout">
              <span class="check">✓</span>
              ${t.community.free}
            </p>
            <div class="pack-tiles">${packTiles(t)}
            </div>
          </div>
        </div>
      </section>

      <!-- FINAL CTA -->
      <section class="bg-green final" id="get">
        <div class="confetti" aria-hidden="true">
          <span style="left: 8%;  top: 26%; background: #feea00; --r: -24deg; animation-duration: 3.6s;"></span>
          <span style="left: 16%; top: 70%; background: #fff; --r: 12deg; width: 10px; height: 6px; animation-duration: 4.4s;"></span>
          <span style="left: 48%; top: 14%; background: #dd3636; --r: 18deg; animation-duration: 4.8s;"></span>
          <span style="left: 64%; top: 80%; background: #feea00; --r: -40deg; width: 10px; height: 6px; animation-duration: 4.2s;"></span>
          <span style="left: 84%; top: 22%; background: #ff7733; --r: 30deg; animation-duration: 5s;"></span>
          <span style="left: 90%; top: 64%; background: #6cd4ff; --r: -10deg; width: 10px; height: 6px; animation-duration: 3.9s;"></span>
        </div>
        <p style="font-size: 22px; opacity: 0.85; margin: 0 auto 6px;">${t.final.kicker}</p>
        <h2>${t.final.title}</h2>
        <p>${t.final.sub}</p>
${storeBadges(t.lang)}
      </section>

      <!-- FOOTER -->
      <footer class="footer">
        <div class="footer-inner">
          <div>
            <div class="logo63" style="font-size: 56px; line-height: 0.9;">63</div>
            <p style="font-size: 16px; max-width: 360px; opacity: 0.8; margin: 16px 0 0;">${t.footer.blurb}</p>
          </div>
          <div>
            <h4>${t.footer.gameHeading}</h4>
            <ul>
              <li><a href="#how">${t.footer.gameLinks.how}</a></li>
              <li><a href="#packs">${t.footer.gameLinks.community}</a></li>
              <li><a href="${APPLE_URL}">App Store</a></li>
              <li><a href="${PLAY_URL}">Google Play</a></li>
            </ul>
          </div>
          <div>
            <h4>${t.footer.packsHeading}</h4>
            <p class="footer-blurb">${t.footer.packsBlurb}</p>
            <a href="https://packs.63.pt" class="url-bubble">packs.63.pt <span class="arrow">→</span></a>
          </div>
        </div>
        <p class="legal">
          <a href="/privacyPolicy.html">${t.footer.privacy}</a> · <a href="/termsAndConditions.html">${t.footer.terms}</a>
          <span class="lang-switch">· ${langSwitch(langs)}</span><br />
          ${t.footer.legal}
        </p>
      </footer>

    </div>

    <!-- STICKY MOBILE CTA -->
    <div class="sticky-cta" id="sticky-cta" role="complementary" aria-label="${t.nav.get}">
      <span class="txt">${t.sticky.text}</span>
      <a href="#get" class="btn primary js-store-cta">${t.sticky.cta}</a>
    </div>

    <!-- Hero deck (per-language). Source of truth: src/data/cards.${t.lang}.json -->
    <script type="application/json" id="hero-cards">${cards}</script>

    <script src="/scripts/store-cta.js"></script>
    <script src="/scripts/sticky-cta.js"></script>
    <script src="/scripts/hero-demo.js"></script>
  </body>
</html>
`;
}
