"use client";

import { DocumentAttachmentManager } from "@/components/admin/document-attachment-manager";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import {
  sellerAttachSubmissionDocumentResultAction,
  sellerRemoveSubmissionDocumentResultAction,
} from "@/lib/actions/seller-submission-documents";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
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
};

const UPLOAD_STATUSES = new Set<ItemSubmission["status"]>([
  "submitted",
  "under_review",
  "approved",
  "converted",
]);

export function SubmissionSellerDocumentsPanel({
  submissionId,
  status,
  initialDocuments,
  loadFailure = null,
}: Props) {
  if (!UPLOAD_STATUSES.has(status)) return null;

  return (
    <Surface variant="section" className="space-y-4">
      <div>
        <h3 className="font-headline text-base text-on-surface">Supporting documents</h3>
        <p className="mt-1 font-body text-sm text-on-surface-variant">
          Upload certificates, invoices, or condition reports to help specialists review your item.
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
          actions={{
            attach: (input) =>
              sellerAttachSubmissionDocumentResultAction(submissionId, {
                uploadObjectId: input.uploadObjectId,
                kind: input.kind,
                label: input.label,
              }),
            remove: (documentId) =>
              sellerRemoveSubmissionDocumentResultAction(submissionId, documentId),
          }}
        />
      )}
    </Surface>
  );
}
