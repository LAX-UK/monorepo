"use client";

import { StaffEnumField } from "@/components/admin/forms/staff-form-fields";
import { ARTIST_KIND_OPTIONS, artistKindMeta } from "@/lib/artists/kind-presenter";
import { FormSection } from "@auction/staff-ui";
import type { ArtistKind } from "@auction/types";
import { ARTIST_FORM_ID } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps } from "../types";

/** What kind of creator the profile is; the labels, dates and details below follow from it. */
export function KindSection({
  control,
  kind,
  disabled = false,
}: ArtistFormSectionProps & { kind: ArtistKind }) {
  return (
    <FormSection
      title="Profile type"
      description="The dates and details further down change to suit the kind."
    >
      <StaffEnumField
        control={control}
        formId={ARTIST_FORM_ID}
        name="kind"
        label="Kind"
        description={artistKindMeta(kind).description}
        options={ARTIST_KIND_OPTIONS}
        disabled={disabled}
      />
    </FormSection>
  );
}
