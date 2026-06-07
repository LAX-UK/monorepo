import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { ComplianceAmlBoard } from "@/components/admin/compliance-aml-board";
import { amlListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { summarizeAmlQueue } from "@/lib/data/view-models/admin-aml-table.vm";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

export default async function AdminComplianceAmlPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    limit?: string;
    offset?: string;
    screening?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);

  const user = await requireAdminCapability(AML_REVIEW_ACCESS, "/admin/compliance/aml");
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const canTriage = userHasAccessTo(role, staffRole, AML_REVIEW_ACCESS);
  const canDecide = userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS);
  const query = amlListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof amlListController.fetch>>["rows"] = [];
  let total = 0;
  let summaryRows: Awaited<ReturnType<typeof amlListController.fetch>>["rowsForSummary"] = [];
  let loadError: string | null = null;

  try {
    const result = await amlListController.fetch(query);
    rows = result.rows;
    total = result.total ?? 0;
    summaryRows = result.rowsForSummary ?? result.rows;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load AML screenings.";
  }

  const summary = summarizeAmlQueue(summaryRows);

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/compliance/aml", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/compliance/aml", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminListShell
      variant="queue"
      title="AML / sanctions screening"
      description="Two-stage maker-checker: analyst triage (advisory), then a different MLRO binding clear/block. Cleared screenings lift settlement holds."
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
            ariaLabel="AML queue summary"
            tiles={[
              { label: "Awaiting triage", value: summary.pending },
              { label: "Triaged", value: summary.triaged },
              { label: "Escalated", value: summary.escalated },
              { label: "Total pending", value: total },
            ]}
          />
        ) : null
      }
      wrapView={false}
      view={
        !loadError && rows.length > 0 ? (
          <div className="space-y-4">
            {success ? (
              <Alert>
                <AlertTitle>Done</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}
            <p className="font-body text-sm text-on-surface-variant">
              Also see{" "}
              <Link href="/admin/compliance/source-of-funds" className="text-primary underline">
                Source of Funds queue
              </Link>{" "}
              and payments held for{" "}
              <Link href="/admin/payments?manualReview=1" className="text-primary underline">
                manual review
              </Link>
              .
            </p>
            <ComplianceAmlBoard
              rows={rows}
              canTriage={canTriage}
              canDecide={canDecide}
              currentUserId={user.id}
              initialScreeningId={sp.screening ?? null}
            />
          </div>
        ) : null
      }
      empty={
        !loadError && total === 0 ? (
          <CatalogListEmptyState
            title="No pending AML screenings"
            description="Watchlist matches awaiting triage will appear here. Escalations are also emailed to compliance officers."
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}
