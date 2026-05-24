import type { Lot, Sale } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { LotError } from "../lib/errors.js";
import type { SaleSoftDeleteGuardCounts } from "./interfaces/sale-soft-delete.js";

const DELETABLE_SALE_STATUSES = new Set<Sale["status"]>(["draft", "scheduled"]);
const DELETABLE_LOT_STATUSES = new Set<Lot["status"]>(["draft", "scheduled"]);

export type SaleSoftDeleteContext = {
  sale: Sale;
  lots: Lot[];
  guards: SaleSoftDeleteGuardCounts;
};

/** Human-readable reasons delete is blocked (empty when deletable). */
export function listSaleSoftDeleteBlockers(ctx: SaleSoftDeleteContext): string[] {
  const { sale, lots, guards } = ctx;
  if (sale.deletedAt) return [];

  const blockers: string[] = [];

  if (!DELETABLE_SALE_STATUSES.has(sale.status)) {
    blockers.push("Only draft or scheduled sales that have not gone live can be deleted");
  }

  for (const l of lots) {
    if (l.deletedAt) continue;
    if (l.status === "cancelled") continue;
    if (!DELETABLE_LOT_STATUSES.has(l.status)) {
      blockers.push("At least one lot is active, ended, or voided");
      break;
    }
  }

  if (guards.bidCount > 0) {
    blockers.push("Lots in this sale have bids");
  }
  if (guards.paymentCount > 0) {
    blockers.push("Lots in this sale have payments");
  }
  if (guards.approvedRegistrationCount > 0) {
    blockers.push("This sale has approved bidder registrations");
  }

  return blockers;
}

export function canSaleSoftDelete(ctx: SaleSoftDeleteContext): boolean {
  return listSaleSoftDeleteBlockers(ctx).length === 0;
}

export function validateSaleSoftDelete(ctx: SaleSoftDeleteContext): Result<void, LotError> {
  if (ctx.sale.deletedAt) {
    return err(new LotError("Sale not found", 404));
  }

  const blockers = listSaleSoftDeleteBlockers(ctx);
  const firstBlocker = blockers[0];
  if (firstBlocker) {
    return err(new LotError(firstBlocker, 422));
  }

  return ok(undefined);
}
