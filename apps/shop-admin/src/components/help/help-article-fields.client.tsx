"use client";

import {
  type EntityFieldsProps,
  FieldSection,
  SeoSection,
  SlugField,
} from "@/components/editorial/editorial-field-parts.client";
import { SelectField, TextField } from "@/components/forms/fields";
import type { HelpArticleForm } from "@/lib/help-forms";

export type HelpCategoryOption = { value: string; label: string };

export function HelpArticleFields({
  form,
  onChange,
  disabled,
  errors,
  categories,
}: EntityFieldsProps<HelpArticleForm> & { categories: readonly HelpCategoryOption[] }) {
  return (
    <>
      <FieldSection title="Details">
        <TextField
          name="question"
          label="Question"
          className="sm:col-span-2"
          hint="Written as a reader would ask it, e.g. “Can I return an artwork?”"
          value={form.question}
          error={errors.question}
          maxLength={300}
          required
          disabled={disabled}
          onChange={(question) => onChange({ ...form, question })}
        />
        <SelectField
          name="categoryId"
          label="Category"
          hint="Saving a question in another category moves it to the end of that category."
          value={form.categoryId}
          error={errors.categoryId}
          options={categories}
          disabled={disabled}
          onChange={(categoryId) => onChange({ ...form, categoryId })}
        />
        <SlugField
          value={form.slug}
          error={errors.slug}
          disabled={disabled}
          onChange={(slug) => onChange({ ...form, slug })}
        />
      </FieldSection>
      <SeoSection form={form} onChange={onChange} disabled={disabled} errors={errors} />
    </>
  );
}
