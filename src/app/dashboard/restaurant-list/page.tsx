// src/app/dashboard/restaurant-list/page.tsx (dealer restoran listesi)
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
  Plus, Link as LinkIcon, RefreshCcw, Search, Eye, Trash2,
  Loader2, ChevronLeft, ChevronRight, MapPin
} from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';

/* ================= Map ================= */
const MapPicker = dynamic(() => import('@/src/components/map/MapPicker'), { ssr: false });
const LiveLeaflet = dynamic(() => import('@/src/components/map/LiveLeaflet'), { ssr: false });

type GeoPoint = { lat: number; lng: number; address?: string };

/* ================= Helpers ================= */
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
const fmtDT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—');

/* ================= Types ================= */
type RestaurantRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  tax_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city_name?: string | null;
  state_name?: string | null;
  country_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opening_hour?: string | null;
  closing_hour?: string | null;
  created_at?: string | null;
};

type ProfileResponse = {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  contactPerson?: string | null;
  taxNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  fullAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openingHour?: string | null;
  closingHour?: string | null;
  createdAt?: string | null;
  linkedAt?: string | null;
  location?: {
    cityId?: number | null; cityName?: string | null;
    stateId?: number | null; stateName?: string | null;
    countryId?: number | null; countryName?: string | null;
  } | null;
};

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

type AllRestaurantOption = { id: string; name: string; email?: string | null; phone?: string | null };

/* ================= Page ================= */
export default function DealerRestaurantListPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(() => bearerHeaders(token), [token]);

  // List
  const [rows, setRows] = React.useState<RestaurantRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState<number>(20);
  const [offset, setOffset] = React.useState<number>(0);
  const [q, setQ] = React.useState('');

  // Profile Drawer / Marker info
  const [profileId, setProfileId] = React.useState<string | null>(null);
  const [profileJson, setProfileJson] = React.useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [profileErr, setProfileErr] = React.useState<string | null>(null);

  // Harita seçili marker
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // ===== Create =====
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [createOk, setCreateOk] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<CreateRestaurantBody>({
    name: '', email: '', phone: '', password: '',
    taxNumber: '', contactPerson: '',
    addresLine1: '', addressLine2: '',
    cityId: 0, stateId: 0, countryId: 225,
    latitude: undefined, longitude: undefined,
  });

  // Geo lists
  const [countries, setCountries]               = React.useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = React.useState(false);
  const [countriesError, setCountriesError]     = React.useState<string | null>(null);
  const [states, setStates]               = React.useState<State[]>([]);
  const [statesLoading, setStatesLoading] = React.useState(false);
  const [statesError, setStatesError]     = React.useState<string | null>(null);
  const [cities, setCities]               = React.useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = React.useState(false);
  const [citiesError, setCitiesError]     = React.useState<string | null>(null);
  const [geo, setGeo] = React.useState<GeoPoint | null>(null);

  // Bind existing
  const [bindId, setBindId] = React.useState('');
  const [binding, setBinding] = React.useState(false);
  const [bindErr, setBindErr] = React.useState<string | null>(null);
  const [bindOk, setBindOk] = React.useState<string | null>(null);

  // All restaurants (for binding select)
  const [allRestaurants, setAllRestaurants] = React.useState<AllRestaurantOption[]>([]);
  const [allLoading, setAllLoading] = React.useState(false);
  const [allErr, setAllErr] = React.useState<string | null>(null);
  const [allFilter, setAllFilter] = React.useState('');

  // Unbind
  const [removingId, setRemovingId] = React.useState<string>('');

  /* ========== Load list ========== */
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('offset', String(offset));
      if (limit) qs.set('limit', String(limit));
      const res = await fetch(`/yuksi/dealer/restaurants?${qs.toString()}`, {
        cache: 'no-store',
        headers,
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(msg(j, `HTTP ${res.status}`));

      const list = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      const mapped: RestaurantRow[] = list.map((r: any) => ({
        id: String(r?.id ?? ''), name: String(r?.name ?? '—'),
        email: r?.email ?? null, phone: r?.phone ?? null,
        contact_person: r?.contact_person ?? null,
        tax_number: r?.tax_number ?? null,
        address_line1: r?.address_line1 ?? null,
        address_line2: r?.address_line2 ?? null,
        city_name: r?.city_name ?? null, state_name: r?.state_name ?? null, country_name: r?.country_name ?? null,
        latitude: typeof r?.latitude === 'number' ? r.latitude : (r?.latitude ? Number(r.latitude) : null),
        longitude: typeof r?.longitude === 'number' ? r.longitude : (r?.longitude ? Number(r.longitude) : null),
        opening_hour: r?.opening_hour ?? null, closing_hour: r?.closing_hour ?? null,
        created_at: r?.created_at ?? null,
      })).filter((r: RestaurantRow) => r.id);

      setRows(mapped);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'Restoranlar alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [headers, limit, offset]);

  React.useEffect(() => { load(); }, [load]);

  const rowsFiltered = React.useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r: RestaurantRow) =>
      r.name.toLowerCase().includes(s) ||
      (r.email ?? '').toLowerCase().includes(s) ||
      (r.phone ?? '').toLowerCase().includes(s) ||
      r.id.toLowerCase().includes(s) ||
      (r.city_name ?? '').toLowerCase().includes(s)
    );
  }, [rows, q]);

