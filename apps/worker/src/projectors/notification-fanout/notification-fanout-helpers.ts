import { legalEntity, legalEntityMember, user } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

export type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

export type TransferBlockedPayload = {
  payoutId: string;
  legalEntityId: string;
  reason: string;
};

export type ManualReviewPayload = {
  paymentId: string;
  lotId: string;
  buyerUserId: string;
  sellerLegalEntityId: string;
  amount: string;
  currency: string;
  reason: string;
};

export type SellerMoneyPayload = {
  legalEntityId?: string;
  sellerLegalEntityId?: string;
  amountCents?: number;
  netAmount?: string;
  currency: string;
  reason?: string | null;
  outcome?: string;
};

export type ProxyCancelledPayload = {
  lotId: string;
  bidderUserId: string;
  reason: string;
};

export type LotVoidedPayload = {
  lotId?: string;
  reason: string;
};

export const SUPPORTED_EVENT_TYPES = [
  "payout.transfer_blocked",
  "payment.requires_manual_review",
  "payout.transfer_initiated",
  "payment.dispute_opened",
  "payment.dispute_closed",
  "bid.proxy_cancelled",
  "lot.voided",
  "payout.clawback_required",
] as const;

export function formatReason(reason: string): string {
  if (reason === "connect_not_ready") {
    return "Stripe Connect payouts are not enabled for this organisation";
  }
  return reason.replaceAll("_", " ");
}

export async function listEntityRecipients(db: Db, legalEntityId: string) {
  return db
    .selectDistinct({
      email: user.email,
      userId: user.id,
      firstName: user.firstName,
    })
    .from(legalEntityMember)
    .innerJoin(user, eq(user.id, legalEntityMember.userId))
    .where(
      and(
        eq(legalEntityMember.legalEntityId, legalEntityId),
        isNull(legalEntityMember.removedAt),
        isNotNull(legalEntityMember.acceptedAt),
        or(
          inArray(legalEntityMember.role, ["owner", "admin", "finance"]),
          eq(legalEntityMember.isPrimaryAdmin, true),
        ),
      ),
    );
}

export async function entityName(db: Db, legalEntityId: string): Promise<string> {
  const [row] = await db
    .select({ displayName: legalEntity.displayName })
    .from(legalEntity)
    .where(eq(legalEntity.id, legalEntityId))
    .limit(1);
  return row?.displayName ?? "Unknown Organisation";
}

export function centsToAmount(cents: number | undefined): string {
  return typeof cents === "number" ? (cents / 100).toFixed(2) : "0.00";
}
