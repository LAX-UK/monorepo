import "server-only";
import type { AccountScope } from "@/lib/account-scope/account-scope";
import { paymentRoleFor } from "@/lib/buying/account-buying-figures";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerAccountPurchaseFacts } from "@/lib/data/http/account-buying.server";
import type { LotFulfilmentSnapshot, MyPaymentRow } from "@/lib/data/http/payments.schema";
import { getServerEntityPayments } from "@/lib/data/http/payments.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { accountPurchaseScope } from "@auction/domain";
import type { PurchasePaymentRole } from "@auction/domain";
import { purchaseInvoiceHref } from "./purchase-invoice";
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
 * Everything Purchases shows, for the account in use: the won lots, what is owed on them, their invoices, and delivery
 * for the lots already paid for (only those have any). Delivery and invoices degrade to "not
 * shown" when their reads fail; the won lots are the page itself, so their failure returns `null`.
 */
export async function loadPurchaseSources(): Promise<PurchaseSources | null> {
  const container = await getServerDataContainer();
  const scope = await container.buying.scope();
  const organisation = scope.account.kind === "organisation" ? scope.account : null;
  const [rowsResult, owedResult, paymentsResult, factsResult] = await Promise.allSettled([
    container.buying.purchases(),
    container.buying.amountsOwed(),
    invoicesFor(scope),
    organisation ? getServerAccountPurchaseFacts(organisation.id) : Promise.resolve(null),
  ]);
  // The won lots and what is owed on them are the page itself: without either, it says so
  // rather than showing a figure that could disagree with the rest of the site.
  if (rowsResult.status === "rejected" || owedResult.status === "rejected") return null;
  const rows = rowsResult.value;
  const owedByLot = Object.fromEntries(
    owedResult.value.entries.map((entry) => [entry.lotId, entry]),
  );

  const invoiceByLot: Record<string, string> = {};
  if (paymentsResult.status === "fulfilled") {
    // Our own PDF, from the stored invoice. Only the members who pay have the payments, so only
    // they get the link; the API refuses everyone else again.
    for (const payment of paymentsResult.value) {
      invoiceByLot[payment.lotId] = purchaseInvoiceHref(payment.lotId);
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
    owedByLot,
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
