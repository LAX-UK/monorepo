"use client";

import { DocumentAttachmentManager } from "@/components/admin/document-attachment-manager";
import {
  adminAttachSubmissionDocumentResultAction,
  adminRemoveSubmissionDocumentResultAction,
} from "@/lib/actions/admin-documents";
import type { EntityDocument, ItemSubmission } from "@auction/types";
import { submissionDocumentKinds } from "@auction/types";

export function SubmissionDocumentsSection(props: {
  submissionId: string;
  initialDocuments: EntityDocument[];
}) {
  return (
    <DocumentAttachmentManager
      entityKind="submission"
      entityId={props.submissionId}
      kinds={submissionDocumentKinds}
      initialDocuments={props.initialDocuments}
      actions={{
        attach: (input) => adminAttachSubmissionDocumentResultAction(props.submissionId, input),
        remove: (documentId) =>
          adminRemoveSubmissionDocumentResultAction(props.submissionId, documentId),
      }}
    />
  );
}

export function SubmissionMetadataSummary(props: { submission: ItemSubmission }) {
  const s = props.submission;
  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/30 p-4 font-body text-sm">
      <h3 className="mb-3 font-label text-xs uppercase tracking-widest text-secondary">Metadata</h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-on-surface-variant">Year of work</dt>
          <dd className="font-medium text-on-surface">{s.yearOfWork ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Signed</dt>
          <dd className="font-medium text-on-surface">{s.isSigned ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Edition</dt>
          <dd className="font-medium text-on-surface">{s.edition ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Condition (seller)</dt>
          <dd className="font-medium text-on-surface">{s.conditionSelfReport ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
