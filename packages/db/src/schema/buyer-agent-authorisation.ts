import { relations, sql } from "drizzle-orm";
import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { sale } from "./sales.js";

export const buyerAgentAuthorisationStatusEnum = pgEnum("buyer_agent_authorisation_status", [
  "active",
  "revoked",
]);

export const buyerAgentAuthorisation = pgTable(
  "buyer_agent_authorisation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id").references(() => sale.id, { onDelete: "cascade" }),
    bidLimit: numeric("bid_limit", { precision: 18, scale: 2 }),
    validFrom: timestamp("valid_from", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { mode: "date", withTimezone: true }),
    status: buyerAgentAuthorisationStatusEnum("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("buyer_agent_auth_active_uidx")
      .on(
        table.legalEntityId,
        table.userId,
        sql`(COALESCE(${table.saleId}, '00000000-0000-0000-0000-000000000000'::uuid))`,
      )
      .where(sql`${table.status} = 'active'`),
    index("buyer_agent_auth_entity_user_active_idx")
      .on(table.legalEntityId, table.userId)
      .where(sql`${table.status} = 'active'`),
    index("buyer_agent_auth_sale_idx").on(table.saleId).where(sql`${table.saleId} IS NOT NULL`),
  ],
);

export const buyerAgentAuthorisationRelations = relations(buyerAgentAuthorisation, ({ one }) => ({
  legalEntity: one(legalEntity, {
    fields: [buyerAgentAuthorisation.legalEntityId],
    references: [legalEntity.id],
  }),
  user: one(user, {
    fields: [buyerAgentAuthorisation.userId],
    references: [user.id],
  }),
  sale: one(sale, {
    fields: [buyerAgentAuthorisation.saleId],
    references: [sale.id],
  }),
}));
