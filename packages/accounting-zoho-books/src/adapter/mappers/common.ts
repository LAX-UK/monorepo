import {
  type AmountBasis,
  type Line,
  type Pence,
  type Result,
  STANDARD_VAT_RATE_BPS,
  lineGrossPence,
  lineNetPence,
  ok,
  refuse,
} from "@auction/accounting-domain";
import { penceToPounds } from "../money-format.js";
import type { ZohoOrgConfig } from "../org-config.js";

export type MapCode =
  | "no_tax_id"
  | "vat_on_unregistered_entity"
  | "vat_differs_from_books"
  | "mixed_basis"
  | "unresolved_invoice";

export type TaxConfig = Pick<ZohoOrgConfig, "taxIds" | "vatRegistered">;

export interface LineItemBody {
  readonly item_id: string;
  readonly account_id: string;
  readonly description: string;
  readonly quantity: 1;
  readonly rate: number;
  readonly tax_id?: string;
}

/** Half-up division of non-negative integers, in BigInt so no product loses precision. */
function halfUp(numerator: bigint, denominator: bigint): Pence {
  return Number((2n * numerator + denominator) / (2n * denominator));
}

/**
 * The VAT Books works out for one quantity-1 line, given the amount we send as its rate. Books
 * taxes per line and rounds half-up: VAT on top of a tax-exclusive rate, or the VAT share inside a
 * tax-inclusive one. Only standard-rated lines carry a non-zero rate (the configured zero, exempt
 * and margin taxes are 0%). To be confirmed in the Books test organisation (see the README).
 */
export function booksLineVat(line: Line): Pence {
  if (line.treatment !== "standard") return 0;
  const bps = BigInt(STANDARD_VAT_RATE_BPS);
  return line.basis === "tax_inclusive"
    ? halfUp(BigInt(lineGrossPence(line)) * bps, 10_000n + bps)
    : halfUp(BigInt(lineNetPence(line)) * bps, 10_000n);
}

/**
 * The tax id to send for a line, or why the line cannot be sent. An organisation that is not VAT
 * registered takes no tax at all: a line that carries VAT or claims the standard rate is refused,
 * never sent without its VAT (that would post a total LAX did not state) and never sent with it
 * (that would book VAT for a company that does not charge it). For a registered organisation the
 * VAT Books will work out must equal the VAT LAX stated, to the penny, or nothing is sent.
 */
export function lineTax(
  line: Line,
  config: TaxConfig,
): Result<{ readonly tax_id?: string }, MapCode> {
  if (!config.vatRegistered) {
    if (line.vatPence > 0 || line.treatment === "standard") {
      return refuse(
        "vat_on_unregistered_entity",
        `a ${line.treatment} line with VAT cannot go to an organisation that is not VAT registered`,
      );
    }
    return ok({});
  }
  const taxId = config.taxIds[line.treatment];
  if (taxId === null) {
    if (line.vatPence > 0) return refuse("no_tax_id", `no tax id configured for ${line.treatment}`);
    return ok({});
  }
  if (booksLineVat(line) !== line.vatPence) {
    return refuse(
      "vat_differs_from_books",
      "Books would work out a different VAT for this line than the VAT stated",
    );
  }
  return ok({ tax_id: taxId });
}

/**
 * The amount sent as a line's rate under the basis the document declares. A line whose own basis
 * differs is refused: a gross sent as a tax-exclusive rate would be taxed twice.
 */
export function lineRate(line: Line, documentBasis: AmountBasis): Result<number, MapCode> {
  if (line.basis !== documentBasis) {
    return refuse("mixed_basis", `a ${line.basis} line on a ${documentBasis} document`);
  }
  return ok(
    penceToPounds(line.basis === "tax_inclusive" ? lineGrossPence(line) : lineNetPence(line)),
  );
}

/**
 * One document line as Books takes it: quantity 1 and a two-decimal rate, so Books has nothing to
 * round except VAT. A tax-exclusive line sends its net; a tax-inclusive line (a credit) sends its
 * gross, with the VAT we stated inside it.
 */
export function lineItemBody(
  line: Line,
  documentBasis: AmountBasis,
  config: Pick<ZohoOrgConfig, "lines"> & TaxConfig,
): Result<LineItemBody, MapCode> {
  const rate = lineRate(line, documentBasis);
  if (!rate.ok) return rate;
  const tax = lineTax(line, config);
  if (!tax.ok) return tax;
  const target = config.lines[line.role];
  return ok({
    item_id: target.itemId,
    account_id: target.accountId,
    description: line.description,
    quantity: 1,
    rate: rate.value,
    ...tax.value,
  });
}

export function lineItemBodies(
  lines: readonly Line[],
  documentBasis: AmountBasis,
  config: Pick<ZohoOrgConfig, "lines"> & TaxConfig,
): Result<readonly LineItemBody[], MapCode> {
  const out: LineItemBody[] = [];
  for (const line of lines) {
    const body = lineItemBody(line, documentBasis, config);
    if (!body.ok) return body;
    out.push(body.value);
  }
  return ok(out);
}

/** The LAX reference custom field, set on every document so Books refuses a second copy. */
export function referenceField(
  config: Pick<ZohoOrgConfig, "laxReferenceField">,
  value: string,
): {
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
} {
  return {
    custom_fields: [{ customfield_id: config.laxReferenceField.fieldId, value }],
  };
}
