import type { PortfolioLotCardVm } from "@/components/dashboard/portfolio-lot-grid";
import { formatMoney } from "@/lib/format-currency";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import type { PortfolioRow } from "@auction/types";

export function filterPortfolioRowsByTitle(rows: PortfolioRow[], qLower: string): PortfolioRow[] {
  if (qLower.length === 0) return rows;
  return rows.filter((row) => row.lot.title.toLowerCase().includes(qLower));
}

export function toPortfolioLotCards(rows: PortfolioRow[]): PortfolioLotCardVm[] {
  return rows.map((row) => {
    const a = row.lot;
    const img = a.images[0];
    return {
      id: a.id,
      title: a.title,
      image: img ?? null,
      hammerLabel: formatMoney(a.currentPrice),
      settlementLabel: portfolioSettlementLabel(row),
      medium: a.medium,
      dimensions: a.dimensions,
      paymentStatus: row.payment?.status ?? null,
      checkoutHref: `/dashboard/checkout/${a.id}`,
    };
  });
}
