"use client";

import {
  ChoiceRow,
  DateTimeInput,
  EntityMultiPicker,
  type EntityOption,
  EntityPicker,
  type EnumOption,
  EnumSelect,
  Field,
  MoneyInput,
  PercentInput,
  StaffCheckbox,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
  TextInput,
  isoToLondonWallTime,
  londonWallTimeToIso,
  parsePoundsToPence,
} from "@auction/staff-ui";
import type * as React from "react";
import {
  type Control,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
  useController,
} from "react-hook-form";

/*
 * React Hook Form bindings for the staff kit's form controls. Each one renders a kit `Field`
 * (label, guidance, "Optional", inline error) around the kit control, wired to one form value,
 * with a stable id so the error summary can link to it. No styling lives here.
 */

/** The DOM id of a form value's control: what the error summary links to. */
export function staffFieldId(formId: string, name: string): string {
  return `${formId}-${name.replaceAll(".", "-")}`;
}

type Base<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  /** The form's id, which prefixes each control's id. */
  formId: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
};

function useBoundField<T extends FieldValues>({ control, name }: Base<T>) {
  const { field, fieldState } = useController({ control, name });
  return { field, error: fieldState.error?.message };
}

export function StaffTextField<T extends FieldValues>(
  props: Base<T> & {
    placeholder?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    /** Store the typed text as a whole number, or null when empty. */
    integer?: boolean;
    /** Tidies the text when the field loses focus, e.g. a postcode to "SW1Y 6QU". */
    tidyOnBlur?: (text: string) => string;
  },
) {
  const { field, error } = useBoundField(props);
  const id = staffFieldId(props.formId, props.name);
  const value = field.value == null ? "" : String(field.value);
  return (
    <Field
      id={id}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <TextInput
        ref={field.ref}
        name={field.name}
        value={value}
        onBlur={(event) => {
          const text = event.target.value.trim();
          if (props.tidyOnBlur && text) field.onChange(props.tidyOnBlur(text));
          field.onBlur();
        }}
        disabled={props.disabled}
        placeholder={props.placeholder}
        inputMode={props.integer ? "numeric" : props.inputMode}
        onChange={(event) => {
          const text = event.target.value;
          if (!props.integer) {
            field.onChange(text);
            return;
          }
          const trimmed = text.trim();
          field.onChange(trimmed === "" ? null : /^\d+$/.test(trimmed) ? Number(trimmed) : text);
        }}
      />
    </Field>
  );
}

export function StaffTextAreaField<T extends FieldValues>(
  props: Base<T> & { rows?: number; placeholder?: string },
) {
  const { field, error } = useBoundField(props);
  return (
    <Field
      id={staffFieldId(props.formId, props.name)}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <TextArea
        ref={field.ref}
        name={field.name}
        rows={props.rows ?? 5}
        value={field.value == null ? "" : String(field.value)}
        onChange={(event) => field.onChange(event.target.value)}
        onBlur={field.onBlur}
        disabled={props.disabled}
        placeholder={props.placeholder}
      />
    </Field>
  );
}

/** "1200.5" in the form as "1200.50" (pounds, two decimals); empty as "". */
export function penceToPoundsString(pence: number | null): string {
  return pence == null ? "" : (pence / 100).toFixed(2);
}

/** The form's pounds string as pence for the kit money input; null when empty or not money. */
export function poundsStringToPence(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = parsePoundsToPence(String(value));
  return parsed.ok ? parsed.pence : null;
}

/** A pounds amount kept in the form as a decimal string ("1200.00"), entered through the kit. */
export function StaffMoneyField<T extends FieldValues>(props: Base<T> & { placeholder?: string }) {
  const { field, error } = useBoundField(props);
  return (
    <Field
      id={staffFieldId(props.formId, props.name)}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <MoneyInput
        ref={field.ref}
        name={field.name}
        value={poundsStringToPence(field.value)}
        onValueChange={(pence) => field.onChange(penceToPoundsString(pence))}
        onBlur={field.onBlur}
        disabled={props.disabled}
        placeholder={props.placeholder}
      />
    </Field>
  );
}

