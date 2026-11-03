import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { bidAlertDigest } from "./bid-alerts.js";
import { itemSubmission } from "./item-submissions.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";
import { sale } from "./sales.js";

/**
 * Every notification type the product sends. The `notification_type_check` constraint must allow
 * each of them; a migration test checks the migrated database against this list, so a later
 * migration that rebuilds the constraint cannot silently drop one.
 */
export const NOTIFICATION_TYPES = [
  "outbid",
  "lot_cancelled",
  "lot_won",
  "lot_lost",
  "lot_ending_soon",
  "watchlist_starting",
  "watchlist_ending_soon",
  "payment_received",
  "payment_due",
  "lot_ended_seller",
  "kyc_resubmission_required",
  "submission_received_for_review",
  "submission_approved",
  "submission_rejected",
  "submission_converted",
  "submission_draft_reminder",
  "submission_changes_requested",
  "consignment_agreement_reminder",
  "consignment_update",
  "condition_report_ready",
  "condition_report_declined",
  "source_of_funds_documents_requested",
  "source_of_funds_approved",
  "source_of_funds_rejected",
  "staff_role_expired",
  "staff_role_expired_admin",
  "staff_role_changed",
  "staff_role_changed_admin",
  "lot_ready_for_collection",
  "lot_shipped",
  "lot_delivered",
  "organisation_member_left",
  "payout_bank_changed",
  "delivery_quote_ready",
  "payout_problem",
  "bid_refused_limit",
  "access_requested",
  "access_request_decided",
  "consignment_message",
  "watchlist_reminder",
  "kyc_approved",
  "kyc_declined",
  "sale_cancelled",
  "payment_reminder",
  "buyer_default_notice",
  "sale_announced",
  "artist_lots_listed",
  "search_lots_listed",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    lotId: uuid("lot_id").references(() => lot.id, { onDelete: "set null" }),
    /** The sale a sale notice is about; `null` once the sale is deleted. */
    saleId: uuid("sale_id").references(() => sale.id, { onDelete: "set null" }),
    /**
     * The site page a notice opens when no id on the row says where to go: an artist's page, or a
     * saved search's results. A path on this site, never a full address.
     */
    linkPath: text("link_path"),
    /** The daily alert digest a notice was written for; a digest has one notice per type. */
    alertDigestId: uuid("alert_digest_id").references(() => bidAlertDigest.id, {
      onDelete: "set null",
    }),
    submissionId: uuid("submission_id").references(() => itemSubmission.id, {
      onDelete: "set null",
    }),
    /**
     * The account the notification is about: a personal or organisation legal entity. `null`
     * means the person's own personal account (and older rows whose account is not known).
     */
    legalEntityId: uuid("legal_entity_id").references(() => legalEntity.id, {
      onDelete: "set null",
    }),
    read: boolean("read").notNull().default(false),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_user_id_idx").on(table.userId),
    index("notification_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("notification_read_idx").on(table.read),
    index("notification_archived_at_idx").on(table.archivedAt),
    index("notification_submission_id_idx").on(table.submissionId),
    index("notification_user_id_legal_entity_id_created_at_idx").on(
      table.userId,
      table.legalEntityId,
      table.createdAt,
    ),
    uniqueIndex("notification_alert_digest_type_uid")
      .on(table.alertDigestId, table.type)
      .where(sql`${table.alertDigestId} IS NOT NULL`),
    check(
      "notification_link_path_check",
      sql`${table.linkPath} IS NULL OR (${table.linkPath} LIKE '/%' AND ${table.linkPath} NOT LIKE '//%' AND char_length(${table.linkPath}) <= 500)`,
    ),
    check(
      "notification_type_check",
      sql`${table.type} IN (${sql.raw(NOTIFICATION_TYPES.map((t) => `'${t}'`).join(", "))})`,
    ),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
  lot: one(lot, {
    fields: [notification.lotId],
    references: [lot.id],
  }),
  submission: one(itemSubmission, {
    fields: [notification.submissionId],
    references: [itemSubmission.id],
  }),
}));
