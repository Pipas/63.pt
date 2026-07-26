// QR codes for the short tracking links in data/links.json.
//
//   npm run qr        → ../qr/t1.svg, ../qr/t1.png, … plus an index.html proof sheet
//
// The `qrcode` package only draws square modules, so this uses its low-level
// matrix API and renders the SVG itself — one path, with each corner rounded
// only where it can be.
//
// Print-shop notes baked into the settings below:
//
//   • SVG is the file to hand a printer — vector, so it stays sharp whether it
//     ends up 2cm on a sticker or 20cm on a t-shirt back. The PNG is only for
//     previews and mockups.
//   • Error correction is Q (~25%) for stickers and H (~30%) for t-shirts, set
//     per group in links.json. See the ECC constant for why they differ.
//   • The 4-module quiet zone is part of the spec, not decoration. Printing a QR
//     flush against a coloured panel is the single most common reason one won't
//     scan — keep the white margin the SVG already includes.
//   • Smallest reliable size is roughly the scan distance ÷ 10. A sticker read at
//     30cm wants ~3cm of QR; a t-shirt read across a table wants ~8cm.
//
// This runs locally, never in CI — the deploy workflow only runs build.mjs, so
// these dependencies never need installing there. Output is gitignored;
// regenerate whenever links.json changes.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-js';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { expandLink } from './build.mjs';

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SRC, '..');
const OUT = join(ROOT, 'qr');

const SITE_URL = 'https://63.pt';

// Default error-correction level, overridable per group in links.json.
//
// The level trades recovery against module count, and for `63.pt/xx` at this
// length the step is worth knowing: L=21 modules, M=25, Q=25, H=29. Fewer
// modules at the same physical size means bigger, chunkier modules.
//
// Q (25%) is the default because the binding constraint on a sticker is
// resolution, not damage. At 3cm across, 29 modules is ~0.9mm each — if a phone
// camera can't resolve the grid, error correction never gets the chance to help,
// so the 16% larger module from dropping H→Q buys more than the extra 5%
// recovery does. Both levels land on version 2/3, which each carry one
// alignment pattern, so nothing is given up on distortion correction either.
//
// T-shirts override this to H in links.json: printed at 8cm+ the modules are
// ~2.75mm either way, so size stops being the constraint and the extra recovery
// is free protection against what actually happens to shirts — a crease across
// the code, stretch over a chest, ink bleeding into the weave, ten washes.
const ECC = 'Q';

// Quiet zone, in modules. Four is the spec minimum — don't go below it.
const MARGIN = 4;

// Corner radius as a fraction of one module. 0.5 is the maximum: at that value
// a module with no neighbours becomes a full circle and a run of them becomes a
// pill. Lower it toward 0.25 for a squarer look; 0 gives plain QR back.
const RADIUS = 0.5;

// The three finder patterns — the big squares in the corners — are drawn as
// whole shapes rather than as 49 individual modules, so they can round much
// further than one module's worth. The adjacency rule alone only ever rounds
// them by RADIUS, which on a 7-module square is barely visible.
//
// Radius of the 7×7 outer ring, in modules. 3.5 is the maximum — at that value
// the ring is a full circle. 2.5 is a squircle: clearly rounded, still reads as
// a QR at a glance.
//
// These are the shapes a decoder hunts for first, so they're the riskiest thing
// to restyle. Every value from 0 to 3.5 decodes cleanly under jsQR at 512px,
// which means the verification below does NOT discriminate here — it will pass
// a fully circular eye. It is a guard against gross breakage, not a licence.
//
// The reason rounding the eyes works at all is that decoders locate a finder by
// the 1:1:3:1:1 run-length ratio along scan lines through its centre, and
// rounding only removes material at the corners, which those lines never touch.
// That also means the rendered corners genuinely stop matching the true module
// grid above ~2: at 2.5 twelve corner modules differ, at 3.5 forty-eight do.
// Harmless for the ratio test, but it is why real scanners — which vary far
// more than one JS decoder — deserve a phone test before a print run.
const EYE_RADIUS = 2.5;

const DARK = '#000000';
const LIGHT = '#ffffff';

// Pixel width of the exported PNG. Previews and mockups only — print gets SVG.
const PNG_WIDTH = 2048;

