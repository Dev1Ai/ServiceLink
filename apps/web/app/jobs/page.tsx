'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalToken } from '../useLocalToken';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function JobsPage() {
  const [token, setToken] = useLocalToken();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const initialAssigned = search.get('assigned');
  const [onlyAssigned, setOnlyAssigned] = useState<boolean>(initialAssigned === '1');

  // Load saved filter if no URL param
  useEffect(() => {
    if (initialAssigned) return;
    try {
      const saved = localStorage.getItem('jobs:onlyAssigned');
      if (saved != null) setOnlyAssigned(saved === '1');
    } catch {}
  }, [initialAssigned]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('Loading...');
    const res = await fetch(`${API}/jobs/mine`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => []);
    setItems(Array.isArray(data) ? data : []);
    setStatus(res.ok ? 'OK' : `Error ${res.status}`);
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  // Filter client-side
  const filtered = useMemo(() => {
    if (!onlyAssigned) return items;
    return items.filter((j: any) => !!j.assignment);
  }, [items, onlyAssigned]);

  // Sync filter to URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(search.toString());
      if (onlyAssigned) params.set('assigned', '1');
      else params.delete('assigned');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      localStorage.setItem('jobs:onlyAssigned', onlyAssigned ? '1' : '0');
    } catch {}
  }, [onlyAssigned, pathname, router, search]);

  const verify = async (id: string) => {
    setBusy(id);
    try {
      await fetch(`${API}/jobs/${id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {}
    setBusy(null);
    await load();
  };

  return (
    <div className="container">
      <h2>Your Jobs (Customer)</h2>
      <div className="flex gap-8 items-center">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste CUSTOMER JWT here" />
        <button onClick={load}>Refresh</button>
        <Link href="/jobs/new">Create new job</Link>
        <span>{status}</span>
      </div>
      <div className="mt-16">
        <label className="font-13">
          <input type="checkbox" checked={onlyAssigned} onChange={(e) => setOnlyAssigned(e.target.checked)} /> only assigned
        </label>
      </div>
      <div className="mt-8 grid gap-8">
        {filtered.map((j) => {
          const assigned = !!j.assignment;
          const status = j.assignment?.status;
          const prov = j.assignment?.provider?.user;
          return (
            <div key={j.id} className={`card ${assigned ? 'bg-assigned' : ''}`}>
              <div className="flex justify-between items-center">
                <strong>{j.title}</strong>
                {assigned && (
                  <span className={`badge ${status === 'customer_verified' ? 'badge-info' : 'badge-success'}`}>
                    {status === 'customer_verified' ? 'Verified' : 'Assigned'}
                  </span>
                )}
              </div>
              <div className="text-muted">{j.description}</div>
              {assigned && (
                <div className="mt-6 font-13 text-green-strong">
                  Provider: {prov?.name || prov?.email || j.assignment?.providerId}
                  {status && <span className="ml-8 text-subtle">• Status: {status}</span>}
                </div>
              )}
              <div className="font-12 text-faint mt-4">{new Date(j.createdAt).toLocaleString()}</div>
              <div className="mt-8 flex gap-8 flex-wrap">
                <Link href={`/jobs/${j.id}/quotes`}>View quotes</Link>
                <Link href={`/jobs/${j.id}/quote`}>Provider quote form</Link>
                <Link href={`/jobs/quote?id=${encodeURIComponent(j.id)}`}>Quote (static)</Link>
                {j.key && <Link href={`/realtime?room=${encodeURIComponent('job:' + j.key)}`}>Open chat</Link>}
                {assigned && status !== 'customer_verified' && (
                  <button onClick={() => verify(j.id)} disabled={busy === j.id}>
                    {busy === j.id ? 'Verifying...' : 'Verify completion'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
