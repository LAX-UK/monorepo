"use client";

import { StaffTextField } from "@/components/admin/forms/staff-form-fields";
import { FieldRow, FormSection } from "@auction/staff-ui";
import { type ArtistKind, isOrganisationKind } from "@auction/types";
import { ARTIST_FORM_ID } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps } from "../types";

/** Organisations have founded and dissolved years; people have birth and death years. */
export function LifespanSection({
  control,
  kind = "artist",
  disabled = false,
}: ArtistFormSectionProps & { kind?: ArtistKind }) {
  const organisation = isOrganisationKind(kind);
  const f = { control, formId: ARTIST_FORM_ID, disabled, optional: true } as const;
  return (
    <FormSection
      title={organisation ? "Years and origin" : "Dates and origin"}
      description={
        organisation
          ? "When it was founded and, if it closed, dissolved; and where it comes from."
          : "When they were born and, if they have died, when; and where they come from."
      }
    >
      <FieldRow>
        {organisation ? (
          <>
            <StaffTextField {...f} name="foundedYear" label="Founded" placeholder="e.g. 1906" />
            <StaffTextField {...f} name="dissolvedYear" label="Dissolved" placeholder="e.g. 1972" />
          </>
        ) : (
          <>
            <StaffTextField {...f} name="birthYear" label="Born" placeholder="e.g. 1923" />
            <StaffTextField {...f} name="deathYear" label="Died" placeholder="e.g. 1998" />
          </>
        )}
      </FieldRow>
      <StaffTextField
        {...f}
        name="countryCode"
        label="Country"
        description="The two-letter country code, for example GB or FR."
        placeholder="GB"
        tidyOnBlur={(text) => text.toUpperCase()}
      />
    </FormSection>
  );
}
