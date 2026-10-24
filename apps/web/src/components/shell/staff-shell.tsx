"use client";

import { BidStaffFrame } from "@/components/shell/bid-staff-frame";
import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { ActingContext } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { DashboardDensity } from "@/lib/preferences/density";
import { buildShellConfig } from "@/lib/shell/build-shell-config";
import type { StaffProduct } from "@auction/staff-ui";
import { type ReactNode, useMemo } from "react";

type Props = {
  user: SessionUser;
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
  navCounts?: AdminNavCounts;
  cookieDensity?: DashboardDensity | null;
  headerActionsSlot?: ReactNode;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  acting?: ActingContext;
  /** Staff tools this person can switch to (product switcher). */
  products: StaffProduct[];
  /** Server-read sidebar state, so the first paint has the right width. */
  defaultCollapsed?: boolean;
  children: ReactNode;
};

/** Platform staff shell adapter. */
export function StaffShell({
  user,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts,
  cookieDensity,
  headerActionsSlot,
  contextBanner,
  topSlot,
  acting = { kind: "self" },
  products,
  defaultCollapsed = false,
  children,
}: Props) {
  const config = useMemo(
    () =>
      buildShellConfig({
        user,
        role: "platform",
        headerActionsSlot,
        ...(contextBanner ? { contextBanner } : {}),
        ...(topSlot ? { topSlot } : {}),
        pendingSubmissionCount,
        pendingArtistCount,
        ...(navCounts ? { navCounts } : {}),
      }),
    [
      user,
      headerActionsSlot,
      contextBanner,
      topSlot,
      pendingSubmissionCount,
      pendingArtistCount,
      navCounts,
    ],
  );

  return (
    <ViewerCapabilitiesProvider user={user} acting={acting}>
      <BidStaffFrame
        user={user}
        config={config}
        products={products}
        cookieDensity={cookieDensity ?? null}
        defaultCollapsed={defaultCollapsed}
      >
        {children}
      </BidStaffFrame>
    </ViewerCapabilitiesProvider>
  );
}
