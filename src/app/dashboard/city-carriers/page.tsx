'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { getAuthToken } from '@/src/utils/auth';

const LiveLeaflet = dynamic(() => import('@/src/components/map/LiveLeaflet'), { ssr: false });

type ApiCarrier = {
  carrier_id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  full_address?: string;
  city_name?: string;
  state_name?: string;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_plate?: string | null;
  vehicle_year?: number | null;
  vehicle_details?: { features?: string[] } | null;
  created_at?: string;
  is_active?: boolean;
};

type Carrier = Required<Pick<ApiCarrier, 'carrier_id'>> & {
  first_name: string;
  last_name: string;
  phone: string;
  full_address: string;
  city_name: string;
  state_name: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_year: number | null;
  vehicle_details: { features: string[] } | null;
  created_at?: string;
  is_active?: boolean;
};

type Marker = {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
};

function safeArray<T>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}

function makeAuthHeaders(): HeadersInit {
  const tok = getAuthToken();
  const h: Record<string, string> = { Accept: 'application/json' };
  if (tok && tok.trim()) {
    const cleaned = tok.replace(/^Bearer\s+/i, '').trim();
    h.Authorization = `Bearer ${cleaned}`;
  }
  return h;
}

async function readJson(res: Response) {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { raw: t };
  }
}

async function geocodeNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('q', q);

    const res = await fetch(url.toString(), {
      headers: { 'Accept-Language': 'tr' },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr.length) return null;

    return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CityCarriersPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [carriers, setCarriers] = React.useState<Carrier[]>([]);
  const [markers, setMarkers] = React.useState<Marker[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const geoCacheRef = React.useRef(new Map<string, { lat: number; lng: number }>());

  const selectedCarrier = React.useMemo(() => {
    if (!selectedId) return null;
    return carriers.find((c) => c.carrier_id === selectedId) || null;
  }, [carriers, selectedId]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const headers = makeAuthHeaders();

      // token yoksa daha baştan uyar
      if (!(headers as any).Authorization) {
        throw new Error('Auth token bulunamadı (localStorage/cookie). Giriş yaptığından emin ol.');
      }

      const res = await fetch('/yuksi/dealer/carriers?limit=200&offset=0', {
        headers,
        cache: 'no-store',
        credentials: 'include', // cookie auth varsa gerekli
      });

      const j = await readJson(res);

      if (res.status === 401) {
        throw new Error('401 Unauthorized: Token geçersiz/expired olabilir veya backend Bearer bekliyor.');
      }
      if (!res.ok) {
        throw new Error(j?.message || j?.detail || `HTTP ${res.status}`);
      }

      const raw = Array.isArray(j) ? j : j?.data;
      const arr = safeArray<ApiCarrier>(raw);

      const normalized: Carrier[] = arr.map((c) => ({
        carrier_id: String(c.carrier_id),
        first_name: c.first_name ?? '',
        last_name: c.last_name ?? '',
        phone: c.phone ?? '',
        full_address: c.full_address ?? '',
        city_name: c.city_name ?? '',
        state_name: c.state_name ?? '',
        vehicle_make: c.vehicle_make ?? null,
        vehicle_model: c.vehicle_model ?? null,
        vehicle_plate: c.vehicle_plate ?? null,
        vehicle_year: c.vehicle_year ?? null,
        vehicle_details: c.vehicle_details
          ? { features: safeArray<string>(c.vehicle_details.features) }
          : null,
        created_at: c.created_at,
        is_active: c.is_active,
      }));

      setCarriers(normalized);

      const mks: Marker[] = [];

      for (const c of normalized) {
        const q = `${c.full_address} ${c.city_name} ${c.state_name}`.trim();
        if (!q) continue;

        const cached = geoCacheRef.current.get(q);
        if (cached) {
          mks.push({
            id: c.carrier_id,
            name: `${c.first_name} ${c.last_name}`.trim() || c.carrier_id,
            phone: c.phone,
            lat: cached.lat,
            lng: cached.lng,
          });
          continue;
        }

        const geo = await geocodeNominatim(q);
        if (geo) {
          geoCacheRef.current.set(q, geo);
          mks.push({
            id: c.carrier_id,
            name: `${c.first_name} ${c.last_name}`.trim() || c.carrier_id,
            phone: c.phone,
            lat: geo.lat,
            lng: geo.lng,
          });
        }

        await sleep(250);
      }

      setMarkers(mks);

      if (!selectedId && normalized.length) setSelectedId(normalized[0].carrier_id);
    } catch (e: any) {
      setError(e?.message || 'Taşıyıcılar alınamadı.');
      setCarriers([]);
      setMarkers([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Şehirdeki Taşıyıcılar</h1>

        <button
          onClick={load}
          className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
          disabled={loading}
          type="button"
        >
          {loading ? 'Yükleniyor…' : 'Yenile'}
        </button>
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveLeaflet
            markers={markers}
            selectedId={selectedId}
            onSelect={(id: string) => setSelectedId(id)}
            isFullscreen={true}
          />
          {!markers.length && !loading && (
            <div className="mt-2 text-xs text-neutral-500">
              Haritada gösterilecek konum bulunamadı (adres geocode edilememiş olabilir).
            </div>
          )}
        </div>

        <aside className="bg-white rounded-2xl border p-4 shadow space-y-3">
          {!selectedCarrier && (
            <div className="text-sm text-neutral-500">Haritadan bir taşıyıcı seç.</div>
          )}

          {selectedCarrier && (
            <>
              <div>
                <div className="text-lg font-semibold">
                  {selectedCarrier.first_name} {selectedCarrier.last_name}
                </div>
                <div className="text-xs text-neutral-500">{selectedCarrier.carrier_id}</div>
              </div>

              <div className="text-sm">
                <b>Telefon:</b> {selectedCarrier.phone || '—'}
              </div>

              <div className="text-sm">
                <b>Adres:</b> {selectedCarrier.full_address || '—'}
              </div>

              <div className="text-sm">
                <b>Şehir / İl:</b> {selectedCarrier.city_name || '—'} / {selectedCarrier.state_name || '—'}
              </div>

              <hr />

              <div className="text-sm font-semibold">Araç</div>
              <div className="text-sm">
                {selectedCarrier.vehicle_make || '—'} {selectedCarrier.vehicle_model || ''}
              </div>
              <div className="text-sm">Plaka: {selectedCarrier.vehicle_plate || '—'}</div>
              <div className="text-sm">Yıl: {selectedCarrier.vehicle_year ?? '—'}</div>

              <div className="pt-2">
                <div className="text-sm font-semibold">Özellikler</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedCarrier.vehicle_details?.features?.length ? (
                    selectedCarrier.vehicle_details.features.map((f, i) => (
                      <span key={i} className="text-xs bg-neutral-100 px-2 py-1 rounded-full">
                        {f}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-neutral-500">—</span>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
