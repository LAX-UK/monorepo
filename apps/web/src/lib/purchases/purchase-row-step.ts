import { payHref } from "@/lib/pay/pay-links";
import type { PurchaseCardVm } from "./purchases.vm";

/** The one step a purchase row offers when it waits on the member: a labelled link. */
export type PurchaseRowStep = {
  label: string;
  accessibleName: string;
  href: string;
};

/**
 * An invoice the member can pay opens the Pay page for it; otherwise the purchase's own next step
 * (arrange delivery, provide documents) opens. `null` when nothing waits on the member.
 */
export function purchaseRowStep(
  card: Pick<PurchaseCardVm, "lotId" | "title" | "amount" | "payable" | "primaryAction">,
): PurchaseRowStep | null {
  if (card.payable) {
    const label = `Pay ${card.amount}`;
    return { label, accessibleName: `${label}, ${card.title}`, href: payHref([card.lotId]) };
  }
  if (card.primaryAction) {
    const { label, href } = card.primaryAction;
    return { label, href, accessibleName: `${label}, ${card.title}` };
  }
  return null;
}
