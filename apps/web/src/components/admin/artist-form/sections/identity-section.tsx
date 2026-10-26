"use client";

import { StaffTextField } from "@/components/admin/forms/staff-form-fields";
import { Field, FieldRow, FormSection } from "@auction/staff-ui";
import { ARTIST_FORM_ID } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps } from "../types";

type Props = ArtistFormSectionProps & {
  mode: "create" | "edit";
  /** The profile's web address, shown on edit; it is set when the profile is created. */
  slug?: string;
};

export function IdentitySection({ control, mode, slug, disabled = false }: Props) {
  const f = { control, formId: ARTIST_FORM_ID, disabled } as const;
  return (
    <FormSection
      title="Identity"
      description={
        mode === "edit"
          ? "The public name and place. The web address was set when the profile was created."
          : "The public name and place. A unique web address is made from the name when you save."
      }
    >
      <StaffTextField {...f} name="displayName" label="Display name" />
      {mode === "edit" && slug ? (
        <Field label="Web address" description="Cannot be changed.">
          <p className="font-mono text-staff-sm text-staff-fg">/{slug}</p>
        </Field>
      ) : null}
      <FieldRow>
        <StaffTextField {...f} name="nationality" label="Nationality" optional />
        <StaffTextField {...f} name="location" label="Location" optional />
      </FieldRow>
    </FormSection>
  );
}
