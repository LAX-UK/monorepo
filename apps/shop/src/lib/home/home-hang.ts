import { artworkCatalogueHref } from "@/lib/catalogue/artwork-catalogue-params";
import { type EditionSizeCm, editionSizeCm, editionSizeLabel } from "@/lib/home/home-edition-size";
import type { ShopImageFacts } from "@/lib/home/home-image-facts";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/** The wall needs at least two works: with one, the cover already shows it. */
export const HOME_HANG_MIN_WORKS = 2;

/** Paper margin around the print, as a share of the print's shorter side. */
const SHEET_MARGIN = 0.08;

export type HomeHangLabel = {
  artist: string;
  title: string;
  /** "£120 with VAT". */
  price: string | null;
  /** "Edition of 24 · 120 × 90 cm". */
  note: string | null;
};

export type HomeHangWork = {
  slug: string;
  href: string;
  imageSrc: string;
  /** The sheet's width over its height. */
  aspect: number;
  /** The long side of the sheet in centimetres; null when the catalogue gives no size. */
  longSideCm: number | null;
  sourceWidthPx: number;
  sourceHeightPx: number;
  /** The paper margin as a share of the sheet's width. */
  sheetInset: number;
  label: HomeHangLabel;
};

export type HomeHangVm = {
  title: string;
  works: HomeHangWork[];
  /** "6 editions" in the meta line. */
  countLabel: string;
  seeAll: { href: string; label: string; tileNote: string };
};

/** The sheet around a print: its shape and the margin as a share of its width. */
export function sheetAround(facts: Pick<ShopImageFacts, "width" | "height">): {
  aspect: number;
  inset: number;
} {
  const margin = SHEET_MARGIN * Math.min(facts.width, facts.height);
  const sheetWidth = facts.width + 2 * margin;
  return { aspect: sheetWidth / (facts.height + 2 * margin), inset: margin / sheetWidth };
}

function editionsLabel(count: number): string {
  return count === 1 ? "1 edition" : `${count} editions`;
}

function labelFor(item: PublicArtworkSummary, size: EditionSizeCm | null): HomeHangLabel {
  const sizeText = editionSizeLabel(size);
  const total = item.availability.totalEditions;
  const note = [total > 0 ? `Edition of ${total}` : null, sizeText].filter(Boolean).join(" · ");
  return {
    artist: item.artistName,
    title: item.title,
    price:
      item.printPricePence !== null
        ? `${formatGbpPenceForDisplay(item.printPricePence)} with VAT`
        : null,
    note: note || null,
  };
}

/**
 * "New editions" as a wall: the release and the newest editions on their sheets at true relative
 * scale. Only editions whose photograph could be read are hung; with fewer than two the wall is
 * left out. A print with no readable size keeps the wall honest by turning it "not to scale".
 */
export function buildHomeHang(input: {
  /** The release first, then the newest editions on sale; duplicates are dropped. */
  editions: readonly PublicArtworkSummary[];
  availableCount: number | null;
  imageSrc: (item: PublicArtworkSummary) => string | null;
  facts: ReadonlyMap<string, ShopImageFacts>;
}): HomeHangVm | null {
  const seen = new Set<string>();
  const works: HomeHangWork[] = [];
  for (const item of input.editions) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    const src = input.imageSrc(item);
    const facts = src ? input.facts.get(src) : undefined;
    if (!src || !facts) continue;
    const size = editionSizeCm(item);
    const sheet = sheetAround(facts);
    works.push({
      slug: item.slug,
      href: `/artworks/${encodeURIComponent(item.slug)}`,
      imageSrc: src,
      aspect: sheet.aspect,
      longSideCm: size ? Math.max(size.heightCm, size.widthCm) : null,
      sourceWidthPx: facts.width,
      sourceHeightPx: facts.height,
      sheetInset: sheet.inset,
      label: labelFor(item, size),
    });
  }
  if (works.length < HOME_HANG_MIN_WORKS) return null;
  const total = Math.max(input.availableCount ?? 0, works.length);
  return {
    title: "New editions",
    works,
    countLabel: editionsLabel(works.length),
    seeAll: {
      href: artworkCatalogueHref({ sort: "newest", availability: "available" }),
      label: total > works.length ? `See all ${editionsLabel(total)}` : "See all editions",
      tileNote: "Every edition on sale",
    },
  };
}
