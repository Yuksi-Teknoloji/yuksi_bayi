"use client";
import { redirect } from "next/navigation";
import { getAuthToken } from "@/src/utils/auth";
import { decodeJwt, isExpired, roleSegment } from "@/src/utils/jwt";

export default function DealerHome() {
  const token = getAuthToken();

  if (!token) {
    redirect("/");
  }

  const claims = decodeJwt(token);

  if (!claims || isExpired(claims)) {
    redirect("/");
  }

  const role = String(roleSegment(claims.userType) || "").toLowerCase();

  if (role !== "dealer") {
    redirect("/");
  }

  return <div className="rounded-2xl bg-white p-4 shadow">Bayi Paneline Hoşgeldiniz</div>;
}
