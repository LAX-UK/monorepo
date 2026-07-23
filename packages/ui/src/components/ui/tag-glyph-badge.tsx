import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils.js";

export type TagGlyphBadgeProps = {
  icon: LucideIcon;
  iconBg: string;
};

/** Figma Tag-Review 16px colored circle + white Lucide glyph. */
export function TagGlyphBadge({ icon: Icon, iconBg }: TagGlyphBadgeProps) {
  return (
    <span
      className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full", iconBg)}
      aria-hidden
    >
      <Icon className="size-2.5 text-on-primary" strokeWidth={2.25} />
    </span>
  );
}
