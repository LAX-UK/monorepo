import { LabelCaps } from "@/components/ui/typography";
import { cn } from "@auction/ui";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";

type Props = {
  id: string;
  label: string;
  name: string;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
};

export function TextareaField({
  id,
  label,
  name,
  rows = 4,
  placeholder,
  defaultValue,
  required,
}: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        <LabelCaps>{label}</LabelCaps>
      </Label>
      <Textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className={cn(
          "font-body text-sm",
          "rounded-md border border-outline-variant/25 bg-surface-container-lowest",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      />
    </div>
  );
}
