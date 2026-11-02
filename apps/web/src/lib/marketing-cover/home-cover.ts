import { lotWasSold } from "@/lib/lot/lot-outcome";
import { salePath } from "@/lib/seo/url";
import type { HomeStateResult } from "@auction/domain";
import { COVER_MAX_SLIDES, type CoverSlide } from "@auction/marketing-ui";
import type { Lot, Sale } from "@auction/types";
import { toDisplayDate } from "@auction/validators";
import { toBidBetweenSeasonsSlide } from "./bid-between-seasons";
import { toBidCoverLot } from "./bid-cover-lot";
import {
  type BidCoverLinks,
  type BidCoverSaleVM,
  type BidViewerSale,
  photoFromCover,
  toBidCoverSlide,
} from "./bid-cover.adapter";
import { coverFilmFor } from "./cover-film";
import { pickCoverLeadLot } from "./cover-lead-lot";
import type { CoverSaleStatus } from "./cover-time";

/** The parts of the home state the cover follows. */
export type HomeCoverState = Pick<HomeStateResult, "state" | "leadSaleId" | "resultsBandSaleIds">;

/** A sale as the home page lists it. */
export type HomeCoverSale = { sale: Sale; lotCount: number };

export type HomeCoverInput = {
  state: HomeCoverState;
  sales: readonly HomeCoverSale[];
  /** The lots read for each sale the cover may lead with (see `coverSaleIds`). */
  lotsBySale: ReadonlyMap<string, readonly Lot[]>;
  now: Date;
  /** The plate colour for a lot's photograph. */
  fieldFor: (lot: Lot) => string;
  links: BidCoverLinks;
  /** Where the between-seasons email field posts. */
  notifyAction: string;
  /** Copy for the between-seasons cover. */
  betweenSeasons: { title: string; fact: string };
};

export type HomeCover = {
  slides: CoverSlide[];
  /** The sale whose registration decides the signed-in swaps; null when the cover leads with none. */
  leadSale: (BidViewerSale & { id: string }) | null;
  /** Lots the cover shows or credits, which the rest of the page must not repeat. */
  lots: Lot[];
};

const COVER_STATUS: Partial<Record<Sale["status"], CoverSaleStatus>> = {
  active: "active",
  scheduled: "scheduled",
  ended: "ended",
};

/** Pinned sales that can lead a cover: live ones first, then in the order staff pinned them. */
function pinnedIds(sales: readonly Sale[], leadId: string | null): string[] {
  return sales
    .filter(
      (sale): sale is Sale & { homePinOrder: number } =>
        sale.id !== leadId &&
        typeof sale.homePinOrder === "number" &&
        (sale.status === "active" || sale.status === "scheduled"),
    )
    .sort(
      (a, b) =>
        Number(b.status === "active") - Number(a.status === "active") ||
        a.homePinOrder - b.homePinOrder,
    )
    .map((sale) => sale.id);
}

/**
 * The sales the cover is made from, in slide order: the lead sale, then up to two more pinned
 * sales (a live sale always first). Between seasons the cover shows one recently sold work.
 */
export function coverSaleIds(state: HomeCoverState, sales: readonly Sale[]): string[] {
  if (state.state === "betweenSeasons") return state.resultsBandSaleIds.slice(0, 1);
  const lead = state.leadSaleId;
  return [...(lead ? [lead] : []), ...pinnedIds(sales, lead)].slice(0, COVER_MAX_SLIDES);
}

/** The lot that makes a sale's plate, or is credited beside its photograph. */
function leadLotOf(sale: Sale, lots: readonly Lot[]): Lot | null {
  const photo = photoFromCover(sale.coverSlotAssets);
  if (!photo) return pickCoverLeadLot(lots, sale.featuredLotIds ?? []);
  const detailOf = sale.coverSlotAssets?.default?.lotId;
  return detailOf ? (lots.find((lot) => lot.id === detailOf) ?? null) : null;
}

/** Between seasons the cover shows a work that sold, never one that did not. */
function leadLotFor(state: HomeCoverState, sale: Sale, lots: readonly Lot[]): Lot | null {
  if (state.state === "betweenSeasons") return pickCoverLeadLot(lots.filter(lotWasSold), []);
  return leadLotOf(sale, lots);
}

