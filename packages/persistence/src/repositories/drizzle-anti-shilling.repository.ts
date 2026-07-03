import type { Database } from "@auction/db";
import { legalEntityMember } from "@auction/db/schema";
import type { Lot } from "@auction/types";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  AntiShillingBidContext,
  IAntiShillingGuard,
} from "../interfaces/anti-shilling.repository.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidString(value: string): boolean {
  return UUID_RE.test(value);
}

export class DrizzleAntiShillingRepository implements IAntiShillingGuard {
  constructor(private readonly db: Database) {}

  async bidderSharesSellerLegalEntity(bidderId: string, lot: Lot): Promise<boolean> {
    const sellerLegalEntityId = lot.sellerLegalEntityId;
    if (!sellerLegalEntityId) return false;

    const rows = await this.db
      .select({ id: legalEntityMember.id })
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, sellerLegalEntityId),
          eq(legalEntityMember.userId, bidderId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async violatesAntiShilling(ctx: AntiShillingBidContext): Promise<boolean> {
    if (await this.bidderSharesSellerLegalEntity(ctx.bidderUserId, ctx.lot)) {
      return true;
    }
    const sellerId = ctx.lot.sellerLegalEntityId;
    if (!sellerId || !isUuidString(ctx.buyerLegalEntityId)) {
      return false;
    }
    if (ctx.buyerLegalEntityId === sellerId) {
      return true;
    }
    const mBuy = alias(legalEntityMember, "m_buy");
    const mSel = alias(legalEntityMember, "m_sel");
    const overlap = await this.db
      .select({ id: mBuy.id })
      .from(mBuy)
      .innerJoin(mSel, eq(mBuy.userId, mSel.userId))
      .where(
        and(
          eq(mBuy.legalEntityId, ctx.buyerLegalEntityId),
          eq(mSel.legalEntityId, sellerId),
          isNull(mBuy.removedAt),
          isNull(mSel.removedAt),
          isNotNull(mBuy.acceptedAt),
          isNotNull(mSel.acceptedAt),
        ),
      )
      .limit(1);
    return overlap.length > 0;
  }
}
