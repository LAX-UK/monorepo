"use client";

import {
  Checkbox,
  DatePicker,
  DateTimePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@auction/ui";
import { FormField, useFieldControlId } from "./form-field";

type BaseFieldProps = {
  /** Identifies the field to the error summary; falls back to a generated id outside a form. */
  name?: string | undefined;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  disabled?: boolean;
  className?: string | undefined;
};

export function TextField({
  name,
  label,
  hint,
  error,
  className,
  value,
  onChange,
  type = "text",
  disabled = false,
  placeholder,
  maxLength,
  min,
  max,
  autoComplete,
  required,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "url" | "tel" | "number";
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <FormField name={name} label={label} hint={hint} error={error} className={className}>
      {(control) => (
        <Input
          {...control}
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          min={min}
          max={max}
          autoComplete={autoComplete}
          aria-required={required ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  error,
  className,
  value,
  onChange,
  disabled = false,
  rows = 3,
  maxLength,
  monospace = false,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  monospace?: boolean;
}) {
  return (
    <FormField name={name} label={label} hint={hint} error={error} className={className}>
      {(control) => (
        <Textarea
          {...control}
          className={cn(monospace && "font-mono text-xs")}
          rows={rows}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          spellCheck={monospace ? false : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

/** Radix items cannot carry an empty value, so a blank option is swapped for a sentinel. */
const BLANK_OPTION = "__blank__";

export function SelectField<T extends string>({
  name,
  label,
  hint,
  error,
  className,
  value,
  onChange,
  options,
  disabled = false,
}: BaseFieldProps & {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <FormField name={name} label={label} hint={hint} error={error} className={className}>
      {(control) => (
        <Select
          value={value === "" ? BLANK_OPTION : value}
          disabled={disabled}
          onValueChange={(next) => onChange((next === BLANK_OPTION ? "" : next) as T)}
        >
          <SelectTrigger {...control}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value === "" ? BLANK_OPTION : option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

export function DateField({
  name,
  label,
  hint,
  error,
  className,
  value,
  onChange,
  disabled = false,
}: BaseFieldProps & { value: string; onChange: (value: string) => void }) {
  return (
    <FormField name={name} label={label} hint={hint} error={error} className={className}>
      {(control) => (
        <DatePicker {...control} value={value} disabled={disabled} onChange={onChange} />
      )}
    </FormField>
  );
}

export function DateTimeField({
  name,
  label,
  hint,
  error,
  className,
  value,
  onChange,
  disabled = false,
}: BaseFieldProps & { value: string; onChange: (value: string) => void }) {
  return (
    <FormField name={name} label={label} hint={hint} error={error} className={className}>
      {(control) => (
        <DateTimePicker {...control} value={value} disabled={disabled} onChange={onChange} />
      )}
    </FormField>
  );
}

export function CheckboxField({
  name,
  label,
  checked,
  onChange,
  disabled = false,
  className,
}: Pick<BaseFieldProps, "name" | "label" | "disabled" | "className"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useFieldControlId(name);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
