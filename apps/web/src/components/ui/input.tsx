import { cn } from "@auction/ui";
import { type InputProps, Input as UiInput } from "@auction/ui/components/input";

export type UnderlineInputProps = Omit<InputProps, "variant">;

/** Admin catalog headline input — underline variant with larger type. */
export function UnderlineInput({ className = "", ...props }: UnderlineInputProps) {
  return (
    <UiInput
      variant="underline"
      className={cn(
        "h-auto py-3 font-headline text-2xl focus-visible:shadow-[0_0_0_1px_rgba(199,160,89,0.25)]",
        className,
      )}
      {...props}
    />
  );
}
