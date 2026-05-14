import { AdminListPage } from "@/components/admin/admin-list-page";
import { ConditionReportFulfillForm } from "@/components/admin/condition-report-fulfill-form";
import { adminDeclineConditionReportAction } from "@/lib/actions/admin";
import { conditionReportsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin.server";
import { PaginationFooter } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

type Props = { searchParams: Promise<{ error?: string; limit?: string; offset?: string }> };

function PendingRow({ row }: { row: AdminConditionReportRequestRow }) {
  return (
    <li className="rounded-lg border border-outline-variant/30 p-4">
      <div className="font-body text-sm">
        <p className="font-medium">
          <Link href={`/admin/lots/${row.lotId}`} className="text-primary hover:underline">
            {row.lotTitle ?? row.lotId}
          </Link>
        </p>
        <p className="text-secondary text-xs">
          From {row.requesterEmail ?? row.requestedByUserId} ·{" "}
          {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
        </p>
        {row.requestNote ? (
          <p className="mt-2 text-xs text-on-surface-variant">“{row.requestNote}”</p>
        ) : null}
      </div>
      <ConditionReportFulfillForm requestId={row.id} />
      <form action={adminDeclineConditionReportAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="requestId" value={row.id} />
        <textarea
          name="responseNote"
          placeholder="Decline reason (optional)"
          className="min-h-14 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-xs"
        />
        <Button type="submit" size="sm" variant="outline" className="min-h-9 w-fit">
          Decline
        </Button>
      </form>
    </li>
  );
}

export default async function AdminConditionReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const err = sp.error ? decodeURIComponent(sp.error) : null;
  const query = conditionReportsListController.parseQuery(sp);

  let pending: AdminConditionReportRequestRow[] = [];
  let pageRowCount = 0;
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await conditionReportsListController.fetch(query);
    total = result.total ?? 0;
    pageRowCount = result.rows.length;
    pending = result.rows.filter((r) => r.status === "pending" || r.status === "in_progress");
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load condition report requests.";
  }

  const errorAlert = err ? (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-body text-sm text-destructive">
      {err}
    </p>
  ) : loadError ? (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-body text-sm text-destructive">
      {loadError}
    </p>
  ) : null;

  const empty =
    !loadError && total === 0 ? (
      <EmptyState title="Queue is clear" description="No pending condition report requests." />
    ) : !loadError && pending.length === 0 ? (
      <p className="font-body text-sm text-on-surface-variant">No rows on this page.</p>
    ) : null;

  const view =
    !loadError && pending.length > 0 ? (
      <ul className="space-y-4">
        {pending.map((row) => (
          <PendingRow key={row.id} row={row} />
        ))}
      </ul>
    ) : null;

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + pageRowCount < total) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        total={total}
        countOnPage={pending.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/condition-reports", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + pageRowCount < total
            ? buildListHref("/admin/condition-reports", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      className="max-w-3xl"
      title="Condition report requests"
      description="Buyer-requested condition reports. Fulfilling publishes the PDF copy block on the public lot page."
      errorAlert={errorAlert}
      view={view}
      empty={empty}
      pagination={pagination}
    />
  );
}
