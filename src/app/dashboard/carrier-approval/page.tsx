//src/app/dashboard/carrier-approval/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

/* ---------- helpers ---------- */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  for (const k of ['auth_token', 'token', 'access_token', 'jwt', 'auth']) {
    const v = localStorage.getItem(k);
    if (v && v.trim()) return v.replace(/^Bearer\s+/i, '').trim();
  }
  return null;
}
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try { return t ? JSON.parse(t) : (null as any); } catch { return (t as any); }
}
const pickMsg = (d: any, fb: string) => d?.message || d?.detail || d?.title || fb;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('tr-TR') : '-');

/* ---------- API & UI types ---------- */
type CourierApi = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  deleted?: boolean,
  deleted_at?: null,
  country_name?: string | null;
  state_name?: string | null;
  working_type?: number | null;
  vehicle_type?: number | null;
  vehicle_capacity?: number | null;
  vehicle_year?: number | null;
  step?: number | null;
};

type DocsStatusUi =
  | 'Evrak Bekleniyor'
  | 'İnceleme Bekleniyor'
  | 'Onaylandı'
  | 'Eksik Belge'
  | 'Reddedildi';

function statusFromStep(step?: number | null): DocsStatusUi {
  if (step == null) return 'Evrak Bekleniyor';
  if (step >= 3) return 'Onaylandı';
  if (step === 2) return 'İnceleme Bekleniyor';
  return 'Evrak Bekleniyor';
}

const statusClasses: Record<DocsStatusUi, string> = {
  'Evrak Bekleniyor': 'bg-neutral-200 text-neutral-700',
  'İnceleme Bekleniyor': 'bg-amber-400 text-white',
  'Onaylandı': 'bg-emerald-500 text-white',
  'Eksik Belge': 'bg-rose-500 text-white',
  'Reddedildi': 'bg-rose-600 text-white',
};

function StatusPill({ value }: { value: DocsStatusUi }) {
  const cls = statusClasses[value] ?? 'bg-neutral-200 text-neutral-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {value || '—'}
    </span>
  );
}

/* ---- Aktiflik pill'i ---- */
function ActivePill({ active }: { active: boolean | null | undefined }) {
  if (active == null) {
    return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-neutral-200 text-neutral-700">—</span>;
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-emerald-500 text-white' : 'bg-neutral-300 text-neutral-800'}`}>
      {active ? 'AKTİF' : 'PASİF'}
    </span>
  );
}

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  createdAt: string;
  status: DocsStatusUi; // (detayda gösteriyoruz)

  // detail
  workingType?: number | null;
  vehicleType?: number | null;
  vehicleCapacity?: number | null;
  vehicleYear?: number | null;
  step?: number | null;
};

/* ---- Silme endpoint bağlama noktası (sen doldur) ---- */
const DELETE_ENDPOINT = (userId: string) =>
  `/yuksi/Courier/${userId}/delete`;

/* ---- Dokümanları çektiğimizde aktiflik kuralı ---- */
type DocItem = { document_id: string; document_status: string };
const computeActiveFromDocs = (docs: DocItem[]) =>
  docs.length > 0 && docs.every(d => (d.document_status === 'onaylandi'));

