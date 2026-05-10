import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot } from "./lots.js";

export const adminReviewTaskKindEnum = pgEnum("admin_review_task_kind", [
  "lot_artist_backfill",
  "artist_merge_review",
  "legal_entity_kyb_review",
  "payout_adjustment_review",
  "lot_withdrawal_request",
]);

export const adminReviewTaskStatusEnum = pgEnum("admin_review_task_status", [
  "pending",
  "in_progress",
  "resolved",
  "rejected",
]);

export const adminReviewTask = pgTable(
  "admin_review_task",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: adminReviewTaskKindEnum("kind").notNull(),
    status: adminReviewTaskStatusEnum("status").notNull().default("pending"),
    targetLotId: uuid("target_lot_id").references(() => lot.id, {
      onDelete: "cascade",
    }),
    // Flexible payload for task-specific data (e.g., ambiguous artist candidates)
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { mode: "date", withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_review_task_kind_status_idx").on(table.kind, table.status),
    index("admin_review_task_target_lot_idx").on(table.targetLotId),
    index("admin_review_task_assigned_to_idx").on(table.assignedToUserId),
    index("admin_review_task_pending_created_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const adminReviewTaskRelations = relations(adminReviewTask, ({ one }) => ({
  targetLot: one(lot, {
    fields: [adminReviewTask.targetLotId],
    references: [lot.id],
  }),
  assignedTo: one(user, {
    fields: [adminReviewTask.assignedToUserId],
    references: [user.id],
  }),
  resolvedBy: one(user, {
    fields: [adminReviewTask.resolvedByUserId],
    references: [user.id],
  }),
}));
