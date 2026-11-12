import type { DocumentKind, ProviderDocument, Totals } from "@auction/accounting-domain";
import { poundsToPence } from "./money-format.js";

/**
 * Where each kind of document lives in Books and how to read it back. One row per kind: a new
 * kind adds a row, and no code that reads a document changes (open/closed).
 */
export interface KindSpec {
  /** Collection path under the API base. */
  readonly path: string;
  /** Key of the list in a list reply, and of the document in a detail reply. */
  readonly listKey: string;
  readonly itemKey: string;
  readonly idField: string;
  /** The human document number; contacts have none, so their id stands in. */
  readonly numberField: string | null;
  readonly readTotals: (item: Readonly<Record<string, unknown>>) => Totals | null;
  /** Documents Books renders a PDF for; the reference is the document path, fetched with `?accept=pdf`. */
  readonly hasPdf: boolean;
}

const NO_MONEY: Totals = { netPence: 0, vatPence: 0, grossPence: 0 };

/** Sub total, tax and total as Books reports them; net is read as sub total. */
function exclusiveTotals(item: Readonly<Record<string, unknown>>): Totals | null {
  const net = poundsToPence(item.sub_total);
  const vat = poundsToPence(item.tax_total);
  const gross = poundsToPence(item.total);
  return net === null || vat === null || gross === null
    ? null
    : { netPence: net, vatPence: vat, grossPence: gross };
}

/**
 * A tax-inclusive document (credit notes): Books' sub total can include the tax, so net is the
 * total less the tax, the same split the domain makes of a credit line.
 */
function inclusiveTotals(item: Readonly<Record<string, unknown>>): Totals | null {
  const vat = poundsToPence(item.tax_total);
  const gross = poundsToPence(item.total);
  return vat === null || gross === null
    ? null
    : { netPence: gross - vat, vatPence: vat, grossPence: gross };
}

function paymentTotals(item: Readonly<Record<string, unknown>>): Totals | null {
  const amount = poundsToPence(item.amount);
  return amount === null ? null : { netPence: amount, vatPence: 0, grossPence: amount };
}

export const KIND_SPECS: Readonly<Record<DocumentKind, KindSpec>> = {
  invoice: {
    path: "/invoices",
    listKey: "invoices",
    itemKey: "invoice",
    idField: "invoice_id",
    numberField: "invoice_number",
    readTotals: exclusiveTotals,
    hasPdf: true,
  },
  credit_note: {
    path: "/creditnotes",
    listKey: "creditnotes",
    itemKey: "creditnote",
    idField: "creditnote_id",
    numberField: "creditnote_number",
    readTotals: inclusiveTotals,
    hasPdf: true,
  },
  payment: {
    path: "/customerpayments",
    listKey: "customerpayments",
    itemKey: "payment",
    idField: "payment_id",
    numberField: "payment_number",
    readTotals: paymentTotals,
    hasPdf: false,
  },
  bill: {
    path: "/bills",
    listKey: "bills",
    itemKey: "bill",
    idField: "bill_id",
    numberField: "bill_number",
    readTotals: exclusiveTotals,
    hasPdf: false,
  },
  contact: {
    path: "/contacts",
    listKey: "contacts",
    itemKey: "contact",
    idField: "contact_id",
    numberField: null,
    readTotals: () => NO_MONEY,
    hasPdf: false,
  },
};

const PROVIDER_ID = /^[0-9]{1,32}$/;

export function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

/** The LAX reference Books holds on a document, from its custom field hash. */
export function storedReference(
  item: Readonly<Record<string, unknown>>,
  apiName: string,
): string | null {
  const hash = asRecord(item.custom_field_hash);
  const value = hash?.[apiName];
  return typeof value === "string" ? value : null;
}

/**
 * Read a document as Books reported it. Null when the reply is not shaped as expected (a missing
 * id or number, an amount that is not whole pence): the caller must then treat the outcome as
 * unknown, never as a clean success.
 */
export function readProviderDocument(spec: KindSpec, item: unknown): ProviderDocument | null {
  const doc = asRecord(item);
  if (!doc) return null;
  const id = doc[spec.idField];
  if (typeof id !== "string" || !PROVIDER_ID.test(id)) return null;
  const rawNumber = spec.numberField === null ? id : doc[spec.numberField];
  if (typeof rawNumber !== "string" || rawNumber.trim() === "") return null;
  const totals = spec.readTotals(doc);
  if (!totals) return null;
  return {
    number: rawNumber,
    providerId: id,
    pdfRef: spec.hasPdf ? `${spec.path}/${id}` : null,
    totals,
  };
}
