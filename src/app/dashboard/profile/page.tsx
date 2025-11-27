// src/app/dashboard/profile/page.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import MapPicker, { type GeoPoint } from '@/src/components/map/MapPicker';

/* -------- helpers (token) -------- */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const keys = ['auth_token', 'token', 'authToken', 'access_token', 'jwt'];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    }
  } catch {}
  if (typeof document !== 'undefined') {
    const m =
      document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/) ||
      document.cookie.match(/(?:^|;\s*)token=([^;]+)/) ||
      document.cookie.match(/(?:^|;\s*)authToken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

async function readJson(res: Response): Promise<any> {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : null;
  } catch {
    return t;
  }
}

/* --- API types --- */
type DealerProfileForm = {
  email: string;
  phone: string;
  name: string;
  surname: string;
  fullAddress: string;
  accountType: string;
  countryId: string;
  stateId: string;
  cityId: string;
  taxOffice: string;
  taxNumber: string;
  iban: string;
  resume: string;
  latitude: string;
  longitude: string;
};

/* -------- page -------- */
export default function DealerProfilePage() {
  const [token, setToken] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<DealerProfileForm>({
    email: '',
    phone: '',
    name: '',
    surname: '',
    fullAddress: '',
    accountType: '',
    countryId: '',
    stateId: '',
    cityId: '',
    taxOffice: '',
    taxNumber: '',
    iban: '',
    resume: '',
    latitude: '',
    longitude: '',
  });

  const [commissionRate, setCommissionRate] = React.useState<number | null>(null);
  const [commissionDescription, setCommissionDescription] = React.useState<string>('');

  const [editing, setEditing] = React.useState({
    email: false,
    phone: false,
    name: false,
    surname: false,
    fullAddress: false,
    accountType: false,
    countryId: false,
    stateId: false,
    cityId: false,
    taxOffice: false,
    taxNumber: false,
    iban: false,
    resume: false,
    latitude: false,
    longitude: false,
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  const toggle = (k: keyof typeof editing) =>
    setEditing((s) => ({ ...s, [k]: !s[k] }));

  /* 1) token çek */
  React.useEffect(() => {
    const t = getAuthToken();
    setToken(t);
  }, []);

  /* 2) profil yükle */
  React.useEffect(() => {
    if (!token) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErrMsg(null);
      try {
        const res = await fetch('/yuksi/dealer/profile', {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const j = await readJson(res);
        if (!res.ok) {
          const msg =
            j?.message || j?.detail || j?.title || (typeof j === 'string' ? j : `HTTP ${res.status}`);
          throw new Error(msg);
        }

        const data = j?.data ?? j ?? {};

        if (!alive) return;

        setForm({
          email: data.email ?? '',
          phone: data.phone ?? '',
          name: data.name ?? '',
          surname: data.surname ?? '',
          fullAddress: data.fullAddress ?? '',
          accountType: data.accountType ?? '',
          countryId: data.countryId != null ? String(data.countryId) : '',
          stateId: data.stateId != null ? String(data.stateId) : '',
          cityId: data.cityId != null ? String(data.cityId) : '',
          taxOffice: data.taxOffice ?? '',
          taxNumber: data.taxNumber ?? '',
          iban: data.iban ?? '',
          resume: data.resume ?? '',
          latitude: data.latitude != null ? String(data.latitude) : '',
          longitude: data.longitude != null ? String(data.longitude) : '',
        });

        if (data.commissionRate != null) {
          setCommissionRate(Number(data.commissionRate) || 0);
        }
        if (data.commissionDescription != null) {
          setCommissionDescription(String(data.commissionDescription));
        }
      } catch (e: any) {
        if (!alive) return;
        setErrMsg(e?.message || 'Profil bilgileri alınamadı.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  /* ---- MapPicker senkronizasyonu ---- */
  const mapValue: GeoPoint | null = React.useMemo(() => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }, [form.latitude, form.longitude]);

  const onPickFromMap = (p: GeoPoint) => {
    setForm((prev) => ({
      ...prev,
      latitude: String(Number(p.lat.toFixed(6))),
      longitude: String(Number(p.lng.toFixed(6))),
      fullAddress: p.address ? String(p.address) : prev.fullAddress,
    }));
  };

  /* 3) Kaydet */
  async function saveAll() {
    if (!token || saving) return;
    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);
    try {
      const body: any = {
        email: form.email,
        phone: form.phone,
        name: form.name,
        surname: form.surname,
        fullAddress: form.fullAddress,
        accountType: form.accountType,
        taxOffice: form.taxOffice,
        taxNumber: form.taxNumber,
        iban: form.iban,
        resume: form.resume,
      };

      const countryIdNum = Number(form.countryId);
      const stateIdNum = Number(form.stateId);
      const cityIdNum = Number(form.cityId);
      if (Number.isFinite(countryIdNum)) body.countryId = countryIdNum;
      if (Number.isFinite(stateIdNum)) body.stateId = stateIdNum;
      if (Number.isFinite(cityIdNum)) body.cityId = cityIdNum;

      const latNum = Number(form.latitude);
      const lngNum = Number(form.longitude);
      if (Number.isFinite(latNum)) body.latitude = latNum;
      if (Number.isFinite(lngNum)) body.longitude = lngNum;

      const res = await fetch('/yuksi/dealer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const j = await readJson(res);
      if (!res.ok) {
        const msg =
          j?.message || j?.detail || j?.title || (typeof j === 'string' ? j : `HTTP ${res.status}`);
        throw new Error(msg);
      }

      setOkMsg(j?.message || 'Profil başarıyla güncellendi.');
      setEditing({
        email: false,
        phone: false,
        name: false,
        surname: false,
        fullAddress: false,
        accountType: false,
        countryId: false,
        stateId: false,
        cityId: false,
        taxOffice: false,
        taxNumber: false,
        iban: false,
        resume: false,
        latitude: false,
        longitude: false,
      });
    } catch (e: any) {
      setErrMsg(e?.message || 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  const onChange =
    (k: keyof DealerProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Bayi Profili</h1>

      {loading && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">Yükleniyor…</div>
      )}

      {!loading && (
        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-neutral-200/70 bg-orange-50 p-4 sm:p-6">
            {okMsg && (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                {okMsg}
              </div>
            )}
            {errMsg && (
              <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                {errMsg}
              </div>
            )}

            <Block title="Genel Bilgiler">
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Ad"
                  value={form.name}
                  onChange={onChange('name')}
                  disabled={!editing.name}
                />
                <EditButton onClick={() => toggle('name')} active={editing.name} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Soyad"
                  value={form.surname}
                  onChange={onChange('surname')}
                  disabled={!editing.surname}
                />
                <EditButton onClick={() => toggle('surname')} active={editing.surname} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Hesap tipi (bireysel / kurumsal)"
                  value={form.accountType}
                  onChange={onChange('accountType')}
                  disabled={!editing.accountType}
                />
                <EditButton onClick={() => toggle('accountType')} active={editing.accountType} />
              </Row>
              <Row>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Özgeçmiş / açıklama"
                  value={form.resume}
                  onChange={onChange('resume')}
                  disabled={!editing.resume}
                />
                <EditButton onClick={() => toggle('resume')} active={editing.resume} />
              </Row>
            </Block>

            <Block title="İletişim & Adres">
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Telefon"
                  value={form.phone}
                  onChange={onChange('phone')}
                  disabled={!editing.phone}
                />
                <EditButton onClick={() => toggle('phone')} active={editing.phone} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="E-posta"
                  value={form.email}
                  onChange={onChange('email')}
                  disabled={!editing.email}
                />
                <EditButton onClick={() => toggle('email')} active={editing.email} />
              </Row>
              <Row>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Adres"
                  value={form.fullAddress}
                  onChange={onChange('fullAddress')}
                  disabled={!editing.fullAddress}
                />
                <EditButton onClick={() => toggle('fullAddress')} active={editing.fullAddress} />
              </Row>
            </Block>

            <Block title="Vergi / Finans">
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Vergi Dairesi"
                  value={form.taxOffice}
                  onChange={onChange('taxOffice')}
                  disabled={!editing.taxOffice}
                />
                <EditButton onClick={() => toggle('taxOffice')} active={editing.taxOffice} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Vergi No"
                  value={form.taxNumber}
                  onChange={onChange('taxNumber')}
                  disabled={!editing.taxNumber}
                />
                <EditButton onClick={() => toggle('taxNumber')} active={editing.taxNumber} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="IBAN"
                  value={form.iban}
                  onChange={onChange('iban')}
                  disabled={!editing.iban}
                />
                <EditButton onClick={() => toggle('iban')} active={editing.iban} />
              </Row>
            </Block>

            <Block title="Ülke / İl / İlçe ID">
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="Country ID"
                  value={form.countryId}
                  onChange={onChange('countryId')}
                  disabled={!editing.countryId}
                />
                <EditButton onClick={() => toggle('countryId')} active={editing.countryId} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="State ID"
                  value={form.stateId}
                  onChange={onChange('stateId')}
                  disabled={!editing.stateId}
                />
                <EditButton onClick={() => toggle('stateId')} active={editing.stateId} />
              </Row>
              <Row>
                <input
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  placeholder="City ID"
                  value={form.cityId}
                  onChange={onChange('cityId')}
                  disabled={!editing.cityId}
                />
                <EditButton onClick={() => toggle('cityId')} active={editing.cityId} />
              </Row>
            </Block>

            <Block title="Konum">
              <Row>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Enlem (örn: 40.123456)"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.latitude}
                  onChange={onChange('latitude')}
                  disabled={!editing.latitude}
                />
                <EditButton onClick={() => toggle('latitude')} active={editing.latitude} />
              </Row>
              <Row>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Boylam (örn: 29.123456)"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none disabled:bg-white"
                  value={form.longitude}
                  onChange={onChange('longitude')}
                  disabled={!editing.longitude}
                />
                <EditButton onClick={() => toggle('longitude')} active={editing.longitude} />
              </Row>

              <div className="mt-3">
                <MapPicker
                  label="Haritada Konum Seç"
                  value={mapValue}
                  onChange={onPickFromMap}
                  defaultCenter={{ lat: 41.015137, lng: 28.97953 }}
                />
              </div>
            </Block>

            <Block title="Komisyon Bilgisi (sadece görüntüleme)">
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800">
                <div>
                  <span className="font-semibold">Komisyon Oranı: </span>
                  {commissionRate != null ? `%${commissionRate}` : '—'}
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Açıklama: </span>
                  {commissionDescription || '—'}
                </div>
              </div>
            </Block>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={saveAll}
                disabled={saving || !token}
                className="rounded-xl border border-orange-300 bg-white px-6 py-2.5 text-sm font-semibold text-orange-600 shadow-sm hover:bg-orange-50 disabled:opacity-60"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>

          <aside className="rounded-2xl border border-neutral-200/70 bg-white p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative h-40 w-40">
                <Image
                  src="/Brand/yuksi.png"
                  alt="profile"
                  fill
                  className="rounded-full object-cover ring-4 ring-orange-500"
                />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="font-semibold text-orange-600">Ad Soyad:</span>{' '}
                  {form.name || form.surname ? `${form.name} ${form.surname}` : '—'}
                </p>
                <p>
                  <span className="font-semibold text-orange-600">Hesap Tipi:</span>{' '}
                  {form.accountType || '—'}
                </p>
                <p>
                  <span className="font-semibold text-orange-600">Telefon:</span>{' '}
                  {form.phone || '—'}
                </p>
                <p>
                  <span className="font-semibold text-orange-600">E-posta:</span>{' '}
                  {form.email || '—'}
                </p>
                <p>
                  <span className="font-semibold text-orange-600">Komisyon Oranı:</span>{' '}
                  {commissionRate != null ? `%${commissionRate}` : '—'}
                </p>
              </div>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}

/* ---- küçük yardımcılar ---- */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-sm font-semibold text-neutral-800">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[1fr_auto] items-center gap-3">{children}</div>;
}

function EditButton({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition
        ${active ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-500 hover:bg-emerald-600'}`}
    >
      DÜZENLE
    </button>
  );
}
