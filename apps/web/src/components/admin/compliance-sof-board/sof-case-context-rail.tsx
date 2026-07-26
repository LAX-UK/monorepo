import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { SofNextActionCallout } from "@/components/admin/compliance-sof-board/sof-next-action-callout";
import { SofReopenButton } from "@/components/admin/compliance-sof-board/sof-reopen-button";
import { SofRequestDocumentsForm } from "@/components/admin/compliance-sof-board/sof-request-documents-form";
import {
  ComplianceDecideForm,
  ComplianceTriageForm,
} from "@/components/admin/compliance/compliance-review-forms";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

/** Full-width review workflow controls (formerly the SoF context rail). */
export function SofCaseReviewActionsSection({
  row,
  detail,
  canTriage,
  canDecide,
  currentUserId,
}: Props) {
  const readOnly = row.status !== "pending";
  const documentsAlreadyRequested = detail.documentRequest.requestedAt != null;

  return (
    <section
      aria-labelledby="sof-review-actions-title"
      className="space-y-4 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5"
    >
      <AdminSectionLabel id="sof-review-actions-title" as="h2">
        Review actions
      </AdminSectionLabel>

      <SofNextActionCallout
        row={row}
        detail={detail}
        canTriage={canTriage}
        canDecide={canDecide}
        currentUserId={currentUserId}
      />

      {!readOnly && canTriage && !documentsAlreadyRequested ? (
        <SofRequestDocumentsForm caseId={row.id} />
      ) : !readOnly && canTriage && documentsAlreadyRequested ? (
        <p className="rounded-lg border border-outline-variant/40 bg-surface-container-low/40 px-4 py-3 font-body text-sm text-on-surface-variant">
          Document request sent — awaiting buyer upload.
        </p>
      ) : null}

      {!readOnly ? (
        <>
          <ComplianceTriageForm
            entityId={row.id}
            entityKind="sof"
            canTriage={canTriage}
            triageDone={!!row.triageRecommendation}
          />
          <ComplianceDecideForm
            entityId={row.id}
            entityKind="sof"
            canDecide={canDecide}
            triageDone={!!row.triageRecommendation}
            triagedByUserId={row.triagedByUserId}
            currentUserId={currentUserId}
          />
        </>
      ) : null}

      {row.status === "rejected" && canDecide ? (
        <SofReopenButton variant="outline" caseId={row.id} confirmLabel="Reopen">
          Reopen for review
        </SofReopenButton>
      ) : null}

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Case ID", value: row.id },
          { label: "User ID", value: row.userId },
        ]}
      />
    </section>
  );
}

/** @deprecated Use SofCaseReviewActionsSection */
export function SofCaseContextRail(props: Props) {
  return <SofCaseReviewActionsSection {...props} />;
}
