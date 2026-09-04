export { ssfDelivery, ssfStream } from "@auction/identity-db/schema/ssf";

import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Receiver-local replay ledgers; each row is committed with the projection. */
export const bidSsfReplay = pgTable(
  "bid_ssf_replay",
  {
    jti: text("jti").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bid_ssf_replay_expires_idx").on(table.expiresAt)],
);

export const shopSsfReplay = pgTable(
  "shop_ssf_replay",
  {
    jti: text("jti").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("shop_ssf_replay_expires_idx").on(table.expiresAt)],
);
