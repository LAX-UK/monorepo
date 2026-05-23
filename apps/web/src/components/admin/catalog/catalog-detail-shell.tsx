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
  /** Replaces default mobile action bar when provided (mobile only) */
  mobileActionBar?: ReactNode;
  /** Quiet facts column (lg+) */
  aside?: ReactNode;
  /** Compact metadata row visible below header on mobile only */
  mobileMeta?: ReactNode;
  /** Tabs row rendered above main content (prefer stickySubnav). */
  tabs?: ReactNode;
  /** Sticky zone: tab nav + optional compact status row. */
  stickySubnav?: ReactNode;
  /** Title-adjacent nav (e.g. prev/next lot) */
  titleAddon?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Catalog entity detail — sticky tab bar, mobile single column, quiet aside on lg+. */
export function CatalogDetailShell({
  title,
  description,
  meta,
  breadcrumbs,
  eyebrow,
  actions,
  mobileActions,
  mobileActionBarTrailing,
  mobileActionBar,
  aside,
  mobileMeta,
  tabs: tabsSlot,
  stickySubnav,
  titleAddon,
  children,
  className,
}: Props) {
  const subnav = stickySubnav ?? tabsSlot;
  const titleNode = titleAddon ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">{title}</div>
      {titleAddon}
    </div>
  ) : (
    title
  );

  const showMobileBar =
    Boolean(mobileActionBar) ||
    (mobileActions && mobileActions.length > 0) ||
    Boolean(mobileActionBarTrailing);

  return (
    <AppScreen
      className={cn(
        "mx-auto w-full max-w-7xl space-y-6 md:space-y-8 md:pb-8",
        showMobileBar ? "pb-28" : "pb-8",
        className,
      )}
    >
      <CatalogPageHeader
        title={titleNode}
        {...(description ? { description } : {})}
        {...(meta ? { meta } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(eyebrow ? { eyebrow } : {})}
        actions={actions}
        mobileActionsPlacement="none"
      />
      {mobileMeta ? <div className="lg:hidden">{mobileMeta}</div> : null}
      <div
        className={cn(
          "gap-8",
          aside ? "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : "",
        )}
      >
        <div className="min-w-0 space-y-6">
          {subnav ? (
            <div className="sticky top-0 z-20 -mx-px bg-surface/95 backdrop-blur-sm">{subnav}</div>
          ) : null}
          {children}
        </div>
        {aside ? <aside className="hidden min-w-0 space-y-4 lg:block">{aside}</aside> : null}
      </div>
      {showMobileBar
        ? (mobileActionBar ?? (
            <CatalogMobileActionBar
              actions={mobileActions ?? []}
              {...(mobileActionBarTrailing ? { trailing: mobileActionBarTrailing } : {})}
            />
          ))
        : null}
    </AppScreen>
  );
}
