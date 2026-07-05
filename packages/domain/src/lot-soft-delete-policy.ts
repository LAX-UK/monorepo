import type { Lot, Sale } from "@auction/types";

const DELETABLE_LOT_STATUSES = new Set<Lot["status"]>(["draft", "scheduled"]);
const DELETABLE_SALE_STATUSES = new Set<Sale["status"]>(["draft", "scheduled"]);

export type LotSoftDeleteGuardCounts = {
  bidCount: number;
  paymentCount: number;
  approvedRegistrationCount: number;
};

export type LotSoftDeleteContext = {
  lot: Lot;
  sale: Sale | null;
  guards: LotSoftDeleteGuardCounts;
};

/** Human-readable reasons delete is blocked (empty when deletable). */
export function listLotSoftDeleteBlockers(ctx: LotSoftDeleteContext): string[] {
  const { lot, sale, guards } = ctx;
  if (lot.deletedAt) return [];

  const blockers: string[] = [];

  if (!DELETABLE_LOT_STATUSES.has(lot.status)) {
    blockers.push("Only draft or scheduled lots that have not gone live can be deleted");
  }

  if (sale) {
    if (!DELETABLE_SALE_STATUSES.has(sale.status)) {
      blockers.push("Parent sale is live or ended — cancel the lot instead");
    }
  }

  if (guards.bidCount > 0) {
    blockers.push("This lot has bids");
  }
  if (guards.paymentCount > 0) {
    blockers.push("This lot has payments");
  }
  if (guards.approvedRegistrationCount > 0) {
    blockers.push("Parent sale has approved bidder registrations");
  }

  return blockers;
}

export function canLotSoftDelete(ctx: LotSoftDeleteContext): boolean {
  return listLotSoftDeleteBlockers(ctx).length === 0;
}
