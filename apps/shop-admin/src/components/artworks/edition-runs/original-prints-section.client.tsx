"use client";

import { OriginalPrintsFields } from "@/components/artworks/edition-runs/original-prints-fields.client";
import type { OriginalPrintsField, OriginalPrintsFormValues } from "@/lib/original-prints-form";
import { ChoiceRow, FormSection, Notice, StaffCheckbox } from "@auction/staff-ui";

const ENABLED_ID = "original-prints-enabled";

/**
 * The optional last section of a new original: tick it to create the prints in the same save.
 * They are Shop drafts linked to the original, so nothing goes live until staff publish them.
 */
export function OriginalPrintsSection({
  values,
  errors,
  originalTitle,
  disabled = false,
  onChange,
}: {
  values: OriginalPrintsFormValues;
  errors: Partial<Record<OriginalPrintsField, string>>;
  originalTitle: string;
  disabled?: boolean;
  onChange: (patch: Partial<OriginalPrintsFormValues>) => void;
}) {
  return (
    <FormSection
      title="Prints"
      description="Optional. Prints made from this original are saved with it, in one step."
    >
      <ChoiceRow
        htmlFor={ENABLED_ID}
        disabled={disabled}
        control={
          <StaffCheckbox
            id={ENABLED_ID}
            checked={values.enabled}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ enabled: checked === true })}
          />
        }
        label="Also create prints of this original"
        description="Leave it unticked to create the original alone. You can create prints later from its page."
      />
      {values.enabled ? (
        <>
          <OriginalPrintsFields
            values={values}
            errors={errors}
            originalTitle={originalTitle}
            disabled={disabled}
            onChange={onChange}
          />
          <Notice title="The prints are saved as Shop drafts, linked to this original">
            They copy the artist, medium, dimensions and images. Add a price and the edition facts
            before publishing them.
          </Notice>
        </>
      ) : null}
    </FormSection>
  );
}
