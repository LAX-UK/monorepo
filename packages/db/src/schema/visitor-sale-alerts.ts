import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export type VisitorSaleAlertStatus = "pending" | "confirmed" | "unsubscribed";

/**
 * Email-only new-sale announcements for people without an account. It is its own list: it is not
 * the newsletter, not client notification preferences and not marketing consent on an account.
 * An address receives alerts only once `status` is `confirmed` (double opt-in). The wording the
 * person agreed to, when and where they agreed are kept as proof of consent.
 */
export const visitorSaleAlertSubscriber = pgTable(
  "visitor_sale_alert_subscriber",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Lower-cased and trimmed. */
    email: text("email").notNull(),
    status: text("status").$type<VisitorSaleAlertStatus>().notNull().default("pending"),
    /** The sign-up wording shown beside the form at the time of the request. */
    consentText: text("consent_text").notNull(),
    /** Where the request came from, for example `web_home_alerts`. */
    consentSource: text("consent_source").notNull(),
    /** When the current confirmation was requested; a confirmation link names this instant. */
    requestedAt: timestamp("requested_at", { mode: "date", withTimezone: true }).notNull(),
    confirmationSentAt: timestamp("confirmation_sent_at", { mode: "date", withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { mode: "date", withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { mode: "date", withTimezone: true }),
    /** Set when a signed-in client with this verified address chose to manage the alert from settings. */
    linkedUserId: text("linked_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("visitor_sale_alert_subscriber_email_uid").on(table.email),
    index("visitor_sale_alert_subscriber_status_idx").on(table.status),
    index("visitor_sale_alert_subscriber_linked_user_idx").on(table.linkedUserId),
    check(
      "visitor_sale_alert_subscriber_status_check",
      sql`${table.status} IN ('pending', 'confirmed', 'unsubscribed')`,
    ),
  ],
);
