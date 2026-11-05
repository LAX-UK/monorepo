import type { Database } from "@auction/db";
import {
  shopEdition,
  shopOrderLine,
  shopParty,
  shopPayoutLedger,
  shopProductionTask,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopDomainError, computePayoutDueAt, payoutAfterSwap } from "@auction/shop-domain";
import { and, asc, eq } from "drizzle-orm";
import type {
  PrintSwapStore,
  SwapMove,
} from "../../application/print-fulfilment/print-fulfilment.ports.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../../lib/pg-errors.js";

/** The payout is a placeholder until the print is handed over; this far ahead keeps it from falling due. */
const PLACEHOLDER_PAYOUT_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

async function partyIsLax(db: Database, partyId: string): Promise<boolean> {
  const [party] = await db
    .select({ kind: shopParty.kind })
    .from(shopParty)
    .where(eq(shopParty.id, partyId))
    .limit(1);
  return party?.kind === "lax";
}

/** Moves the payout with the seller. A payout already paid is never touched. */
async function followSwapWithPayout(db: Database, move: SwapMove): Promise<boolean> {
  const { line, to } = move;
  const fromPartyId = line.sellerPartyId;
  if (fromPartyId === null || to.ownerPartyId === null) {
    throw new ShopDomainError("Both prints need an owner before one can be sent instead");
  }
  const change = payoutAfterSwap({
    fromPartyId,
    fromIsLax: await partyIsLax(db, fromPartyId),
    toPartyId: to.ownerPartyId,
    toIsLax: await partyIsLax(db, to.ownerPartyId),
  });
  if (change.action === "keep") return false;

  const [ledger] = await db
    .select({ id: shopPayoutLedger.id, status: shopPayoutLedger.status })
    .from(shopPayoutLedger)
    .where(eq(shopPayoutLedger.orderLineId, line.orderLineId))
    .for("update")
    .limit(1);
  if (ledger?.status === "paid") {
    throw new ShopDomainError("The seller has already been paid, so the print cannot change hands");
  }

  switch (change.action) {
    case "repoint":
      if (ledger) {
        await db
          .update(shopPayoutLedger)
          .set({ ownerPartyId: change.toPartyId })
          .where(eq(shopPayoutLedger.id, ledger.id));
      }
      return true;
    case "cancel":
      if (ledger) {
        await db
          .update(shopPayoutLedger)
          .set({ status: "cancelled" })
          .where(eq(shopPayoutLedger.id, ledger.id));
      }
      return true;
    case "create": {
      if (!ledger) {
        const [unitPrice] = await db
          .select({ pence: shopOrderLine.unitPricePence })
          .from(shopOrderLine)
          .where(eq(shopOrderLine.id, line.orderLineId))
          .limit(1);
        const pence = unitPrice?.pence ?? 0;
        await db.insert(shopPayoutLedger).values({
          orderLineId: line.orderLineId,
          ownerPartyId: change.toPartyId,
          grossPence: pence,
          deductionsPence: 0,
          netPence: pence,
          payoutDueAt: computePayoutDueAt(new Date(Date.now() + PLACEHOLDER_PAYOUT_YEARS_MS)),
          blockedReason: "pending_possession",
          cancellationPeriodEndsAt: null,
        });
      }
      return true;
    }
  }
}

export function createDrizzlePrintSwapStore(db: Database): PrintSwapStore {
  return {
    async lockRunPrints(artworkId, exceptEditionId) {
      // Every print is locked, in stock order, the one sold included. Two swaps each need their
      // own sold print and the other's free ones; a shared order is what keeps them from
      // waiting on each other.
      const rows = await db
        .select()
        .from(shopEdition)
        .where(eq(shopEdition.artworkId, artworkId))
        .orderBy(asc(shopEdition.stockRef))
        .for("update");
      return rows
        .filter((row) => row.id !== exceptEditionId)
        .map((row) => ({
          editionId: row.id,
          stockRef: row.stockRef,
          editionNumber: row.editionNumber,
          proofNumber: row.proofNumber,
          labelCode: row.labelCode,
          ownerPartyId: row.ownerPartyId,
          saleAuthorisedAt: row.saleAuthorisedAt,
          freeToSell:
            row.listingStatus === "authorised" &&
            row.reservedByOrderId === null &&
            row.reservedUntil === null,
        }));
    },

    async move(move) {
      const { line, to } = move;
      try {
        const sold = await db
          .update(shopEdition)
          .set({
            listingStatus: "sold",
            // The buyer owns the print that is sent, as they owned the one first sold.
            ownerPartyId: line.print.ownerPartyId,
            reservedUntil: null,
            reservedByOrderId: null,
          })
          .where(and(eq(shopEdition.id, to.editionId), eq(shopEdition.listingStatus, "authorised")))
          .returning({ id: shopEdition.id });
        if (sold.length !== 1)
          throw new ShopDomainError(`${move.toLabel} is no longer free to send`);

        await db
          .update(shopEdition)
          .set({
            listingStatus: "withdrawn",
            withdrawnReason: move.reason,
            ownerPartyId: line.sellerPartyId,
            saleAuthorisedAt: null,
          })
          .where(eq(shopEdition.id, line.print.editionId));

        const payoutMoved = await followSwapWithPayout(db, move);

        await db
          .update(shopOrderLine)
          .set({
            editionId: to.editionId,
            editionNumber: to.editionNumber,
            sellerPartyId: to.ownerPartyId,
            swappedFromEditionId: line.print.editionId,
            printLabel: move.toLabel,
          })
          .where(eq(shopOrderLine.id, line.orderLineId));
        await db
          .update(shopProductionTask)
          .set({ editionId: to.editionId, updatedAt: new Date() })
          .where(eq(shopProductionTask.orderLineId, line.orderLineId));
        return { payoutMoved };
      } catch (error) {
        // Another order took the print between the lock and the write: the unique index on the
        // active order line per print is the backstop.
        if (isPgUniqueViolation(error)) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            `${move.toLabel} was just sent to another order. Choose again`,
            409,
          );
        }
        throw error;
      }
    },
  };
}
