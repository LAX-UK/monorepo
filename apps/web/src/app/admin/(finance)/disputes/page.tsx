import { AdminDisputesBoardContainer } from "@/components/admin/admin-disputes-board-container";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { DisputesListPagination } from "@/components/admin/disputes-list-pagination";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { disputesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminDisputesPage } from "@/lib/data/http/disputes.server";
import { adminDisputesKeys } from "@/lib/data/queries/admin-disputes";
import { getQueryClient } from "@/lib/query/get-query-client";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { AdminDisputeCaseSummary } from "@auction/types";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Payment disputes",
  "Stripe chargebacks and disputes with payment context and case timeline.",
);

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; offset?: string; error?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = disputesListController.parseQuery(sp);

  const listQueryParams = {
    offset: query.offset,
    limit: query.limit,
    ...(query.status ? { status: query.status } : {}),
  };

  let rows: Awaited<ReturnType<typeof disputesListController.fetch>>["rows"] = [];
  let hasNextPage = false;
  let loadError: string | null = null;
  let summary: AdminDisputeCaseSummary = {
    open: 0,
    underReview: 0,
    won: 0,
    lost: 0,
    closed: 0,
  };
  let disputesPageData: Awaited<ReturnType<typeof getAdminDisputesPage>> | null = null;
  let dehydratedState: ReturnType<typeof dehydrate> | undefined;

  try {
    const queryClient = getQueryClient();
    const result = await getAdminDisputesPage(listQueryParams);
    queryClient.setQueryData(adminDisputesKeys.list(listQueryParams), result);
    disputesPageData = result;
    rows = result.rows;
    hasNextPage = result.hasNextPage;
    summary = result.summary;
    dehydratedState = dehydrate(queryClient);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load dispute cases.";
  }

  const statusChips = [
    {
      id: "all",
      label: "All",
      href: buildListHref("/admin/disputes", sp, { status: undefined, offset: 0 }),
      active: !query.status,
    },
    {
      id: "open",
      label: "Open",
      href: buildListHref("/admin/disputes", sp, { status: "open", offset: 0 }),
      active: query.status === "open",
    },
    {
      id: "under_review",
      label: "Under review",
      href: buildListHref("/admin/disputes", sp, { status: "under_review", offset: 0 }),
      active: query.status === "under_review",
    },
    {
      id: "closed",
      label: "Closed",
      href: buildListHref("/admin/disputes", sp, { status: "closed", offset: 0 }),
      active: query.status === "closed",
    },
  ];

  const meta = (
    <p className="font-body text-sm text-on-surface-variant">
      For capture and refund actions use{" "}
      <Link href="/admin/payments" className="text-link underline">
        Payments
      </Link>
      .
    </p>
  );

  const pagination =
    !loadError && (query.offset > 0 || hasNextPage) ? (
      <DisputesListPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        hasNextPage={hasNextPage}
      />
    ) : null;

  return (
    <AdminListShell
      variant="queue"
      title="Payment disputes"
      description="Stripe chargebacks and disputes. Open a case for payment context and timeline."
      meta={meta}
      chips={<FilterChipRow label="Status" chips={statusChips} />}
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "open", label: "Open", value: String(summary.open) },
              { id: "review", label: "Under review", value: String(summary.underReview) },
              { id: "page", label: "On page", value: String(rows.length) },
            ]}
          />
        ) : null
      }
      kpiStrip={
        !loadError ? (
          <AdminListKpiStrip
            ariaLabel="Dispute summary"
            tiles={[
              { label: "Open", value: summary.open },
              { label: "Under review", value: summary.underReview },
              { label: "Won", value: summary.won },
              { label: "Lost", value: summary.lost },
            ]}
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      wrapView={false}
      view={
        !loadError && rows.length > 0 && disputesPageData ? (
          <HydrationBoundary state={dehydratedState}>
            <AdminDisputesBoardContainer params={listQueryParams} />
          </HydrationBoundary>
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <CatalogListEmptyState
            title="No disputes"
            description="No dispute cases match this filter."
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}
