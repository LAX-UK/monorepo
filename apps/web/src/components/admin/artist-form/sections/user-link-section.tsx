"use client";

import { staffFieldId } from "@/components/admin/forms/staff-form-fields";
import { PlatformUserPicker } from "@/components/admin/staff/platform-user-picker";
import { Field, FormSection } from "@auction/staff-ui";
import { useController } from "react-hook-form";
import { ARTIST_FORM_ID } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps, ArtistScenario } from "../types";

type Props = ArtistFormSectionProps & {
  scenario: ArtistScenario;
};

/**
 * Links the profile to the platform account of the person it represents when they sell their own
 * work. It records attribution only: the account does not gain edit access to the profile.
 */
export function UserLinkSection({ control, scenario, disabled = false }: Props) {
  const { field, fieldState } = useController({ control, name: "ownerUserId" });
  const linked = scenario === "maker-seller";
  return (
    <FormSection
      title="Linked account"
      description={
        linked
          ? "This profile represents a seller who makes the work they sell."
          : "This profile is catalogue only: a historical creator, a brand or anyone not on the platform."
      }
    >
      <Field
        id={staffFieldId(ARTIST_FORM_ID, "ownerUserId")}
        label="Platform account"
        optional={!linked}
        description={
          linked
            ? "Search by name or email. Linking records attribution only; it does not give the account edit access, so staff remain the only editors."
            : "Only needed when the seller is also the maker. Linking records attribution only; staff remain the only editors."
        }
        error={fieldState.error?.message}
        disabled={disabled}
      >
        <PlatformUserPicker
          id={staffFieldId(ARTIST_FORM_ID, "ownerUserId")}
          value={field.value ?? null}
          onValueChange={(option) => field.onChange(option?.id ?? null)}
          placeholder="No linked account"
          disabled={disabled}
          invalid={Boolean(fieldState.error)}
        />
      </Field>
    </FormSection>
  );
}
