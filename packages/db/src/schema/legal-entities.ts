import type { StripeConnectRequirementError } from "@auction/types";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const legalEntityKindEnum = pgEnum("legal_entity_kind", ["individual", "organisation"]);

export const legalEntitySubkindEnum = pgEnum("legal_entity_subkind", [
  "artist",
  "private_collector",
  "gallery",
  "dealer",
  "estate",
  "company",
  "charity",
  "institution",
  "lax_stock",
  "other",
]);

export const legalEntityStatusEnum = pgEnum("legal_entity_status", [
  "lead",
  "docs_requested",
  "docs_received",
  "under_review",
  "connect_pending",
  "approved",
  "restricted",
  "rejected",
  "archived",
]);

export const legalEntity = pgTable(
  "legal_entity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    slug: text("slug").unique(),
    kind: legalEntityKindEnum("kind").notNull(),
    subkind: legalEntitySubkindEnum("subkind").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: legalEntityStatusEnum("status").notNull().default("lead"),
    statusChangedAt: timestamp("status_changed_at", {
      mode: "date",
      withTimezone: true,
    }),
    statusChangedByUserId: text("status_changed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Human-readable reason for the current status (reject, request docs, etc.). */
    statusReason: text("status_reason"),
    stripeConnectAccountId: text("stripe_connect_account_id").unique(),
    /** Stripe Customer id (`cus_…`) for buyer bank-transfer Checkout on the platform account. */
    stripeCustomerId: text("stripe_customer_id"),
    stripeConnectChargesEnabled: boolean("stripe_connect_charges_enabled").notNull().default(false),
    stripeConnectPayoutsEnabled: boolean("stripe_connect_payouts_enabled").notNull().default(false),
    stripeConnectRequirementsCurrentlyDue: jsonb("stripe_connect_requirements_currently_due")
      .$type<string[]>()
      .notNull()
      .default([]),
    stripeConnectRequirementsErrors: jsonb("stripe_connect_requirements_errors")
      .$type<StripeConnectRequirementError[]>()
      .notNull()
      .default([]),
    stripeConnectDisabledReason: text("stripe_connect_disabled_reason"),
    xeroContactId: text("xero_contact_id"),
    vatNumber: text("vat_number"),
    marginSchemeEligible: boolean("margin_scheme_eligible").notNull().default(false),
    isLaxManaged: boolean("is_lax_managed").notNull().default(false),
    platformFeeBps: integer("platform_fee_bps"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_entity_status_idx").on(table.status),
    index("legal_entity_kind_subkind_idx").on(table.kind, table.subkind),
    index("legal_entity_created_by_user_id_idx").on(table.createdByUserId),
    index("legal_entity_stripe_connect_account_id_idx").on(table.stripeConnectAccountId),
    uniqueIndex("legal_entity_stripe_customer_id_uidx")
      .on(table.stripeCustomerId)
      .where(sql`${table.stripeCustomerId} IS NOT NULL`),
    uniqueIndex("legal_entity_slug_uidx").on(table.slug).where(sql`${table.slug} IS NOT NULL`),
    index("legal_entity_is_lax_managed_idx")
      .on(table.isLaxManaged)
      .where(sql`${table.isLaxManaged} = true`),
    check(
      "legal_entity_kind_subkind_coherence",
      sql`(
        (${table.kind} = 'individual' AND ${table.subkind} IN ('artist', 'private_collector'))
        OR
        (${table.kind} = 'organisation' AND ${table.subkind} IN ('gallery', 'dealer', 'estate', 'company', 'charity', 'institution', 'lax_stock', 'other'))
      )`,
    ),
    check(
      "legal_entity_lax_managed_gate",
      sql`NOT ${table.isLaxManaged} OR ${table.subkind} = 'lax_stock'`,
    ),
  ],
);

export const legalEntityRelations = relations(legalEntity, ({ one }) => ({
  createdBy: one(user, {
    fields: [legalEntity.createdByUserId],
    references: [user.id],
  }),
  statusChangedBy: one(user, {
    fields: [legalEntity.statusChangedByUserId],
    references: [user.id],
  }),
}));
