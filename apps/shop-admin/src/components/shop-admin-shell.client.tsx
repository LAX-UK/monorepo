"use client";

import type { AdminNavGroup } from "@/server/domain/admin-nav.vm";
import { AdminShell } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Binds the shared shell to the Next router. The pathname comes from the client router, not the
 * request, because the staff layout persists across client navigations and would otherwise keep
 * highlighting the page it first rendered.
 */
export function ShopAdminShell({
  navGroups,
  account,
  children,
}: {
  navGroups: AdminNavGroup[];
  account: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell
      productName="LAX Admin"
      navGroups={navGroups}
      pathname={usePathname()}
      account={account}
      linkComponent={Link}
    >
      {children}
    </AdminShell>
  );
}
