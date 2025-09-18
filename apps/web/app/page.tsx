/**
 * Example Page with CSP Nonce
 * - Demonstrates how to safely use inline <Script> or <style> under strict CSP
 * - Reads per-request nonce from request headers (forwarded by middleware.ts)
 * - Apply nonce to any <Script> or <style> blocks you need here
 */
import { headers } from 'next/headers';
import Script from 'next/script';
import React from 'react';

export default function Page() {
  // Retrieve CSP nonce from request headers
  const nonce = headers().get('x-nonce') ?? undefined;

  return (
    <main>
      <h1>Hello Secure World 🌍</h1>
      <p>This page is running with strict CSP.</p>

      {/* Example of inline style with nonce */}
      <style nonce={nonce}>
        {`
          h1 {
            color: #0070f3;
            font-family: system-ui, sans-serif;
          }
        `}
      </style>

      {/* Example of inline script with nonce */}
      <Script id="page-inline" nonce={nonce} strategy="afterInteractive">
        {`console.log("Page.tsx loaded with CSP nonce");`}
      </Script>
    </main>
  );
}