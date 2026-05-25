"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { ActingContext } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/data/contracts";
import type { DashboardDensity } from "@/lib/preferences/density";
import { buildShellConfig } from "@/lib/shell/build-shell-config";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
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
  orgModuleEnabled?: boolean;
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
  orgModuleEnabled = true,
  children,
}: Props) {
  const config = useMemo(
    () =>
      buildShellConfig({
        user,
        role: "client",
        clientWorkspaceMode,
        orgModuleEnabled,
        headerRightSlot,
        ...(contextBanner ? { contextBanner } : {}),
        ...(topSlot ? { topSlot } : {}),
        ...(hideEmailStatusBanner ? { hideEmailStatusBanner: true } : {}),
      }),
    [
      user,
      clientWorkspaceMode,
      orgModuleEnabled,
      headerRightSlot,
      contextBanner,
      topSlot,
      hideEmailStatusBanner,
    ],
  );

  return (
    <ViewerCapabilitiesProvider
      user={user}
      clientWorkspaceMode={clientWorkspaceMode}
      acting={acting}
    >
      <AppShell user={user} config={config} cookieDensity={cookieDensity ?? null}>
        {children}
      </AppShell>
    </ViewerCapabilitiesProvider>
  );
}
