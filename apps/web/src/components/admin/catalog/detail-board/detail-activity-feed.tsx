import type { DetailActivityRow } from "@/lib/admin/detail-board/types";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import Link from "next/link";
import type { ReactNode } from "react";

export type DetailActivityFeedProps = {
  rows: readonly DetailActivityRow[];
  title?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyMessage?: string;
  className?: string;
};

function ActivityAvatar({ initials }: { initials: string }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container font-label text-xs font-semibold text-on-primary-container"
      aria-hidden
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Recent activity list with optional avatars. */
export function DetailActivityFeed({
  rows,
  title = "Recent activity",
  viewAllHref,
  viewAllLabel = "View all",
  emptyMessage = "No recent activity.",
  className,
}: DetailActivityFeedProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-shell-stroke px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <h2 className="font-headline text-base font-semibold text-on-surface">{title}</h2>
          {rows.length > 0 ? (
            <Badge
              variant="secondary"
              className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
            >
              {rows.length}
            </Badge>
          ) : null}
        </div>
        {viewAllHref ? (
          <Link href={viewAllHref} className="font-label text-xs text-link hover:underline">
            {viewAllLabel}
          </Link>
        ) : null}
      </div>
      <ul className="divide-y divide-shell-stroke/60 px-4 py-2 sm:px-6">
        {rows.length === 0 ? (
          <li className="py-4 font-body text-sm text-on-surface-variant">{emptyMessage}</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="flex items-start gap-3 py-3">
              {row.actorInitials ? <ActivityAvatar initials={row.actorInitials} /> : null}
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-headline text-sm font-medium text-on-surface">{row.label}</p>
                  <p className="font-body text-xs text-on-surface-variant">{row.detail}</p>
                </div>
                <time className="shrink-0 font-label text-xs text-on-surface-variant">
                  {row.when}
                </time>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export type DetailStatCardProps = {
  title: ReactNode;
  rows: readonly { id: string; label: string; value: string }[];
  className?: string;
};

/** Simple label/value stat card (bid activity, audit log). */
export function DetailStatCard({ title, rows, className }: DetailStatCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest p-4 shadow-[var(--shadow-rest)] sm:p-6",
        className,
      )}
    >
      <h2 className="font-headline text-base font-semibold text-on-surface">{title}</h2>
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3">
            <dt className="font-body text-sm text-on-surface-variant">{row.label}</dt>
            <dd className="font-headline text-sm font-semibold tabular-nums text-on-surface">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export type DetailSectionGridProps = {
  children: ReactNode;
  className?: string;
};

/** Two-column grid for paired stat/activity cards. */
export function DetailSectionGrid({ children, className }: DetailSectionGridProps) {
  return <div className={cn("grid gap-6 lg:grid-cols-2", className)}>{children}</div>;
}
