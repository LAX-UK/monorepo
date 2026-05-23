"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { CatalogDetailTabPanel } from "@/components/admin/catalog";
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
    <CatalogDetailTabPanel
      title="Documents"
      description="Staff-only attachments such as condition reports and provenance files."
      framed={false}
    >
      {props.initialDocuments.length === 0 ? (
        <AdminEmptyState
          title="No documents attached"
          description="Upload PDFs or images that support catalogue staff and post-sale operations."
        />
      ) : null}
      <div
        id="lot-staff-documents"
        className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6"
      >
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
    </CatalogDetailTabPanel>
  );
}
