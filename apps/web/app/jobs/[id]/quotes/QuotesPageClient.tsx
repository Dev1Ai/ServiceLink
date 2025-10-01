'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalToken } from '../../../useLocalToken';
import { useToast } from '../../../components/Toast';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

type Quote = {
  id: string;
  jobId: string;
  providerId: string;
  total: number;
  status: string;
  createdAt: string;
  provider?: { user?: { name?: string | null; email?: string | null } };
};

type AssignmentResponse = {
  id: string;
  providerId: string;
  provider?: { user?: { name?: string | null; email?: string | null } };
  status?: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  scheduleVersion?: number;
  scheduleProposedBy?: string | null;
  scheduleProposedAt?: string | null;
  scheduleNotes?: string | null;
  reminderStatus?: string | null;
  reminderLastSentAt?: string | null;
  reminderCount?: number | null;
  payoutStatus?: string | null;
  customerVerifiedAt?: string | null;
  rejectedAt?: string | null;
};

type JobResponse = {
  id: string;
  title: string;
  description: string;
  assignment?: AssignmentResponse | null;
};

const decodeJwtRole = (token: string): string => {
  if (typeof window === 'undefined' || !token || token.split('.').length < 2) return '';
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    const data = JSON.parse(decoded);
    const role = data?.role || data?.Role;
    if (typeof role === 'string') return role.toUpperCase();
  } catch (err) {
    console.warn('Failed to decode JWT payload', err);
  }
  return '';
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function QuotesPageClient({ params }: { params: { id: string } }) {
  const { id } = params;
  const isPlaceholder = id === 'example-static';
  const [token, setToken] = useLocalToken();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [status, setStatus] = useState(isPlaceholder ? 'Static export placeholder' : '');
  const [job, setJob] = useState<JobResponse | null>(null);
  const [acceptCooldownUntil, setAcceptCooldownUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const [acceptInlineById, setAcceptInlineById] = useState<Record<string, string>>({});
  const [revokeStatus, setRevokeStatus] = useState<string>('');
  const [scheduleStatus, setScheduleStatus] = useState<string>('');
  const [customerStart, setCustomerStart] = useState('');
  const [customerEnd, setCustomerEnd] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [providerStart, setProviderStart] = useState('');
  const [providerEnd, setProviderEnd] = useState('');
  const [providerNotes, setProviderNotes] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const { push } = useToast();
  const role = useMemo(() => decodeJwtRole(token), [token]);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isPlaceholder) return;
    try {
      const raw = localStorage.getItem('quotes:acceptCooldownUntil');
      const n = raw ? Number(raw) : 0;
      if (n > Date.now()) setAcceptCooldownUntil(n);
    } catch {}
  }, [isPlaceholder]);

  useEffect(() => {
    if (isPlaceholder) return;
    try {
      if (acceptCooldownUntil) localStorage.setItem('quotes:acceptCooldownUntil', String(acceptCooldownUntil));
      else localStorage.removeItem('quotes:acceptCooldownUntil');
    } catch {}
  }, [acceptCooldownUntil, isPlaceholder]);

  const acceptCdLeft = acceptCooldownUntil ? Math.max(0, Math.ceil((acceptCooldownUntil - Date.now()) / 1000)) : 0;
  const acceptDisabled = acceptCdLeft > 0 || isPlaceholder;

  const load = useCallback(async () => {
    if (isPlaceholder) return;
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
  }, [id, token, isPlaceholder]);

  const accept = async (quoteId: string) => {
    if (isPlaceholder) {
      setStatus('Static export placeholder — accepting quotes is disabled.');
      setAcceptInlineById((m) => ({ ...m, [quoteId]: 'Unavailable in static export; use /jobs/quotes?id=YOUR_JOB_ID.' }));
      return;
    }
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
    if (isPlaceholder) {
      setStatus('Static export placeholder — verifying completion is disabled.');
      return;
    }
    setStatus('Verifying...');
    const res = await fetch(`${API}/jobs/${id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    await load();
    setStatus(res.ok ? 'Verified' : `Error ${res.status}`);
    if (res.ok) push('Completion verified', 'success');
    else push(`Verify failed (${res.status})`, 'error');
  };

  const revokeAcceptance = async () => {
    if (isPlaceholder) {
      setRevokeStatus('Unavailable in static export. Use /jobs/quotes?id=YOUR_JOB_ID.');
      return;
    }
    if (acceptDisabled) {
      setRevokeStatus(`Revoke cooldown: wait ~${acceptCdLeft}s`);
      return;
    }
    setRevokeStatus('Revoking...');
    const res = await fetch(`${API}/jobs/${id}/quotes/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
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
      setRevokeStatus(`Rate limited; wait ~${ttl}s`);
    } else {
      setRevokeStatus(res.ok ? 'Revoked' : `Error ${res.status}`);
      if (res.ok) push('Acceptance revoked', 'success');
      else push(`Revoke failed (${res.status})`, 'error');
    }
  };

  const proposeSchedule = async (actor: 'CUSTOMER' | 'PROVIDER') => {
    if (isPlaceholder) {
      setScheduleStatus('Static export placeholder — scheduling disabled.');
      return;
    }
    const assignmentId = job?.assignment?.id;
    if (!assignmentId) {
      setScheduleStatus('No assignment available. Accept a quote first.');
      return;
    }
    const startValue = actor === 'CUSTOMER' ? customerStart : providerStart;
    const endValue = actor === 'CUSTOMER' ? customerEnd : providerEnd;
    const notesValue = actor === 'CUSTOMER' ? customerNotes : providerNotes;
    if (!startValue || !endValue) {
      setScheduleStatus('Provide both start and end times.');
      return;
    }
    const version = job?.assignment?.scheduleVersion ?? 0;
    setScheduleStatus('Submitting schedule...');
    const payload: Record<string, unknown> = {
      start: new Date(startValue).toISOString(),
      end: new Date(endValue).toISOString(),
      version,
    };
    if (notesValue) payload.notes = notesValue;
    const path =
      actor === 'CUSTOMER'
        ? `${API}/jobs/${id}/schedule`
        : `${API}/assignments/${assignmentId}/schedule`;
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      if (actor === 'CUSTOMER') {
        setCustomerNotes('');
      } else {
        setProviderNotes('');
      }
      await load();
      setScheduleStatus('Schedule proposed successfully.');
    } else {
      const message = await res.text().catch(() => res.statusText);
      setScheduleStatus(`Schedule request failed (${res.status}): ${message}`);
    }
  };

  const confirmSchedule = async () => {
    if (isPlaceholder) {
      setScheduleStatus('Static export placeholder — scheduling disabled.');
      return;
    }
    const assignmentId = job?.assignment?.id;
    if (!assignmentId) {
      setScheduleStatus('No assignment available to confirm.');
      return;
    }
    setScheduleStatus('Confirming schedule...');
    const res = await fetch(`${API}/assignments/${assignmentId}/schedule/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        version: job?.assignment?.scheduleVersion ?? 0,
        notes: confirmNotes || undefined,
      }),
    });
    if (res.ok) {
      setConfirmNotes('');
      await load();
      setScheduleStatus('Schedule confirmed.');
    } else {
      const message = await res.text().catch(() => res.statusText);
      setScheduleStatus(`Confirm failed (${res.status}): ${message}`);
    }
  };

  const rejectAssignment = async () => {
    if (isPlaceholder) {
      setScheduleStatus('Static export placeholder — scheduling disabled.');
      return;
    }
    const assignmentId = job?.assignment?.id;
    if (!assignmentId) {
      setScheduleStatus('No assignment available to reject.');
      return;
    }
    setScheduleStatus('Rejecting assignment...');
    const res = await fetch(`${API}/assignments/${assignmentId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: rejectReason || undefined }),
    });
    if (res.ok) {
      setRejectReason('');
      await load();
      setScheduleStatus('Assignment rejected — job reopened for quotes.');
    } else {
      const message = await res.text().catch(() => res.statusText);
      setScheduleStatus(`Reject failed (${res.status}): ${message}`);
    }
  };

  const scheduleVersion = job?.assignment?.scheduleVersion ?? 0;
  const scheduledWindow =
    job?.assignment?.scheduledStart && job?.assignment?.scheduledEnd
      ? `${formatDate(job.assignment.scheduledStart)} → ${formatDate(job.assignment.scheduledEnd)}`
      : 'Not scheduled yet';
  const canConfirm =
    !!job?.assignment?.scheduledStart &&
    !!job.assignment?.scheduledEnd &&
    (role === 'CUSTOMER' || role === 'PROVIDER');

  useEffect(() => {
    if (token && !isPlaceholder) load();
  }, [token, load, isPlaceholder]);

  return (
    <div className="container">
      <h2>Quotes for Job {isPlaceholder ? '(static placeholder)' : id}</h2>
      {isPlaceholder && (
        <div className="alert alert-error">
          Static export placeholder — use /jobs/quotes?id=YOUR_JOB_ID when hosting the export.
        </div>
      )}
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
                  • Verified: {formatDate(job.assignment.customerVerifiedAt)}
                </span>
              )}
              {job.assignment.rejectedAt && (
                <span className="ml-8 text-error">
                  • Rejected: {formatDate(job.assignment.rejectedAt)}
                </span>
              )}
            </div>
          )}
          {job.assignment && (
            <div className="mt-8 card border p-12 bg-muted">
              <h3 className="font-15 mb-8">Scheduling</h3>
              <div className="font-13 grid gap-4">
                <div><strong>Window:</strong> {scheduledWindow}</div>
                <div><strong>Version:</strong> {scheduleVersion}</div>
                <div>
                  <strong>Last proposed:</strong>{' '}
                  {job.assignment.scheduleProposedBy
                    ? `${job.assignment.scheduleProposedBy} @ ${formatDate(job.assignment.scheduleProposedAt)}`
                    : '—'}
                </div>
                {job.assignment.scheduleNotes && <div><strong>Notes:</strong> {job.assignment.scheduleNotes}</div>}
                <div>
                  <strong>Reminder:</strong> {job.assignment.reminderStatus || 'N/A'}{' '}
                  {typeof job.assignment.reminderCount === 'number' && `(count ${job.assignment.reminderCount})`}
                </div>
                {job.assignment.reminderLastSentAt && (
                  <div><strong>Reminder last sent:</strong> {formatDate(job.assignment.reminderLastSentAt)}</div>
                )}
                {job.assignment.payoutStatus && <div><strong>Payout status:</strong> {job.assignment.payoutStatus}</div>}
              </div>
              {scheduleStatus && <div className="alert mt-8">{scheduleStatus}</div>}
              {role === 'CUSTOMER' && job.assignment.status !== 'provider_rejected' && (
                <div className="mt-12 grid gap-8">
                  <h4 className="font-14">Propose visit window (customer)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <label className="grid gap-4">
                      <span>Start</span>
                      <input type="datetime-local" value={customerStart} onChange={(e) => setCustomerStart(e.target.value)} />
                    </label>
                    <label className="grid gap-4">
                      <span>End</span>
                      <input type="datetime-local" value={customerEnd} onChange={(e) => setCustomerEnd(e.target.value)} />
                    </label>
                  </div>
                  <label className="grid gap-4">
                    <span>Notes (optional)</span>
                    <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={3} />
                  </label>
                  <button onClick={() => proposeSchedule('CUSTOMER')} disabled={isPlaceholder}>Submit schedule proposal</button>
                </div>
              )}
              {role === 'PROVIDER' && job.assignment.status !== 'provider_rejected' && (
                <div className="mt-12 grid gap-8">
                  <h4 className="font-14">Propose visit window (provider)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <label className="grid gap-4">
                      <span>Start</span>
                      <input type="datetime-local" value={providerStart} onChange={(e) => setProviderStart(e.target.value)} />
                    </label>
                    <label className="grid gap-4">
                      <span>End</span>
                      <input type="datetime-local" value={providerEnd} onChange={(e) => setProviderEnd(e.target.value)} />
                    </label>
                  </div>
                  <label className="grid gap-4">
                    <span>Notes (optional)</span>
                    <textarea value={providerNotes} onChange={(e) => setProviderNotes(e.target.value)} rows={3} />
                  </label>
                  <button onClick={() => proposeSchedule('PROVIDER')} disabled={isPlaceholder}>Submit schedule proposal</button>
                </div>
              )}
              {canConfirm && job.assignment.status !== 'provider_rejected' && (
                <div className="mt-12 grid gap-6">
                  <h4 className="font-14">Confirm scheduled window</h4>
                  <label className="grid gap-4">
                    <span>Confirmation notes (optional)</span>
                    <textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} rows={2} />
                  </label>
                  <button onClick={confirmSchedule} disabled={isPlaceholder}>Confirm schedule</button>
                </div>
              )}
              {role === 'PROVIDER' && job.assignment.status !== 'provider_rejected' && (
                <div className="mt-12 grid gap-6">
                  <h4 className="font-14 text-error">Reject assignment</h4>
                  <label className="grid gap-4">
                    <span>Reason (optional)</span>
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} />
                  </label>
                  <button className="btn btn-danger" onClick={rejectAssignment} disabled={isPlaceholder}>
                    Reject assignment and reopen job
                  </button>
                </div>
              )}
            </div>
          )}
          {job.assignment && (
            <div className="mt-8 flex gap-8 items-center">
              <button onClick={revokeAcceptance} disabled={acceptDisabled} title={acceptDisabled ? `Revoke cooldown: ${acceptCdLeft}s` : 'Revoke accepted quote'}>
                {acceptDisabled ? `Revoke acceptance (cd ${acceptCdLeft}s)` : 'Revoke acceptance (customer)'}
              </button>
              {revokeStatus && <span className="font-12 text-subtle">{revokeStatus}</span>}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-8 items-center">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste JWT (customer or provider)" disabled={isPlaceholder} />
        <button
          onClick={() => {
            setScheduleStatus('');
            load();
          }}
          disabled={isPlaceholder}
        >
          Refresh
        </button>
        <span>{status}</span>
      </div>
      <div className="mt-16">
        <button onClick={verifyComplete} disabled={isPlaceholder}>Customer: Verify completion</button>
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
                <button
                  onClick={() => accept(q.id)}
                  disabled={acceptDisabled}
                  title={acceptDisabled ? (isPlaceholder ? 'Unavailable in static export' : `Accept cooldown: ${acceptCdLeft}s`) : 'Accept quote'}
                >
                  {acceptDisabled ? (isPlaceholder ? 'Unavailable in static export' : `Accept (cd ${acceptCdLeft}s)`) : 'Accept quote'}
                </button>
              </div>
            </div>
          );
        })}
        {quotes.length === 0 && <div className="text-subtle">No quotes yet.</div>}
      </div>
    </div>
  );
}
