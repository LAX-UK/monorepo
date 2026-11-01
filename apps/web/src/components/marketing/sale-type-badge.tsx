"use client";

import type { SaleFormatExplainerContext } from "@/lib/sale-format-explainer";
import { saleFormatIcon } from "@/lib/sale-format-icon";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import type { Sale, SaleDeliveryMode } from "@auction/types";
import { Badge, STATUS_BADGE_TONE_CLASSES } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { HelpCircle } from "lucide-react";
import { SaleTypeExplainerPopover } from "./sale-type-explainer";

type Props = {
  deliveryMode: SaleDeliveryMode | Sale | Pick<Sale, "deliveryMode"> | undefined | null;
  className?: string;
  withIcon?: boolean;
  withExplainer?: boolean;
  size?: "sm" | "md" | "lg";
  /** Sale-specific context for the format help popover. */
  explainerContext?: SaleFormatExplainerContext;
};

export function SaleTypeBadge({
  deliveryMode,
  className,
  withIcon = true,
  withExplainer = false,
  size = "md",
  explainerContext,
}: Props) {
  const pres = getSaleTypePresentation(deliveryMode);
  const Icon = saleFormatIcon(pres.iconName);
  const context: SaleFormatExplainerContext =
    explainerContext ?? ({ deliveryMode: pres.key } satisfies SaleFormatExplainerContext);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  const badgeElement = (
    <Badge
      variant="outline"
      className={cn(
        // A sale format is not a status: one neutral pill for every format.
        "border-transparent font-label font-medium transition-colors duration-200",
        sizeClasses[size],
        STATUS_BADGE_TONE_CLASSES.neutral,
        className,
      )}
    >
      {withIcon ? (
        <Icon
          className={cn(
            size === "sm" ? "size-3" : size === "lg" ? "size-4" : "size-3.5",
            "shrink-0",
          )}
        />
      ) : null}
      <span>{pres.label}</span>
      {withExplainer ? (
        <span className="ml-1 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden>
          <HelpCircle className={cn(size === "sm" ? "size-3" : "size-3.5", "inline")} />
        </span>
      ) : null}
    </Badge>
  );

  if (withExplainer) {
    return (
      <SaleTypeExplainerPopover context={context} align="start">
        <Button
          type="button"
          variant="ghost"
          className="group inline-flex h-auto items-center p-0 in-data-[lax-density=client]:px-0 text-left hover:bg-transparent"
          aria-label={`${pres.label} — format details`}
        >
          {badgeElement}
        </Button>
      </SaleTypeExplainerPopover>
    );
  }

  return badgeElement;
}
