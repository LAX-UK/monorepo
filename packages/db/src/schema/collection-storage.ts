import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot } from "./lots.js";
import { venue } from "./venues.js";

/**
 * A version of a place's storage terms (docs/design/storage-terms.md). A version starts on a date;
 * a cancelled one is kept with `cancelledAt`. Rates are pence per lot per day before VAT, and a
 * null large rate means the large band is off.
 */
export const collectionStorageTerms = pgTable(
  "collection_storage_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venue.id, { onDelete: "restrict" }),
    freeDays: smallint("free_days").notNull(),
    /** `calendar` or `working`. */
    countMode: text("count_mode").notNull().default("calendar"),
    standardDailyPence: integer("standard_daily_pence").notNull(),
    largeDailyPence: integer("large_daily_pence"),
    /** Charged once per lot when charges start. */
    handlingFeePence: integer("handling_fee_pence").notNull().default(0),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    reason: text("reason").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    check("collection_storage_terms_free_days_check", sql`${table.freeDays} BETWEEN 0 AND 90`),
    check(
      "collection_storage_terms_count_mode_check",
      sql`${table.countMode} IN ('calendar', 'working')`,
    ),
    check(
      "collection_storage_terms_standard_check",
      sql`${table.standardDailyPence} BETWEEN 0 AND 1000000`,
    ),
    check(
      "collection_storage_terms_large_check",
      sql`${table.largeDailyPence} IS NULL OR ${table.largeDailyPence} BETWEEN 0 AND 1000000`,
    ),
    check(
      "collection_storage_terms_handling_check",
      sql`${table.handlingFeePence} BETWEEN 0 AND 50000`,
    ),
    check("collection_storage_terms_reason_check", sql`btrim(${table.reason}) <> ''`),
    uniqueIndex("collection_storage_terms_start_uidx")
      .on(table.venueId, table.effectiveFrom)
      .where(sql`${table.cancelledAt} IS NULL`),
  ],
);

/** Extra free days staff gave one lot, with who and why. A lot may have several. */
export const collectionStorageExtension = pgTable(
  "collection_storage_extension",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "restrict" }),
    days: smallint("days").notNull(),
    reason: text("reason").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("collection_storage_extension_days_check", sql`${table.days} BETWEEN 1 AND 30`),
    check("collection_storage_extension_reason_check", sql`btrim(${table.reason}) <> ''`),
    index("collection_storage_extension_lot_idx").on(table.lotId, table.createdAt),
  ],
);

/** A lot whose storage charges Finance waived, with who and why. A lot is waived once. */
export const collectionStorageWaiver = pgTable(
  "collection_storage_waiver",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("collection_storage_waiver_reason_check", sql`btrim(${table.reason}) <> ''`),
    uniqueIndex("collection_storage_waiver_lot_uidx").on(table.lotId),
  ],
);

export const COLLECTION_STORAGE_AUDIT_ACTIONS = [
  "terms_scheduled",
  "terms_edited",
  "terms_cancelled",
  "charging_switched",
  "vat_treatment_set",
  "large_flag_set",
  "extension_granted",
  "waiver_granted",
] as const;

/** Every storage change: who, when, before, after and why. Append only. */
export const collectionStorageAudit = pgTable(
  "collection_storage_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venue.id, { onDelete: "restrict" }),
    /** Set for changes to one lot. */
    lotId: uuid("lot_id").references(() => lot.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "collection_storage_audit_action_check",
      sql.raw(`"action" IN (${COLLECTION_STORAGE_AUDIT_ACTIONS.map((a) => `'${a}'`).join(", ")})`),
    ),
    index("collection_storage_audit_venue_idx").on(table.venueId, table.createdAt.desc()),
    index("collection_storage_audit_lot_idx")
      .on(table.lotId, table.createdAt.desc())
      .where(sql`${table.lotId} IS NOT NULL`),
  ],
);
