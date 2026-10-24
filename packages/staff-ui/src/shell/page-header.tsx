import type * as React from "react";
import { cn } from "../lib/cn.js";

/** The page title's type style, for titles rendered by other components (e.g. inline editors). */
export const STAFF_PAGE_TITLE_CLASS =
  "font-staff-display text-staff-xl font-semibold tracking-[-0.01em] text-staff-fg";

export type PageHeaderProps = {
  title: React.ReactNode;
  /** One sentence: what this page is for. */
  description?: React.ReactNode;
  /** Breadcrumbs above the title (StaffBreadcrumbs). */
  breadcrumbs?: React.ReactNode;
  /** Status badge(s) beside the title, on record pages. */
  status?: React.ReactNode;
  /** A line of key facts under the title on record pages: amount, owner, dates. */
  meta?: React.ReactNode;
  /** The one primary action. */
  primaryAction?: React.ReactNode;
  /** Up to two secondary buttons; everything else goes in `overflow`. */
  secondaryActions?: React.ReactNode;
  /** An OverflowMenu with the remaining actions. */
  overflow?: React.ReactNode;
  /** Tabs or saved views under the header. */
  tabs?: React.ReactNode;
  className?: string;
};

/**
 * Title, purpose and actions for every staff page. Actions sit right of the title from `md` and
 * under it on a phone, primary last so it lands under the thumb and at the reading end.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  status,
  meta,
  primaryAction,
  secondaryActions,
  overflow,
  tabs,
  className,
}: PageHeaderProps) {
  const hasActions = Boolean(primaryAction || secondaryActions || overflow);
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {breadcrumbs}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className={STAFF_PAGE_TITLE_CLASS}>{title}</h1>
            {status}
          </div>
          {description ? (
            <p className="max-w-[72ch] text-staff-sm text-staff-muted">{description}</p>
          ) : null}
          {meta ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-staff-sm text-staff-muted">
              {meta}
            </div>
          ) : null}
        </div>
        {hasActions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {overflow}
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </div>
      {tabs}
    </header>
  );
}

/** One fact in a PageHeader `meta` line: "Total £100.00". */
export function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-staff-subtle">{label}</span>
      <span className="text-staff-fg tabular-nums">{children}</span>
    </span>
  );
}
