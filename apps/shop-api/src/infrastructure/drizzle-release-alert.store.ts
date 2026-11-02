import type { Database } from "@auction/db";
import { shopReleaseAlertSubscription as subscription } from "@auction/db/schema";
import {
  RELEASE_ALERT_CONFIRM_TTL_MS,
  evaluateReleaseAlertConfirmation,
  shouldSendReleaseAlertConfirmation,
} from "@auction/shop-domain";
import { and, count, eq, ne } from "drizzle-orm";
import type {
  ReleaseAlertCounts,
  ReleaseAlertStore,
  ReleaseAlertSummaryReader,
} from "../application/ports/release-alert.store.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { hashLinkToken, mintLinkToken } from "./link-token.js";
import { releaseAlertConfirmUrl, releaseAlertUnsubscribeUrl } from "./release-alert-links.js";

type Row = typeof subscription.$inferSelect;

async function findForUpdate(tx: Database, email: string): Promise<Row | null> {
  const [row] = await tx
    .select()
    .from(subscription)
    .where(eq(subscription.email, email))
    .for("update")
    .limit(1);
  return row ?? null;
}

/** The release alert list in Postgres. */
export function createDrizzleReleaseAlertStore(
  db: Database,
  deps: { notifications: ShopNotificationPublisher; shopOrigin: string },
): ReleaseAlertStore & ReleaseAlertSummaryReader {
  const { notifications, shopOrigin } = deps;

  return {
    async requestConfirmation({ email, consent, now }) {
      await db.transaction(async (tx) => {
        const existing = await findForUpdate(tx as Database, email);
        if (!shouldSendReleaseAlertConfirmation(existing, now)) return;

        const confirmToken = mintLinkToken();
        const fields = {
          status: "pending" as const,
          consentText: consent.text,
          consentSource: consent.source,
          confirmTokenHash: hashLinkToken(confirmToken),
          confirmRequestedAt: now,
          stoppedAt: null,
          updatedAt: now,
        };
        let saved: Pick<Row, "id" | "unsubscribeToken"> | undefined;
        if (existing) {
          [saved] = await tx
            .update(subscription)
            .set(fields)
            .where(eq(subscription.id, existing.id))
            .returning({ id: subscription.id, unsubscribeToken: subscription.unsubscribeToken });
        } else {
          [saved] = await tx
            .insert(subscription)
            .values({ ...fields, email, unsubscribeToken: mintLinkToken() })
            .onConflictDoNothing()
            .returning({ id: subscription.id, unsubscribeToken: subscription.unsubscribeToken });
        }
        // A concurrent request for the same new address won the insert and sends the email.
        if (!saved) return;

        await notifications.queueReleaseAlertConfirmation(tx, {
          idempotencyKey: `release-alert-confirm:${saved.id}:${now.getTime()}`,
          to: email,
          confirmUrl: releaseAlertConfirmUrl(shopOrigin, confirmToken),
          expirationHours: RELEASE_ALERT_CONFIRM_TTL_MS / 3_600_000,
          unsubscribeUrl: releaseAlertUnsubscribeUrl(shopOrigin, saved.unsubscribeToken),
        });
      });
    },

    async subscribeAccount({ email, identitySubjectId, consent, now }) {
      return db.transaction(async (tx) => {
        const existing = await findForUpdate(tx as Database, email);
        if (existing?.status === "confirmed") {
          if (!existing.identitySubjectId) {
            await tx
              .update(subscription)
              .set({ identitySubjectId, updatedAt: now })
              .where(eq(subscription.id, existing.id));
          }
          return "already_subscribed" as const;
        }
        // The account's address is already verified, so there is nothing to confirm.
        const fields = {
          status: "confirmed" as const,
          identitySubjectId,
          consentText: consent.text,
          consentSource: consent.source,
          confirmTokenHash: null,
          confirmedAt: now,
          stoppedAt: null,
          updatedAt: now,
        };
        if (existing) {
          await tx.update(subscription).set(fields).where(eq(subscription.id, existing.id));
        } else {
          await tx
            .insert(subscription)
            .values({ ...fields, email, unsubscribeToken: mintLinkToken() })
            .onConflictDoNothing();
        }
        return "subscribed" as const;
      });
    },

    async confirm(token, now) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(subscription)
          .where(eq(subscription.confirmTokenHash, hashLinkToken(token)))
          .for("update")
          .limit(1);
        const outcome = evaluateReleaseAlertConfirmation(row ?? null, now);
        if (outcome === "confirmed" && row) {
          await tx
            .update(subscription)
            .set({ status: "confirmed", confirmedAt: now, updatedAt: now })
            .where(eq(subscription.id, row.id));
        }
        return outcome === "already_confirmed" ? "confirmed" : outcome;
      });
    },

    async isConfirmed(email) {
      const [row] = await db
        .select({ id: subscription.id })
        .from(subscription)
        .where(and(eq(subscription.email, email), eq(subscription.status, "confirmed")))
        .limit(1);
      return row !== undefined;
    },

    async stopByEmail(email, now) {
      await db
        .update(subscription)
        .set({ status: "stopped", stoppedAt: now, confirmTokenHash: null, updatedAt: now })
        .where(and(eq(subscription.email, email), ne(subscription.status, "stopped")));
    },

    async previewUnsubscribe(token) {
      const [row] = await db
        .select({ email: subscription.email, status: subscription.status })
        .from(subscription)
        .where(eq(subscription.unsubscribeToken, token))
        .limit(1);
      return row ? { email: row.email, active: row.status !== "stopped" } : null;
    },

    async unsubscribe(token, now) {
      const [row] = await db
        .select({ email: subscription.email })
        .from(subscription)
        .where(eq(subscription.unsubscribeToken, token))
        .limit(1);
      if (!row) return false;
      await db
        .update(subscription)
        .set({ status: "stopped", stoppedAt: now, confirmTokenHash: null, updatedAt: now })
        .where(and(eq(subscription.unsubscribeToken, token), ne(subscription.status, "stopped")));
      return true;
    },

    async counts(): Promise<ReleaseAlertCounts> {
      const rows = await db
        .select({ status: subscription.status, total: count() })
        .from(subscription)
        .groupBy(subscription.status);
      const total = (status: string) => rows.find((row) => row.status === status)?.total ?? 0;
      return { confirmed: total("confirmed"), awaitingConfirmation: total("pending") };
    },
  };
}
