import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { sale } from "./sales.js";

export const saleRegistrationStatusEnum = pgEnum("sale_registration_status", [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
]);

export const saleRegistration = pgTable(
  "sale_registration",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    status: saleRegistrationStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { mode: "date", withTimezone: true }),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, { onDelete: "set null" }),
    bidLimit: numeric("bid_limit", { precision: 18, scale: 2 }),
    /** In-room paddle number for this sale (assigned at check-in). */
    paddleNumber: integer("paddle_number"),
    checkedInAt: timestamp("checked_in_at", { mode: "date", withTimezone: true }),
    laxNotes: text("lax_notes"),
    rejectionReason: text("rejection_reason"),
  },
  (table) => [
    unique("sale_registration_user_sale_entity_uid").on(
      table.saleId,
      table.userId,
      table.buyerLegalEntityId,
    ),
    index("sale_registration_sale_id_status_idx")
      .on(table.saleId, table.status)
      .where(sql`${table.status} = 'approved'`),
    index("sale_registration_user_id_idx").on(table.userId),
    unique("sale_registration_sale_paddle_uid").on(table.saleId, table.paddleNumber),
  ],
);

export const saleRegistrationRelations = relations(saleRegistration, ({ one }) => ({
  sale: one(sale, {
    fields: [saleRegistration.saleId],
    references: [sale.id],
  }),
  buyerLegalEntity: one(legalEntity, {
    fields: [saleRegistration.buyerLegalEntityId],
    references: [legalEntity.id],
  }),
  user: one(user, {
    fields: [saleRegistration.userId],
    references: [user.id],
  }),
}));
