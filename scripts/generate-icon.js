const { Jimp, loadFont, HorizontalAlign, VerticalAlign, rgbaToInt } = require('jimp');
const path = require('path');

const ASSETS = path.join(__dirname, '../assets');
const FONT_128_WHITE = path.join(__dirname, '../node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-128-white/open-sans-128-white.fnt');
const FONT_64_WHITE  = path.join(__dirname, '../node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-64-white/open-sans-64-white.fnt');

const RED   = rgbaToInt(204, 0, 0, 255);
const WHITE = rgbaToInt(255, 255, 255, 255);

async function fill(img, color) {
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
    this.bitmap.data[idx]     = (color >>> 24) & 0xff;
    this.bitmap.data[idx + 1] = (color >>> 16) & 0xff;
    this.bitmap.data[idx + 2] = (color >>> 8)  & 0xff;
    this.bitmap.data[idx + 3] =  color         & 0xff;
  });
}

async function main() {
  const font128 = await loadFont(FONT_128_WHITE);
  const font64  = await loadFont(FONT_64_WHITE);

  // ── App Icon 1024×1024 ─────────────────────────────────────────────────
  const icon = new Jimp({ width: 1024, height: 1024 });
  await fill(icon, RED);
  icon.print({ font: font128, x: 0, y: 330, text: { text: 'FY', alignmentX: HorizontalAlign.CENTER }, maxWidth: 1024 });
  icon.print({ font: font64,  x: 0, y: 490, text: { text: 'ForkYeah', alignmentX: HorizontalAlign.CENTER }, maxWidth: 1024 });
  await icon.write(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png');

  // ── Splash icon 300×300 ────────────────────────────────────────────────
  const splash = new Jimp({ width: 300, height: 300 });
  await fill(splash, RED);
  splash.print({ font: font64, x: 0, y: 115, text: { text: 'FY', alignmentX: HorizontalAlign.CENTER }, maxWidth: 300 });
  await splash.write(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  console.log('Done!');
}

main().catch((e) => { console.error(e); process.exit(1); });
