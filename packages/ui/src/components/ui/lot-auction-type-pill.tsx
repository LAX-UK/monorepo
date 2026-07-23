import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { LotAuctionTypeTagIcon } from "./lot-auction-type-tag-icon.js";
import {
  LOT_AUCTION_TYPE_SHELL,
  type LotAuctionTypeTagKey,
} from "./lot-auction-type-tag-variant.js";

export type { LotAuctionTypeTagKey };

export type LotAuctionTypePillProps = {
  mode: LotAuctionTypeTagKey;
  label: React.ReactNode;
  className?: string;
  /** Table/dense layouts: colored glyph only; label via title + aria-label. */
  iconOnly?: boolean;
};

/** Figma Tag-Review lot auction-type chip: 16px icon + label pill. */
export function LotAuctionTypePill({
  mode,
  label,
  className,
  iconOnly = false,
}: LotAuctionTypePillProps) {
  if (iconOnly) {
    const accessibleLabel = typeof label === "string" ? label : undefined;
    return (
      <span
        className={cn("inline-flex shrink-0", className)}
        role="img"
        {...(accessibleLabel ? { "aria-label": accessibleLabel, title: accessibleLabel } : {})}
      >
        <LotAuctionTypeTagIcon mode={mode} />
      </span>
    );
  }

  return (
    <span className={cn(LOT_AUCTION_TYPE_SHELL[mode], className)}>
      <LotAuctionTypeTagIcon mode={mode} />
      {label}
    </span>
  );
}
