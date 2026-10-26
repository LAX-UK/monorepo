"use client";

import { StaffTextAreaField } from "@/components/admin/forms/staff-form-fields";
import { FormSection } from "@auction/staff-ui";
import { ARTIST_FORM_ID } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps } from "../types";

export function BiographySection({ control, disabled = false }: ArtistFormSectionProps) {
  const f = { control, formId: ARTIST_FORM_ID, disabled, optional: true } as const;
  return (
    <FormSection title="Biography" description="The copy shown on the public artist profile.">
      <StaffTextAreaField
        {...f}
        name="shortBio"
        label="Short bio"
        description="Up to 500 characters, shown in lists and previews."
        rows={3}
      />
      <StaffTextAreaField {...f} name="longBio" label="Long bio" rows={6} />
      <StaffTextAreaField
        {...f}
        name="statement"
        label="Statement"
        description="In the creator's own words."
        rows={6}
      />
    </FormSection>
  );
}
