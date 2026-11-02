import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

/**
 * A message sent through the public contact form or the private sale enquiry page. Client services
 * and specialists work it from the Enquiries list. Name, email, phone and message are personal
 * data: never copied into events or logs.
 */
export const marketingEnquiry = pgTable(
  "marketing_enquiry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** What the sender quotes: E-1001 upwards. */
    reference: text("reference")
      .notNull()
      .default(sql`('E-' || nextval('marketing_enquiry_reference_seq')::text)`),
    /** What the sender is asking for; see `ENQUIRY_INTENTS`. */
    intent: text("intent").notNull().default("general"),
    /** The contact form topic: buying, selling, shipping, press or other. */
    topic: text("topic").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message").notNull(),
    /** The page the form was sent from, as a path. */
    sourcePage: text("source_page"),
    status: text("status").notNull().default("new"),
    closeReason: text("close_reason"),
    /** When the enquiry was closed (the column predates the wider statuses). */
    handledAt: timestamp("handled_at", { mode: "date", withTimezone: true }),
    handledByUserId: text("handled_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** The public Sell department the work belongs to; routes the enquiry. */
    departmentSlug: text("department_slug"),
    /** The signed-in account that sent the enquiry, when there was one. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** The person or organisation the signed-in sender enquired as. */
    legalEntityId: uuid("legal_entity_id").references(() => legalEntity.id, {
      onDelete: "set null",
    }),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    /** Incremented on every change; a write made against an older version is refused. */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("marketing_enquiry_reference_uidx").on(table.reference),
    index("marketing_enquiry_new_created_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'new'`),
    index("marketing_enquiry_open_created_idx")
      .on(table.createdAt, table.id)
      .where(sql`${table.status} IN ('new', 'in_progress', 'waiting_on_client')`),
    index("marketing_enquiry_assignee_idx")
      .on(table.assignedToUserId, table.status)
      .where(sql`${table.assignedToUserId} IS NOT NULL`),
    index("marketing_enquiry_intent_created_idx").on(table.intent, table.createdAt, table.id),
    check(
      "marketing_enquiry_status_check",
      sql`${table.status} IN ('new', 'in_progress', 'waiting_on_client', 'converted', 'closed')`,
    ),
    check(
      "marketing_enquiry_handled_check",
      sql`(${table.status} = 'closed') = (${table.handledAt} IS NOT NULL)`,
    ),
    check(
      "marketing_enquiry_close_reason_check",
      sql`${table.closeReason} IS NULL OR (${table.status} = 'closed' AND ${table.closeReason} IN ('not_a_fit', 'not_proceeding', 'sold_elsewhere', 'duplicate', 'spam'))`,
    ),
    check(
      "marketing_enquiry_intent_check",
      sql`${table.intent} IN ('general', 'private_sale_sell', 'private_sale_buy', 'buying', 'selling', 'shipping', 'press')`,
    ),
    check("marketing_enquiry_version_check", sql`${table.version} >= 1`),
  ],
);

/** The path-specific answers of a private sale enquiry, kept off the generic enquiry. */
export const privateSaleEnquiryDetail = pgTable(
  "private_sale_enquiry_detail",
  {
    enquiryId: uuid("enquiry_id").primaryKey(),
    artist: text("artist"),
    title: text("title"),
    medium: text("medium"),
    size: text("size"),
    locationTown: text("location_town"),
    locationCountry: text("location_country"),
    /** What the seller has in mind, in pence; null when they are not sure yet. */
    priceInMindMinor: bigint("price_in_mind_minor", { mode: "number" }),
    lookingFor: text("looking_for"),
    budgetBand: text("budget_band"),
    timing: text("timing"),
    contactPreference: text("contact_preference").notNull().default("email"),
  },
  (table) => [
    foreignKey({
      name: "private_sale_enquiry_detail_enquiry_id_fk",
      columns: [table.enquiryId],
      foreignColumns: [marketingEnquiry.id],
    }).onDelete("cascade"),
    check(
      "private_sale_enquiry_detail_price_check",
      sql`${table.priceInMindMinor} IS NULL OR ${table.priceInMindMinor} > 0`,
    ),
    check(
      "private_sale_enquiry_detail_budget_band_check",
      sql`${table.budgetBand} IS NULL OR ${table.budgetBand} IN ('under_10000', '10000_to_50000', '50000_to_250000', 'over_250000', 'prefer_not_to_say')`,
    ),
    check(
      "private_sale_enquiry_detail_timing_check",
      sql`${table.timing} IS NULL OR ${table.timing} IN ('no_rush', 'within_3_months', 'urgent')`,
    ),
    check(
      "private_sale_enquiry_detail_contact_preference_check",
      sql`${table.contactPreference} IN ('email', 'phone', 'either')`,
    ),
  ],
);
