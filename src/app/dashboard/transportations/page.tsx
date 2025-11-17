// src/app/dashboards/[role]/dealers/transportations/page.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { RefreshCcw, Loader2 } from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';

/* ------------------------- helpers ------------------------- */
type HeadersDict = HeadersInit;
function bearerHeaders(token?: string | null): HeadersDict {
  const h: HeadersDict = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : (null as any);
  } catch {
    return t as any;
  }
}
const msg = (d: any, fb: string) => d?.message || d?.detail || d?.title || fb;

function formatDateTime(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(+d)) return s;
  return d.toLocaleString();
}

/* --------------------------- map --------------------------- */
const LiveMap = dynamic(() => import('@/src/components/map/LiveLeaflet'), {
  ssr: false,
});

/* --------------------------- types ------------------------- */
type DealerRestaurant = {
  id: string;
  name: string;
  email?: string | null;
};

type OrderRow = {
  id: string;
  code: string;
  customer: string;
  phone: string;
  address: string;
  delivery_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  type: 'yerinde' | 'gel_al' | 'paket_servis' | string;
  amount: number;
  status: string;
  created_at: string;
};

type OrderHistoryPayload = {
  success?: boolean;
  message?: string;
  data?: {
    orders: OrderRow[];
    total_count: number;
    total_amount: number;
  };
};

type Marker = {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
};

/* ------------------------ label maps ----------------------- */
const STATUS_LABEL: Record<string, string> = {
  hazirlaniyor: 'Hazırlanıyor',
  kurye_cagrildi: 'Kurye Çağrıldı',
  kuryeye_istek_atildi: 'Kuryeye İstek Atıldı',
  kuryeye_verildi: 'Kuryeye Verildi',
  siparis_havuza_atildi: 'Sipariş Havuza Atıldı',
  kurye_reddetti: 'Kurye Reddetti',
  yolda: 'Yolda',
  teslim_edildi: 'Teslim Edildi',
  iptal: 'İptal',
};

const TYPE_LABEL: Record<string, string> = {
  paket_servis: 'Paket',
  yerinde: 'Yerinde',
  gel_al: 'Gel Al',
};

const STATUS_BUTTONS: {
  key: string;
  label: string;
  className: string;
}[] = [
  { key: 'hazirlaniyor', label: 'Hazırlanıyor', className: 'bg-sky-600 hover:bg-sky-700' },
  { key: 'kuryeye_istek_atildi', label: 'Kuryeye İstek Atıldı', className: 'bg-emerald-600 hover:bg-emerald-700' },
  { key: 'kurye_reddetti', label: 'Kurye Reddetti', className: 'bg-rose-600 hover:bg-rose-700' },
  { key: 'kurye_cagrildi', label: 'Kurye Çağrıldı', className: 'bg-orange-500 hover:bg-orange-600' },
  { key: 'kuryeye_verildi', label: 'Kuryeye Verildi', className: 'bg-indigo-600 hover:bg-indigo-700' },
  { key: 'siparis_havuza_atildi', label: 'Sipariş Havuza Atıldı', className: 'bg-violet-600 hover:bg-violet-700' },
  { key: 'yolda', label: 'Yolda', className: 'bg-sky-700 hover:bg-sky-800' },
  { key: 'teslim_edildi', label: 'Teslim Edildi', className: 'bg-green-600 hover:bg-green-700' },
  { key: 'iptal', label: 'İptal', className: 'bg-red-600 hover:bg-red-700' },
];

