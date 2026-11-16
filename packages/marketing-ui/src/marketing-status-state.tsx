import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * The action button the Shop and lax.art status wrappers put inside the shared kit `EmptyState`
 * (`@auction/ui/lax/empty-state`). The state itself, its drawing names and its layouts live with
 * the kit and the wrappers; this package only owns the button and its CSS in `marketing-ui.css`.
 */
export type MarketingStatusActionProps = {
  priority?: "primary" | "secondary";
  asChild?: boolean;
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<"button">;

export function MarketingStatusAction({
  priority = "secondary",
  asChild = false,
  className,
  children,
  ...props
}: MarketingStatusActionProps) {
  const actionClass = cn(
    "marketing-status-state__action",
    priority === "primary"
      ? "marketing-status-state__action--primary"
      : "marketing-status-state__action--secondary",
    FOCUS_RING,
    className,
  );

  if (asChild) {
    return (
      <Slot className={actionClass} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button type="button" className={actionClass} {...props}>
      {children}
    </button>
  );
}
