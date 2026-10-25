"use client";

import { StaffTextAreaField } from "@/components/admin/forms/staff-form-fields";
import { SaleDocumentsSection } from "@/components/admin/sale-form/sale-documents-section";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { Field, FormSection } from "@auction/staff-ui";
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
    <FormSection
      title="Documents and terms"
      description="Files for staff and for bidders, and the sale's terms of sale."
    >
      <Field label="Documents" optional description="Saved as soon as they are added.">
        <SaleDocumentsSection saleId={saleId} initialDocuments={initialSaleDocuments} />
      </Field>
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
  );
}
