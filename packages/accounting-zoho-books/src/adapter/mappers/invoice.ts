import type { Invoice, Result } from "@auction/accounting-domain";
import { ok } from "@auction/accounting-domain";
import type { ZohoOrgConfig } from "../org-config.js";
import {
  type LineItemBody,
  type MapCode,
  type TaxConfig,
  lineItemBodies,
  referenceField,
} from "./common.js";

export interface InvoiceBody {
  readonly customer_id: string;
  readonly reference_number: string;
  readonly date: string;
  readonly due_date: string;
  readonly currency_code: "GBP";
  readonly is_inclusive_tax: false;
  readonly line_items: readonly LineItemBody[];
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
  readonly template_id?: string;
  readonly autonumbergenerationgroup_id?: string;
}

export type InvoiceConfig = Pick<
  ZohoOrgConfig,
  "lines" | "laxReferenceField" | "templateIds" | "numberSeriesIds"
> &
  TaxConfig;

/** Invoice -> Books invoice. The customer is the Books id of the contact, resolved by the caller. */
export function invoiceBody(
  invoice: Invoice,
  customerId: string,
  config: InvoiceConfig,
): Result<InvoiceBody, MapCode> {
  const lines = lineItemBodies(invoice.lines, "tax_exclusive", config);
  if (!lines.ok) return lines;
  return ok({
    customer_id: customerId,
    reference_number: invoice.reference,
    date: invoice.issuedOn,
    due_date: invoice.dueOn,
    currency_code: invoice.currency,
    is_inclusive_tax: false,
    line_items: lines.value,
    ...referenceField(config, invoice.reference),
    ...(config.templateIds.invoice ? { template_id: config.templateIds.invoice } : {}),
    ...(config.numberSeriesIds.invoice
      ? { autonumbergenerationgroup_id: config.numberSeriesIds.invoice }
      : {}),
  });
}
