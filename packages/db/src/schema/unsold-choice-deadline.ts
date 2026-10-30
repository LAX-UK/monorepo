import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { lot } from "./lots.js";

/**
 * The date by which the seller chooses what happens to a lot that ended unsold, one per unsold
 * outcome (the lot and the end time it did not sell at). It is set from the unsold-choice window
 * the first time the outcome is shown and then kept, so a date a seller has been told never moves
 * if the window changes later; a relisted lot that ends unsold again gets its own row.
 */
export const unsoldChoiceDeadline = pgTable(
  "unsold_choice_deadline",
  {
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    lotEndTime: timestamp("lot_end_time", { mode: "date", withTimezone: true }).notNull(),
    chooseBy: timestamp("choose_by", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "unsold_choice_deadline_pk", columns: [table.lotId, table.lotEndTime] }),
  ],
);