export default function CarrierListPage() {
  const { role } = useParams<{ role: string }>();

  const token = React.useMemo(() => getAuthToken(), []);
  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: 'application/json' };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  // state
  const [query, setQuery] = React.useState('');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  // modals
  const [detail, setDetail] = React.useState<Row | null>(null);
  const [docsUserId, setDocsUserId] = React.useState<string | null>(null);

  // aktiflik cache (id -> true/false), ayrıca yükleniyor takibi
  const [activeCache, setActiveCache] = React.useState<Record<string, boolean | null>>({});
  const activeLoadingRef = React.useRef<Set<string>>(new Set());

  // fetch list
  React.useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch('/yuksi/Courier/list', { cache: 'no-store', headers });
        const j: any = await readJson(res);
        if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
        const rawList: CourierApi[] = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
        const list = rawList.filter(c => c.deleted === false);
        const mapped: Row[] = list.map((c) => ([
          String(c.id),
          [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || '-',
          c.email || '-',
          c.phone || '-',
          c.country_name || '-',
          c.state_name || '-',
          fmt(c.created_at ?? undefined),
          statusFromStep(c.step),
          c.working_type ?? null,
          c.vehicle_type ?? null,
          c.vehicle_capacity ?? null,
          c.vehicle_year ?? null,
          c.step ?? null,
        ])).map(a => ({
          id: a[0] as string,
          name: a[1] as string,
          email: a[2] as string,
          phone: a[3] as string,
          country: a[4] as string,
          city: a[5] as string,
          createdAt: a[6] as string,
          status: a[7] as DocsStatusUi,
          workingType: a[8] as number | null,
          vehicleType: a[9] as number | null,
          vehicleCapacity: a[10] as number | null,
          vehicleYear: a[11] as number | null,
          step: a[12] as number | null,
        }));
        setRows(mapped);
        setPage(1);
      } catch (e: any) {
        setError(e?.message || 'Kurye listesi alınamadı.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [headers]);

  // filter + paging
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.phone, r.country, r.city].some((v) => v.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageRows = React.useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  /* ---- Ekranda görünen satırlar için aktiflikleri lazy çek ---- */
  React.useEffect(() => {
    const toFetch = pageRows
      .map(r => r.id)
      .filter(id => !(id in activeCache) && !activeLoadingRef.current.has(id));

    if (toFetch.length === 0) return;

    toFetch.forEach(async (id) => {
      activeLoadingRef.current.add(id);
      try {
        const res = await fetch(`/yuksi/Courier/${id}/get_documents`, { cache: 'no-store', headers });
        const j: any = await readJson(res);
        if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
        const list: DocItem[] = Array.isArray(j?.data) ? j.data : [];
        const isActive = computeActiveFromDocs(list);
        setActiveCache(prev => ({ ...prev, [id]: isActive }));
      } catch {
        setActiveCache(prev => ({ ...prev, [id]: null })); // hata: gösterge “—”
      } finally {
        activeLoadingRef.current.delete(id);
      }
    });
  }, [pageRows, headers, activeCache]);

  /* ---- satır silme ---- */
  async function handleDelete(id: string) {
    if (!confirm('Bu kuryeyi silmek istediğinize emin misiniz?')) return;
    const url = DELETE_ENDPOINT(id);
    if (!url) {
      alert('Silme endpointi (DELETE_ENDPOINT) boş. Doldurduktan sonra çalışacak.');
      return;
    }
    try {
      const res = await fetch(url, { method: 'DELETE', headers });
      const j = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Silme işlemi başarısız.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Kurye Listesi</h1>
      </div>

      {/* Filter / top bar */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="p-4 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-md">
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Ara</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ad, e-posta, telefon, şehir…"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-800 outline-none ring-2 ring-transparent transition placeholder:text-neutral-400 focus:bg-white focus:ring-sky-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600">Sayfa Boyutu</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="px-6 pb-4 text-sm text-rose-600">{error}</div>}

        {/* Minimal table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border-t border-neutral-200/70">
            <thead>
                <tr className="text-left text-sm text-neutral-500">
                <th className="px-6 py-3 font-medium w-[260px]">Ad Soyad</th>
                <th className="px-6 py-3 font-medium w-[260px]">E-posta / Telefon</th>
                <th className="px-6 py-3 font-medium w-[220px]">Ülke / Şehir</th>
                <th className="px-6 py-3 font-medium w-[120px]">Aktif</th>
                <th className="px-6 py-3 font-medium w-[190px]">Kayıt Tarihi</th>
                <th className="px-6 py-3 font-medium w-[260px]"></th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-neutral-500">
                    Yükleniyor…
                  </td>
                </tr>
              )}

              {!loading && pageRows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-200/70 hover:bg-neutral-50 align-top">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-neutral-900">{r.name}</div>
                    <div className="mt-1 text-xs text-neutral-500">ID: {r.id}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-neutral-900">{r.email}</div>
                    <div className="text-sm text-neutral-600">{r.phone}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-neutral-900">{r.country}</div>
                    <div className="text-sm text-neutral-600">{r.city}</div>
                  </td>

                  <td className="px-6 py-4">
                    <ActivePill active={activeCache[r.id]} />
                  </td>

                  <td className="px-6 py-4">{r.createdAt}</td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDetail(r)}
                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-600"
                      >
                        Detay
                      </button>

                      <button
                        onClick={() => setDocsUserId(r.id)}
                        className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-indigo-600"
                      >
                        Dokümanlar
                      </button>

                      <button
                        onClick={() => handleDelete(r.id)}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-rose-700"
                        title="Sil"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-neutral-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="flex items-center bg-white justify-between p-4 border-t border-neutral-200/70 text-sm text-neutral-600">
          <div>
            Toplam <span className="font-medium text-neutral-800">{filtered.length}</span> kayıt •
            &nbsp;Sayfa {page}/{totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-md px-3 py-1.5 border border-neutral-300 disabled:opacity-50"
              onClick={() => setPage(1)} disabled={page <= 1 || loading}>« İlk</button>
            <button className="rounded-md px-3 py-1.5 border border-neutral-300 disabled:opacity-50"
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}>‹ Önceki</button>
            <button className="rounded-md px-3 py-1.5 border border-neutral-300 disabled:opacity-50"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>Sonraki ›</button>
            <button className="rounded-md px-3 py-1.5 border border-neutral-300 disabled:opacity-50"
              onClick={() => setPage(totalPages)} disabled={page >= totalPages || loading}>Son »</button>
          </div>
        </div>
      </section>

      {detail && <DetailModal row={detail} onClose={() => setDetail(null)} />}

      {docsUserId && (
        <DocumentsModal
          userId={docsUserId}
          onClose={() => {
            setDocsUserId(null);
            window.location.reload(); // full reload
          }}
        />
      )}
    </div>
  );
}

/* ---------- Detail Modal ---------- */
function DetailModal({ row, onClose }: { row: Row; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute left-1/2 top-10 w-[min(720px,92vw)] -translate-x-1/2 rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Kurye Detayı</h3>
            <p className="text-xs text-neutral-500">{row.name} • {row.email}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Kapat">✕</button>
        </div>

        <div className="max-h-[70vh] overflow-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad Soyad">{row.name}</Field>
            <Field label="Kayıt Tarihi">{row.createdAt}</Field>

            <Field label="E-posta">{row.email}</Field>
            <Field label="Telefon">{row.phone}</Field>

            <Field label="Ülke">{row.country}</Field>
            <Field label="Şehir">{row.city}</Field>

            <Field label="Durum"><StatusPill value={row.status} /></Field>

            <Field label="Çalışma Tipi">{row.workingType ?? '-'}</Field>
            <Field label="Araç Tipi">{row.vehicleType ?? '-'}</Field>
            <Field label="Kapasite">{row.vehicleCapacity ?? '-'}</Field>
            <Field label="Model Yıl">{row.vehicleYear ?? '-'}</Field>
            <Field label="Adım (step)">{row.step ?? '-'}</Field>

            <div className="sm:col-span-2">
              <div className="text-xs text-neutral-500">ID</div>
              <div className="font-mono text-sm">{row.id}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button onClick={onClose} className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300">
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
        {children || '—'}
      </div>
    </div>
  );
}

/* ---------- Documents Modal (değişmedi) ---------- */

type DocsResponse = {
  data: { document_id: string; doc_type: string; file_id: string; image_url: string; document_status: string; uploaded_at?: string | null; }[];
  is_active?: boolean;
  deleted?: boolean;
  success?: boolean;
  message?: string;
};

const DOC_STATUS_OPTIONS = ['evrak_bekleniyor', 'inceleme_bekleniyor', 'eksik_belge', 'reddedildi', 'onaylandi'] as const;

function badgeByApiStatus(s: string) {
  switch (s) {
    case 'onaylandi': return 'bg-emerald-500 text-white';
    case 'inceleme_bekleniyor': return 'bg-amber-400 text-white';
    case 'evrak_bekleniyor': return 'bg-neutral-200 text-neutral-700';
    case 'eksik_belge': return 'bg-rose-500 text-white';
    case 'reddedildi': return 'bg-rose-600 text-white';
    default: return 'bg-neutral-200 text-neutral-700';
  }
}

const ACTIVE_ENDPOINT = (userId: string) => ''; // is_active senk için (isteğe bağlı)
const DELETE_MODAL_ENDPOINT = (userId: string) => ''; // kullanılmıyor; silme satırdan yapılıyor

function DocumentsModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const token = React.useMemo(() => getAuthToken(), []);
  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: 'application/json' };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const [docs, setDocs] = React.useState<DocsResponse['data']>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [localStatus, setLocalStatus] = React.useState<Record<string, string>>({});
  const [isActive, setIsActive] = React.useState<boolean | null>(null);
  const [deleted, setDeleted] = React.useState<boolean | null>(null);
  const [syncingActive, setSyncingActive] = React.useState(false);

  const computeIsActive = React.useCallback(
    (statusMap: Record<string, string>, list: DocsResponse['data']) =>
      list.length > 0 && list.every(d => (statusMap[d.document_id] ?? d.document_status) === 'onaylandi'),
    []
  );

  React.useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/yuksi/Courier/${userId}/get_documents`, { cache: 'no-store', headers });
        const raw: any = await readJson(res);
        if (!res.ok || raw?.success === false) throw new Error(pickMsg(raw, `HTTP ${res.status}`));

        const list: DocsResponse['data'] = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
        setDocs(list);

        const initial: Record<string, string> = {};
        list.forEach(d => { initial[d.document_id] = d.document_status; });
        setLocalStatus(initial);

        const activeNow = typeof raw?.is_active === 'boolean' ? raw.is_active : computeIsActive(initial, list);
        setIsActive(activeNow);
        if (typeof raw?.deleted === 'boolean') setDeleted(raw.deleted);
      } catch (e: any) {
        setError(e?.message || 'Dokümanlar alınamadı.');
        setDocs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [headers, userId, computeIsActive]);

  async function updateStatus(documentId: string) {
    const newStatus = localStatus[documentId];
    if (!newStatus) return;
    setSavingId(documentId);
    try {
      const res = await fetch(`/yuksi/Courier/${userId}/update_documents_status/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ new_status: newStatus }),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      setDocs(prev => prev.map(d => d.document_id === documentId ? { ...d, document_status: newStatus } : d));

      const activeNext = computeIsActive(localStatus, docs.map(d =>
        d.document_id === documentId ? { ...d, document_status: newStatus } : d
      ));
      if (activeNext !== isActive) {
        setIsActive(activeNext);
        const url = ACTIVE_ENDPOINT(userId);
        if (url) {
          try {
            setSyncingActive(true);
            await fetch(url, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({ is_active: activeNext }),
            });
          } finally {
            setSyncingActive(false);
          }
        }
      }
    } catch (e: any) {
      alert(e?.message || 'Statü güncellenemedi.');
    } finally {
      setSavingId(null);
    }
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-8 w-[min(1000px,94vw)] -translate-x-1/2 rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Kurye Dokümanları</h3>
          <button onClick={onClose} className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Kapat">✕</button>
        </div>

        <div className="max-h-[74vh] overflow-auto p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isActive ? 'bg-emerald-500 text-white' : 'bg-neutral-300 text-neutral-800'}`}>
              Aktiflik: {isActive ? 'AKTİF' : 'PASİF'}
            </span>
            {syncingActive && <span className="text-xs text-neutral-500">• Aktiflik güncelleniyor…</span>}
            {typeof deleted === 'boolean' && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${deleted ? 'bg-rose-600 text-white' : 'bg-indigo-500 text-white'}`}>
                {deleted ? 'Silinmiş' : 'Kayıt Duruyor'}
              </span>
            )}
            <span className="text-xs text-neutral-500">Kural: Tüm belgeler <b>onaylandi</b> ise otomatik AKTİF olur.</span>
          </div>

          {loading && <div className="py-12 text-center text-sm text-neutral-500">Yükleniyor…</div>}
          {error && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          {!loading && docs.length === 0 && (
            <div className="py-12 text-center text-sm text-neutral-500">Bu kullanıcı için yüklenmiş doküman yok.</div>
          )}

          {!loading && docs.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map(d => (
                <div key={d.document_id} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                  <div className="aspect-video bg-neutral-50 grid place-items-center">
                    {d.image_url ? (
                      <img src={d.image_url} alt={d.doc_type} className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-neutral-500 text-sm">Önizleme yok</div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{d.doc_type}</div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeByApiStatus(d.document_status)}`}>
                        {d.document_status}
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-500 break-all">
                      Doc ID: <span className="font-mono">{d.document_id}</span>
                    </div>

                    <div className="text-[11px] text-neutral-500">Yüklendi: {fmt(d.uploaded_at ?? undefined)}</div>

                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={localStatus[d.document_id] ?? d.document_status}
                        onChange={(e) => setLocalStatus(s => ({ ...s, [d.document_id]: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1 text-sm"
                      >
                        {DOC_STATUS_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => updateStatus(d.document_id)}
                        disabled={savingId === d.document_id}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingId === d.document_id ? 'Kaydediliyor…' : 'Kaydet'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button onClick={onClose} className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300">
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
