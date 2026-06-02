"use client";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import type { Sale } from "@auction/types";
import { Badge } from "@auction/ui";
import { LiveDot } from "@auction/ui";
import { cn } from "@auction/ui";
import { HelpCircle, Laptop, MapPin } from "lucide-react";
import { SaleTypeExplainerPopover } from "./sale-type-explainer";

type Props = {
  deliveryMode: "online" | "onsite" | Sale | Pick<Sale, "deliveryMode"> | undefined | null;
  className?: string;
  withIcon?: boolean;
  withExplainer?: boolean;
  size?: "sm" | "md" | "lg";
  isLive?: boolean;
};

export function SaleTypeBadge({
  deliveryMode,
  className,
  withIcon = true,
  withExplainer = false,
  size = "md",
  isLive = false,
}: Props) {
  const pres = getSaleTypePresentation(deliveryMode);
  const Icon = pres.iconName === "Laptop" ? Laptop : MapPin;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  const badgeElement = (
    <Badge
      variant="outline"
      className={cn(
        "font-label font-bold uppercase tracking-wider border transition-all duration-200",
        sizeClasses[size],
        pres.colorClass,
        className,
      )}
    >
      {isLive ? (
        <LiveDot size={size === "sm" ? "sm" : "md"} className="live-dot-pulse mr-0.5" />
      ) : null}
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
        <span className="ml-1 opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden>
          <HelpCircle className={cn(size === "sm" ? "size-3" : "size-3.5", "inline")} />
        </span>
      ) : null}
    </Badge>
  );

  if (withExplainer) {
    return (
      <SaleTypeExplainerPopover activeMode={pres.key} align="start">
        <button
          type="button"
          className="group inline-flex items-center rounded-full text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={`${pres.label} — format details`}
        >
          {badgeElement}
        </button>
      </SaleTypeExplainerPopover>
    );
  }

  return badgeElement;
}
