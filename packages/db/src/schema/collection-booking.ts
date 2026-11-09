import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";
import { sale } from "./sales.js";
import { venue } from "./venues.js";

const LOCAL_TIME = "'^([01][0-9]|2[0-3]):[0-5][0-9]$'";

/**
 * The rules a place sets for collection visits, and the online-booking switch. One row per venue;
 * it is created the first time staff or a booking needs it, with the gallery's defaults.
 */
export const collectionPlace = pgTable(
  "collection_place",
  {
    venueId: uuid("venue_id")
      .primaryKey()
      .references(() => venue.id, { onDelete: "restrict" }),
    onlineBookingEnabled: boolean("online_booking_enabled").notNull().default(false),
    visitMinutes: smallint("visit_minutes").notNull().default(30),
    placesPerSlot: smallint("places_per_slot").notNull().default(2),
    noticeCutoffLocal: text("notice_cutoff_local").notNull().default("16:00"),
    noticeWorkingDays: smallint("notice_working_days").notNull().default(1),
    windowDays: smallint("window_days").notNull().default(28),
    closeOnSaleDays: boolean("close_on_sale_days").notNull().default(true),
    undoHandOverMinutes: smallint("undo_hand_over_minutes").notNull().default(10),
    maxActiveVisits: smallint("max_active_visits").notNull().default(5),
    /** Days a bought work is stored free; null until the storage terms are set. */
    freeStorageDays: smallint("free_storage_days"),
    /** What storage costs per lot per week once the free period is over, in pence; recorded only, never charged by this build. */
    storageChargePence: integer("storage_charge_pence"),
    bookingEmail: text("booking_email"),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "collection_place_visit_minutes_check",
      sql`${table.visitMinutes} IN (15, 20, 30, 45, 60)`,
    ),
    check("collection_place_places_check", sql`${table.placesPerSlot} BETWEEN 1 AND 10`),
    check("collection_place_cutoff_check", sql.raw(`"notice_cutoff_local" ~ ${LOCAL_TIME}`)),
    check("collection_place_notice_days_check", sql`${table.noticeWorkingDays} BETWEEN 1 AND 5`),
    check("collection_place_window_check", sql`${table.windowDays} BETWEEN 7 AND 90`),
    check("collection_place_undo_check", sql`${table.undoHandOverMinutes} BETWEEN 1 AND 60`),
    check("collection_place_visit_cap_check", sql`${table.maxActiveVisits} BETWEEN 1 AND 20`),
    check(
      "collection_place_storage_check",
      sql`${table.freeStorageDays} IS NULL OR ${table.freeStorageDays} BETWEEN 0 AND 365`,
    ),
    check(
      "collection_place_storage_charge_check",
      sql`${table.storageChargePence} IS NULL OR ${table.storageChargePence} BETWEEN 0 AND 1000000`,
    ),
  ],
);

/** Regular opening hours: weekday 1 (Monday) to 7, London wall-clock "HH:MM". */
export const collectionWeeklyHours = pgTable(
  "collection_weekly_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venue.id, { onDelete: "restrict" }),
    weekday: smallint("weekday").notNull(),
    opensLocal: text("opens_local").notNull(),
    closesLocal: text("closes_local").notNull(),
  },
  (table) => [
    check("collection_weekly_hours_weekday_check", sql`${table.weekday} BETWEEN 1 AND 7`),
    check("collection_weekly_hours_opens_check", sql.raw(`"opens_local" ~ ${LOCAL_TIME}`)),
    check("collection_weekly_hours_closes_check", sql.raw(`"closes_local" ~ ${LOCAL_TIME}`)),
    check("collection_weekly_hours_order_check", sql`${table.closesLocal} > ${table.opensLocal}`),
    uniqueIndex("collection_weekly_hours_range_uidx").on(
      table.venueId,
      table.weekday,
      table.opensLocal,
    ),
  ],
);

/**
 * A closure (a day or part of one) or an extra opening. Bank holidays and sale days are added with
 * their source. Rows are soft-deleted so the audit trail keeps what staff removed.
 */
export const collectionException = pgTable(
  "collection_exception",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venue.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    opensLocal: text("opens_local"),
    closesLocal: text("closes_local"),
    source: text("source").notNull().default("staff"),
    saleId: uuid("sale_id").references(() => sale.id, { onDelete: "cascade" }),
    reasonInternal: text("reason_internal"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    check("collection_exception_kind_check", sql`${table.kind} IN ('closure', 'extra_opening')`),
    check(
      "collection_exception_source_check",
      sql`${table.source} IN ('staff', 'bank_holiday', 'sale')`,
    ),
    check("collection_exception_days_check", sql`${table.endsOn} >= ${table.startsOn}`),
    check(
      "collection_exception_hours_check",
      sql.raw(
        `("opens_local" IS NULL AND "closes_local" IS NULL) OR ("opens_local" IS NOT NULL AND "closes_local" IS NOT NULL AND "opens_local" ~ ${LOCAL_TIME} AND "closes_local" ~ ${LOCAL_TIME} AND "closes_local" > "opens_local")`,
      ),
    ),
    check(
      "collection_exception_sale_check",
      sql`(${table.source} = 'sale') = (${table.saleId} IS NOT NULL)`,
    ),
    index("collection_exception_venue_days_idx")
      .on(table.venueId, table.startsOn, table.endsOn)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("collection_exception_bank_holiday_uidx")
      .on(table.venueId, table.startsOn)
      .where(sql`${table.source} = 'bank_holiday' AND ${table.deletedAt} IS NULL`),
    uniqueIndex("collection_exception_sale_uidx")
      .on(table.venueId, table.saleId)
      .where(sql`${table.source} = 'sale' AND ${table.deletedAt} IS NULL`),
  ],
);