// Width every code is rasterised to and decoded at before it's written out.
// Deliberately small — a phone camera across a room has far less to work with
// than the 2048px export, so if it reads here it reads in the wild.
const VERIFY_WIDTH = 512;

// ---------------------------------------------------------------------------
// Rounded rendering
// ---------------------------------------------------------------------------

// Trim float noise so the path stays readable and the file small.
const n = (v) => String(Number.isInteger(v) ? v : +v.toFixed(3));

// One module as a closed path, rounding each corner independently. A corner is
// rounded only when both modules touching it are light — so isolated modules
// come out as dots and runs come out as pills. The three finder patterns are
// excluded from this and drawn as whole shapes instead; see finderPath.
function cellPath(x, y, tl, tr, br, bl) {
  // Clockwise, so every arc sweeps the same way (sweep-flag 1 in SVG's
  // y-down coordinate system).
  const arc = (r, ex, ey) =>
    r ? `A${n(r)} ${n(r)} 0 0 1 ${n(ex)} ${n(ey)}` : `L${n(ex)} ${n(ey)}`;

  return (
    `M${n(x + tl)} ${n(y)}` +
    `L${n(x + 1 - tr)} ${n(y)}` + arc(tr, x + 1, y + tr) +
    `L${n(x + 1)} ${n(y + 1 - br)}` + arc(br, x + 1 - br, y + 1) +
    `L${n(x + bl)} ${n(y + 1)}` + arc(bl, x, y + 1 - bl) +
    `L${n(x)} ${n(y + tl)}` + arc(tl, x + tl, y) +
    'Z'
  );
}

// A w×h rectangle with every corner rounded by r. Used for the finder patterns,
// which are drawn as whole shapes rather than module by module.
function roundedRect(x, y, w, h, r) {
  const c = Math.min(r, w / 2, h / 2);
  // A zero-radius arc is degenerate; renderers are entitled to drop the whole
  // subpath, which silently deletes the finder rather than squaring it off.
  const arc = (ex, ey) =>
    c ? `A${n(c)} ${n(c)} 0 0 1 ${n(ex)} ${n(ey)}` : `L${n(ex)} ${n(ey)}`;
  return (
    `M${n(x + c)} ${n(y)}` +
    `L${n(x + w - c)} ${n(y)}` + arc(x + w, y + c) +
    `L${n(x + w)} ${n(y + h - c)}` + arc(x + w - c, y + h) +
    `L${n(x + c)} ${n(y + h)}` + arc(x, y + h - c) +
    `L${n(x)} ${n(y + c)}` + arc(x + c, y) +
    'Z'
  );
}

// The three finder patterns: a 7×7 ring one module thick, and a 3×3 centre.
// The ring is an outer rounded rect with a rounded hole punched through it —
// the hole relies on fill-rule="evenodd" on the containing path. Its radius is
// one module smaller so the ring stays a constant thickness round the bend,
// which is what stops it looking like a sticker peeling off a square.
function finderPath(x, y, eyeRadius) {
  return (
    roundedRect(x, y, 7, 7, eyeRadius) +
    roundedRect(x + 1, y + 1, 5, 5, Math.max(eyeRadius - 1, 0)) +
    // The centre scales with the ring rather than being set independently, so
    // the two stay the same shape: square ring, square centre; circular ring,
    // circular centre.
    roundedRect(x + 2, y + 2, 3, 3, eyeRadius * (3 / 7))
  );
}

// Every dark module as a single path. One path rather than N rects keeps the
// file small and, more usefully, stops print software from hairline-gapping
// between adjacent shapes.
function modulesPath(modules, size, margin, radius, eyeRadius) {
  const dark = (row, col) =>
    row >= 0 && col >= 0 && row < size && col < size && !!modules.get(row, col);

  // Top-left, top-right and bottom-left. There is no fourth.
  const finders = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  const inFinder = (row, col) =>
    finders.some(([r0, c0]) => row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7);

  let d = finders
    .map(([r0, c0]) => finderPath(c0 + margin, r0 + margin, eyeRadius))
    .join('');

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!dark(row, col) || inFinder(row, col)) continue;

      const up = dark(row - 1, col);
      const down = dark(row + 1, col);
      const left = dark(row, col - 1);
      const right = dark(row, col + 1);

      d += cellPath(
        col + margin,
        row + margin,
        !up && !left ? radius : 0,
        !up && !right ? radius : 0,
        !down && !right ? radius : 0,
        !down && !left ? radius : 0
      );
    }
  }
  return d;
}

