// src/app/dashboard/create-management/page.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
  Plus,
  Link as LinkIcon,
  RefreshCcw,
  Loader2,
} from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';

/* ================= Map ================= */
const MapPicker = dynamic(() => import('@/src/components/map/MapPicker'), {
  ssr: false,
});

/* ================= Helpers ================= */
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

const msg = (d: any, fb: string) =>
  d?.message || d?.detail || d?.title || fb;

/* ================= Types ================= */
type GeoPoint = { lat: number; lng: number; address?: string };

type CreateRestaurantBody = {
  name: string;
  email: string;
  phone: string;
  password: string;
  taxNumber: string;
  contactPerson: string;
  addresLine1: string;
  addressLine2?: string;
  cityId: number;
  stateId: number;
  countryId: number;
  latitude?: number;
  longitude?: number;
};

type Country = { id: number; name: string; iso2?: string; iso3?: string; phonecode?: string };
type State   = { id: number; name: string };
type City    = { id: number; name: string };

type AllRestaurantOption = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

/* ================= Page ================= */
export default function CreateManagementPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(() => bearerHeaders(token), [token]);

  // ---- Create form state ----
  const [creating, setCreating] = React.useState(false);
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [createOk, setCreateOk] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<CreateRestaurantBody>({
    name: '',
    email: '',
    phone: '',
    password: '',
    taxNumber: '',
    contactPerson: '',
    addresLine1: '',
    addressLine2: '',
    cityId: 0,
    stateId: 0,
    countryId: 225,
    latitude: undefined,
    longitude: undefined,
  });

  const [geo, setGeo] = React.useState<GeoPoint | null>(null);

  // ---- Geo lists ----
  const [countries, setCountries] = React.useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = React.useState(false);
  const [countriesError, setCountriesError] = React.useState<string | null>(null);

  const [states, setStates] = React.useState<State[]>([]);
  const [statesLoading, setStatesLoading] = React.useState(false);
  const [statesError, setStatesError] = React.useState<string | null>(null);

  const [cities, setCities] = React.useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = React.useState(false);
  const [citiesError, setCitiesError] = React.useState<string | null>(null);

  // ---- Bind existing ----
  const [bindId, setBindId] = React.useState('');
  const [binding, setBinding] = React.useState(false);
  const [bindErr, setBindErr] = React.useState<string | null>(null);
  const [bindOk, setBindOk] = React.useState<string | null>(null);

  const [allRestaurants, setAllRestaurants] = React.useState<AllRestaurantOption[]>([]);
  const [allLoading, setAllLoading] = React.useState(false);
  const [allErr, setAllErr] = React.useState<string | null>(null);
  const [allFilter, setAllFilter] = React.useState('');

  /* ========== GEO lists (countries, states, cities) ========== */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setCountriesLoading(true);
      setCountriesError(null);
      try {
        const url = new URL('/yuksi/geo/countries', location.origin);
        url.searchParams.set('limit', '200');
        url.searchParams.set('offset', '0');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data: any = await readJson(res);
        if (!res.ok) throw new Error(msg(data, `HTTP ${res.status}`));
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const mapped: Country[] = list
          .map((c: any) => ({
            id: Number(c?.id),
            name: String(c?.name ?? ''),
          }))
          .filter((c: Country) => Number.isFinite(c.id) && c.name);
        if (!cancelled) setCountries(mapped);
      } catch (e: any) {
        if (!cancelled)
          setCountriesError(e?.message || 'Ülke listesi alınamadı.');
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    setStates([]);
    setCities([]);
    setForm((f) => ({ ...f, stateId: 0, cityId: 0 }));
    if (!form.countryId) return;

    let cancelled = false;
    (async () => {
      setStatesLoading(true);
      setStatesError(null);
      try {
        const url = new URL('/yuksi/geo/states', location.origin);
        url.searchParams.set('country_id', String(form.countryId));
        url.searchParams.set('limit', '500');
        url.searchParams.set('offset', '0');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data: any = await readJson(res);
        if (!res.ok) throw new Error(msg(data, `HTTP ${res.status}`));
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const mapped: State[] = list
          .map((s: any) => ({
            id: Number(s?.id),
            name: String(s?.name ?? ''),
          }))
          .filter((s: State) => Number.isFinite(s.id) && s.name);
        if (!cancelled) setStates(mapped);
      } catch (e: any) {
        if (!cancelled)
          setStatesError(e?.message || 'Eyalet/İl listesi alınamadı.');
      } finally {
        if (!cancelled) setStatesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.countryId]);

  React.useEffect(() => {
    setCities([]);
    setForm((f) => ({ ...f, cityId: 0 }));
    if (!form.stateId) return;

    let cancelled = false;
    (async () => {
      setCitiesLoading(true);
      setCitiesError(null);
      try {
        const url = new URL('/yuksi/geo/cities', location.origin);
        url.searchParams.set('state_id', String(form.stateId));
        url.searchParams.set('limit', '1000');
        url.searchParams.set('offset', '0');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data: any = await readJson(res);
        if (!res.ok) throw new Error(msg(data, `HTTP ${res.status}`));
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const mapped: City[] = list
          .map((c: any) => ({
            id: Number(c?.id),
            name: String(c?.name ?? ''),
          }))
          .filter((c: City) => Number.isFinite(c.id) && c.name);
        if (!cancelled) setCities(mapped);
      } catch (e: any) {
        if (!cancelled)
          setCitiesError(e?.message || 'Şehir listesi alınamadı.');
      } finally {
        if (!cancelled) setCitiesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.stateId]);

  /* ========== Create Restaurant ========== */
  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateErr(null);
    setCreateOk(null);

    if (!geo?.lat || !geo?.lng) {
      setCreating(false);
      setCreateErr('Lütfen haritadan restoran konumunu seçin.');
      return;
    }

    try {
      const body: CreateRestaurantBody = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        taxNumber: form.taxNumber,
        contactPerson: form.contactPerson,
        addresLine1: form.addresLine1,
        addressLine2: form.addressLine2 || '',
        countryId: Number(form.countryId),
        stateId: Number(form.stateId),
        cityId: Number(form.cityId),
        latitude: Number(geo.lat.toFixed(6)),
        longitude: Number(geo.lng.toFixed(6)),
      };

      const res = await fetch('/yuksi/dealer/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) {
        throw new Error(msg(j, `HTTP ${res.status}`));
      }

      setCreateOk(
        j?.message || 'Restoran oluşturuldu ve bayiye bağlandı.',
      );
      setForm((f) => ({
        ...f,
        name: '',
        email: '',
        phone: '',
        password: '',
        taxNumber: '',
        contactPerson: '',
        addresLine1: '',
        addressLine2: '',
      }));
      setGeo(null);
    } catch (e: any) {
      setCreateErr(e?.message || 'Oluşturma başarısız.');
    } finally {
      setCreating(false);
    }
  }

  /* ========== Fetch ALL restaurants for binding select ========== */
  const fetchAllRestaurants = React.useCallback(async () => {
    setAllLoading(true);
    setAllErr(null);
    try {
      const res = await fetch('/yuksi/Restaurant/list', {
        headers,
        cache: 'no-store',
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) {
        throw new Error(msg(j, `HTTP ${res.status}`));
      }

      const list = Array.isArray(j?.data)
        ? j.data
        : Array.isArray(j)
        ? j
        : [];
      const mapped: AllRestaurantOption[] = list
        .map((r: any) => ({
          id: String(r?.id ?? ''),
          name: String(r?.name ?? '—'),
          email: r?.email ?? null,
          phone: r?.phone ?? null,
        }))
        .filter((x: AllRestaurantOption) => x.id);
      setAllRestaurants(mapped);
    } catch (e: any) {
      setAllRestaurants([]);
      setAllErr(e?.message || 'Restoran listesi getirilemedi.');
    } finally {
      setAllLoading(false);
    }
  }, [headers]);

  React.useEffect(() => {
    fetchAllRestaurants();
  }, [fetchAllRestaurants]);

  React.useEffect(() => {
    fetchAllRestaurants();
  }, []); // sayfa açılınca bir kere daha

  const allFiltered = React.useMemo(() => {
    const s = allFilter.trim().toLowerCase();
    if (!s) return allRestaurants;
    return allRestaurants.filter((r: AllRestaurantOption) =>
      r.name.toLowerCase().includes(s) ||
      (r.email ?? '').toLowerCase().includes(s) ||
      (r.phone ?? '').toLowerCase().includes(s) ||
      r.id.toLowerCase().includes(s),
    );
  }, [allRestaurants, allFilter]);

  /* ========== Bind existing restaurant ========== */
  async function bindExisting() {
    if (!bindId.trim()) {
      setBindErr('Lütfen restoran seçin ya da UUID girin.');
      return;
    }
    setBinding(true);
    setBindErr(null);
    setBindOk(null);
    try {
      const res = await fetch('/yuksi/dealer/restaurants/restourant_id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ restaurant_id: bindId.trim() }),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) {
        throw new Error(msg(j, `HTTP ${res.status}`));
      }
      setBindOk(j?.message || 'Restoran bayiye bağlandı.');
      setBindId('');
    } catch (e: any) {
      setBindErr(e?.message || 'Bağlama başarısız.');
    } finally {
      setBinding(false);
    }
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Restoran Yönetimi
          </h1>
          <p className="text-sm text-neutral-600">
            Yeni restoran oluşturabilir veya mevcut restoranları bayinize
            bağlayabilirsiniz.
          </p>
        </div>
      </div>

      {/* Global notifications */}
      {(createOk || createErr) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            createOk
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {createOk || createErr}
        </div>
      )}
      {(bindOk || bindErr) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            bindOk
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {bindOk || bindErr}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ========== Yeni restoran oluştur & bağla ========== */}
        <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Plus className="h-4 w-4" />
            <div className="font-semibold">Yeni Restoran Oluştur & Bağla</div>
          </div>

          <form
            onSubmit={submitCreate}
            className="grid gap-4 p-4 text-sm"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span>Restoran Adı *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1">
                <span>Yetkili Kişi *</span>
                <input
                  required
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contactPerson: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1">
                <span>Telefon *</span>
                <input
                  required
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1">
                <span>E-posta *</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1">
                <span>Şifre *</span>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1">
                <span>Vergi No *</span>
                <input
                  required
                  value={form.taxNumber}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      taxNumber: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span>Adres Satırı 1 *</span>
                <input
                  required
                  value={form.addresLine1}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      addresLine1: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span>Adres Satırı 2</span>
                <input
                  value={form.addressLine2}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      addressLine2: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>

              {/* Geo selects */}
              <label className="grid gap-1">
                <span>Ülke *</span>
                <select
                  value={form.countryId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      countryId: Number(e.target.value),
                    }))
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                >
                  <option value="">
                    {countriesLoading
                      ? 'Yükleniyor…'
                      : 'Ülke seçin…'}
                  </option>
                  {countriesError && (
                    <option value="">{countriesError}</option>
                  )}
                  {!countriesLoading &&
                    !countriesError &&
                    countries.map((c: Country) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span>İl / State *</span>
                <select
                  value={form.stateId || ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      stateId: Number(e.target.value),
                    }))
                  }
                  disabled={!form.countryId || statesLoading}
                  className="rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-60"
                >
                  <option value="">
                    {statesLoading
                      ? 'Yükleniyor…'
                      : form.countryId
                      ? 'İl seçin…'
                      : 'Önce ülke'}
                  </option>
                  {statesError && (
                    <option value="">{statesError}</option>
                  )}
                  {!statesLoading &&
                    !statesError &&
                    states.map((s: State) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span>Şehir *</span>
                <select
                  value={form.cityId || ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cityId: Number(e.target.value),
                    }))
                  }
                  disabled={!form.stateId || citiesLoading}
                  className="rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-60"
                >
                  <option value="">
                    {citiesLoading
                      ? 'Yükleniyor…'
                      : form.stateId
                      ? 'Şehir seçin…'
                      : 'Önce il'}
                  </option>
                  {citiesError && (
                    <option value="">{citiesError}</option>
                  )}
                  {!citiesLoading &&
                    !citiesError &&
                    cities.map((c: City) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {/* Map picker */}
            <div className="mt-2">
              <MapPicker
                label="Restoran Konumu (haritaya tıkla)"
                value={geo}
                onChange={(p) => setGeo(p)}
                defaultCenter={{ lat: 41.015137, lng: 28.97953 }}
              />
              {!geo && (
                <p className="mt-2 text-xs text-amber-600">
                  Konum seçilmedi.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Oluştur & Bağla
              </button>
              {createErr && (
                <span className="text-sm text-rose-700">
                  {createErr}
                </span>
              )}
            </div>
          </form>
        </section>

        {/* ========== Mevcut restoranı bağla ========== */}
        <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              <div className="font-semibold">Mevcut Restoranı Bağla</div>
            </div>
            <button
              onClick={fetchAllRestaurants}
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
                <span>Restoran Ara</span>
                <input
                  value={allFilter}
                  onChange={(e) => setAllFilter(e.target.value)}
                  placeholder="İsim, e-posta, telefon, UUID…"
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1">
                <span>Tüm Restoranlar</span>
                <select
                  value={bindId}
                  onChange={(e) => setBindId(e.target.value)}
                  disabled={allLoading}
                  className="rounded-lg border border-neutral-300 px-3 py-2"
                >
                  <option value="">
                    {allLoading ? 'Yükleniyor…' : 'Seçin…'}
                  </option>
                  {allErr && <option value="">{allErr}</option>}
                  {!allLoading &&
                    !allErr &&
                    allFiltered.map((r: AllRestaurantOption) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.email ? ` • ${r.email}` : ''}
                        {r.phone ? ` • ${r.phone}` : ''} • {r.id}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1">
              <span>UUID (manuel yazmak istersen)</span>
              <input
                value={bindId}
                onChange={(e) => setBindId(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2"
                placeholder="123e4567-e89b-12d3-a456-426614174000"
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={bindExisting}
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
