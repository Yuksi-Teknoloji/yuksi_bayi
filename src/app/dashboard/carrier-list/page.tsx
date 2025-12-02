// src/app/dashboards/[role]/dealers/carrier-list/page.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { getAuthToken } from '@/src/utils/auth';

const LiveLeaflet = dynamic(() => import('@/src/components/map/LiveLeaflet'), {
  ssr: false,
});

/* ========= Types ========= */

type DealerCourierGpsDTO = {
  courier_id: string;
  courier_name: string;
  courier_phone?: string;
  courier_email?: string;
  is_deleted?: boolean;
  is_active?: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
  location_updated_at?: string | null;
  vehicle_type?: string | null;
  vehicle_capacity?: number | null;
  state_id?: number | null;
};

type DealerCourierGpsResponse = {
  success?: boolean;
  message?: string;
  data?: {
    couriers?: DealerCourierGpsDTO[];
  };
};

/* ========= Helpers ========= */

async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : (null as any);
  } catch {
    return t as any;
  }
}

const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

function collectErrors(x: any): string {
  const msgs: string[] = [];
  if (x?.message) msgs.push(String(x.message));
  if (x?.data?.message) msgs.push(String(x.data.message));
  const err = x?.errors || x?.error || x?.detail;

  if (Array.isArray(err)) {
    for (const it of err) {
      if (typeof it === 'string') msgs.push(it);
      else if (it && typeof it === 'object') {
        const loc = Array.isArray((it as any).loc) ? (it as any).loc.join('.') : (it as any).loc ?? '';
        const m = (it as any).msg || (it as any).message || (it as any).detail;
        if (loc && m) msgs.push(`${loc}: ${m}`);
        else if (m) msgs.push(String(m));
      }
    }
  } else if (err && typeof err === 'object') {
    for (const [k, v] of Object.entries(err)) {
      if (Array.isArray(v)) (v as any[]).forEach((m) => msgs.push(`${k}: ${m}`));
      else if (v) msgs.push(`${k}: ${v}`);
    }
  }
  return msgs.join('\n');
}

const toNum = (v: unknown) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

