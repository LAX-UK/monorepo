import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

export const venueStatusEnum = pgEnum("venue_status", ["active", "archived"]);

export const venue = pgTable(
  "venue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug"),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    county: text("county"),
    postcode: text("postcode").notNull(),
    country: text("country").notNull(),
    mapUrl: text("map_url"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    openingHours: jsonb("opening_hours").$type<Record<string, unknown> | null>(),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    website: text("website"),
    photos: text("photos").array().notNull().default([]),
    capacity: integer("capacity"),
    accessNotes: text("access_notes"),
    parkingNotes: text("parking_notes"),
    directionsNotes: text("directions_notes"),
    status: venueStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("venue_legal_entity_id_idx").on(table.legalEntityId),
    index("venue_status_idx").on(table.status),
    index("venue_not_deleted_idx").on(table.id).where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("venue_legal_entity_slug_uidx")
      .on(table.legalEntityId, table.slug)
      .where(sql`${table.slug} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    check(
      "venue_latitude_range",
      sql`${table.latitude} IS NULL OR (${table.latitude} >= -90 AND ${table.latitude} <= 90)`,
    ),
    check(
      "venue_longitude_range",
      sql`${table.longitude} IS NULL OR (${table.longitude} >= -180 AND ${table.longitude} <= 180)`,
    ),
  ],
);
