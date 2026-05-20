"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { SaleDocumentsSection } from "@/components/admin/sale-form/sale-documents-section";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { EntityDocument } from "@auction/types";
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
  mode: "create" | "edit";
  saleId?: string;
  initialSaleDocuments: EntityDocument[];
};

export function SaleDocumentsStep({ form, mode, saleId, initialSaleDocuments }: Props) {
  return (
    <CatalogFormSection title="Documents & terms" collapsible={false}>
      {mode === "edit" && saleId ? (
        <SaleDocumentsSection saleId={saleId} initialDocuments={initialSaleDocuments} />
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
              <Textarea id="terms" rows={4} className="font-body text-sm" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </CatalogFormSection>
  );
}
