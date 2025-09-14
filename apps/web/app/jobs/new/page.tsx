'use client';
import { useState } from 'react';
import { useLocalToken } from '../../useLocalToken';
import { useToast } from '../../components/Toast';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function NewJobPage() {
  const [title, setTitle] = useState('Leaky faucet');
  const [description, setDescription] = useState('Kitchen faucet is leaking, needs repair.');
  const [token, setToken] = useLocalToken();
  const [result, setResult] = useState<any>(null);
  const { push } = useToast();

  const submit = async () => {
    setResult('Submitting...');
    const res = await fetch(`${API}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json().catch(() => ({}));
    setResult({ ok: res.ok, status: res.status, data });
    if (res.ok) push('Job created', 'success');
    else push(`Create failed (${res.status})`, 'error');
  };

  return (
    <div className="container">
      <h2>Create Job</h2>
      <div className="grid gap-8 max-w-520">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" rows={4} />
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste CUSTOMER JWT here" />
        <button onClick={submit}>Create Job</button>
      </div>
      <pre className="pre mt-16">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
