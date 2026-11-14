import { isDeepStrictEqual } from "node:util";
import {
  type AccountingDocument,
  DOCUMENT_KINDS,
  type DocumentKind,
  type Expense,
  type Line,
  type LineInput,
  PRODUCTS,
  type Product,
  type Result,
  buildExpense,
  buildInclusiveLine,
  buildLine,
  buildTransfer,
  expectedTotals,
  isInvoiceNumber,
  isPence,
  isValidIsoDate,
  legalEntityFor,
  ok,
  parseLaxReference,
  refuse,
  totalsOf,
} from "@auction/accounting-domain";

type Bad = Result<never, "bad_document">;
const bad = (why: string): Bad => refuse("bad_document", why);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lines are rebuilt through the domain's constructors. An invoice or bill line is tax-exclusive:
 * the stored VAT must be what `buildLine` computes. A credit line is tax-inclusive (the domain
 * allocates its VAT cumulatively across a split line, so it cannot be recomputed from the line
 * alone): it is rebuilt with `buildInclusiveLine` from its gross and stored VAT, which checks the
 * VAT is whole pence between 0 and the gross and only on a standard rated line.
 */
function readLines(value: unknown, inclusive: boolean): Result<readonly Line[], "bad_document"> {
  if (!Array.isArray(value) || value.length === 0) return bad("a priced document needs lines");
  const lines: Line[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return bad("line is not an object");
    if (raw.basis !== (inclusive ? "tax_inclusive" : "tax_exclusive")) {
      return bad("a line's amounts are not on the basis its document uses");
    }
    if (inclusive) {
      const { quantity, unitNetPence, vatPence } = raw;
      if (quantity !== 1 || !isPence(unitNetPence) || !isPence(vatPence)) {
        return bad("a credit line is one quantity of whole pence");
      }
      const built = buildInclusiveLine({
        ...(raw as unknown as Omit<LineInput, "quantity" | "unitNetPence">),
        grossPence: unitNetPence + vatPence,
        vatPence,
      });
      if (!built.ok) return bad(built.refusal.message);
      lines.push(built.value);
      continue;
    }
    const built = buildLine(raw as unknown as LineInput);
    if (!built.ok) return bad(built.refusal.message);
    if (built.value.vatPence !== raw.vatPence) return bad("a line's VAT differs from the rule");
    lines.push(built.value);
  }
  return ok(lines);
}

