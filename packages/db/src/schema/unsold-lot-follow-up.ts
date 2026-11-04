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
import { unsoldLotChoice } from "./unsold-lot-choices.js";

/**
 * The staff work a confirmed unsold-lot choice leaves behind, one per choice: relist the lot
 * (with the reserve agreed with the seller), arrange its return (the return record), or follow
 * it up as a private sale. It stays open until the work is done, which is what keeps it in the
 * staff work inbox, and it guards the agreed reserve so it is applied to the lot once.
 */
export const unsoldLotFollowUp = pgTable(
  "unsold_lot_follow_up",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    choiceId: uuid("choice_id")
      .notNull()
      .references(() => unsoldLotChoice.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    /** The end time of the sale the lot did not sell in: the outcome this work belongs to. */
    lotEndTime: timestamp("lot_end_time", { mode: "date", withTimezone: true }).notNull(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => itemSubmission.id, { onDelete: "cascade" }),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    /** The reserve agreed for a relist; `null` keeps the reserve the lot ended with. */
    reserve: numeric("reserve", { precision: 18, scale: 2 }),
    status: text("status").notNull().default("open"),
    /** When the agreed reserve was put on the lot; set once. */
    reserveAppliedAt: timestamp("reserve_applied_at", { mode: "date", withTimezone: true }),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    completedByUserId: text("completed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("unsold_lot_follow_up_choice_uidx").on(table.choiceId),
    index("unsold_lot_follow_up_lot_idx").on(table.lotId, table.lotEndTime),
    index("unsold_lot_follow_up_submission_idx").on(table.submissionId),
    index("unsold_lot_follow_up_open_idx").on(table.createdAt).where(sql`${table.status} = 'open'`),
    check(
      "unsold_lot_follow_up_kind_check",
      sql`${table.kind} IN ('relist', 'collect', 'private_sale')`,
    ),
    check("unsold_lot_follow_up_status_check", sql`${table.status} IN ('open', 'done')`),
    check(
      "unsold_lot_follow_up_reserve_check",
      sql`${table.reserveAppliedAt} IS NULL OR ${table.kind} = 'relist'`,
    ),
  ],
);
