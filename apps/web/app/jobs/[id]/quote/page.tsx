'use client';
import { useEffect, useState } from 'react';
import { useLocalToken } from '../../../useLocalToken';
import { useToast } from '../../../components/Toast';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function QuoteFormPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [token, setToken] = useLocalToken();
  const [total, setTotal] = useState('150');
  const [result, setResult] = useState<any>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const [inlineMsg, setInlineMsg] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('quote:submitCooldownUntil');
      const n = raw ? Number(raw) : 0;
      if (n > Date.now()) setCooldownUntil(n);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (cooldownUntil) localStorage.setItem('quote:submitCooldownUntil', String(cooldownUntil));
      else localStorage.removeItem('quote:submitCooldownUntil');
    } catch {}
  }, [cooldownUntil]);

  const cdLeft = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;
  const disabled = cdLeft > 0;

  const submit = async () => {
    if (disabled) {
      setResult({ ok: false, status: 429, message: `Cooldown active; wait ~${cdLeft}s` });
      setInlineMsg(`Rate limited. Please wait ~${cdLeft}s before submitting again.`);
      push('Rate limited: please wait', 'error');
      return;
    }
    setResult('Submitting...');
    setInlineMsg(null);
    const res = await fetch(`${API}/jobs/${id}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ total: Number(total) }),
    });
    const data = await res.json().catch(() => ({}));
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
      setCooldownUntil(until);
      setResult({ ok: false, status: 429, message: `Rate limited; wait ~${ttl}s`, data });
      setInlineMsg(`Rate limited. Please wait ~${ttl}s before submitting again.`);
      push(`Quote limited: wait ~${ttl}s`, 'error');
      return;
    }
    setResult({ ok: res.ok, status: res.status, data });
    if (res.ok) push('Quote submitted', 'success');
    else push(`Quote failed (${res.status})`, 'error');
  };

  return (
    <div className="container">
      <h2>Provider: Quote Job {id}</h2>
      <div className="grid gap-8 max-w-420">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste PROVIDER JWT here" />
        <input value={total} onChange={(e) => setTotal(e.target.value)} placeholder="total (USD cents)" />
        {inlineMsg && (
          <div className="alert alert-error">
            {inlineMsg}
          </div>
        )}
        <button onClick={submit} disabled={disabled} title={disabled ? `Submit cooldown: ${cdLeft}s` : 'Submit quote'}>
          {disabled ? `Submit Quote (cd ${cdLeft}s)` : 'Submit Quote'}
        </button>
      </div>
      <pre className="pre mt-16">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

// Allow static export by returning an empty params list. This route is server-only.
// Note: dynamic route is not exported. Use /jobs/quote?id=... for static-friendly.
