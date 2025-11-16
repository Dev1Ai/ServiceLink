# Security Overview

## Content Security Policy (CSP)

- Strict, nonce-free CSP is enforced by `apps/web/middleware.ts` when `ENABLE_STRICT_CSP=true`.
- No inline `<script>`/`<style>` or React `style={...}` props are used anywhere in the web app.
- `connect-src`:
  - Production: `'self' https: ws: wss:`
  - Dev/Test: adds `http:` to allow local API over HTTP

Recommended headers (example)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss: ws:; frame-ancestors 'self'; base-uri 'self'; object-src 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Permissions-Policy: geolocation=(self), microphone=()
```

## Vulnerability Reporting

- Please open a private issue or contact the maintainer directly for security concerns.
