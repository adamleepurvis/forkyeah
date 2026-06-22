import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover extends content under notch + home indicator */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Make status bar transparent so no white band appears */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <ScrollViewStyleReset />
        {/* Keep iOS PWA in standalone mode: prevent anchor default so iOS doesn't open Safari.
            React Navigation's own bubble-phase handler still fires and navigates client-side. */}
        <script dangerouslySetInnerHTML={{ __html: `
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
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
