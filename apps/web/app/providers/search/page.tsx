"use client";
import { useCallback, useEffect, useState } from "react";
import { TooltipInfo } from "../../components/TooltipInfo";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type Prov = {
  id: string;
  user?: { name?: string; email?: string };
  online?: boolean;
  services?: Array<{
    id: string;
    name: string;
    price?: number;
    description?: string;
  }>;
};

export default function ProvidersSearchPage() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("");
  const [q, setQ] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<"price" | "online">("price");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [take, setTake] = useState(25);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Prov[]>([]);
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [services, setServices] = useState<
    Array<{ name: string; count: number }>
  >([]);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<
    Array<{ slug: string; label: string }>
  >([]);

  const search = useCallback(async () => {
    setStatus("Searching...");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (onlineOnly) params.set("onlineOnly", "true");
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    params.set("page", String(page));
    params.set("take", String(take));
    params.set("sort", sort);
    params.set("order", order);
    if (lat) params.set("lat", lat);
    if (lng) params.set("lng", lng);
    if (radiusKm) params.set("radiusKm", radiusKm);
    if (service) params.set("service", service);
    if (category) params.set("category", category);
    const res = await fetch(`${API}/providers/search?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    const arr = Array.isArray(data) ? data : data.items || [];
    setItems(arr);
    setHasNext(Boolean(data && data.hasNext));
    setTotal(Number((data && data.total) || arr.length || 0));
    setStatus(res.ok ? "OK" : `Error ${res.status}`);
    if (typeof window !== "undefined") {
      const queryString = params.toString();
      const nextUrl = queryString
        ? `/providers/search?${queryString}`
        : "/providers/search";
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.replaceState(null, "", nextUrl);
      }
    }
  }, [
    q,
    onlineOnly,
    minPrice,
    maxPrice,
    page,
    take,
    sort,
    order,
    lat,
    lng,
    radiusKm,
    service,
    category,
  ]);

  const geo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
    });
  };

  const geo10 = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
      setRadiusKm("10");
      setPage(1);
      setTimeout(search, 0);
    });
  };

  useEffect(() => {
    search();
  }, [search]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/providers/services`);
        const data = await res.json();
        if (Array.isArray(data)) setServices(data);
      } catch {}
    })();
    (async () => {
      try {
        const res = await fetch(`${API}/providers/categories`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const flatten = (
            nodes: any[],
            prefix = "",
          ): Array<{ slug: string; label: string }> => {
            const out: Array<{ slug: string; label: string }> = [];
            for (const n of nodes) {
              const label = prefix ? `${prefix} › ${n.name}` : n.name;
              out.push({ slug: n.slug, label });
              if (Array.isArray(n.children) && n.children.length)
                out.push(...flatten(n.children, label));
            }
            return out;
          };
          setCategories(flatten(data));
        }
      } catch {}
    })();
  }, []);
  // Load/save filters to localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("providers:search:filters");
      if (raw) {
        const f = JSON.parse(raw);
        if (typeof f.lat === "string") setLat(f.lat);
        if (typeof f.lng === "string") setLng(f.lng);
        if (typeof f.radiusKm === "string") setRadiusKm(f.radiusKm);
        if (typeof f.q === "string") setQ(f.q);
        if (typeof f.onlineOnly === "boolean") setOnlineOnly(f.onlineOnly);
        if (typeof f.minPrice === "string") setMinPrice(f.minPrice);
        if (typeof f.maxPrice === "string") setMaxPrice(f.maxPrice);
        if (f.sort === "price" || f.sort === "online") setSort(f.sort);
        if (f.order === "asc" || f.order === "desc") setOrder(f.order);
        if (Number.isFinite(f.page)) setPage(Math.max(1, Number(f.page)));
        if (Number.isFinite(f.take))
          setTake(Math.max(1, Math.min(100, Number(f.take))));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const f = {
        lat,
        lng,
        radiusKm,
        q,
        onlineOnly,
        minPrice,
        maxPrice,
        sort,
        order,
        page,
        take,
        service,
        category,
      };
      localStorage.setItem("providers:search:filters", JSON.stringify(f));
    } catch {}
  }, [
    lat,
    lng,
    radiusKm,
    q,
    onlineOnly,
    minPrice,
    maxPrice,
    sort,
    order,
    page,
    take,
    service,
    category,
  ]);

  return (
    <div className="container">
      <h2>Providers Search</h2>
      <div className="map-frame">
        <LeafletMap
          providers={items as any}
          myLat={parseFloat(lat)}
          myLng={parseFloat(lng)}
          radiusKm={parseFloat(radiusKm)}
        />
      </div>
      <div className="grid-6 items-center max-w-1000">
        <input
          className="col-span-2"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="lat (optional)"
        />
        <input
          className="col-span-2"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="lng (optional)"
        />
        <div className="col-span-1 flex items-center gap-6">
          <input
            className="flex-1"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            placeholder="radius km"
          />
          <TooltipInfo
            trigger="click"
            placement="top"
            theme="light"
            text={
              "When lat/lng are set, radius filters results\nwithin the specified distance of your location."
            }
          />
        </div>
        <div className="col-span-2 flex gap-8">
          <button onClick={geo}>Use current location</button>
          <button onClick={geo10}>Use my location + 10km</button>
        </div>
        <input
          className="col-span-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="service contains"
        />
        <select
          className="col-span-1"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">any category</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className="col-span-1"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          <option value="">any service</option>
          {services.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.count})
            </option>
          ))}
        </select>
        <label className="col-span-1 flex gap-6 items-center">
          <input
            type="checkbox"
            checked={onlineOnly}
            onChange={(e) => setOnlineOnly(e.target.checked)}
          />{" "}
          online only
          <TooltipInfo
            trigger="click"
            placement="top"
            theme="light"
            text={"Show only providers currently marked online."}
          />
        </label>
        <div className="col-span-6 font-12 text-muted">
          <TooltipInfo
            trigger="click"
            placement="top"
            theme="light"
            text={
              "Service filters by a specific service name;\nCategory filters by a broader group of services."
            }
          />
          <span className="ml-8">
            Tip: combine category and service for precise results.
          </span>
        </div>
        <input
          className="col-span-1"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          placeholder="min price"
        />
        <input
          className="col-span-1"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="max price"
        />
        <select
          className="col-span-1"
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
        >
          <option value="price">price</option>
          <option value="online">online</option>
        </select>
        <select
          className="col-span-1"
          value={order}
          onChange={(e) => setOrder(e.target.value as any)}
        >
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
        <button
          className="col-span-1"
          onClick={() => {
            setPage(1);
            search();
          }}
        >
          Search
        </button>
        <button
          className="col-span-1"
          onClick={() => {
            setLat("");
            setLng("");
            setRadiusKm("");
            setQ("");
            setOnlineOnly(false);
            setMinPrice("");
            setMaxPrice("");
            setSort("price");
            setOrder("asc");
            setService("");
            setCategory("");
            setPage(1);
            setTimeout(search, 0);
          }}
        >
          Clear filters
        </button>
        <span className="col-span-1 text-muted font-12">{status}</span>
        <div className="col-span-3 flex gap-8 items-center">
          <button
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              setTimeout(search, 0);
            }}
          >
            Prev
          </button>
          <span className="font-12 text-muted">
            Page {page} • Total {total}
          </span>
          <button
            disabled={!hasNext}
            onClick={() => {
              setPage((p) => p + 1);
              setTimeout(search, 0);
            }}
          >
            Next
          </button>
          <select
            value={take}
            onChange={(e) => {
              setTake(parseInt(e.target.value));
              setPage(1);
              setTimeout(search, 0);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-16 grid gap-8">
        {items.map((p: any) => (
          <div key={p.id} className="card">
            <div className="flex justify-between items-center gap-8">
              <strong>{p.user?.name || p.user?.email || p.id}</strong>
              <div className="flex gap-6 flex-wrap">
                {p.online && <span className="chip chip-success">online</span>}
                {p.minServicePrice != null && isFinite(p.minServicePrice) && (
                  <span className="chip chip-warn">
                    from ${((p.minServicePrice || 0) / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            {/* Service chips */}
            <div className="font-13 text-muted mt-4 flex gap-6 flex-wrap">
              {(p.services || []).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setService(s.name as string);
                    setPage(1);
                    setTimeout(search, 0);
                  }}
                  className="chip chip-neutral cursor-pointer"
                  aria-label={`Filter by service ${s.name}`}
                  title={
                    s.price != null ? `$${(s.price / 100).toFixed(2)}` : ""
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
            {/* Category chips */}
            <div className="mt-6 flex gap-6 flex-wrap">
              {Array.from(
                new Map(
                  (p.services || [])
                    .filter((s: any) => s.category)
                    .map((s: any) => [s.category.slug, s.category.name]),
                ).entries(),
              ).map(([slug, name]) => (
                <button
                  key={slug as string}
                  onClick={() => {
                    setCategory(slug as string);
                    setPage(1);
                    setTimeout(search, 0);
                  }}
                  className="chip chip-slate cursor-pointer"
                  aria-label={`Filter by category ${name as string}`}
                >
                  {name as string}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// TooltipInfo moved to shared component: app/components/TooltipInfo

function LeafletMap({
  providers,
  myLat,
  myLng,
  radiusKm,
}: {
  providers: any[];
  myLat?: number;
  myLng?: number;
  radiusKm?: number;
}) {
  const MapContainer = dynamic(
    () => import("react-leaflet").then((m) => m.MapContainer),
    { ssr: false },
  ) as any;
  const TileLayer = dynamic(
    () => import("react-leaflet").then((m) => m.TileLayer),
    { ssr: false },
  ) as any;
  const CircleMarker = dynamic(
    () => import("react-leaflet").then((m) => m.CircleMarker),
    { ssr: false },
  ) as any;
  const Tooltip = dynamic(
    () => import("react-leaflet").then((m) => m.Tooltip),
    { ssr: false },
  ) as any;
  const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
    ssr: false,
  }) as any;
  const Circle = dynamic(() => import("react-leaflet").then((m) => m.Circle), {
    ssr: false,
  }) as any;

  const defaults = [37.7749, -122.4194];
  const firstWithCoords = providers.find(
    (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng),
  );
  const center: any =
    Number.isFinite(myLat) && Number.isFinite(myLng)
      ? [myLat as number, myLng as number]
      : firstWithCoords
        ? [firstWithCoords.lat, firstWithCoords.lng]
        : defaults;

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {Number.isFinite(myLat) && Number.isFinite(myLng) && (
        <CircleMarker
          center={[myLat as number, myLng as number]}
          pathOptions={{ color: "#2563eb" }}
          radius={8}
        >
          <Tooltip direction="top">You</Tooltip>
        </CircleMarker>
      )}
      {Number.isFinite(myLat) && Number.isFinite(myLng) && (
        <Circle
          center={[myLat as number, myLng as number]}
          radius={
            1000 *
            (Number.isFinite(radiusKm as number) && (radiusKm as number) > 0
              ? (radiusKm as number)
              : 5)
          }
          pathOptions={{ color: "#60a5fa", fillOpacity: 0.05 }}
        />
      )}
      {providers
        .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
        .map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            pathOptions={{ color: p.online ? "#16a34a" : "#9ca3af" }}
            radius={6}
          >
            <Tooltip direction="top">
              {p.user?.name || p.user?.email || p.id}
            </Tooltip>
            <Popup>
              <div className="min-w-220">
                <div className="font-600 flex items-center gap-8">
                  {p.user?.name || p.user?.email || p.id}
                  <span
                    className={`font-11 ${p.online ? "text-green" : "text-gray-500"}`}
                  >
                    {p.online ? "Online" : "Offline"}
                  </span>
                </div>
                {p.minServicePrice != null &&
                  Number.isFinite(p.minServicePrice) && (
                    <div className="font-12 text-subtle">
                      From ${((p.minServicePrice || 0) / 100).toFixed(2)}
                    </div>
                  )}
                <div className="font-12 text-subtle">
                  {(p.services || []).map((s: any) => s.name).join(", ") ||
                    "No services listed"}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
