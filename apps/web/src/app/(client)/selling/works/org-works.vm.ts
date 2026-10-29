import type { EntityWonLot } from "@/lib/data/http/payments.server";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";

export type OrgWorkRow = {
  lotId: string;
  title: string;
  /** "Lot 14", or `null` before the lot has a number. */
  lotNumberLabel: string | null;
  endedAtLabel: string;
  endedAtIso: string;
  imageUrl: string | null;
  /** Null when the member's role does not include money. */
  hammerPriceLabel: string | null;
  href: string;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function toOrgWorkRows(wins: readonly EntityWonLot[]): OrgWorkRow[] {
  return wins.map((win) => {
    const ended = new Date(win.endedAt);
    const valid = !Number.isNaN(ended.getTime());
    return {
      lotId: win.lotId,
      title: win.title,
      lotNumberLabel: win.lotNumber == null ? null : `Lot ${win.lotNumber}`,
      endedAtLabel: valid ? DATE_FORMAT.format(ended) : win.endedAt,
      endedAtIso: valid ? ended.toISOString() : win.endedAt,
      imageUrl: win.imageUrl,
      hammerPriceLabel: win.hammerPrice == null ? null : formatMoney(win.hammerPrice, "GBP"),
      href: lotPath({ id: win.lotId, title: win.title }),
    };
  });
}
