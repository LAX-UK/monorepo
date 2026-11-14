import type {
  CreditNoteRefund,
  CreditNoteRefundOutcome,
  CreditNoteRefundPort,
  WriteFence,
} from "@auction/accounting-domain";
import { toIssueFailure } from "../outcome.js";
import type { ZohoApi } from "./api.js";
import type { GatewayDeps } from "./gateways.js";
import { prepareFor } from "./gateways.js";
import { KIND_SPECS, asRecord } from "./kinds.js";
import { penceToPounds, poundsToPence } from "./money-format.js";
import { ZOHO_BOOKS_REJECTIONS } from "./rejections.js";
import type { Stop } from "./resolve.js";

function fromStop(stop: Stop): CreditNoteRefundOutcome {
  return stop.status === "rejected"
    ? { status: "rejected", reason: stop.reason }
    : { status: "unknown", ...(stop.detail ? { detail: stop.detail } : {}) };
}

/** The refunds Books holds on a credit note, in pence with their reference; null when unreadable. */
function refundsOf(
  body: unknown,
): { readonly amountPence: number; readonly reference: string | null }[] | null {
  const rows = asRecord(body)?.creditnote_refunds;
  if (!Array.isArray(rows)) return null;
  const out: { amountPence: number; reference: string | null }[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    const amountPence = poundsToPence(row?.amount);
    if (!row || amountPence === null) return null;
    out.push({
      amountPence,
      reference: typeof row.reference_number === "string" ? row.reference_number : null,
    });
  }
  return out;
}

/**
 * Refunds an issued credit note's money from the Stripe clearing account (Books' "refund" on a
 * credit note), for its whole gross. It is safe to run again: the credit note's refunds are read
 * first, and if Books already holds exactly this refund under the credit note's LAX reference,
 * nothing is sent (`already_refunded`). Any other refund on it (made by hand, or for another
 * amount) is refused for a person, never topped up.
 *
 * The credit note and its contact are resolved in the product's organisation through the same
 * checks as a document (the write gate, the product of each reference, a customer contact). The
 * request shape is Books' documented one; confirm it in the test organisation first.
 */
export class ZohoCreditNoteRefundGateway implements CreditNoteRefundPort {
  constructor(
    private readonly deps: GatewayDeps,
    private readonly api: ZohoApi,
  ) {}

  async refundCreditNote(
    refund: CreditNoteRefund,
    fence?: WriteFence,
  ): Promise<CreditNoteRefundOutcome> {
    if (refund.account !== "stripe_clearing" || !(refund.amountPence > 0)) {
      return { status: "rejected", reason: ZOHO_BOOKS_REJECTIONS.creditNoteRefundDiffers };
    }
    const ready = await prepareFor(this.deps, refund, [
      { kind: "contact", reference: refund.contactReference, contactType: "customer" },
      { kind: "credit_note", reference: refund.creditNoteReference },
    ]);
    if ("stop" in ready) return fromStop(ready.stop);
    const [, creditNoteId] = ready.ids as [string, string];
    const path = `${KIND_SPECS.credit_note.path}/${creditNoteId}/refunds`;
    const held = await this.api.get(ready.org.organizationId, path);
    if (!held.ok) return { status: "unknown", detail: held.error.reason };
    const refunds = refundsOf(held.value.body);
    if (refunds === null) return { status: "unknown", detail: "zoho_books_unreadable_document" };
    if (refunds.length === 1) {
      const [only] = refunds;
      if (
        only?.amountPence === refund.amountPence &&
        only.reference === refund.creditNoteReference
      ) {
        return { status: "already_refunded", rehearsal: false };
      }
    }
    if (refunds.length > 0) {
      return { status: "rejected", reason: ZOHO_BOOKS_REJECTIONS.creditNoteRefundDiffers };
    }
    const reply = await this.api.post(
      ready.org.organizationId,
      path,
      {
        date: refund.refundedOn,
        refund_mode: "Stripe",
        reference_number: refund.creditNoteReference,
        amount: penceToPounds(refund.amountPence),
        from_account_id: ready.org.payments.depositAccountId,
        description: `Refund of ${refund.creditNoteReference}`,
      },
      undefined,
      fence ? { fence } : undefined,
    );
    if (!reply.ok) return fromStop(toIssueFailure(reply.error));
    return { status: "refunded", rehearsal: false };
  }
}
