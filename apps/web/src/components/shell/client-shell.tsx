"use client";

import { AccountChromeProvider } from "@/components/layout/account-switcher/account-chrome-context";
import { AppShell } from "@/components/layout/app-shell";
import { ContextualKycReturnTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { ActingContext } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import { isHideDashboardTabBarRoute } from "@/lib/layout/bottom-chrome";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import type { ClientNavScope } from "@/lib/navigation/client-nav-model";
import type { SellerConnectNavBadgeInput } from "@/lib/shell/apply-seller-connect-nav-badges";
import { buildShellConfig } from "@/lib/shell/build-shell-config";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";

type Props = {
  user: SessionUser;
  /** Whose account the menu is for, and what it holds. */
  navScope: ClientNavScope;
  /** The account in use, its switcher and the header strip. */
  account: AccountChrome;
  /** The LAX top bar: the other products and LAX Account. */
  familyLinks?: readonly LaxFamilyLinkVm[];
  hideEmailStatusBanner?: boolean;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  acting?: ActingContext;
  sellerConnectNavBadge?: SellerConnectNavBadgeInput | null;
  children: ReactNode;
};

/** Client area shell adapter — builds ShellConfig and wires capabilities. */
export function ClientShell({
  user,
  navScope,
  account,
  familyLinks,
  hideEmailStatusBanner,
  contextBanner,
  topSlot,
  acting = { kind: "self" },
  sellerConnectNavBadge = null,
  children,
}: Props) {
  const pathname = usePathname();

  const config = useMemo(
    () =>
      buildShellConfig({
        user,
        role: "client",
        clientNavScope: navScope,
        clientAccount: account,
        ...(familyLinks ? { familyLinks } : {}),
        ...(contextBanner ? { contextBanner } : {}),
        ...(topSlot ? { topSlot } : {}),
        ...(hideEmailStatusBanner ? { hideEmailStatusBanner: true } : {}),
        sellerConnectNavBadge,
        hideBottomTabBar: isHideDashboardTabBarRoute(pathname),
      }),
    [
      user,
      navScope,
      account,
      familyLinks,
      contextBanner,
      topSlot,
      hideEmailStatusBanner,
      sellerConnectNavBadge,
      pathname,
    ],
  );

  return (
    <ViewerCapabilitiesProvider user={user} acting={acting}>
      <ContextualKycReturnTracker kycApproved={user.kycStatus === "approved"} />
      <AccountChromeProvider account={account}>
        <AppShell user={user} config={config}>
          {children}
        </AppShell>
      </AccountChromeProvider>
    </ViewerCapabilitiesProvider>
  );
}
