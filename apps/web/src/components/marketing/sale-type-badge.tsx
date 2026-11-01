"use client";

import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import { saleFormatIcon } from "@/lib/sale-format-icon";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import type { Sale, SaleDeliveryMode } from "@auction/types";
import { Button, StatusBadge } from "@auction/ui/lax";
import { HelpCircle } from "lucide-react";
import { SaleTypeExplainerPopover } from "./sale-type-explainer";

type Props = {
  deliveryMode: SaleDeliveryMode | Sale | Pick<Sale, "deliveryMode"> | undefined | null;
  className?: string;
  withIcon?: boolean;
  withExplainer?: boolean;
  /** Sale-specific context for the format help popover. */
  explainerContext?: SaleFormatExplainerContext;
};

/** A sale's format. It names a kind, not a state, so it is the one neutral badge for every format. */
export function SaleTypeBadge({
  deliveryMode,
  className,
  withIcon = true,
  withExplainer = false,
  explainerContext,
}: Props) {
  const pres = getSaleTypePresentation(deliveryMode);
  const Icon = saleFormatIcon(pres.iconName);
  const context: SaleFormatExplainerContext =
    explainerContext ?? ({ deliveryMode: pres.key } satisfies SaleFormatExplainerContext);

  const badge = (
    <StatusBadge
      tone="neutral"
      {...(withIcon ? { icon: <Icon className="size-3.5" /> } : {})}
      {...(className ? { className } : {})}
    >
      {pres.label}
      {withExplainer ? (
        <HelpCircle aria-hidden className="ml-1 inline size-3.5 opacity-70" />
      ) : null}
    </StatusBadge>
  );

  if (!withExplainer) return badge;

  return (
    <SaleTypeExplainerPopover context={context} align="start">
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-0 p-0.5 text-left in-data-[lax-density=client]:px-0.5"
        aria-label={`${pres.label} — format details`}
      >
        {badge}
      </Button>
    </SaleTypeExplainerPopover>
  );
}
