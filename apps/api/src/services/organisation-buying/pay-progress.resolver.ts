import { payProgressOf } from "@auction/domain";
import type { LivePaymentGroupFacts } from "@auction/persistence/interfaces";
import type { PayPlanProgress, PayPlanProgressLot } from "@auction/types";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import type { IPaymentGroupGateway } from "../payment-group/payment-group-ports.js";
import type { PurchaseEntry } from "./purchase-candidate.reader.js";

/** A lot of the link and the live group that holds its invoice. */
export type GroupedLot = { lot: PayPlanProgressLot; group: LivePaymentGroupFacts };

/** The lots of the picked entries that sit in a live group; any other entry is left out. */
export function groupedLotsOf(entries: readonly PurchaseEntry[]): GroupedLot[] {
  return entries.flatMap(({ row, flags }) =>
    row && flags.group
      ? [
          {
            group: flags.group,
            lot: {
              lotId: row.lotId,
              title: row.lotTitle,
              lotNumber: row.lotNumber,
              saleTitle: row.saleTitle,
              totalPence: gbpAmountToPence(row.payment?.amount ?? "0"),
            },
          },
        ]
      : [],
  );
}

/**
 * Where each payment under way for the picked lots stands. A group still on the hosted checkout
 * is under way only once the payer finished it, which only the provider can say, so it is asked.
 * If it cannot be asked the payment counts as under way: an invoice is never offered again on a
 * guess, and the page tells the payer it is being confirmed.
 */
export class PayProgressResolver {
  constructor(private readonly gateway: Pick<IPaymentGroupGateway, "checkoutStatus">) {}

  /** Progress by group id; a group the payer has not finished maps to `null`. */
  async resolve(lots: readonly GroupedLot[]): Promise<Map<string, PayPlanProgress | null>> {
    const byGroup = new Map<string, { group: LivePaymentGroupFacts; lots: PayPlanProgressLot[] }>();
    for (const { lot, group } of lots) {
      const known = byGroup.get(group.id);
      if (known) known.lots.push(lot);
      else byGroup.set(group.id, { group, lots: [lot] });
    }
    const resolved = await Promise.all(
      [...byGroup.values()].map(async ({ group, lots }) => {
        const progress = payProgressOf({
          rail: group.checkoutRail,
          status: group.status,
          checkoutFinished: await this.checkoutFinished(group),
          totalPence: gbpAmountToPence(group.totalAmount),
          receivedPence: gbpAmountToPence(group.amountReceived),
          lots,
        });
        return [group.id, progress] as const;
      }),
    );
    return new Map(resolved);
  }

  private async checkoutFinished(group: LivePaymentGroupFacts): Promise<boolean> {
    if (group.status !== "open") return true;
    if (!group.stripeCheckoutSessionId) return false;
    try {
      return (await this.gateway.checkoutStatus(group.stripeCheckoutSessionId)) === "complete";
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "pay_progress_checkout_status_unreadable",
          paymentGroupId: group.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return true;
    }
  }
}
