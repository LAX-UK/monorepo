import { isIndexableObject } from "@/lib/data/http/object-guards";
import { type LotPageView, buildLotPageView } from "@/lib/lot-page/build-lot-page-view";
import { NO_LOT_VIEWER } from "@/lib/lot-page/lot-viewer";
import type { GalleryImage, WithdrawnLotView } from "@auction/types";

/** What the page keeps of a withdrawn lot: who and what it was, and nothing about its sale. */
export type WithdrawnLotPageLot = Pick<
  WithdrawnLotView,
  "id" | "saleId" | "lotNumber" | "title" | "description" | "medium" | "dimensions" | "artistId"
> & {
  images: string[];
  imageAssets?: GalleryImage[];
};

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Reads the slim public row of a withdrawn lot; `null` when the payload is not one. */
export function parseWithdrawnLot(raw: unknown): WithdrawnLotPageLot | null {
  if (!isIndexableObject(raw) || raw.status !== "withdrawn") return null;
  if (typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  const images = Array.isArray(raw.images)
    ? raw.images.filter((image): image is string => typeof image === "string")
    : [];
  return {
    id: raw.id,
    saleId: textOrNull(raw.saleId),
    lotNumber: typeof raw.lotNumber === "number" ? raw.lotNumber : null,
    title: raw.title,
    description: textOrNull(raw.description),
    medium: textOrNull(raw.medium),
    dimensions: textOrNull(raw.dimensions),
    artistId: textOrNull(raw.artistId),
    images,
    ...(Array.isArray(raw.imageAssets) ? { imageAssets: raw.imageAssets as GalleryImage[] } : {}),
  };
}

/** The withdrawn lot's view: the lifecycle table gives the badge, the notice and the way back. */
export function buildWithdrawnLotView(now: Date): LotPageView {
  return buildLotPageView({
    lifecycle: "withdrawn",
    now,
    msLeft: null,
    startsAt: null,
    endsAt: null,
    amounts: { starting: "0", current: "0", hammer: null, soldForWithPremium: null },
    estimate: null,
    bidCount: 0,
    reserve: "none",
    nextBid: null,
    extendedByMs: null,
    saleroom: null,
    signedIn: false,
    viewer: NO_LOT_VIEWER,
  });
}
