import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { artworkRegister } from "./artwork-register.js";

/**
 * The places an artwork can physically be, kept by staff in LAX Admin. Retired rather than
 * deleted, so history keeps reading. Names are unique ignoring case. The constraints are in
 * migration 0404; they are repeated here where drizzle-kit needs them.
 */
export const artworkLocation = pgTable(
  "artwork_location",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    note: text("note"),
    status: text("status").$type<"active" | "retired">().notNull().default("active"),
    version: integer("version").notNull().default(1),
    /** `staff:<user id>`. */
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("artwork_location_name_uid").on(sql`lower(${table.name})`),
    check("artwork_location_status_check", sql`${table.status} IN ('active', 'retired')`),
    check("artwork_location_version_check", sql`${table.version} >= 1`),
  ],
);

/**
 * Append-only: one row per move of an artwork to a location. The latest row is where the artwork
 * is now; a trigger refuses updates and deletes.
 */
export const artworkLocationMove = pgTable(
  "artwork_location_move",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registerId: uuid("register_id")
      .notNull()
      .references(() => artworkRegister.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => artworkLocation.id, { onDelete: "restrict" }),
    movedAt: timestamp("moved_at", { mode: "date", withTimezone: true }).notNull(),
    /** `staff:<user id>`. */
    movedBy: text("moved_by").notNull(),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("artwork_location_move_register_uid").on(table.registerId, table.movedAt),
    index("artwork_location_move_location_idx").on(table.locationId),
  ],
);