/* --------------------------- page -------------------------- */
export default function DealerTransportationsPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(() => bearerHeaders(token), [token]);

  /* ---- restaurants ---- */
  const [restaurants, setRestaurants] = React.useState<DealerRestaurant[]>([]);
  const [rLoading, setRLoading] = React.useState(false);
  const [rError, setRError] = React.useState<string | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string>('');

  const loadRestaurants = React.useCallback(async () => {
    setRLoading(true);
    setRError(null);
    try {
      const res = await fetch('/yuksi/dealer/restaurants?limit=200&offset=0', {
        headers,
        cache: 'no-store',
      });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));

      const list: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      const mapped: DealerRestaurant[] = list
        .map(
          (r: any): DealerRestaurant => ({
            id: String(r?.id ?? r?.restaurant_id ?? ''),
            name: String(r?.name ?? r?.restaurant_name ?? '—'),
            email: r?.email ?? null,
          }),
        )
        .filter((r: DealerRestaurant) => r.id);

      setRestaurants(mapped);
      if (!restaurantId && mapped.length === 1) {
        setRestaurantId(mapped[0].id);
      }
    } catch (e: any) {
      setRError(e?.message || 'Restoranlar alınamadı.');
      setRestaurants([]);
    } finally {
      setRLoading(false);
    }
  }, [headers, restaurantId]);

  React.useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  /* ---- orders ---- */
  const [status, setStatus] = React.useState<string>(''); // aktif durum filtresi
  const [rows, setRows] = React.useState<OrderRow[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [totalAmount, setTotalAmount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);

  const loadOrders = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', '200');
    params.set('offset', '0');

    try {
      const res = await fetch(
        `/yuksi/dealer/restaurants/${restaurantId}/order-history?` + params.toString(),
        { headers, cache: 'no-store' },
      );
      const j: OrderHistoryPayload = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));

      const data = j?.data;
      const list: OrderRow[] = Array.isArray(data?.orders)
        ? data!.orders.map(
            (o: any): OrderRow => ({
              id: String(o?.id ?? ''),
              code: String(o?.code ?? ''),
              customer: String(o?.customer ?? ''),
              phone: String(o?.phone ?? ''),
              address: String(o?.address ?? ''),
              delivery_address: String(o?.delivery_address ?? ''),
              pickup_lat: o?.pickup_lat == null ? null : Number(o.pickup_lat),
              pickup_lng: o?.pickup_lng == null ? null : Number(o.pickup_lng),
              dropoff_lat: o?.dropoff_lat == null ? null : Number(o.dropoff_lat),
              dropoff_lng: o?.dropoff_lng == null ? null : Number(o.dropoff_lng),
              type: String(o?.type ?? ''),
              amount: Number(o?.amount ?? 0),
              status: String(o?.status ?? ''),
              created_at: String(o?.created_at ?? ''),
            }),
          )
        : [];

      setRows(list);
      setTotalCount(Number(data?.total_count ?? list.length));
      setTotalAmount(Number(data?.total_amount ?? 0));
    } catch (e: any) {
      setRows([]);
      setTotalCount(0);
      setTotalAmount(0);
      setError(e?.message || 'Siparişler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [headers, restaurantId, status]);

  // restoran veya durum değişince tekrar çek
  React.useEffect(() => {
    if (restaurantId) {
      loadOrders();
    } else {
      setRows([]);
      setTotalAmount(0);
      setTotalCount(0);
    }
  }, [restaurantId, loadOrders]);

  // siparişler değişince varsayılan seçim
  React.useEffect(() => {
    if (rows.length) setSelectedOrderId((prev) => prev && rows.find((r) => r.id === prev) ? prev : rows[0].id);
    else setSelectedOrderId(null);
  }, [rows]);

  /* ---- derived ---- */
  const markers: Marker[] = React.useMemo(
    () =>
      rows
        .map((o) => {
          const lat = (o.dropoff_lat ?? o.pickup_lat) ?? null;
          const lng = (o.dropoff_lng ?? o.pickup_lng) ?? null;
          if (lat == null || lng == null) return null;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

          return {
            id: o.id,
            name: o.code || o.customer,
            phone: o.phone,
            lat,
            lng,
          } as Marker;
        })
        .filter((m): m is Marker => !!m),
    [rows],
  );

  const selectedOrder = React.useMemo(
    () => (selectedOrderId ? rows.find((r) => r.id === selectedOrderId) ?? null : null),
    [rows, selectedOrderId],
  );

  const statusCounts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of rows) {
      m[o.status] = (m[o.status] ?? 0) + 1;
    }
    return m;
  }, [rows]);

  /* --------------------------- UI --------------------------- */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Paket Takip</h1>
          <p className="text-sm text-neutral-600">
            Restoran paketlerini harita üzerinden anlık olarak izle ve durumlara göre filtrele.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs sm:text-sm text-neutral-600">
            Restoran:{' '}
            <span className="font-mono font-semibold">
              {restaurantId || '—'}
            </span>
          </div>
          <button
            onClick={() => loadOrders()}
            disabled={!restaurantId || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            Siparişleri Yenile
          </button>
        </div>
      </div>

      {/* Restaurant select */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="grid gap-1 sm:max-w-xs">
            <span className="text-sm font-medium text-neutral-700">Restoran Seç</span>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Restoran seçin…</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <div className="text-xs text-neutral-500">
            Toplam Sipariş:{' '}
            <b className="tabular-nums">{totalCount}</b>{' '}
            · Toplam Tutar:{' '}
            <b className="tabular-nums">
              {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺
            </b>
          </div>
        </div>

        {(rLoading || loading) && (
          <div className="mt-2 inline-flex items-center gap-2 text-xs text-neutral-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
          </div>
        )}
        {rError && (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {rError}
          </div>
        )}
        {error && (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </section>

      {/* Main content: Map + detail */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr),minmax(260px,320px)]">
          {/* Map & status buttons */}
          <div className="space-y-4">
            {/* Map */}
            <div className="rounded-2xl border border-neutral-200 overflow-hidden">
              <LiveMap
                markers={markers}
                selectedId={selectedOrderId}
                onSelect={(id) => setSelectedOrderId(id)}
              />
            </div>

            {/* Status buttons */}
            <div className="grid gap-2 md:grid-cols-3">
              {STATUS_BUTTONS.map((b) => {
                const active = status === b.key;
                const count = statusCounts[b.key] ?? 0;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() =>
                      setStatus((prev) => (prev === b.key ? '' : b.key))
                    }
                    className={[
                      'flex items-center justify-between rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition',
                      b.className,
                      active ? 'ring-2 ring-offset-2 ring-offset-white ring-yellow-300' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-white" />
                      {b.label}
                    </span>
                    <span className="ml-2 inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-white/15 text-xs">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected order detail */}
          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            {selectedOrder ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-neutral-500">Seçili Sipariş</div>
                    <div className="text-lg font-semibold">
                      #{selectedOrder.code}
                    </div>
                    <div className="text-sm text-neutral-700">
                      {selectedOrder.customer || '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                      {TYPE_LABEL[selectedOrder.type] ?? selectedOrder.type}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                      {STATUS_LABEL[selectedOrder.status] ?? selectedOrder.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-neutral-700">
                  <div className="flex items-center justify-between">
                    <span>Telefon:</span>
                    {selectedOrder.phone ? (
                      <a
                        href={`tel:${selectedOrder.phone}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {selectedOrder.phone}
                      </a>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Oluşturma:</span>
                    <span className="font-medium">
                      {formatDateTime(selectedOrder.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tutar:</span>
                    <span className="font-semibold tabular-nums">
                      {selectedOrder.amount.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₺
                    </span>
                  </div>
                </div>

                <div className="mt-2 space-y-3 border-t border-dashed border-neutral-300 pt-3 text-xs text-neutral-700">
                  <div>
                    <div className="font-semibold text-neutral-800">
                      Restoran Adresi
                    </div>
                    <div>{selectedOrder.address || '—'}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-800">
                      Teslimat Adresi
                    </div>
                    <div>{selectedOrder.delivery_address || '—'}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                Henüz sipariş seçilmedi.
              </div>
            )}
          </div>
        </div>

        {/* Bottom order list */}
        <div className="mt-4 border-t border-neutral-200 pt-3">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {rows.map((o) => {
              const active = o.id === selectedOrderId;
              const sLabel = STATUS_LABEL[o.status] ?? o.status;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOrderId(o.id)}
                  className={[
                    'min-w-[220px] rounded-2xl border px-3 py-2 text-left text-xs shadow-sm',
                    active
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'h-2 w-2 rounded-full',
                        o.status === 'kuryeye_verildi'
                          ? 'bg-emerald-500'
                          : o.status === 'hazirlaniyor'
                          ? 'bg-sky-500'
                          : o.status === 'siparis_havuza_atildi'
                          ? 'bg-violet-500'
                          : o.status === 'kurye_reddetti' || o.status === 'iptal'
                          ? 'bg-rose-500'
                          : 'bg-amber-500',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                    <div className="font-semibold text-xs">
                      #{o.code}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-700">
                    {o.customer || '—'}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {TYPE_LABEL[o.type] ?? o.type} · {sLabel}
                  </div>
                </button>
              );
            })}
            {rows.length === 0 && (
              <div className="text-sm text-neutral-500">
                Bu restoran için sipariş bulunamadı.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
