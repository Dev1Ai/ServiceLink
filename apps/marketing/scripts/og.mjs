#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const title = process.env.TITLE || "ServiceLink";
const subtitle =
  process.env.SUBTITLE || "Find trusted local providers for home services";
const outDir = resolve(process.cwd(), "apps/marketing/public");
const svgPath = resolve(outDir, "og.svg");
const pngPath = resolve(outDir, "og.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0b5fff"/>
      <stop offset="100%" stop-color="#094acc"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g fill="#fff">
    <text x="60" y="220" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="72">${title}</text>
    <text x="60" y="300" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="36" opacity="0.95">${subtitle}</text>
  </g>
</svg>`;

writeFileSync(svgPath, svg);
console.log(`Wrote ${svgPath}`);

try {
  const { Resvg } = await import("@resvg/resvg-js");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
    .render()
    .asPng();
  writeFileSync(pngPath, png);
  console.log(`Wrote ${pngPath}`);
} catch (e) {
  console.warn(
    "[og] PNG conversion skipped (optional):",
    e?.message || String(e),
  );
}
