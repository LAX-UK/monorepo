import { type Bill, type Result, ok, refuse } from "@auction/accounting-domain";
import { penceToPounds } from "../money-format.js";
import type { ZohoOrgConfig } from "../org-config.js";
import { type MapCode, referenceField } from "./common.js";

export interface BillBody {
  readonly vendor_id: string;
  readonly bill_number: string;
  readonly reference_number: string;
  readonly date: string;
  readonly due_date: string;
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

export type BillConfig = Pick<ZohoOrgConfig, "bills" | "taxIds" | "laxReferenceField">;

/** Bill -> Books bill, every line posted to the configured expense account. */
export function billBody(
  bill: Bill,
  vendorId: string,
  config: BillConfig,
): Result<BillBody, MapCode> {
  const lines: BillBody["line_items"][number][] = [];
  for (const line of bill.lines) {
    const taxId = config.taxIds[line.treatment];
    if (taxId === null && line.vatPence > 0) {
      return refuse("no_tax_id", `no tax id configured for ${line.treatment}`);
    }
    lines.push({
      account_id: config.bills.accountId,
      description: line.description,
      quantity: 1,
      rate: penceToPounds(line.quantity * line.unitNetPence),
      ...(taxId === null ? {} : { tax_id: taxId }),
    });
  }
  return ok({
    vendor_id: vendorId,
    bill_number: bill.reference,
    reference_number: bill.reference,
    date: bill.issuedOn,
    due_date: bill.dueOn,
    is_inclusive_tax: false,
    line_items: lines,
    ...referenceField(config, bill.reference),
  });
}
