'use client';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function Page() {
  const [topCats, setTopCats] = useState<Array<{ slug: string; label: string }>>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/providers/categories`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const flatten = (nodes: any[], prefix = ''): Array<{ slug: string; label: string; children?: any[] }> => {
            const out: Array<{ slug: string; label: string }> = [] as any;
            for (const n of nodes) {
              const label = prefix ? `${prefix} › ${n.name}` : n.name;
              out.push({ slug: n.slug, label } as any);
              if (Array.isArray(n.children) && n.children.length) out.push(...flatten(n.children, label));
            }
            return out as any;
          };
          const flat = flatten(data);
          setTopCats(flat.slice(0, 8));
        }
      } catch {}
    })();
  }, []);
  // Replace inline <Script> demo with a safe client effect
  useEffect(() => {
    try {
      (window as any).__csp_demo__ = 'client effect ok';
      // eslint-disable-next-line no-console
      console.log('[CSP] Client effect executed');
    } catch {}
  }, []);

  return (
    <div className="container">
      <h2>Home</h2>
      <p>This page avoids inline styles/scripts for CSP safety.</p>

      <div className="nonce-demo">This box is styled by global CSS.</div>

      <h3 className="mt-24">Browse Categories</h3>
      <div className="grid-2">
        {topCats.map((c) => (
          <div key={c.slug} className="card-row">
            <span>{c.label}</span>
            <span className="flex gap-8">
              <a href={`/providers/search?category=${encodeURIComponent(c.slug)}`}>Search</a>
              <a href={`/providers/near?category=${encodeURIComponent(c.slug)}`}>Near</a>
            </span>
          </div>
        ))}
        {!topCats.length && <div className="text-muted">No categories yet. Seed the database to get started.</div>}
      </div>
    </div>
  );
}