// The SVG is laid out in module units (viewBox 0 0 N N) so the geometry is
// exact integers and the printer can scale it to whatever size the artwork
// needs. The light rect is not optional — it is the quiet zone.
export function roundedQrSvg(text, { eyeRadius = EYE_RADIUS, ecc = ECC } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecc });
  const size = qr.modules.size;
  const total = size + MARGIN * 2;

  // Returns the module count alongside the markup: it's what decides how small
  // the artwork can physically go, so it's worth having at the call site.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 20}" height="${total * 20}" shape-rendering="geometricPrecision">
  <rect width="${total}" height="${total}" fill="${LIGHT}"/>
  <path fill="${DARK}" fill-rule="evenodd" d="${modulesPath(qr.modules, size, MARGIN, RADIUS, eyeRadius)}"/>
</svg>
`;

  return { svg, size };
}

// Rasterise and decode, so no styling change can quietly break a code on its
// way to a print run. Rounding modules is safe in principle — a decoder samples
// module centres — but "in principle" is not what you want to find out from a
// box of stickers, so every code is read back with a real decoder before it's
// written.
export function decodes(svg, expected) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: VERIFY_WIDTH } })
    .render()
    .asPng();
  const { data, width, height } = PNG.sync.read(png);
  const found = jsQR(new Uint8ClampedArray(data), width, height);
  return found?.data === expected;
}

// ---------------------------------------------------------------------------
// Generation. Guarded like build.mjs, so the renderer above can be imported and
// exercised on its own without writing a single file.
// ---------------------------------------------------------------------------

async function main() {
  const links = JSON.parse(await readFile(join(SRC, 'data', 'links.json'), 'utf8'));

  await mkdir(OUT, { recursive: true });

  const rows = [];

  for (const link of links.links) {
    const { code, note, target, ecc = ECC } = expandLink(link, links.groups);
    const url = `${SITE_URL}/${code}`;
    const { svg, size } = roundedQrSvg(url, { ecc });

    if (!decodes(svg, url)) {
      throw new Error(
        `${code}: generated QR did not decode back to ${url}. ` +
          `Try lowering EYE_RADIUS (${EYE_RADIUS}) or RADIUS (${RADIUS}) in qr.mjs.`
      );
    }

    await writeFile(join(OUT, `${code}.svg`), svg, 'utf8');
    await writeFile(
      join(OUT, `${code}.png`),
      new Resvg(svg, { fitTo: { mode: 'width', value: PNG_WIDTH } }).render().asPng()
    );

    rows.push({ code, url, note, target, ecc, size });
    console.log(
      `  ✓ ${code.padEnd(4)} ${url.padEnd(20)} ecc=${ecc}  ${size}×${size} modules  ${note}`
    );
  }

  await writeFile(join(OUT, 'index.html'), proofSheet(rows), 'utf8');

  console.log(`\n  ${rows.length} codes → ${OUT}`);
  console.log('  Proof sheet: qr/index.html — scan every code before printing.\n');
}

// A proof sheet to check every code scans before sending anything to print.
// Open ../qr/index.html and scan each one off the screen — a code that fails
// here will fail on fabric too.
function proofSheet(rows) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>63 — QR proof sheet</title>
    <style>
      body { font: 14px/1.5 system-ui, sans-serif; margin: 40px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 32px; }
      figure { margin: 0; }
      img { width: 100%; background: #fff; }
      code { font-size: 13px; }
      .note { color: #666; }
      @media print { body { margin: 0; } }
    </style>
  </head>
  <body>
    <h1>63 — QR proof sheet</h1>
    <p>Scan each code off the screen before sending artwork to print.</p>
    <div class="grid">
${rows
  .map(
    (r) => `      <figure>
        <img src="${r.code}.svg" alt="QR for ${r.url}" />
        <figcaption>
          <strong>${r.url}</strong><br />
          <span class="note">${r.note}</span><br />
          <span class="note">ECC ${r.ecc} · ${r.size}×${r.size} modules</span><br />
          <code>${r.target.replace(/&/g, '&amp;')}</code>
        </figcaption>
      </figure>`
  )
  .join('\n')}
    </div>
  </body>
</html>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
