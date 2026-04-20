import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { category } from "./categories.js";

export const saleStatusEnum = pgEnum("sale_status", [
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
]);

export const saleDeliveryModeEnum = pgEnum("sale_delivery_mode", ["online", "onsite", "hybrid"]);

export const sale = pgTable(
  "sale",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    coverImages: text("cover_images").array().notNull().default([]),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    deliveryMode: saleDeliveryModeEnum("delivery_mode").notNull().default("onsite"),
    streamUrl: text("stream_url"),
    status: saleStatusEnum("status").notNull().default("draft"),
    startTime: timestamp("start_time", { mode: "date", withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { mode: "date", withTimezone: true }).notNull(),
    previewStartTime: timestamp("preview_start_time", {
      mode: "date",
      withTimezone: true,
    }),
    buyerPremiumRate: numeric("buyer_premium_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0.25"),
    terms: text("terms"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sale_category_id_idx").on(table.categoryId),
    index("sale_status_end_time_idx").on(table.status, table.endTime),
    index("sale_created_by_idx").on(table.createdBy),
  ],
);
