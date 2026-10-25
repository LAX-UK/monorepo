"use client";

import { SaleDocumentsPanel } from "@/components/admin/sale-form/sale-documents-panel";
import type { EntityDocument } from "@auction/types";

type Props = {
  saleId: string;
  documents: EntityDocument[];
  canManage?: boolean;
};

/** The sale's documents tab: bidder-facing and staff-only files, each listed once. */
export function SaleDocumentsTab({ saleId, documents, canManage = true }: Props) {
  return <SaleDocumentsPanel saleId={saleId} documents={documents} canManage={canManage} />;
}
