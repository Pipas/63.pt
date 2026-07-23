// Hero in-game demo: builds the deck and auto-plays guesses/skips.
//
// The deck is read from an embedded <script type="application/json"
// id="hero-cards"> block (per-language, injected at build time), so the demo
// needs no network request and runs identically from disk or a server.
(function () {
  var deckEl = document.getElementById('hgame-deck');
  if (!deckEl) return;

  var timeEl = document.getElementById('hgame-time');
  var timerPane = document.querySelector('.hgame-timer');
  var skipBtn = document.getElementById('hgame-skip');
  var guessBtn = document.getElementById('hgame-guess');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Localized label for the golden skip reveal (the Skip button label lives in
  // the markup); falls back to English.
  var SKIP_LABEL = deckEl.getAttribute('data-skip-label') || 'Skip';

  // The seal word is localised and its length swings a lot ("SKIP" vs
  // "PASSAR"), so a fixed 0.3·cardWidth size overflows for long words. Fit it
  // to the card width minus a side padding, capped at the app's 0.3 ratio.
  // Measured with canvas (no reflow) and handed to CSS via --seal-font.
  var SEAL_PAD = 48; // px of breathing room on each side of the seal word
  var sealMeasure = document.createElement('canvas').getContext('2d');
  function fitSealFont(hgame, cardW) {
    var maxFont = cardW * 0.3; // the app's ratio — the upper bound
    var avail = cardW - SEAL_PAD * 2;
    if (avail <= 0) return maxFont;
    var word = SKIP_LABEL.toUpperCase();
    sealMeasure.font = '800 100px ' + (getComputedStyle(hgame).fontFamily || 'sans-serif');
    var perPx = sealMeasure.measureText(word).width / 100;
    // letter-spacing is 0.033em, i.e. 0.033·font added per gap between glyphs.
    var gaps = Math.max(0, word.length - 1) * 0.033;
    return Math.min(maxFont, avail / (perPx + gaps));
  }

  // Deck data: embedded JSON, source of truth is src/data/cards.<lang>.json.
  function loadCards() {
    var node = document.getElementById('hero-cards');
    if (!node) return [];
    try {
      return JSON.parse(node.textContent);
    } catch (e) {
      return [];
    }
  }

  // White or dark ink for text sitting on the pack colour, by luminance.
  function inkFor(hex) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substr(0, 2), 16);
    var g = parseInt(h.substr(2, 2), 16);
    var b = parseInt(h.substr(4, 2), 16);
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#20160c' : '#ffffff';
  }

  var HEX =
    '<svg class="hex" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" fill="currentColor"/></svg>';
  var CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

  function buildCard(data) {
    var el = document.createElement('div');
    el.className = 'hcard';
    el.style.setProperty('--card-color', data.color);
    el.style.setProperty('--card-ink', inkFor(data.color));
    el.innerHTML =
      '<div class="hcard-title"></div>' +
      '<div class="hcard-desc"></div>' +
      '<div class="hcard-pack">63</div>' +
      '<div class="reveal guess"><div class="fill"></div><div class="label">' + CHECK + '</div></div>' +
      '<div class="reveal skip"><div class="fill"></div><div class="label"></div></div>' +
      '<div class="hcard-points"><span class="pnum"></span>' + HEX + '</div>';
    el.querySelector('.hcard-title').textContent = data.title;
    el.querySelector('.hcard-desc').textContent = data.description;
    el.querySelector('.reveal.skip .label').textContent = SKIP_LABEL;
    el.querySelector('.pnum').textContent = data.points;
    return el;
  }

  var cards = []; // DOM nodes, index 0 = top of the stack.

  // Stack shape, mirroring the app's SwipeStack (stackHeight 6):
  // the top card plus STACK visible slivers behind it, then ONE more card
  // pinned at the deepest sliver's offset — hidden directly behind it.
  // That pinned card is what a rising card reveals, and where a surfacing
  // card appears (fully occluded), so nothing ever pops in on bare table.
  var STACK = 5;
  // Depth slot for a card at position i: capped at STACK, so index STACK
  // and index STACK+1 share the deepest offset (the pinned pair).
  function slot(i) {
    return i < STACK ? i : STACK;
  }
  function layout() {
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.setProperty('--d', slot(i));
      cards[i].style.zIndex = 100 - i;
      cards[i].classList.toggle('buried', i > STACK + 1);
      cards[i].classList.toggle('is-top', i === 0);
    }
  }

  // Card unit (--u) mirrors the Flutter LayoutBuilder: fit the card to
  // both the width and the height left between the counter and buttons,
  // then --u = 5% of the resulting card height.
  function resize() {
    var hgame = deckEl.closest('.hgame');
    if (!hgame) return;
    var W = hgame.clientWidth;
    var H = hgame.clientHeight;
    if (!W || !H) return;

    var sidePad = W * 0.085;
    var topArea = H * 0.17; // timer + counter
    var bottomArea = H * 0.17; // buttons
    var availW = W - sidePad * 2;
    var availH = H - topArea - bottomArea;
    var cardW = Math.min(availW, availH * (2.3 / 3.5));
    var cardH = cardW * (3.5 / 2.3);
    var u = cardH * 0.05;

    // Set on .hgame so the timer, deck, cards and buttons all inherit --u
    // (the timer/buttons are siblings of the deck, not descendants).
    hgame.style.setProperty('--card-w', cardW + 'px');
    hgame.style.setProperty('--card-h', cardH + 'px');
    hgame.style.setProperty('--stack', Math.max(3, cardH * 0.011) + 'px');
    hgame.style.setProperty('--peek', STACK);
    hgame.style.setProperty('--u', u + 'px');
    hgame.style.setProperty('--seal-font', fitSealFont(hgame, cardW) + 'px');
  }

  // ── Timer: an independent 63→0 countdown, like a real turn. ──
  var time = 63;
  function tickTimer() {
    time = time <= 0 ? 63 : time - 1;
    if (timeEl) timeEl.textContent = time;
    if (timerPane) {
      timerPane.classList.toggle('low', time < 10);
      // Only the last 10 seconds pulse; the rest tick without resizing.
      if (time < 10) {
        timerPane.classList.add('tick');
        setTimeout(function () {
          timerPane.classList.remove('tick');
        }, 180);
      }
    }
  }

  // ── Play loop: guess or skip the top card, then recycle it. ──

  // Grow a reveal radius (0 → 155%) on the committing card, ease-in so
  // the circle accelerates out of the corner like a real swipe. Bails the
  // moment the card loses its state class (i.e. it was recycled) so a
  // frame delayed by a background tab can't leave a card stuck fully
  // revealed. Cancellable via el._revealId.
  function growReveal(el, prop, cls, dur) {
    var startT = null;
    cancelAnimationFrame(el._revealId);
    function frame(now) {
      if (!el.classList.contains(cls)) return;
      if (startT === null) startT = now;
      var t = Math.min(1, (now - startT) / dur);
      el.style.setProperty(prop, (t * t * 155).toFixed(1) + '%');
      if (t < 1) el._revealId = requestAnimationFrame(frame);
    }
    el._revealId = requestAnimationFrame(frame);
  }

  function recycle(top) {
    cancelAnimationFrame(top._revealId);
    top.classList.add('no-anim');
    top.classList.remove('guessing', 'skipping', 'fly-right', 'fly-left');
    top.style.setProperty('--gr', '0%');
    top.style.setProperty('--sr', '0%');
    cards.push(cards.shift());
    layout();
    void top.offsetWidth; // flush styles before re-enabling transitions
    top.classList.remove('no-anim');
  }

  // How long the fresh top card rests, fully settled, before the next button
  // press acts on it. The rest of a cycle (press → reveal → fly-off → recycle)
  // takes ~790ms, so time-on-screen between presses ≈ DWELL + 790ms.
  // DWELL = 7200 → ~8s per card.
  var DWELL = 7200;

  var guessesInARow = 0;
  function nextIsGuess() {
    // Skip ~33% of the time; force a skip after a long guess streak.
    if (guessesInARow >= 4) return false;
    return Math.random() < 0.67;
  }

  function cycle() {
    var top = cards[0];
    var guess = nextIsGuess();
    guessesInARow = guess ? guessesInARow + 1 : 0;
    var cls = guess ? 'guessing' : 'skipping';
    var btn = guess ? guessBtn : skipBtn;

    // 1) The button press happens first, on its own.
    if (btn) btn.classList.add('press');

    // 2) Once the press has registered, the card reacts: reveal floods.
    setTimeout(function () {
      if (btn) btn.classList.remove('press');
      top.classList.add(cls);
      growReveal(top, guess ? '--gr' : '--sr', cls, 340);
    }, 170);

    // 3) The card flies off WHILE the reveal is still flooding — as in the
    //    app, the colour tracks the card out rather than fully landing
    //    first. A short 120ms lead just lets the flood get a head start,
    //    so the card isn't stark white as it starts to leave. The cards
    //    behind rise by one slot in sync (same 0.5s transition), so the
    //    next card settles into the top slot exactly as this one leaves.
    setTimeout(function () {
      top.classList.add(guess ? 'fly-right' : 'fly-left');
      // Move every card behind it to the slot it's about to occupy (its
      // future index i-1). The card at the deepest sliver rises off the
      // pinned card behind it; the newly-surfacing card lands on the
      // pinned slot, hidden behind the one in front — so no card ever
      // appears on bare table.
      for (var i = 1; i < cards.length; i++) {
        cards[i].style.setProperty('--d', slot(i - 1));
        cards[i].classList.toggle('buried', i - 1 > STACK + 1);
      }
      // The card rising into the top slot takes the top-card shadow now,
      // so its lift is right by the time it lands (not one cycle late).
      cards[1].classList.add('is-top');
    }, 170 + 120);

    // 4) Recycle to the back once it has flown, then queue the next card.
    setTimeout(function () {
      recycle(top);
      setTimeout(cycle, DWELL);
    }, 170 + 120 + 500);
  }

  function start(data) {
    if (!data.length) return;
    cards = data.map(buildCard);
    cards.forEach(function (c) {
      deckEl.appendChild(c);
    });
    layout();
    resize();

    if (reduce) return; // static top card, no motion.

    window.addEventListener('resize', resize);
    setInterval(tickTimer, 1000);
    // Let the very first card sit and be read before the demo starts playing.
    setTimeout(cycle, 5000);
  }

  start(loadCards());
})();
