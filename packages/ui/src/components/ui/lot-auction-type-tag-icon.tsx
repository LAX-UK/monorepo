import { Gavel, Lock, type LucideIcon, Tag, TrendingDown } from "lucide-react";
import type { LotAuctionTypeTagKey } from "./lot-auction-type-tag-variant.js";
import {
  LOT_AUCTION_TYPE_TAG_VARIANT,
  type LotAuctionTypeTagGlyph,
} from "./lot-auction-type-tag-variant.js";
import { TagGlyphBadge } from "./tag-glyph-badge.js";

const GLYPH_ICONS: Record<LotAuctionTypeTagGlyph, LucideIcon> = {
  gavel: Gavel,
  trendingDown: TrendingDown,
  lock: Lock,
  tag: Tag,
};

/** Figma Tag-Review 16px lot-auction-type glyphs (Lucide on colored circle). */
export function LotAuctionTypeTagIcon({ mode }: { mode: LotAuctionTypeTagKey }) {
  const variant = LOT_AUCTION_TYPE_TAG_VARIANT[mode];
  return <TagGlyphBadge icon={GLYPH_ICONS[variant.glyph]} iconBg={variant.iconBg} />;
}
