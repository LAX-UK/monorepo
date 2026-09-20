import { FOCUS_WITHIN_RING, MARKETING_CARD_LIFT } from "@auction/branding";
import { cn } from "@auction/ui";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type MarketingCardShellProps = {
  asChild?: boolean;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<"div">;

export function MarketingCardShell({
  asChild = false,
  interactive = true,
  className,
  children,
  ...props
}: MarketingCardShellProps) {
  const shellClass = cn(
    "group relative block overflow-hidden rounded-lg bg-surface",
    interactive ? MARKETING_CARD_LIFT : undefined,
    interactive ? FOCUS_WITHIN_RING : undefined,
    className,
  );

  if (asChild) {
    return (
      <Slot className={shellClass} {...props}>
        {children}
      </Slot>
    );
  }

  const Tag = interactive ? "div" : "article";
  return (
    <Tag className={shellClass} {...props}>
      {children}
    </Tag>
  );
}
