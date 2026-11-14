import type {
  AccountingDocument,
  DocumentKind,
  DocumentLookupPort,
  LookupOutcome,
} from "@auction/accounting-domain";
import { orgFor } from "./api.js";
import {
  type ReadBack,
  contactTypeCheck,
  invoiceNumberCheck,
  movementReadBack,
  paymentReadBack,
} from "./gateways.js";
import type { ZohoDocumentLookup } from "./lookup.js";
import { contactReferenceValue } from "./mappers/contact.js";
import type { ZohoOrgConfig, ZohoOrgConfigs } from "./org-config.js";
import { ZOHO_BOOKS_REJECTIONS } from "./rejections.js";

type ReadBackFor = (
  lookup: ZohoDocumentLookup,
  document: AccountingDocument,
  org: ZohoOrgConfig,
) => Promise<ReadBack>;

const TOTALS_ONLY: ReadBackFor = () => Promise.resolve({ check: null });

/**
 * The check each kind is read back with: the same one its send makes. One row per kind. Contacts
 * the sender sends are customers (a vendor contact arrives with the payouts flow).
 */
const READ_BACKS: Readonly<Record<DocumentKind, ReadBackFor>> = {
  // An invoice LAX numbered must still carry that number; one Books numbers is read by totals.
  invoice: (_lookup, document) =>
    Promise.resolve({
      check: document.kind === "invoice" ? invoiceNumberCheck(document) : null,
    }),
  credit_note: TOTALS_ONLY,
  bill: TOTALS_ONLY,
  payment: (lookup, document, org) =>
    document.kind === "payment"
      ? paymentReadBack(lookup, document, org)
      : Promise.resolve({ stop: { status: "rejected", reason: "zoho_books_bad_reference" } }),
  contact: () => Promise.resolve({ check: contactTypeCheck("customer") }),
  expense: (_lookup, document, org) => Promise.resolve(movementOf(document, org)),
  transfer: (_lookup, document, org) => Promise.resolve(movementOf(document, org)),
};

function movementOf(document: AccountingDocument, org: ZohoOrgConfig): ReadBack {
  return document.kind === "expense" || document.kind === "transfer"
    ? movementReadBack(document, org)
    : { stop: { status: "rejected", reason: "zoho_books_bad_reference" } };
}

/**
 * The lookup the life cycle runs before any retry. It finds the document by its LAX reference in
 * the organisation `orgFor` chooses, then reads what Books holds back against the document with
 * the check a send makes, so a document that is not ours as sent is `differs` (a person decides),
 * whether or not the answer to the send ever reached us. A document that cannot be checked (one
 * of its dependencies is missing, or its request cannot be built) is `differs` too, never `found`;
 * a check that could not be made now (Books did not answer) is `unavailable`.
 */
export class ZohoReadBackLookup implements DocumentLookupPort {
  constructor(
    private readonly lookup: ZohoDocumentLookup,
    private readonly orgs: ZohoOrgConfigs,
  ) {}

  async findDocument(document: AccountingDocument): Promise<LookupOutcome> {
    const choice = orgFor(this.orgs, document);
    if (!choice.ok) return { status: "unavailable", reason: choice.reason };
    const { product, kind, reference } = document;
    const stored = kind === "contact" ? contactReferenceValue(reference, "customer") : reference;
    const found = await this.lookup.findIn(choice.org, product, kind, reference, stored);
    if (found.outcome.status !== "found") return found.outcome;
    const { status: _found, ...held } = found.outcome;
    const readBack = await READ_BACKS[kind](this.lookup, document, choice.org);
    if ("stop" in readBack) {
      const { stop } = readBack;
      return stop.status === "unknown"
        ? {
            status: "unavailable",
            reason: stop.detail ?? ZOHO_BOOKS_REJECTIONS.readBackUnconfirmed,
          }
        : {
            status: "differs",
            reason: `${ZOHO_BOOKS_REJECTIONS.readBackUnconfirmed}: ${stop.reason}`,
            ...held,
          };
    }
    const mismatch = readBack.check?.(found.item ?? {}) ?? null;
    return mismatch ? { status: "differs", reason: mismatch, ...held } : found.outcome;
  }
}
