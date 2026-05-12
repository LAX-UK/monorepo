import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";
import { uploadObject } from "./upload-objects.js";

export const conditionReportRequestStatusEnum = pgEnum("condition_report_request_status", [
  "pending",
  "in_progress",
  "fulfilled",
  "declined",
]);

export const conditionReportRequest = pgTable(
  "condition_report_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestingLegalEntityId: uuid("requesting_legal_entity_id").references(() => legalEntity.id, {
      onDelete: "set null",
    }),
    status: conditionReportRequestStatusEnum("status").notNull().default("pending"),
    requestNote: text("request_note"),
    responseNote: text("response_note"),
    responseAttachmentUploadId: uuid("response_attachment_upload_id").references(
      () => uploadObject.id,
      { onDelete: "set null" },
    ),
    fulfilledByUserId: text("fulfilled_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    fulfilledAt: timestamp("fulfilled_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("condition_report_request_lot_id_idx").on(table.lotId),
    index("condition_report_request_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const conditionReportRequestRelations = relations(conditionReportRequest, ({ one }) => ({
  lot: one(lot, {
    fields: [conditionReportRequest.lotId],
    references: [lot.id],
  }),
}));
