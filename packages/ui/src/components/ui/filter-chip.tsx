import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils.js";

export type FilterChipProps = Omit<React.ComponentProps<"button">, "type"> & {
  /** When true, chip appears selected */
  pressed?: boolean;
  /** Shows a spinner and disables interaction */
  pending?: boolean;
};

/** Toggle-style filter chip with visible focus ring and `aria-pressed`.
 */
export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { className, pressed = false, pending = false, disabled, children, ...rest },
  ref,
) {
  const isDisabled = Boolean(disabled) || pending;
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      aria-busy={pending || undefined}
      disabled={isDisabled}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-4 py-2 font-label text-xs font-semibold uppercase tracking-widest transition-colors",
        "border-outline-variant/60 text-on-surface-variant",
        "hover:border-primary/50 hover:text-on-surface",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        pressed && "border-primary bg-primary/10 text-on-surface",
        isDisabled && "cursor-not-allowed opacity-60",
        className,
      )}
      {...rest}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

FilterChip.displayName = "FilterChip";
