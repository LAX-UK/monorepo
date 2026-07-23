import { cn } from "../../lib/utils.js";

/**
 * Lot auction-type Tag-Review taxonomy (format labels, not lifecycle status):
 * - english: info + gavel — ascending timed auction
 * - dutch: warning + trending down — descending price
 * - sealed: secondary + lock — confidential single bid
 * - buy_it_now: success + tag — fixed purchase price
 */
export type LotAuctionTypeTagKey = "english" | "dutch" | "sealed" | "buy_it_now";

export type LotAuctionTypeTagGlyph = "gavel" | "trendingDown" | "lock" | "tag";

export type LotAuctionTypeTagVariant = {
  shell: string;
  iconColor: string;
  iconBg: string;
  glyph: LotAuctionTypeTagGlyph;
};

const BASE =
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-label text-xs font-semibold leading-[18px]";

const ICON_SHELL = "pl-1 pr-3 py-0.5";

function iconShell(bg: string, text: string): string {
  return cn(BASE, ICON_SHELL, bg, text);
}

export const LOT_AUCTION_TYPE_TAG_VARIANT: Record<LotAuctionTypeTagKey, LotAuctionTypeTagVariant> =
  {
    english: {
      shell: iconShell("bg-info-container", "text-info"),
      iconColor: "text-info",
      iconBg: "bg-info",
      glyph: "gavel",
    },
    dutch: {
      shell: iconShell("bg-warning-container", "text-warning"),
      iconColor: "text-warning",
      iconBg: "bg-warning",
      glyph: "trendingDown",
    },
    sealed: {
      shell: iconShell("bg-secondary-container", "text-on-secondary-container"),
      iconColor: "text-on-secondary-container",
      iconBg: "bg-secondary",
      glyph: "lock",
    },
    buy_it_now: {
      shell: iconShell("bg-success-container", "text-success"),
      iconColor: "text-success",
      iconBg: "bg-success",
      glyph: "tag",
    },
  };

export const LOT_AUCTION_TYPE_SHELL: Record<LotAuctionTypeTagKey, string> = Object.fromEntries(
  Object.entries(LOT_AUCTION_TYPE_TAG_VARIANT).map(([mode, variant]) => [mode, variant.shell]),
) as Record<LotAuctionTypeTagKey, string>;