function sameTotals(a: unknown, b: ReturnType<typeof expectedTotals>): boolean {
  return (
    isRecord(a) &&
    a.netPence === b.netPence &&
    a.vatPence === b.vatPence &&
    a.grossPence === b.grossPence
  );
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Read a stored (or about-to-be-stored) document back through the domain's rules: the reference
 * must be the one the domain derives for this product and kind, the legal entity the one the
 * product trades under, every line is rebuilt with the domain's VAT, and the totals are their
 * exact sum. Anything else is refused, never trusted.
 */
export function readDocumentPayload(
  value: unknown,
  expected: { readonly product: Product; readonly kind: DocumentKind; readonly reference: string },
): Result<AccountingDocument, "bad_document"> {
  if (!isRecord(value)) return bad("payload is not an object");
  const { product, kind, reference } = expected;
  if (!PRODUCTS.includes(product) || !DOCUMENT_KINDS.includes(kind)) return bad("unknown product");
  if (value.product !== product || value.kind !== kind || value.reference !== reference) {
    return bad("payload does not describe this reference");
  }
  const parts = parseLaxReference(reference);
  if (!parts.ok || parts.value.product !== product || parts.value.kind !== kind) {
    return bad("not the reference for this product and kind");
  }
  if (value.entity !== legalEntityFor(product)) return bad("wrong legal entity for the product");
  if (kind === "expense" || kind === "transfer") return readMovement(value, kind);
  if (!text(value.contactReference) && kind !== "contact") return bad("missing contact");

  if (kind === "contact") {
    const named = text(value.name) && value.name === value.name.trim();
    const emailOk = value.email === null || typeof value.email === "string";
    return named && emailOk ? ok(value as unknown as AccountingDocument) : bad("bad contact");
  }
  if (kind === "payment") {
    const allocations = value.allocations;
    if (!isPence(value.amountPence) || !isPence(value.unallocatedPence)) return bad("bad amount");
    if (!isValidIsoDate(value.receivedOn as string) || !Array.isArray(allocations)) {
      return bad("bad payment");
    }
    let allocated = 0;
    for (const entry of allocations) {
      if (!isRecord(entry) || !text(entry.invoiceReference) || !isPence(entry.amountPence)) {
        return bad("bad allocation");
      }
      allocated += entry.amountPence;
    }
    if (allocated + value.unallocatedPence !== value.amountPence) {
      return bad("allocations and the unallocated rest must add up to the payment");
    }
    return ok(value as unknown as AccountingDocument);
  }

  const dates = [value.issuedOn, ...(kind === "credit_note" ? [] : [value.dueOn])];
  if (!dates.every((d) => typeof d === "string" && isValidIsoDate(d))) return bad("bad date");
  if (kind === "credit_note" && !text(value.invoiceReference)) return bad("missing invoice");
  if (kind === "credit_note" && value.amountsAre !== "tax_inclusive") {
    return bad("a credit note's amounts are tax-inclusive");
  }
  // A credit note is always VAT-inclusive; an invoice is when LAX numbered it at inclusive prices
  // (Shop), and then it must carry LAX's number. Nothing else may claim either.
  const inclusiveInvoice = kind === "invoice" && value.amountsAre === "tax_inclusive";
  if (kind === "invoice" && value.amountsAre !== undefined && !inclusiveInvoice) {
    return bad("an invoice's amounts are tax-exclusive or tax-inclusive");
  }
  if (kind === "invoice" && (value.number !== undefined) !== inclusiveInvoice) {
    return bad("an invoice LAX numbers is VAT-inclusive, and only that one carries a number");
  }
  if (inclusiveInvoice && !isInvoiceNumber(value.number)) return bad("bad invoice number");
  if (kind === "bill" && (value.amountsAre !== undefined || value.number !== undefined)) {
    return bad("a bill is tax-exclusive and numbered by the provider");
  }
  const lines = readLines(value.lines, kind === "credit_note" || inclusiveInvoice);
  if (!lines.ok) return lines;
  const document = { ...value, lines: lines.value } as unknown as AccountingDocument;
  if (!sameTotals(value.totals, totalsOf(lines.value)))
    return bad("totals are not the sum of the lines");
  return ok(document);
}

/**
 * An expense (Stripe's fees) or a transfer (a Stripe payout): rebuilt through the domain's own
 * builder from what is stored, and refused unless the rebuild is exactly the stored document. No
 * contact, no lines, no VAT.
 */
function readMovement(
  value: Record<string, unknown>,
  kind: "expense" | "transfer",
): Result<AccountingDocument, "bad_document"> {
  const parts = parseLaxReference(value.reference as string);
  if (!parts.ok) return bad("not a LAX reference");
  const common = { product: value.product as Product, sourceId: parts.value.sourceId };
  const rebuilt =
    kind === "expense"
      ? buildExpense({
          ...common,
          category: value.category as Expense["category"],
          spentOn: value.spentOn as string,
          amountPence: value.amountPence as number,
          description: value.description as string,
        })
      : buildTransfer({
          ...common,
          transferredOn: value.transferredOn as string,
          amountPence: value.amountPence as number,
          description: value.description as string,
        });
  if (!rebuilt.ok) return bad(rebuilt.refusal.message);
  return isDeepStrictEqual(JSON.parse(JSON.stringify(rebuilt.value)), value)
    ? ok(rebuilt.value)
    : bad("an expense or transfer must be exactly what its builder makes");
}

/** The totals columns for a document: what the provider must report back. */
export function documentTotals(document: AccountingDocument) {
  return expectedTotals(document);
}
