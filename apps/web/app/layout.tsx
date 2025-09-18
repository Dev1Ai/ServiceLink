/**
 * Root Layout with CSP Nonce
 * - Reads per-request nonce from `x-nonce` header (set in middleware.ts)
 * - Applies nonce to Next.js <Script> and <style> tags
 * - Ensures Webpack dynamic imports inherit the nonce via __webpack_nonce__
 * - All inline scripts/styles must include {nonce} to pass strict CSP
 */
import { headers } from 'next/headers';
import Script from 'next/script';
import React from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Retrieve CSP nonce from request headers (forwarded by middleware.ts)
  const nonce = headers().get('x-nonce') ?? undefined;

  return (
    <html lang="en">
      <head>
        {/* Propagate nonce to Webpack runtime for dynamic imports */}
        <Script id="webpack-nonce" nonce={nonce} strategy="beforeInteractive">
          {`window.__webpack_nonce__ = ${JSON.stringify(nonce)};`}
        </Script>

        {/* Example of nonced inline <style> if needed */}
        {/* <style nonce={nonce}>{`:root { --brand-color: #0080ff; }`}</style> */}
      </head>
      <body>
        {/* Example inline config script (must carry nonce) */}
        <Script id="init-config" nonce={nonce} strategy="beforeInteractive">
          {`window.__APP__ = { env: '${process.env.NODE_ENV}' };`}
        </Script>

        {children}

        {/* Post-hydration scripts must also include nonce */}
        <Script id="after-hydration" nonce={nonce} strategy="afterInteractive">
          {`console.debug('Hydration complete');`}
        </Script>
      </body>
    </html>
  );
}