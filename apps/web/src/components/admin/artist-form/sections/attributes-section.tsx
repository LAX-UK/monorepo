"use client";

import { StaffTextAreaField, StaffTextField } from "@/components/admin/forms/staff-form-fields";
import { FormSection } from "@auction/staff-ui";
import { type ArtistKind, getCreatorKindConfig } from "@auction/types";
import type { FieldPath } from "react-hook-form";
import { ARTIST_FORM_ID } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps, ArtistFormValues } from "../types";

/**
 * The details that belong to the chosen kind, from the creator-kind config: adding a kind or an
 * attribute there adds its field here.
 */
export function AttributesSection({
  control,
  kind = "artist",
  disabled = false,
}: ArtistFormSectionProps & { kind?: ArtistKind }) {
  const config = getCreatorKindConfig(kind);
  if (config.attributes.length === 0) return null;
  return (
    <FormSection
      title={`${config.label} details`}
      description="Details specific to this kind, shown on the public profile."
    >
      {config.attributes.map((attr) => {
        const name = `attributes.${attr.key}` as FieldPath<ArtistFormValues>;
        const common = {
          control,
          formId: ARTIST_FORM_ID,
          name,
          label: attr.label,
          optional: true,
          disabled,
          ...(attr.help ? { description: attr.help } : {}),
        } as const;
        return attr.type === "textarea" ? (
          <StaffTextAreaField key={attr.key} {...common} rows={3} />
        ) : (
          <StaffTextField key={attr.key} {...common} />
        );
      })}
    </FormSection>
  );
}
