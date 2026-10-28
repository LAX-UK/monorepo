import { cn } from "@auction/ui";
import { type ButtonProps, Button as SharedButton } from "@auction/ui/components/button";
import {
  type LoadingButtonProps,
  LoadingButton as SharedLoadingButton,
} from "@auction/ui/components/loading-button";
import { forwardRef } from "react";

/**
 * Account's one button size: 44px tall, 20px either side and 14px text, whichever shared size a
 * call site asked for (the shared `sm` and `md` sizes both set 12px text and differ in padding,
 * which left Account's buttons in two sizes). Icon buttons, text-shaped buttons and the large
 * sign-in button keep their own shape.
 */
const ACCOUNT_SIZE = "min-h-11 rounded-md px-5 text-sm";

/**
 * The outline button on the card surface with a visible edge. The shared outline sits on the
 * lowest surface with a 25% border, which reads as a dark well on Account's dark cards and as
 * an edgeless button on white.
 */
const ACCOUNT_OUTLINE =
  "border-outline-variant bg-surface shadow-none hover:bg-surface-container-low active:bg-surface-container";

const TEXT_SHAPED = new Set(["link", "underline", "tertiary", "ctaLink", "chevron"]);

export function accountButtonClass(
  variant: ButtonProps["variant"],
  size: ButtonProps["size"],
): string {
  if (variant && TEXT_SHAPED.has(variant)) return "";
  const ownShape = size === "icon" || size === "lg" || size === "xl";
  return cn(!ownShape && ACCOUNT_SIZE, variant === "outline" && ACCOUNT_OUTLINE);
}

/** The shared button in Account's size and outline treatment. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, ...props }, ref) => (
    <SharedButton
      ref={ref}
      variant={variant}
      size={size}
      className={cn(accountButtonClass(variant, size), className)}
      {...props}
    />
  ),
);
Button.displayName = "AccountButton";

/** The shared loading button in Account's size and outline treatment. */
export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ variant, size, className, ...props }, ref) => (
    <SharedLoadingButton
      ref={ref}
      variant={variant}
      size={size}
      className={cn(accountButtonClass(variant, size), className)}
      {...props}
    />
  ),
);
LoadingButton.displayName = "AccountLoadingButton";