/** Every lot the cover could put on a plate, so the caller can read their colours first. */
export function coverPlateLots(
  state: HomeCoverState,
  sales: readonly HomeCoverSale[],
  lotsBySale: ReadonlyMap<string, readonly Lot[]>,
): Lot[] {
  const byId = new Map(sales.map((row) => [row.sale.id, row.sale]));
  return coverSaleIds(
    state,
    sales.map((row) => row.sale),
  ).flatMap((id) => {
    const sale = byId.get(id);
    const lot = sale ? leadLotFor(state, sale, lotsBySale.get(id) ?? []) : null;
    return lot ? [lot] : [];
  });
}

function toSaleVM(
  row: HomeCoverSale,
  status: CoverSaleStatus,
  lot: BidCoverSaleVM["lot"],
): BidCoverSaleVM {
  const { sale } = row;
  return {
    id: sale.id,
    href: salePath(sale),
    title: sale.title,
    status,
    deliveryMode: sale.deliveryMode,
    startsAt: toDisplayDate(sale.startTime),
    endsAt: toDisplayDate(sale.endTime),
    lotCount: row.lotCount,
    subtitle: sale.subtitle ?? null,
    cover: sale.coverSlotAssets,
    lot,
    film: coverFilmFor(sale),
  };
}

function betweenSeasonsCover(input: HomeCoverInput): HomeCover {
  const { state, sales, lotsBySale, now } = input;
  const source = sales.find((row) => row.sale.id === state.resultsBandSaleIds[0]);
  const lot = source ? leadLotFor(state, source.sale, lotsBySale.get(source.sale.id) ?? []) : null;
  const upcoming = sales
    .map((row) => row.sale)
    .filter((sale) => sale.status === "scheduled")
    .sort((a, b) => toDisplayDate(a.startTime).getTime() - toDisplayDate(b.startTime).getTime());
  const deadline = upcoming
    .map((sale) => (sale.consignmentDeadline ? toDisplayDate(sale.consignmentDeadline) : null))
    .find((date): date is Date => date !== null && date.getTime() > now.getTime());
  const coverLot = lot && source ? toBidCoverLot(lot, source.sale, now, input.fieldFor(lot)) : null;
  const slide = toBidBetweenSeasonsSlide(
    {
      ...input.betweenSeasons,
      notifyAction: input.notifyAction,
      sellHref: input.links.sell,
      consignmentDeadline: deadline ?? null,
      nextSales: upcoming.map((sale) => ({
        title: sale.title,
        startsAt: toDisplayDate(sale.startTime),
      })),
      cover: source?.sale.coverSlotAssets,
      lot: coverLot,
    },
    now,
  );
  return { slides: [slide], leadSale: null, lots: lot && slide.credit ? [lot] : [] };
}

/**
 * The home cover for the current home state: one slide for the lead sale, more when staff pinned
 * other sales, or the between-seasons slide. Pictures follow the cover's source order (staff
 * cover, cover from a lot, the lead lot's plate, type only), which the adapter applies.
 */
export function buildHomeCover(input: HomeCoverInput): HomeCover {
  if (input.state.state === "betweenSeasons") return betweenSeasonsCover(input);
  const { sales, lotsBySale, now } = input;
  const byId = new Map(sales.map((row) => [row.sale.id, row]));
  const slides: CoverSlide[] = [];
  const lots: Lot[] = [];
  let leadSale: HomeCover["leadSale"] = null;

  for (const id of coverSaleIds(
    input.state,
    sales.map((row) => row.sale),
  )) {
    const row = byId.get(id);
    const status = row ? COVER_STATUS[row.sale.status] : undefined;
    if (!row || !status) continue;
    const lot = leadLotOf(row.sale, lotsBySale.get(id) ?? []);
    const coverLot = lot ? toBidCoverLot(lot, row.sale, now, input.fieldFor(lot)) : null;
    const vm = toSaleVM(row, status, coverLot);
    const slide = toBidCoverSlide(vm, { now, viewer: "anonymous", links: input.links });
    if (slide.credit && lot) lots.push(lot);
    if (id === input.state.leadSaleId) leadSale = { id, status, href: vm.href };
    slides.push(slide);
  }
  return { slides, leadSale, lots };
}
