/**
 * Root Layout with CSP Nonce
 * - Generates nonce from middleware headers when available
 * - Skips nonce and inline bootstrap scripts during static export builds
 * - Wraps children with shared client providers (toast, CSP watcher)
 */
import './globals.css';
import React from 'react';
import Script from 'next/script';
import Providers from './providers';

const isStaticExport = process.env.NEXT_OUTPUT === 'export';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let nonce: string | undefined;

  if (!isStaticExport) {
    try {
      const { headers } = await import('next/headers');
      const headersList = await headers();
      nonce = headersList.get('x-nonce') ?? undefined;
    } catch {
      nonce = undefined;
    }
  }

  return (
    <html lang="en">
      <head>
        {!isStaticExport && (
          <Script id="webpack-nonce" nonce={nonce} strategy="beforeInteractive">
            {`window.__webpack_nonce__ = ${JSON.stringify(nonce)};`}
          </Script>
        )}
      </head>
      <body>
        {!isStaticExport && (
          <Script id="init-config" nonce={nonce} strategy="beforeInteractive">
            {`window.__APP__ = { env: '${process.env.NODE_ENV}' };`}
          </Script>
        )}

        <Providers>{children}</Providers>

        {!isStaticExport && (
          <Script id="after-hydration" nonce={nonce} strategy="afterInteractive">
            {`console.debug('Hydration complete');`}
          </Script>
        )}
      </body>
    </html>
  );
}
