import { LONDON_TIME_ZONE } from "@/lib/datetime/london-time";
import type { CoverMedia, CoverSeasonRow, CoverSlide } from "@auction/marketing-ui";
import type { SaleCoverSlotAssets } from "@auction/types";
import { type BidCoverLot, photoFromCover, plateFromLot } from "./bid-cover.adapter";
import { coverDay } from "./cover-time";

/** The most sales the season list names after the consignment deadline. */
const SEASON_SALES_MAX = 2;

const MONTH = new Intl.DateTimeFormat("en-GB", { timeZone: LONDON_TIME_ZONE, month: "long" });

export type BidSeasonSale = { title: string; startsAt: Date | null };

/**
 * The season ahead as rows: "Consign by" with the deadline, then the next sales by the month
 * they open. A deadline that has passed, and a sale with no date, are left out; with nothing
 * left the list is undefined and the cover shows none.
 */
export function seasonRows(input: {
  consignmentDeadline: Date | null;
  nextSales: readonly BidSeasonSale[];
  now: Date;
}): CoverSeasonRow[] | undefined {
  const { consignmentDeadline, nextSales, now } = input;
  const rows: CoverSeasonRow[] = [];
  if (consignmentDeadline && consignmentDeadline.getTime() > now.getTime()) {
    rows.push({ label: "Consign by", value: coverDay(consignmentDeadline, now) });
  }
  const dated = nextSales
    .filter((sale): sale is BidSeasonSale & { startsAt: Date } => {
      return sale.startsAt !== null && sale.startsAt.getTime() > now.getTime();
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, SEASON_SALES_MAX);
  for (const sale of dated) rows.push({ label: MONTH.format(sale.startsAt), value: sale.title });
  return rows.length > 0 ? rows : undefined;
}

export type BidBetweenSeasonsVM = {
  title: string;
  fact: string;
  /** Where the alert form posts the address. */
  notifyAction: string;
  sellHref: string;
  consignmentDeadline: Date | null;
  nextSales: readonly BidSeasonSale[];
  /** A recently sold work as the cover, when the sale it came from has a usable picture. */
  cover: SaleCoverSlotAssets | undefined;
  lot: BidCoverLot | null;
};

/** The cover between seasons: no status, an email field in place of the register prompt. */
export function toBidBetweenSeasonsSlide(vm: BidBetweenSeasonsVM, now: Date): CoverSlide {
  const photo = photoFromCover(vm.cover);
  const plate = plateFromLot(vm.lot);
  const media: CoverMedia[] = [...(photo ? [photo] : []), ...(plate ? [plate] : [])];
  const seasons = seasonRows({
    consignmentDeadline: vm.consignmentDeadline,
    nextSales: vm.nextSales,
    now,
  });
  const lot = vm.lot;
  return {
    id: "between-seasons",
    time: "Between sales",
    title: vm.title,
    fact: vm.fact,
    primary: { label: "Notify me", href: vm.notifyAction },
    alert: { action: vm.notifyAction, fieldLabel: "Your email address" },
    link: { label: "Sell with LAX", href: vm.sellHref },
    ...(seasons ? { seasons } : {}),
    ...(lot && media.length > 0
      ? {
          credit: {
            text: ["Recently sold", lot.title, lot.priceLine].filter(Boolean).join(" · "),
            href: lot.href,
          },
        }
      : {}),
    media,
  };
}
