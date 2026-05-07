import type { BillToContext } from "@auction/types";
import { InvoiceAddress } from "xero-node";

/** Maps resolver output to Xero `InvoiceAddress` (bill-to / TO). */
export function billToContextToXeroInvoiceToAddress(ctx: BillToContext): InvoiceAddress {
  const a = new InvoiceAddress();
  a.invoiceAddressType = InvoiceAddress.InvoiceAddressTypeEnum.TO;
  const lines = ctx.addressLines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    a.addressLine1 = ctx.billToName.trim() || "—";
    return a;
  }
  const [l0 = "", l1 = "", l2 = "", l3 = ""] = lines;
  a.addressLine1 = l0.slice(0, 500);
  if (l1) a.addressLine2 = l1.slice(0, 500);
  if (l2) a.addressLine3 = l2.slice(0, 500);
  if (l3) a.addressLine4 = l3.slice(0, 500);
  return a;
}
