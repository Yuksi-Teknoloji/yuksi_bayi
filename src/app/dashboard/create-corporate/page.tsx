"use client";

import * as React from "react";
import { getAuthToken } from "@/src/utils/auth";

type HeadersDict = HeadersInit;

function bearerHeaders(token?: string | null): HeadersDict {
  const h: HeadersDict = { Accept: "application/json" };
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

const pickMsg = (d: any, fb: string) =>
  d?.message || d?.detail || d?.title || fb;

type CountryOpt = { id: number; name: string };
type StateOpt = { id: number; name: string };
type CityOpt = { id: number; name: string };

export default function CreateCorporate() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(
    () => bearerHeaders(token),
    [token]
  );

  const [saving, setSaving] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);
  const [formKey, setFormKey] = React.useState(0);

  const [countries, setCountries] = React.useState<CountryOpt[]>([]);
  const [countryId, setCountryId] = React.useState<number | "">("");
  const [countryLoading, setCountryLoading] = React.useState(false);
  const [countryError, setCountryError] = React.useState<string | null>(null);

  const [states, setStates] = React.useState<StateOpt[]>([]);
  const [stateId, setStateId] = React.useState<number | "">(""); // ŞEHİR
  const [statesLoading, setStatesLoading] = React.useState(false);
  const [statesError, setStatesError] = React.useState<string | null>(null);

  const [cities, setCities] = React.useState<CityOpt[]>([]);
  const [cityId, setCityId] = React.useState<number | "">(""); // İLÇE
  const [citiesLoading, setCitiesLoading] = React.useState(false);
  const [citiesError, setCitiesError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setCountryLoading(true);
      setCountryError(null);
      try {
        const url = new URL("/yuksi/geo/countries", location.origin);
        url.searchParams.set("limit", "200");
        url.searchParams.set("offset", "0");

        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await readJson(res);
        if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));

        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const mapped: CountryOpt[] = list
          .map((s) => ({ id: Number(s?.id), name: String(s?.name ?? "") }))
          .filter((s) => Number.isFinite(s.id) && s.name);

        if (!cancelled) setCountries(mapped);
      } catch (e: any) {
        if (!cancelled)
          setCountryError(e?.message || "Ülke listesi alınamadı.");
      } finally {
        if (!cancelled) setCountryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatesLoading(true);
      setStatesError(null);
      try {
        const url = new URL("/yuksi/geo/states", location.origin);
        url.searchParams.set("country_id", String(countryId));
        url.searchParams.set("limit", "200");
        url.searchParams.set("offset", "0");

        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await readJson(res);
        if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));

        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const mapped: StateOpt[] = list
          .map((s) => ({ id: Number(s?.id), name: String(s?.name ?? "") }))
          .filter((s) => Number.isFinite(s.id) && s.name);

        if (!cancelled) setStates(mapped);
      } catch (e: any) {
        if (!cancelled)
          setStatesError(e?.message || "Şehir listesi alınamadı.");
      } finally {
        if (!cancelled) setStatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setCitiesLoading(true);
      setCitiesError(null);
      try {
        const url = new URL("/yuksi/geo/cities", location.origin);
        url.searchParams.set("state_id", String(stateId));
        url.searchParams.set("limit", "200");
        url.searchParams.set("offset", "0");

        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await readJson(res);
        if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));

        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        const mapped: CityOpt[] = list
          .map((s) => ({ id: Number(s?.id), name: String(s?.name ?? "") }))
          .filter((s) => Number.isFinite(s.id) && s.name);

        if (!cancelled) setCities(mapped);
      } catch (e: any) {
        if (!cancelled)
          setCitiesError(e?.message || "Şehir listesi alınamadı.");
      } finally {
        if (!cancelled) setCitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stateId]);

  // ---- Submit
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") || ""),
      password: String(fd.get("password") || ""),
      phone: String(fd.get("phone") || ""),
      first_name: String(fd.get("name") || ""),
      last_name: String(fd.get("surname") || ""),
      addressLine1: String(fd.get("addressLine1") || ""),
      addressLine2: String(fd.get("addressLine2") || ""),
      countryId: Number(countryId || 1),
      stateId: Number(stateId || 1),
      cityId: Number(cityId || 1),
      tax_office: String(fd.get("tax_office") || ""),
      tax_number: String(fd.get("tax_number") || ""),
      iban: String(fd.get("iban") || ""),
      resume: String(fd.get("resume") || ""),
    };

    try {
      const res = await fetch("/yuksi/admin/corporate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));

      setOkMsg(data?.message || "Kurumsal üye başarıyla kaydedildi.");
      setFormKey((k) => k + 1);
    } catch (ex: any) {
      setErrMsg(ex?.message || "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Kurumsal Üye Oluştur
          </h1>
          <p className="text-sm text-neutral-600">
            Yeni kurumsal üye oluşturabilirsiniz. Ancak kurumsal üyeleri bayinize bağlayamaz ve onlardan komisyon alamazsınız.
          </p>
        </div>
      </div>
      <form
        key={formKey}
        onSubmit={onSubmit}
        className="mt-4 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 bg-[rgb(251,231,215)] p-3 sm:p-4 rounded-xl shadow"
      >
        <div className="flex flex-col gap-4 min-w-0">
          <div className="grid place-items-center">
            <div className="mb-2 sm:mb-6 grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-full bg-neutral-200 text-[10px] sm:text-xs text-neutral-600">
              300 × 300
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ad
            </label>
            <input
              type="text"
              name="name"
              className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Soyad
            </label>
            <input
              type="text"
              name="surname"
              className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Telefon
            </label>
            <input
              type="tel"
              name="phone"
              className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl p-2"
              placeholder="+90 5xx xxx xx xx"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                E-Posta
              </label>
              <input
                type="email"
                name="email"
                className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl p-2"
                placeholder="ornek@eposta.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Şifre
              </label>
              <input
                className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl p-2"
                type="password"
                name="password"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Özgeçmiş
            </label>
            <textarea
              name="resume"
              rows={3}
              className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl p-2 resize-y"
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Adres Satırı 1
            </label>
            <input
              type="text"
              name="addressLine1"
              className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl shadow-sm p-2"
              placeholder="Adres satırı 1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Adres Satırı 2 (opsiyonel)
            </label>
            <input
              type="text"
              name="addressLine2"
              className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl shadow-sm p-2"
              placeholder="Adres satırı 2"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Ülke
              </label>
              <select
                value={countryId}
                required
                onChange={(e) => {
                  setCountryId(e.target.value ? Number(e.target.value) : "");
                  setStateId("");
                  setCityId("");
                }}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              >
                <option value="">
                  {countryLoading ? "Yükleniyor…" : "Ülke seçin…"}
                </option>
                {countryError && <option value="">{countryError}</option>}
                {!countryLoading &&
                  !countryError &&
                  countries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Eyalet/İl
              </label>
              <select
                value={stateId}
                required
                onChange={(e) => {
                  setStateId(e.target.value ? Number(e.target.value) : "");
                  setCityId("");
                }}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              >
                <option value="">
                  {statesLoading ? "Yükleniyor…" : "Eyalet/İl seçin…"}
                </option>
                {statesError && <option value="">Önce Ülke Seçin</option>}
                {!statesLoading &&
                  !statesError &&
                  states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Şehir/İlçe
              </label>
              <select
                value={cityId}
                onChange={(e) =>
                  setCityId(e.target.value ? Number(e.target.value) : "")
                }
                required
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              >
                <option value="">
                  {citiesLoading ? "Yükleniyor…" : "Şehir/İlçe seçin…"}
                </option>
                {citiesError && <option value="">Önce Eyalet/İl Seçin</option>}
                {!citiesLoading &&
                  !citiesError &&
                  cities.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Vergi Dairesi (tax_office)
              </label>
              <input
                type="text"
                name="tax_office"
                className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl shadow-sm p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Vergi Numarası (tax_number)
              </label>
              <input
                type="text"
                name="tax_number"
                className="bg-white mt-1 block w-full min-w-0 border border-gray-300 rounded-xl shadow-sm p-2"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              IBAN
            </label>
            <input
              name="iban"
              type="text"
              placeholder="TR..."
              className="w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="col-span-full w-full sm:w-auto sm:min-w-[140px] bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium"
        >
          {saving ? "Kaydediliyor…" : "Oluştur"}
        </button>
        {okMsg && (
          <div className="col-span-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 sm:px-4 py-3 text-sm text-emerald-700">
            {okMsg}
          </div>
        )}
        {errMsg && (
          <div className="col-span-full rounded-xl border border-rose-200 bg-rose-50 px-3 sm:px-4 py-3 text-sm text-rose-700">
            {errMsg}
          </div>
        )}
      </form>
    </div>
  );
}
