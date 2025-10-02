'use client';
import { useEffect, useMemo, useState } from 'react';
import { TooltipInfo } from '../../components/TooltipInfo';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useLocalToken } from '../../useLocalToken';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

type Prov = { id: string; user?: { name?: string; email?: string }; services?: Array<{ id: string; name: string; price?: number }>; distanceKm?: number };

export default function ProvidersNearPage() {
  const [token] = useLocalToken();
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<string>('25');
  const [q, setQ] = useState<string>('');
  const [onlineOnly, setOnlineOnly] = useState<boolean>(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sort, setSort] = useState<'distance'|'price'|'online'|'rank'>('distance');
  const [rank, setRank] = useState<'balanced'|'cheap'|'near'|'online'>('balanced');
  const [order, setOrder] = useState<'asc'|'desc'>('asc');
  const [page, setPage] = useState<number>(1);
  const [take, setTake] = useState<number>(25);
  const [items, setItems] = useState<Prov[]>([]);
  const [status, setStatus] = useState<string>('');
  const [total, setTotal] = useState<number>(0);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [providerStatus, setProviderStatus] = useState<string>('');
  const [myLoc, setMyLoc] = useState<{ lat?: number; lng?: number } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [service, setService] = useState<string>('');
  const [categories, setCategories] = useState<Array<{ slug: string; label: string }>>([]);

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
      setRadiusKm('10');
      setPage(1);
      setTimeout(search, 0);
    });
  };

  const search = async () => {
    setStatus('Searching...');
    const params = new URLSearchParams();
    if (lat) params.set('lat', lat);
    if (lng) params.set('lng', lng);
    if (radiusKm) params.set('radiusKm', radiusKm);
    if (q) params.set('q', q);
    if (service) params.set('service', service);
    if (category) params.set('category', category);
    if (onlineOnly) params.set('onlineOnly', 'true');
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sort) params.set('sort', sort);
    if (sort === 'rank') params.set('rank', rank);
    if (order) params.set('order', order);
    params.set('page', String(page));
    params.set('take', String(take));
    const res = await fetch(`${API}/providers/near?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    const arr = Array.isArray(data) ? data : (data.items || []);
    setItems(arr);
    setTotal(Number((data && data.total) || arr.length || 0));
    setHasNext(Boolean(data && data.hasNext));
    setStatus(res.ok ? 'OK' : `Error ${res.status}`);
  };

  const setMyLocation = async () => {
    if (!lat || !lng) return setProviderStatus('Missing lat/lng');
    setProviderStatus('Updating location...');
    try {
      const res = await fetch(`${API}/providers/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat: Number(lat), lng: Number(lng) }),
      });
      setProviderStatus(res.ok ? 'Location updated' : `Error ${res.status}`);
    } catch {
      setProviderStatus('Network error');
    }
  };

  useEffect(() => {
    geo();
    // load provider location if token present (best-effort)
    const loadMine = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API}/providers/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const pl = data?.provider;
        if (pl && (pl.lat != null || pl.lng != null)) setMyLoc({ lat: pl.lat, lng: pl.lng });
      } catch {}
    };
    loadMine();
    // Load categories list
    (async () => {
      try {
        const res = await fetch(`${API}/providers/categories`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const flatten = (nodes: any[], prefix = ''): Array<{ slug: string; label: string }> => {
            const out: Array<{ slug: string; label: string }> = [];
            for (const n of nodes) {
              const label = prefix ? `${prefix} › ${n.name}` : n.name;
              out.push({ slug: n.slug, label });
              if (Array.isArray(n.children) && n.children.length) out.push(...flatten(n.children, label));
            }
            return out;
          };
          setCategories(flatten(data));
        }
      } catch {}
    })();
    // Load filters from localStorage
    try {
      const raw = localStorage.getItem('providers:near:filters');
      if (raw) {
        const f = JSON.parse(raw);
        if (typeof f.lat === 'string') setLat(f.lat);
        if (typeof f.lng === 'string') setLng(f.lng);
        if (typeof f.radiusKm === 'string') setRadiusKm(f.radiusKm);
        if (typeof f.q === 'string') setQ(f.q);
        if (typeof f.onlineOnly === 'boolean') setOnlineOnly(f.onlineOnly);
        if (typeof f.minPrice === 'string') setMinPrice(f.minPrice);
        if (typeof f.maxPrice === 'string') setMaxPrice(f.maxPrice);
        if (f.sort === 'distance' || f.sort === 'price' || f.sort === 'online') setSort(f.sort);
        if (f.order === 'asc' || f.order === 'desc') setOrder(f.order);
        if (Number.isFinite(f.page)) setPage(Math.max(1, Number(f.page)));
        if (Number.isFinite(f.take)) setTake(Math.max(1, Math.min(100, Number(f.take))));
        if (typeof f.category === 'string') setCategory(f.category);
        if (typeof f.service === 'string') setService(f.service);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    try {
      const f = { lat, lng, radiusKm, q, onlineOnly, minPrice, maxPrice, sort, order, page, take, category, service };
      localStorage.setItem('providers:near:filters', JSON.stringify(f));
    } catch {}
  }, [lat, lng, radiusKm, q, onlineOnly, minPrice, maxPrice, sort, order, page, take, category, service]);

  return (
    <div className="container">
      <h2>Providers Near You</h2>
      <div className="map-frame">
        <LeafletMap lat={parseFloat(lat)} lng={parseFloat(lng)} radiusKm={parseFloat(radiusKm)} providers={items} selectedJobId={selectedJobId} />
      </div>
      <div className="grid-6 items-center max-w-1000">
        <input className="col-span-2" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat" />
        <input className="col-span-2" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="lng" />
        <input className="col-span-1" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} placeholder="radius km" />
        <input className="col-span-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="service contains (optional)" />
        <select className="col-span-1" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">any category</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
        <label className="col-span-1 flex gap-6 items-center">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} /> online only
        </label>
        <input className="col-span-1" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="min price" />
        <input className="col-span-1" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="max price" />
        <select className="col-span-1" value={sort} onChange={(e) => setSort(e.target.value as any)}>
          <option value="distance">distance</option>
          <option value="price">price</option>
          <option value="online">online</option>
          <option value="rank">rank</option>
        </select>
        {sort === 'rank' && (
          <div className="col-span-3 flex items-center gap-8">
            <select value={rank} onChange={(e) => setRank(e.target.value as any)}>
              <option value="balanced">balanced</option>
              <option value="cheap">cheap</option>
              <option value="near">near</option>
              <option value="online">online</option>
            </select>
            <TooltipInfo trigger="click" placement="top" theme="light" text={
              'Ranking combines distance, price and online.\n' +
              '- balanced: even weighting\n' +
              '- cheap: emphasize lower prices\n' +
              '- near: prioritize distance\n' +
              '- online: prefer online providers'
            } />
          </div>
        )}
        <select className="col-span-1" value={order} onChange={(e) => setOrder(e.target.value as any)}>
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
        <button className="col-span-1" onClick={search}>Search</button>
        <button
          className="col-span-1"
          onClick={() => {
            setLat(''); setLng(''); setRadiusKm('25'); setQ(''); setCategory(''); setService(''); setOnlineOnly(false);
            setMinPrice(''); setMaxPrice(''); setSort('distance'); setOrder('asc'); setPage(1);
            setTimeout(search, 0);
          }}
        >
          Clear filters
        </button>
        <span className="col-span-1 text-muted font-12">{status}</span>
        <div className="col-span-3 flex gap-8 items-center">
          <button disabled={page <= 1} onClick={() => { setPage((p) => Math.max(1, p - 1)); setTimeout(search, 0); }}>Prev</button>
          <span className="font-12 text-muted">Page {page} • Total {total}</span>
          <button disabled={!hasNext} onClick={() => { setPage((p) => p + 1); setTimeout(search, 0); }}>Next</button>
          <select value={take} onChange={(e) => setTake(parseInt(e.target.value))}>
            {[10,25,50,100].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
        <input className="col-span-3" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} placeholder="Selected Job ID (for quick quote)" />
        <div className="col-span-6 flex gap-8 items-center">
          <button onClick={geo}>Use current location</button>
          <button onClick={geo10}>Use my location + 10km</button>
          <button onClick={setMyLocation} title="Provider-only; requires provider JWT">Set my location (provider)</button>
          <span className="text-muted font-12">{providerStatus}</span>
        </div>
      </div>
      <div className="mt-16 grid gap-8">
        {myLoc && (
          <div className="text-subtle">My stored location: {myLoc.lat?.toFixed(5)}, {myLoc.lng?.toFixed(5)}</div>
        )}
        {items.map((p: any) => (
          <div key={p.id} className="card">
            <div className="flex justify-between items-center gap-8">
              <strong>{p.user?.name || p.user?.email || p.id}</strong>
              <div className="flex gap-6 flex-wrap">
                {p.online && (
                  <span className="chip chip-success">online</span>
                )}
                {p.distanceKm != null && (
                  <span className="chip chip-slate">{p.distanceKm.toFixed(1)} km</span>
                )}
                {p.minServicePrice != null && isFinite(p.minServicePrice) && (
                  <span className="chip chip-warn">from ${((p.minServicePrice || 0)/100).toFixed(2)}</span>
                )}
              </div>
            </div>
            {/* Service chips */}
            <div className="font-13 text-muted mt-4 flex gap-6 flex-wrap">
              {(p.services || []).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => { setService(s.name as string); setPage(1); setTimeout(search, 0); }}
                  className="chip chip-neutral cursor-pointer"
                  aria-label={`Filter by service ${s.name}`}
                  title={s.price != null ? `$${(s.price/100).toFixed(2)}` : ''}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {/* Category chips */}
            <div className="mt-6 flex gap-6 flex-wrap">
              {Array.from(new Map((p.services || []).filter((s: any) => s.category).map((s: any) => [s.category.slug, s.category.name])).entries()).map(([slug, name]) => (
                <button
                  key={slug as string}
                  onClick={() => { setCategory(slug as string); setPage(1); setTimeout(search, 0); }}
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

function LeafletMap({ lat, lng, radiusKm, providers, selectedJobId }: { lat?: number; lng?: number; radiusKm?: number; providers: Prov[]; selectedJobId?: string }) {
  const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false }) as any;
  const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false }) as any;
  const CircleMarker = dynamic(() => import('react-leaflet').then((m) => m.CircleMarker), { ssr: false }) as any;
  const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), { ssr: false }) as any;
  const Circle = dynamic(() => import('react-leaflet').then((m) => m.Circle), { ssr: false }) as any;
  const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false }) as any;

  const center = isFinite(lat as number) && isFinite(lng as number) ? [lat as number, lng as number] : [37.7749, -122.4194];
  return (
    <MapContainer center={center as any} zoom={12} className="h-full w-full" scrollWheelZoom>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      {isFinite(lat as number) && isFinite(lng as number) && (
        <CircleMarker center={[lat as number, lng as number]} pathOptions={{ color: '#2563eb' }} radius={8}>
          <Tooltip direction="top">You</Tooltip>
        </CircleMarker>
      )}
      {isFinite(lat as number) && isFinite(lng as number) && isFinite(radiusKm as number) && radiusKm! > 0 && (
        <Circle center={[lat as number, lng as number]} radius={(radiusKm as number) * 1000} pathOptions={{ color: '#60a5fa', fillOpacity: 0.05 }} />
      )}
      {providers
        .filter((p) => p && (p as any).lat != null && (p as any).lng != null)
        .map((p) => (
          <CircleMarker
            key={p.id}
            center={[((p as any).lat as number) || 0, ((p as any).lng as number) || 0]}
            pathOptions={{ color: p as any && (p as any).online ? '#16a34a' : '#9ca3af' }}
            radius={6}
          >
            <Tooltip direction="top">{p.user?.name || p.user?.email || p.id}</Tooltip>
            <Popup>
              <div className="min-w-220">
                <div className="font-600 flex items-center gap-8">
                  {p.user?.name || p.user?.email || p.id}
                  <span className={`font-11 ${(p as any).online ? 'text-green' : 'text-gray-500'}`}>
                    {(p as any).online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="font-12 text-subtle">{(p.services || []).map((s) => s.name).join(', ') || 'No services listed'}</div>
                <div className="mt-8">
                  <a href={`/realtime?room=${encodeURIComponent('provider:' + p.id)}`}>Open chat</a>
                  {selectedJobId && (
                    <>
                      {' '}•{' '}
                      <a href={`/jobs/${encodeURIComponent(selectedJobId)}/quote`}>Quote this job</a>
                    </>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}

// TooltipInfo moved to shared component: app/components/TooltipInfo
