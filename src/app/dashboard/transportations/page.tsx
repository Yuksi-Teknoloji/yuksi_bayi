// src/app/dashboards/[role]/dealers/transportations/page.tsx
// src/app/dashboards/[role]/dealers/transportations/page.tsx
'use client';

import * as React from 'react';
import { getAuthToken } from '@/src/utils/auth';
import { RefreshCcw, Search, Loader2 } from 'lucide-react';

/* ------------------------- helpers ------------------------- */
type HeadersDict = HeadersInit;
function bearerHeaders(token?: string | null): HeadersDict {
  const h: HeadersDict = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try { return t ? JSON.parse(t) : (null as any); } catch { return (t as any); }
}
const msg = (d: any, fb: string) => d?.message || d?.detail || d?.title || fb;

function formatDateTime(s: string): string {
  // ISO tarih => yerel kısa format
  const d = new Date(s);
  if (Number.isNaN(+d)) return s;
  return d.toLocaleString();
}

/* --------------------------- types ------------------------- */
type DealerRestaurant = { id: string; name: string; email?: string | null };
type OrderRow = {
  id: string;
  code: string;
  customer: string;
  phone: string;
  address: string;
  delivery_address: string;
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

/* --------------------------- page -------------------------- */
export default function DealerTransportationsPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(() => bearerHeaders(token), [token]);

  /* ---- restaurants (select) ---- */
  const [restaurants, setRestaurants] = React.useState<DealerRestaurant[]>([]);
  const [rLoading, setRLoading] = React.useState(false);
  const [rError, setRError] = React.useState<string | null>(null);
  const [restaurantId, setRestaurantId] = React.useState<string>('');

  const loadRestaurants = React.useCallback(async () => {
    setRLoading(true); setRError(null);
    try {
      const res = await fetch('/yuksi/dealer/restaurants?limit=200&offset=0', { headers, cache: 'no-store' });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));

      const list: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      const mapped: DealerRestaurant[] = list
        .map((r: any): DealerRestaurant => ({
          id: String(r?.id ?? r?.restaurant_id ?? ''),
          name: String(r?.name ?? r?.restaurant_name ?? '—'),
          email: r?.email ?? null,
        }))
        .filter((r: DealerRestaurant) => r.id);

      setRestaurants(mapped);

      // tek restoran varsa otomatik seç
      if (mapped.length === 1) setRestaurantId(mapped[0].id);
    } catch (e: any) {
      setRError(e?.message || 'Restoranlar alınamadı.');
      setRestaurants([]);
    } finally { setRLoading(false); }
  }, [headers]);

  React.useEffect(() => { loadRestaurants(); }, [loadRestaurants]);

  /* ---- filters ---- */
  const [status, setStatus] = React.useState<string>('');       // kurye_cagrildi / kuryeye_verildi / hazirlaniyor ...
  const [orderType, setOrderType] = React.useState<string>(''); // yerinde / gel_al / paket_servis
  const [search, setSearch] = React.useState<string>('');       // müşteri adı/telefon/kod
  const [startDate, setStartDate] = React.useState<string>(''); // YYYY-MM-DD
  const [endDate, setEndDate] = React.useState<string>('');     // YYYY-MM-DD

  /* ---- paging ---- */
  const [limit, setLimit] = React.useState<number>(50);
  const [offset, setOffset] = React.useState<number>(0);

  /* ---- data ---- */
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<OrderRow[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [totalAmount, setTotalAmount] = React.useState<number>(0);

  const loadOrders = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true); setError(null);

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (orderType) params.set('order_type', orderType);
    if (search) params.set('search', search.trim());
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    try {
      const res = await fetch(
        `/yuksi/dealer/restaurants/${restaurantId}/order-history?` + params.toString(),
        { headers, cache: 'no-store' }
      );
      const j: OrderHistoryPayload = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));

      const data = j?.data;
      const list: OrderRow[] = Array.isArray(data?.orders) ? data!.orders.map((o: any): OrderRow => ({
        id: String(o?.id ?? ''),
        code: String(o?.code ?? ''),
        customer: String(o?.customer ?? ''),
        phone: String(o?.phone ?? ''),
        address: String(o?.address ?? ''),
        delivery_address: String(o?.delivery_address ?? ''),
        type: String(o?.type ?? ''),
        amount: Number(o?.amount ?? 0),
        status: String(o?.status ?? ''),
        created_at: String(o?.created_at ?? ''),
      })) : [];

      setRows(list);
      setTotalCount(Number(data?.total_count ?? 0));
      setTotalAmount(Number(data?.total_amount ?? 0));
    } catch (e: any) {
      setRows([]); setTotalCount(0); setTotalAmount(0);
      setError(e?.message || 'Siparişler alınamadı.');
    } finally { setLoading(false); }
  }, [headers, restaurantId, status, orderType, search, startDate, endDate, limit, offset]);

  // restoran değişince sayfalama sıfırla ve çek
  React.useEffect(() => { setOffset(0); }, [restaurantId]);
  React.useEffect(() => { loadOrders(); }, [loadOrders]);

  const canPrev = offset > 0;
  const canNext = offset + limit < totalCount;

  function nextPage() { if (canNext) setOffset(o => o + limit); }
  function prevPage() { if (canPrev) setOffset(o => Math.max(0, o - limit)); }

  /* --------------------------- UI --------------------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Taşıma / Sipariş Geçmişi</h1>
          <p className="text-sm text-neutral-600">
            Bayiye bağlı restoranı seç ve sipariş geçmişini görüntüle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadRestaurants()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            <RefreshCcw className="h-4 w-4" /> Restoranları Yenile
          </button>
          <button
            onClick={() => loadOrders()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            <RefreshCcw className="h-4 w-4" /> Listeyi Yenile
          </button>
        </div>
      </div>

      {/* Restaurant select */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr,160px,160px]">
          <label className="grid gap-1">
            <span className="text-sm">Restoran</span>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2"
            >
              <option value="" disabled>Seçin…</option>
              {restaurants.map((r: DealerRestaurant) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Durum</span>
            <select value={status} onChange={(e)=>{ setStatus(e.target.value); setOffset(0); }}
              className="rounded-lg border border-neutral-300 px-3 py-2">
              <option value="">(hepsi)</option>
              <option value="hazirlaniyor">hazirlaniyor</option>
              <option value="kurye_cagrildi">kurye_cagrildi</option>
              <option value="kuryeye_verildi">kuryeye_verildi</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Tip</span>
            <select value={orderType} onChange={(e)=>{ setOrderType(e.target.value); setOffset(0); }}
              className="rounded-lg border border-neutral-300 px-3 py-2">
              <option value="">(hepsi)</option>
              <option value="yerinde">yerinde</option>
              <option value="gel_al">gel_al</option>
              <option value="paket_servis">paket_servis</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,1fr,1fr,1fr,160px]">
          <label className="grid gap-1">
            <span className="text-sm">Arama (kod / müşteri / tel)</span>
            <div className="relative">
              <input
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
                placeholder="Örn: ORD-2510, Ahmet, 05..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 pl-8"
              />
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
            </div>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">Sayfa Boyutu</span>
            <input type="number" min={1} max={200} value={limit}
              onChange={(e)=>{ setLimit(Math.max(1, Math.min(200, Number(e.target.value)||50))); setOffset(0); }}
              className="rounded-lg border border-neutral-300 px-3 py-2" />
          </label>

          <div className="flex items-end">
            <button
              onClick={() => { setOffset(0); loadOrders(); }}
              className="h-10 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Uygula
            </button>
          </div>
        </div>

        {(rLoading || loading) && (
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-neutral-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
          </div>
        )}
        {rError && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{rError}</div>}
        {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      </section>

      {/* Summary */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>Toplam Sipariş: <b className="tabular-nums">{totalCount}</b></div>
          <div>Toplam Tutar: <b className="tabular-nums">{totalAmount.toLocaleString(undefined,{maximumFractionDigits:2})} ₺</b></div>
          <div>Gösterilen: <b className="tabular-nums">{rows.length}</b></div>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="max-h-[620px] overflow-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-4 py-2">Kod</th>
                <th className="px-4 py-2">Müşteri</th>
                <th className="px-4 py-2">Telefon</th>
                <th className="px-4 py-2">Tip</th>
                <th className="px-4 py-2">Durum</th>
                <th className="px-4 py-2">Tutar</th>
                <th className="px-4 py-2">Oluşturma</th>
                <th className="px-4 py-2">Adres</th>
                <th className="px-4 py-2">Teslimat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o: OrderRow) => (
                <tr key={o.id} className="border-t text-sm">
                  <td className="px-4 py-2">
                    <div className="font-medium">{o.code}</div>
                    <div className="text-[11px] text-neutral-500">{o.id}</div>
                  </td>
                  <td className="px-4 py-2">{o.customer}</td>
                  <td className="px-4 py-2">{o.phone}</td>
                  <td className="px-4 py-2">{o.type}</td>
                  <td className="px-4 py-2">{o.status}</td>
                  <td className="px-4 py-2 tabular-nums">{o.amount.toLocaleString(undefined,{maximumFractionDigits:2})} ₺</td>
                  <td className="px-4 py-2">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-2">{o.address}</td>
                  <td className="px-4 py-2">{o.delivery_address}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-sm text-neutral-500">Kayıt yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="text-neutral-600">
            {totalCount > 0
              ? <>Gösterim {offset + 1}–{Math.min(offset + limit, totalCount)} / {totalCount}</>
              : 'Gösterim 0'}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={!canPrev}
              onClick={prevPage}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-50"
            >
              ‹ Önceki
            </button>
            <button
              disabled={!canNext}
              onClick={nextPage}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-50"
            >
              Sonraki ›
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
