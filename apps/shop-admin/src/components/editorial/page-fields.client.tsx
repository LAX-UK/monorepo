"use client";

import {
  type EntityFieldsProps,
  FieldSection,
  SeoSection,
  SlugField,
} from "@/components/editorial/editorial-field-parts.client";
import { TextField } from "@/components/forms/fields";
import type { PageForm } from "@/lib/editorial-entity-forms";

export function PageFields({ form, onChange, disabled, errors }: EntityFieldsProps<PageForm>) {
  return (
    <>
      <FieldSection title="Details">
        <SlugField
          value={form.slug}
          error={errors.slug}
          disabled={disabled}
          onChange={(slug) => onChange({ ...form, slug })}
        />
        <TextField
          name="title"
          label="Title"
          value={form.title}
          error={errors.title}
          maxLength={300}
          required
          disabled={disabled}
          onChange={(title) => onChange({ ...form, title })}
        />
      </FieldSection>
      <SeoSection form={form} onChange={onChange} disabled={disabled} errors={errors} />
    </>
  );
}
