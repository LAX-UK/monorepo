import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { lot } from "./lots.js";
import { uploadObject } from "./upload-objects.js";

export const lotDocument = pgTable(
  "lot_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label"),
    uploadObjectId: uuid("upload_object_id")
      .notNull()
      .references(() => uploadObject.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [index("lot_document_lot_id_idx").on(table.lotId)],
);

export const lotDocumentRelations = relations(lotDocument, ({ one }) => ({
  lot: one(lot, {
    fields: [lotDocument.lotId],
    references: [lot.id],
  }),
  upload: one(uploadObject, {
    fields: [lotDocument.uploadObjectId],
    references: [uploadObject.id],
  }),
}));
