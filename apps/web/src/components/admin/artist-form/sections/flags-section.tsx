"use client";

import { StaffCheckboxField, StaffRadioField } from "@/components/admin/forms/staff-form-fields";
import { FormSection } from "@auction/staff-ui";
import { ARTIST_FORM_ID, ARTIST_STATUS_OPTIONS } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps } from "../types";

/** Whether the profile is public, and the flags that change how it is shown. */
export function FlagsSection({ control, disabled = false }: ArtistFormSectionProps) {
  const f = { control, formId: ARTIST_FORM_ID, disabled } as const;
  return (
    <FormSection
      title="Status and visibility"
      description="Controls whether the profile is public and how it is shown."
    >
      <StaffRadioField
        {...f}
        name="status"
        label="Catalogue status"
        options={ARTIST_STATUS_OPTIONS.map((option) => ({ ...option }))}
      />
      <StaffCheckboxField
        {...f}
        name="featured"
        label="Featured"
        description="Highlight this profile where featured artists are shown."
      />
      <StaffCheckboxField
        {...f}
        name="verified"
        label="Verified"
        description="Staff have checked this profile's details."
      />
      <StaffCheckboxField
        {...f}
        name="archived"
        label="Archived"
        description="Take the profile out of lists without deleting it."
      />
    </FormSection>
  );
}
