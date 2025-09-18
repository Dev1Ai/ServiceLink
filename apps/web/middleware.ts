/**
 * CSP Middleware (strict, nonce-based)
 * - Enabled when ENABLE_STRICT_CSP=true
 * - Generates a per-request nonce for scripts and styles
 * - Forwards the nonce via `x-nonce` request header so layout.tsx can use it
 * - Disallows inline scripts/styles unless they carry the nonce
 * - Uses 'strict-dynamic' so nonced bootstrap scripts can load their children
 * - connect-src:
 *   - Production: 'self' https: ws: wss:
 *   - Dev/Test:   adds http: to allow local API when CSP_ALLOW_HTTP=true
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

export function middleware(req: NextRequest) {
  const enableStrict = process.env.ENABLE_STRICT_CSP === 'true';
  if (!enableStrict) return NextResponse.next();

  // Generate a unique nonce for this request
  const nonce = crypto.randomBytes(16).toString('base64');

  // Pass nonce to app via request headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const allowHttp =
    process.env.NODE_ENV !== 'production' || process.env.CSP_ALLOW_HTTP === 'true';
  const http = allowHttp ? ' http:' : '';
  const https = ' https:';

  // Strict, nonce-based CSP
  const csp = [
    `default-src 'self'`,
    // Only nonced scripts are allowed; 'strict-dynamic' lets them load dependencies
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${https}${http} blob:`,
    // Styles also require nonce
    `style-src 'self' 'nonce-${nonce}'${https}`,
    // Allow images, fonts, connections
    `img-src 'self' data: blob:${https}${http}`,
    `font-src 'self' data:${https}`,
    `connect-src 'self'${https}${http} ws: wss:`,
    // Frame, form, and object restrictions
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    // Upgrade mixed content
    `upgrade-insecure-requests`,
  ].join('; ');

  // Attach CSP header
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

// Apply CSP middleware to all routes except Next.js internals
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};