import { relations } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot } from "./lots.js";
import { payment } from "./payments.js";

export const lotFulfilmentStatusEnum = pgEnum("lot_fulfilment_status", [
  "awaiting_payment",
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
]);

export const lotFulfilmentMethodEnum = pgEnum("lot_fulfilment_method", ["collection", "shipping"]);

export const lotFulfilment = pgTable(
  "lot_fulfilment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .unique()
      .references(() => lot.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payment.id, { onDelete: "set null" }),
    status: lotFulfilmentStatusEnum("status").notNull().default("awaiting_payment"),
    releaseApprovedByUserId: text("release_approved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    releaseApprovedAt: timestamp("release_approved_at", { mode: "date", withTimezone: true }),
    fulfilmentMethod: lotFulfilmentMethodEnum("fulfilment_method"),
    shippingCarrier: text("shipping_carrier"),
    trackingNumber: text("tracking_number"),
    collectedBy: text("collected_by"),
    collectedAt: timestamp("collected_at", { mode: "date", withTimezone: true }),
    addressSnapshot: jsonb("address_snapshot").$type<Record<string, unknown>>(),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lot_fulfilment_status_updated_idx").on(table.status, table.updatedAt)],
);

export const lotFulfilmentRelations = relations(lotFulfilment, ({ one }) => ({
  lot: one(lot, {
    fields: [lotFulfilment.lotId],
    references: [lot.id],
  }),
}));
