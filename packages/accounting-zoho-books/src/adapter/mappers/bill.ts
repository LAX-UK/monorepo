import { type Bill, type Result, ok } from "@auction/accounting-domain";
import type { ZohoOrgConfig } from "../org-config.js";
import { type MapCode, type TaxConfig, lineRate, lineTax, referenceField } from "./common.js";

export interface BillBody {
  readonly vendor_id: string;
  readonly bill_number: string;
  readonly reference_number: string;
  readonly date: string;
  readonly due_date: string;
  readonly currency_code: "GBP";
  readonly is_inclusive_tax: false;
  readonly line_items: readonly {
    readonly account_id: string;
    readonly description: string;
    readonly quantity: 1;
    readonly rate: number;
    readonly tax_id?: string;
  }[];
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
}

export type BillConfig = Pick<ZohoOrgConfig, "bills" | "laxReferenceField"> & TaxConfig;

/**
 * Bill -> Books bill, every line posted to the configured expense account. Amounts and tax go
 * through the same rules as every other document (`lineRate`, `lineTax`); a bill is tax exclusive,
 * so a tax-inclusive line is refused.
 */
export function billBody(
  bill: Bill,
  vendorId: string,
  config: BillConfig,
): Result<BillBody, MapCode> {
  const lines: BillBody["line_items"][number][] = [];
  for (const line of bill.lines) {
    const rate = lineRate(line, "tax_exclusive");
    if (!rate.ok) return rate;
    const tax = lineTax(line, config);
    if (!tax.ok) return tax;
    lines.push({
      account_id: config.bills.accountId,
      description: line.description,
      quantity: 1,
      rate: rate.value,
      ...tax.value,
    });
  }
  return ok({
    vendor_id: vendorId,
    bill_number: bill.reference,
    reference_number: bill.reference,
    date: bill.issuedOn,
    due_date: bill.dueOn,
    currency_code: bill.currency,
    is_inclusive_tax: false,
    line_items: lines,
    ...referenceField(config, bill.reference),
  });
}
