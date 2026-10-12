import { adminFormFieldClass, adminFormLabelClass } from "@/components/admin-mutation-feedback";
import { type ReactNode, useId } from "react";

type BaseProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
};

type ControlIds = { id: string; "aria-describedby"?: string };

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string | undefined;
  children: (ids: ControlIds) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={adminFormLabelClass}>
      <label htmlFor={id} className="block text-neutral-600">
        {label}
      </label>
      {children(hint ? { id, "aria-describedby": hintId } : { id })}
      {hint ? (
        <span id={hintId} className="mt-0.5 block text-xs text-neutral-500">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function EditorialTextField({
  label,
  value,
  onChange,
  disabled,
  hint,
  type = "text",
  placeholder,
  maxLength,
  required,
}: BaseProps & {
  type?: "text" | "email" | "url" | "date" | "tel";
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      {(ids) => (
        <input
          {...ids}
          type={type}
          className={adminFormFieldClass}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          aria-required={required ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function EditorialTextArea({
  label,
  value,
  onChange,
  disabled,
  hint,
  rows = 3,
  maxLength,
  monospace = false,
}: BaseProps & { rows?: number; maxLength?: number; monospace?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      {(ids) => (
        <textarea
          {...ids}
          className={`${adminFormFieldClass} ${monospace ? "font-mono text-xs" : ""}`}
          rows={rows}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          spellCheck={monospace ? false : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function EditorialSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  hint,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(ids) => (
        <select
          {...ids}
          className={adminFormFieldClass}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function EditorialCheckbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-neutral-600">{label}</span>
    </label>
  );
}

export const editorialButtonClass =
  "rounded border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50";
export const editorialPrimaryButtonClass =
  "rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50";
export const editorialSmallButtonClass =
  "rounded border px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-50";
