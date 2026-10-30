import {
  ARTWORK_OBJECT_TYPE_LABELS,
  ARTWORK_OBJECT_TYPE_SINGULAR_LABELS,
  artworkCatalogueHref,
  emptyArtworkCatalogueState,
} from "@/lib/catalogue/artwork-catalogue-params";
import { isArtworkEnquiryAvailable } from "@/lib/presenters/artwork-commerce.presenter";
import type { PublicArtworkDetail } from "@auction/shop-contracts";

/** One fact with one or more value lines (dimensions show cm and inches on separate lines). */
export type ArtworkSpecRow = { label: string; lines: string[] };

export type ArtworkBreadcrumbItem = { label: string; href?: string };

type ArtworkDimensionFacts = Pick<
  PublicArtworkDetail,
  "heightCm" | "widthCm" | "depthCm" | "dimensionsCmDisplay" | "dimensions"
>;

const CM_PER_INCH = 2.54;

function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** "120 × 90 cm" and "47.2 × 35.4 in" from structured centimetres; null when height or width is unknown. */
export function formatArtworkDimensions(
  artwork: Pick<PublicArtworkDetail, "heightCm" | "widthCm" | "depthCm">,
): { cm: string; inches: string } | null {
  const { heightCm, widthCm, depthCm } = artwork;
  if (heightCm == null || widthCm == null) return null;
  const parts = [heightCm, widthCm, ...(depthCm != null && depthCm > 0 ? [depthCm] : [])];
  return {
    cm: `${parts.map(oneDecimal).join(" × ")} cm`,
    inches: `${parts.map((cm) => oneDecimal(cm / CM_PER_INCH)).join(" × ")} in`,
  };
}

/** Structured sizes win; older records only carry a free-text dimensions string. */
function dimensionLines(artwork: ArtworkDimensionFacts): string[] {
  const derived = formatArtworkDimensions(artwork);
  if (derived) return [derived.cm, derived.inches];
  const text = artwork.dimensionsCmDisplay ?? artwork.dimensions;
  return text ? [text] : [];
}

/** Year, medium and dimensions in the info column (Figma 426:2581). */
/**
 * The work's facts, shown once beside the image: year, type, medium and dimensions in
 * centimetres and inches. Nothing below repeats them.
 */
export function buildArtworkKeySpecs(artwork: PublicArtworkDetail): ArtworkSpecRow[] {
  const rows: ArtworkSpecRow[] = [];
  if (artwork.yearCreated != null)
    rows.push({ label: "Year", lines: [String(artwork.yearCreated)] });
  if (artwork.objectType) {
    rows.push({ label: "Type", lines: [ARTWORK_OBJECT_TYPE_SINGULAR_LABELS[artwork.objectType]] });
  }
  if (artwork.medium) rows.push({ label: "Medium", lines: [artwork.medium] });
  const dimensions = dimensionLines(artwork);
  if (dimensions.length > 0) rows.push({ label: "Dimensions", lines: dimensions });
  return rows;
}

/** Catalogue filtered to this work's object type; null when the type is unknown. */
export function artworkCategoryHref(
  artwork: Pick<PublicArtworkDetail, "objectType">,
): string | null {
  if (!artwork.objectType) return null;
  return artworkCatalogueHref(emptyArtworkCatalogueState(), { objectTypes: [artwork.objectType] });
}

/**
 * "Artworks / <object type> / <title>". Figma also draws a "Private Sales" level, which has
 * no data behind it, so it is left out.
 */
export function buildArtworkBreadcrumb(
  artwork: Pick<PublicArtworkDetail, "objectType" | "title">,
): ArtworkBreadcrumbItem[] {
  const items: ArtworkBreadcrumbItem[] = [{ label: "Artworks", href: "/artworks" }];
  const categoryHref = artworkCategoryHref(artwork);
  if (artwork.objectType && categoryHref) {
    items.push({ label: ARTWORK_OBJECT_TYPE_LABELS[artwork.objectType], href: categoryHref });
  }
  items.push({ label: artwork.title });
  return items;
}

