'use client';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useLocalToken } from '../../useLocalToken';
import { useToast } from '../../components/Toast';
import { useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

function QuotesStaticContent() {
  const search = useSearchParams();
  const id = search.get('id') || '';
  const [token, setToken] = useLocalToken();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [job, setJob] = useState<any>(null);
  const [acceptCooldownUntil, setAcceptCooldownUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const [acceptInlineById, setAcceptInlineById] = useState<Record<string, string>>({});
  const [revokeStatus, setRevokeStatus] = useState<string>('');
  const { push } = useToast();

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('quotes:acceptCooldownUntil');
      const n = raw ? Number(raw) : 0;
      if (n > Date.now()) setAcceptCooldownUntil(n);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (acceptCooldownUntil) localStorage.setItem('quotes:acceptCooldownUntil', String(acceptCooldownUntil));
      else localStorage.removeItem('quotes:acceptCooldownUntil');
    } catch {}
  }, [acceptCooldownUntil]);

  const acceptCdLeft = acceptCooldownUntil ? Math.max(0, Math.ceil((acceptCooldownUntil - Date.now()) / 1000)) : 0;
  const acceptDisabled = acceptCdLeft > 0;

  const load = useCallback(async () => {
    if (!id) return;
    setStatus('Loading...');
    const [jr, res] = await Promise.all([
      fetch(`${API}/jobs/${id}`),
      fetch(`${API}/jobs/${id}/quotes`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const jobData = await jr.json().catch(() => null);
    const data = await res.json().catch(() => []);
    setJob(jobData);
    setQuotes(Array.isArray(data) ? data : []);
    setStatus(res.ok ? 'OK' : `Error ${res.status}`);
  }, [id, token]);

  const accept = async (quoteId: string) => {
    if (!id) return;
    if (acceptDisabled) {
      setStatus(`Accept cooldown: wait ~${acceptCdLeft}s`);
      setAcceptInlineById((m) => ({ ...m, [quoteId]: `Please wait ~${acceptCdLeft}s before trying again.` }));
      return;
    }
    setStatus('Accepting...');
    setAcceptInlineById((m) => ({ ...m, [quoteId]: '' }));
    const res = await fetch(`${API}/jobs/${id}/quotes/${quoteId}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    await load();
    if (res.status === 429) {
      const ra = res.headers.get('Retry-After');
      let ttl = 60;
      if (ra) {
        const n = parseInt(ra, 10);
        if (!isNaN(n)) ttl = n;
        else {
          const d = Date.parse(ra);
          if (!isNaN(d)) ttl = Math.max(1, Math.ceil((d - Date.now()) / 1000));
        }
      }
      const until = Date.now() + ttl * 1000;
      setAcceptCooldownUntil(until);
      setStatus(`Rate limited; wait ~${ttl}s`);
      setAcceptInlineById((m) => ({ ...m, [quoteId]: `Rate limited. Please wait ~${ttl}s before trying again.` }));
    } else {
      setStatus(res.ok ? 'Accepted' : `Error ${res.status}`);
      if (res.ok) push('Quote accepted', 'success');
      else push(`Accept failed (${res.status})`, 'error');
    }
  };

  const verifyComplete = async () => {
    if (!id) return;
    setStatus('Verifying...');
    const res = await fetch(`${API}/jobs/${id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    await load();
    setStatus(res.ok ? 'Verified' : `Error ${res.status}`);
    if (res.ok) push('Completion verified', 'success');
    else push(`Verify failed (${res.status})`, 'error');
  };

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  return (
    <div className="container">
      <h2>Quotes for Job (static) {id || '(no id)'}</h2>
      {job && (
        <div className="mb-12 text-subtle">
          <div><strong>{job.title}</strong></div>
          <div className="font-13">{job.description}</div>
          {job.assignment && (
            <div className="mt-6 font-13 text-green-strong">
              Assigned to: {job.assignment.provider?.user?.name || job.assignment.provider?.user?.email || job.assignment.providerId}
              {job.assignment.status && <span className="ml-8 text-subtle">• Status: {job.assignment.status}</span>}
              {job.assignment.customerVerifiedAt && (
                <span className="ml-8 text-blue-strong">
                  • Verified: {new Date(job.assignment.customerVerifiedAt).toLocaleString()}
                </span>
              )}
            </div>
          )}
          {job.assignment && (
            <div className="mt-8 flex gap-8 items-center">
              <button onClick={verifyComplete}>Verify completion (customer)</button>
              {revokeStatus && <span className="font-12 text-subtle">{revokeStatus}</span>}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-8 items-center">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste JWT (customer or provider)" />
        <button onClick={load}>Refresh</button>
        <span>{status}</span>
      </div>
      <div className="mt-16 grid gap-8">
        {quotes.map((q) => {
          const accepted = q.status === 'accepted';
          return (
            <div key={q.id} className={`card ${accepted ? 'bg-accepted' : ''}`}>
              <div><strong>Quote:</strong> ${'{'}q.total{'}'}</div>
              <div><strong>Status:</strong> {q.status}</div>
              <div><strong>Provider:</strong> {q.provider?.user?.name || q.provider?.user?.email || q.providerId}</div>
              <div><strong>Created:</strong> {new Date(q.createdAt).toLocaleString()}</div>
              <div className="mt-8 flex gap-8">
                {acceptInlineById[q.id] && (
                  <div className="alert alert-error">
                    {acceptInlineById[q.id]}
                  </div>
                )}
                <button onClick={() => accept(q.id)} disabled={acceptDisabled} title={acceptDisabled ? `Accept cooldown: ${acceptCdLeft}s` : 'Accept quote'}>
                  {acceptDisabled ? `Accept (cd ${acceptCdLeft}s)` : 'Accept (customer only)'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8">
        <Link href={`/jobs/${encodeURIComponent(id)}/quotes`}>Go to dynamic quotes page</Link>
      </div>
    </div>
  );
}

export default function QuotesStaticPage() {
  return (
    <Suspense fallback={<div className="container">Loading quotes...</div>}>
      <QuotesStaticContent />
    </Suspense>
  );
}
