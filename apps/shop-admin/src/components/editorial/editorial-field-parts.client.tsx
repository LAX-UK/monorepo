"use client";

import type { FieldErrors } from "@/lib/form-validation";
import {
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
  type SeoFieldsFormValues,
} from "@/lib/seo-fields-form";
import {
  ChoiceRow,
  EnumSelect,
  Field,
  FormSection,
  StaffCheckbox,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import type { ReactNode } from "react";

export type EntityFieldsProps<F> = {
  form: F;
  onChange: (next: F) => void;
  disabled: boolean;
  errors: FieldErrors;
};

/**
 * The id of a field's control, by the name its error is keyed under. The form's error summary
 * links to this id, so a problem and its field always find each other.
 */
export function editorialFieldId(name: string): string {
  return `editorial-field-${name}`;
}

/** A titled group of fields: the title and purpose on the left, the fields on the right. */
export function FieldSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <FormSection title={title} {...(description ? { description } : {})}>
      {children}
    </FormSection>
  );
}

function counter(value: string, max: number): string {
  return `${value.trim().length} of ${max} characters`;
}

type FieldBase = {
  /** The key the field's error is stored under. */
  name: string;
  label: string;
  description?: ReactNode;
  optional?: boolean;
  error: string | undefined;
  disabled: boolean;
};

export function EditorialTextField({
  name,
  label,
  description,
  optional,
  error,
  disabled,
  value,
  onChange,
  type = "text",
  maxLength,
  min,
  max,
  placeholder,
  autoComplete = "off",
  inputMode,
  spellCheck,
}: FieldBase & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "url" | "tel" | "number";
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "decimal";
  spellCheck?: boolean;
}) {
  return (
    <Field
      label={label}
      id={editorialFieldId(name)}
      error={error}
      disabled={disabled}
      {...(description ? { description } : {})}
      {...(optional ? { optional } : {})}
    >
      <TextInput
        type={type}
        value={value}
        maxLength={maxLength}
        min={min}
        max={max}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function EditorialTextArea({
  name,
  label,
  description,
  optional,
  error,
  disabled,
  value,
  onChange,
  maxLength,
  rows = 3,
}: FieldBase & {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <Field
      label={label}
      id={editorialFieldId(name)}
      error={error}
      disabled={disabled}
      {...(description ? { description } : {})}
      {...(optional ? { optional } : {})}
    >
      <TextArea
        rows={rows}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function EditorialSelectField<T extends string>({
  name,
  label,
  description,
  optional,
  error,
  disabled,
  value,
  onValueChange,
  options,
  placeholder,
}: FieldBase & {
  value: T | null;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  placeholder?: string;
}) {
  return (
    <Field
      label={label}
      id={editorialFieldId(name)}
      error={error}
      disabled={disabled}
      {...(description ? { description } : {})}
      {...(optional ? { optional } : {})}
    >
      <EnumSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        {...(placeholder ? { placeholder } : {})}
      />
    </Field>
  );
}

export function EditorialCheckbox({
  name,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = editorialFieldId(name);
  return (
    <ChoiceRow
      htmlFor={id}
      label={label}
      disabled={disabled}
      {...(description ? { description } : {})}
      control={
        <StaffCheckbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(next) => onChange(next === true)}
        />
      }
    />
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
    <EditorialTextField
      name="slug"
      label="Slug"
      description="The address on lax.art: lowercase letters, numbers and single hyphens, such as summer-show-2026."
      value={value}
      error={error}
      maxLength={120}
      spellCheck={false}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

export function SeoSection<F extends SeoFieldsFormValues>({
  description = "How the page appears in search results. Leave blank to use the title and summary.",
  form,
  onChange,
  disabled,
  errors,
}: EntityFieldsProps<F> & { description?: string }) {
  return (
    <FieldSection title="Search listing" description={description}>
      <EditorialTextField
        name="seoTitle"
        label="Search title"
        optional
        description={counter(form.seoTitle, SEO_TITLE_MAX_LENGTH)}
        value={form.seoTitle}
        error={errors.seoTitle}
        maxLength={SEO_TITLE_MAX_LENGTH}
        disabled={disabled}
        onChange={(seoTitle) => onChange({ ...form, seoTitle })}
      />
      <EditorialTextArea
        name="seoDescription"
        label="Search description"
        optional
        description={counter(form.seoDescription, SEO_DESCRIPTION_MAX_LENGTH)}
        value={form.seoDescription}
        error={errors.seoDescription}
        maxLength={SEO_DESCRIPTION_MAX_LENGTH}
        disabled={disabled}
        onChange={(seoDescription) => onChange({ ...form, seoDescription })}
      />
    </FieldSection>
  );
}
