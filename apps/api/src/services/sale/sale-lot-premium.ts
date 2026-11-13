import type { Lot, StaffRoles } from "@auction/types";
import { normalizeUserRoleOrClient } from "@auction/types";
import { lotPremiumDiffersFromSale } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { type AuthzError, LotError, missingCatalogueCapabilityError } from "../../lib/errors.js";
import { txRepos } from "./sale-mutation-context.js";
import type { SaleServiceDeps } from "./sale-types.js";

/** The domain event (and audit entry) for staff putting lots back on their sale's premium. */
export const SALE_LOT_PREMIUMS_RESET_EVENT = "sale.lot_premiums_reset";

/** Lots whose premium can still change: bidding has not opened, and nobody has won them. */
const PREMIUM_EDITABLE: ReadonlySet<Lot["status"]> = new Set(["draft", "scheduled"]);

export type UseSalePremiumOutcome = {
  /** Lots that now use the sale's premium. */
  updatedLotIds: string[];
  /** Lots asked for that were left as they were, and why. */
  skipped: { lotId: string; reason: "not_in_sale" | "not_editable" | "already_uses_sale" }[];
};

function skipReason(
  lot: Lot | undefined,
  saleId: string,
): UseSalePremiumOutcome["skipped"][number]["reason"] | null {
  if (!lot || lot.saleId !== saleId) return "not_in_sale";
  if (!PREMIUM_EDITABLE.has(lot.status) || lot.winnerId) return "not_editable";
  if (lot.buyerPremiumRate == null) return "already_uses_sale";
  return null;
}

/**
 * Puts the chosen lots back on their sale's premium by clearing their own rate. Only unsold lots
 * whose bidding has not opened change; a sold, live or ended lot keeps what it charges. The write
 * locks and re-checks each lot, so one that opens or is won after the list is read is skipped as
 * not editable. The change and its audit entry (`sale.lot_premiums_reset`, with each changed
 * lot's previous rate) are written in one transaction.
 */
export async function useSalePremiumForLots(
  deps: SaleServiceDeps,
  input: {
    actorUserId: string;
    userRole: string;
    userStaffRoles?: StaffRoles | undefined;
    saleId: string;
    lotIds: readonly string[];
  },
): Promise<Result<UseSalePremiumOutcome, LotError | AuthzError>> {
  const role = normalizeUserRoleOrClient(input.userRole);
  if (!canManageCatalogue(role, input.userStaffRoles)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can change lot premiums",
        role,
        input.userStaffRoles,
      ),
    );
  }
  const sale = await deps.saleRepo.findById(input.saleId);
  if (!sale) return err(new LotError("Sale not found", 404));

  const lots = new Map((await deps.lotRepo.findBySaleId(input.saleId)).map((l) => [l.id, l]));
  const changing: Lot[] = [];
  const skipped: UseSalePremiumOutcome["skipped"] = [];
  for (const lotId of new Set(input.lotIds)) {
    const lot = lots.get(lotId);
    const reason = skipReason(lot, input.saleId);
    if (reason || !lot) skipped.push({ lotId, reason: reason ?? "not_in_sale" });
    else changing.push(lot);
  }
  if (changing.length === 0) return ok({ updatedLotIds: [], skipped });

  const clear = (lotRepo: SaleServiceDeps["lotRepo"]) =>
    lotRepo.clearOwnPremiumOfUnopenedLots(
      input.saleId,
      changing.map((l) => l.id),
    );
  const eventFor = (cleared: readonly { lotId: string; previousRate: string }[]) => ({
    aggregateType: "sale",
    aggregateId: input.saleId,
    eventType: SALE_LOT_PREMIUMS_RESET_EVENT,
    payload: {
      lot_ids: cleared.map((c) => c.lotId),
      previous_rates: Object.fromEntries(cleared.map((c) => [c.lotId, c.previousRate])),
      differed_from_sale: cleared.filter((c) => lotPremiumDiffersFromSale(c.previousRate, sale))
        .length,
    },
    actorUserId: input.actorUserId,
  });
  // The write re-checks each lot under its row lock: one that opened for bidding or was won
  // since the read above is left as it is and reported as not editable.
  let cleared: { lotId: string; previousRate: string }[];
  if (deps.transactionRunner && deps.repoFactory) {
    cleared = await deps.transactionRunner.runInTransaction(async (tx) => {
      const rows = await clear(txRepos(deps, tx).lot);
      if (rows.length > 0) await deps.domainEventSink?.withTx(tx).publish(eventFor(rows));
      return rows;
    });
  } else {
    cleared = await clear(deps.lotRepo);
    if (cleared.length > 0) await deps.domainEventSink?.publish(eventFor(cleared));
  }
  const updated = new Set(cleared.map((c) => c.lotId));
  for (const lot of changing) {
    if (!updated.has(lot.id)) skipped.push({ lotId: lot.id, reason: "not_editable" });
  }
  return ok({ updatedLotIds: changing.filter((l) => updated.has(l.id)).map((l) => l.id), skipped });
}
