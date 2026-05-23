import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { SaleDocumentsSection } from "@/components/admin/sale-form/sale-documents-section";
import type { EntityDocument } from "@auction/types";

type Props = {
  saleId: string;
  documents: EntityDocument[];
};

export function SaleDocumentsTab({ saleId, documents }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Documents"
      description="Staff attachments for this sale — terms, condition disclaimers, and operational files."
      framed={false}
    >
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <SaleDocumentsSection saleId={saleId} initialDocuments={documents} />
      </div>
    </CatalogDetailTabPanel>
  );
}
