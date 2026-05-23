import { SaleDocumentsSection } from "@/components/admin/sale-form/sale-documents-section";
import type { EntityDocument } from "@auction/types";

type Props = {
  saleId: string;
  documents: EntityDocument[];
};

export function SaleDocumentsTab({ saleId, documents }: Props) {
  return <SaleDocumentsSection saleId={saleId} initialDocuments={documents} />;
}
