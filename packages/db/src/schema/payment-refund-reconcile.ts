import { relations, sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { payment } from "./payments.js";

/** Durable queue when Stripe refund succeeded but local DB persist failed. */
export const paymentRefundReconcile = pgTable(
  "payment_refund_reconcile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .unique()
      .references(() => payment.id, { onDelete: "cascade" }),
    stripeRefundId: text("stripe_refund_id"),
    adminUserId: text("admin_user_id"),
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    reconciledAt: timestamp("reconciled_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_refund_reconcile_pending_idx")
      .on(table.createdAt)
      .where(sql`${table.reconciledAt} IS NULL`),
  ],
);

export const paymentRefundReconcileRelations = relations(paymentRefundReconcile, ({ one }) => ({
  payment: one(payment, {
    fields: [paymentRefundReconcile.paymentId],
    references: [payment.id],
  }),
}));
