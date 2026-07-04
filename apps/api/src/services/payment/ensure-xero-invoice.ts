import type { IUserRepository } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import type { IInvoiceAccountingProvider } from "../interfaces/invoice-accounting.js";

export async function ensureXeroInvoiceForPayment(
  accounting: IInvoiceAccountingProvider,
  users: IUserRepository,
  paymentId: string,
  lot: Lot,
  buyerId: string,
  amount: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!accounting.isConfigured()) return { ok: true };
  const buyer = await users.findById(buyerId);
  if (!buyer?.email) {
    return { ok: false, error: "Buyer email is required for accounting invoice" };
  }
  return accounting.ensureInvoiceForPayment({
    paymentId,
    lot,
    buyerEmail: buyer.email,
    buyerName: buyer.name,
    amount,
    buyerLegalEntityId: lot.buyerLegalEntityId ?? undefined,
  });
}
