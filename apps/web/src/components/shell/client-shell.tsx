"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ContextualKycReturnTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { ActingContext } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import { isHideDashboardTabBarRoute } from "@/lib/layout/bottom-chrome";
import type { DashboardDensity } from "@/lib/preferences/density";
import type { SellerConnectNavBadgeInput } from "@/lib/shell/apply-seller-connect-nav-badges";
import { buildShellConfig } from "@/lib/shell/build-shell-config";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { resolveClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import type { LegalEntitySummary } from "@auction/types";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";

type Props = {
  user: SessionUser;
  clientWorkspaceMode?: ClientWorkspaceMode;
  cookieDensity?: DashboardDensity | null;
  hideEmailStatusBanner?: boolean;
  headerRightSlot?: ReactNode;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  acting?: ActingContext;
  safeActing?: LegalEntitySummary | null;
  orgModuleEnabled?: boolean;
  sellerConnectNavBadge?: SellerConnectNavBadgeInput | null;
  children: ReactNode;
};

/** Client dashboard shell adapter — builds ShellConfig and wires capabilities. */
export function ClientShell({
  user,
  clientWorkspaceMode = "buying",
  cookieDensity,
  hideEmailStatusBanner,
  headerRightSlot,
  contextBanner,
  topSlot,
  acting = { kind: "self" },
  safeActing = null,
  orgModuleEnabled = true,
  sellerConnectNavBadge = null,
  children,
}: Props) {
  const pathname = usePathname();
  const effectiveWorkspaceMode = resolveClientWorkspaceMode(pathname, clientWorkspaceMode);

  const config = useMemo(
    () =>
      buildShellConfig({
        user,
        role: "client",
        clientWorkspaceMode: effectiveWorkspaceMode,
        orgModuleEnabled,
        headerRightSlot,
        mobileHeader: {
          acting: safeActing,
          actingContext: acting,
          userDisplayName: user.name,
        },
        ...(contextBanner ? { contextBanner } : {}),
        ...(topSlot ? { topSlot } : {}),
        ...(hideEmailStatusBanner ? { hideEmailStatusBanner: true } : {}),
        sellerConnectNavBadge: effectiveWorkspaceMode === "selling" ? sellerConnectNavBadge : null,
        hideBottomTabBar: isHideDashboardTabBarRoute(pathname),
      }),
    [
      user,
      effectiveWorkspaceMode,
      orgModuleEnabled,
      headerRightSlot,
      contextBanner,
      topSlot,
      hideEmailStatusBanner,
      acting,
      safeActing,
      sellerConnectNavBadge,
      pathname,
    ],
  );

  return (
    <ViewerCapabilitiesProvider
      user={user}
      clientWorkspaceMode={effectiveWorkspaceMode}
      acting={acting}
    >
      <ContextualKycReturnTracker kycApproved={user.kycStatus === "approved"} />
      <AppShell user={user} config={config} cookieDensity={cookieDensity ?? null}>
        {children}
      </AppShell>
    </ViewerCapabilitiesProvider>
  );
}
