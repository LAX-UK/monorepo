import type { ArtworkRegisterEntry, LotCatalogueFacts } from "@auction/artwork-register-contracts";
import type {
  AdminCatalogueChange,
  AdminZohoLinkComparison,
  AdminZohoLinkField,
} from "@auction/shop-contracts";
import {
  type ArtistForCode,
  type LinkListingFacts,
  type LinkPlan,
  planLink,
} from "./zoho-link-differences.js";

/** The most pictures a Bid draft lot takes; the same cap as when the lot is made. */
export const LOT_IMAGE_LIMIT = 20;

export const PUBLISHED_NOTE =
  "This listing is live on lax.art, so it is not changed from Zoho automatically. Edit the listing if it should match.";
export const IN_SALE_NOTE =
  "This lot is in a sale that is live or coming up, so it is not changed from Zoho. Edit the lot in LAX Bid if it should match.";

const clean = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

const imageCount = (count: number) =>
  count === 0 ? null : count === 1 ? "1 image" : `${count} images`;

/** Zoho's pictures as the public addresses a Bid lot holds: distinct, in order, capped. */
export function zohoImageUrls(
  entry: Pick<ArtworkRegisterEntry, "imageRefs">,
  resolveImageUrl: (value: string | null | undefined) => string | null,
): string[] {
  return entry.imageRefs
    .map((ref) => resolveImageUrl(ref))
    .filter((url): url is string => url !== null)
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, LOT_IMAGE_LIMIT);
}

export type LaxArtCopyState = {
  published: boolean;
  facts: LinkListingFacts;
  artistForCode: ArtistForCode;
};

/**
 * Where a lax.art listing no longer matches Zoho, with what an update would do. Reuses the plan
 * linking makes, so the differences read exactly as they do when a listing is linked. A listing
 * that matches has no change (null). Only a draft can update, and not while its artist needs
 * fixing first; a published listing is shown, never changed.
 */
export function laxArtCatalogueChange(
  copy: LaxArtCopyState,
  entry: ArtworkRegisterEntry,
): { change: AdminCatalogueChange; plan: LinkPlan } | null {
  const plan = planLink(copy.facts, entry, copy.artistForCode);
  if (plan.differences.length === 0 && plan.artistRefusal === null) return null;
  const draft = !copy.published;
  const canUpdate = draft && plan.artistRefusal === null;
  return {
    plan,
    change: {
      copy: "lax_art",
      state: draft ? "draft" : "published",
      comparison: plan.comparison,
      canUpdate,
      note: !draft ? PUBLISHED_NOTE : plan.artistRefusal,
    },
  };
}

/** Whether a Bid lot may follow Zoho: a draft, in a sale that has not started. */
export function bidLotIsDraft(lot: Pick<LotCatalogueFacts, "status" | "saleStatus">): boolean {
  return lot.status === "draft" && (lot.saleStatus === null || lot.saleStatus === "draft");
}

/**
 * Where a Bid lot no longer matches Zoho: title, medium, size and pictures. The artist, the year
 * and the description are staff's on a lot, so they are not compared. A lot that matches has no
 * change (null). A draft lot can update; a lot in a live or upcoming sale never does.
 */
export function bidLotCatalogueChange(
  lot: LotCatalogueFacts,
  entry: ArtworkRegisterEntry,
  imageUrls: readonly string[],
): AdminCatalogueChange | null {
  const rows: [AdminZohoLinkField, string, string | null, string | null][] = [
    ["title", "Title", clean(lot.title), clean(entry.title)],
    ["medium", "Medium", clean(lot.medium), clean(entry.medium)],
    ["size", "Size", clean(lot.dimensions), clean(entry.dimensions)],
    ["images", "Images", imageCount(lot.imageUrls.length), imageCount(imageUrls.length)],
  ];
  const imagesDiffer = lot.imageUrls.join("\n") !== imageUrls.join("\n");
  const comparison: AdminZohoLinkComparison[] = rows
    .map(([field, label, current, zoho]) => ({
      field,
      label,
      laxArtValue: current,
      zohoValue: zoho,
      changes: field === "images" ? imagesDiffer : current !== zoho,
    }))
    .filter((row) => row.changes || row.laxArtValue !== null || row.zohoValue !== null);
  if (!comparison.some((row) => row.changes)) return null;
  const draft = bidLotIsDraft(lot);
  return {
    copy: "bid_lot",
    state: draft ? "draft" : "in_sale",
    comparison,
    canUpdate: draft,
    note: draft ? null : IN_SALE_NOTE,
  };
}

/** What a draft lot takes from Zoho. */
export function bidLotContent(entry: ArtworkRegisterEntry, imageUrls: readonly string[]) {
  return {
    title: entry.title,
    medium: clean(entry.medium),
    dimensions: clean(entry.dimensions),
    imageUrls: [...imageUrls],
  };
}
