import "server-only";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.schema";
import { getServerBuyerComplianceGate } from "@/lib/data/http/payments.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import type { PurchaseSources } from "./purchases.vm";

/**
 * Everything Purchases shows, read through the existing buyer endpoints: the won lots, their
 * invoices, and delivery for the lots already paid for (only those have any). Delivery and
 * invoices degrade to "not shown" when their reads fail; the won lots are the page itself, so
 * their failure returns `null`.
 */
export async function loadPurchaseSources(): Promise<PurchaseSources | null> {
  const container = await getServerDataContainer();
  const [rowsResult, gateResult, paymentsResult] = await Promise.allSettled([
    container.portfolio.listMine(),
    getServerBuyerComplianceGate(),
    container.payments.listMine(),
  ]);
  if (rowsResult.status === "rejected") return null;
  const rows = rowsResult.value;

  const invoiceByLot: Record<string, string> = {};
  if (paymentsResult.status === "fulfilled") {
    for (const payment of paymentsResult.value) {
      if (payment.invoiceUrl) invoiceByLot[payment.lotId] = payment.invoiceUrl;
    }
  }

  const paidLotIds = rows
    .filter((row) => row.payment?.status === "captured")
    .map((row) => row.lot.id);
  const [fulfilments, saleTitleById] = await Promise.all([
    Promise.allSettled(paidLotIds.map((id) => container.payments.getLotFulfilmentForWinner(id))),
    resolveSaleTitles(rows.map((row) => row.lot.saleId)),
  ]);
  const fulfilmentByLot: Record<string, LotFulfilmentSnapshot> = {};
  for (const result of fulfilments) {
    if (result.status === "fulfilled" && result.value) {
      fulfilmentByLot[result.value.lotId] = result.value;
    }
  }

  return {
    rows,
    invoiceByLot,
    fulfilmentByLot,
    complianceGate: gateResult.status === "fulfilled" ? gateResult.value : "clear",
    saleTitleById,
  };
}
