"use client";

import { LegalEntitySwitcher } from "@/components/layout/legal-entity-switcher";
import { SellingModeBar } from "@/components/layout/selling-mode-bar";
import {
  type ClientWorkspaceMode,
  resolveClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import type { LegalEntitySummary } from "@auction/types";
import { usePathname } from "next/navigation";

type Props = {
  acting: LegalEntitySummary;
  memberships: LegalEntitySummary[];
  /** The persisted mode; the current path overrides it on pages that belong to one mode. */
  workspaceMode: ClientWorkspaceMode;
  orgModuleEnabled: boolean;
  pendingInvitesCount: number;
};

/**
 * Header control for whose account the person is using. Selling mode shows the mode label with
 * its picker and a way back to buying; buying keeps the compact account switcher.
 */
export function ActingContextControl({ workspaceMode, ...rest }: Props) {
  const pathname = usePathname();
  return resolveClientWorkspaceMode(pathname, workspaceMode) === "selling" ? (
    <SellingModeBar {...rest} />
  ) : (
    <LegalEntitySwitcher {...rest} />
  );
}
