import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminConditionReportsBoard } from "@/components/admin/condition-reports-board";
import { conditionReportsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin.server";
import { PaginationFooter } from "@auction/ui";

type Props = { searchParams: Promise<{ error?: string; limit?: string; offset?: string }> };

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

  const errorAlert =
    err || loadError ? (
      <AdminListAlert title="Could not load condition reports">{loadError ?? err}</AdminListAlert>
    ) : null;

  const empty =
    !loadError && total === 0 ? (
      <AdminEmptyState title="Queue is clear" description="No pending condition report requests." />
    ) : !loadError && pending.length === 0 ? (
      <p className="font-body text-sm text-on-surface-variant">No rows on this page.</p>
    ) : null;

  const view =
    !loadError && pending.length > 0 ? <AdminConditionReportsBoard rows={pending} /> : null;

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
      className="max-w-5xl"
      title="Condition report requests"
      description="Buyer-requested condition reports. Fulfilling publishes the PDF copy block on the public lot page."
      errorAlert={errorAlert}
      view={view}
      empty={empty}
      pagination={pagination}
    />
  );
}
