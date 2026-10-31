import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

/**
 * A member's request for more access in an organisation: a role, or one capability their role
 * lacks, with their reason. Owners and admins approve (by giving a role) or decline it. A member
 * has at most one pending request per role or capability, so asking twice changes nothing.
 */
export const accessRequest = pgTable(
  "access_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Exactly one of the role or the capability asked for. */
    requestedRole: text("requested_role"),
    requestedCapability: text("requested_capability"),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    /** The role given on approval. */
    grantedRole: text("granted_role"),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { mode: "date", withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("access_request_pending_uidx")
      .on(
        table.legalEntityId,
        table.requesterUserId,
        sql`coalesce(${table.requestedRole}, '')`,
        sql`coalesce(${table.requestedCapability}, '')`,
      )
      .where(sql`${table.status} = 'pending'`),
    index("access_request_entity_status_idx").on(table.legalEntityId, table.status),
    check(
      "access_request_status_check",
      sql`${table.status} IN ('pending', 'approved', 'declined', 'withdrawn')`,
    ),
    check(
      "access_request_ask_check",
      sql`(${table.requestedRole} IS NULL) <> (${table.requestedCapability} IS NULL)`,
    ),
  ],
);
