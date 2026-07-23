import { AdminDisputesBoardContainer } from "@/components/admin/admin-disputes-board-container";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { buildDisputesListKpiTiles } from "@/lib/admin/finance/build-disputes-list-kpi-tiles";
import { loadAdminDisputesListPage } from "@/lib/admin/finance/load-disputes-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { HydrationBoundary } from "@tanstack/react-query";
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
  const { model, rows, summary, dehydratedState, loadError, pagination } =
    await loadAdminDisputesListPage(sp);
  const { listQueryParams, statusChipSpecs, hasFilters } = model;

  const meta = (
    <p className="font-body text-sm text-on-surface-variant">
      For capture and refund actions use{" "}
      <Link href="/admin/payments" className="text-link underline">
        Payments
      </Link>
      .
    </p>
  );

  return (
    <CatalogListShell
      variant="queue"
      title="Payment disputes"
      description="Stripe chargebacks and disputes. Open a case for payment context and timeline."
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Finance", href: "/admin/finance" }, { label: "Disputes" }]}
        />
      }
      meta={meta}
      chips={<FilterChipRow label="Status" chips={statusChipSpecs} />}
      hasFilters={hasFilters}
      resetHref="/admin/disputes"
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
          <AdminTrendKpiBand
            ariaLabel="Dispute summary"
            tiles={buildDisputesListKpiTiles(summary)}
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load">{loadError ?? error}</AdminListAlert>
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
    >
      {!loadError && rows.length > 0 && dehydratedState ? (
        <HydrationBoundary state={dehydratedState}>
          <AdminDisputesBoardContainer params={listQueryParams} pagination={pagination} />
        </HydrationBoundary>
      ) : null}
    </CatalogListShell>
  );
}
