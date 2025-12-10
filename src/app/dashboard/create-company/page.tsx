// src/app/dashboard/create-company/page.tsx
'use client';

import * as React from 'react';
import { Link as LinkIcon, RefreshCcw, Loader2 } from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';

/* ---- API payload ---- */
type CreateCompanyBody = {
  companyTrackingNo: string;
  assignedKilometers: number;
  specialCommissionRate: number;
  isVisible: boolean;
  canReceivePayments: boolean;
  stateId: number; // Şehir
  cityId: number; // İlçe
  location: string;
  companyName: string;
  companyPhone: string;
  description: string;
};

/* ---- Form state ---- */
type FormState = {
  companyTrackingNo: string;
  assignedKilometers: string;
  specialCommissionRate: string;
  isVisible: boolean;
  canReceivePayments: boolean;
  location: string;
  companyName: string;
  companyPhone: string;
  description: string;
};

/* ---- Geo tipleri ---- */
type StateOpt = { id: number; name: string };
type CityOpt = { id: number; name: string };

/* ---- Mevcut şirket listesi ---- */
type CompanyOption = {
  id: string;
  companyName: string;
  cityName?: string | null;
  stateName?: string | null;
  status?: string | null;
};

/* ---- helpers ---- */
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text().catch(() => '');
  try {
    return t ? JSON.parse(t) : ({} as any);
  } catch {
    return t as any;
  }
}
const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

