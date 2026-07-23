"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { LotCatalogueImagesField } from "@/components/admin/lot-catalogue-images-field";
import { LabelCaps } from "@/components/ui/typography";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  fields: Pick<Record<LotCatalogueFieldKey, FieldSpec>, "images">;
};

export function CatalogueImagesSection({ form, fields }: Props) {
  if (!fields.images.visible) return null;

  return (
    <CatalogFormSection
      title="Images"
      description="Catalogue photos and alt text."
      collapsible={false}
    >
      <FormField
        control={form.control}
        name="images"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="mb-2 block">
              <LabelCaps>{fields.images.label}</LabelCaps>
            </FormLabel>
            <FormControl>
              <LotCatalogueImagesField
                value={field.value.map((key, index) => ({
                  key,
                  alt: form.getValues("imageAlts")[index] ?? "",
                }))}
                onChange={(next) => {
                  field.onChange(next.map((item) => item.key));
                  form.setValue(
                    "imageAlts",
                    next.map((item) => item.alt),
                    { shouldDirty: true, shouldValidate: true },
                  );
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </CatalogFormSection>
  );
}
