import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { DeliveryModeTagIcon } from "./delivery-mode-tag-icon.js";
import { DELIVERY_MODE_SHELL, type DeliveryModeTagKey } from "./delivery-mode-tag-variant.js";

export type { DeliveryModeTagKey };

export type DeliveryModePillProps = {
  mode: DeliveryModeTagKey;
  label: React.ReactNode;
  className?: string;
  /** Table/dense layouts: colored glyph only; label via title + aria-label. */
  iconOnly?: boolean;
};

/** Figma Tag-Review delivery-format chip: 16px icon + label pill. */
export function DeliveryModePill({
  mode,
  label,
  className,
  iconOnly = false,
}: DeliveryModePillProps) {
  if (iconOnly) {
    const accessibleLabel = typeof label === "string" ? label : undefined;
    return (
      <span
        className={cn("inline-flex shrink-0", className)}
        role="img"
        {...(accessibleLabel ? { "aria-label": accessibleLabel, title: accessibleLabel } : {})}
      >
        <DeliveryModeTagIcon mode={mode} />
      </span>
    );
  }

  return (
    <span className={cn(DELIVERY_MODE_SHELL[mode], className)}>
      <DeliveryModeTagIcon mode={mode} />
      {label}
    </span>
  );
}
