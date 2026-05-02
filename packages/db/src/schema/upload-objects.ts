import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const uploadObject = pgTable(
  "upload_object",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    key: text("key").notNull().unique(),
    declaredContentType: text("declared_content_type").notNull(),
    declaredByteSize: integer("declared_byte_size").notNull(),
    actualContentType: text("actual_content_type"),
    actualByteSize: integer("actual_byte_size"),
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    uploadedAt: timestamp("uploaded_at", { mode: "date", withTimezone: true }),
    validatedAt: timestamp("validated_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("upload_object_owner_status_idx").on(table.ownerUserId, table.status),
    index("upload_object_status_expires_idx").on(table.status, table.expiresAt),
  ],
);
