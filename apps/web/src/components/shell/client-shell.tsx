"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ContextualKycReturnTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { ActingContext } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import { isHideDashboardTabBarRoute } from "@/lib/layout/bottom-chrome";
import type { ClientNavScope } from "@/lib/navigation/client-nav-model";
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
  headerActionsSlot?: ReactNode;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  acting?: ActingContext;
  safeActing?: LegalEntitySummary | null;
  orgModuleEnabled?: boolean;
  /** The person belongs to at least one organisation (not only the one they are acting for). */
  isOrgMember?: boolean;
  sellerConnectNavBadge?: SellerConnectNavBadgeInput | null;
  children: ReactNode;
};

/** Client dashboard shell adapter — builds ShellConfig and wires capabilities. */
export function ClientShell({
  user,
  clientWorkspaceMode = "buying",
  cookieDensity,
  hideEmailStatusBanner,
  headerActionsSlot,
  contextBanner,
  topSlot,
  acting = { kind: "self" },
  safeActing = null,
  orgModuleEnabled = true,
  isOrgMember = false,
  sellerConnectNavBadge = null,
  children,
}: Props) {
  const pathname = usePathname();
  const effectiveWorkspaceMode = resolveClientWorkspaceMode(pathname, clientWorkspaceMode);

  const clientNavScope = useMemo<ClientNavScope>(
    () => ({
      context:
        safeActing?.kind === "organisation"
          ? { kind: "organisation", id: safeActing.id, role: safeActing.role }
          : { kind: "personal" },
      orgModuleEnabled,
      isOrgMember,
    }),
    [safeActing, orgModuleEnabled, isOrgMember],
  );

  const config = useMemo(
    () =>
      buildShellConfig({
        user,
        role: "client",
        clientWorkspaceMode: effectiveWorkspaceMode,
        clientNavScope,
        headerActionsSlot,
        mobileHeader: { actingContext: acting },
        ...(contextBanner ? { contextBanner } : {}),
        ...(topSlot ? { topSlot } : {}),
        ...(hideEmailStatusBanner ? { hideEmailStatusBanner: true } : {}),
        sellerConnectNavBadge: effectiveWorkspaceMode === "selling" ? sellerConnectNavBadge : null,
        hideBottomTabBar: isHideDashboardTabBarRoute(pathname),
      }),
    [
      user,
      effectiveWorkspaceMode,
      clientNavScope,
      headerActionsSlot,
      contextBanner,
      topSlot,
      hideEmailStatusBanner,
      acting,
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
