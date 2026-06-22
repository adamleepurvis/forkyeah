#!/usr/bin/env node
// Post-build script: patches dist/index.html and creates dist/manifest.json
// for proper PWA support on iOS. Must run after `expo export --platform web`.

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

// 1. Create dist/manifest.json
const manifest = {
  name: 'ForkYeah',
  short_name: 'ForkYeah',
  description: 'Your weekly meal planner',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#FFF8F3',
  theme_color: '#CC0000',
  orientation: 'portrait',
  icons: [
    { src: '/apple-touch-icon.png', sizes: '1024x1024', type: 'image/png' },
    { src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
  ],
};

fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('✓ manifest.json created');

// 2. Copy app icon as apple-touch-icon
const iconSrc = path.join(__dirname, '..', 'assets', 'icon.png');
const iconDst = path.join(DIST, 'apple-touch-icon.png');
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, iconDst);
  console.log('✓ apple-touch-icon.png copied');
}

// 3. Patch dist/index.html
const htmlPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Add viewport-fit=cover so content extends under notch and home indicator
html = html.replace(
  'initial-scale=1, shrink-to-fit=no"',
  'initial-scale=1, shrink-to-fit=no, viewport-fit=cover"'
);

// Inject PWA tags before </head>
const pwaTags = `  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <script>
    /* Keep iOS PWA in standalone mode: preventDefault stops Safari opening,
       React Navigation's own handler still fires for client-side navigation. */
    (function() {
      if (!window.navigator.standalone) return;
      document.addEventListener('click', function(e) {
        var el = e.target;
        while (el && el.tagName !== 'A') el = el.parentElement;
        if (!el || !el.href) return;
        try {
          var url = new URL(el.href);
          if (url.origin === window.location.origin) e.preventDefault();
        } catch(err) {}
      }, true);
    })();
  </script>`;

html = html.replace('</head>', pwaTags + '\n</head>');

fs.writeFileSync(htmlPath, html);
console.log('✓ index.html patched with PWA meta tags and standalone script');
