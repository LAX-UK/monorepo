"use client";

import { LotCatalogueImagesField } from "@/components/admin/lot-catalogue-images-field";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { Field, FormSection } from "@auction/staff-ui";
import { type UseFormReturn, useController } from "react-hook-form";
import { LOT_FORM_ID } from "../../lot-field-spec";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  fields: Pick<Record<LotCatalogueFieldKey, FieldSpec>, "images">;
};

export function CatalogueImagesSection({ form, fields }: Props) {
  const { field, fieldState } = useController({ control: form.control, name: "images" });
  if (!fields.images.visible) return null;
  return (
    <FormSection
      title="Media"
      description="The lot's photos, in order, each with a description for screen readers."
    >
      <Field
        id={`${LOT_FORM_ID}-images`}
        label={fields.images.label}
        optional
        error={fieldState.error?.message}
      >
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
      </Field>
    </FormSection>
  );
}
