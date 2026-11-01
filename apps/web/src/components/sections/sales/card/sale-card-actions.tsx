import type { SaleAction } from "@/components/sections/sales/card/types";
import { cn } from "@auction/ui";
import { ButtonLink, type ButtonProps } from "@auction/ui/lax";
import Link from "next/link";

type Props = {
  actions: SaleAction[];
  className?: string;
};

const BUTTON_VARIANT = {
  cta: "primary",
  outline: "secondary",
  ghost: "ghost",
} as const satisfies Record<SaleAction["variant"], ButtonProps["variant"]>;

/** Renders configured actions (OCP: new actions = data only). */
export function SaleCardActions({ actions, className }: Props) {
  if (actions.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3",
        className,
      )}
    >
      {actions.map((a) => (
        <ButtonLink
          Link={Link}
          key={a.id}
          variant={BUTTON_VARIANT[a.variant]}
          className="w-full justify-center sm:w-auto"
          href={a.href}
          aria-label={a.ariaLabel}
        >
          {a.label}
        </ButtonLink>
      ))}
    </div>
  );
}
