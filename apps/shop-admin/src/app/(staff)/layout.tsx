import { type AdminNavItem, ShopAdminShell } from "@/components/shop-admin-shell";
import { loadAdminSession } from "@/lib/admin-data.server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

function buildNav(features: {
  payouts: boolean;
  thirdPartySales: boolean;
  originalSales: boolean;
  merchandise: boolean;
}): AdminNavItem[] {
  return [
    { href: "/overview", label: "Overview" },
    { href: "/clients", label: "Clients" },
    { href: "/artists", label: "Artists" },
    { href: "/requests", label: "Limit requests" },
    { href: "/staff", label: "Staff" },
    { href: "/artworks", label: "Artworks" },
    { href: "/merchandise", label: "Merchandise", enabled: features.merchandise },
    { href: "/orders", label: "Orders" },
    { href: "/production", label: "Production" },
    { href: "/fulfilment", label: "Fulfilment" },
    { href: "/payouts", label: "Payouts", enabled: features.payouts },
    { href: "/holds", label: "Stock holds", enabled: features.thirdPartySales },
    { href: "/third-party-sales", label: "Third-party sales", enabled: features.thirdPartySales },
    { href: "/original-sales", label: "Original sales", enabled: features.originalSales },
  ];
}

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const session = await loadAdminSession();
  if (!session) {
    redirect("/login");
  }
  return <ShopAdminShell nav={buildNav(session.features)}>{children}</ShopAdminShell>;
}
