import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { ComplianceAmlBoard } from "@/components/admin/compliance/compliance-aml-board";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminAmlScreeningsPending } from "@/lib/data/http/compliance.server";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

export default async function AdminComplianceAmlPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);

  const user = await requireAdminCapability(AML_REVIEW_ACCESS, "/admin/compliance/aml");
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const canTriage = userHasAccessTo(role, staffRole, AML_REVIEW_ACCESS);
  const canDecide = userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS);

  let rows: Awaited<ReturnType<typeof getAdminAmlScreeningsPending>> = [];
  let loadError: string | null = null;
  try {
    rows = await getAdminAmlScreeningsPending();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load AML screenings.";
  }

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
      view={
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
          {rows.length > 0 ? (
            <ComplianceAmlBoard
              rows={rows}
              canTriage={canTriage}
              canDecide={canDecide}
              currentUserId={user.id}
            />
          ) : !loadError ? (
            <AdminEmptyState
              title="No pending AML screenings"
              description="Watchlist matches awaiting triage will appear here. Escalations are also emailed to compliance officers."
            />
          ) : null}
        </div>
      }
      empty={null}
    />
  );
}
