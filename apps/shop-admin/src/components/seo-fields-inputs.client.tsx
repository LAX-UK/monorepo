"use client";

import {
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
  type SeoFieldsFormValues,
} from "@/lib/seo-fields-form";
import { TextAreaField, TextField } from "./forms/fields";

export function SeoFieldsInputs({
  values,
  disabled,
  blankHint,
  errors,
  onChange,
}: {
  values: SeoFieldsFormValues;
  disabled: boolean;
  /** Explains what a blank field does for this form. */
  blankHint: string;
  errors: { seoTitle?: string | undefined; seoDescription?: string | undefined };
  onChange: (values: SeoFieldsFormValues) => void;
}) {
  return (
    <>
      <TextField
        name="seoTitle"
        label="SEO title"
        hint={`${values.seoTitle.trim().length}/${SEO_TITLE_MAX_LENGTH}; ${blankHint}`}
        value={values.seoTitle}
        error={errors.seoTitle}
        maxLength={SEO_TITLE_MAX_LENGTH}
        disabled={disabled}
        onChange={(seoTitle) => onChange({ ...values, seoTitle })}
      />
      <TextAreaField
        name="seoDescription"
        label="SEO description"
        hint={`${values.seoDescription.trim().length}/${SEO_DESCRIPTION_MAX_LENGTH}; ${blankHint}`}
        className="sm:col-span-2"
        value={values.seoDescription}
        error={errors.seoDescription}
        maxLength={SEO_DESCRIPTION_MAX_LENGTH}
        disabled={disabled}
        onChange={(seoDescription) => onChange({ ...values, seoDescription })}
      />
    </>
  );
}
