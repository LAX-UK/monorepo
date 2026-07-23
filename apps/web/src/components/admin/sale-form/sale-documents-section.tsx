"use client";

import { SaleDocumentsTabbedPanel } from "@/components/admin/sale-form/sale-documents-tabbed-panel";
import type { EntityDocument } from "@auction/types";

export function SaleDocumentsSection(props: {
  saleId: string;
  initialDocuments: EntityDocument[];
}) {
  return (
    <SaleDocumentsTabbedPanel saleId={props.saleId} initialDocuments={props.initialDocuments} />
  );
}
