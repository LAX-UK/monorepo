import type { BreadcrumbItem } from "@/components/dashboard/primitives/breadcrumbs";
import { roleLabel, subkindLabel } from "@/components/organisations/labels";
import type { ActingContext } from "@/lib/auth/capabilities";
import {
  type MobileShellTitleModel,
  resolveMobileShellTitle,
} from "@/lib/navigation/mobile-shell-title";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { clientWorkspaceOverviewMeta } from "@/lib/workspace/client-workspace-mode";
import type { LegalEntitySummary } from "@auction/types";

export function isDashboardOverviewRoute(
  pathname: string,
  workspace: ClientWorkspaceMode,
): boolean {
  if (pathname === "/dashboard") return workspace === "buying";
  if (pathname === "/dashboard/seller") return workspace === "selling";
  return false;
}

export function formatActingContextLine(acting: LegalEntitySummary): string {
  if (acting.kind === "organisation") {
    return `${subkindLabel(acting.subkind)} · ${roleLabel(acting.role)}`;
  }
  return subkindLabel(acting.subkind);
}

export function firstNameFromDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function resolveMobileHeaderTitleModel(
  items: readonly BreadcrumbItem[],
  options: {
    pathname: string;
    workspace: ClientWorkspaceMode;
    acting: LegalEntitySummary | null;
    actingContext: ActingContext;
    userDisplayName?: string;
  },
): MobileShellTitleModel {
  const { pathname, workspace, acting, actingContext, userDisplayName } = options;

  if (acting && isDashboardOverviewRoute(pathname, workspace)) {
    const welcomeName = userDisplayName
      ? firstNameFromDisplayName(userDisplayName)
      : firstNameFromDisplayName(acting.displayName);
    return {
      title: `Welcome, ${welcomeName}`,
      eyebrow: clientWorkspaceOverviewMeta(workspace),
      contextLine: `${acting.displayName} · ${formatActingContextLine(acting)}`,
      variant: "identity",
    };
  }

  const routeModel = resolveMobileShellTitle(items);

  if (actingContext.kind === "organisation") {
    return {
      ...routeModel,
      eyebrow: actingContext.orgName,
      orgActing: true,
    };
  }

  return routeModel;
}

export function shouldUseCompactLegalEntitySwitcher(pathname: string): boolean {
  return !isDashboardOverviewRoute(pathname, "buying") && pathname !== "/dashboard/seller";
}
