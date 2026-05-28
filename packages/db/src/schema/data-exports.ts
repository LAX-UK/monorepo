import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const dataExport = pgTable(
  "data_exports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userRole: text("user_role").notNull(),
    userStaffRole: text("user_staff_role"),
    entityType: text("entity_type").notNull(),
    format: text("format").notNull().default("csv"),
    filters: jsonb("filters").notNull(),
    filtersHash: text("filters_hash").notNull(),
    status: text("status").notNull().default("pending"),
    phase: text("phase"),
    progress: integer("progress").notNull().default(0),
    totalRows: integer("total_rows"),
    processedRows: integer("processed_rows"),
    s3Key: text("s3_key"),
    fileSizeBytes: integer("file_size_bytes"),
    errorMessage: text("error_message"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("data_exports_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("data_exports_status_idx").on(table.status),
    index("data_exports_filters_hash_idx").on(table.userId, table.filtersHash),
  ],
);
