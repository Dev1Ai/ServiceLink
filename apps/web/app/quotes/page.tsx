"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocalToken } from "../useLocalToken";
import { useToast } from "../components/Toast";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function MyQuotesPage() {
  const [token, setToken] = useLocalToken();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const { push } = useToast();

  const load = useCallback(async () => {
    setStatus("Loading...");
    const res = await fetch(`${API}/providers/quotes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => []);
    setItems(Array.isArray(data) ? data : []);
    if (res.ok) {
      setStatus("OK");
    } else {
      setStatus(`Error ${res.status}`);
      push(`Failed to load quotes (${res.status})`, "error");
    }
  }, [token, push]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  return (
    <div className="container">
      <h2>My Quotes (Provider)</h2>
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
        {items.map((q) => (
          <div key={q.id} className="card">
            <div>
              <strong>Job:</strong> {q.job?.title || q.job?.key}
            </div>
            <div className="text-muted">{q.job?.description}</div>
            <div>
              <strong>Total:</strong> ${"{"}q.total{"}"} •{" "}
              <strong>Status:</strong> {q.status}
            </div>
            <div className="font-12 text-faint">
              {new Date(q.createdAt).toLocaleString()}
            </div>
            <div className="mt-8">
              {q.job?.id && (
                <Link href={`/jobs/${q.job.id}/quotes`}>View job quotes</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