/**
 * What the form holds while the percent text is not a number: never a valid rate, so the
 * schema's rule reports it on submit.
 */
export const PERCENT_NOT_A_NUMBER = "not-a-number";

/** A rate kept in the form as a decimal string ("0.25"), entered and shown as a percent ("25%"). */
export function StaffPercentField<T extends FieldValues>(
  props: Base<T> & { placeholder?: string },
) {
  const { field, error } = useBoundField(props);
  return (
    <Field
      id={staffFieldId(props.formId, props.name)}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <PercentInput
        ref={field.ref}
        name={field.name}
        value={field.value == null ? "" : String(field.value)}
        onValueChange={(rate) => field.onChange(rate ?? PERCENT_NOT_A_NUMBER)}
        onBlur={field.onBlur}
        disabled={props.disabled}
        placeholder={props.placeholder}
      />
    </Field>
  );
}

/** A London wall time kept in the form as "YYYY-MM-DDTHH:mm", entered as date, time and zone. */
export function StaffDateTimeField<T extends FieldValues>(props: Base<T>) {
  const { field, error } = useBoundField(props);
  const raw = typeof field.value === "string" ? field.value : "";
  const [day, time] = raw.split("T");
  const iso = day && time ? londonWallTimeToIso(day, time.slice(0, 5)) : null;
  return (
    <Field
      id={staffFieldId(props.formId, props.name)}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <DateTimeInput
        value={iso}
        disabled={props.disabled ?? false}
        onValueChange={(next) => {
          const wall = next ? isoToLondonWallTime(next) : null;
          field.onChange(wall ? `${wall.day}T${wall.time}` : "");
        }}
      />
    </Field>
  );
}

export function StaffEnumField<T extends FieldValues, V extends string>(
  props: Base<T> & {
    options: readonly EnumOption<V>[];
    placeholder?: string;
    /** Runs after the value changes, with the previous value. */
    onChanged?: (next: V, previous: V | null) => void;
  },
) {
  const { field, error } = useBoundField(props);
  const id = staffFieldId(props.formId, props.name);
  return (
    <Field
      id={id}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <EnumSelect<V>
        id={id}
        value={(field.value as V | null) || null}
        options={props.options}
        disabled={props.disabled ?? false}
        {...(props.placeholder ? { placeholder: props.placeholder } : {})}
        onValueChange={(next) => {
          const previous = (field.value as V | null) || null;
          if (previous === next) return;
          field.onChange(next);
          field.onBlur();
          props.onChanged?.(next, previous);
        }}
      />
    </Field>
  );
}

export function StaffEntityField<T extends FieldValues>(
  props: Base<T> & {
    options?: readonly EntityOption[];
    search?: (query: string) => Promise<readonly EntityOption[]>;
    selected?: EntityOption | null;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    /** Runs after a choice, with the option (null when cleared). */
    onChanged?: (option: EntityOption | null) => void;
  },
) {
  const { field, error } = useBoundField(props);
  const id = staffFieldId(props.formId, props.name);
  return (
    <Field
      id={id}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <EntityPicker
        id={id}
        value={(field.value as string | null) || null}
        disabled={props.disabled ?? false}
        {...(props.options ? { options: props.options } : {})}
        {...(props.search ? { search: props.search } : {})}
        {...(props.selected !== undefined ? { selected: props.selected } : {})}
        {...(props.placeholder ? { placeholder: props.placeholder } : {})}
        {...(props.searchPlaceholder ? { searchPlaceholder: props.searchPlaceholder } : {})}
        {...(props.emptyText ? { emptyText: props.emptyText } : {})}
        onValueChange={(option) => {
          field.onChange(option?.id ?? "");
          field.onBlur();
          props.onChanged?.(option);
        }}
      />
    </Field>
  );
}

