import { createHash } from "node:crypto";
import type { Database } from "@auction/db";
import {
  emailOutbox,
  emailSuppression,
  newsletterSignupLog,
  shopGuestCustomer,
  shopUserProfile,
} from "@auction/db/schema";
import {
  type ExportSource,
  type SourceRow,
  SourcedExportCategory,
  inMemorySource,
} from "@auction/identity-contracts/subject-export-readers";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

/**
 * The emails Shop and lax.art send to a customer, with the plain name each is shown under. Alerts
 * that go to staff (new enquiry, checkout and Zoho notices) are not on the list, so only mail
 * addressed to the person can appear.
 */
export const CUSTOMER_EMAIL_TEMPLATES: Readonly<Record<string, string>> = {
  "shop-order-receipt": "Order confirmation",
  "shop-production-started": "Production started",
  "shop-delivery-quote-requested": "Delivery quote request",
  "shop-delivery-quote-ready": "Delivery quote",
  "shop-delivery-quote-declined": "Delivery quote declined",
  "shop-print-swapped": "Print number changed",
  "shop-dispatch-notice": "Dispatch notice",
  "shop-cancellation-confirmed": "Cancellation confirmation",
  "shop-refund-issued": "Refund confirmation",
  "shop-edition-available-notify": "Edition available alert",
  "shop-guest-order-link": "Link to your guest order",
  "art-enquiry-received": "Enquiry received",
  "art-artist-application-received": "Artist application received",
  "art-artist-application-more-info": "Artist application: more information needed",
  "art-artist-application-declined": "Artist application decision",
  "art-artist-application-welcome": "Welcome as an artist",
};

const TEMPLATE_IDS = Object.keys(CUSTOMER_EMAIL_TEMPLATES);

/** The outbox keys mail by a hash of the address, the same hash Shop writes when it queues mail. */
export function emailAddressHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function mapSentEmail(row: { id: string; template: string; sentAt: Date }) {
  return {
    id: `email:${row.id}`,
    origin: "observed" as const,
    kind: "email_sent",
    template: CUSTOMER_EMAIL_TEMPLATES[row.template] ?? row.template,
    sentAt: isoRequired(row.sentAt),
  };
}

export function mapNewsletterConsent(row: { id: string; source: string; createdAt: Date }) {
  return {
    id: `newsletter:${row.id}`,
    origin: "provided" as const,
    kind: "newsletter_consent",
    granted: true,
    source: row.source,
    changedAt: isoRequired(row.createdAt),
  };
}

export function mapCheckoutConsent(row: { id: string; consentAt: Date | null }) {
  return {
    id: `checkout-consent:${row.id}`,
    origin: "provided" as const,
    kind: "newsletter_consent",
    granted: true,
    source: "guest checkout",
    changedAt: iso(row.consentAt),
  };
}

export function mapSuppression(row: { createdAt: Date }) {
  return {
    id: "email-suppression",
    origin: "observed" as const,
    kind: "email_suppression",
    suppressed: true,
    changedAt: isoRequired(row.createdAt),
  };
}

/** The hash of the address on the person's Shop profile, or null when they have none. */
async function profileEmailHash(db: Database, subjectId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: shopUserProfile.email })
    .from(shopUserProfile)
    .where(eq(shopUserProfile.identitySubjectId, subjectId))
    .limit(1);
  const email = row?.email?.trim();
  return email ? emailAddressHash(email) : null;
}

/**
 * Mail sent to the address on the person's Shop profile (template and date only; the message
 * variables, the stored address and delivery errors are not selected), their newsletter consent,
 * and any suppression. The outbox has no account id for Shop mail, so the person's own current
 * address is the only key it offers.
 */
export class NotificationsAndMarketingCategory extends SourcedExportCategory {
  readonly id = "notifications-and-marketing";
  protected readonly sources: readonly ExportSource[];

  constructor({ db }: SubjectExportDeps) {
    super();
    const sentTo = (hash: string) =>
      and(
        eq(emailOutbox.toEmailHash, hash),
        eq(emailOutbox.status, "sent"),
        isNotNull(emailOutbox.sentAt),
        inArray(emailOutbox.template, TEMPLATE_IDS),
      );

    this.sources = [
      {
        count: async (s) => {
          const hash = await profileEmailHash(db, s);
          return hash === null ? 0 : countWhere(db, emailOutbox, sentTo(hash));
        },
        page: async (s, after, limit) => {
          const hash = await profileEmailHash(db, s);
          if (hash === null) return [];
          const rows = await db
            .select({
              id: emailOutbox.id,
              template: emailOutbox.template,
              sentAt: emailOutbox.sentAt,
            })
            .from(emailOutbox)
            .where(and(sentTo(hash), afterKey(emailOutbox.id, after)))
            .orderBy(asc(emailOutbox.id))
            .limit(limit);
          return rows.flatMap((row) =>
            row.sentAt
              ? [{ key: row.id, record: mapSentEmail({ ...row, sentAt: row.sentAt }) }]
              : [],
          );
        },
      },
      inMemorySource(async (s): Promise<SourceRow[]> => {
        const hash = await profileEmailHash(db, s);
        const [signups, suppressions, guests] = await Promise.all([
          hash === null
            ? []
            : db
                .select({
                  id: newsletterSignupLog.id,
                  source: newsletterSignupLog.source,
                  createdAt: newsletterSignupLog.createdAt,
                })
                .from(newsletterSignupLog)
                .where(eq(newsletterSignupLog.emailHash, hash)),
          hash === null
            ? []
            : db
                .select({ createdAt: emailSuppression.createdAt })
                .from(emailSuppression)
                .where(eq(emailSuppression.emailHash, hash)),
          // A guest who ticked the opt-in at checkout and later claimed their orders with this account.
          db
            .select({
              id: shopGuestCustomer.id,
              consentAt: shopGuestCustomer.marketingConsentAt,
            })
            .from(shopGuestCustomer)
            .where(
              and(
                eq(shopGuestCustomer.claimedSubjectId, s),
                eq(shopGuestCustomer.marketingConsent, true),
              ),
            ),
        ]);
        return [
          ...signups.map(mapNewsletterConsent),
          ...guests.map(mapCheckoutConsent),
          ...suppressions.map(mapSuppression),
        ].map((record) => ({ key: record.id, record }));
      }),
    ];
  }
}
