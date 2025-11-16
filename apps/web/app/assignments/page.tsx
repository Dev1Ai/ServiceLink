"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocalToken } from "../useLocalToken";
import { useToast } from "../components/Toast";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function AssignmentsPage() {
  const [token, setToken] = useLocalToken();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    setStatus("Loading...");
    const res = await fetch(`${API}/providers/assignments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => []);
    setItems(Array.isArray(data) ? data : []);
    setStatus(res.ok ? "OK" : `Error ${res.status}`);
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const complete = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`${API}/providers/assignments/${id}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) push("Assignment marked complete", "success");
      else push(`Complete failed (${res.status})`, "error");
    } catch {
      push("Network error while completing", "error");
    }
    setBusy(null);
    await load();
  };

  return (
    <div className="container">
      <h2>My Assignments (Provider)</h2>
      <div className="flex gap-8 items-center">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste PROVIDER JWT here"
        />
        <button onClick={load}>Refresh</button>
        <span>{status}</span>
      </div>
      <div className="mt-16 grid gap-8">
        {items.map((a) => (
          <div key={a.id} className="card">
            <div>
              <strong>Job:</strong> {a.job?.title || a.job?.key}
            </div>
            <div className="text-muted">{a.job?.description}</div>
            <div className="font-12 text-faint">
              Accepted: {new Date(a.acceptedAt).toLocaleString()}
            </div>
            {a.job?.id && (
              <div className="mt-8">
                <Link href={`/jobs/${a.job.id}/quotes`}>View job quotes</Link>
                {a.job?.key && (
                  <>
                    {" "}
                    •{" "}
                    <Link
                      href={`/realtime?room=${encodeURIComponent("job:" + a.job.key)}`}
                    >
                      Open chat
                    </Link>
                  </>
                )}
              </div>
            )}
            <div className="mt-8">
              <button onClick={() => complete(a.id)} disabled={busy === a.id}>
                {busy === a.id ? "Completing..." : "Mark complete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
