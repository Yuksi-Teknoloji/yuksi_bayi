//src/app/dashboard/company-list/page.tsx
'use client';

import * as React from 'react';
import { RefreshCcw, Loader2, Pencil, Eye } from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';

/* ================= Helpers ================= */

type HeadersDict = HeadersInit;

function bearerHeaders(token?: string | null): HeadersDict {
  const h: HeadersDict = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text().catch(() => '');
  try {
    return t ? JSON.parse(t) : ({} as any);
  } catch {
    return t as any;
  }
}

const msg = (d: any, fb: string) =>
  d?.message || d?.detail || d?.title || d?.error?.message || fb;

/* ================= Types ================= */

type CompanyListItem = {
  id: string;
  companyTrackingNo: string;
  companyName: string;
  companyPhone: string;
  description?: string | null;
  location?: string | null;
  cityId?: number | null;
  stateId?: number | null;
  canReceivePayments: boolean;
  isVisible: boolean;
  specialCommissionRate?: number | null;
  assignedKilometers?: number | null;
  status?: string | null;
};

type CompanyDetail = CompanyListItem & {
  createdAt?: string | null;
  updatedAt?: string | null;
};

type EditFormState = {
  companyTrackingNo: string;
  companyName: string;
  companyPhone: string;
  description: string;
  location: string;
  specialCommissionRate: string;
  assignedKilometers: string;
  isVisible: boolean;
  canReceivePayments: boolean;
  status: string;
};

/* ================= Page ================= */

