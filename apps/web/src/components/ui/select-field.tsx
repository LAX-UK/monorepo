import { LabelCaps } from "@/components/ui/typography";

export type SelectOption = { value: string; label: string };

type Props = {
  id: string;
  label: string;
  options: SelectOption[];
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholderOption?: string;
};

/** Native select for server-rendered forms (SRP: presentation only). */
export function SelectField({
  id,
  label,
  options,
  name,
  defaultValue,
  required,
  disabled,
  placeholderOption,
}: Props) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block">
        <LabelCaps>{label}</LabelCaps>
      </label>
      <select
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        defaultValue={defaultValue ?? (placeholderOption ? "" : options[0]?.value)}
        className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
      >
        {placeholderOption ? (
          <option value="" disabled>
            {placeholderOption}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
