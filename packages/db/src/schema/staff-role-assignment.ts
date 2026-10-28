import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user, userStaffRoleEnum } from "./auth.js";
import { bidUserProfile } from "./bid-user-profile.js";

/**
 * The Bid staff roles a person holds, each for a period. Permissions are the union of the roles
 * in force. Removing a role ends its row, so the history stays. At most one open-ended row per
 * person and role; overlapping time-limited rows are refused by the role rules under the roster
 * lock.
 */
export const staffRoleAssignment = pgTable(
  "staff_role_assignment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bidUserProfile.userId, { onDelete: "cascade" }),
    role: userStaffRoleEnum("role").notNull(),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    /** Null for assignments created by the migration from the single staff role. */
    grantedByUserId: text("granted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    reason: text("reason"),
    /**
     * When the end was recorded: at removal, or by the daily expiry job once `ends_at` passed.
     * Null while the assignment is open or its end date is still to come.
     */
    endRecordedAt: timestamp("end_recorded_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("staff_role_assignment_open_uidx")
      .on(table.userId, table.role)
      .where(sql`${table.endsAt} IS NULL`),
    index("staff_role_assignment_user_idx").on(table.userId),
    index("staff_role_assignment_role_idx").on(table.role),
    index("staff_role_assignment_unrecorded_end_idx")
      .on(table.endsAt)
      .where(sql`${table.endsAt} IS NOT NULL AND ${table.endRecordedAt} IS NULL`),
  ],
);
