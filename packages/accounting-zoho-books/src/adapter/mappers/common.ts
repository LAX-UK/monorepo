import {
  type Line,
  type Result,
  lineGrossPence,
  lineNetPence,
  ok,
  refuse,
} from "@auction/accounting-domain";
import { penceToPounds } from "../money-format.js";
import type { ZohoOrgConfig } from "../org-config.js";

export type MapCode = "no_tax_id";

export interface LineItemBody {
  readonly item_id: string;
  readonly account_id: string;
  readonly description: string;
  readonly quantity: 1;
  readonly rate: number;
  readonly tax_id?: string;
}

/**
 * One document line as Books takes it: quantity 1 and a two-decimal rate, so Books has nothing to
 * round except VAT. A tax-exclusive line sends its net; a tax-inclusive line (a credit) sends its
 * gross, with the VAT we stated inside it. A line that carries VAT needs a tax id for its treatment.
 */
export function lineItemBody(
  line: Line,
  config: Pick<ZohoOrgConfig, "lines" | "taxIds">,
): Result<LineItemBody, MapCode> {
  const taxId = config.taxIds[line.treatment];
  if (taxId === null && line.vatPence > 0) {
    return refuse("no_tax_id", `no tax id configured for ${line.treatment}`);
  }
  const target = config.lines[line.role];
  const amount = line.basis === "tax_inclusive" ? lineGrossPence(line) : lineNetPence(line);
  return ok({
    item_id: target.itemId,
    account_id: target.accountId,
    description: line.description,
    quantity: 1,
    rate: penceToPounds(amount),
    ...(taxId === null ? {} : { tax_id: taxId }),
  });
}

export function lineItemBodies(
  lines: readonly Line[],
  config: Pick<ZohoOrgConfig, "lines" | "taxIds">,
): Result<readonly LineItemBody[], MapCode> {
  const out: LineItemBody[] = [];
  for (const line of lines) {
    const body = lineItemBody(line, config);
    if (!body.ok) return body;
    out.push(body.value);
  }
  return ok(out);
}

/** The LAX reference custom field, set on every document so Books refuses a second copy. */
export function referenceField(
  config: Pick<ZohoOrgConfig, "laxReferenceField">,
  reference: string,
): {
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
} {
  return {
    custom_fields: [{ customfield_id: config.laxReferenceField.fieldId, value: reference }],
  };
}
