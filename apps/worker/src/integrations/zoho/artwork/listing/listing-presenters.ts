import {
  type LaxListingKey,
  type OfferState,
  WITHDRAWN_FROM_LABEL,
  type WhereItIs,
} from "@auction/artwork-register-contracts";
import type { ListingLot } from "@auction/persistence/interfaces";
import type { ListingFacts } from "./listing-facts.js";
import type { ListingLinks } from "./listing-links.js";

export type PresentInput = {
  facts: ListingFacts;
  where: WhereItIs;
  links: ListingLinks;
};

export type Presented = { detail: string | null; link: string | null };

const LONDON = "Europe/London";
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: LONDON,
});
const DAY_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: LONDON,
});

const day = (value: Date) => DAY.format(value);
const dayTime = (value: Date) => DAY_TIME.format(value);

function joined(...parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

/** When the artwork moved into the place it is in now, when the history says. */
function arrivedAt(facts: ListingFacts, state: OfferState): Date | null {
  const move = facts.lastMove;
  return move && move.to === state ? move.at : null;
}

function lotLine(lot: ListingLot | null, ...extra: (string | null)[]): string | null {
  if (!lot) return extra.filter(Boolean).join(" · ") || null;
  return joined(lot.sale?.title, lot.lotNumber !== null ? `Lot ${lot.lotNumber}` : null, ...extra);
}

/** A lot buyers can open: published in a real sale that is not a draft. */
function lotIsPublic(lot: ListingLot): boolean {
  return (
    !lot.deleted &&
    lot.status !== "draft" &&
    lot.sale !== null &&
    !lot.sale.isTest &&
    lot.sale.status !== "draft"
  );
}

function lotLink({ facts, links }: PresentInput): string {
  const { lot } = facts;
  if (!lot) return links.registerRecord(facts.entry.id);
  return lotIsPublic(lot) ? links.bidLotPublic(lot) : links.bidLotStaff(lot.id);
}

function laxArtLink({ facts, links }: PresentInput): string {
  const { laxArt } = facts;
  if (!laxArt) return links.registerRecord(facts.entry.id);
  return laxArt.published ? links.laxArtPublic(laxArt.slug) : links.laxArtStaff(laxArt.artworkId);
}

const recordLink = ({ facts, links }: PresentInput) => links.registerRecord(facts.entry.id);

function sinceText(prefix: string, at: Date | null): string {
  return at ? `${prefix} ${day(at)}` : prefix;
}

function privateSaleText(facts: ListingFacts): string {
  return facts.privateSale ? `Private sale ${facts.privateSale.reference}` : "Private sale";
}

/**
 * The detail line and the link for each listing. One entry per place, so a new place is a new row
 * here and nothing else changes. Dates read in London time, as staff work.
 */
export const LISTING_PRESENTERS: Readonly<
  Record<LaxListingKey, (input: PresentInput) => Presented>
> = {
  not_offered: (input) => ({ detail: null, link: recordLink(input) }),
  draft_lax_art: (input) => ({
    detail: "Draft listing, not visible to buyers yet",
    link: laxArtLink(input),
  }),
  lax_art: (input) => {
    const published = input.facts.laxArt?.publishedAt;
    const at = published ? new Date(published) : arrivedAt(input.facts, "lax_art");
    return { detail: sinceText("Published", at), link: laxArtLink(input) };
  },
  draft_bid_lot: (input) => ({
    detail: input.facts.lot?.sale
      ? lotLine(input.facts.lot, "draft lot")
      : "Draft lot, not in a sale yet",
    link: lotLink(input),
  }),
  bid_sale_upcoming: (input) => {
    const sale = input.facts.lot?.sale;
    return {
      detail: lotLine(input.facts.lot, sale ? `starts ${dayTime(sale.startTime)}` : null),
      link: lotLink(input),
    };
  },
  bid_sale_live_now: (input) => {
    const sale = input.facts.lot?.sale;
    return {
      detail: lotLine(
        input.facts.lot,
        sale ? `live now, ends ${dayTime(sale.endTime)}` : "live now",
      ),
      link: lotLink(input),
    };
  },
  bid_sale_ended: (input) => ({
    detail: lotLine(input.facts.lot, "lot closed, sold once the buyer pays"),
    link: lotLink(input),
  }),
  private_sale: (input) => ({ detail: privateSaleText(input.facts), link: recordLink(input) }),
  sold_lax_art: (input) => ({
    detail: sinceText("Sold", arrivedAt(input.facts, "sold")),
    link: laxArtLink(input),
  }),
  sold_bid_sale: (input) => {
    const at = arrivedAt(input.facts, "sold");
    return {
      detail: lotLine(input.facts.lot, at ? `sold ${day(at)}` : "sold"),
      link: lotLink(input),
    };
  },
  sold_private_sale: (input) => {
    const at = arrivedAt(input.facts, "sold");
    return {
      detail: joined(privateSaleText(input.facts), at ? `sold ${day(at)}` : "sold"),
      link: recordLink(input),
    };
  },
  sold_gallery: (input) => ({
    detail: sinceText("Recorded from the Zoho Status", arrivedAt(input.facts, "sold")),
    link: recordLink(input),
  }),
  sold: (input) => ({
    detail: sinceText("Sold", arrivedAt(input.facts, "sold")),
    link: recordLink(input),
  }),
  withdrawn: (input) => {
    const from = input.where.key === "withdrawn" ? input.where.from : null;
    const prefix = from ? `Withdrawn from ${WITHDRAWN_FROM_LABEL[from]}` : "Withdrawn";
    return {
      detail: sinceText(prefix, arrivedAt(input.facts, "withdrawn")),
      link: recordLink(input),
    };
  },
};
