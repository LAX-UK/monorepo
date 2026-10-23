import type { DeletionBlocker } from "@auction/identity-contracts";
import type { StorefrontOrigins } from "../domain/storefront-origins.js";
import type { ShopDeletionEligibilityReader } from "./ports/deletion-eligibility.reader.js";

/** Stable codes Identity passes through to LAX Account; prefixed so they never collide with Bid's. */
export const SHOP_DELETION_BLOCKER_CODES = {
  openOrders: "shop_open_orders",
  pendingPayouts: "shop_pending_payouts",
  openOriginalSales: "shop_open_original_sales",
  activeHolds: "shop_active_holds",
} as const;

export type ShopDeletionEligibilityService = {
  listBlockers(identitySubjectId: string): Promise<DeletionBlocker[]>;
};

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * What LAX Shop and lax.art say to Identity when asked whether a person can delete their
 * account: each thing still in flight, with the storefront page that deals with it. Payouts and
 * enquiries link to lax.art when it is configured (that is where artists and collectors manage
 * them), otherwise to the Shop storefront.
 */
export function createShopDeletionEligibilityService(deps: {
  reader: ShopDeletionEligibilityReader;
  origins: StorefrontOrigins;
}): ShopDeletionEligibilityService {
  const { reader, origins } = deps;
  const link = (origin: string, path: string) => new URL(path, `${origin}/`).toString();

  return {
    async listBlockers(identitySubjectId) {
      const open = await reader.readOpenItems(identitySubjectId);
      const blockers: DeletionBlocker[] = [];
      if (open.openOrders > 0) {
        blockers.push({
          code: SHOP_DELETION_BLOCKER_CODES.openOrders,
          message: `You have ${open.openOrders} ${plural(open.openOrders, "order", "orders")} that ${plural(open.openOrders, "hasn't", "haven't")} been paid for or delivered yet.`,
          href: link(origins.shop, "/account/orders"),
        });
      }
      if (open.pendingPayouts > 0) {
        blockers.push({
          code: SHOP_DELETION_BLOCKER_CODES.pendingPayouts,
          message: `${open.pendingPayouts} ${plural(open.pendingPayouts, "payout", "payouts")} to you ${plural(open.pendingPayouts, "hasn't", "haven't")} been paid yet. ${plural(open.pendingPayouts, "It needs", "They need")} to arrive first.`,
          href: link(origins.art, "/account/payouts"),
        });
      }
      if (open.openOriginalSales > 0) {
        blockers.push({
          code: SHOP_DELETION_BLOCKER_CODES.openOriginalSales,
          message: `You have ${open.openOriginalSales} ${plural(open.openOriginalSales, "original work", "original works")} reserved or being paid for. Complete or cancel ${plural(open.openOriginalSales, "it", "them")} first.`,
          href: link(origins.art, "/account/enquiries"),
        });
      }
      if (open.activeHolds > 0) {
        blockers.push({
          code: SHOP_DELETION_BLOCKER_CODES.activeHolds,
          message: `${open.activeHolds} ${plural(open.activeHolds, "work is", "works are")} being held for you. Ask for ${plural(open.activeHolds, "it", "them")} to be released first.`,
          href: link(origins.art, "/account/enquiries"),
        });
      }
      return blockers;
    },
  };
}
