import type { PurchaseCardVm } from "./purchases.vm";

/** The one step a purchase row offers when it waits on the member: pay it, or open its next step. */
export type PurchaseRowStep =
  | { kind: "pay"; label: string; accessibleName: string }
  | { kind: "link"; label: string; accessibleName: string; href: string };

/**
 * An invoice the member can pay is paid from the row; otherwise the purchase's own next step
 * (arrange delivery, provide documents) opens. `null` when nothing waits on the member.
 */
export function purchaseRowStep(
  card: Pick<PurchaseCardVm, "title" | "amount" | "payable" | "primaryAction">,
): PurchaseRowStep | null {
  if (card.payable) {
    const label = `Pay ${card.amount}`;
    return { kind: "pay", label, accessibleName: `${label}, ${card.title}` };
  }
  if (card.primaryAction) {
    const { label, href } = card.primaryAction;
    return { kind: "link", label, href, accessibleName: `${label}, ${card.title}` };
  }
  return null;
}
