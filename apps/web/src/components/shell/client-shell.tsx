"use client";

import { AccountChromeProvider } from "@/components/layout/account-switcher/account-chrome-context";
import { AccountNeedsYouProvider } from "@/components/layout/account-switcher/account-needs-you";
import { useViewingAsClient } from "@/components/layout/view-as-client/view-as-client-context";
import { ContextualKycReturnTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { ActingContext } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import { isHideDashboardTabBarRoute } from "@/lib/layout/bottom-chrome";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import {
  type ClientNavScope,
  getClientMobileTabs,
  getClientNavSections,
} from "@/lib/navigation/client-nav-model";
import { organisationRoleLabel } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";

type Props = {
  user: SessionUser;
  /** Whose account the menu is for, and what it holds. */
  navScope: ClientNavScope;
  /** The account in use and its switcher. */
  account: AccountChrome;
  /** The LAX family links: the other products and LAX Account. */
  familyLinks?: readonly LaxFamilyLinkVm[];
  /** Needs-you counts by menu entry id, without zeros. */
  needsYou?: Readonly<Record<string, number>>;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  acting?: ActingContext;
  children: ReactNode;
};

const NO_COUNTS: Readonly<Record<string, number>> = {};

/**
 * The organisation workspace: the menu, tabs and search shaped by the member's role, around the
 * page. Capabilities for the page come from the same acting context the menu was built from.
 */
export function ClientShell({
  user,
  navScope,
  account,
  familyLinks = [],
  needsYou = NO_COUNTS,
  contextBanner,
  topSlot,
  acting = { kind: "self" },
  children,
}: Props) {
  const pathname = usePathname();
  // Support viewing an account sees that account alone: no other account's dots are read.
  const viewingAs = useViewingAsClient();
  const sections = useMemo(() => getClientNavSections(navScope), [navScope]);
  const tabs = useMemo(
    () => (isHideDashboardTabBarRoute(pathname) ? [] : getClientMobileTabs(navScope)),
    [navScope, pathname],
  );
  const roleLabel =
    navScope.context.kind === "organisation" ? organisationRoleLabel(navScope.context.role) : "";

  return (
    <ViewerCapabilitiesProvider user={user} acting={acting}>
      <ContextualKycReturnTracker kycApproved={user.kycStatus === "approved"} />
      <AccountChromeProvider account={account}>
        <AccountNeedsYouProvider enabled={account.switcher !== null && !viewingAs}>
          <WorkspaceShell
            user={user}
            account={account}
            roleLabel={roleLabel}
            sections={sections}
            tabs={tabs}
            needsYou={needsYou}
            familyLinks={familyLinks}
            banner={contextBanner}
            topSlot={topSlot}
          >
            {children}
          </WorkspaceShell>
        </AccountNeedsYouProvider>
      </AccountChromeProvider>
    </ViewerCapabilitiesProvider>
  );
}
