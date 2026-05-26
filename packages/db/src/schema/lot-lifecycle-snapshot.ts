import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot, lotStatusEnum } from "./lots.js";
import { sale } from "./sales.js";

export const lotLifecycleSnapshot = pgTable(
  "lot_lifecycle_snapshot",
  {
    lotId: uuid("lot_id")
      .primaryKey()
      .references(() => lot.id, { onDelete: "cascade" }),
    currentStatus: lotStatusEnum("current_status").notNull(),
    lastEventType: text("last_event_type").notNull(),
    lastEventAt: timestamp("last_event_at", { mode: "date", withTimezone: true }).notNull(),
    lastActorUserId: text("last_actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastSaleId: uuid("last_sale_id").references(() => sale.id, { onDelete: "set null" }),
    lastSaleOutcome: text("last_sale_outcome"),
    lastSaleEndedAt: timestamp("last_sale_ended_at", { mode: "date", withTimezone: true }),
    returnedToInventoryAt: timestamp("returned_to_inventory_at", {
      mode: "date",
      withTimezone: true,
    }),
    returnCount: integer("return_count").notNull().default(0),
    attachedCount: integer("attached_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lot_snap_last_event_idx").on(table.lastEventAt),
    index("lot_snap_returned_at_idx").on(table.returnedToInventoryAt),
    index("lot_snap_outcome_idx").on(table.lastSaleOutcome),
  ],
);

export const lotLifecycleSnapshotRelations = relations(lotLifecycleSnapshot, ({ one }) => ({
  lot: one(lot, {
    fields: [lotLifecycleSnapshot.lotId],
    references: [lot.id],
  }),
  lastSale: one(sale, {
    fields: [lotLifecycleSnapshot.lastSaleId],
    references: [sale.id],
  }),
}));
