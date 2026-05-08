import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

export const legalEntityMemberRoleEnum = pgEnum("legal_entity_member_role", [
  "owner",
  "admin",
  "consignor",
  "finance",
  "buyer_agent",
  "viewer",
  "specialist",
  "staff",
]);

export const legalEntityMember = pgTable(
  "legal_entity_member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: legalEntityMemberRoleEnum("role").notNull(),
    isPrimaryAdmin: boolean("is_primary_admin").notNull().default(false),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at", { mode: "date", withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    removedAt: timestamp("removed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_entity_member_active_uidx")
      .on(table.legalEntityId, table.userId)
      .where(sql`${table.removedAt} IS NULL`),
    uniqueIndex("legal_entity_member_primary_admin_uidx")
      .on(table.legalEntityId)
      .where(sql`${table.isPrimaryAdmin} = true AND ${table.removedAt} IS NULL`),
    index("legal_entity_member_user_active_idx")
      .on(table.userId)
      .where(sql`${table.removedAt} IS NULL`),
    index("legal_entity_member_entity_role_idx")
      .on(table.legalEntityId, table.role)
      .where(sql`${table.removedAt} IS NULL`),
    check(
      "legal_entity_member_primary_admin_role",
      sql`NOT ${table.isPrimaryAdmin} OR ${table.role} IN ('owner', 'admin')`,
    ),
  ],
);

export const legalEntityMemberRelations = relations(legalEntityMember, ({ one }) => ({
  legalEntity: one(legalEntity, {
    fields: [legalEntityMember.legalEntityId],
    references: [legalEntity.id],
  }),
  user: one(user, {
    fields: [legalEntityMember.userId],
    references: [user.id],
  }),
  invitedBy: one(user, {
    fields: [legalEntityMember.invitedByUserId],
    references: [user.id],
  }),
}));
