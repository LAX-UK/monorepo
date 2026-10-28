import { type AppShellRole, getAppShellNavItems } from "@/components/layout/app-shell-nav";
import {
  getStaffMobileBottomTabs,
  getStaffNavGroups,
  getStaffNavItems,
} from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import {
  type ClientNavScope,
  PERSONAL_NAV_SCOPE,
  getClientMobileTabs,
  getClientNavSections,
} from "@/lib/navigation/client-nav-model";
import type { DashboardDensity } from "@/lib/preferences/density";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import type { UserRole } from "@auction/types";
import type { ReactNode } from "react";
import {
  type SellerConnectNavBadgeInput,
  applySellerConnectNavBadges,
} from "./apply-seller-connect-nav-badges";
import type { NavSection, ShellConfig } from "./contracts";
import { appShellNavItemsToNavItems, staffNavGroupsToNavEntries } from "./nav-adapters";

export type BuildShellConfigInput = {
  user: Pick<SessionUser, "role" | "staffRoles">;
  role: AppShellRole;
  density?: DashboardDensity;
  headerActionsSlot?: ReactNode;
  headerExtraSlot?: ReactNode;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  hideEmailStatusBanner?: boolean;
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
  navCounts?: AdminNavCounts;
  /** Whose account the client nav is for; defaults to a personal account with no organisations. */
  clientNavScope?: ClientNavScope;
  /** Client only: the account in use, its switcher and the header strip. */
  clientAccount?: AccountChrome;
  /** Client only: the LAX top bar's links. Ignored for staff shells. */
  familyLinks?: readonly LaxFamilyLinkVm[];
  /** Payout setup incomplete while it is required — server-resolved nav badge. */
  sellerConnectNavBadge?: SellerConnectNavBadgeInput | null;
  /** Hide mobile bottom tab bar (wizard, checkout). */
  hideBottomTabBar?: boolean;
};

export function buildShellConfig({
  user,
  role,
  density = "normal",
  headerActionsSlot,
  headerExtraSlot,
  contextBanner,
  topSlot,
  hideEmailStatusBanner,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts,
  clientNavScope = PERSONAL_NAV_SCOPE,
  clientAccount,
  familyLinks,
  sellerConnectNavBadge = null,
  hideBottomTabBar = false,
}: BuildShellConfigInput): ShellConfig {
  const navItems = getAppShellNavItems(
    role,
    user,
    pendingSubmissionCount,
    pendingArtistCount,
    navCounts,
    clientNavScope,
  );
  const applyConnectBadge = role === "client" ? sellerConnectNavBadge : null;
  const navSections: NavSection[] | null =
    role === "client"
      ? getClientNavSections(clientNavScope).map((section) => ({
          id: section.id,
          title: section.label,
          items: applySellerConnectNavBadges(
            appShellNavItemsToNavItems(section.items),
            applyConnectBadge,
          ),
        }))
      : null;

  const nav =
    role === "client"
      ? applySellerConnectNavBadges(appShellNavItemsToNavItems(navItems), applyConnectBadge)
      : staffNavGroupsToNavEntries(
          getStaffNavGroups(
            user.role as UserRole,
            pendingSubmissionCount,
            user.staffRoles,
            pendingArtistCount,
            navCounts,
          ),
        );
  const mobileNav =
    role === "client"
      ? applySellerConnectNavBadges(
          appShellNavItemsToNavItems(getClientMobileTabs(clientNavScope)),
          applyConnectBadge,
        )
      : appShellNavItemsToNavItems(
          getStaffMobileBottomTabs(
            user.role as UserRole,
            user.staffRoles,
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
              user.staffRoles,
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
      ...(headerActionsSlot ? { actionsSlot: headerActionsSlot } : {}),
      ...(headerExtraSlot ? { extraSlot: headerExtraSlot } : {}),
    },
    ...(contextBanner ? { contextBanner } : {}),
    ...(topSlot ? { topSlot } : {}),
    density,
    ...(hideEmailStatusBanner ? { hideEmailStatusBanner: true } : {}),
    ...(navSections ? { navSections } : {}),
    ...(role === "client" && clientAccount ? { clientAccount } : {}),
    ...(role === "client" && familyLinks && familyLinks.length > 0 ? { familyLinks } : {}),
    pendingSubmissionCount,
    pendingArtistCount,
    ...(navCounts ? { navCounts } : {}),
    ...(hideBottomTabBar ? { hideBottomTabBar: true } : {}),
  };
}
