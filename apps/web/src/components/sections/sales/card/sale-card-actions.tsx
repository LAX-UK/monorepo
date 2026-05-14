import type { SaleAction } from "@/components/sections/sales/card/types";
import { Button, cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  actions: SaleAction[];
  className?: string;
};

function mapVariant(v: SaleAction["variant"]) {
  switch (v) {
    case "cta":
      return "cta" as const;
    case "outline":
      return "outline" as const;
    case "ghost":
      return "ghost" as const;
    default:
      return "outline" as const;
  }
}

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
        <Button
          key={a.id}
          variant={mapVariant(a.variant)}
          asChild
          className="min-h-[44px] w-full justify-center sm:w-auto"
        >
          <Link href={a.href} aria-label={a.ariaLabel}>
            {a.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
