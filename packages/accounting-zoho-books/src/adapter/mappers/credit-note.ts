import type { CreditNote, Result } from "@auction/accounting-domain";
import { ok } from "@auction/accounting-domain";
import type { ZohoOrgConfig } from "../org-config.js";
import { type LineItemBody, type MapCode, lineItemBodies, referenceField } from "./common.js";

export interface CreditNoteBody {
  readonly customer_id: string;
  readonly reference_number: string;
  readonly date: string;
  readonly currency_code: "GBP";
  readonly is_inclusive_tax: true;
  readonly line_items: readonly LineItemBody[];
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
  readonly template_id?: string;
  readonly autonumbergenerationgroup_id?: string;
}

export type CreditNoteConfig = Pick<
  ZohoOrgConfig,
  "lines" | "taxIds" | "laxReferenceField" | "templateIds" | "numberSeriesIds"
>;

/**
 * Credit note -> Books credit note. Every line is tax inclusive: the gross is sent as the rate
 * with the tax id of the line's treatment. The invoice it credits goes in the query (see the
 * gateway), not the body.
 */
export function creditNoteBody(
  creditNote: CreditNote,
  customerId: string,
  config: CreditNoteConfig,
): Result<CreditNoteBody, MapCode> {
  const lines = lineItemBodies(creditNote.lines, config);
  if (!lines.ok) return lines;
  return ok({
    customer_id: customerId,
    reference_number: creditNote.reference,
    date: creditNote.issuedOn,
    currency_code: creditNote.currency,
    is_inclusive_tax: true,
    line_items: lines.value,
    ...referenceField(config, creditNote.reference),
    ...(config.templateIds.creditNote ? { template_id: config.templateIds.creditNote } : {}),
    ...(config.numberSeriesIds.creditNote
      ? { autonumbergenerationgroup_id: config.numberSeriesIds.creditNote }
      : {}),
  });
}
