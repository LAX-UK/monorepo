"use client";

import { StaffTextField, staffFieldId } from "@/components/admin/forms/staff-form-fields";
import { StaffSingleImage } from "@/components/admin/media/staff-single-image";
import { Field, FormSection } from "@auction/staff-ui";
import { useController } from "react-hook-form";
import { ARTIST_FORM_ID } from "../admin-artist-form.constants";
import type { ArtistFormSectionProps } from "../types";

type Props = ArtistFormSectionProps & {
  previewUrlByKey?: Record<string, string>;
};

function ImageField({
  control,
  name,
  label,
  noun,
  description,
  disabled,
  previewUrlByKey,
}: ArtistFormSectionProps & {
  name: "portraitUrl" | "heroImageUrl";
  label: string;
  noun: string;
  description: string;
  previewUrlByKey: Record<string, string>;
}) {
  const { field, fieldState } = useController({ control, name });
  return (
    <Field
      id={staffFieldId(ARTIST_FORM_ID, name)}
      label={label}
      optional
      description={description}
      error={fieldState.error?.message}
      disabled={disabled ?? false}
    >
      <StaffSingleImage
        kind="artist_image"
        value={field.value}
        onChange={(next) => field.onChange(next ?? "")}
        noun={noun}
        disabled={disabled ?? false}
        previewUrlByKey={previewUrlByKey}
      />
    </Field>
  );
}

export function MediaSection({ control, disabled = false, previewUrlByKey = {} }: Props) {
  return (
    <FormSection
      title="Images and website"
      description="The portrait is the profile's main picture. The hero image sits behind the name."
    >
      <ImageField
        control={control}
        name="portraitUrl"
        label="Portrait"
        noun="portrait"
        description="A square picture works best."
        disabled={disabled}
        previewUrlByKey={previewUrlByKey}
      />
      <ImageField
        control={control}
        name="heroImageUrl"
        label="Hero image"
        noun="hero image"
        description="A wide picture shown across the top of the profile."
        disabled={disabled}
        previewUrlByKey={previewUrlByKey}
      />
      <StaffTextField
        control={control}
        formId={ARTIST_FORM_ID}
        name="websiteUrl"
        label="Website"
        optional
        placeholder="https://"
        disabled={disabled}
      />
    </FormSection>
  );
}
