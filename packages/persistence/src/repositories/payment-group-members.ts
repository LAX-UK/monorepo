import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import type { BidPaymentGroupMemberFact } from "../interfaces/bid-portfolio.reader.js";

/**
 * Every payment of each group given, whoever may see it: a part-funded transfer's remainder is
 * shared across the whole group, so a screen that lists only some of its invoices still shows
 * each one's exact share.
 */
export async function loadGroupMembers(
  db: Database,
  groupIds: readonly string[],
): Promise<Map<string, BidPaymentGroupMemberFact[]>> {
  const byGroup = new Map<string, BidPaymentGroupMemberFact[]>();
  if (groupIds.length === 0) return byGroup;
  const rows = await db
    .select({
      groupId: payment.paymentGroupId,
      lotId: payment.lotId,
      status: payment.status,
      amount: payment.amount,
    })
    .from(payment)
    .where(inArray(payment.paymentGroupId, [...groupIds]));
  for (const { groupId, ...member } of rows) {
    if (!groupId) continue;
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), member]);
  }
  return byGroup;
}
