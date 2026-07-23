import { resolveComplianceCapabilities } from "@/lib/admin/compliance/resolve-compliance-capabilities";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  getAdminSourceOfFundsDetail,
  getAdminUserSourceOfFunds,
} from "@/lib/data/http/compliance.server";
import { buildAdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { AML_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { UserRole } from "@auction/types";
import { cache } from "react";

export const loadAdminSofCaseDetail = cache(async (caseId: string) => {
  const user = await requireAdminCapability(
    AML_REVIEW_ACCESS,
    `/admin/compliance/source-of-funds/${caseId}`,
  );
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const { canTriage, canDecide } = resolveComplianceCapabilities({ role, staffRole });

  const detail = await getAdminSourceOfFundsDetail(caseId);
  if (!detail) return null;

  const buyerCases = await getAdminUserSourceOfFunds(detail.buyer.id);
  const pendingCasesForBuyer =
    buyerCases[0]?.pendingCasesForBuyer ?? (detail.case.status === "pending" ? 1 : 0);

  const row = buildAdminSofTableRow({
    ...detail.case,
    buyerEmail: detail.buyer.email,
    buyerName: detail.buyer.name,
    buyerLabel: detail.buyer.label,
    settlementSummary: null,
    settlementItemCount: detail.settlementItems.length,
    pendingCasesForBuyer,
  });
  row.evidenceCount = detail.submittedDocuments.length;

  return {
    user,
    row,
    detail,
    canTriage,
    canDecide,
    currentUserId: user.id,
  };
});
