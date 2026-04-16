import { LabelCaps } from "@/components/ui/typography";

type Props = {
  id: string;
  label: string;
  name: string;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
};

export function TextareaField({ id, label, name, rows = 4, placeholder, defaultValue, required }: Props) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block">
        <LabelCaps>{label}</LabelCaps>
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
    </div>
  );
}
