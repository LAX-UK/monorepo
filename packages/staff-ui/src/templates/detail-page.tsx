"use client";

import type * as React from "react";
import { type StaffPermission, useStaffPageAccess } from "../access/staff-access.js";
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
  /**
   * The title renders its own `h1` (a heading with a rename button) instead of being wrapped in
   * one. It must still render exactly one `h1`.
   */
  renderHeading?: boolean;
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
  /**
   * What changing this record needs. Without an explicit `access`, the page is read-only for
   * people who lack it: actions hidden, "View only" with their roles in the header.
   */
  editRequires?: StaffPermission;
  /** The viewer's role, for "View only · Finance"; defaults to the roles the kit was given. */
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
  renderHeading = false,
  status,
  meta,
  primaryAction,
  secondaryActions,
  overflow,
  access: accessProp,
  editRequires,
  roleLabel: roleLabelProp,
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
  const page = useStaffPageAccess(accessProp, editRequires);
  const access = page.access;
  const roleLabel = roleLabelProp ?? page.roleLabel;
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
  // A page that reads its access from `editRequires` leaves each action to its own `requires`;
  // an explicit read-only access hides the primary action outright.
  const actionable =
    (accessProp === undefined || access === "full") && access !== "denied" && !loading && !error;

  const header = (
    <PageHeader
      title={title}
      renderHeading={renderHeading}
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
        <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
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
        <DetailError
          title={error.title ?? "This record did not load"}
          description={error.description}
          onRetry={error.onRetry}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" aria-busy={loading || undefined}>
      {header}
      {loading ? (
        <DetailPageSkeleton withRail={Boolean(rail)} withSummary />
      ) : (
        <>
          {summary && summary.length > 0 ? (
            <section
              aria-label="Summary"
              className="rounded-staff-lg border border-staff-line bg-staff-surface px-4 py-2"
            >
              <KeyValueList items={summary} columns={2} />
            </section>
          ) : null}
          {notice}
          {tabs}
          <DetailColumns rail={rail}>{children}</DetailColumns>
        </>
      )}
    </div>
  );
}

/**
 * A failure in place of a record page's body, or of one routed tab, with Try again. The record's
 * header and tabs stay, so the person keeps their place.
 */
export function DetailError({
  title = "This section did not load",
  description,
  onRetry,
}: {
  title?: string;
  description: React.ReactNode;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
      <ErrorState
        title={title}
        description={description}
        action={
          <StaffButton size="sm" onClick={onRetry}>
            Try again
          </StaffButton>
        }
      />
    </div>
  );
}

/**
 * A record page's body: the main column of sections beside a rail for activity, the timeline and
 * related records (2fr / 1fr from 1280px; the rail stacks under the main column below). Used by
 * `DetailPage`, and directly by a routed tab that has its own rail.
 */
export function DetailColumns({
  rail,
  railLabel = "Activity",
  children,
}: {
  rail?: React.ReactNode;
  /** The rail's landmark name. */
  railLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-6",
        rail && "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start",
      )}
    >
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      {rail ? (
        <aside aria-label={railLabel} className="flex min-w-0 flex-col gap-6">
          {rail}
        </aside>
      ) : null}
    </div>
  );
}

/**
 * The body of a record page while it loads: the summary card (optional) and the main column of
 * section cards beside a rail. A routed tab's `loading` file renders it inside the record frame.
 */
export function DetailPageSkeleton({
  withRail = true,
  withSummary = false,
}: {
  withRail?: boolean;
  withSummary?: boolean;
}) {
  const card = (rows: number) => (
    <div className="flex flex-col gap-3 rounded-staff-lg border border-staff-line bg-staff-surface p-4">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <Skeleton key={index} className="h-3 w-full" />
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      {withSummary ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-staff-lg border border-staff-line bg-staff-surface p-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
            <Skeleton key={index} className="h-3 w-3/4" />
          ))}
        </div>
      ) : null}
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
    </div>
  );
}
