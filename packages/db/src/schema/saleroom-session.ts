import type { SaleroomDisplayOverlay } from "@auction/types";
import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot } from "./lots.js";
import { sale } from "./sales.js";

export type { SaleroomDisplayOverlay };

export const saleroomSessionStatusEnum = pgEnum("saleroom_session_status", [
  "pending",
  "live",
  "paused",
  "ended",
]);

export const saleroomSession = pgTable(
  "saleroom_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .unique()
      .references(() => sale.id, { onDelete: "cascade" }),
    status: saleroomSessionStatusEnum("status").notNull().default("pending"),
    currentLotId: uuid("current_lot_id").references(() => lot.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
    endedAt: timestamp("ended_at", { mode: "date", withTimezone: true }),
    clerkUserId: text("clerk_user_id").references(() => user.id, { onDelete: "set null" }),
    auctioneerUserId: text("auctioneer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    displayOverlay: jsonb("display_overlay").$type<SaleroomDisplayOverlay | null>(),
    displayOverlayAt: timestamp("display_overlay_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  () => [],
);

export const saleroomDisplayPairingStatusEnum = pgEnum("saleroom_display_pairing_status", [
  "pending",
  "paired",
  "revoked",
  "expired",
]);

export const saleroomDisplayPairing = pgTable(
  "saleroom_display_pairing",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id").references(() => sale.id, { onDelete: "cascade" }),
    deviceCodeHash: text("device_code_hash").notNull().unique(),
    userCode: text("user_code").notNull(),
    displayTokenHash: text("display_token_hash"),
    status: saleroomDisplayPairingStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    pairedAt: timestamp("paired_at", { mode: "date", withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true }),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("saleroom_display_pairing_user_code_pending_idx")
      .on(table.userCode)
      .where(sql`${table.status} = 'pending'`),
    index("saleroom_display_pairing_sale_id_idx")
      .on(table.saleId)
      .where(sql`${table.saleId} IS NOT NULL`),
    index("saleroom_display_pairing_display_token_hash_idx")
      .on(table.displayTokenHash)
      .where(sql`${table.displayTokenHash} IS NOT NULL`),
  ],
);

export const saleroomEventKindEnum = pgEnum("saleroom_event_kind", [
  "opened",
  "advanced_to_lot",
  "hammer",
  "no_sale",
  "paused",
  "resumed",
  "closed",
]);

export const saleroomEvent = pgTable(
  "saleroom_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => saleroomSession.id, { onDelete: "cascade" }),
    kind: saleroomEventKindEnum("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("saleroom_event_session_occurred_idx").on(table.sessionId, table.occurredAt)],
);

export const saleroomSessionRelations = relations(saleroomSession, ({ one, many }) => ({
  sale: one(sale, {
    fields: [saleroomSession.saleId],
    references: [sale.id],
  }),
  events: many(saleroomEvent),
  displayPairings: many(saleroomDisplayPairing),
}));

export const saleroomDisplayPairingRelations = relations(saleroomDisplayPairing, ({ one }) => ({
  sale: one(sale, {
    fields: [saleroomDisplayPairing.saleId],
    references: [sale.id],
  }),
  approvedBy: one(user, {
    fields: [saleroomDisplayPairing.approvedByUserId],
    references: [user.id],
  }),
}));

export const saleroomEventRelations = relations(saleroomEvent, ({ one }) => ({
  session: one(saleroomSession, {
    fields: [saleroomEvent.sessionId],
    references: [saleroomSession.id],
  }),
}));
