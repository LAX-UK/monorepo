import { Laptop, type LucideIcon, MapPin, MonitorSmartphone } from "lucide-react";
import type { DeliveryModeTagKey } from "./delivery-mode-tag-variant.js";
import {
  DELIVERY_MODE_TAG_VARIANT,
  type DeliveryModeTagGlyph,
} from "./delivery-mode-tag-variant.js";
import { TagGlyphBadge } from "./tag-glyph-badge.js";

const GLYPH_ICONS: Record<DeliveryModeTagGlyph, LucideIcon> = {
  laptop: Laptop,
  mapPin: MapPin,
  monitorSmartphone: MonitorSmartphone,
};

/** Figma Tag-Review 16px delivery-format glyphs (Lucide on colored circle). */
export function DeliveryModeTagIcon({ mode }: { mode: DeliveryModeTagKey }) {
  const variant = DELIVERY_MODE_TAG_VARIANT[mode];
  return <TagGlyphBadge icon={GLYPH_ICONS[variant.glyph]} iconBg={variant.iconBg} />;
}
