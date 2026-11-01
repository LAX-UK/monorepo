"use client";

import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DocumentAttachmentManager } from "@/components/dashboard/document-attachment-manager";
import {
  sellerAttachSubmissionDocumentResultAction,
  sellerRemoveSubmissionDocumentResultAction,
} from "@/lib/actions/seller-submission-documents";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { sellerDocumentsPanelShows } from "@/lib/seller/seller-documents-visibility";
import type { EntityDocument, ItemSubmission, SubmissionDocumentKind } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";

const SUBMISSION_DOC_KINDS = [
  "provenance",
  "valuation",
  "correspondence",
  "other",
] as const satisfies readonly SubmissionDocumentKind[];

type Props = {
  submissionId: string;
  status: ItemSubmission["status"];
  initialDocuments: EntityDocument[];
  loadFailure?: DashboardSliceFailure | null;
  /** Whether this person may add and remove documents (the submission policy); else read-only. */
  canManage: boolean;
};

export function SubmissionSellerDocumentsPanel({
  submissionId,
  status,
  initialDocuments,
  loadFailure = null,
  canManage,
}: Props) {
  if (
    !sellerDocumentsPanelShows({
      status,
      canManage,
      failed: Boolean(loadFailure),
      count: initialDocuments.length,
    })
  ) {
    return null;
  }

  return (
    <Surface variant="section" className="space-y-4">
      <div>
        <h3 className="font-headline text-base text-on-surface">Supporting documents</h3>
        <p className="mt-1 font-body text-sm text-on-surface-variant">
          {canManage
            ? "Upload certificates, invoices, or condition reports to help specialists review your item."
            : "Certificates, invoices and condition reports sent with this work."}
        </p>
      </div>
      {loadFailure ? (
        <DashboardSliceErrorAlert failure={loadFailure} />
      ) : (
        <DocumentAttachmentManager
          entityKind="submission"
          entityId={submissionId}
          kinds={SUBMISSION_DOC_KINDS}
          initialDocuments={initialDocuments}
          actions={
            canManage
              ? {
                  attach: (input) =>
                    sellerAttachSubmissionDocumentResultAction(submissionId, {
                      uploadObjectId: input.uploadObjectId,
                      kind: input.kind,
                      label: input.label,
                    }),
                  remove: (documentId) =>
                    sellerRemoveSubmissionDocumentResultAction(submissionId, documentId),
                }
              : null
          }
        />
      )}
    </Surface>
  );
}
