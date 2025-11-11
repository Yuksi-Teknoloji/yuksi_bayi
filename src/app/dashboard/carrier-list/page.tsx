// src/app/dashboards/[role]/dealers/carrier-list/page.tsx
'use client';

import * as React from 'react';
import { Loader2, RefreshCcw, Search } from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';

/* ------------------------- Types ------------------------- */
type RestaurantLite = {
  id: string;
  name: string;
};

type CourierRow = {
  id: string;
  restaurant_id: string;
  courier_id: string;
  assigned_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean | null;
  courier_name?: string | null;
};

type ApiList<T> = {
  success?: boolean;
  message?: string;
  data?: T[];
} | T[]; // bazı endpointler direkt dizi dönebiliyor

/* ------------------------- Helpers ------------------------- */
const readJson = async <T,>(res: Response): Promise<T> => {
  const t = await res.text();
  try {
    return (t ? JSON.parse(t) : null) as unknown as T;
  } catch {
    return (null as unknown) as T;
  }
};

const apiMsg = (d: any, fb: string) =>
  d?.message || d?.detail || d?.title || `HTTP ${fb}`;

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const h: Record<string, string> = { Accept: 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/* ------------------------- Page ------------------------- */
export default function DealerCarrierListPage() {
  const [restaurants, setRestaurants] = React.useState<RestaurantLite[]>([]);
  const [restLoading, setRestLoading] = React.useState(false);
  const [restErr, setRestErr] = React.useState<string | null>(null);

  const [restaurantId, setRestaurantId] = React.useState<string>('');
  const [couriers, setCouriers] = React.useState<CourierRow[]>([]);
  const [courLoading, setCourLoading] = React.useState(false);
  const [courErr, setCourErr] = React.useState<string | null>(null);

  const [q, setQ] = React.useState<string>('');

  /* ----------- load restaurants (GET /api/dealer/restaurants) ----------- */
  const loadRestaurants = React.useCallback(async () => {
    setRestLoading(true);
    setRestErr(null);
    try {
      const res = await fetch('/yuksi/dealer/restaurants?limit=200&offset=0', {
        headers: authHeaders(),
        cache: 'no-store',
      });
      const j: ApiList<any> = await readJson(res);
      if (!res.ok) throw new Error(apiMsg(j, String(res.status)));
      const list: any[] = Array.isArray((j as any)?.data)
        ? (j as any).data
        : Array.isArray(j)
        ? (j as any)
        : [];
      const mapped: RestaurantLite[] = list
        .map((r: any): RestaurantLite => ({
          id: String(r?.id ?? ''),
          name: String(r?.name ?? '—'),
        }))
        .filter((r: RestaurantLite) => r.id);
      setRestaurants(mapped);

      // tek restoran varsa otomatik seç
      if (mapped.length === 1) setRestaurantId(mapped[0].id);
    } catch (e: any) {
      setRestErr(e?.message || 'Restoranlar getirilemedi.');
      setRestaurants([]);
    } finally {
      setRestLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  /* ----------- load couriers (GET /api/dealer/restaurants/{id}/couriers) ----------- */
  const loadCouriers = React.useCallback(async () => {
    if (!restaurantId) {
      setCouriers([]);
      return;
    }
    setCourLoading(true);
    setCourErr(null);
    try {
      const res = await fetch(
        `/yuksi/dealer/restaurants/${restaurantId}/couriers?limit=200&offset=0`,
        { headers: authHeaders(), cache: 'no-store' }
      );
      const j: ApiList<any> = await readJson(res);
      if (!res.ok) throw new Error(apiMsg(j, String(res.status)));
      const list: any[] = Array.isArray((j as any)?.data)
        ? (j as any).data
        : Array.isArray(j)
        ? (j as any)
        : [];
      const mapped: CourierRow[] = list.map(
        (m: any): CourierRow => ({
          id: String(m?.id ?? ''),
          restaurant_id: String(m?.restaurant_id ?? ''),
          courier_id: String(m?.courier_id ?? ''),
          assigned_at: m?.assigned_at ?? null,
          notes: m?.notes ?? null,
          created_at: m?.created_at ?? null,
          first_name: m?.first_name ?? null,
          last_name: m?.last_name ?? null,
          email: m?.email ?? null,
          phone: m?.phone ?? null,
          is_active: m?.is_active ?? null,
          courier_name: m?.courier_name ?? null,
        })
      );
      setCouriers(mapped);
    } catch (e: any) {
      setCourErr(e?.message || 'Kuryeler getirilemedi.');
      setCouriers([]);
    } finally {
      setCourLoading(false);
    }
  }, [restaurantId]);

  React.useEffect(() => {
    loadCouriers();
  }, [loadCouriers]);

  /* ----------- filtered ----------- */
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return couriers;
    return couriers.filter((c: CourierRow) => {
      const full = `${c.courier_name ?? ''} ${c.first_name ?? ''} ${c.last_name ?? ''} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase();
      return full.includes(s) || c.courier_id.toLowerCase().includes(s);
    });
  }, [couriers, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kurye Listesi</h1>
          <p className="text-sm text-neutral-600">Bayiye bağlı restoranı seç ve kuryeleri görüntüle.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRestaurants}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            <RefreshCcw className="h-4 w-4" /> Restoranları Yenile
          </button>
          <button
            onClick={loadCouriers}
            disabled={!restaurantId}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" /> Kuryeleri Yenile
          </button>
        </div>
      </div>

      {/* Restoran seçimi + arama */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr,300px]">
          <label className="grid gap-1 text-sm">
            <span>Restoran Seç</span>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2"
            >
              <option value="" disabled>
                {restLoading ? 'Yükleniyor…' : '— restoran seçin —'}
              </option>
              {restaurants.map((r: RestaurantLite) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id})
                </option>
              ))}
            </select>
          </label>

          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kurye ara… (ad, e-posta, telefon, id)"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 pl-8 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-neutral-400" />
          </div>
        </div>

        {restErr && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {restErr}
          </div>
        )}
      </section>

      {/* Kurye tablosu */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-4 py-2">Kurye</th>
                <th className="px-4 py-2">İletişim</th>
                <th className="px-4 py-2">Durum</th>
                <th className="px-4 py-2">Atanma</th>
                <th className="px-4 py-2">ID’ler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: CourierRow) => (
                <tr key={c.id} className="border-t text-sm">
                  <td className="px-4 py-2">
                    <div className="font-medium">{c.courier_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || '—'}</div>
                    <div className="text-[11px] text-neutral-500">{c.id}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div>{c.email || '—'}</div>
                    <div className="text-[12px] text-neutral-500">{c.phone || '—'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {c.is_active ? 'aktif' : 'pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-[12px]">{c.assigned_at || '—'}</div>
                    {c.notes ? <div className="text-[11px] text-neutral-500">{c.notes}</div> : null}
                  </td>
                  <td className="px-4 py-2 text-[12px] text-neutral-600">
                    <div>restaurant_id: <span className="text-neutral-800">{c.restaurant_id}</span></div>
                    <div>courier_id: <span className="text-neutral-800">{c.courier_id}</span></div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !courLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-500">
                    {restaurantId ? 'Kayıt bulunamadı.' : 'Önce restoran seçin.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {courLoading && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
          </div>
        )}
        {courErr && (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {courErr}
          </div>
        )}
      </section>
    </div>
  );
}
