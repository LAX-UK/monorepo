"use client";

import {
  FROM_ZOHO_DESCRIPTION,
  FROM_ZOHO_TITLE,
  useQueueFrame,
} from "@/components/from-zoho/use-queue-frame.client";
import {
  SYNC_MODE_LABEL,
  type ZohoQueueQuery,
  checkFigures,
  checkFootnote,
  newArtworkGapLabel,
  skippedReasonLabel,
} from "@/server/domain/zoho-register.vm";
import type { AdminRegisterLastCheck } from "@auction/shop-contracts";
import {
  EmptyState,
  PageHeader,
  StatGrid,
  StatusBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";

type Count = { label: string; count: number };

function CountList({ title, empty, rows }: { title: string; empty: string; rows: Count[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="font-staff text-staff-md font-semibold text-staff-fg">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-staff-sm text-staff-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-staff-line-subtle rounded-staff-md border border-staff-line-subtle">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-4 px-3 py-2 text-staff-sm"
            >
              <span className="min-w-0 text-staff-fg">{row.label}</span>
              <span className="shrink-0 tabular-nums text-staff-muted">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The latest nightly check as a summary: how many Products it read and what became of them, why
 * some were left out and what new artworks still lack. A dry run says plainly that nothing was
 * applied, since its counts describe what would happen.
 */
export function LastCheckView({
  query,
  counts,
  check,
}: {
  query: ZohoQueueQuery;
  counts: { new: number; decisions: number };
  check: AdminRegisterLastCheck;
}) {
  const { views } = useQueueFrame(query, counts);
  const { run } = check;
  const footnote = run ? checkFootnote(run) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={FROM_ZOHO_TITLE} description={FROM_ZOHO_DESCRIPTION} />
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
        <div className="border-b border-staff-line-subtle px-2">{views}</div>
        {run ? (
          <div className="flex flex-col gap-6 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-staff-sm text-staff-muted">
                Checked {formatStaffDateTime(run.finishedAt, { zoneLabel: true })}
              </p>
              <StatusBadge tone={run.mode === "dry_run" ? "warning" : "success"}>
                {SYNC_MODE_LABEL[run.mode]}
              </StatusBadge>
            </div>
            <div className="flex flex-col gap-2">
              <StatGrid label="Last check" items={checkFigures(run)} />
              {footnote || run.mode === "dry_run" ? (
                <p className="text-staff-sm text-staff-muted">
                  {run.mode === "dry_run" ? "A dry run only reports what the check would do. " : ""}
                  {footnote}
                </p>
              ) : null}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <CountList
                title="Why artworks were left out"
                empty="Nothing was left out."
                rows={run.skippedReasons.map((row) => ({
                  label: skippedReasonLabel(row.reason),
                  count: row.count,
                }))}
              />
              <CountList
                title={
                  run.mode === "dry_run" ? "What new artworks would lack" : "What new artworks lack"
                }
                empty="Every new artwork came with everything it needs."
                rows={run.gaps.map((row) => ({
                  label: newArtworkGapLabel(row.gap),
                  count: row.count,
                }))}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            illustration="plinth"
            title="No check has run yet"
            description="The nightly check reads every Product in Zoho. Its result appears here after the first run."
          />
        )}
      </div>
    </div>
  );
}