/**
 * One visit. It holds one numbered place (`seat`) in its slot; the partial unique index on
 * (venue, slot start, seat) while the booking is live is what rules out double booking.
 *
 * The collector's name, email and company are personal data of someone who may have no account.
 * They are erased with the booker's account and are never put into domain events.
 */
export const collectionBooking = pgTable(
  "collection_booking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** What the desk and the buyer quote: COL-1000 upwards. */
    reference: text("reference")
      .notNull()
      .default(sql`('COL-' || lpad(nextval('collection_booking_reference_seq')::text, 4, '0'))`),
    /** The buying account. */
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venue.id, { onDelete: "restrict" }),
    slotStart: timestamp("slot_start", { mode: "date", withTimezone: true }).notNull(),
    slotEnd: timestamp("slot_end", { mode: "date", withTimezone: true }).notNull(),
    seat: smallint("seat").notNull(),
    status: text("status").notNull().default("booked"),
    bookedByUserId: text("booked_by_user_id").references(() => user.id, { onDelete: "set null" }),
    bookedVia: text("booked_via").notNull().default("client"),
    overCapacity: boolean("over_capacity").notNull().default(false),
    overCapacityReason: text("over_capacity_reason"),
    collectorKind: text("collector_kind").notNull(),
    collectorName: text("collector_name").notNull(),
    collectorEmail: text("collector_email"),
    collectorCompany: text("collector_company"),
    collectorUserId: text("collector_user_id").references(() => user.id, { onDelete: "set null" }),
    authorisedByUserId: text("authorised_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    authorisedAt: timestamp("authorised_at", { mode: "date", withTimezone: true }),
    policyVersion: text("policy_version"),
    icsSequence: integer("ics_sequence").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull(),
    /** A digest of the request made with the key; the same key with another request is refused. */
    requestFingerprint: text("request_fingerprint").notNull(),
    /** The kind of photo ID staff checked; never the number or a copy. */
    idCheckType: text("id_check_type"),
    /** The staff member who handed over or marked the visit not collected. */
    outcomeByUserId: text("outcome_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** When the visit was handed over or marked not collected; starts the undo window. */
    outcomeAt: timestamp("outcome_at", { mode: "date", withTimezone: true }),
    cancelledByUserId: text("cancelled_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
    /** Set when the collector's email and company (and, for an unhanded visit, name) were erased. */
    personalDetailsErasedAt: timestamp("personal_details_erased_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Set when the retained hand-over record (collector name and ID type) was cleared. */
    handoverRecordClearedAt: timestamp("handover_record_cleared_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "collection_booking_status_check",
      sql`${table.status} IN ('booked', 'collected', 'partly_collected', 'not_collected', 'cancelled')`,
    ),
    check("collection_booking_booked_via_check", sql`${table.bookedVia} IN ('client', 'staff')`),
    check(
      "collection_booking_collector_kind_check",
      sql`${table.collectorKind} IN ('self', 'member', 'third_party')`,
    ),
    check(
      "collection_booking_id_check_type_check",
      sql`${table.idCheckType} IS NULL OR ${table.idCheckType} IN ('passport', 'driving_licence', 'national_identity_card', 'other_photo_id')`,
    ),
    check("collection_booking_slot_check", sql`${table.slotEnd} > ${table.slotStart}`),
    check("collection_booking_seat_check", sql`${table.seat} BETWEEN 1 AND 50`),
    check("collection_booking_sequence_check", sql`${table.icsSequence} >= 0`),
    check(
      "collection_booking_over_capacity_check",
      sql`${table.overCapacity} = false OR ${table.bookedVia} = 'staff'`,
    ),
    uniqueIndex("collection_booking_reference_uidx").on(table.reference),
    uniqueIndex("collection_booking_idempotency_uidx").on(
      table.legalEntityId,
      table.idempotencyKey,
    ),
    uniqueIndex("collection_booking_seat_live_uidx")
      .on(table.venueId, table.slotStart, table.seat)
      .where(sql`${table.status} = 'booked'`),
    index("collection_booking_day_idx").on(table.venueId, table.slotStart),
    index("collection_booking_account_idx").on(table.legalEntityId, table.slotStart.desc()),
    index("collection_booking_booked_by_idx")
      .on(table.bookedByUserId)
      .where(sql`${table.bookedByUserId} IS NOT NULL`),
  ],
);

/** The lots in a visit. A lot is in at most one live (active) booking. */
export const collectionBookingLot = pgTable(
  "collection_booking_lot",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => collectionBooking.id, { onDelete: "restrict" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "restrict" }),
    active: boolean("active").notNull().default(true),
    outcome: text("outcome"),
  },
  (table) => [
    primaryKey({ name: "collection_booking_lot_pkey", columns: [table.bookingId, table.lotId] }),
    check(
      "collection_booking_lot_outcome_check",
      sql`${table.outcome} IS NULL OR ${table.outcome} IN ('collected', 'left')`,
    ),
    uniqueIndex("collection_booking_lot_active_uidx").on(table.lotId).where(sql`${table.active}`),
    index("collection_booking_lot_lot_idx").on(table.lotId),
  ],
);
