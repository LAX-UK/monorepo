import { COVER_SLOT_FLOORS } from "@auction/domain/cover";
import type {
  CoverMedia,
  CoverPhotoMedia,
  CoverPhotoSlot,
  CoverPlateMedia,
  CoverSlide,
} from "@auction/marketing-ui";
import type { SaleCoverSlotAsset, SaleCoverSlotAssets, SaleDeliveryMode } from "@auction/types";
import { type CoverSaleStatus, coverTimeLine } from "./cover-time";

/** The shortest long side a lead lot photograph needs to hang on a plate. */
const PLATE_MIN_LONG_SIDE = 800;

/** The lot a cover is credited to, or whose photograph makes the plate. */
export type BidCoverLot = {
  id: string;
  href: string;
  /** "Lot 4". */
  label: string;
  title: string;
  /** "current bid £7,000", "opening bid £8,400" or "sold for £7,750"; absent when unknown. */
  priceLine: string | null;
  image: {
    src: string;
    width: number;
    height: number;
    blurDataURL?: string;
    /** The lot photograph's own deepest colour, darkened until white passes 13:1. */
    field: string;
  } | null;
};

/** Where the cover's actions lead. The page owns the routes; the adapter only chooses between them. */
export type BidCoverLinks = {
  register: string;
  bids: string;
  sell: string;
};

export type BidCoverViewer = "anonymous" | "approved" | "pending";

export type BidCoverSaleVM = {
  id: string;
  href: string;
  title: string;
  status: CoverSaleStatus;
  deliveryMode: SaleDeliveryMode;
  startsAt: Date | null;
  endsAt: Date | null;
  lotCount: number;
  subtitle: string | null;
  /** The named cover slots with their measured scrims; absent when staff set none. */
  cover: SaleCoverSlotAssets | undefined;
  /** The lot the cover photograph is a detail of, or the lead lot for the plate. */
  lot: BidCoverLot | null;
};

const DELIVERY_LABEL: Record<SaleDeliveryMode, string> = {
  online: "Online, timed",
  onsite: "In the room",
  hybrid: "In the room and online",
};

const BADGE: Record<CoverSaleStatus, string> = {
  active: "Live",
  scheduled: "Upcoming",
  ended: "Ended",
};

const PRIMARY_LABEL: Record<CoverSaleStatus, string> = {
  active: "View lots",
  scheduled: "Preview the lots",
  ended: "See the results",
};

function lotsPhrase(count: number): string {
  return `${count} ${count === 1 ? "lot" : "lots"}`;
}

/** One sentence: the subtitle if staff wrote one, otherwise how it is held and how many lots. */
function factLine(sale: BidCoverSaleVM): string {
  return (
    sale.subtitle?.trim() || `${DELIVERY_LABEL[sale.deliveryMode]} · ${lotsPhrase(sale.lotCount)}`
  );
}

function secondaryLink(
  status: CoverSaleStatus,
  viewer: BidCoverViewer,
  links: BidCoverLinks,
): CoverSlide["link"] {
  if (status === "ended") return { label: "Sell with LAX", href: links.sell };
  if (viewer === "approved") return { label: "Your bids", href: links.bids };
  if (viewer === "pending") return { label: "Check your registration", href: links.register };
  return { label: "Register to bid", href: links.register };
}

function viewerStatus(status: CoverSaleStatus, viewer: BidCoverViewer): CoverSlide["status"] {
  if (status === "ended") return undefined;
  if (viewer === "approved") {
    return { icon: "check", text: "You’re approved to bid in this sale" };
  }
  if (viewer === "pending") {
    return { icon: "clock", text: "Registration pending. We’ll email you when it’s approved." };
  }
  return undefined;
}

function toPhotoSlot(asset: SaleCoverSlotAsset): CoverPhotoSlot {
  return {
    src: asset.src,
    width: asset.width,
    height: asset.height,
    ...(asset.blurDataURL ? { blurDataURL: asset.blurDataURL } : {}),
    focal: asset.focal,
    ...(asset.keep ? { keep: asset.keep } : {}),
    zoom: asset.zoom,
  };
}

