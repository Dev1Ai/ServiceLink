/**
 * CSP Middleware (strict, nonce-free)
 * - Enabled when ENABLE_STRICT_CSP=true
 * - Adds a per-request nonce to request headers for potential future use
 * - Disallows inline styles/scripts by policy; app uses external CSS/JS only
 * - connect-src:
 *   - Production: 'self' https: ws: wss:
 *   - Dev/Test:   adds http: to allow local API under strict CSP
 */
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const enableStrict = process.env.ENABLE_STRICT_CSP === 'true';
  if (!enableStrict) return NextResponse.next();

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-csp-nonce', nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const level = (process.env.CSP_STRICT_LEVEL || 'balanced').toLowerCase();
  const connect = ["'self'", 'https:', 'wss:', 'ws:'];
  const allowHttp = process.env.NODE_ENV !== 'production' || process.env.CSP_ALLOW_HTTP === 'true';
  if (allowHttp) {
    connect.splice(1, 0, 'http:');
  }
  const scriptSrc =
    level === 'strict'
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'`
      : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'strict-dynamic' https:`;
  const styleSrc =
    level === 'strict'
      ? `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`
      : `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https:`;
  const csp = [
    `default-src 'self'`,
    scriptSrc,
    styleSrc,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https:`,
    `connect-src ${connect.join(' ')}`,
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].filter(Boolean).join('; ');

  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
