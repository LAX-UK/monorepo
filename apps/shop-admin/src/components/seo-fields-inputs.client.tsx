"use client";

import { adminFormFieldClass, adminFormLabelClass } from "@/components/admin-mutation-feedback";
import {
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
  type SeoFieldsFormValues,
} from "@/lib/seo-fields-form";

export function SeoFieldsInputs({
  values,
  disabled,
  blankHint,
  onChange,
}: {
  values: SeoFieldsFormValues;
  disabled: boolean;
  /** Explains what a blank field does for this form. */
  blankHint: string;
  onChange: (values: SeoFieldsFormValues) => void;
}) {
  return (
    <>
      <label className={adminFormLabelClass}>
        <span className="text-neutral-600">
          SEO title ({values.seoTitle.trim().length}/{SEO_TITLE_MAX_LENGTH}; {blankHint})
        </span>
        <input
          className={adminFormFieldClass}
          value={values.seoTitle}
          maxLength={SEO_TITLE_MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => onChange({ ...values, seoTitle: e.target.value })}
        />
      </label>
      <label className={`${adminFormLabelClass} sm:col-span-2`}>
        <span className="text-neutral-600">
          SEO description ({values.seoDescription.trim().length}/{SEO_DESCRIPTION_MAX_LENGTH};{" "}
          {blankHint})
        </span>
        <textarea
          className={adminFormFieldClass}
          rows={3}
          value={values.seoDescription}
          maxLength={SEO_DESCRIPTION_MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => onChange({ ...values, seoDescription: e.target.value })}
        />
      </label>
    </>
  );
}
