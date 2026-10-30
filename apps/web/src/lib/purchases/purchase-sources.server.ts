import "server-only";
import type { AccountScope } from "@/lib/account-scope/account-scope";
import { paymentRoleFor } from "@/lib/buying/account-buying-figures";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerAccountPurchaseFacts } from "@/lib/data/http/account-buying.server";
import type { LotFulfilmentSnapshot, MyPaymentRow } from "@/lib/data/http/payments.schema";
import {
  getServerBuyerComplianceGate,
  getServerEntityPayments,
} from "@/lib/data/http/payments.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { accountPurchaseScope } from "@auction/domain";
import type { PurchasePaymentRole } from "@auction/domain";
import type { PurchaseSources } from "./purchases.vm";

/**
 * The invoices to link: the person's own, or an organisation's for the members who see its money.
 * A buyer agent has no invoice links; the organisation's payers hold them.
 */
async function invoicesFor(scope: AccountScope): Promise<MyPaymentRow[]> {
  const { account } = scope;
  if (account.kind === "personal") {
    return (await getServerDataContainer()).payments.listMine();
  }
  return accountPurchaseScope(account.actor) === "all" ? getServerEntityPayments() : [];
}

/**
 * Everything Purchases shows, for the account in use: the won lots, their invoices, and delivery
 * for the lots already paid for (only those have any). Delivery and invoices degrade to "not
 * shown" when their reads fail; the won lots are the page itself, so their failure returns `null`.
 */
export async function loadPurchaseSources(): Promise<PurchaseSources | null> {
  const container = await getServerDataContainer();
  const scope = await container.buying.scope();
  const organisation = scope.account.kind === "organisation" ? scope.account : null;
  const [rowsResult, gateResult, paymentsResult, factsResult] = await Promise.allSettled([
    container.buying.purchases(),
    getServerBuyerComplianceGate(),
    invoicesFor(scope),
    getServerAccountPurchaseFacts(organisation?.id ?? null),
  ]);
  if (rowsResult.status === "rejected") return null;
  const rows = rowsResult.value;

  const invoiceByLot: Record<string, string> = {};
  if (paymentsResult.status === "fulfilled") {
    for (const payment of paymentsResult.value) {
      if (payment.invoiceUrl) invoiceByLot[payment.lotId] = payment.invoiceUrl;
    }
  }

  const paymentRoleByLot: Record<string, PurchasePaymentRole> = {};
  for (const row of rows) paymentRoleByLot[row.lot.id] = paymentRoleFor(scope, row);

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
    // The person's own checks hold only what they pay themselves.
    complianceGate: gateResult.status === "fulfilled" ? gateResult.value : "clear",
    saleTitleById,
    paymentRoleByLot,
    payerName: organisation?.name ?? null,
    // Invoice and delivery state degrade to what the payment says when they cannot be read.
    factsByLot:
      factsResult.status === "fulfilled" && factsResult.value
        ? Object.fromEntries(factsResult.value.map((facts) => [facts.lotId, facts]))
        : {},
    showWonBy: organisation ? accountPurchaseScope(organisation.actor) === "all" : false,
  };
}
