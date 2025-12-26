// src/app/dashboard/company-load/CompanyLoadClient.tsx
'use client';

import * as React from 'react';
import { getAuthToken } from '@/src/utils/auth';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';

/* ========= helpers ========= */
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : (null as any);
  } catch {
    return t as any;
  }
}
const pickMsg = (d: any, fb: string) => d?.error?.message || d?.message || d?.detail || d?.title || fb;

function bearerHeaders(token?: string | null): HeadersInit {
  const h: HeadersInit = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

function fmtTRY(n?: number | null) {
  if (n == null) return '-';
  try {
    return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
  } catch {
    return String(n);
  }
}
function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('tr-TR');
  } catch {
    return iso;
  }
}
function badgeColor(kind?: string) {
  if (kind === 'immediate') return 'bg-indigo-50 text-indigo-700 ring-indigo-100';
  if (kind === 'appointment') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (kind === 'scheduled') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-neutral-100 text-neutral-700 ring-neutral-200';
}

// API tarih formatı genelde "DD.MM.YYYY" geliyor; HTML input=date için "YYYY-MM-DD" gerek.
function trToHtmlDate(tr?: string | null) {
  if (!tr) return '';
  const parts = tr.split('.');
  if (parts.length !== 3) return '';
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}
function htmlToTrDate(html?: string | null) {
  if (!html) return '';
  const [yyyy, mm, dd] = html.split('-');
  if (!yyyy || !mm || !dd) return '';
  return `${dd}.${mm}.${yyyy}`;
}
function fmtAppt(date?: string | null, time?: string | null) {
  if (!date && !time) return '-';
  if (date && time) return `${date} ${time}`;
  return date || time || '-';
}

/* ========= Types ========= */
type ApiJob = {
  id: string;
  deliveryType: 'immediate' | 'appointment' | 'scheduled' | string;
  carrierType?: string | null;
  vehicleType?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  specialNotes?: string | null;
  totalPrice?: number | null;
  paymentMethod?: 'cash' | 'card' | 'transfer' | string | null;
  createdAt?: string | null;

  deliveryDate?: string | null; // "DD.MM.YYYY" veya null
  deliveryTime?: string | null; // "HH:mm" veya null
};

type ListResponse = { success?: boolean; message?: string; data?: ApiJob[] };

type LatLng = { lat: number; lng: number };

