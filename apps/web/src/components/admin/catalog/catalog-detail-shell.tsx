import { AppScreen } from "@/components/dashboard/dashboard-page";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { type CatalogMobileAction, CatalogMobileActionBar } from "./catalog-mobile-action-bar";
import { CatalogPageHeader } from "./catalog-page-header";

type Props = {
  title: ReactNode;
  description?: string | undefined;
  meta?: ReactNode;
  breadcrumbs?: ReactNode;
  eyebrow?: ReactNode;
  /** Desktop header actions */
  actions?: ReactNode;
  mobileActions?: readonly CatalogMobileAction[];
  /** Buttons rendered after URL actions on the fixed mobile bar only */
  mobileActionBarTrailing?: ReactNode;
  /** Quiet facts column (lg+) */
  aside?: ReactNode;
  /** Tabs row rendered above main content */
  tabs?: ReactNode;
  /** Title-adjacent nav (e.g. prev/next lot) */
  titleAddon?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Catalog entity detail — non-sticky, mobile single column, quiet aside on lg+. */
export function CatalogDetailShell({
  title,
  description,
  meta,
  breadcrumbs,
  eyebrow,
  actions,
  mobileActions,
  mobileActionBarTrailing,
  aside,
  tabs,
  titleAddon,
  children,
  className,
}: Props) {
  const titleNode = titleAddon ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">{title}</div>
      {titleAddon}
    </div>
  ) : (
    title
  );

  return (
    <AppScreen
      className={cn("mx-auto w-full max-w-7xl space-y-6 pb-28 md:space-y-8 md:pb-8", className)}
    >
      <CatalogPageHeader
        title={titleNode}
        {...(description ? { description } : {})}
        {...(meta ? { meta } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(eyebrow ? { eyebrow } : {})}
        actions={actions}
        {...(mobileActions ? { mobileActions } : {})}
      />
      <div
        className={cn(
          "gap-8",
          aside ? "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : "",
        )}
      >
        <div className="min-w-0 space-y-6">
          {tabs}
          {children}
        </div>
        {aside ? <aside className="hidden min-w-0 space-y-4 lg:block">{aside}</aside> : null}
      </div>
      {(mobileActions && mobileActions.length > 0) || mobileActionBarTrailing ? (
        <CatalogMobileActionBar
          actions={mobileActions ?? []}
          {...(mobileActionBarTrailing ? { trailing: mobileActionBarTrailing } : {})}
        />
      ) : null}
    </AppScreen>
  );
}
