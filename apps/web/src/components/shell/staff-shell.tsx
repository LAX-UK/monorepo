"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { ActingContext } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { DashboardDensity } from "@/lib/preferences/density";
import { buildShellConfig } from "@/lib/shell/build-shell-config";
import { type ReactNode, useMemo } from "react";

type Props = {
  user: SessionUser;
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
  navCounts?: AdminNavCounts;
  cookieDensity?: DashboardDensity | null;
  headerRightSlot?: ReactNode;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  acting?: ActingContext;
  children: ReactNode;
};

/** Platform staff shell adapter. */
export function StaffShell({
  user,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts,
  cookieDensity,
  headerRightSlot,
  contextBanner,
  topSlot,
  acting = { kind: "self" },
  children,
}: Props) {
  const config = useMemo(
    () =>
      buildShellConfig({
        user,
        role: "platform",
        headerRightSlot,
        ...(contextBanner ? { contextBanner } : {}),
        ...(topSlot ? { topSlot } : {}),
        pendingSubmissionCount,
        pendingArtistCount,
        ...(navCounts ? { navCounts } : {}),
      }),
    [
      user,
      headerRightSlot,
      contextBanner,
      topSlot,
      pendingSubmissionCount,
      pendingArtistCount,
      navCounts,
    ],
  );

  return (
    <ViewerCapabilitiesProvider user={user} acting={acting}>
      <AppShell user={user} config={config} cookieDensity={cookieDensity ?? null}>
        {children}
      </AppShell>
    </ViewerCapabilitiesProvider>
  );
}
