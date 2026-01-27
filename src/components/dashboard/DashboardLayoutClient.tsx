"use client";

import { useState, useEffect } from "react";
import DashboardShell from "@/src/components/dashboard/Shell";
import Header from "@/src/components/dashboard/Header";
import Sidebar from "@/src/components/dashboard/Sidebar";
import type { NavGroup } from "@/src/types/roles";
import "@/src/styles/soft-ui.css";

const MOBILE_BREAKPOINT = 768;

export default function DashboardLayoutClient({
  nav,
  headerTitle,
  headerClass,
  titleClass,
  userLabel,
  children,
}: {
  nav: NavGroup[];
  headerTitle: string;
  headerClass?: string;
  titleClass?: string;
  userLabel?: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-100 flex">
      {/* Overlay: sadece mobilde sidebar açıkken */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[90] transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        nav={nav}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`flex-1 min-w-0 orange-ui transition-[margin] duration-200 ${
          sidebarOpen ? "md:ml-72" : ""
        }`}
      >
        <Header
          title={headerTitle}
          headerClass={headerClass}
          titleClass={titleClass}
          userLabel={userLabel}
          onMenuClick={() => setSidebarOpen((s) => !s)}
        />
        <main className="px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <DashboardShell>{children}</DashboardShell>
          </div>
        </main>
      </div>
    </div>
  );
}
