import { accountPurchaseScope } from "@auction/domain";
import type { BidInvoiceRecord, IBidInvoiceReader } from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type { BuyingResult } from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type { PurchaseCandidateReader, PurchaseEntry } from "./purchase-candidate.reader.js";
import { buyingError, entityActorOf, memberIsPayer } from "./purchase-view.js";

export type PayerInvoiceDeps = {
  candidates: Pick<PurchaseCandidateReader, "read">;
  invoices: Pick<IBidInvoiceReader, "findByPaymentIds">;
};

export type PayerInvoice = {
  invoice: BidInvoiceRecord;
  /** The purchase the invoice belongs to (its lot, title and payment). */
  entry: PurchaseEntry & { row: NonNullable<PurchaseEntry["row"]> };
};

/**
 * The invoice of a won lot, for the member who pays it. Only a payer of the acting account gets
 * it: a member who is only told about the purchase and a lot of another account are refused with
 * the same answer as a lot that does not exist, so someone else's invoice is never confirmed. A
 * cancelled invoice is returned (with its `voidedAt`); the caller decides what that means.
 */
export async function findPayersInvoice(
  deps: PayerInvoiceDeps,
  actor: OrganisationMemberActor,
  lotId: string,
): BuyingResult<PayerInvoice> {
  const scope = accountPurchaseScope(entityActorOf(actor));
  if (!scope || !memberIsPayer(actor)) return err(buyingError("insufficient_entity_role"));
  const {
    entries: [entry],
  } = await deps.candidates.read(actor, scope === "own", [lotId]);
  const paymentId = entry?.row?.payment?.id;
  if (!entry?.row || !entry.view || entry.view.paymentRole !== "payer" || !paymentId) {
    return err(buyingError("invoice_not_ready"));
  }
  const invoice = (await deps.invoices.findByPaymentIds([paymentId])).get(paymentId);
  if (!invoice) return err(buyingError("invoice_not_ready"));
  return ok({ invoice, entry: { ...entry, row: entry.row } });
}
