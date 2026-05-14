"use client";

import { DocumentAttachmentManager } from "@/components/admin/document-attachment-manager";
import {
  adminAttachSaleDocumentResultAction,
  adminRemoveSaleDocumentResultAction,
} from "@/lib/actions/admin-documents";
import type { EntityDocument } from "@auction/types";
import { saleDocumentKinds } from "@auction/types";

export function SaleDocumentsSection(props: {
  saleId: string;
  initialDocuments: EntityDocument[];
}) {
  return (
    <DocumentAttachmentManager
      entityKind="sale"
      entityId={props.saleId}
      kinds={saleDocumentKinds}
      initialDocuments={props.initialDocuments}
      actions={{
        attach: (input) => adminAttachSaleDocumentResultAction(props.saleId, input),
        remove: (documentId) => adminRemoveSaleDocumentResultAction(props.saleId, documentId),
      }}
    />
  );
}
