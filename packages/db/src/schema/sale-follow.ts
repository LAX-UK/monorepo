import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { sale } from "./sales.js";

/** User follows a saleroom (sale) for updates. */
export const saleFollow = pgTable(
  "sale_follow",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("sale_follow_user_sale_uid").on(table.userId, table.saleId),
    index("sale_follow_user_id_idx").on(table.userId),
    index("sale_follow_sale_id_idx").on(table.saleId),
  ],
);
