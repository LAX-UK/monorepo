"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { SaleDocumentsSection } from "@/components/admin/sale-form/sale-documents-section";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { EntityDocument } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import type { UseFormReturn } from "react-hook-form";

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
    <CatalogFormSection title="Documents & terms" collapsible={false}>
      <div className="space-y-2">
        <p className="font-body text-sm text-on-surface-variant">
          PDF attachments (optional) — stored on this sale for staff download.
        </p>
        <SaleDocumentsSection saleId={saleId} initialDocuments={initialSaleDocuments} />
      </div>

      {termsReadOnly ? (
        <Alert>
          <AlertTitle>Terms are locked after publish</AlertTitle>
          <AlertDescription>
            Terms of sale cannot be changed after a sale is published. PDF attachments can still be
            managed from this section.
          </AlertDescription>
        </Alert>
      ) : null}

      <FormField
        control={form.control}
        name="terms"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="mb-2 block">
              <LabelCaps>Terms of sale</LabelCaps>
            </FormLabel>
            <FormControl>
              <Textarea
                id="terms"
                rows={4}
                className="font-body text-sm"
                readOnly={termsReadOnly}
                aria-readonly={termsReadOnly}
                {...field}
              />
            </FormControl>
            <p className="font-body text-xs text-on-surface-variant">
              {termsReadOnly
                ? "Existing terms remain visible to bidders on the public sale page."
                : "Shown to bidders on the public sale page when filled in."}
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </CatalogFormSection>
  );
}
