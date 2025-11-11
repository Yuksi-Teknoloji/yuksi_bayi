"use client";

import * as React from "react";
import { ChartPie } from "@/src/components/chart/RestaurantChart";
import { getAuthToken } from "@/src/utils/auth";

async function readJson<T = any>(res: Response): Promise<T> {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : ({} as any);
  } catch {
    return txt as any;
  }
}

const pickMsg = (d: any, fb: string) =>
  d?.message || d?.detail || d?.title || fb;

export default function Charts() {
  const token = React.useMemo(getAuthToken, []);

  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: "application/json" };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const [restaurants, setRestaurants] = React.useState<any[]>([]);
  const [option, setOption] = React.useState<string | number | null>(null);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const fetchRestaurants = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/yuksi/dealer/restaurants", {
        cache: "no-store",
        headers,
      });

      const json = await readJson(res);

      if (!res.ok) {
        throw new Error(pickMsg(json, `HTTP ${res.status}`));
      }

      const arr = json?.data ?? [];
      setRestaurants(arr);

      if (arr.length > 0 && option === null) {
        setOption(arr[0].id);
      }
    } catch (e: any) {
      setError(e?.message || "Veriler alınamadı.");
      setRestaurants([]);
    }
  }, [headers, option]);

  React.useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const fetchOrders = React.useCallback(async () => {
    if (!option) return;
    setError(null);
    try {
      const res = await fetch(
        `/yuksi/dealer/restaurants/${option}/order-history`,
        {
          cache: "no-store",
          headers,
        }
      );

      const json = await readJson(res);

      if (!res.ok) {
        throw new Error(pickMsg(json, `HTTP ${res.status}`));
      }

      const arr = json?.data ?? [];
      setOrders(arr.orders);
    } catch (e: any) {
      setError(e?.message || "Veriler alınamadı.");
      setOrders([]);
    }
  }, [headers, option]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (error) {
    return (
      <div className="p-10 text-rose-600 whitespace-pre-wrap">{error}</div>
    );
  }

  if (!restaurants.length) {
    return <div className="p-10">Restoran bulunamadı.</div>;
  }
  
  return (
    <div className="flex flex-wrap justify-between gap-16">
      <div className="w-full max-w-[500px] h-[300px] bg-white rounded-md shadow">
        <div className="flex justify-between items-center p-3">
          <select
            className="rounded border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
            name="option"
            value={option ?? ""}
            onChange={(e) => setOption(e.target.value)}
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <span className="text-sm font-semibold">Sipariş Durumu</span>

          <span className="bg-gray-100 px-2 py-1 text-sm font-semibold rounded">
            Sipariş Sayısı: {orders.length}
          </span>
        </div>

        <ChartPie data={orders} title="Sipariş Dağılımı" />
      </div>
    </div>
  );
}
