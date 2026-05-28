"use client";

import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import {
  MobileShellTitle,
  resolveMobileHeaderTitleModel,
} from "@/components/layout/mobile-shell-title";
import type { SessionUser } from "@/lib/data/contracts";
import { buildAdminBreadcrumbTrail } from "@/lib/navigation/admin-breadcrumb-trail";
import { buildClientBreadcrumbTrail } from "@/lib/navigation/client-breadcrumb-trail";
import { useShellChrome } from "@/lib/shell/shell-chrome-context";
import { useShellConfig } from "@/lib/shell/shell-config-context";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { usePathname } from "next/navigation";

export function AppShellBreadcrumbs({
  role,
  sessionUser,
  clientWorkspaceMode = "buying",
}: {
  role: AppShellRole;
  sessionUser: SessionUser;
  clientWorkspaceMode?: ClientWorkspaceMode;
}) {
  const pathname = usePathname();
  const config = useShellConfig();
  const { mobileTitleOverride } = useShellChrome();

  if (role === "client") {
    const items = buildClientBreadcrumbTrail(pathname, clientWorkspaceMode);
    const mobileHeader = config.mobileHeader;
    const mobileModel = mobileHeader
      ? resolveMobileHeaderTitleModel(items, {
          pathname,
          workspace: clientWorkspaceMode,
          acting: mobileHeader.acting,
          actingContext: mobileHeader.actingContext,
          userDisplayName: mobileHeader.userDisplayName ?? sessionUser.name,
        })
      : undefined;
    const resolvedModel =
      mobileTitleOverride && mobileModel
        ? { ...mobileModel, title: mobileTitleOverride }
        : mobileTitleOverride
          ? { title: mobileTitleOverride }
          : mobileModel;

    return (
      <>
        <div className="min-w-0 flex-1 lg:hidden">
          <MobileShellTitle items={items} {...(resolvedModel ? { model: resolvedModel } : {})} />
        </div>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block lg:flex-none">
          <Breadcrumbs items={items} className="text-xs" inline />
        </nav>
      </>
    );
  }

  const items = buildAdminBreadcrumbTrail(pathname, role, sessionUser, clientWorkspaceMode);

  return (
    <>
      <div className="min-w-0 flex-1 lg:hidden">
        <MobileShellTitle items={items} />
      </div>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block lg:flex-none">
        <Breadcrumbs items={items} className="text-xs" inline />
      </nav>
    </>
  );
}
