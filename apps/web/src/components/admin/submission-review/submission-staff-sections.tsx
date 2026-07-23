"use client";

import { DetailEntityTable } from "@/components/admin/catalog/detail-board";
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
  const rows = [
    { id: "year", label: "Year of work", value: s.yearOfWork ?? "—" },
    { id: "signed", label: "Signed", value: s.isSigned ? "Yes" : "No" },
    { id: "edition", label: "Edition", value: s.edition ?? "—" },
    { id: "condition", label: "Condition (seller)", value: s.conditionSelfReport ?? "—" },
  ];

  return (
    <DetailEntityTable
      rows={rows}
      getRowId={(row) => row.id}
      emptyTitle="No metadata"
      columns={[
        {
          id: "field",
          header: "Field",
          cell: (row) => <span className="text-on-surface-variant">{row.label}</span>,
        },
        {
          id: "value",
          header: "Value",
          cell: (row) => <span className="font-medium text-on-surface">{row.value}</span>,
        },
      ]}
    />
  );
}
