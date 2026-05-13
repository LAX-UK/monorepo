import { relations } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { lot } from "./lots.js";
import { sale } from "./sales.js";

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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  () => [],
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
}));

export const saleroomEventRelations = relations(saleroomEvent, ({ one }) => ({
  session: one(saleroomSession, {
    fields: [saleroomEvent.sessionId],
    references: [saleroomSession.id],
  }),
}));
