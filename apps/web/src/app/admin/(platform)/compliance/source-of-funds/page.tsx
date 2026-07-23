import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { ComplianceSofBoardContainer } from "@/components/admin/compliance-sof-board/container";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import {
  buildSofListKpiTiles,
  buildSofMobileMetrics,
} from "@/lib/admin/compliance/build-sof-list-kpi-tiles";
import { sofEmptyStateCopy } from "@/lib/admin/compliance/build-sof-list-page-model";
import { loadAdminSofListPage } from "@/lib/admin/compliance/load-sof-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { complianceQueueCrossLinksMeta } from "@/lib/admin/sof-list-query";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { AML_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Source of Funds",
  "Review buyer source-of-funds cases blocking settlement until MLRO approval.",
);

const LIST_PATH = "/admin/compliance/source-of-funds";

const complianceBreadcrumbs = (
  <CatalogBreadcrumbs
    segments={[{ label: "Compliance", href: LIST_PATH }, { label: "Source of Funds" }]}
  />
);

export default async function AdminComplianceSourceOfFundsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    limit?: string;
    offset?: string;
    status?: string;
    case?: string;
  }>;
}) {
  const sp = await searchParams;
  const caseId = sp.case?.trim();
  if (caseId) {
    redirect(`/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}`);
  }

  const user = await requireAdminCapability(AML_REVIEW_ACCESS, LIST_PATH);

  const loaded = await loadAdminSofListPage(sp, user);
  const { model, rows, summary, loadError, capabilities, pagination } = loaded;
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);
  const { amlHref, paymentsHref } = complianceQueueCrossLinksMeta();
  const emptyCopy = sofEmptyStateCopy(model.query.status);

  const meta = (
    <p className="font-body text-sm text-on-surface-variant">
      Also see{" "}
      <Link href={amlHref} className="text-link underline">
        AML screenings
      </Link>{" "}
      and payments held for{" "}
      <Link href={paymentsHref} className="text-link underline">
        manual review
      </Link>
      .
    </p>
  );

  const successAlert = success ? (
    <Alert>
      <AlertTitle>Done</AlertTitle>
      <AlertDescription>{success}</AlertDescription>
    </Alert>
  ) : null;

  return (
    <CatalogListShell
      variant="queue"
      title="Source of Funds"
      description="Settlement is gated until a pending case is approved by MLRO (two-stage triage + decide). Rejected cases stay blocking until manually reopened."
      breadcrumbs={complianceBreadcrumbs}
      meta={meta}
      chips={<FilterChipRow label="Status" chips={model.statusChipSpecs} />}
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={buildSofMobileMetrics({
              status: model.query.status,
              summary,
              countOnPage: rows.length,
            })}
          />
        ) : null
      }
      kpiStrip={
        !loadError ? (
          <AdminTrendKpiBand
            ariaLabel="Source of Funds cases summary"
            tiles={buildSofListKpiTiles({ status: model.query.status, summary })}
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
          <div className="space-y-4">
            {successAlert}
            <CatalogListEmptyState title={emptyCopy.title} description={emptyCopy.description} />
          </div>
        ) : null
      }
    >
      {!loadError && rows.length > 0 ? (
        <div className="space-y-4">
          {successAlert}
          <ComplianceSofBoardContainer
            rows={rows}
            status={model.query.status}
            canReopen={capabilities.canReopen}
            listReturnTarget={model.listReturnTarget}
            pagination={pagination}
          />
        </div>
      ) : null}
    </CatalogListShell>
  );
}
