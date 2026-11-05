import type { Database } from "@auction/db";
import { bidAlertSubscriber, visitorSaleAlertSubscriber } from "@auction/db/schema";
import { and, inArray, or, sql } from "drizzle-orm";
import type {
  AlertSubscriberErasureCounts,
  AlertSubscriberErasureTarget,
} from "../interfaces/alert-subscriber-erasure.repository.js";

const ZERO: AlertSubscriberErasureCounts = {
  alertSubscribers: 0,
  visitorSaleAlerts: 0,
  suppressionsKept: 0,
};

const normalise = (email: string) => email.trim().toLowerCase();

/** The addresses the accounts signed up with, so an email-only row for the same address goes too. */
async function addressesOfAccounts(tx: Database, userIds: string[]): Promise<string[]> {
  const subscribers = await tx
    .select({ email: bidAlertSubscriber.email })
    .from(bidAlertSubscriber)
    .where(inArray(bidAlertSubscriber.subjectId, userIds));
  const visitors = await tx
    .select({ email: visitorSaleAlertSubscriber.email })
    .from(visitorSaleAlertSubscriber)
    .where(inArray(visitorSaleAlertSubscriber.linkedUserId, userIds));
  return [...subscribers, ...visitors].map((row) => row.email);
}

/**
 * Deletes the alert subscriptions held for the addresses (and accounts) in the target. Topic
 * switches, matches and digests go by cascade. A row stopped because the address complained is
 * kept so that address is not mailed again; it is detached from any account. For accounts, the
 * addresses their own rows hold are erased as well.
 */
export async function eraseAlertSubscribers(
  tx: Database,
  target: AlertSubscriberErasureTarget,
): Promise<AlertSubscriberErasureCounts> {
  const userIds = [...new Set(target.userIds ?? [])];
  const accountEmails = userIds.length > 0 ? await addressesOfAccounts(tx, userIds) : [];
  const emails = [
    ...new Set([...target.emails, ...accountEmails].map(normalise).filter((e) => e.length > 0)),
  ];
  if (emails.length === 0 && userIds.length === 0) return { ...ZERO };

  const subscribers = [
    emails.length > 0 ? inArray(bidAlertSubscriber.email, emails) : undefined,
    userIds.length > 0 ? inArray(bidAlertSubscriber.subjectId, userIds) : undefined,
  ].filter((condition) => condition !== undefined);
  const complained = sql`${bidAlertSubscriber.stopReason} IS NOT DISTINCT FROM 'complaint'`;

  const deleted = await tx
    .delete(bidAlertSubscriber)
    .where(and(or(...subscribers), sql`NOT (${complained})`))
    .returning({ id: bidAlertSubscriber.id });
  const kept = await tx
    .update(bidAlertSubscriber)
    .set({ subjectId: null })
    .where(and(or(...subscribers), complained))
    .returning({ id: bidAlertSubscriber.id });

  const visitors = [
    emails.length > 0 ? inArray(visitorSaleAlertSubscriber.email, emails) : undefined,
    userIds.length > 0 ? inArray(visitorSaleAlertSubscriber.linkedUserId, userIds) : undefined,
  ].filter((condition) => condition !== undefined);
  const visitorRows = await tx
    .delete(visitorSaleAlertSubscriber)
    .where(or(...visitors))
    .returning({ id: visitorSaleAlertSubscriber.id });

  return {
    alertSubscribers: deleted.length,
    visitorSaleAlerts: visitorRows.length,
    suppressionsKept: kept.length,
  };
}
