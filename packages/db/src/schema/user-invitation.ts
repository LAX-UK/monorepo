import { relations, sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user, userStaffRoleEnum } from "./auth.js";
import { emailOutbox } from "./email.js";
import { legalEntity } from "./legal-entities.js";

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const userInvitation = pgTable(
  "user_invitation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    targetRole: text("target_role").notNull(),
    /** Required when `targetRole` is `staff`. */
    targetStaffRole: userStaffRoleEnum("target_staff_role"),
    tokenHash: text("token_hash").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    /** First successful preview of the invite registration link (does not imply email delivery). */
    openedAt: timestamp("opened_at", { mode: "date", withTimezone: true }),
    lastEmailOutboxId: uuid("last_email_outbox_id").references(() => emailOutbox.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    acceptedUserId: text("accepted_user_id").references(() => user.id, { onDelete: "set null" }),
    /** entity-scoped invitation (optional; coexists with targetRole for platform invites) */
    targetLegalEntityId: uuid("target_legal_entity_id").references(() => legalEntity.id, {
      onDelete: "cascade",
    }),
    targetLegalEntityMemberRole: text("target_legal_entity_member_role"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_invitation_email_idx").on(table.email),
    index("user_invitation_created_by_idx").on(table.createdByUserId),
    index("user_invitation_target_legal_entity_idx").on(table.targetLegalEntityId),
    // At most one pending *platform* invitation per email (entity invites excluded).
    uniqueIndex("user_invitation_pending_platform_email_uidx")
      .on(sql`lower(${table.email})`)
      .where(sql`status = 'pending' AND target_legal_entity_id IS NULL`),
  ],
);

export const userInvitationRelations = relations(userInvitation, ({ one }) => ({
  createdBy: one(user, {
    fields: [userInvitation.createdByUserId],
    references: [user.id],
  }),
  acceptedUser: one(user, {
    fields: [userInvitation.acceptedUserId],
    references: [user.id],
  }),
  targetLegalEntity: one(legalEntity, {
    fields: [userInvitation.targetLegalEntityId],
    references: [legalEntity.id],
  }),
}));
