"use client";

import { DocumentAttachmentManager } from "@/components/admin/document-attachment-manager";
import {
  adminAttachLotDocumentResultAction,
  adminRemoveLotDocumentResultAction,
} from "@/lib/actions/admin-documents";
import type { EntityDocument } from "@auction/types";
import { lotDocumentKinds } from "@auction/types";

export function LotDocumentsSection(props: {
  lotId: string;
  initialDocuments: EntityDocument[];
}) {
  return (
    <div id="lot-staff-documents">
      <DocumentAttachmentManager
        entityKind="lot"
        entityId={props.lotId}
        kinds={lotDocumentKinds}
        initialDocuments={props.initialDocuments}
        actions={{
          attach: (input) => adminAttachLotDocumentResultAction(props.lotId, input),
          remove: (documentId) => adminRemoveLotDocumentResultAction(props.lotId, documentId),
        }}
      />
    </div>
  );
}
