import type { BreadcrumbItem } from "@/components/dashboard/primitives/breadcrumbs";
import type { ActingContext } from "@/lib/auth/capabilities";
import {
  type MobileShellTitleModel,
  resolveMobileShellTitle,
} from "@/lib/navigation/mobile-shell-title";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";

/**
 * The mobile header title for a route. When buying as an organisation its name sits above the
 * title; in Selling the switcher beside the title already shows the account, so the title stands
 * alone and is never squeezed by an eyebrow.
 */
export function resolveMobileHeaderTitleModel(
  items: readonly BreadcrumbItem[],
  options: { actingContext: ActingContext; workspace: ClientWorkspaceMode },
): MobileShellTitleModel {
  const routeModel = resolveMobileShellTitle(items);

  if (options.workspace === "buying" && options.actingContext.kind === "organisation") {
    return {
      ...routeModel,
      eyebrow: options.actingContext.orgName,
      orgActing: true,
    };
  }

  return routeModel;
}
