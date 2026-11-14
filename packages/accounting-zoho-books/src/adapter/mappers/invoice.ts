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
  /** True for an invoice sold at VAT-inclusive prices (Shop): each line's rate is its gross. */
  readonly is_inclusive_tax: boolean;
  /** LAX's own number (Shop `LAX-INV-…`), sent with automatic numbering switched off. */
  readonly invoice_number?: string;
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

/**
 * The query an invoice is created with. An invoice LAX already numbered (Shop) switches Books'
 * automatic numbering off for that one create, so Books keeps LAX's number and continues that
 * series; Books refuses a number it already holds rather than renumbering.
 */
export function invoiceQuery(invoice: Invoice): Readonly<Record<string, string>> | undefined {
  return invoice.number ? { ignore_auto_number_generation: "true" } : undefined;
}

/** Invoice -> Books invoice. The customer is the Books id of the contact, resolved by the caller. */
export function invoiceBody(
  invoice: Invoice,
  customerId: string,
  config: InvoiceConfig,
): Result<InvoiceBody, MapCode> {
  const inclusive = invoice.amountsAre === "tax_inclusive";
  const lines = lineItemBodies(
    invoice.lines,
    inclusive ? "tax_inclusive" : "tax_exclusive",
    config,
  );
  if (!lines.ok) return lines;
  // LAX's number replaces Books' numbering series; a series is only named when Books numbers it.
  const numbering = invoice.number
    ? { invoice_number: invoice.number }
    : config.numberSeriesIds.invoice
      ? { autonumbergenerationgroup_id: config.numberSeriesIds.invoice }
      : {};
  return ok({
    customer_id: customerId,
    reference_number: invoice.reference,
    date: invoice.issuedOn,
    due_date: invoice.dueOn,
    currency_code: invoice.currency,
    is_inclusive_tax: inclusive,
    line_items: lines.value,
    ...referenceField(config, invoice.reference),
    ...(config.templateIds.invoice ? { template_id: config.templateIds.invoice } : {}),
    ...numbering,
  });
}