/** Two to five mutually exclusive choices, all visible, each with its own line of help. */
export function StaffRadioField<T extends FieldValues, V extends string>(
  props: Base<T> & {
    options: ReadonlyArray<{ value: V; label: string; description?: string; disabled?: boolean }>;
    /** Runs after the value changes. */
    onChanged?: (next: V) => void;
  },
) {
  const { field, error } = useBoundField(props);
  const id = staffFieldId(props.formId, props.name);
  return (
    <Field
      id={id}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <StaffRadioGroup
        id={id}
        value={(field.value as string) ?? ""}
        disabled={props.disabled ?? false}
        aria-label={typeof props.label === "string" ? props.label : undefined}
        aria-invalid={error ? true : undefined}
        onValueChange={(next) => {
          field.onChange(next);
          props.onChanged?.(next as V);
        }}
      >
        {props.options.map((option) => {
          const optionId = `${id}-${option.value}`;
          return (
            <ChoiceRow
              key={option.value}
              htmlFor={optionId}
              label={option.label}
              disabled={(props.disabled ?? false) || (option.disabled ?? false)}
              {...(option.description ? { description: option.description } : {})}
              control={
                <StaffRadio
                  id={optionId}
                  value={option.value}
                  disabled={(props.disabled ?? false) || (option.disabled ?? false)}
                />
              }
            />
          );
        })}
      </StaffRadioGroup>
    </Field>
  );
}

/** Several records chosen by name, kept in the form as an array of ids. */
export function StaffEntityMultiField<T extends FieldValues>(
  props: Base<T> & {
    options: readonly EntityOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    max?: number;
  },
) {
  const { field, error } = useBoundField(props);
  const id = staffFieldId(props.formId, props.name);
  const value = Array.isArray(field.value) ? (field.value as string[]) : [];
  return (
    <Field
      id={id}
      label={props.label}
      description={props.description}
      error={error}
      optional={props.optional ?? false}
      disabled={props.disabled ?? false}
      {...(props.className ? { className: props.className } : {})}
    >
      <EntityMultiPicker
        id={id}
        value={value}
        options={props.options}
        disabled={props.disabled ?? false}
        {...(props.placeholder ? { placeholder: props.placeholder } : {})}
        {...(props.searchPlaceholder ? { searchPlaceholder: props.searchPlaceholder } : {})}
        {...(props.emptyText ? { emptyText: props.emptyText } : {})}
        {...(props.max !== undefined ? { max: props.max } : {})}
        onValueChange={(ids) => {
          field.onChange(ids);
          field.onBlur();
        }}
      />
    </Field>
  );
}

/** An independent yes/no inside a saved form. */
export function StaffCheckboxField<T extends FieldValues>(
  props: Omit<Base<T>, "optional"> & { defaultChecked?: boolean },
) {
  const { field } = useBoundField({ ...props });
  const id = staffFieldId(props.formId, props.name);
  return (
    <ChoiceRow
      htmlFor={id}
      disabled={props.disabled ?? false}
      label={props.label}
      {...(props.description ? { description: props.description } : {})}
      {...(props.className ? { className: props.className } : {})}
      control={
        <StaffCheckbox
          id={id}
          checked={field.value == null ? (props.defaultChecked ?? false) : Boolean(field.value)}
          onCheckedChange={(checked) => field.onChange(checked === true)}
          disabled={props.disabled ?? false}
        />
      }
    />
  );
}

/** Every error message in a form's errors, keyed by field path ("estimate.low"). */
function flattenErrors(errors: unknown, prefix = ""): Array<[string, string]> {
  if (!errors || typeof errors !== "object") return [];
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    if (key === "root" || key === "ref" || !value || typeof value !== "object") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message) out.push([path, message]);
    else out.push(...flattenErrors(value, path));
  }
  return out;
}

/**
 * The form's errors as the kit summary lists them, in the order the fields appear, each linking
 * to its control. Messages are the inline ones, word for word.
 */
export function staffFormSummaryErrors<T extends FieldValues>(
  errors: FieldErrors<T>,
  formId: string,
  order: readonly string[],
): Array<{ fieldId: string; message: string }> {
  const all = flattenErrors(errors);
  const rank = (path: string) => {
    const index = order.findIndex((name) => path === name || path.startsWith(`${name}.`));
    return index === -1 ? order.length : index;
  };
  return all
    .map(([path, message], index) => ({ path, message, index }))
    .sort((a, b) => rank(a.path) - rank(b.path) || a.index - b.index)
    .map(({ path, message }) => ({ fieldId: staffFieldId(formId, path), message }));
}
