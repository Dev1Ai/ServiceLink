/**
 * Example Page with CSP Nonce
 * - Demonstrates how to safely use inline <Script> or <style> under strict CSP
 * - Skips nonce-dependent markup when building for static export
 */
import Script from 'next/script';
import React from 'react';
import { TokenPanel } from './TokenPanel';

const isStaticExport = process.env.NEXT_OUTPUT === 'export';

export default async function Page() {
  let nonce: string | undefined;

  if (!isStaticExport) {
    try {
      const { headers } = await import('next/headers');
      nonce = headers().get('x-nonce') ?? undefined;
    } catch {
      nonce = undefined;
    }
  }

  return (
    <main>
      <h1>Hello Secure World 🌍</h1>
      <p>This page is running with strict CSP.</p>

      <section className="mt-16">
        <h2 className="font-18 mb-8">Auth token helper</h2>
        <p className="font-13 text-muted mb-8">
          Paste a seeded JWT below to enable authenticated provider tools during local testing.
        </p>
        <TokenPanel />
      </section>

      {!isStaticExport && nonce && (
        <style nonce={nonce}>
          {`
            h1 {
              color: #0070f3;
              font-family: system-ui, sans-serif;
            }
          `}
        </style>
      )}

      {!isStaticExport && nonce && (
        <Script id="page-inline" nonce={nonce} strategy="afterInteractive">
          {`console.log("Page.tsx loaded with CSP nonce");`}
        </Script>
      )}
    </main>
  );
}
