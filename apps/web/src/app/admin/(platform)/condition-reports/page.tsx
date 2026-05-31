import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogConditionReportsFilterToolbar } from "@/components/admin/catalog/catalog-condition-reports-filter-toolbar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogOpsBreadcrumb } from "@/components/admin/catalog/catalog-ops-breadcrumb";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogRelatedWork } from "@/components/admin/catalog/catalog-related-work";
import { AdminConditionReportsBoard } from "@/components/admin/condition-reports-board";
import { conditionReportsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildConditionReportsActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Condition reports",
  "Respond to buyer condition report requests.",
);

type Props = {
  searchParams: Promise<{ error?: string; limit?: string; offset?: string; lens?: string }>;
};

export default async function AdminConditionReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = conditionReportsListController.parseQuery(sp);
  const activeLensId = query.lens ?? "open";
  const navCounts = await getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS);
  const activeFilterChips = buildConditionReportsActiveFilterChips(sp, {
    activeLens: activeLensId,
  });

  let rows: Awaited<ReturnType<typeof conditionReportsListController.fetch>>["rows"] = [];
  let pageRowCount = 0;
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await conditionReportsListController.fetch(query);
    total = result.total ?? 0;
    pageRowCount = result.rows.length;
    rows = result.rows;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load condition report requests.";
  }

  const errorAlert =
    error || loadError ? (
      <AdminListAlert title="Could not load condition reports">{loadError ?? error}</AdminListAlert>
    ) : null;

  const empty =
    !loadError && total === 0 ? (
      <CatalogListEmptyState
        title="Queue is clear"
        description={
          activeLensId === "open"
            ? "No pending or in-progress condition report requests."
            : "No requests match this lens."
        }
      />
    ) : !loadError && rows.length === 0 ? (
      <CatalogListEmptyState
        title="No rows on this page"
        description="Try the previous page or switch lenses."
      />
    ) : null;

  const view = !loadError && rows.length > 0 ? <AdminConditionReportsBoard rows={rows} /> : null;

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + pageRowCount < total) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
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

  const filterBar = (
    <Suspense
      fallback={
        <div
          className="min-h-[3.25rem] rounded-md border border-border-hairline bg-surface-container-low/40"
          aria-hidden
        />
      }
    >
      <CatalogConditionReportsFilterToolbar
        activeLensId={activeLensId}
        searchParams={sp}
        activeFilterChips={activeFilterChips}
      />
    </Suspense>
  );

  return (
    <CatalogListShell
      title="Condition report requests"
      description="Buyer-requested condition reports. Fulfilling publishes the PDF copy block on the public lot page."
      meta={<CatalogRelatedWork variant="conditionReports" navCounts={navCounts} />}
      breadcrumbs={<CatalogOpsBreadcrumb current="Condition reports" />}
      filterBar={filterBar}
      errorAlert={errorAlert}
      mobileSummary={
        !loadError && rows.length > 0 ? (
          <CatalogListMobileSummary
            segments={[
              `${rows.length} on page`,
              total > 0 ? `${total} total` : null,
              activeLensId !== "open" ? activeLensId.replaceAll("_", " ") : "Open queue",
            ]}
          />
        ) : null
      }
      empty={empty}
      pagination={pagination}
    >
      {view}
    </CatalogListShell>
  );
}
