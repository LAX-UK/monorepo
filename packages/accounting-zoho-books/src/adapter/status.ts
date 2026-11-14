import {
  type AccountingDocument,
  type BooksPaymentSeen,
  type BooksState,
  type DocumentStatusPort,
  type IssuedDocument,
  type StatusReadOutcome,
  isStatusCheckedKind,
} from "@auction/accounting-domain";
import { type ZohoApi, orgFor } from "./api.js";
import { KIND_SPECS, asRecord, storedReference } from "./kinds.js";
import { poundsToPence } from "./money-format.js";
import type { ZohoOrgConfigs } from "./org-config.js";

/** Books' own words for an invoice's state, in LAX's. Anything else is `other`, never guessed. */
const INVOICE_STATES: Readonly<Record<string, BooksState>> = {
  draft: "draft",
  sent: "open",
  viewed: "open",
  unpaid: "open",
  overdue: "overdue",
  partially_paid: "partially_paid",
  paid: "paid",
  void: "void",
};
const CREDIT_NOTE_STATES: Readonly<Record<string, BooksState>> = {
  draft: "draft",
  open: "open",
  closed: "closed",
  void: "void",
};

const BOOKS_ID = /^[0-9]{1,32}$/;

function readPayments(item: Readonly<Record<string, unknown>>): BooksPaymentSeen[] | null {
  const rows = item.payments;
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) return null;
  const payments: BooksPaymentSeen[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    const id = row?.payment_id;
    const amount = poundsToPence(row?.amount);
    if (typeof id !== "string" || !BOOKS_ID.test(id) || amount === null) return null;
    payments.push({
      providerPaymentId: id,
      amountPence: amount,
      date: typeof row?.date === "string" ? row.date : null,
      mode: typeof row?.payment_mode === "string" ? row.payment_mode.slice(0, 60) : null,
    });
  }
  return payments;
}

/**
 * Reads an issued document's state back from Books by its Books id: one GET, never a write. It
 * believes the read only when the document carries the LAX reference it was sent with, so a
 * mistyped id can never report someone else's document. A spent budget is `budget_spent` (the
 * check stops for the night); anything unclear is `unavailable`, and nothing is recorded for it.
 */
export class ZohoDocumentStatusReader implements DocumentStatusPort {
  constructor(
    private readonly api: Pick<ZohoApi, "get">,
    private readonly orgs: ZohoOrgConfigs,
  ) {}

  async readStatus(
    document: AccountingDocument,
    issued: IssuedDocument,
  ): Promise<StatusReadOutcome> {
    if (!isStatusCheckedKind(document.kind)) {
      return { status: "unavailable", reason: "zoho_books_status_not_checked_for_kind" };
    }
    if (!BOOKS_ID.test(issued.providerId)) {
      return { status: "unavailable", reason: "zoho_books_bad_provider_id" };
    }
    const choice = orgFor(this.orgs, document);
    if (!choice.ok) return { status: "unavailable", reason: choice.reason };
    const spec = KIND_SPECS[document.kind];
    const detail = await this.api.get(
      choice.org.organizationId,
      `${spec.path}/${issued.providerId}`,
    );
    if (!detail.ok) {
      if (detail.error.kind === "budget_exhausted") return { status: "budget_spent" };
      if (detail.error.kind === "not_found") return { status: "not_found" };
      return { status: "unavailable", reason: detail.error.reason };
    }
    const item = asRecord(asRecord(detail.value.body)?.[spec.itemKey]);
    if (!item) return { status: "unavailable", reason: "zoho_books_unreadable_document" };
    if (storedReference(item, choice.org.laxReferenceField.apiName) !== document.reference) {
      return { status: "unavailable", reason: "zoho_books_reference_not_confirmed" };
    }

    if (document.kind === "payment") {
      return { status: "read", reading: { state: "recorded", balancePence: null, payments: [] } };
    }
    const states = document.kind === "invoice" ? INVOICE_STATES : CREDIT_NOTE_STATES;
    const raw = typeof item.status === "string" ? item.status.toLowerCase() : "";
    const state = states[raw] ?? "other";
    if (document.kind === "credit_note") {
      return { status: "read", reading: { state, balancePence: null, payments: [] } };
    }
    const payments = readPayments(item);
    if (!payments) return { status: "unavailable", reason: "zoho_books_unreadable_payments" };
    return {
      status: "read",
      reading: { state, balancePence: poundsToPence(item.balance), payments },
    };
  }
}
