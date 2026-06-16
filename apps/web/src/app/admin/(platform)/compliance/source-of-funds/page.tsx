import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { ComplianceSofBoard } from "@/components/admin/compliance-sof-board";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { sofListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { buildSofStatusChips, complianceQueueCrossLinksMeta } from "@/lib/admin/sof-list-query";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { summarizeSofQueue } from "@/lib/data/view-models/admin-sof-table.vm";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Source of Funds",
  "Review buyer source-of-funds cases blocking settlement until MLRO approval.",
);

const LIST_PATH = "/admin/compliance/source-of-funds";

function emptyStateCopy(status: "pending" | "rejected" | "approved") {
  if (status === "rejected") {
    return {
      title: "No rejected cases",
      description:
        "Rejected cases stay blocking until manually reopened when the buyer supplies new evidence.",
    };
  }
  if (status === "approved") {
    return {
      title: "No approved cases",
      description:
        "Approved cases clear the settlement gate for the buyer, subject to validity and exposure limits.",
    };
  }
  return {
    title: "No pending Source of Funds cases",
    description: "Cases open when a buyer crosses the SoF threshold without a valid approval.",
  };
}

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

  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);

  const user = await requireAdminCapability(AML_REVIEW_ACCESS, LIST_PATH);
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const canDecide = userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS);
  const query = sofListController.parseQuery(sp);
  const statusChips = buildSofStatusChips(LIST_PATH, sp, query.status);

  let rows: Awaited<ReturnType<typeof sofListController.fetch>>["rows"] = [];
  let total = 0;
  let summaryRows: Awaited<ReturnType<typeof sofListController.fetch>>["rowsForSummary"] = [];
  let loadError: string | null = null;

  try {
    const result = await sofListController.fetch(query);
    rows = result.rows;
    total = result.total ?? 0;
    summaryRows = result.rowsForSummary ?? result.rows;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load Source of Funds cases.";
  }

  const summary = query.status === "pending" ? summarizeSofQueue(summaryRows) : null;
  const { amlHref, paymentsHref } = complianceQueueCrossLinksMeta();

  const meta = (
    <p className="font-body text-sm text-on-surface-variant">
      Also see{" "}
      <Link href={amlHref} className="text-link underline">
        AML screening queue
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

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          query.offset > 0
            ? buildListHref(LIST_PATH, sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref(LIST_PATH, sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  const emptyCopy = emptyStateCopy(query.status);

  return (
    <AdminListShell
      variant="queue"
      title="Source of Funds"
      description="Settlement is gated until a pending case is approved by MLRO (two-stage triage + decide). Rejected cases stay blocking until manually reopened."
      meta={meta}
      chips={<FilterChipRow label="Status" chips={statusChips} />}
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={
              query.status === "pending" && summary
                ? [
                    { id: "pending", label: "Awaiting triage", value: String(summary.pending) },
                    { id: "triaged", label: "Triaged", value: String(summary.triaged) },
                    { id: "page", label: "On page", value: String(rows.length) },
                  ]
                : [
                    {
                      id: "total",
                      label: query.status === "rejected" ? "Rejected" : "Approved",
                      value: String(total),
                    },
                    { id: "page", label: "On page", value: String(rows.length) },
                  ]
            }
          />
        ) : null
      }
      kpiStrip={
        !loadError ? (
          <AdminListKpiStrip
            ariaLabel="Source of Funds queue summary"
            tiles={
              query.status === "pending" && summary
                ? [
                    { label: "Awaiting triage", value: summary.pending },
                    { label: "Triaged", value: summary.triaged },
                    { label: "Total pending", value: total },
                  ]
                : [
                    {
                      label: query.status === "rejected" ? "Rejected cases" : "Approved cases",
                      value: total,
                    },
                    { label: "On page", value: rows.length },
                  ]
            }
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Attention">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      wrapView={false}
      view={
        !loadError && rows.length > 0 ? (
          <div className="space-y-4">
            {successAlert}
            <ComplianceSofBoard rows={rows} status={query.status} canReopen={canDecide} />
          </div>
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
      pagination={pagination}
    />
  );
}
