import {
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
  type SeoFields,
} from "@auction/shop-contracts";

export { SEO_DESCRIPTION_MAX_LENGTH, SEO_TITLE_MAX_LENGTH };

export type SeoFieldsFormValues = { seoTitle: string; seoDescription: string };

export type SeoFieldsFormError = "seo_title_too_long" | "seo_description_too_long";

export type SeoFieldsFormResult<T> =
  | { ok: true; fields: T }
  | { ok: false; error: SeoFieldsFormError };

export const SEO_FIELDS_ERROR_MESSAGES: Record<SeoFieldsFormError, string> = {
  seo_title_too_long: `SEO title must be ${SEO_TITLE_MAX_LENGTH} characters or fewer.`,
  seo_description_too_long: `SEO description must be ${SEO_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
};

function validate(values: SeoFieldsFormValues): SeoFieldsFormError | null {
  if (values.seoTitle.trim().length > SEO_TITLE_MAX_LENGTH) return "seo_title_too_long";
  if (values.seoDescription.trim().length > SEO_DESCRIPTION_MAX_LENGTH) {
    return "seo_description_too_long";
  }
  return null;
}

/** Blank values become `null`, clearing the override (pages fall back to generated metadata). */
export function parseSeoFields(values: SeoFieldsFormValues): SeoFieldsFormResult<SeoFields> {
  const error = validate(values);
  if (error) return { ok: false, error };
  return {
    ok: true,
    fields: {
      seoTitle: values.seoTitle.trim() || null,
      seoDescription: values.seoDescription.trim() || null,
    },
  };
}

/** Blank values are omitted so a partial write leaves stored overrides unchanged. */
export function parseSeoFieldsPatch(
  values: SeoFieldsFormValues,
): SeoFieldsFormResult<Partial<{ seoTitle: string; seoDescription: string }>> {
  const error = validate(values);
  if (error) return { ok: false, error };
  const seoTitle = values.seoTitle.trim();
  const seoDescription = values.seoDescription.trim();
  return {
    ok: true,
    fields: {
      ...(seoTitle ? { seoTitle } : {}),
      ...(seoDescription ? { seoDescription } : {}),
    },
  };
}

export function seoFieldsFormValues(
  fields: Partial<SeoFields> | null | undefined,
): SeoFieldsFormValues {
  return { seoTitle: fields?.seoTitle ?? "", seoDescription: fields?.seoDescription ?? "" };
}
