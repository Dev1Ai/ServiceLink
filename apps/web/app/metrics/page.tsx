"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type Sample = { name: string; labels: Record<string, string>; value: number };
type FulfillmentSummary = {
  awaitingSchedule: number;
  scheduled: number;
  reminderOverdue: number;
  payoutPending: number;
};

function parseMetrics(text: string): Sample[] {
  const samples: Sample[] = [];
  const re =
    /^(?<name>[a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?<labels>\{[^}]*\})?\s+(?<value>[-+]?[0-9]*\.?[0-9]+)/;
  const lblRe = /([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g;
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const m = re.exec(line.trim());
    if (!m || !m.groups) continue;
    const name = m.groups.name;
    const value = Number(m.groups.value);
    const labels: Record<string, string> = {};
    if (m.groups.labels) {
      let lm;
      while ((lm = lblRe.exec(m.groups.labels))) {
        labels[lm[1]] = lm[2];
      }
    }
    samples.push({ name, labels, value });
  }
  return samples;
}

const INTEREST = [
  "auth_signup_total",
  "auth_login_total",
  "ws_connect_total",
  "ws_typing_total",
  "ws_chat_send_total",
  "payment_initiate_total",
  "reminder_sent_total",
  "reminder_failed_total",
] as const;
type InterestName = (typeof INTEREST)[number];

function isInterestName(x: string): x is InterestName {
  return (INTEREST as readonly string[]).includes(x);
}

function MetricsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [raw, setRaw] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [fulfillment, setFulfillment] = useState<FulfillmentSummary | null>(
    null,
  );
  const [series, setSeries] = useState<Record<
    InterestName,
    Array<{ t: number; v: number }>
  > | null>(null);
  const [showNames, setShowNames] = useState<Record<InterestName, boolean>>(
    () => {
      try {
        const saved = localStorage.getItem("metrics:show");
        if (saved) return JSON.parse(saved);
      } catch {}
      return INTEREST.reduce(
        (acc, n) => ((acc[n] = true), acc),
        {} as Record<InterestName, boolean>,
      );
    },
  );
  const [asRate, setAsRate] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("metrics:rate");
      if (saved != null) return saved === "1";
    } catch {}
    return true;
  });
  const [windowSamples, setWindowSamples] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("metrics:window");
      if (saved) return Number(saved) || 60;
    } catch {}
    return 60;
  }); // ~10m at 10s interval

  const updateSeriesFromText = useCallback(
    (text: string) => {
      const now = Date.now();
      const samples = parseMetrics(text);
      setSeries((prev) => {
        const next: Record<
          InterestName,
          Array<{ t: number; v: number }>
        > = prev ||
        (INTEREST.reduce(
          (acc, n) => ((acc[n] = [] as any), acc),
          {} as any,
        ) as Record<InterestName, Array<{ t: number; v: number }>>);
        (INTEREST as ReadonlyArray<InterestName>).forEach((name) => {
          const sum = samples
            .filter((s) => s.name === name)
            .reduce((acc, s) => acc + (isFinite(s.value) ? s.value : 0), 0);
          const prevArr = next[name] || [];
          const trimmed = prevArr.slice(-(windowSamples - 1));
          trimmed.push({ t: now, v: sum });
          next[name] = trimmed;
        });
        return { ...next };
      });
    },
    [windowSamples],
  );

  const load = useCallback(async () => {
    setStatus("Loading...");
    try {
      const [metricsRes, summaryRes] = await Promise.all([
        fetch(`${API}/metrics`, { cache: "no-store" }),
        fetch(`${API}/metrics/fulfillment-summary`, { cache: "no-store" }),
      ]);
      const text = await metricsRes.text();
      setRaw(text);
      updateSeriesFromText(text);
      if (summaryRes.ok) {
        const summary = (await summaryRes.json()) as FulfillmentSummary;
        setFulfillment(summary);
      } else {
        setFulfillment(null);
      }
      const statusParts: string[] = [];
      statusParts.push(
        metricsRes.ok ? "metrics ok" : `metrics ${metricsRes.status}`,
      );
      statusParts.push(
        summaryRes.ok ? "summary ok" : `summary ${summaryRes.status}`,
      );
      setStatus(statusParts.join(" / "));
    } catch {
      setStatus("Network error");
      setFulfillment(null);
    }
  }, [updateSeriesFromText]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [windowSamples, load]);

  // Persist UI settings
  useEffect(() => {
    try {
      localStorage.setItem("metrics:rate", asRate ? "1" : "0");
    } catch {}
  }, [asRate]);
  useEffect(() => {
    try {
      localStorage.setItem("metrics:window", String(windowSamples));
    } catch {}
  }, [windowSamples]);
  useEffect(() => {
    try {
      localStorage.setItem("metrics:show", JSON.stringify(showNames));
    } catch {}
  }, [showNames]);

  // Initialize from URL params
  useEffect(() => {
    try {
      const rate = search.get("rate");
      if (rate === "0" || rate === "1") setAsRate(rate === "1");
      const win = search.get("window");
      if (win) setWindowSamples(Number(win) || 60);
      const show = search.get("show");
      if (show) {
        const set: Record<InterestName, boolean> = INTEREST.reduce(
          (acc, n) => ((acc[n] = false), acc),
          {} as any,
        );
        show.split(",").forEach((name) => {
          if (isInterestName(name)) set[name] = true;
        });
        setShowNames(set);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Sync state to URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(search.toString());
      params.set("rate", asRate ? "1" : "0");
      params.set("window", String(windowSamples));
      const selected = (INTEREST as ReadonlyArray<InterestName>).filter(
        (n) => showNames[n],
      );
      if (selected.length === INTEREST.length) params.delete("show");
      else params.set("show", selected.join(","));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {}
  }, [asRate, windowSamples, showNames, pathname, router, search]);

  const parsed = useMemo(() => parseMetrics(raw), [raw]);
  const filtered = useMemo(
    () =>
      parsed.filter(
        (s) => isInterestName(s.name) && Object.keys(s.labels).length <= 2,
      ),
    [parsed],
  );
  const summaryItems = useMemo(() => {
    if (!fulfillment) return [];
    return [
      {
        key: "awaiting",
        label: "Awaiting Schedule",
        value: fulfillment.awaitingSchedule,
      },
      { key: "scheduled", label: "Scheduled", value: fulfillment.scheduled },
      {
        key: "overdue",
        label: "Reminder Overdue",
        value: fulfillment.reminderOverdue,
      },
      {
        key: "payout",
        label: "Payout Pending",
        value: fulfillment.payoutPending,
      },
    ];
  }, [fulfillment]);

  return (
    <div className="container font-sans">
      <h2 className="flex items-center gap-12">
        Metrics <span className="font-12 text-muted">{status}</span>
      </h2>
      {summaryItems.length > 0 && (
        <div className="grid gap-12 mt-12 summary-grid">
          {summaryItems.map((item) => (
            <SummaryCard key={item.key} label={item.label} value={item.value} />
          ))}
        </div>
      )}
      {/* Simple canvas charts */}
      <div className="controls">
        <label>
          <input
            type="checkbox"
            checked={asRate}
            onChange={(e) => setAsRate(e.target.checked)}
          />{" "}
          show rate (per sec)
        </label>
        <label>
          window:
          <select
            value={windowSamples}
            onChange={(e) => setWindowSamples(Number(e.target.value))}
          >
            <option value={12}>~2m</option>
            <option value={30}>~5m</option>
            <option value={60}>~10m</option>
            <option value={120}>~20m</option>
          </select>
        </label>
        <span className="text-muted font-12">(interval: 10s)</span>
      </div>
      <div className="grid-cards">
        {(INTEREST as ReadonlyArray<InterestName>).map((name) => (
          <div key={name}>
            <label className="inline-flex gap-6 items-center">
              <input
                type="checkbox"
                checked={!!showNames[name]}
                onChange={(e) =>
                  setShowNames((s) => ({ ...s, [name]: e.target.checked }))
                }
              />
              {name}
            </label>
            {showNames[name] && (
              <MiniChart
                title={name + (asRate ? " (rate)" : "")}
                data={(series?.[name] || []).map((p, i, arr) => {
                  if (!asRate) return p;
                  if (i === 0) return { t: p.t, v: 0 };
                  const dt = (p.t - arr[i - 1].t) / 1000;
                  const dv = p.v - arr[i - 1].v;
                  const rate = dt > 0 && dv >= 0 ? dv / dt : 0;
                  return { t: p.t, v: rate };
                })}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-12">
        <table className="table">
          <thead>
            <tr>
              <th className="th">metric</th>
              <th className="th">labels</th>
              <th className="th td-right">value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={`${s.name}-${i}`}>
                <td className="td">{s.name}</td>
                <td className="td text-subtle">
                  {Object.keys(s.labels).length
                    ? Object.entries(s.labels)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")
                    : "—"}
                </td>
                <td className="td td-right">{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-16">
        <button onClick={load}>Refresh</button>
      </div>
      <details className="mt-16">
        <summary>Raw metrics</summary>
        <pre className="pre">{raw}</pre>
      </details>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="font-12 text-muted">{label}</div>
      <div className="font-28 font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function MiniChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ t: number; v: number }>;
}) {
  const canvasRef = useState<HTMLCanvasElement | null>(null)[0] as any;
  const [ref, setRef] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ref) return;
    const ctx = ref.getContext("2d");
    if (!ctx) return;
    const W = ref.width;
    const H = ref.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#111827";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(title, 8, 14);
    if (!data || data.length < 2) return;
    const ys = data.map((p) => p.v);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const pad = 6;
    const x0 = pad;
    const y0 = H - pad;
    const Wp = W - pad * 2;
    const Hp = H - pad * 2 - 10; // leave title space
    const toX = (i: number) => x0 + (i / (data.length - 1)) * Wp;
    const toY = (v: number) =>
      y0 - (max === min ? 0.5 : (v - min) / (max - min)) * Hp;
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((p, i) => {
      const x = toX(i);
      const y = toY(p.v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // draw min/max labels
    ctx.fillStyle = "#6b7280";
    ctx.fillText(`min ${min.toFixed(2)}`, 8, H - 4);
    ctx.fillText(`max ${max.toFixed(2)}`, W - 100, 14);
  }, [ref, data, title]);

  return (
    <div className="card-tight">
      <canvas ref={setRef as any} width={360} height={120} />
    </div>
  );
}

export default function MetricsPage() {
  return (
    <Suspense fallback={<div className="container">Loading metrics...</div>}>
      <MetricsPageContent />
    </Suspense>
  );
}
