import { relations, sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { payment } from "./payments.js";

export const paymentExternalSyncStatusEnum = pgEnum("payment_external_sync_status", [
  "pending_sync",
  "synced",
  "error",
]);

export const xeroConnectionStatusEnum = pgEnum("xero_connection_status", [
  "healthy",
  "needs_reauth",
]);

/** Single connected Xero organisation (marketplace-wide). */
export const xeroConnection = pgTable(
  "xero_connection",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull().unique(),
    tenantName: text("tenant_name"),
    /**
     * Legacy plaintext tokens. Nullable since migration 0367: new writes leave them null and store
     * the envelope-sealed values below. A value here is only ever a row not yet backfilled.
     */
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    /** AES-256-GCM envelope (`v1:` prefix) of the OAuth access token. */
    accessTokenSealed: text("access_token_sealed"),
    /** AES-256-GCM envelope (`v1:` prefix) of the OAuth refresh token. */
    refreshTokenSealed: text("refresh_token_sealed"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    scopes: text("scopes"),
    connectedByUserId: text("connected_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    connectionStatus: xeroConnectionStatusEnum("connection_status").notNull().default("healthy"),
    lastRefreshError: text("last_refresh_error"),
    orgShortCode: text("org_short_code"),
    orgBaseCurrency: text("org_base_currency"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("xero_connection_tenant_id_idx").on(table.tenantId),
    check(
      "xero_connection_access_token_sealed_envelope_chk",
      sql`${table.accessTokenSealed} IS NULL OR ${table.accessTokenSealed} LIKE 'v1:%'`,
    ),
    check(
      "xero_connection_refresh_token_sealed_envelope_chk",
      sql`${table.refreshTokenSealed} IS NULL OR ${table.refreshTokenSealed} LIKE 'v1:%'`,
    ),
  ],
);

/** Xero (or future provider) identifiers for a local payment row. */
export const paymentExternalRef = pgTable(
  "payment_external_ref",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .unique()
      .references(() => payment.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("xero"),
    xeroInvoiceId: text("xero_invoice_id"),
    xeroInvoiceNumber: text("xero_invoice_number"),
    xeroContactId: text("xero_contact_id"),
    xeroPaymentId: text("xero_payment_id"),
    onlineInvoiceUrl: text("online_invoice_url"),
    syncStatus: paymentExternalSyncStatusEnum("sync_status").notNull().default("pending_sync"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_external_ref_payment_id_idx").on(table.paymentId),
    index("payment_external_ref_xero_invoice_id_idx").on(table.xeroInvoiceId),
  ],
);

export const xeroWebhookEvent = pgTable(
  "xero_webhook_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    eventKey: text("event_key").notNull().unique(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("xero_webhook_event_tenant_resource_idx").on(table.tenantId, table.resourceId),
    index("xero_webhook_event_error_created_idx")
      .on(table.createdAt)
      .where(sql`${table.error} IS NOT NULL`),
  ],
);

export const xeroConnectionRelations = relations(xeroConnection, ({ one }) => ({
  connectedBy: one(user, {
    fields: [xeroConnection.connectedByUserId],
    references: [user.id],
  }),
}));

export const paymentExternalRefRelations = relations(paymentExternalRef, ({ one }) => ({
  payment: one(payment, {
    fields: [paymentExternalRef.paymentId],
    references: [payment.id],
  }),
}));
