# Marketing App (Static Export)

This is a static-only Next.js App Router project intended for the marketing site. It is configured to export static HTML via `output: 'export'` in `next.config.mjs`.

## Structure
- `app/layout.tsx`: Global layout (header/nav, footer). Keep it simple and static.
- `app/page.tsx`: Landing page content.
- `app/about/page.tsx`: About page.
- `app/privacy/page.tsx`: Privacy policy placeholder.
- `app/contact/page.tsx`: Contact page with email links.
- `app/faq/page.tsx`: Frequently asked questions.

## Editing Navigation
Update the header links in `app/layout.tsx`:
```tsx
<header>
  <a href="/">Home</a>
  <a href="/about">About</a>
  <a href="/privacy">Privacy</a>
  {/* Add more links here */}
  {/* <a href="/contact">Contact</a> */}
  {/* <a href="/faq">FAQ</a> */}
</header>
```
Add new pages by creating `app/<route>/page.tsx` files and linking to them here.

## Content Guidelines
- Keep content static (no data fetching or server APIs). This app is designed to be exported and hosted on a CDN.
- Avoid inline styles; prefer simple class names or static style blocks if needed.
- No client-side JS is required; if you add interactive elements, ensure they are export-safe.

## Local Development
```bash
pnpm i
pnpm dev -C apps/marketing # http://localhost:3100
```

## Build / Export
```bash
pnpm -C apps/marketing build
# outputs to apps/marketing/out/
```

## Deploy Options
- Netlify: root `netlify.toml` builds `apps/marketing` and publishes `out`.
- GitHub Pages: `marketing-pages` workflow builds and deploys.
- AWS S3 + CloudFront: Terraform in `infra/terraform/marketing`; sync `out/` to S3 and optionally set Route53 alias.

## Open Graph (OG) Image
- Generate/update OG assets:
  - Edit TITLE/SUBTITLE and run: `TITLE="ServiceLink" SUBTITLE="Trusted local providers" pnpm -C apps/marketing og`
  - This writes `apps/marketing/public/og.svg` and (optionally) `og.png` if PNG converter is available.
- Update the URLs in `app/layout.tsx` metadata `openGraph.images` and `twitter.images` to point to your deployed domain, e.g. `https://your-domain/og.svg`.
