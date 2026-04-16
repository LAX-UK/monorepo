import { relations } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { auction } from "./auctions.js";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "captured",
  "refunded",
]);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auction.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    platformFee: numeric("platform_fee", { precision: 18, scale: 2 }).notNull(),
    /** Nullable external id from the chosen payment gateway (DB column name is legacy). */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payment_auction_id_idx").on(table.auctionId),
    index("payment_buyer_id_idx").on(table.buyerId),
  ],
);

export const paymentRelations = relations(payment, ({ one }) => ({
  auction: one(auction, {
    fields: [payment.auctionId],
    references: [auction.id],
  }),
  buyer: one(user, {
    fields: [payment.buyerId],
    references: [user.id],
  }),
  seller: one(user, {
    fields: [payment.sellerId],
    references: [user.id],
  }),
}));
