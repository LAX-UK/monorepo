import type {
  PaymentRemainderPort,
  RemainderApplication,
  RemainderOutcome,
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

function fromStop(stop: Stop): RemainderOutcome {
  return stop.status === "rejected"
    ? { status: "rejected", reason: stop.reason }
    : { status: "unknown", ...(stop.detail ? { detail: stop.detail } : {}) };
}

/** What the payment Books holds has applied to one invoice, in pence; null when unreadable. */
function appliedTo(payment: Readonly<Record<string, unknown>>, invoiceId: string): number | null {
  if (!Array.isArray(payment.invoices)) return null;
  let total = 0;
  for (const raw of payment.invoices) {
    const row = asRecord(raw);
    const amount = poundsToPence(row?.amount_applied);
    if (typeof row?.invoice_id !== "string" || amount === null) return null;
    if (row.invoice_id === invoiceId) total += amount;
  }
  return total;
}

/**
 * Applies a customer payment's unapplied rest to an invoice issued after it (a Shop delivery
 * outside the UK, released once the accountant answered): Books' "apply credits" on the invoice,
 * with the payment as the credit. It is safe to run again: the payment is read first, and if it
 * already applies exactly this amount to the invoice nothing is sent (`already_applied`).
 *
 * Every reference is resolved in the organisation chosen for the product (London Art Exchange for
 * the Shop), through the same checks as a document: the write gate, the product of each reference,
 * a customer contact. The payment must be that customer's, hold at least the amount unapplied, and
 * not already apply some other amount to the invoice; otherwise it is refused for a person.
 * The request shape is Books' documented one; confirm it in the test organisation first.
 */
export class ZohoPaymentRemainderGateway implements PaymentRemainderPort {
  constructor(
    private readonly deps: GatewayDeps,
    private readonly api: ZohoApi,
  ) {}

  async applyRemainder(
    application: RemainderApplication,
    fence?: WriteFence,
  ): Promise<RemainderOutcome> {
    const ready = await prepareFor(this.deps, application, [
      { kind: "contact", reference: application.contactReference, contactType: "customer" },
      { kind: "payment", reference: application.paymentReference },
      { kind: "invoice", reference: application.invoiceReference },
    ]);
    if ("stop" in ready) return fromStop(ready.stop);
    const [customerId, paymentId, invoiceId] = ready.ids as [string, string, string];
    const spec = KIND_SPECS.payment;
    const detail = await this.api.get(ready.org.organizationId, `${spec.path}/${paymentId}`);
    if (!detail.ok) return { status: "unknown", detail: detail.error.reason };
    const payment = asRecord(asRecord(detail.value.body)?.[spec.itemKey]);
    const applied = payment ? appliedTo(payment, invoiceId) : null;
    const unused = poundsToPence(payment?.unused_amount);
    if (!payment || applied === null || unused === null) {
      return { status: "unknown", detail: "zoho_books_unreadable_document" };
    }
    if (payment.customer_id !== customerId) {
      return { status: "rejected", reason: ZOHO_BOOKS_REJECTIONS.paymentMismatch };
    }
    if (applied === application.amountPence) return { status: "already_applied", rehearsal: false };
    if (applied !== 0) {
      return { status: "rejected", reason: ZOHO_BOOKS_REJECTIONS.remainderDiffers };
    }
    if (unused < application.amountPence) {
      return { status: "rejected", reason: ZOHO_BOOKS_REJECTIONS.remainderUnavailable };
    }
    const reply = await this.api.post(
      ready.org.organizationId,
      `${KIND_SPECS.invoice.path}/${invoiceId}/credits`,
      {
        invoice_payments: [
          { payment_id: paymentId, amount_applied: penceToPounds(application.amountPence) },
        ],
      },
      undefined,
      fence ? { fence } : undefined,
    );
    if (!reply.ok) return fromStop(toIssueFailure(reply.error));
    return { status: "applied", rehearsal: false };
  }
}
