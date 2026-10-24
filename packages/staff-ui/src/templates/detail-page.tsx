import type * as React from "react";
import { type KeyValueItem, KeyValueList } from "../display/key-value-list.js";
import { AccessDeniedState, ErrorState, Skeleton, ViewOnlyBadge } from "../display/states.js";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { PageHeader } from "../shell/page-header.js";
import type { ListPageAccess } from "./list-page.js";

export type DetailPageProps = {
  /** StaffBreadcrumbs: section, parent records, this record. */
  breadcrumbs?: React.ReactNode;
  /** RecordPager ("‹ 3 of 50 ›"), right of the breadcrumbs, when opened from a list. */
  pager?: React.ReactNode;
  /** The record's human name or reference. */
  title: React.ReactNode;
  /** Status badge(s) beside the title; at most two. */
  status?: React.ReactNode;
  /** A line of 3–5 key facts (MetaItem) under the title. */
  meta?: React.ReactNode;
  /** The next step in the record's life; none when there is no next step. */
  primaryAction?: React.ReactNode;
  /** Up to two secondary actions. */
  secondaryActions?: React.ReactNode;
  /** An OverflowMenu with the rest, destructive last. */
  overflow?: React.ReactNode;

  access?: ListPageAccess;
  /** The viewer's role, for "View only · Finance". */
  roleLabel?: string;
  /** What the record is, for "You don't have access to Payments". */
  resource?: string;
  requiredRole?: string;

  /** Key facts in a two-column card under the header. */
  summary?: readonly KeyValueItem[];
  /** A Notice about the whole record: why the next step is blocked, or that it changed. */
  notice?: React.ReactNode;
  /** TabNav, only when the record has more than four independent, heavy sections. */
  tabs?: React.ReactNode;
  /** The side column: activity, timeline, related records. Stacks under the main column below 1280px. */
  rail?: React.ReactNode;
  /** The main column: sections of work. */
  children?: React.ReactNode;

  loading?: boolean;
  error?: { title?: string; description: React.ReactNode; onRetry: () => void } | null;
};

/**
 * The staff record page, in one fixed order: breadcrumbs (and the record pager), the title with
 * its status, key facts and actions, a summary card, an optional notice and tabs, then the main
 * column of sections beside a rail for activity and the timeline (2fr / 1fr from 1280px).
 */
export function DetailPage({
  breadcrumbs,
  pager,
  title,
  status,
  meta,
  primaryAction,
  secondaryActions,
  overflow,
  access = "full",
  roleLabel,
  resource,
  requiredRole,
  summary,
  notice,
  tabs,
  rail,
  children,
  loading = false,
  error,
}: DetailPageProps) {
  const readOnly = access === "read-only";
  const crumbs =
    breadcrumbs || pager ? (
      <div className="flex min-h-control-sm items-center justify-between gap-3">
        <div className="min-w-0">{breadcrumbs}</div>
        {pager ? <div className="shrink-0">{pager}</div> : null}
      </div>
    ) : null;
  const statusNode =
    status || readOnly ? (
      <>
        {status}
        {readOnly ? <ViewOnlyBadge {...(roleLabel ? { role: roleLabel } : {})} /> : null}
      </>
    ) : null;
  const actionable = access === "full" && !loading && !error;

  const header = (
    <PageHeader
      title={title}
      {...(crumbs ? { breadcrumbs: crumbs } : {})}
      {...(statusNode && access !== "denied" ? { status: statusNode } : {})}
      {...(meta && access !== "denied" ? { meta } : {})}
      {...(actionable && primaryAction ? { primaryAction } : {})}
      {...(access !== "denied" && !loading && !error && secondaryActions
        ? { secondaryActions }
        : {})}
      {...(access !== "denied" && !loading && !error && overflow ? { overflow } : {})}
    />
  );

  if (access === "denied") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-staff-md border border-staff-line bg-staff-surface">
          <AccessDeniedState
            resource={resource ?? "this record"}
            {...(requiredRole ? { requiredRole } : {})}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-staff-md border border-staff-line bg-staff-surface">
          <ErrorState
            title={error.title ?? "This record did not load"}
            description={error.description}
            action={
              <StaffButton size="sm" onClick={error.onRetry}>
                Try again
              </StaffButton>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" aria-busy={loading || undefined}>
      {header}
      {loading ? (
        <DetailPageSkeleton withRail={Boolean(rail)} />
      ) : (
        <>
          {summary && summary.length > 0 ? (
            <section
              aria-label="Summary"
              className="rounded-staff-md border border-staff-line bg-staff-surface px-4 py-2"
            >
              <KeyValueList items={summary} columns={2} />
            </section>
          ) : null}
          {notice}
          {tabs}
          <div
            className={cn(
              "grid gap-6",
              rail && "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start",
            )}
          >
            <div className="flex min-w-0 flex-col gap-6">{children}</div>
            {rail ? (
              <aside aria-label="Activity" className="flex min-w-0 flex-col gap-6">
                {rail}
              </aside>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function DetailPageSkeleton({ withRail }: { withRail: boolean }) {
  const card = (rows: number) => (
    <div className="flex flex-col gap-3 rounded-staff-md border border-staff-line bg-staff-surface p-4">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <Skeleton key={index} className="h-3 w-full" />
      ))}
    </div>
  );
  return (
    <>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-staff-md border border-staff-line bg-staff-surface p-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
          <Skeleton key={index} className="h-3 w-3/4" />
        ))}
      </div>
      <div
        className={cn(
          "grid gap-6",
          withRail && "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start",
        )}
      >
        <div className="flex flex-col gap-6">
          {card(4)}
          {card(3)}
        </div>
        {withRail ? card(5) : null}
      </div>
    </>
  );
}
