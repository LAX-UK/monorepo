import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { ComplianceRejectedSofPanel } from "@/components/admin/compliance/compliance-rejected-sof-panel";
import { ComplianceSofBoard } from "@/components/admin/compliance/compliance-sof-board";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  getAdminSourceOfFundsPending,
  getAdminSourceOfFundsRejected,
} from "@/lib/data/http/compliance.server";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

export default async function AdminComplianceSourceOfFundsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);

  const user = await requireAdminCapability(AML_REVIEW_ACCESS, "/admin/compliance/source-of-funds");
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const canTriage = userHasAccessTo(role, staffRole, AML_REVIEW_ACCESS);
  const canDecide = userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS);

  let rows: Awaited<ReturnType<typeof getAdminSourceOfFundsPending>> = [];
  let rejectedRows: Awaited<ReturnType<typeof getAdminSourceOfFundsRejected>> = [];
  let loadError: string | null = null;
  try {
    [rows, rejectedRows] = await Promise.all([
      getAdminSourceOfFundsPending(),
      getAdminSourceOfFundsRejected(20),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load Source of Funds cases.";
  }

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
      view={
        <div className="space-y-4">
          {success ? (
            <Alert>
              <AlertTitle>Done</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}
          <p className="font-body text-sm text-on-surface-variant">
            Related:{" "}
            <Link href="/admin/compliance/aml" className="text-primary underline">
              AML screening queue
            </Link>
            .
          </p>
          <ComplianceRejectedSofPanel rows={rejectedRows} canReopen={canDecide} />
          {rows.length > 0 ? (
            <ComplianceSofBoard
              rows={rows}
              canTriage={canTriage}
              canDecide={canDecide}
              currentUserId={user.id}
            />
          ) : !loadError && rejectedRows.length === 0 ? (
            <AdminEmptyState
              title="No pending Source of Funds cases"
              description="Cases open when a buyer crosses the SoF threshold without a valid approval."
            />
          ) : null}
        </div>
      }
      empty={null}
    />
  );
}
