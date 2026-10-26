"use client";

import { StaffEntityMultiField } from "@/components/admin/forms/staff-form-fields";
import { categoryPickerOptions } from "@/lib/admin/catalog/category-picker-options";
import { FormSection } from "@auction/staff-ui";
import type { CategoryNode } from "@auction/types";
import { useMemo } from "react";
import { ARTIST_FORM_ID } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps } from "../types";

/** The departments a creator is filed under: the same taxonomy as their lots. */
export function CategoriesSection({
  control,
  categories,
  disabled = false,
}: ArtistFormSectionProps & { categories: CategoryNode[] }) {
  const options = useMemo(() => categoryPickerOptions(categories), [categories]);
  return (
    <FormSection
      title="Departments"
      description="The collecting categories this creator belongs to."
    >
      <StaffEntityMultiField
        control={control}
        formId={ARTIST_FORM_ID}
        name="categoryIds"
        label="Departments"
        optional
        description="Used for directory pages and filters. The first one chosen is the main department."
        options={options}
        max={20}
        placeholder="Choose departments"
        searchPlaceholder="Search departments"
        emptyText="No departments match."
        disabled={disabled}
      />
    </FormSection>
  );
}
