import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { StatusTagIcon } from "./status-tag-icon.js";
import { TONE_SHELL } from "./status-tag-variant.js";

export type DotStatusPillTone =
  | "live"
  | "sold"
  | "public"
  | "pending"
  | "draft"
  | "warning"
  | "critical"
  | "neutral"
  | "info"
  | "success";

export { TONE_SHELL };

export type DotStatusPillProps = {
  label: React.ReactNode;
  tone?: DotStatusPillTone;
  className?: string;
  /** Table/dense layouts: colored glyph only; label via title + aria-label. */
  iconOnly?: boolean;
};

/** Figma Tag-Review status chip: 16px icon + label pill. */
export function DotStatusPill({
  label,
  tone = "neutral",
  className,
  iconOnly = false,
}: DotStatusPillProps) {
  if (iconOnly) {
    const accessibleLabel = typeof label === "string" ? label : undefined;
    return (
      <span
        className={cn("inline-flex shrink-0", className)}
        role="img"
        {...(accessibleLabel ? { "aria-label": accessibleLabel, title: accessibleLabel } : {})}
      >
        <StatusTagIcon tone={tone} />
      </span>
    );
  }

  return (
    <span className={cn(TONE_SHELL[tone], className)}>
      <StatusTagIcon tone={tone} />
      {label}
    </span>
  );
}