export function artworkCertificateLine(
  artwork: Pick<PublicArtworkDetail, "hasCertificate">,
): string | null {
  return artwork.hasCertificate ? "Includes a certificate of authenticity" : null;
}

/** Reassurance under the price while the work can still be enquired about. */
export function artworkPriceNote(artwork: PublicArtworkDetail): string | null {
  return isArtworkEnquiryAvailable(artwork)
    ? "Contact us to discuss this work. All enquiries are handled with complete discretion."
    : null;
}

/**
 * The image stage's width-to-height ratio, kept between a tall portrait (3:4) and a wide
 * landscape (16:10) so every work sits in a frame made for it, with a narrow mat at most.
 */
export const ARTWORK_STAGE_RATIO = { min: 3 / 4, max: 16 / 10 } as const;

export function clampArtworkStageRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return ARTWORK_STAGE_RATIO.min;
  return Math.min(ARTWORK_STAGE_RATIO.max, Math.max(ARTWORK_STAGE_RATIO.min, ratio));
}

/** The stage ratio from the work's own size; null when height or width is unknown. */
export function artworkStageRatio(
  artwork: Pick<PublicArtworkDetail, "heightCm" | "widthCm">,
): number | null {
  const { heightCm, widthCm } = artwork;
  if (!heightCm || !widthCm) return null;
  return clampArtworkStageRatio(widthCm / heightCm);
}

/** Who replies and when, and where the work can be seen. */
export type ArtworkPromiseVm = { reply: string; viewing: string };

/** The promise under the price while the work is available; none once it is sold. */
export function artworkPromise(
  artwork: PublicArtworkDetail,
  gallery: { name: string; address: string },
): ArtworkPromiseVm | null {
  if (!isArtworkEnquiryAvailable(artwork)) return null;
  return {
    reply: "The gallery team replies within one working day.",
    viewing: `Viewing by appointment at ${gallery.name}, ${gallery.address}.`,
  };
}

/** A question a collector asks about buying an original, with the gallery's answer. */
export type ArtworkFaqVm = {
  id: string;
  question: string;
  answer: string;
  /** Where to go next, when the answer has a page. */
  link?: { label: string; href: string };
};

/**
 * The artwork page's questions (Figma `468:7996`, `905:21656`). Product-owned copy: there is no
 * help centre entity yet. Answers follow the gallery's decisions: originals only, sold by
 * conversation, selling through LAX Bid.
 */
export const ARTWORK_FAQS: readonly ArtworkFaqVm[] = [
  {
    id: "private-sale",
    question: "What is a private sale?",
    answer:
      "Every original at lax.art is sold directly by the gallery, by conversation rather than at a checkout. You ask about the work, we answer and, if you decide to buy, we send an invoice and arrange delivery.",
    link: { label: "How to buy", href: "/how-to-buy" },
  },
  {
    id: "availability",
    question: "How do I know if a work is available?",
    answer:
      "Works listed with a price, or with price on request, are available. Sold works stay on the artist's page as part of their record; ask us about similar works.",
  },
  {
    id: "viewing",
    question: "Can I see the work in person?",
    answer:
      "Yes. Book a private viewing and the gallery team will suggest a quiet time to see it at the gallery in Marylebone.",
    link: { label: "Plan a visit", href: "/visit" },
  },
  {
    id: "contact",
    question: "How do I contact the gallery team?",
    answer:
      "Send an enquiry from this page, call or email us, or visit the gallery. We reply within one working day.",
    link: { label: "Contact", href: "/contact" },
  },
  {
    id: "selling",
    question: "How can I sell a work through LAX?",
    answer:
      "The gallery does not take works on consignment. Collectors sell at auction with LAX Bid; artists can apply to be represented.",
    link: { label: "How to sell", href: "/how-to-sell" },
  },
];