function formatDateTime(dt?: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* ========= Page ========= */

export default function DealerCarrierListPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersInit>(
    () => ({
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const [couriers, setCouriers] = React.useState<DealerCourierGpsDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  // GPS verilerini çek + periyodik yenile
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/yuksi/dealer/couriers/gps', {
          cache: 'no-store',
          headers,
        });
        const j: DealerCourierGpsResponse | any = await readJson(res);
        if (!res.ok || j?.success === false) {
          throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
        }

        const list: DealerCourierGpsDTO[] =
          (j?.data?.couriers && Array.isArray(j.data.couriers) && j.data.couriers) || [];

        if (cancelled) return;

        setCouriers(list);
        if (!selectedId && list.length) {
          setSelectedId(list[0].courier_id);
        }
        setLastUpdated(
          new Date().toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        );
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Kurye GPS verileri alınamadı.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 15_000); // 15 sn’de bir yenile
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [headers, selectedId]);

  // Filtrelenmiş kurye listesi
  const filteredCouriers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return couriers;

    return couriers.filter((c) => {
      const name = (c.courier_name || '').toLowerCase();
      const phone = (c.courier_phone || '').toLowerCase();
      const email = (c.courier_email || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [couriers, search]);

  // Harita marker’ları
  const markers = React.useMemo(
    () =>
      filteredCouriers
        .map((c) => {
          const lat = toNum(c.latitude ?? NaN);
          const lng = toNum(c.longitude ?? NaN);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return {
            id: c.courier_id,
            name: c.courier_name || 'İsimsiz Kurye',
            phone: c.courier_phone || '',
            lat,
            lng,
          };
        })
        .filter(Boolean) as {
        id: string;
        name: string;
        phone: string;
        lat: number;
        lng: number;
      }[],
    [filteredCouriers],
  );

  const activeCourier = React.useMemo(
    () => filteredCouriers.find((c) => c.courier_id === selectedId) || null,
    [filteredCouriers, selectedId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kuryelerim (Canlı Konum)</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Bu sayfada bayine bağlı tüm kuryelerin anlık GPS konumlarını harita üzerinde
            görebilirsin.
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <div>
            Toplam kurye: <b>{couriers.length}</b>
          </div>
          {lastUpdated && (
            <div>
              Son güncelleme: <b>{lastUpdated}</b>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="soft-card rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
          {/* Kurye listesi */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-semibold text-neutral-800">
                  Kurye Listesi
                </label>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İsim, telefon veya e-posta ile ara…"
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-sky-200"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  // küçük manual refresh
                  setLastUpdated(null);
                  setError(null);
                  // yeniden tetiklemek için selectedId dependency'sini kullanmayalım,
                  // bunun yerine çok basit: headers değişmediği için sadece
                  // aynı effect’i tetikleyemiyoruz; o yüzden burada window.location.reload
                  // yerine lightweight fetch yapalım:
                  (async () => {
                    try {
                      setLoading(true);
                      const res = await fetch('/yuksi/dealer/couriers/gps', {
                        cache: 'no-store',
                        headers,
                      });
                      const j: DealerCourierGpsResponse | any = await readJson(res);
                      if (!res.ok || j?.success === false) {
                        throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
                      }
                      const list: DealerCourierGpsDTO[] =
                        (j?.data?.couriers &&
                          Array.isArray(j.data.couriers) &&
                          j.data.couriers) ||
                        [];
                      setCouriers(list);
                      if (!selectedId && list.length) {
                        setSelectedId(list[0].courier_id);
                      }
                      setLastUpdated(
                        new Date().toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                      );
                    } catch (e: any) {
                      setError(e?.message || 'Kurye GPS verileri alınamadı.');
                    } finally {
                      setLoading(false);
                    }
                  })();
                }}
                disabled={loading}
                className="mt-7 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
              >
                {loading ? 'Yenileniyor…' : 'Tekrar Yükle'}
              </button>
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 text-sm">
              {loading && couriers.length === 0 && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  Kuryeler yükleniyor…
                </div>
              )}

              {!loading && filteredCouriers.length === 0 && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  Kriterlere uygun kurye bulunamadı.
                </div>
              )}

              {filteredCouriers.map((c) => {
                const lat = toNum(c.latitude ?? NaN);
                const lng = toNum(c.longitude ?? NaN);
                const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
                const active = selectedId === c.courier_id;

                return (
                  <button
                    key={c.courier_id}
                    type="button"
                    onClick={() => setSelectedId(c.courier_id)}
                    className={[
                      'w-full rounded-xl border px-3 py-2 text-left transition',
                      active
                        ? 'border-sky-400 bg-sky-50/80'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-[13px]">
                        {c.courier_name || 'İsimsiz Kurye'}
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-2 py-[2px]',
                            c.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200',
                          ].join(' ')}
                        >
                          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                          {c.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                        <span
                          className={[
                            'inline-flex items-center rounded-full border px-2 py-[2px] text-[11px]',
                            hasLocation
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-neutral-50 text-neutral-500 border-neutral-200',
                          ].join(' ')}
                        >
                          {hasLocation ? 'Konum var' : 'Konum yok'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-[12px] text-neutral-700">
                      {c.courier_phone && <div>📞 {c.courier_phone}</div>}
                      {c.courier_email && <div>✉️ {c.courier_email}</div>}
                    </div>
                    {c.location_updated_at && (
                      <div className="mt-1 text-[11px] text-neutral-500">
                        Son konum güncellemesi: {formatDateTime(c.location_updated_at)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Harita */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-800">
                Harita (OpenStreetMap)
              </div>
              <div className="text-xs text-neutral-500">
                Marker’a tıklayarak ilgili kuryeyi seçebilirsin.
              </div>
            </div>

            <LiveLeaflet
              markers={markers}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              isFullscreen
              overlay={
                <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-2">
                  <div className="pointer-events-auto rounded-full bg-black/70 px-3 py-1 text-xs text-white shadow-lg">
                    {loading ? 'Konumlar güncelleniyor…' : 'Canlı konum'}
                  </div>
                  {activeCourier && (
                    <div className="pointer-events-auto w-full max-w-xs rounded-2xl bg-white/90 p-3 text-xs shadow-lg backdrop-blur">
                      <div className="font-semibold">
                        {activeCourier.courier_name || 'Seçili Kurye'}
                      </div>
                      {activeCourier.courier_phone && (
                        <div className="mt-1 text-neutral-700">
                          📞 {activeCourier.courier_phone}
                        </div>
                      )}
                      {activeCourier.location_updated_at && (
                        <div className="mt-1 text-neutral-500">
                          Son konum: {formatDateTime(activeCourier.location_updated_at)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
