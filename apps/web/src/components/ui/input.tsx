import { cn } from "@auction/ui";
import { Input as UiInput } from "@auction/ui/components/input";
import type { InputHTMLAttributes } from "react";

export function UnderlineInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <UiInput
      className={cn(
        "h-auto rounded-none border-0 border-b-2 border-outline/40 bg-transparent py-3 font-headline text-2xl text-on-surface shadow-none transition-colors placeholder:text-on-surface-variant/50 focus-visible:ring-0 focus-visible:ring-offset-0",
        "focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_rgba(199,160,89,0.25)]",
        className,
      )}
      {...props}
    />
  );
}
