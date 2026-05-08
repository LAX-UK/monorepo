import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { legalEntity } from "./legal-entities.js";

export const legalEntityAddress = pgTable(
  "legal_entity_address",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    addressType: text("address_type").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state"),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("legal_entity_address_entity_type_idx").on(table.legalEntityId, table.addressType),
  ],
);

export const legalEntityAddressRelations = relations(legalEntityAddress, ({ one }) => ({
  legalEntity: one(legalEntity, {
    fields: [legalEntityAddress.legalEntityId],
    references: [legalEntity.id],
  }),
}));
