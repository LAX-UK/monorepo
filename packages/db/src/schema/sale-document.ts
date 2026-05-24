import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { sale } from "./sales.js";
import { uploadObject } from "./upload-objects.js";

export const saleDocument = pgTable(
  "sale_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label"),
    uploadObjectId: uuid("upload_object_id")
      .notNull()
      .references(() => uploadObject.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [index("sale_document_sale_id_idx").on(table.saleId)],
);

export const saleDocumentRelations = relations(saleDocument, ({ one }) => ({
  sale: one(sale, {
    fields: [saleDocument.saleId],
    references: [sale.id],
  }),
  upload: one(uploadObject, {
    fields: [saleDocument.uploadObjectId],
    references: [uploadObject.id],
  }),
  createdBy: one(user, {
    fields: [saleDocument.createdByUserId],
    references: [user.id],
  }),
}));
