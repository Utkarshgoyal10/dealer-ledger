// Turns one logo image into every icon the app needs.
// Usage (from the client folder):  npm run logo -- "C:\path\to\itel-logo.png"
// Works with PNG, JPG, WEBP or SVG. A square-ish logo on a transparent or white background works best.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Usage: npm run logo -- "C:\\path\\to\\logo.png"');
  process.exit(1);
}
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// Cut away plain white/transparent margins so the logo itself fills the icon
const trimmed = await sharp(src).trim({ threshold: 20 }).png().toBuffer();

/** Logo centred on a square canvas, scaled to `fill` of the canvas width */
async function square(size, { fill = 0.8, background = WHITE } = {}) {
  const inner = Math.round(size * fill);
  const logo = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: CLEAR }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

const files = {
  // Shown inside the app (login screen, sidebar, header) — transparent background
  'logo.png': await sharp(trimmed).resize({ height: 256, withoutEnlargement: true }).png().toBuffer(),
  // Browser tab
  'favicon.png': await square(64, { fill: 0.9 }),
  // Android "Install app" icons. 0.7 keeps the logo inside the safe zone when Android crops it into a circle.
  'pwa-192.png': await square(192, { fill: 0.7 }),
  'pwa-512.png': await square(512, { fill: 0.7 }),
  // iPhone home screen
  'apple-touch-icon.png': await square(180, { fill: 0.75 }),
};

for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(out, name), buf);
  console.log('wrote public/' + name);
}
console.log('\nDone. Restart "npm run dev" (or rebuild) and reinstall the app on phones to see the new icon.');
