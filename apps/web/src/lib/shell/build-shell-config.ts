import {
  type AppShellRole,
  getAppShellNavItems,
  getClientMobileBottomTabs,
} from "@/components/layout/app-shell-nav";
import {
  getStaffMobileBottomTabs,
  getStaffNavGroups,
  getStaffNavItems,
} from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { DashboardDensity } from "@/lib/preferences/density";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import type { UserRole, UserStaffRole } from "@auction/types";
import type { ReactNode } from "react";
import type { ShellConfig } from "./contracts";
import { appShellNavItemsToNavItems, staffNavGroupsToNavEntries } from "./nav-adapters";

export type BuildShellConfigInput = {
  user: Pick<SessionUser, "role" | "staffRole">;
  role: AppShellRole;
  clientWorkspaceMode?: ClientWorkspaceMode;
  density?: DashboardDensity;
  headerLeftSlot?: ReactNode;
  headerRightSlot?: ReactNode;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  hideEmailStatusBanner?: boolean;
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
  navCounts?: AdminNavCounts;
  orgModuleEnabled?: boolean;
};

export function buildShellConfig({
  user,
  role,
  clientWorkspaceMode = "buying",
  density = "normal",
  headerLeftSlot,
  headerRightSlot,
  contextBanner,
  topSlot,
  hideEmailStatusBanner,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts,
  orgModuleEnabled = true,
}: BuildShellConfigInput): ShellConfig {
  const navItems = getAppShellNavItems(
    role,
    user,
    pendingSubmissionCount,
    clientWorkspaceMode,
    pendingArtistCount,
    navCounts,
    orgModuleEnabled,
  );
  const nav =
    role === "client"
      ? appShellNavItemsToNavItems(navItems)
      : staffNavGroupsToNavEntries(
          getStaffNavGroups(
            user.role as UserRole,
            pendingSubmissionCount,
            (user.staffRole ?? null) as UserStaffRole | null,
            pendingArtistCount,
            navCounts,
          ),
        );
  const mobileNav =
    role === "client"
      ? appShellNavItemsToNavItems(getClientMobileBottomTabs(clientWorkspaceMode, orgModuleEnabled))
      : appShellNavItemsToNavItems(
          getStaffMobileBottomTabs(
            user.role as UserRole,
            (user.staffRole ?? null) as UserStaffRole | null,
            pendingSubmissionCount,
            pendingArtistCount,
            role === "finance",
            navCounts,
          ),
        );

  const tabIds = new Set(mobileNav.map((item) => item.id));
  const moreSheetNav =
    role === "client"
      ? appShellNavItemsToNavItems(
          navItems.filter((item) => !tabIds.has(item.id) && item.id !== "more"),
        )
      : role === "platform" || role === "finance"
        ? appShellNavItemsToNavItems(
            getStaffNavItems(
              user.role as UserRole,
              (user.staffRole ?? null) as UserStaffRole | null,
              pendingSubmissionCount,
              pendingArtistCount,
              navCounts,
            ).filter((item) => !tabIds.has(item.id) && item.id !== "more"),
          )
        : undefined;

  return {
    role,
    nav,
    mobileNav,
    ...(moreSheetNav && moreSheetNav.length > 0 ? { moreSheetNav } : {}),
    header: {
      ...(headerLeftSlot ? { leftSlot: headerLeftSlot } : {}),
      ...(headerRightSlot ? { rightSlot: headerRightSlot } : {}),
    },
    ...(contextBanner ? { contextBanner } : {}),
    ...(topSlot ? { topSlot } : {}),
    density,
    ...(hideEmailStatusBanner ? { hideEmailStatusBanner: true } : {}),
    ...(role === "client" ? { clientWorkspaceMode } : {}),
    pendingSubmissionCount,
    pendingArtistCount,
  };
}
