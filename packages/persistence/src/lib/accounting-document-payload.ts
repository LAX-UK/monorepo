import {
  type AccountingDocument,
  DOCUMENT_KINDS,
  type DocumentKind,
  type Line,
  type LineInput,
  PRODUCTS,
  type Product,
  type Result,
  buildLine,
  expectedTotals,
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

/** Lines are rebuilt through the domain's `buildLine`, and the stored VAT must be what it computes. */
function readLines(value: unknown): Result<readonly Line[], "bad_document"> {
  if (!Array.isArray(value) || value.length === 0) return bad("a priced document needs lines");
  const lines: Line[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return bad("line is not an object");
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
  const lines = readLines(value.lines);
  if (!lines.ok) return lines;
  const document = { ...value, lines: lines.value } as unknown as AccountingDocument;
  if (!sameTotals(value.totals, totalsOf(lines.value)))
    return bad("totals are not the sum of the lines");
  return ok(document);
}

/** The totals columns for a document: what the provider must report back. */
export function documentTotals(document: AccountingDocument) {
  return expectedTotals(document);
}