/* ========= page ========= */
export default function CompanyLoadClient() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersInit>(() => bearerHeaders(token), [token]);

  // filters / paging
  const [limit, setLimit] = React.useState<number | ''>('');
  const [offset, setOffset] = React.useState<number>(0);

  // ⚠️ bu endpoint param adı delivery_type (snake_case)
  const [deliveryType, setDeliveryType] = React.useState<'' | 'immediate' | 'scheduled'>('');
  const [q, setQ] = React.useState('');

  // data
  const [rows, setRows] = React.useState<ApiJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // UI
  const [selected, setSelected] = React.useState<ApiJob | null>(null);
  const [editing, setEditing] = React.useState<ApiJob | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // route modal
  const [routeOpen, setRouteOpen] = React.useState(false);
  const [routeFor, setRouteFor] = React.useState<ApiJob | null>(null);
  const [routeLoading, setRouteLoading] = React.useState(false);
  const [start, setStart] = React.useState<LatLng | null>(null);
  const [end, setEnd] = React.useState<LatLng | null>(null);
  const [routeErr, setRouteErr] = React.useState<string | null>(null);
  const geoCache = React.useRef<Map<string, LatLng>>(new Map());

  function toast(s: string) {
    setInfo(s);
    setTimeout(() => setInfo(null), 2500);
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ✅ SADECE GET DEĞİŞTİ: /api/admin/dealers/companies/jobs
      const url = new URL('/yuksi/admin/dealers/companies/jobs', location.origin);

      if (limit !== '') url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));

      // swagger: delivery_type (isteğe bağlı)
      if (deliveryType) url.searchParams.set('delivery_type', deliveryType);

      const res = await fetch(url.toString(), { headers, cache: 'no-store' });
      const j = await readJson<ListResponse>(res);

      if (!res.ok || (j && (j as any).success === false)) {
        throw new Error(pickMsg(j, `HTTP ${res.status}`));
      }

      const list = Array.isArray(j?.data) ? j!.data! : Array.isArray(j) ? ((j as any) as ApiJob[]) : [];
      setRows(list);
    } catch (e: any) {
      setError(e?.message || 'Yük listesi alınamadı.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, limit, offset, deliveryType]);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) =>
      [
        r.pickupAddress || '',
        r.dropoffAddress || '',
        r.specialNotes || '',
        r.paymentMethod || '',
        r.deliveryType || '',
        r.deliveryDate || '',
        r.deliveryTime || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(qq),
    );
  }, [rows, q]);

  // CRUD (aynı bırakıldı)
  async function onDelete(id: string) {
    if (!confirm('Bu yük kaydını silmek istiyor musunuz?')) return;
    try {
      const res = await fetch(`/yuksi/admin/jobs/${id}`, { method: 'DELETE', headers });
      const j = await readJson(res);
      if (!res.ok || (j && (j as any).success === false)) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      await load();
      toast('Kayıt silindi.');
    } catch (e: any) {
      alert(e?.message || 'Silme işlemi başarısız.');
    }
  }

  async function onUpdate(id: string, payload: Partial<ApiJob>) {
    const r = rows.find((x) => x.id === id);
    if (!r) return;

    const body = {
      deliveryType: r.deliveryType,
      carrierType: r.carrierType ?? 'courier',
      vehicleType: r.vehicleType ?? 'motorcycle',
      pickupAddress: payload.pickupAddress ?? r.pickupAddress ?? '',
      dropoffAddress: payload.dropoffAddress ?? r.dropoffAddress ?? '',
      specialNotes: payload.specialNotes ?? r.specialNotes ?? '',
      campaignCode: undefined,
      extraServices: [],
      extraServicesTotal: 0,
      totalPrice: payload.totalPrice ?? r.totalPrice ?? 0,
      paymentMethod: payload.paymentMethod ?? r.paymentMethod ?? 'cash',
      imageFileIds: [],

      deliveryDate: payload.deliveryDate ?? (r.deliveryDate ?? null),
      deliveryTime: payload.deliveryTime ?? (r.deliveryTime ?? null),
    };

    try {
      const res = await fetch(`/yuksi/admin/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const j = await readJson(res);
      if (!res.ok || (j && (j as any).success === false)) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      setEditing(null);
      await load();
      toast('Kayıt güncellendi.');
    } catch (e: any) {
      alert(e?.message || 'Güncelleme başarısız.');
    }
  }

  // ---------- Route viewer helpers ----------
  async function geocodeOnce(address: string): Promise<LatLng> {
    const key = address.trim();
    if (!key) throw new Error('Adres boş.');
    const cached = geoCache.current.get(key);
    if (cached) return cached;

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '0');
    url.searchParams.set('limit', '1');
    url.searchParams.set('q', key);

    const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'tr' } });
    const arr = (await res.json()) as any[];
    if (!arr?.length) throw new Error('Adres bulunamadı: ' + key);

    const lat = Number(arr[0].lat);
    const lng = Number(arr[0].lon);
    const v = { lat, lng };
    geoCache.current.set(key, v);
    return v;
  }

  async function showRoute(r: ApiJob) {
    setRouteOpen(true);
    setRouteFor(r);
    setRouteLoading(true);
    setRouteErr(null);
    setStart(null);
    setEnd(null);

    try {
      const [s, e] = await Promise.all([geocodeOnce(r.pickupAddress || ''), geocodeOnce(r.dropoffAddress || '')]);
      setStart(s);
      setEnd(e);
    } catch (e: any) {
      setRouteErr(e?.message || 'Konumlar getirilemedi.');
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Yük Listesi</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">Limit</label>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-24 rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-sm"
            placeholder="-"
          />
          <label className="text-sm text-neutral-600">Offset</label>
          <input
            type="number"
            min={0}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value) || 0)}
            className="w-24 rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-sm"
          />
          <label className="text-sm text-neutral-600">Tip</label>
          <select
            value={deliveryType}
            onChange={(e) => setDeliveryType(e.target.value as any)}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Tümü</option>
            <option value="immediate">immediate</option>
            <option value="scheduled">scheduled</option>
          </select>
          <button
            onClick={load}
            className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
          >
            Yenile
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ara: adres, ödeme türü, not…"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-800 outline-none ring-2 ring-transparent transition placeholder:text-neutral-400 focus:bg-white focus:ring-sky-200"
            />
          </div>
        </div>

        {error && <div className="px-4 pb-2 text-sm text-rose-600">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full border-t border-neutral-200/70">
            <thead>
              <tr className="text-left text-sm text-neutral-500">
                <th className="px-4 py-3 font-medium">Alış / Teslim</th>
                <th className="px-4 py-3 font-medium">Teslimat Tipi</th>
                <th className="px-4 py-3 font-medium">Randevu</th>
                <th className="px-4 py-3 font-medium">Ödeme</th>
                <th className="px-4 py-3 font-medium">Toplam</th>
                <th className="px-4 py-3 font-medium">Oluşturma</th>
                <th className="px-4 py-3 font-medium w-[200px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-neutral-500">
                    Yükleniyor…
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200/70 align-top hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="text-neutral-900 font-medium line-clamp-2">{r.pickupAddress || '-'}</div>
                      <div className="mt-1 text-sm text-neutral-700 line-clamp-2">→ {r.dropoffAddress || '-'}</div>
                      {r.specialNotes && <div className="mt-1 text-xs text-neutral-500">{r.specialNotes}</div>}
                      <div className="text-[11px] text-neutral-400 mt-1">#{r.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badgeColor(r.deliveryType)}`}>
                        {r.deliveryType || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{fmtAppt(r.deliveryDate, r.deliveryTime)}</td>
                    <td className="px-4 py-3 text-sm">{r.paymentMethod || '-'}</td>
                    <td className="px-4 py-3 font-semibold">{fmtTRY(r.totalPrice)}</td>
                    <td className="px-4 py-3 text-sm">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => showRoute(r)}
                          className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
                        >
                          Haritada Göster
                        </button>
                        <button
                          onClick={() => setSelected(r)}
                          className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-600"
                        >
                          Görüntüle
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-neutral-500">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* toast */}
      {info && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm shadow-lg">
          {info}
        </div>
      )}

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}

      {editing && <EditModal row={editing} onClose={() => setEditing(null)} onSubmit={(payload) => onUpdate(editing.id, payload)} />}

      {/* Route Modal */}
      {routeOpen && routeFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setRouteOpen(false)}>
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold">
                Rota:{' '}
                <span className="font-normal">{routeFor.pickupAddress || '-'}</span> ➜{' '}
                <span className="font-normal">{routeFor.dropoffAddress || '-'}</span>
              </h3>
              <button onClick={() => setRouteOpen(false)} className="rounded-full p-2 hover:bg-neutral-100">
                ✕
              </button>
            </div>

            {routeErr && <div className="m-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">{routeErr}</div>}
            {routeLoading && <div className="p-4 text-sm text-neutral-500">Konumlar yükleniyor…</div>}

            {!routeLoading && !routeErr && start && end && (
              <div className="p-4">
                <div style={{ height: 420 }} className="rounded-xl overflow-hidden">
                  <RouteMap start={start} end={end} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ======== Modals ======== */
function DetailModal({ row, onClose }: { row: ApiJob; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-xl font-semibold">Yük Detayı</h3>
          <button className="rounded-full p-2 hover:bg-neutral-100" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Field label="Teslimat Tipi" value={row.deliveryType} />
          <Field label="Randevu" value={fmtAppt(row.deliveryDate, row.deliveryTime)} />
          <Field label="Ödeme" value={row.paymentMethod} />
          <Field label="Toplam Ücret" value={fmtTRY(row.totalPrice)} />
          <Field label="Oluşturma" value={fmtDate(row.createdAt)} />
          <Field label="Alış Adresi" value={row.pickupAddress} />
          <Field label="Teslim Adresi" value={row.dropoffAddress} />
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-2 text-sm font-medium text-neutral-700">Not</div>
            <p className="whitespace-pre-line text-neutral-800">{row.specialNotes || '-'}</p>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  row,
  onClose,
  onSubmit,
}: {
  row: ApiJob;
  onClose: () => void;
  onSubmit: (payload: Partial<ApiJob>) => void;
}) {
  const [pickup, setPickup] = React.useState(row.pickupAddress || '');
  const [dropoff, setDropoff] = React.useState(row.dropoffAddress || '');
  const [notes, setNotes] = React.useState(row.specialNotes || '');
  const [payment, setPayment] = React.useState<'cash' | 'card' | 'transfer' | ''>((row.paymentMethod as any) || '');
  const [total, setTotal] = React.useState<number | ''>(row.totalPrice ?? '');

  const [dDate, setDDate] = React.useState<string>(trToHtmlDate(row.deliveryDate));
  const [dTime, setDTime] = React.useState<string>(row.deliveryTime || '');

  function save(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      pickupAddress: pickup,
      dropoffAddress: dropoff,
      specialNotes: notes,
      paymentMethod: payment || undefined,
      totalPrice: total === '' ? 0 : Number(total),
      deliveryDate: dDate ? htmlToTrDate(dDate) : null,
      deliveryTime: dTime ? dTime : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">Kaydı Düzenle</h3>
          <button className="rounded-full p-2 hover:bg-neutral-100" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        <form onSubmit={save} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Alış Adresi</label>
            <input
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Teslim Adresi</label>
            <input
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Not</label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Ödeme Yöntemi</label>
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value as any)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="">Seçiniz</option>
                <option value="cash">cash</option>
                <option value="card">card</option>
                <option value="transfer">transfer</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Toplam Ücret (₺)</label>
              <input
                type="number"
                min={0}
                value={total}
                onChange={(e) => setTotal(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Teslim Tarihi</label>
              <input
                type="date"
                value={dDate}
                onChange={(e) => setDDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Teslim Saati</label>
              <input
                type="time"
                value={dTime}
                onChange={(e) => setDTime(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300"
            >
              İptal
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-neutral-600">{label}</div>
      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-900">{value ?? '-'}</div>
    </div>
  );
}

/* ================= Route Map (markers + OSRM polyline) ================= */

function FitBounds({ start, end }: { start: LatLng; end: LatLng }) {
  const map = useMap();
  React.useEffect(() => {
    try {
      map.fitBounds(
        [
          [start.lat, start.lng],
          [end.lat, end.lng],
        ],
        { padding: [30, 30] },
      );
    } catch {}
  }, [map, start, end]);
  return null;
}

function RouteMap({ start, end }: { start: LatLng; end: LatLng }) {
  const [points, setPoints] = React.useState<[number, number][]>([]);
  const [routeError, setRouteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchRoute() {
      setRouteError(null);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
        const j: any = await res.json();
        const coords: [number, number][] =
          j?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => [c[1], c[0]]) ?? [];
        if (!coords.length) throw new Error('Rota bulunamadı');
        if (!cancelled) setPoints(coords);
      } catch (e) {
        console.error('OSRM route error, falling back to straight line:', e);
        if (!cancelled) {
          setRouteError('Rota hesaplanamadı, kuş uçuşu çizgi gösteriliyor.');
          setPoints([
            [start.lat, start.lng],
            [end.lat, end.lng],
          ]);
        }
      }
    }

    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [start.lat, start.lng, end.lat, end.lng]);

  const center: [number, number] = [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2];
  const polyPositions = points.length
    ? (points as [number, number][])
    : ([[start.lat, start.lng], [end.lat, end.lng]] as [number, number][]);

  return (
    <>
      {routeError && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">{routeError}</div>
      )}
      <MapContainer center={center} zoom={12} style={{ width: '100%', height: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <FitBounds start={start} end={end} />
        <CircleMarker center={[start.lat, start.lng]} radius={8} pathOptions={{ color: '#22c55e', weight: 3, fillOpacity: 0.9 }}>
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Alım Noktası
          </Tooltip>
        </CircleMarker>
        <CircleMarker center={[end.lat, end.lng]} radius={8} pathOptions={{ color: '#ef4444', weight: 3, fillOpacity: 0.9 }}>
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Teslim Noktası
          </Tooltip>
        </CircleMarker>
        <Polyline positions={polyPositions} pathOptions={{ weight: 4, opacity: 0.85 }} />
      </MapContainer>
    </>
  );
}
