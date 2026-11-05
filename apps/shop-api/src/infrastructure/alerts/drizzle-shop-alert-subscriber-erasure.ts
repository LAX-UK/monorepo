import type { Database } from "@auction/db";
import { shopAlertSubscriber } from "@auction/db/schema";
import { and, inArray, or, sql } from "drizzle-orm";
import type {
  ShopAlertErasureCounts,
  ShopAlertErasureTarget,
  ShopAlertSubscriberErasure,
} from "../../application/ports/shop-alert-subscriber-erasure.js";

const normalise = (email: string) => email.trim().toLowerCase();

/**
 * Shop's and lax.art's alert subscriptions for an address, deleted. A subscriber stopped because
 * the address complained is kept, detached from any account, so that address is not mailed again.
 */
export class DrizzleShopAlertSubscriberErasure implements ShopAlertSubscriberErasure {
  async erase(tx: Database, target: ShopAlertErasureTarget): Promise<ShopAlertErasureCounts> {
    const subjectIds = [...new Set(target.subjectIds ?? [])];
    const accountEmails = subjectIds.length > 0 ? await this.addressesOf(tx, subjectIds) : [];
    const emails = [
      ...new Set([...target.emails, ...accountEmails].map(normalise).filter((e) => e.length > 0)),
    ];
    if (emails.length === 0 && subjectIds.length === 0) {
      return { alertSubscribers: 0, suppressionsKept: 0 };
    }

    const subscribers = or(
      emails.length > 0 ? inArray(shopAlertSubscriber.email, emails) : undefined,
      subjectIds.length > 0 ? inArray(shopAlertSubscriber.subjectId, subjectIds) : undefined,
    );
    const complained = sql`${shopAlertSubscriber.stopReason} IS NOT DISTINCT FROM 'complaint'`;
    const deleted = await tx
      .delete(shopAlertSubscriber)
      .where(and(subscribers, sql`NOT (${complained})`))
      .returning({ id: shopAlertSubscriber.id });
    const kept = await tx
      .update(shopAlertSubscriber)
      .set({ subjectId: null })
      .where(and(subscribers, complained))
      .returning({ id: shopAlertSubscriber.id });

    return {
      alertSubscribers: deleted.length,
      suppressionsKept: kept.length,
    };
  }

  /** The addresses the accounts signed up with, so an email-only row for the same address goes too. */
  private async addressesOf(tx: Database, subjectIds: string[]): Promise<string[]> {
    const current = await tx
      .select({ email: shopAlertSubscriber.email })
      .from(shopAlertSubscriber)
      .where(inArray(shopAlertSubscriber.subjectId, subjectIds));
    return current.map((row) => row.email);
  }
}
