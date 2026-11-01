"use client";

import { ConfirmActionButton } from "@/components/dashboard/confirm-action-button";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DocumentUploadForm } from "@/components/dashboard/document-upload-form";
import {
  sellerAttachSubmissionDocumentResultAction,
  sellerRemoveSubmissionDocumentResultAction,
} from "@/lib/actions/seller-submission-documents";
import { documentKindLabel } from "@/lib/admin/document-kind-labels";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { fileSize } from "@/lib/seller/consignment-thread";
import {
  sellerDocumentsPanelShows,
  sellerDocumentsPurpose,
} from "@/lib/seller/seller-documents-visibility";
import { notify } from "@/lib/ui/notify";
import type { EntityDocument, ItemSubmission, SubmissionDocumentKind } from "@auction/types";
import { Button, FileAttachment } from "@auction/ui/lax";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

const CARD = "rounded-lax-card border border-lax-line bg-lax-surface";

/**
 * "Your documents" on the consignment's Documents tab: the files the seller sent with the work,
 * as the same file rows as LAX's, or one line when there are none. "Add a document" opens the
 * uploader for the people who may add them, while the work still takes documents.
 */
export function SubmissionSellerDocumentsPanel({
  submissionId,
  status,
  initialDocuments,
  loadFailure = null,
  canManage,
}: Props) {
  const [documents, setDocuments] = useState<EntityDocument[]>(initialDocuments);
  const [adding, setAdding] = useState(false);
  useEffect(() => setDocuments(initialDocuments), [initialDocuments]);

  const attach = useCallback(
    (input: { uploadObjectId: string; kind: SubmissionDocumentKind; label: string | null }) =>
      sellerAttachSubmissionDocumentResultAction(submissionId, input),
    [submissionId],
  );
  const onAttached = useCallback((document: EntityDocument) => {
    setDocuments((prev) => [...prev, document]);
    setAdding(false);
  }, []);

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

  async function remove(document: EntityDocument, name: string) {
    const res = await sellerRemoveSubmissionDocumentResultAction(submissionId, document.id);
    if (!res.ok) {
      notify.error("Couldn't remove the document", { description: res.error });
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== document.id));
    notify.success(`${name} removed`);
  }

  return (
    <section aria-labelledby="seller-documents-heading" className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-5 pb-4 sm:px-6">
        <div className="min-w-0">
          <h2
            id="seller-documents-heading"
            className="font-lax-display text-lax-18 font-semibold text-lax-fg"
          >
            Your documents
          </h2>
          <p className="mt-1 text-lax-14 leading-5 text-lax-muted">
            {sellerDocumentsPurpose(status, canManage)}
          </p>
        </div>
        {canManage && !adding && !loadFailure ? (
          <Button variant="secondary" icon={<Plus aria-hidden />} onClick={() => setAdding(true)}>
            Add a document
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-4 px-4 pb-5 sm:px-6">
        {loadFailure ? (
          <DashboardSliceErrorAlert failure={loadFailure} />
        ) : documents.length > 0 ? (
          <ul aria-label="Your documents" className="flex flex-col gap-2">
            {documents.map((doc) => {
              const name = doc.fileName ?? doc.label ?? documentKindLabel(doc.kind);
              const note = doc.label && doc.fileName ? doc.label : documentKindLabel(doc.kind);
              return (
                <li key={doc.id} className="flex items-center gap-2">
                  <FileAttachment
                    name={name}
                    href={doc.downloadUrl}
                    kind={doc.contentType?.startsWith("image/") ? "image" : "pdf"}
                    size={fileSize(doc.byteSize)}
                    note={note}
                    thumbnailUrl={doc.contentType?.startsWith("image/") ? doc.downloadUrl : null}
                    className="w-full min-w-0 flex-1"
                  />
                  {canManage ? (
                    <ConfirmActionButton
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${name}`}
                      confirmTitle="Remove this document?"
                      confirmBody={`${name} is taken off this consignment.`}
                      confirmLabel="Remove"
                      onConfirmed={() => remove(doc, name)}
                    >
                      Remove
                    </ConfirmActionButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-lax-14 leading-5 text-lax-fg">You haven't added any documents.</p>
        )}
        {adding ? (
          <div className="flex flex-col gap-3 border-t border-lax-line-subtle pt-4">
            <DocumentUploadForm
              entityKind="submission"
              entityId={submissionId}
              kinds={SUBMISSION_DOC_KINDS}
              attach={attach}
              onAttached={onAttached}
            />
            <div>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
