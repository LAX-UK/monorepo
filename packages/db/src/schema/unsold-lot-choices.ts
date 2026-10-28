import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { itemSubmission } from "./item-submissions.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";

/**
 * What happens to a consigned lot that ended without selling: the seller's request (relist,
 * optionally with a lower reserve, private sale, or collection) and the specialist's
 * confirmation. A lot relisted and unsold again gets a new row: one per unsold outcome.
 */
export const unsoldLotChoice = pgTable(
  "unsold_lot_choice",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => itemSubmission.id, { onDelete: "cascade" }),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    /**
     * The end time of the sale the lot did not sell in. A relisted lot ends at a new time, so
     * each unsold outcome has its own choice.
     */
    lotEndTime: timestamp("lot_end_time", { mode: "date", withTimezone: true }).notNull(),
    status: text("status").notNull(),
    requestedChoice: text("requested_choice"),
    requestedReserve: numeric("requested_reserve", { precision: 18, scale: 2 }),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    requestedAt: timestamp("requested_at", { mode: "date", withTimezone: true }),
    decidedChoice: text("decided_choice"),
    decidedReserve: numeric("decided_reserve", { precision: 18, scale: 2 }),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { mode: "date", withTimezone: true }),
    staffNote: text("staff_note"),
    currency: text("currency").notNull().default("GBP"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("unsold_lot_choice_lot_id_idx").on(table.lotId),
    index("unsold_lot_choice_submission_id_idx").on(table.submissionId),
    uniqueIndex("unsold_lot_choice_outcome_uidx").on(table.lotId, table.lotEndTime),
    index("unsold_lot_choice_requested_idx")
      .on(table.requestedAt)
      .where(sql`${table.status} = 'requested'`),
    check("unsold_lot_choice_status_check", sql`${table.status} IN ('requested', 'confirmed')`),
    check(
      "unsold_lot_choice_choice_check",
      sql`(${table.requestedChoice} IS NULL OR ${table.requestedChoice} IN ('relist', 'private_sale', 'collect'))
        AND (${table.decidedChoice} IS NULL OR ${table.decidedChoice} IN ('relist', 'private_sale', 'collect'))`,
    ),
  ],
);
