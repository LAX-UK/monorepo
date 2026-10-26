"use client";

import {
  EditorialTextField,
  type EntityFieldsProps,
  FieldSection,
  SeoSection,
  SlugField,
} from "@/components/editorial/editorial-field-parts.client";
import type { PageForm } from "@/lib/editorial-entity-forms";

export function PageFields({ form, onChange, disabled, errors }: EntityFieldsProps<PageForm>) {
  return (
    <>
      <FieldSection title="Details" description="The page's title and its address on lax.art.">
        <EditorialTextField
          name="title"
          label="Title"
          value={form.title}
          error={errors.title}
          maxLength={300}
          disabled={disabled}
          onChange={(title) => onChange({ ...form, title })}
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