//Delete relationship
  const unbind = React.useCallback(async (id: string) => {
  if (typeof window !== 'undefined') {
    const ok = window.confirm('Bu restoranın bayi bağlantısını kaldırmak istiyor musunuz? (Restoran silinmez)');
    if (!ok) return;
  }
  setRemovingId(id);
  try {
    const res = await fetch(`/yuksi/dealer/restaurants/${id}`, { method: 'DELETE', headers });
    const j: unknown = await readJson(res);
    if (!res.ok || (j as any)?.success === false) throw new Error(msg(j, `HTTP ${res.status}`));
    await load();
  } catch (e: any) {
    alert(e?.message || 'Bağlantı kaldırılamadı.');
  } finally {
    setRemovingId('');
  }
}, [headers, load]);

  /* ========== Profile fetch ========== */
  async function openProfile(id: string) {
    setProfileId(id);
    setProfileLoading(true);
    setProfileErr(null);
    setProfileJson(null);
    try {
      const res = await fetch(`/yuksi/dealer/restaurants/${id}`, { cache: 'no-store', headers });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(msg(j, `HTTP ${res.status}`));
      // j.data doğrudan ProfileResponse uyumlu
      setProfileJson((j?.data ?? j) as ProfileResponse);
    } catch (e: any) {
      setProfileErr(e?.message || 'Profil getirilemedi.');
    } finally {
      setProfileLoading(false);
    }
  }

  /* ========== GEO lists (create) ========== */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setCountriesLoading(true); setCountriesError(null);
      try {
        const url = new URL('/yuksi/geo/countries', location.origin);
        url.searchParams.set('limit', '200'); url.searchParams.set('offset', '0');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data: any = await readJson(res);
        if (!res.ok) throw new Error(msg(data, `HTTP ${res.status}`));
        const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const mapped: Country[] = list.map((c: any) => ({ id: Number(c?.id), name: String(c?.name ?? '') }))
                                      .filter((c: Country) => Number.isFinite(c.id) && c.name);
        if (!cancelled) setCountries(mapped);
      } catch (e: any) {
        if (!cancelled) setCountriesError(e?.message || 'Ülke listesi alınamadı.');
      } finally { if (!cancelled) setCountriesLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    setStates([]); setCities([]); setForm(f => ({ ...f, stateId: 0, cityId: 0 }));
    if (!form.countryId) return;
    let cancelled = false;
    (async () => {
      setStatesLoading(true); setStatesError(null);
      try {
        const url = new URL('/yuksi/geo/states', location.origin);
        url.searchParams.set('country_id', String(form.countryId));
        url.searchParams.set('limit', '500'); url.searchParams.set('offset', '0');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data: any = await readJson(res);
        if (!res.ok) throw new Error(msg(data, `HTTP ${res.status}`));
        const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const mapped: State[] = list.map((s: any) => ({ id: Number(s?.id), name: String(s?.name ?? '') }))
                                    .filter((s: State) => Number.isFinite(s.id) && s.name);
        if (!cancelled) setStates(mapped);
      } catch (e: any) {
        if (!cancelled) setStatesError(e?.message || 'Eyalet/İl listesi alınamadı.');
      } finally { if (!cancelled) setStatesLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [form.countryId]);

  React.useEffect(() => {
    setCities([]); setForm(f => ({ ...f, cityId: 0 }));
    if (!form.stateId) return;
    let cancelled = false;
    (async () => {
      setCitiesLoading(true); setCitiesError(null);
      try {
        const url = new URL('/yuksi/geo/cities', location.origin);
        url.searchParams.set('state_id', String(form.stateId));
        url.searchParams.set('limit', '1000'); url.searchParams.set('offset', '0');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data: any = await readJson(res);
        if (!res.ok) throw new Error(msg(data, `HTTP ${res.status}`));
        const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const mapped: City[] = list.map((c: any) => ({ id: Number(c?.id), name: String(c?.name ?? '') }))
                                   .filter((c: City) => Number.isFinite(c.id) && c.name);
        if (!cancelled) setCities(mapped);
      } catch (e: any) {
        if (!cancelled) setCitiesError(e?.message || 'Şehir listesi alınamadı.');
      } finally { if (!cancelled) setCitiesLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [form.stateId]);

  /* ========== Create ========== */
  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateErr(null); setCreateOk(null);

    if (!geo?.lat || !geo?.lng) {
      setCreating(false);
      setCreateErr('Lütfen haritadan restoran konumunu seçin.');
      return;
    }

    try {
      const body: CreateRestaurantBody = {
        name: form.name, email: form.email, phone: form.phone, password: form.password,
        taxNumber: form.taxNumber, contactPerson: form.contactPerson,
        addresLine1: form.addresLine1, addressLine2: form.addressLine2 || '',
        countryId: Number(form.countryId), stateId: Number(form.stateId), cityId: Number(form.cityId),
        latitude: Number(geo.lat.toFixed(6)), longitude: Number(geo.lng.toFixed(6)),
      };

      const res = await fetch('/yuksi/dealer/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(msg(j, `HTTP ${res.status}`));
      setCreateOk(j?.message || 'Restoran oluşturuldu ve bayiye bağlandı.');
      await load();
      setForm((f) => ({ ...f, name: '', email: '', phone: '', password: '', taxNumber: '', contactPerson: '', addresLine1: '', addressLine2: '' }));
      setGeo(null);
    } catch (e: any) {
      setCreateErr(e?.message || 'Oluşturma başarısız.');
    } finally {
      setCreating(false);
    }
  }

  /* ========== Fetch ALL restaurants for binding select ========== */
  const fetchAllRestaurants = React.useCallback(async () => {
    setAllLoading(true); setAllErr(null);
    try {
      const res = await fetch('/yuksi/Restaurant/list', { headers, cache: 'no-store' });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(msg(j, `HTTP ${res.status}`));
      const list = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      const mapped: AllRestaurantOption[] = list.map((r: any) => ({
        id: String(r?.id ?? ''),
        name: String(r?.name ?? '—'),
        email: r?.email ?? null,
        phone: r?.phone ?? null,
      })).filter((x: AllRestaurantOption) => x.id);
      setAllRestaurants(mapped);
    } catch (e: any) {
      setAllRestaurants([]);
      setAllErr(e?.message || 'Restoran listesi getirilemedi.');
    } finally {
      setAllLoading(false);
    }
  }, [headers]);

  React.useEffect(() => { fetchAllRestaurants(); }, [fetchAllRestaurants]);
  React.useEffect(() => { if (createOpen) fetchAllRestaurants(); }, [createOpen, fetchAllRestaurants]);

  const allFiltered = React.useMemo(() => {
    const s = allFilter.trim().toLowerCase();
    if (!s) return allRestaurants;
    return allRestaurants.filter((r: AllRestaurantOption) =>
      r.name.toLowerCase().includes(s) ||
      (r.email ?? '').toLowerCase().includes(s) ||
      (r.phone ?? '').toLowerCase().includes(s) ||
      r.id.toLowerCase().includes(s)
    );
  }, [allRestaurants, allFilter]);

  /* ========== Bind existing ========== */
  async function bindExisting() {
    if (!bindId.trim()) {
      setBindErr('Lütfen restoran seçin ya da UUID girin.');
      return;
    }
    setBinding(true); setBindErr(null); setBindOk(null);
    try {
      const res = await fetch('/yuksi/dealer/restaurants/restourant_id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ restaurant_id: bindId.trim() }),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(msg(j, `HTTP ${res.status}`));
      setBindOk(j?.message || 'Restoran bayiye bağlandı.');
      setBindId('');
      await load();
    } catch (e: any) {
      setBindErr(e?.message || 'Bağlama başarısız.');
    } finally {
      setBinding(false);
    }
  }

  /* ====== Harita marker listesi ====== */
  type LeafletMarker = { id: string; name: string; phone: string; lat: number; lng: number };
  const markers: LeafletMarker[] = React.useMemo(() => {
    return rowsFiltered
      .filter((r: RestaurantRow) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
      .map((r: RestaurantRow): LeafletMarker => ({
        id: r.id,
        name: r.name,
        phone: r.phone || '',
        lat: Number(r.latitude as number),
        lng: Number(r.longitude as number),
      }));
  }, [rowsFiltered]);

  // marker tıklanınca panel + profil yükleme
  function handleSelectMarker(id: string) {
    setSelectedId(id);
    openProfile(id); // ayrıntıyı getir
  }

  const selectedFromList: RestaurantRow | undefined = React.useMemo(
    () => rows.find((r: RestaurantRow) => r.id === (selectedId || profileId)),
    [rows, selectedId, profileId]
  );

  /* ========== UI ========== */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Restoranlar (Bayi)</h1>
          <p className="text-sm text-neutral-600">Bayinize bağlı restoranları yönetin.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
            title="Yeni restoran oluştur"
          >
            <Plus className="h-4 w-4" />
            Yeni Restoran
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            title="Yenile"
          >
            <RefreshCcw className="h-4 w-4" />
            Yenile
          </button>
        </div>
      </div>

      {/* Notifications */}
      {(createOk || createErr) && (
        <div className={`rounded-xl px-4 py-3 text-sm ${createOk ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
          {createOk || createErr}
        </div>
      )}
      {(bindOk || bindErr) && (
        <div className={`rounded-xl px-4 py-3 text-sm ${bindOk ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
          {bindOk || bindErr}
        </div>
      )}

      {/* === HARİTA + DETAY PANELİ === */}
      <section className="mt-6 rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <MapPin className="h-4 w-4" />
          <div className="font-semibold">Harita</div>
          <span className="ml-2 text-xs text-neutral-500">({markers.length} konum)</span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr,380px]">
          <div className="p-3">
            <LiveLeaflet
              markers={markers}
              selectedId={selectedId}
              onSelect={handleSelectMarker}
            />
          </div>

          <aside className="border-t lg:border-l lg:border-t-0">
            <div className="p-4">
              <div className="mb-2 font-semibold">Seçili Restoran</div>

              {!selectedId && <div className="text-sm text-neutral-500">Haritadaki bir işarete tıklayın.</div>}

              {selectedId && (
                <>
                  {/* hızlı bilgi listeden */}
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                    <div className="font-medium">{selectedFromList?.name ?? '—'}</div>
                    <div className="mt-1 grid gap-1 text-[13px]">
                      <div>E-posta: <b>{selectedFromList?.email ?? '—'}</b></div>
                      <div>Telefon: <b>{selectedFromList?.phone ?? '—'}</b></div>
                      <div>Adres: <b>{selectedFromList?.address_line1 ?? '—'}</b></div>
                      <div>Konum: <b>{(selectedFromList?.latitude ?? '—')}, {(selectedFromList?.longitude ?? '—')}</b></div>
                    </div>
                  </div>

                  {/* API’den ayrıntı */}
                  <div className="mt-3 rounded-xl border border-neutral-200 p-3 text-sm">
                    {profileLoading && <div className="text-neutral-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Ayrıntılar yükleniyor…</div>}
                    {profileErr && <div className="text-rose-700">{profileErr}</div>}
                    {!profileLoading && !profileErr && profileJson && (
                      <div className="grid gap-1">
                        <div>Tam Adres: <b>{profileJson.fullAddress ?? profileJson.addressLine1 ?? '—'}</b></div>
                        <div>Saat: <b>{profileJson.openingHour ?? '—'} / {profileJson.closingHour ?? '—'}</b></div>
                        <div>Şehir/Ülke: <b>{profileJson.location?.cityName ?? '—'} / {profileJson.location?.countryName ?? '—'}</b></div>
                        <div>Oluşturma: <b>{fmtDT(profileJson.createdAt ?? null)}</b></div>
                        <div>Bağlanma: <b>{fmtDT(profileJson.linkedAt ?? null)}</b></div>
                      </div>
                    )}
                    <div className="mt-2">
                      <button
                        onClick={() => openProfile(selectedId)}
                        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                      >
                        <Eye className="h-4 w-4" /> Ayrıntıları Yeniden Getir
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Create & Bind */}
      {createOpen && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Create */}
          <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Plus className="h-4 w-4" />
              <div className="font-semibold">Yeni Restoran Oluştur & Bağla</div>
            </div>
            <form onSubmit={submitCreate} className="grid gap-4 p-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* form alanları */}
                <label className="grid gap-1"><span>Restoran Adı *</span>
                  <input required value={form.name} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} className="rounded-lg border border-neutral-300 px-3 py-2" />
                </label>
                <label className="grid gap-1"><span>Yetkili Kişi *</span>
                  <input required value={form.contactPerson} onChange={(e)=>setForm(f=>({...f,contactPerson:e.target.value}))} className="rounded-lg border border-neutral-300 px-3 py-2" />
                </label>
                <label className="grid gap-1"><span>Telefon *</span>
                  <input required value={form.phone} onChange={(e)=>setForm(f=>({...f,phone:e.target.value}))} className="rounded-lg border border-neutral-300 px-3 py-2" />
                </label>
                <label className="grid gap-1"><span>E-posta *</span>
                  <input required type="email" value={form.email} onChange={(e)=>setForm(f=>({...f,email:e.target.value}))} className="rounded-lg border border-neutral-300 px-3 py-2" />
                </label>
                <label className="grid gap-1"><span>Şifre *</span>
                  <input required type="password" value={form.password} onChange={(e)=>setForm(f=>({...f,password:e.target.value}))} className="rounded-lg border border-neutral-300 px-3 py-2" />
                </label>
                <label className="grid gap-1"><span>Vergi No *</span>
                  <input required value={form.taxNumber} onChange={(e)=>setForm(f=>({...f,taxNumber:e.target.value}))} className="rounded-lg border border-neutral-300 px-3 py-2" />
                </label>
                <label className="sm:col-span-2 grid gap-1"><span>Adres Satırı 1 *</span>
                  <input required value={form.addresLine1} onChange={(e)=>setForm(f=>({...f,addresLine1:e.target.value}))} className="rounded-lg border border-neutral-300 px-3 py-2" />
                </label>
                <label className="sm:col-span-2 grid gap-1"><span>Adres Satırı 2</span>
                  <input value={form.addressLine2} onChange={(e)=>setForm(f=>({...f,addressLine2:e.target.value}))} className="rounded-lg border border-neutral-300 px-3 py-2" />
                </label>
                {/* Geo selects */}
                <label className="grid gap-1"><span>Ülke *</span>
                  <select value={form.countryId} onChange={(e)=>setForm(f=>({...f,countryId:Number(e.target.value)}))} className="rounded-lg border border-neutral-300 px-3 py-2">
                    <option value="">{countriesLoading?'Yükleniyor…':'Ülke seçin…'}</option>
                    {countriesError && <option value="">{countriesError}</option>}
                    {!countriesLoading && !countriesError && countries.map((c: Country)=> <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1"><span>İl / State *</span>
                  <select value={form.stateId||''} onChange={(e)=>setForm(f=>({...f,stateId:Number(e.target.value)}))} disabled={!form.countryId||statesLoading} className="rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-60">
                    <option value="">{statesLoading?'Yükleniyor…':(form.countryId?'İl seçin…':'Önce ülke')}</option>
                    {statesError && <option value="">{statesError}</option>}
                    {!statesLoading && !statesError && states.map((s: State)=> <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1"><span>Şehir *</span>
                  <select value={form.cityId||''} onChange={(e)=>setForm(f=>({...f,cityId:Number(e.target.value)}))} disabled={!form.stateId||citiesLoading} className="rounded-lg border border-neutral-300 px-3 py-2 disabled:opacity-60">
                    <option value="">{citiesLoading?'Yükleniyor…':(form.stateId?'Şehir seçin…':'Önce il')}</option>
                    {citiesError && <option value="">{citiesError}</option>}
                    {!citiesLoading && !citiesError && cities.map((c: City)=> <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>

              {/* Map */}
              <div className="mt-2">
                <MapPicker label="Restoran Konumu (haritaya tıkla)" value={geo} onChange={(p)=>setGeo(p)} defaultCenter={{ lat: 41.015137, lng: 28.97953 }} />
                {!geo && <p className="mt-2 text-xs text-amber-600">Konum seçilmedi.</p>}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Oluştur & Bağla
                </button>
                {createErr && <span className="text-sm text-rose-700">{createErr}</span>}
              </div>
            </form>
          </section>

          {/* Bind existing (selectbox ile) */}
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
                    <option value="">{allLoading ? 'Yükleniyor…' : 'Seçin…'}</option>
                    {allErr && <option value="">{allErr}</option>}
                    {!allLoading && !allErr && allFiltered.map((r: AllRestaurantOption) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.email ? `• ${r.email}` : ''} {r.phone ? `• ${r.phone}` : ''} • {r.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span>UUID (manuel yazmak istersen)</span>
                  <input
                    value={bindId}
                    onChange={(e) => setBindId(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2"
                    placeholder="123e4567-e89b-12d3-a456-426614174000"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={bindExisting}
                  disabled={binding || !bindId.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
                >
                  {binding ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                  Bağla
                </button>
                {bindErr && <span className="text-sm text-rose-700">{bindErr}</span>}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* List */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="font-semibold">Restoran Listesi</div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ara… (ad, e-posta, telefon, UUID)"
                className="w-64 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 pl-8 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
              <Search className="pointer-events-none absolute left-2 top-1.5 h-4 w-4 text-neutral-400" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setOffset((o) => Math.max(0, o - (limit || 20)))} className="rounded-lg border border-neutral-300 bg-white p-1.5 hover:bg-neutral-50" title="Geri">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-neutral-600">offset {offset}</span>
              <button onClick={() => setOffset((o) => o + (limit || 20))} className="rounded-lg border border-neutral-300 bg-white p-1.5 hover:bg-neutral-50" title="İleri">
                <ChevronRight className="h-4 w-4" />
              </button>
              <select value={limit} onChange={(e) => { setOffset(0); setLimit(Number(e.target.value)); }} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm" title="Sayfa boyutu">
                {[10, 20, 50, 100, 200].map((n: number) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-4 py-2">Ad</th>
                <th className="px-4 py-2">İletişim</th>
                <th className="px-4 py-2">Adres</th>
                <th className="px-4 py-2">Saatler</th>
                <th className="px-4 py-2">Oluşturma</th>
                <th className="px-4 py-2 w-40">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltered.map((r: RestaurantRow) => (
                <tr key={r.id} className="border-t text-sm">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-neutral-500">{r.id}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div>{r.email || '—'}</div>
                    <div className="text-[12px] text-neutral-500">{r.phone || '—'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div>{r.address_line1 || '—'}</div>
                    <div className="text-[12px] text-neutral-500">
                      {[r.address_line2, r.city_name, r.state_name, r.country_name].filter(Boolean).join(', ') || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {(r.opening_hour || r.closing_hour) ? `${r.opening_hour ?? '—'} / ${r.closing_hour ?? '—'}` : '—'}
                  </td>
                  <td className="px-4 py-2">{fmtDT(r.created_at)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => { setSelectedId(r.id); openProfile(r.id);} } className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50" title="Haritada/Panelde Gör">
                        <MapPin className="h-4 w-4" /> Haritada
                      </button>
                      <button onClick={() => openProfile(r.id)} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50" title="Profili Gör">
                        <Eye className="h-4 w-4" /> Gör
                      </button>
                      <button
                        onClick={() => unbind(r.id)}
                        disabled={removingId === r.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700 disabled:opacity-60"
                        title="Bayi bağlantısını kaldır"
                      >
                        {removingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Bağlantıyı Kaldır
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rowsFiltered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-neutral-500">Kayıt yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="px-4 py-2 text-xs text-neutral-500">Yükleniyor…</div>}
        {error && <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      </section>

      {/* Profile Modal (ham JSON görüntüsü) */}
      {profileId && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/40 p-4" onClick={() => setProfileId(null)}>
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">Restoran Profili</div>
              <button onClick={() => setProfileId(null)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Kapat</button>
            </div>
            <div className="p-4">
              {profileLoading && <div className="text-sm text-neutral-500">Yükleniyor…</div>}
              {profileErr && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{profileErr}</div>}
              {!profileLoading && !profileErr && (
                <pre className="max-h-[60vh] overflow-auto rounded-lg bg-neutral-50 p-3 text-xs">
                  {JSON.stringify(profileJson, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
