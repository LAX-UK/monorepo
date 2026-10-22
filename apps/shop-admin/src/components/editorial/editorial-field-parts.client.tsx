"use client";

import { TextField } from "@/components/forms/fields";
import { SeoFieldsInputs } from "@/components/seo-fields-inputs.client";
import type { FieldErrors } from "@/lib/form-validation";
import type { SeoFieldsFormValues } from "@/lib/seo-fields-form";
import { type ReactNode, useId } from "react";

export type EntityFieldsProps<F> = {
  form: F;
  onChange: (next: F) => void;
  disabled: boolean;
  errors: FieldErrors;
};

/** A titled group of fields; two columns from the small breakpoint up. */
export function FieldSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div>
        <h2 id={headingId} className="text-lg font-medium">
          {title}
        </h2>
        {description ? <p className="text-sm text-on-surface-variant">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SlugField({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error: string | undefined;
}) {
  return (
    <TextField
      name="slug"
      label="Slug"
      hint="The address on lax.art: lowercase letters, numbers and single hyphens, e.g. summer-show-2026."
      value={value}
      error={error}
      maxLength={120}
      required
      disabled={disabled}
      onChange={onChange}
    />
  );
}

export function SeoSection<F extends SeoFieldsFormValues>({
  form,
  onChange,
  disabled,
  errors,
}: EntityFieldsProps<F>) {
  return (
    <FieldSection
      title="Search metadata"
      description="Optional. Leave blank to use the title and summary."
    >
      <SeoFieldsInputs
        values={form}
        disabled={disabled}
        blankHint="blank uses the generated default"
        errors={errors}
        onChange={(seo) => onChange({ ...form, ...seo })}
      />
    </FieldSection>
  );
}
