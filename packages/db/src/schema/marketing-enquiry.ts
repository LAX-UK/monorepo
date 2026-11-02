import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * A message sent through the public contact form. Client services work it from the staff work
 * inbox and mark it handled. Name, email, phone and message are personal data: never copied into
 * events or logs.
 */
export const marketingEnquiry = pgTable(
  "marketing_enquiry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The contact form topic: buying, selling, shipping, press or other. */
    topic: text("topic").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message").notNull(),
    /** The page the form was sent from, as a path. */
    sourcePage: text("source_page"),
    status: text("status").notNull().default("new"),
    handledAt: timestamp("handled_at", { mode: "date", withTimezone: true }),
    handledByUserId: text("handled_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("marketing_enquiry_new_created_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'new'`),
    check("marketing_enquiry_status_check", sql`${table.status} IN ('new', 'handled')`),
    check(
      "marketing_enquiry_handled_check",
      sql`(${table.status} = 'handled') = (${table.handledAt} IS NOT NULL)`,
    ),
  ],
);
