import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * A data request whose enquiry erasure was held by a private sale deal, one row per request
 * reference. `waiting` rows are re-run once `recheck_at` passes; `needs_staff` rows are shown in
 * the Data requests queue because nothing will release them by themselves. The row goes when the
 * erasure completes. No personal data: the reference, who asked, dates and why.
 */
export const dataRequestErasureHold = pgTable(
  "data_request_erasure_hold",
  {
    reference: text("reference").primaryKey(),
    /** The staff member whose erasure was held; the re-run acts for them. */
    requestedByUserId: text("requested_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    state: text("state").notNull(),
    /** `running`, `open_deal`, `end_unknown`, `still_held` or `cannot_run`. */
    reason: text("reason").notNull(),
    /** When the hold ends; null while a deal is open or the end is not known. */
    heldUntil: timestamp("held_until", { mode: "date", withTimezone: true }),
    /** When a `waiting` row is next re-run. */
    recheckAt: timestamp("recheck_at", { mode: "date", withTimezone: true }),
    /** A re-run has the row until then, so two runs never take the same request. */
    claimedUntil: timestamp("claimed_until", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("data_request_erasure_hold_due_idx")
      .on(table.recheckAt)
      .where(sql`${table.state} = 'waiting'`),
    check("data_request_erasure_hold_state_ck", sql`${table.state} IN ('waiting', 'needs_staff')`),
    check(
      "data_request_erasure_hold_reason_ck",
      sql`${table.reason} IN ('running', 'open_deal', 'end_unknown', 'still_held', 'cannot_run')`,
    ),
    check(
      "data_request_erasure_hold_waiting_ck",
      sql`${table.state} <> 'waiting' OR ${table.recheckAt} IS NOT NULL`,
    ),
  ],
);
