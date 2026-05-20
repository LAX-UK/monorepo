import { AppScreen } from "@/components/dashboard/dashboard-page";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { type CatalogMobileAction, CatalogMobileActionBar } from "./catalog-mobile-action-bar";
import { CatalogPageHeader } from "./catalog-page-header";

type Props = {
  title: ReactNode;
  description?: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  mobileActions?: readonly CatalogMobileAction[];
  children: ReactNode;
  className?: string;
};

/** Create/edit pages — single column mobile, optional desktop actions in header. */
export function CatalogFormShell({
  title,
  description,
  breadcrumbs,
  actions,
  mobileActions,
  children,
  className,
}: Props) {
  return (
    <AppScreen
      className={cn(
        "mx-auto w-full max-w-3xl space-y-6 pb-28 md:max-w-4xl md:space-y-8 md:pb-8",
        className,
      )}
    >
      <CatalogPageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        actions={actions}
        {...(mobileActions ? { mobileActions } : {})}
      />
      <div className="min-w-0">{children}</div>
      {mobileActions && mobileActions.length > 0 ? (
        <CatalogMobileActionBar actions={mobileActions} />
      ) : null}
    </AppScreen>
  );
}
