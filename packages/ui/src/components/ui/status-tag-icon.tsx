import { Ban, Check, Info, type LucideIcon, Radio, TriangleAlert, X } from "lucide-react";
import type { DotStatusPillTone } from "./dot-status-pill.js";
import { STATUS_TAG_VARIANT, type StatusTagGlyph } from "./status-tag-variant.js";
import { TagGlyphBadge } from "./tag-glyph-badge.js";

const GLYPH_ICONS: Record<StatusTagGlyph, LucideIcon> = {
  live: Radio,
  check: Check,
  x: X,
  warning: TriangleAlert,
  info: Info,
  banned: Ban,
};

/** Figma Tag-Review 16px status glyphs (Lucide on colored circle). */
export function StatusTagIcon({ tone }: { tone: DotStatusPillTone }) {
  const variant = STATUS_TAG_VARIANT[tone];
  return <TagGlyphBadge icon={GLYPH_ICONS[variant.glyph]} iconBg={variant.iconBg} />;
}

export { STATUS_TAG_ICON_TONES } from "./status-tag-variant.js";
