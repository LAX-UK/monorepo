import { AdminDisputesDomainEventsBoard } from "@/components/admin/admin-disputes-domain-events-board";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { disputesDomainEventsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { PaginationFooter } from "@auction/ui";
import Link from "next/link";

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; offset?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = disputesDomainEventsListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof disputesDomainEventsListController.fetch>>["rows"] = [];
  let loadError: string | null = null;
  try {
    const result = await disputesDomainEventsListController.fetch(query);
    rows = result.rows;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load dispute events.";
  }

  const errorAlert =
    error || loadError ? (
      <AdminListAlert title="Could not load">{loadError ?? error}</AdminListAlert>
    ) : null;

  const meta = (
    <p className="font-body text-sm text-on-surface-variant">
      For capture/refund actions use{" "}
      <Link href="/admin/payments" className="text-primary underline">
        Payments
      </Link>
      .
    </p>
  );

  const empty =
    !loadError && rows.length === 0 ? (
      <AdminEmptyState title="No disputes" description="No dispute events recorded yet." />
    ) : null;

  const view =
    !loadError && rows.length > 0 ? <AdminDisputesDomainEventsBoard rows={rows} /> : null;

  const pagination =
    !loadError && (query.offset > 0 || rows.length === query.limit) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/disputes", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          rows.length === query.limit
            ? buildListHref("/admin/disputes", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Payment disputes"
      description="Stripe dispute-related domain events (opened, funds withdrawn, closed). Payloads are redacted per audit policy."
      errorAlert={errorAlert}
      meta={meta}
      view={view}
      empty={empty}
      pagination={pagination}
    />
  );
}