/**
 * The cover photograph, when there is one that can carry text: the default slot is measured,
 * at least the floor wide, and its tone reaches contrast. Anything else is not used, and the
 * next source (the plate) takes over.
 */
export function photoFromCover(cover: SaleCoverSlotAssets | undefined): CoverPhotoMedia | null {
  const base = cover?.default;
  if (!base || base.analysisStatus !== "ready" || !base.colours) return null;
  if (base.width < COVER_SLOT_FLOORS.default.minWidth) return null;
  if (!base.scrim.desktop) return null;
  const wide = cover.wide;
  const phone = cover.phone;
  return {
    kind: "photo",
    alt: base.alt,
    side: base.side,
    slots: {
      default: toPhotoSlot(base),
      ...(wide ? { wide: toPhotoSlot(wide) } : {}),
      ...(phone ? { phone: toPhotoSlot(phone) } : {}),
    },
    scrim: {
      desktop: base.scrim.desktop,
      wide: wide?.scrim.wide ?? base.scrim.wide ?? null,
    },
    colour: base.colours.dominant,
  };
}

/** The lead lot, whole, on a field of its own colour; needs a photograph big enough to hang. */
export function plateFromLot(lot: BidCoverLot | null): CoverPlateMedia | null {
  const image = lot?.image;
  if (!lot || !image) return null;
  if (Math.max(image.width, image.height) < PLATE_MIN_LONG_SIDE) return null;
  return {
    kind: "plate",
    alt: `${lot.title}, shown whole`,
    side: "left",
    src: image.src,
    width: image.width,
    height: image.height,
    ...(image.blurDataURL ? { blurDataURL: image.blurDataURL } : {}),
    field: image.field,
    tone: "light",
  };
}

/** "Lot 4 · Estuary, Evening (detail) · current bid £7,000", linked to the lot. */
function creditFor(sale: BidCoverSaleVM, photo: CoverPhotoMedia | null): CoverSlide["credit"] {
  const lot = sale.lot;
  if (!lot) return undefined;
  const isDetail = Boolean(photo) && (sale.cover?.default?.zoom ?? 1) > 1;
  const parts = [lot.label, isDetail ? `${lot.title} (detail)` : lot.title, lot.priceLine];
  return { text: parts.filter(Boolean).join(" · "), href: lot.href };
}

/** Maps one sale to a cover slide: its pictures in order of preference, then the words. */
export function toBidCoverSlide(
  sale: BidCoverSaleVM,
  context: { now: Date; viewer: BidCoverViewer; links: BidCoverLinks },
): CoverSlide {
  const photo = photoFromCover(sale.cover);
  const plate = plateFromLot(sale.lot);
  const media: CoverMedia[] = [...(photo ? [photo] : []), ...(plate ? [plate] : [])];
  const time = coverTimeLine({
    status: sale.status,
    start: sale.startsAt,
    end: sale.endsAt,
    now: context.now,
  });
  const credit = creditFor(sale, photo);
  const status = viewerStatus(sale.status, context.viewer);
  const link = secondaryLink(sale.status, context.viewer, context.links);
  return {
    id: sale.id,
    badge: BADGE[sale.status],
    ...(time ? { time: time.time } : {}),
    ...(time?.timeTick ? { timeTick: time.timeTick } : {}),
    title: sale.title,
    fact: factLine(sale),
    primary: { label: PRIMARY_LABEL[sale.status], href: sale.href },
    ...(link ? { link } : {}),
    ...(status ? { status } : {}),
    ...(credit && media.length > 0 ? { credit } : {}),
    media,
  };
}

/** The pinned sales as slides, in the order staff pinned them. */
export function toBidCoverSlides(
  sales: readonly BidCoverSaleVM[],
  context: { now: Date; viewer: BidCoverViewer; links: BidCoverLinks },
): CoverSlide[] {
  return sales.map((sale) => toBidCoverSlide(sale, context));
}
