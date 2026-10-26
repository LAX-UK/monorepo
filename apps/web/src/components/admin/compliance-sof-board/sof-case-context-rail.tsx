import { SofNextActionCallout } from "@/components/admin/compliance-sof-board/sof-next-action-callout";
import { SofReopenButton } from "@/components/admin/compliance-sof-board/sof-reopen-button";
import { SofRequestDocumentsForm } from "@/components/admin/compliance-sof-board/sof-request-documents-form";
import {
  ComplianceDecideForm,
  ComplianceTriageForm,
} from "@/components/admin/compliance/compliance-review-forms";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Section } from "@auction/staff-ui";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

/**
 * The review workflow: what happens next, asking the buyer for evidence, the analyst's triage and
 * the MLRO's decision. Only a pending case can be worked; a rejected one can be reopened.
 */
export function SofCaseReviewActionsSection({
  row,
  detail,
  canTriage,
  canDecide,
  currentUserId,
}: Props) {
  const readOnly = row.status !== "pending";
  const documentsAlreadyRequested = detail.documentRequest.requestedAt != null;
  const triageDone = !!row.triageRecommendation;

  return (
    <>
      <SofNextActionCallout
        row={row}
        detail={detail}
        canTriage={canTriage}
        canDecide={canDecide}
        currentUserId={currentUserId}
      />

      {!readOnly && canTriage ? (
        documentsAlreadyRequested ? (
          <p className="text-staff-sm text-staff-muted">
            Document request sent — awaiting buyer upload.
          </p>
        ) : (
          <Section
            title="Request documents"
            description="Ask the buyer for evidence of where the money comes from."
          >
            <SofRequestDocumentsForm caseId={row.id} />
          </Section>
        )
      ) : null}

      {!readOnly ? (
        <>
          <ComplianceTriageForm
            entityId={row.id}
            entityKind="sof"
            canTriage={canTriage}
            triageDone={triageDone}
          />
          <ComplianceDecideForm
            entityId={row.id}
            entityKind="sof"
            canDecide={canDecide}
            triageDone={triageDone}
            triagedByUserId={row.triagedByUserId}
            currentUserId={currentUserId}
          />
        </>
      ) : null}

      {row.status === "rejected" && canDecide ? (
        <div>
          <SofReopenButton caseId={row.id} />
        </div>
      ) : null}
    </>
  );
}
