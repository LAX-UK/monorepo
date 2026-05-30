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
import type { ActingContext } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { DashboardDensity } from "@/lib/preferences/density";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import type { LegalEntitySummary, UserRole, UserStaffRole } from "@auction/types";
import type { ReactNode } from "react";
import {
  type SellerConnectNavBadgeInput,
  applySellerConnectNavBadges,
} from "./apply-seller-connect-nav-badges";
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
  mobileHeader?: {
    acting: LegalEntitySummary | null;
    actingContext: ActingContext;
    userDisplayName?: string;
  };
  /** When selling workspace and payout setup incomplete — server-resolved nav badge. */
  sellerConnectNavBadge?: SellerConnectNavBadgeInput | null;
  /** Hide mobile bottom tab bar (wizard, checkout). */
  hideBottomTabBar?: boolean;
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
  mobileHeader,
  sellerConnectNavBadge = null,
  hideBottomTabBar = false,
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
  const applyConnectBadge =
    role === "client" && clientWorkspaceMode === "selling" ? sellerConnectNavBadge : null;

  const nav =
    role === "client"
      ? applySellerConnectNavBadges(appShellNavItemsToNavItems(navItems), applyConnectBadge)
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
      ? applySellerConnectNavBadges(
          appShellNavItemsToNavItems(
            getClientMobileBottomTabs(clientWorkspaceMode, orgModuleEnabled),
          ),
          applyConnectBadge,
        )
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
  const moreSheetNavRaw =
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

  const moreSheetNav =
    moreSheetNavRaw && role === "client"
      ? applySellerConnectNavBadges(moreSheetNavRaw, applyConnectBadge)
      : moreSheetNavRaw;

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
    ...(mobileHeader ? { mobileHeader } : {}),
    ...(hideBottomTabBar ? { hideBottomTabBar: true } : {}),
  };
}
