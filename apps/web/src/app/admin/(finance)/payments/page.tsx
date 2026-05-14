import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminPaymentsBoard } from "@/components/admin/admin-payments-board";
import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { paymentStatusesForChip, paymentsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Suspense } from "react";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; limit?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = paymentsListController.parseQuery(sp);

  let loadError: string | null = null;
  let paymentRows: AdminPaymentTableRow[] = [];
  let summaryRows: AdminPaymentTableRow[] = [];
  try {
    const result = await paymentsListController.fetch(query);
    paymentRows = result.rows;
    summaryRows = result.rowsForSummary ?? result.rows;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load payments.";
  }

  const statusChips = (
    <FilterChipRow
      label="Filter by payment status"
      chips={paymentStatusesForChip.map((s) => ({
        id: s,
        label: s,
        href: buildListHref("/admin/payments", sp, {
          status: s === "all" ? "" : s,
          offset: 0,
        }),
        active: (s === "all" && query.status === undefined) || query.status === s,
      }))}
    />
  );

  const errorAlert =
    error || loadError ? (
      <Alert variant="destructive">
        <AlertTitle>Could not load payments</AlertTitle>
        <AlertDescription>{loadError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const empty =
    !loadError && summaryRows.length === 0 ? (
      <p className="text-on-surface-variant">No payment records yet.</p>
    ) : null;

  const view =
    !loadError && summaryRows.length > 0 ? (
      <Suspense fallback={<PageSkeleton variant="table" />}>
        <AdminPaymentsBoard rows={paymentRows} summaryRows={summaryRows} />
      </Suspense>
    ) : null;

  return (
    <AdminListPage
      title="Payments"
      description="Filter by status, search loaded rows, and use the drawer for capture/refund on touch devices."
      errorAlert={errorAlert}
      chips={statusChips}
      view={view}
      empty={empty}
    />
  );
}
