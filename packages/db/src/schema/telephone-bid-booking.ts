import { relations } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { sale } from "./sales.js";

export const telephoneBidBookingStatusEnum = pgEnum("telephone_bid_booking_status", [
  "requested",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);

export const telephoneBidBooking = pgTable(
  "telephone_bid_booking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    phoneE164: text("phone_e164").notNull(),
    lotIds: uuid("lot_ids").array().notNull().default([]),
    reserveAltMax: numeric("reserve_alt_max", { precision: 18, scale: 2 }),
    status: telephoneBidBookingStatusEnum("status").notNull().default("requested"),
    clerkUserId: text("clerk_user_id").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [index("telephone_bid_booking_sale_idx").on(table.saleId)],
);

export const telephoneBidBookingRelations = relations(telephoneBidBooking, ({ one }) => ({
  sale: one(sale, {
    fields: [telephoneBidBooking.saleId],
    references: [sale.id],
  }),
}));
