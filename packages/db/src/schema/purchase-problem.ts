import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";
import { payment } from "./payments.js";

/**
 * A buyer's report of a problem with a paid purchase. A lot has at most one open report per
 * buying account; reporting again while one is open returns it. The client services team works
 * the report from the staff work inbox and resolves it.
 */
export const purchaseProblem = pgTable(
  "purchase_problem",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("open"),
    category: text("category").notNull(),
    /** What the buyer wrote. Personal data: never copied into events or logs. */
    message: text("message").notNull(),
    reportedByUserId: text("reported_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("purchase_problem_open_uidx")
      .on(table.lotId, table.buyerLegalEntityId)
      .where(sql`${table.status} = 'open'`),
    index("purchase_problem_open_created_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'open'`),
    check("purchase_problem_status_check", sql`${table.status} IN ('open', 'resolved')`),
    check(
      "purchase_problem_category_check",
      sql`${table.category} IN ('not_as_described', 'damaged', 'not_received', 'invoice_or_payment', 'other')`,
    ),
    check(
      "purchase_problem_resolved_check",
      sql`(${table.status} = 'resolved') = (${table.resolvedAt} IS NOT NULL)`,
    ),
  ],
);
