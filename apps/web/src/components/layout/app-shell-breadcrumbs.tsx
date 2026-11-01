"use client";

import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { MobileShellTitle } from "@/components/layout/mobile-shell-title";
import type { SessionUser } from "@/lib/data/contracts";
import { buildAdminBreadcrumbTrail } from "@/lib/navigation/admin-breadcrumb-trail";
import {
  buildClientBreadcrumbTrail,
  withRecordTitle,
} from "@/lib/navigation/client-breadcrumb-trail";
import { resolveMobileShellTitle } from "@/lib/navigation/mobile-shell-title";
import { useShellChrome } from "@/lib/shell/shell-chrome-context";
import { usePathname } from "next/navigation";

export function AppShellBreadcrumbs({
  role,
  sessionUser,
  variant = "all",
}: {
  role: AppShellRole;
  sessionUser: SessionUser;
  /** `mobile` — header title only; `desktop` — breadcrumb trail only. */
  variant?: "all" | "mobile" | "desktop";
}) {
  const pathname = usePathname();
  const { mobileTitleOverride } = useShellChrome();

  if (role === "client") {
    const items = withRecordTitle(buildClientBreadcrumbTrail(pathname), mobileTitleOverride);
    const routeModel = resolveMobileShellTitle(items);
    const resolvedModel = mobileTitleOverride
      ? { ...routeModel, title: mobileTitleOverride }
      : routeModel;

    return (
      <>
        {variant !== "desktop" ? (
          <div className="min-w-0 flex-1 lg:hidden">
            <MobileShellTitle items={items} model={resolvedModel} />
          </div>
        ) : null}
        {/* A trail of one only repeats the page title, so it is left out. */}
        {variant !== "mobile" && items.length > 1 ? (
          <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block lg:flex-none">
            <Breadcrumbs items={items} className="text-xs" inline />
          </nav>
        ) : null}
      </>
    );
  }

  const items = buildAdminBreadcrumbTrail(pathname, role, sessionUser);

  return (
    <>
      {variant !== "desktop" ? (
        <div className="min-w-0 flex-1 lg:hidden">
          <MobileShellTitle items={items} />
        </div>
      ) : null}
      {variant !== "mobile" ? (
        <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block lg:flex-none">
          <Breadcrumbs items={items} className="text-xs" inline />
        </nav>
      ) : null}
    </>
  );
}
