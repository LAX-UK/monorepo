import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { ComplianceSofBoard } from "@/components/admin/compliance-sof-board";
import { ComplianceApprovedSofPanel } from "@/components/admin/compliance/compliance-approved-sof-panel";
import { ComplianceRejectedSofPanel } from "@/components/admin/compliance/compliance-rejected-sof-panel";
import { sofListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  getAdminSourceOfFundsApproved,
  getAdminSourceOfFundsRejected,
} from "@/lib/data/http/compliance.server";
import { summarizeSofQueue } from "@/lib/data/view-models/admin-sof-table.vm";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

export default async function AdminComplianceSourceOfFundsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; limit?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);

  const user = await requireAdminCapability(AML_REVIEW_ACCESS, "/admin/compliance/source-of-funds");
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const canTriage = userHasAccessTo(role, staffRole, AML_REVIEW_ACCESS);
  const canDecide = userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS);
  const query = sofListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof sofListController.fetch>>["rows"] = [];
  let total = 0;
  let summaryRows: Awaited<ReturnType<typeof sofListController.fetch>>["rowsForSummary"] = [];
  let rejectedRows: Awaited<ReturnType<typeof getAdminSourceOfFundsRejected>> = [];
  let approvedRows: Awaited<ReturnType<typeof getAdminSourceOfFundsApproved>> = [];
  let loadError: string | null = null;

  try {
    const [result, rejected, approved] = await Promise.all([
      sofListController.fetch(query),
      getAdminSourceOfFundsRejected(20),
      getAdminSourceOfFundsApproved(20),
    ]);
    rows = result.rows;
    total = result.total ?? 0;
    summaryRows = result.rowsForSummary ?? result.rows;
    rejectedRows = rejected;
    approvedRows = approved;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load Source of Funds cases.";
  }

  const summary = summarizeSofQueue(summaryRows);

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/compliance/source-of-funds", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/compliance/source-of-funds", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminListShell
      variant="queue"
      title="Source of Funds"
      description="Settlement is gated until a pending case is approved by MLRO (two-stage triage + decide). Rejected cases stay blocking until manually reopened."
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Attention">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "pending", label: "Awaiting triage", value: String(summary.pending) },
              { id: "triaged", label: "Triaged", value: String(summary.triaged) },
              { id: "page", label: "On page", value: String(rows.length) },
            ]}
          />
        ) : null
      }
      kpiStrip={
        !loadError ? (
          <AdminListKpiStrip
            ariaLabel="Source of Funds queue summary"
            tiles={[
              { label: "Awaiting triage", value: summary.pending },
              { label: "Triaged", value: summary.triaged },
              { label: "Approved (recent)", value: approvedRows.length },
              { label: "Rejected (recent)", value: rejectedRows.length },
              { label: "Total pending", value: total },
            ]}
          />
        ) : null
      }
      wrapView={false}
      view={
        !loadError ? (
          <div className="space-y-4">
            {success ? (
              <Alert>
                <AlertTitle>Done</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}
            <p className="font-body text-sm text-on-surface-variant">
              Related:{" "}
              <Link href="/admin/compliance/aml" className="text-link underline">
                AML screening queue
              </Link>
              .
            </p>
            <ComplianceApprovedSofPanel rows={approvedRows} />
            <ComplianceRejectedSofPanel rows={rejectedRows} canReopen={canDecide} />
            {rows.length > 0 ? (
              <ComplianceSofBoard
                rows={rows}
                canTriage={canTriage}
                canDecide={canDecide}
                currentUserId={user.id}
              />
            ) : null}
          </div>
        ) : null
      }
      empty={
        !loadError && total === 0 && rejectedRows.length === 0 ? (
          <CatalogListEmptyState
            title="No pending Source of Funds cases"
            description="Cases open when a buyer crosses the SoF threshold without a valid approval."
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}
