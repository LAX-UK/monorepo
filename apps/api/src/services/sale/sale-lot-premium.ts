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
 * whose bidding has not opened change; a sold, live or ended lot keeps what it charges. The
 * change and its audit entry (`sale.lot_premiums_reset`, with each lot's previous rate) are
 * written in one transaction.
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

  const payload = {
    lot_ids: changing.map((l) => l.id),
    previous_rates: Object.fromEntries(changing.map((l) => [l.id, l.buyerPremiumRate])),
    differed_from_sale: changing.filter((l) => lotPremiumDiffersFromSale(l.buyerPremiumRate, sale))
      .length,
  };
  const event = {
    aggregateType: "sale",
    aggregateId: input.saleId,
    eventType: SALE_LOT_PREMIUMS_RESET_EVENT,
    payload,
    actorUserId: input.actorUserId,
  };
  if (deps.transactionRunner && deps.repoFactory) {
    await deps.transactionRunner.runInTransaction(async (tx) => {
      const lotRepo = txRepos(deps, tx).lot;
      for (const lot of changing) await lotRepo.update(lot.id, { buyerPremiumRate: null });
      await deps.domainEventSink?.withTx(tx).publish(event);
    });
  } else {
    for (const lot of changing) await deps.lotRepo.update(lot.id, { buyerPremiumRate: null });
    await deps.domainEventSink?.publish(event);
  }
  return ok({ updatedLotIds: payload.lot_ids, skipped });
}
