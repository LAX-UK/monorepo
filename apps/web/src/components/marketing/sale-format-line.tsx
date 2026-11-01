"use client";

import { SaleTypeExplainerPopover } from "@/components/marketing/sale-type-explainer";
import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import { saleFormatIcon } from "@/lib/sale-format-icon";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import type { SaleDeliveryMode } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { HelpCircle } from "lucide-react";

type Props = {
  deliveryMode: SaleDeliveryMode;
  /** Where it happens; omitted for an online sale. */
  place?: string | null | undefined;
  /** Makes the format a button that explains how this kind of sale works. */
  withExplainer?: boolean;
  explainerContext?: SaleFormatExplainerContext;
  className?: string;
};

/**
 * A sale's format and place on one line: "Online", "In-person · Cheltenham". The format names a
 * kind of sale, so it is plain text, not a second badge beside the status.
 */
export function SaleFormatLine({
  deliveryMode,
  place,
  withExplainer = false,
  explainerContext,
  className,
}: Props) {
  const pres = getSaleTypePresentation(deliveryMode);
  const Icon = saleFormatIcon(pres.iconName);
  const context: SaleFormatExplainerContext =
    explainerContext ?? ({ deliveryMode: pres.key } satisfies SaleFormatExplainerContext);

  const format = (
    <span className="inline-flex items-center gap-1.5 font-medium text-on-surface">
      <Icon aria-hidden className="size-4 shrink-0" />
      {pres.label}
      {withExplainer ? (
        <HelpCircle aria-hidden className="size-3.5 text-on-surface-variant" />
      ) : null}
    </span>
  );

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 font-body text-sm text-on-surface-variant",
        className,
      )}
    >
      {withExplainer ? (
        <SaleTypeExplainerPopover context={context} align="start">
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-0 p-0.5 text-left in-data-[lax-density=client]:px-0.5"
            aria-label={`${pres.label} — format details`}
          >
            {format}
          </Button>
        </SaleTypeExplainerPopover>
      ) : (
        format
      )}
      {place ? (
        <>
          <span aria-hidden>·</span>
          <span>{place}</span>
        </>
      ) : null}
    </p>
  );
}