function bearerHeaders(token?: string | null): HeadersInit {
  const h: HeadersInit = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

/* ---- constants ---- */
const TR_COUNTRY_ID = 225;

const initialForm: FormState = {
  companyTrackingNo: `COMP-${new Date().getFullYear()}-${Math.floor(
    Math.random() * 9999,
  )
    .toString()
    .padStart(3, '0')}`,
  assignedKilometers: '',
  specialCommissionRate: '',
  isVisible: true,
  canReceivePayments: true,
  location: '',
  companyName: '',
  companyPhone: '',
  description: '',
};

export default function DealerCreateCompanyPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersInit>(
    () => bearerHeaders(token),
    [token],
  );

  const [form, setForm] = React.useState<FormState>(initialForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  /* -------- GEO STATE (ülke=225 sabit) -------- */
  const [states, setStates] = React.useState<StateOpt[]>([]);
  const [stateId, setStateId] = React.useState<number | ''>(''); // ŞEHİR
  const [statesLoading, setStatesLoading] = React.useState(false);
  const [statesError, setStatesError] = React.useState<string | null>(null);

  const [cities, setCities] = React.useState<CityOpt[]>([]);
  const [cityId, setCityId] = React.useState<number | ''>(''); // İLÇE
  const [citiesLoading, setCitiesLoading] = React.useState(false);
  const [citiesError, setCitiesError] = React.useState<string | null>(null);

  // Ülke sabit: 225 → states (şehir) çek
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatesLoading(true);
      setStatesError(null);
      try {
        const url = new URL('/yuksi/geo/states', window.location.origin);
        url.searchParams.set('country_id', String(TR_COUNTRY_ID));
        url.searchParams.set('limit', '500');
        url.searchParams.set('offset', '0');

        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data = await readJson(res);
        if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));

        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.data)
          ? (data as any).data
          : [];

        const mapped: StateOpt[] = list
          .map((s) => ({ id: Number(s?.id), name: String(s?.name ?? '') }))
          .filter((s) => Number.isFinite(s.id) && s.name);

        if (!cancelled) setStates(mapped);
      } catch (e: any) {
        if (!cancelled)
          setStatesError(e?.message || 'Şehir listesi alınamadı.');
      } finally {
        if (!cancelled) setStatesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Şehir (state) değişince cities (ilçe) çek
  React.useEffect(() => {
    setCities([]);
    setCityId('');
    if (stateId === '' || !Number.isFinite(Number(stateId))) return;

    let cancelled = false;
    (async () => {
      setCitiesLoading(true);
      setCitiesError(null);
      try {
        const url = new URL('/yuksi/geo/cities', window.location.origin);
        url.searchParams.set('state_id', String(stateId));
        url.searchParams.set('limit', '1000');
        url.searchParams.set('offset', '0');

        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data = await readJson(res);
        if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));

        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.data)
          ? (data as any).data
          : [];

        const mapped: CityOpt[] = list
          .map((c) => ({ id: Number(c?.id), name: String(c?.name ?? '') }))
          .filter((c) => Number.isFinite(c.id) && c.name);

        if (!cancelled) setCities(mapped);
      } catch (e: any) {
        if (!cancelled)
          setCitiesError(e?.message || 'İlçe listesi alınamadı.');
      } finally {
        if (!cancelled) setCitiesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stateId]);

  /* -------- Yeni şirket oluştur Submit -------- */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);

    if (!form.companyName.trim())
      return setErr('Şirket adı zorunludur.');
    if (!form.companyPhone.trim())
      return setErr('Şirket telefonu zorunludur.');
    if (stateId === '' || cityId === '')
      return setErr('Şehir ve ilçe seçiniz.');

    const body: CreateCompanyBody = {
      companyTrackingNo: form.companyTrackingNo.trim(),
      assignedKilometers: Number(form.assignedKilometers) || 0,
      specialCommissionRate: Number(form.specialCommissionRate) || 0,
      isVisible: !!form.isVisible,
      canReceivePayments: !!form.canReceivePayments,
      stateId: stateId as number,
      cityId: cityId as number,
      location: form.location.trim(),
      companyName: form.companyName.trim(),
      companyPhone: form.companyPhone.trim(),
      description: form.description.trim(),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/yuksi/dealer/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await readJson(res);
      if (!res.ok || (data as any)?.success === false) {
        throw new Error(pickMsg(data, `HTTP ${res.status}`));
      }

      setInfo('Şirket başarıyla oluşturuldu ve bayinize bağlandı.');
      setForm(initialForm);
      setStateId('');
      setCities([]);
      setCityId('');
    } catch (e: any) {
      setErr(e?.message || 'Şirket oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ========== Mevcut şirketi bağla tarafı ========== */

  const [companies, setCompanies] = React.useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = React.useState(false);
  const [companiesError, setCompaniesError] = React.useState<string | null>(
    null,
  );
  const [companiesFilter, setCompaniesFilter] = React.useState('');

  const [bindId, setBindId] = React.useState('');
  const [binding, setBinding] = React.useState(false);
  const [bindErr, setBindErr] = React.useState<string | null>(null);
  const [bindOk, setBindOk] = React.useState<string | null>(null);

  const fetchCompanies = React.useCallback(async () => {
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const url = new URL('/yuksi/admin/companies', window.location.origin);
      url.searchParams.set('limit', '200');
      url.searchParams.set('offset', '0');

      const res = await fetch(url.toString(), {
        headers,
        cache: 'no-store',
      });
      const data: any = await readJson(res);
      if (!res.ok || data?.success === false) {
        throw new Error(pickMsg(data, `HTTP ${res.status}`));
      }

      const list: any[] = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      const mapped: CompanyOption[] = list
        .map((c: any) => ({
          id: String(c?.id ?? ''),
          companyName: String(c?.companyName ?? '—'),
          cityName: c?.cityName ?? null,
          stateName: c?.stateName ?? null,
          status: c?.status ?? null,
        }))
        .filter((x) => x.id);

      setCompanies(mapped);
    } catch (e: any) {
      setCompanies([]);
      setCompaniesError(e?.message || 'Şirket listesi getirilemedi.');
    } finally {
      setCompaniesLoading(false);
    }
  }, [headers]);

  React.useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const companiesFiltered = React.useMemo(() => {
    const s = companiesFilter.trim().toLowerCase();
    if (!s) return companies;
    return companies.filter((c) => {
      const city = (c.cityName ?? '').toLowerCase();
      const state = (c.stateName ?? '').toLowerCase();
      const status = (c.status ?? '').toLowerCase();
      return (
        c.companyName.toLowerCase().includes(s) ||
        city.includes(s) ||
        state.includes(s) ||
        status.includes(s) ||
        c.id.toLowerCase().includes(s)
      );
    });
  }, [companies, companiesFilter]);

  async function bindExistingCompany() {
    if (!bindId.trim()) {
      setBindErr('Lütfen şirket seçin ya da ID girin.');
      return;
    }
    setBinding(true);
    setBindErr(null);
    setBindOk(null);

    try {
      const res = await fetch(`/yuksi/dealer/companies/${bindId.trim()}`, {
        method: 'POST',
        headers,
      });
      const data: any = await readJson(res);
      if (!res.ok || data?.success === false) {
        throw new Error(pickMsg(data, `HTTP ${res.status}`));
      }
      setBindOk(data?.message || 'Şirket bayinize bağlandı.');
      setBindId('');
    } catch (e: any) {
      setBindErr(e?.message || 'Bağlama işlemi başarısız.');
    } finally {
      setBinding(false);
    }
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-6 bg-white">
      {/* Üst başlık */}
      <div className="border-b bg-white px-4 py-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Şirket Yönetimi (Bayi)
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Bayi için yeni şirket oluşturabilir veya mevcut şirketleri
          bayinize bağlayabilirsiniz.
        </p>
      </div>

      {/* Global bildirimler */}
      {(info || err) && (
        <div
          className={`mx-auto max-w-4xl rounded-xl px-4 py-3 text-sm ${
            info
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {info || err}
        </div>
      )}
      {(bindOk || bindErr) && (
        <div
          className={`mx-auto max-w-4xl rounded-xl px-4 py-3 text-sm ${
            bindOk
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {bindOk || bindErr}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-6 px-3 pb-8 lg:grid-cols-2">
        {/* ========== Yeni şirket oluştur & bağla ========== */}
        <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <div className="font-semibold">Yeni Şirket Oluştur & Bağla</div>
            <p className="mt-1 text-xs text-neutral-500">
              Formu doldurarak yeni bir şirket oluşturur ve otomatik
              olarak bayinize bağlar.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-4 p-4 text-sm"
          >
            {/* Genel Ayarlar */}
            <div className="space-y-4 rounded-xl bg-orange-50 p-4 ring-1 ring-orange-100">
              <Field label="Takip No">
                <input
                  value={form.companyTrackingNo}
                  readOnly
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Atanmış Kilometre (km)">
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.assignedKilometers}
                  onChange={(e) =>
                    setField('assignedKilometers', e.target.value)
                  }
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Özel Komisyon Oranı (%)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.specialCommissionRate}
                  onChange={(e) =>
                    setField('specialCommissionRate', e.target.value)
                  }
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Sistemde Görünsün">
                <OnOff
                  on={form.isVisible}
                  onClick={(v) => setField('isVisible', v)}
                />
              </Field>

              <Field label="Ödeme Alabilsin">
                <OnOff
                  on={form.canReceivePayments}
                  onClick={(v) => setField('canReceivePayments', v)}
                />
              </Field>

              {/* Şehir (state) & İlçe (city) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Şehir
                  </label>
                  <select
                    value={stateId}
                    onChange={(e) =>
                      setStateId(
                        e.target.value ? Number(e.target.value) : '',
                      )
                    }
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">
                      {statesLoading ? 'Yükleniyor…' : 'Şehir seçin…'}
                    </option>
                    {statesError && (
                      <option value="">{statesError}</option>
                    )}
                    {!statesLoading &&
                      !statesError &&
                      states.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    İlçe
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) =>
                      setCityId(
                        e.target.value ? Number(e.target.value) : '',
                      )
                    }
                    disabled={!stateId || citiesLoading}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {citiesLoading
                        ? 'Yükleniyor…'
                        : stateId
                        ? 'İlçe seçin…'
                        : 'Önce şehir seçin'}
                    </option>
                    {citiesError && (
                      <option value="">{citiesError}</option>
                    )}
                    {!citiesLoading &&
                      !citiesError &&
                      cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <Field label="Konum (adres/POI)">
                <input
                  value={form.location}
                  onChange={(e) =>
                    setField('location', e.target.value)
                  }
                  placeholder="İstanbul, Kadıköy / depo adresi vb."
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>
            </div>

            {/* Şirket Bilgileri */}
            <div className="space-y-4 rounded-xl bg-orange-50 p-4 ring-1 ring-orange-100">
              <Field label="Şirket Adı">
                <input
                  value={form.companyName}
                  onChange={(e) =>
                    setField('companyName', e.target.value)
                  }
                  placeholder="Kargo ve Lojistik A.Ş."
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Şirket Telefonu">
                <input
                  value={form.companyPhone}
                  onChange={(e) =>
                    setField('companyPhone', e.target.value)
                  }
                  placeholder="+90 5xx xxx xx xx"
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>

              <Field label="Açıklama">
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setField('description', e.target.value)
                  }
                  placeholder="Kargo ve lojistik hizmetleri..."
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-700 disabled:opacity-60"
              >
                {submitting ? 'Gönderiliyor…' : 'Şirketi Oluştur'}
              </button>
            </div>
          </form>
        </section>

        {/* ========== Mevcut şirketi bağla ========== */}
        <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              <div className="font-semibold">Mevcut Şirketi Bağla</div>
            </div>
            <button
              onClick={fetchCompanies}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
              title="Listeyi yenile"
            >
              <RefreshCcw className="h-3 w-3" />
              Yenile
            </button>
          </div>

          <div className="flex flex-col gap-3 p-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span>Şirket Ara</span>
                <input
                  value={companiesFilter}
                  onChange={(e) => setCompaniesFilter(e.target.value)}
                  placeholder="İsim, şehir, durum, ID…"
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1">
                <span>Tüm Şirketler</span>
                <select
                  value={bindId}
                  onChange={(e) => setBindId(e.target.value)}
                  disabled={companiesLoading}
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                >
                  <option value="">
                    {companiesLoading ? 'Yükleniyor…' : 'Seçin…'}
                  </option>
                  {companiesError && (
                    <option value="">{companiesError}</option>
                  )}
                  {!companiesLoading &&
                    !companiesError &&
                    companiesFiltered.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName}
                        {c.cityName ? ` • ${c.cityName}` : ''}
                        {c.stateName ? ` / ${c.stateName}` : ''}
                        {c.status ? ` • ${c.status}` : ''}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1">
              <span>Şirket ID (manuel yazmak istersen)</span>
              <input
                value={bindId}
                onChange={(e) => setBindId(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2"
                placeholder="Şirket UUID / ID"
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={bindExistingCompany}
                disabled={binding || !bindId.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
              >
                {binding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                Bağla
              </button>
              {bindErr && (
                <span className="text-sm text-rose-700">
                  {bindErr}
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---- küçük UI parçaları ---- */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
      <div className="text-sm font-medium text-neutral-700">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function OnOff({
  on,
  onClick,
}: {
  on: boolean;
  onClick: (next: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onClick(true)}
        className={`rounded-md px-3 py-2 text-sm font-semibold shadow-sm ${
          on
            ? 'bg-orange-500 text-white'
            : 'bg-white ring-1 ring-neutral-200'
        }`}
      >
        ON
      </button>
      <button
        type="button"
        onClick={() => onClick(false)}
        className={`rounded-md px-3 py-2 text-sm font-semibold shadow-sm ${
          !on
            ? 'bg-orange-500 text-white'
            : 'bg-white ring-1 ring-neutral-200'
        }`}
      >
        OFF
      </button>
    </div>
  );
}