export default function CompanyListPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo(() => bearerHeaders(token), [token]);

  /* ---- list state ---- */
  const [companies, setCompanies] = React.useState<CompanyListItem[]>([]);
  const [listLoading, setListLoading] = React.useState(false);
  const [listErr, setListErr] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [limit] = React.useState(50);
  const [offset, setOffset] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);

  /* ---- selection / detail ---- */
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailErr, setDetailErr] = React.useState<string | null>(null);

  /* ---- edit form ---- */
  const [editForm, setEditForm] = React.useState<EditFormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  const setEditField = <K extends keyof EditFormState>(
    k: K,
    v: EditFormState[K],
  ) => {
    setEditForm((prev) => (prev ? { ...prev, [k]: v } : prev));
  };

  /* ========== Fetch list ========== */

  const fetchCompanies = React.useCallback(async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const url = new URL('/yuksi/dealer/companies', window.location.origin);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));

      const res = await fetch(url.toString(), {
        headers,
        cache: 'no-store',
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) {
        throw new Error(msg(j, `HTTP ${res.status}`));
      }

      const list: any[] = Array.isArray(j?.data) ? j.data : [];
      const mapped: CompanyListItem[] = list
        .map((c) => ({
          id: String(c?.id ?? ''),
          companyTrackingNo: String(c?.companyTrackingNo ?? ''),
          companyName: String(c?.companyName ?? ''),
          companyPhone: String(c?.companyPhone ?? ''),
          description: c?.description ?? '',
          location: c?.location ?? '',
          cityId: c?.cityId ?? null,
          stateId: c?.stateId ?? null,
          canReceivePayments: !!c?.canReceivePayments,
          isVisible: !!c?.isVisible,
          specialCommissionRate:
            c?.specialCommissionRate != null
              ? Number(c.specialCommissionRate)
              : null,
          assignedKilometers:
            c?.assignedKilometers != null
              ? Number(c.assignedKilometers)
              : null,
          status: c?.status ?? '',
        }))
        .filter((c) => c.id);

      setCompanies(mapped);
      setHasMore(mapped.length === limit);
    } catch (e: any) {
      setCompanies([]);
      setListErr(e?.message || 'Şirket listesi getirilemedi.');
    } finally {
      setListLoading(false);
    }
  }, [headers, limit, offset]);

  React.useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const filteredCompanies = React.useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return companies;
    return companies.filter((c) => {
      return (
        c.companyName.toLowerCase().includes(s) ||
        c.companyTrackingNo.toLowerCase().includes(s) ||
        c.companyPhone.toLowerCase().includes(s) ||
        (c.status ?? '').toLowerCase().includes(s)
      );
    });
  }, [companies, search]);

  /* ========== Fetch detail when selectedId changes ========== */

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEditForm(null);
      setDetailErr(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailErr(null);
      setSaveMsg(null);
      setSaveErr(null);
      try {
        const url = new URL(
          `/yuksi/dealer/companies/${selectedId}`,
          window.location.origin,
        );
        const res = await fetch(url.toString(), {
          headers,
          cache: 'no-store',
        });
        const j: any = await readJson(res);
        if (!res.ok || j?.success === false) {
          throw new Error(msg(j, `HTTP ${res.status}`));
        }
        const d = j?.data ?? j;
        const det: CompanyDetail = {
          id: String(d?.id ?? selectedId),
          companyTrackingNo: String(d?.companyTrackingNo ?? ''),
          companyName: String(d?.companyName ?? ''),
          companyPhone: String(d?.companyPhone ?? ''),
          description: d?.description ?? '',
          location: d?.location ?? '',
          cityId: d?.cityId ?? null,
          stateId: d?.stateId ?? null,
          canReceivePayments: !!d?.canReceivePayments,
          isVisible: !!d?.isVisible,
          specialCommissionRate:
            d?.specialCommissionRate != null
              ? Number(d.specialCommissionRate)
              : null,
          assignedKilometers:
            d?.assignedKilometers != null
              ? Number(d.assignedKilometers)
              : null,
          status: d?.status ?? '',
          createdAt: d?.createdAt ?? '',
          updatedAt: d?.updatedAt ?? '',
        };

        if (cancelled) return;
        setDetail(det);
        setEditForm({
          companyTrackingNo: det.companyTrackingNo,
          companyName: det.companyName,
          companyPhone: det.companyPhone,
          description: det.description ?? '',
          location: det.location ?? '',
          specialCommissionRate:
            det.specialCommissionRate != null
              ? String(det.specialCommissionRate)
              : '',
          assignedKilometers:
            det.assignedKilometers != null
              ? String(det.assignedKilometers)
              : '',
          isVisible: det.isVisible,
          canReceivePayments: det.canReceivePayments,
          status: det.status ?? 'active',
        });
      } catch (e: any) {
        if (!cancelled)
          setDetailErr(e?.message || 'Şirket detayı getirilemedi.');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [headers, selectedId]);

  /* ========== Save (PUT) ========== */

  async function saveChanges(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !editForm) return;

    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);

    try {
      const body: any = {
        companyTrackingNo: editForm.companyTrackingNo.trim(),
        companyName: editForm.companyName.trim(),
        companyPhone: editForm.companyPhone.trim(),
        description: editForm.description.trim(),
        location: editForm.location.trim(),
        specialCommissionRate: editForm.specialCommissionRate
          ? Number(editForm.specialCommissionRate)
          : undefined,
        assignedKilometers: editForm.assignedKilometers
          ? Number(editForm.assignedKilometers)
          : undefined,
        isVisible: editForm.isVisible,
        canReceivePayments: editForm.canReceivePayments,
        status: editForm.status || undefined,
      };

      // boş olanları tamamen kaldır (opsiyonel alanları göndermeyelim)
      Object.keys(body).forEach((k) => {
        if (
          body[k] === undefined ||
          body[k] === null ||
          body[k] === ''
        ) {
          delete body[k];
        }
      });

      const url = new URL(
        `/yuksi/dealer/companies/${selectedId}`,
        window.location.origin,
      );
      const res = await fetch(url.toString(), {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) {
        throw new Error(msg(j, `HTTP ${res.status}`));
      }

      setSaveMsg(j?.message || 'Şirket bilgileri güncellendi.');
      // listeyi refresh et
      fetchCompanies();
    } catch (e: any) {
      setSaveErr(e?.message || 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-white px-4 py-4">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Şirket Listesi
          </h1>
          <p className="text-sm text-neutral-600">
            Bayinize bağlı tüm şirketleri görüntüleyebilir ve
            güncelleyebilirsiniz.
          </p>
        </div>
        <button
          onClick={() => fetchCompanies()}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Listeyi Yenile
        </button>
      </div>

      {/* Global list error */}
      {listErr && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listErr}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ========== Left: table ========== */}
        <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="font-semibold">Şirketlerim</div>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İsim, takip no, telefon…"
                className="w-48 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              {listLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
              )}
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto text-sm">
            <table className="min-w-full border-collapse text-left">
              <thead className="sticky top-0 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="border-b border-neutral-200 px-3 py-2">
                    Takip No
                  </th>
                  <th className="border-b border-neutral-200 px-3 py-2">
                    Şirket Adı
                  </th>
                  <th className="border-b border-neutral-200 px-3 py-2">
                    Telefon
                  </th>
                  <th className="border-b border-neutral-200 px-3 py-2">
                    Komisyon (%)
                  </th>
                  <th className="border-b border-neutral-200 px-3 py-2">
                    Km
                  </th>
                  <th className="border-b border-neutral-200 px-3 py-2">
                    Durum
                  </th>
                  <th className="border-b border-neutral-200 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 && !listLoading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-xs text-neutral-500"
                    >
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                )}
                {filteredCompanies.map((c) => (
                  <tr
                    key={c.id}
                    className={`cursor-pointer border-b border-neutral-100 hover:bg-orange-50/40 ${
                      selectedId === c.id ? 'bg-orange-50/80' : ''
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="px-3 py-2 text-xs font-mono">
                      {c.companyTrackingNo}
                    </td>
                    <td className="px-3 py-2">{c.companyName}</td>
                    <td className="px-3 py-2">{c.companyPhone}</td>
                    <td className="px-3 py-2">
                      {c.specialCommissionRate != null
                        ? c.specialCommissionRate
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {c.assignedKilometers != null
                        ? c.assignedKilometers
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          (c.status ?? '').toLowerCase() === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {c.status || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(c.id);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        Düzenle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-neutral-600">
            <div>
              Offset: {offset} • Gösterilen:{' '}
              {filteredCompanies.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={offset === 0 || listLoading}
                onClick={() =>
                  setOffset((o) => Math.max(0, o - limit))
                }
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1 disabled:opacity-50"
              >
                Önceki
              </button>
              <button
                disabled={!hasMore || listLoading}
                onClick={() => setOffset((o) => o + limit)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1 disabled:opacity-50"
              >
                Sonraki
              </button>
            </div>
          </div>
        </section>

        {/* ========== Right: detail & edit ========== */}
        <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Eye className="h-4 w-4" />
            <div className="font-semibold">
              Şirket Detayı &amp; Güncelle
            </div>
          </div>

          {!selectedId && (
            <div className="flex h-full items-center justify-center px-4 py-10 text-sm text-neutral-500">
              Soldan bir şirket seçerek detaylarını görebilirsin.
            </div>
          )}

          {selectedId && (
            <form
              onSubmit={saveChanges}
              className="grid gap-3 p-4 text-sm"
            >
              {detailLoading && (
                <div className="mb-1 inline-flex items-center gap-2 text-xs text-neutral-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Şirket detayı yükleniyor…
                </div>
              )}
              {detailErr && (
                <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {detailErr}
                </div>
              )}
              {saveErr && (
                <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {saveErr}
                </div>
              )}
              {saveMsg && (
                <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {saveMsg}
                </div>
              )}

              {editForm && (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-neutral-600">
                        Takip No
                      </span>
                      <input
                        value={editForm.companyTrackingNo}
                        onChange={(e) =>
                          setEditField(
                            'companyTrackingNo',
                            e.target.value,
                          )
                        }
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-neutral-600">
                        Durum
                      </span>
                      <select
                        value={editForm.status}
                        onChange={(e) =>
                          setEditField('status', e.target.value)
                        }
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      >
                        <option value="active">active</option>
                        <option value="passive">passive</option>
                        <option value="suspended">suspended</option>
                      </select>
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-600">
                      Şirket Adı
                    </span>
                    <input
                      value={editForm.companyName}
                      onChange={(e) =>
                        setEditField('companyName', e.target.value)
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-600">
                      Şirket Telefonu
                    </span>
                    <input
                      value={editForm.companyPhone}
                      onChange={(e) =>
                        setEditField('companyPhone', e.target.value)
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-600">
                      Konum (adres/POI)
                    </span>
                    <input
                      value={editForm.location}
                      onChange={(e) =>
                        setEditField('location', e.target.value)
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                    />
                  </label>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-neutral-600">
                        Özel Komisyon Oranı (%)
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.specialCommissionRate}
                        onChange={(e) =>
                          setEditField(
                            'specialCommissionRate',
                            e.target.value,
                          )
                        }
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-neutral-600">
                        Atanmış Kilometre (km)
                      </span>
                      <input
                        type="number"
                        value={editForm.assignedKilometers}
                        onChange={(e) =>
                          setEditField(
                            'assignedKilometers',
                            e.target.value,
                          )
                        }
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={editForm.isVisible}
                        onChange={(e) =>
                          setEditField('isVisible', e.target.checked)
                        }
                      />
                      Sistemde görünsün
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={editForm.canReceivePayments}
                        onChange={(e) =>
                          setEditField(
                            'canReceivePayments',
                            e.target.checked,
                          )
                        }
                      />
                      Ödeme alabilsin
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-600">
                      Açıklama
                    </span>
                    <textarea
                      rows={4}
                      value={editForm.description}
                      onChange={(e) =>
                        setEditField('description', e.target.value)
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                    />
                  </label>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[11px] text-neutral-500">
                      {detail?.createdAt && (
                        <div>Oluşturma: {detail.createdAt}</div>
                      )}
                      {detail?.updatedAt && (
                        <div>Son Güncelleme: {detail.updatedAt}</div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-orange-700 disabled:opacity-60"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pencil className="h-4 w-4" />
                      )}
                      Kaydet
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
