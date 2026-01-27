import DashboardLayoutClient from "@/src/components/dashboard/DashboardLayoutClient";
import { navForRole } from "@/src/app/config/nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = navForRole("dealer") ?? [];

  return (
    <DashboardLayoutClient
      nav={nav}
      headerTitle="Yüksi Panel"
      headerClass="bg-orange-500 border-orange-400 text-white"
      titleClass="font-extrabold"
    >
      {children}
    </DashboardLayoutClient>
  );
}
