import type { PublicUser } from "@/lib/data/contracts";
import { formatEstimateRange } from "@/lib/format-currency";
import { lotMarketingSection } from "@/lib/marketing/artwork/lot-marketing-sections";
import type { Lot, LotMarketingDetails, PublicLotView } from "@auction/types";
import type { ReactNode } from "react";

/** Ids for programmatic accordion items (see `buildArtworkPageAccordionBlocks`). */
export const ARTWORK_PAGE_ACCORDION_IDS = {
  lotDetails: "lot-details",
  bidHistory: "bid-history",
  fees: "fees",
  documents: "lot-documents",
} as const;

export type AccordionBlock = {
  id: string;
  title: string;
  /** Marketing copy (plain). Omit when `contentNode` is set. */
  content?: string;
  /** Rich content (e.g. lot details, bid history). When set, overrides `content`. */
  contentNode?: ReactNode;
  /** When true, block is omitted from render */
  hidden: boolean;
};

/** Split marketing blocks for online layout: always-open lot details vs collapsible items. */
export function splitArtworkAccordionBlocks(blocks: readonly AccordionBlock[]) {
  const visible = blocks.filter((b) => !b.hidden);
  const lotDetails = visible.find((b) => b.id === ARTWORK_PAGE_ACCORDION_IDS.lotDetails) ?? null;
  const accordionBlocks = visible.filter((b) => b.id !== ARTWORK_PAGE_ACCORDION_IDS.lotDetails);
  return { lotDetails, accordionBlocks };
}

/** Plain text for accordion / search; shared with other surfaces that need the same copy. */
export function formatProvenanceList(
  items: NonNullable<LotMarketingDetails["provenance"]>,
): string {
  if (!items.length) return "";
  return items.map((p) => (p.period ? `${p.period}: ` : "") + p.note).join("\n\n");
}

export function formatExhibitions(list: NonNullable<LotMarketingDetails["exhibitions"]>): string {
  if (!list.length) return "";
  return list
    .map((e: { year?: string; venue: string; note?: string }) => {
      const line = e.year ? `${e.year} — ${e.venue}` : e.venue;
      return e.note ? `${line}\n${e.note}` : line;
    })
    .join("\n\n");
}

/** Same body text as the “About artist” accordion item. */
export function aboutArtistBlockContent(
  lot: Lot | PublicLotView,
  artist: PublicUser | null,
): string {
  const md = lot.marketingDetails;
  const aboutName = artist?.name ?? "";
  return (
    md.artistNote?.trim() ||
    (aboutName ? `${aboutName}. See the seller/artist profile for more context.` : "")
  );
}

/** Data-driven accordion list; `hidden` items are filtered out in the component.
 */
export function mapLotToAccordionBlocks(
  lot: Lot | PublicLotView,
  artist: PublicUser | null,
): AccordionBlock[] {
  const md = lot.marketingDetails;
  const est = md.estimate;
  const estimateText = est?.low != null && est?.high != null ? formatEstimateRange(est) : "";
  const cr = md.conditionReport;
  const crText = [cr?.summary, cr?.details, cr?.downloadUrl ? `Download: ${cr.downloadUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const prov = formatProvenanceList(md.provenance ?? []);
  const ex = formatExhibitions(md.exhibitions ?? []);

  const aboutText = aboutArtistBlockContent(lot, artist);

  return [
    {
      id: lotMarketingSection.estimate.id,
      title: lotMarketingSection.estimate.title,
      content: estimateText,
      hidden: estimateText.trim() === "",
    },
    {
      id: lotMarketingSection.condition.id,
      title: lotMarketingSection.condition.title,
      content: crText,
      hidden: crText.trim() === "",
    },
    {
      id: lotMarketingSection.provenance.id,
      title: lotMarketingSection.provenance.title,
      content: prov,
      hidden: !prov.trim(),
    },
    {
      id: lotMarketingSection.exhibited.id,
      title: lotMarketingSection.exhibited.title,
      content: ex,
      hidden: !ex.trim(),
    },
    {
      id: lotMarketingSection.artist.id,
      title: lotMarketingSection.artist.title,
      content: aboutText,
      hidden: !aboutText.trim(),
    },
  ];
}
