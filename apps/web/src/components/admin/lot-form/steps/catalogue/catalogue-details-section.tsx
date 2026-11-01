"use client";

import {
  StaffCheckboxField,
  StaffEntityField,
  StaffEntityMultiField,
  StaffTextField,
} from "@/components/admin/forms/staff-form-fields";
import { categoryPickerOptions } from "@/lib/admin/catalog/category-picker-options";
import type { FieldSpec, LotCatalogueFieldKey } from "@/lib/admin/lot-catalogue";
import { artistOption, searchArtistOptions } from "@/lib/admin/pickers/staff-entity-search";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { FieldRow, FormSection } from "@auction/staff-ui";
import type { ArtistProfile, CategoryNode } from "@auction/types";
import { useMemo } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { LOT_FORM_ID, lotFieldProps } from "../../lot-field-spec";

type Props = {
  form: UseFormReturn<AdminLotFormValues>;
  categories: CategoryNode[];
  artists: ArtistProfile[];
  showArtistField?: boolean;
  fields: Pick<
    Record<LotCatalogueFieldKey, FieldSpec>,
    "artistId" | "categoryIds" | "medium" | "dimensions"
  >;
};

export function CatalogueDetailsSection({
  form,
  categories,
  artists,
  showArtistField = true,
  fields,
}: Props) {
  const showArtist = showArtistField && fields.artistId.visible;
  const artistId = useWatch({ control: form.control, name: "artistId" });
  const categoryOptions = useMemo(() => categoryPickerOptions(categories), [categories]);
  const selectedArtist = useMemo(() => {
    const found = artistId ? artists.find((artist) => artist.id === artistId) : null;
    return found ? artistOption(found) : null;
  }, [artistId, artists]);

  if (
    !showArtist &&
    !fields.categoryIds.visible &&
    !fields.medium.visible &&
    !fields.dimensions.visible
  ) {
    return null;
  }

  return (
    <FormSection
      title="Catalogue details"
      description="Who made it, where it is listed, and what it is made of."
    >
      {showArtist ? (
        <StaffEntityField
          control={form.control}
          name="artistId"
          formId={LOT_FORM_ID}
          {...lotFieldProps(fields.artistId)}
          description="Who the lot is catalogued under. Needed before the lot is published."
          search={searchArtistOptions}
          selected={selectedArtist}
          placeholder="Choose an artist"
          searchPlaceholder="Type at least two letters"
          emptyText="No artists match. Add the artist from Artists first."
        />
      ) : null}
      {fields.categoryIds.visible ? (
        <StaffEntityMultiField
          control={form.control}
          name="categoryIds"
          formId={LOT_FORM_ID}
          {...lotFieldProps(fields.categoryIds)}
          options={categoryOptions}
          placeholder="Add a category"
          searchPlaceholder="Search categories"
          emptyText="No categories match."
        />
      ) : null}
      {fields.medium.visible || fields.dimensions.visible ? (
        <FieldRow>
          {fields.medium.visible ? (
            <StaffTextField
              control={form.control}
              name="medium"
              formId={LOT_FORM_ID}
              {...lotFieldProps(fields.medium)}
              placeholder="e.g. Oil on canvas"
            />
          ) : null}
          {fields.dimensions.visible ? (
            <StaffTextField
              control={form.control}
              name="dimensions"
              formId={LOT_FORM_ID}
              {...lotFieldProps(fields.dimensions)}
              placeholder="e.g. 60 × 80 cm"
            />
          ) : null}
        </FieldRow>
      ) : null}
      {fields.dimensions.visible ? (
        <>
          <StaffCheckboxField
            control={form.control}
            name="photoIncludesFrame"
            formId={LOT_FORM_ID}
            label="The photo includes the frame"
            description="Tick this when the picture shows the work in its frame. The home page then scales the work by its framed size."
          />
          <FieldRow>
            <StaffTextField
              control={form.control}
              name="framedWidthCm"
              formId={LOT_FORM_ID}
              label="Framed width (cm)"
              optional
              inputMode="decimal"
              placeholder="e.g. 62.5"
            />
            <StaffTextField
              control={form.control}
              name="framedHeightCm"
              formId={LOT_FORM_ID}
              label="Framed height (cm)"
              optional
              inputMode="decimal"
              placeholder="e.g. 82.5"
            />
          </FieldRow>
        </>
      ) : null}
    </FormSection>
  );
}
