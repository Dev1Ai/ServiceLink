'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalToken } from '../../useLocalToken';
import { useToast } from '../../components/Toast';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

type Assignment = {
  id: string;
  jobId: string;
  payoutStatus: string;
  payoutApprovedAt: string | null;
  payoutApprovedBy: string | null;
  status: string;
  customerVerifiedAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  reminderStatus: string | null;
  job?: {
    id: string;
    title: string | null;
    description: string | null;
    customer?: {
      id: string;
      email: string | null;
      profile?: { firstName: string | null; lastName: string | null } | null;
    } | null;
  } | null;
  provider?: {
    id: string;
    user?: {
      email: string | null;
      profile?: { firstName: string | null; lastName: string | null } | null;
    } | null;
  } | null;
};

const formatName = (entry?: { email: string | null; profile?: { firstName: string | null; lastName: string | null } | null } | null) => {
  if (!entry) return '—';
  const first = entry.profile?.firstName;
  const last = entry.profile?.lastName;
  const full = [first, last].filter(Boolean).join(' ');
  return full || entry.email || '—';
};

export default function AdminPayoutsPage() {
  const [token, setToken] = useLocalToken();
  const { push } = useToast();
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<Assignment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      setStatus('Provide admin JWT');
      return;
    }
    setStatus('Loading...');
    try {
      const res = await fetch(`${API}/payments/payouts/pending`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setStatus(`Error ${res.status}`);
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? data : []);
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0}`);
    } catch (err) {
      console.error(err);
      setStatus('Network error');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const takeAction = async (assignmentId: string, action: 'approve' | 'deny') => {
    if (!token) return;
    setBusy(assignmentId);
    try {
      const res = await fetch(`${API}/payments/payouts/${assignmentId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action === 'deny' ? { reason: 'manual review' } : {}),
      });
      if (res.ok) {
        push(`Payout ${action}d`, 'success');
      } else {
        const text = await res.text().catch(() => '');
        push(`Payout ${action} failed (${res.status}) ${text}`, 'error');
      }
    } catch (err) {
      console.error(err);
      push(`Network error while attempting to ${action}`, 'error');
    }
    setBusy(null);
    await load();
  };

  const totalPending = items.length;

  const summaryItems = useMemo(
    () => [
      { label: 'Pending approvals', value: totalPending },
    ],
    [totalPending],
  );

  return (
    <div className="container">
      <h2>Manual Payout Approvals</h2>
      <p className="text-muted font-13">Use an admin JWT to review assignments awaiting manual payouts.</p>
      <div className="flex gap-8 items-center mt-8">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste ADMIN JWT" />
        <button onClick={load}>Refresh</button>
        <span className="font-12 text-muted">{status}</span>
      </div>
      <div className="mt-16 grid gap-12 cards-kpi">
        {summaryItems.map((card) => (
          <div key={card.label} className="card">
            <div className="font-12 text-muted">{card.label}</div>
            <div className="font-32 font-semibold">{card.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-16 grid gap-12">
        {items.length === 0 && <div className="text-muted">No assignments awaiting approval.</div>}
        {items.map((assignment) => {
          const customerName = formatName(assignment.job?.customer);
          const providerName = formatName(assignment.provider?.user || null);
          return (
            <div key={assignment.id} className="card">
              <div className="flex justify-between gap-12">
                <div>
                  <div className="font-semibold">{assignment.job?.title || 'Untitled Job'}</div>
                  <div className="text-muted font-13">{assignment.job?.description || 'No description provided.'}</div>
                  <div className="font-12 text-muted mt-4">Assignment ID: {assignment.id}</div>
                  <div className="font-12 text-muted">Job ID: {assignment.jobId}</div>
                  <div className="font-12 text-muted">Customer: {customerName}</div>
                  <div className="font-12 text-muted">Provider: {providerName}</div>
                </div>
                <div className="text-right font-12 text-muted">
                  <div>Status: {assignment.status}</div>
                  <div>Payout status: {assignment.payoutStatus}</div>
                  <div>Reminder: {assignment.reminderStatus || '—'}</div>
                  <div>Scheduled start: {assignment.scheduledStart ? new Date(assignment.scheduledStart).toLocaleString() : '—'}</div>
                  <div>Customer verified: {assignment.customerVerifiedAt ? new Date(assignment.customerVerifiedAt).toLocaleString() : '—'}</div>
                </div>
              </div>
              <div className="mt-12 flex gap-12">
                <button onClick={() => takeAction(assignment.id, 'approve')} disabled={busy === assignment.id}>
                  {busy === assignment.id ? 'Approving…' : 'Approve'}
                </button>
                <button className="btn btn-danger" onClick={() => takeAction(assignment.id, 'deny')} disabled={busy === assignment.id}>
                  {busy === assignment.id ? 'Denying…' : 'Deny'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
