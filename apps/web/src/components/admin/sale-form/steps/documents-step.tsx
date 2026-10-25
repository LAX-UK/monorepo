"use client";

import { StaffTextAreaField } from "@/components/admin/forms/staff-form-fields";
import { SaleDocumentsPanel } from "@/components/admin/sale-form/sale-documents-panel";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { FormSection } from "@auction/staff-ui";
import type { EntityDocument } from "@auction/types";
import type { UseFormReturn } from "react-hook-form";
import { SALE_FORM_ID } from "../sale-form-id";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  saleId: string;
  initialSaleDocuments: EntityDocument[];
  termsReadOnly?: boolean;
};

export function SaleDocumentsStep({
  form,
  saleId,
  initialSaleDocuments,
  termsReadOnly = false,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <FormSection
        title="Terms of sale"
        description="Documents below are saved as soon as they are added."
      >
        <StaffTextAreaField
          control={form.control}
          formId={SALE_FORM_ID}
          name="terms"
          label="Terms of sale"
          optional
          rows={4}
          disabled={termsReadOnly}
          description={
            termsReadOnly
              ? "Fixed once the sale is published. Bidders still see them on the sale page."
              : "Shown to bidders on the sale page."
          }
        />
      </FormSection>
      <SaleDocumentsPanel saleId={saleId} documents={initialSaleDocuments} />
    </div>
  );
}
