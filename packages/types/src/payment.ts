import type { Auction } from "./auction.js";

export const paymentStatuses = ["pending", "authorized", "captured", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

/** Winner portfolio row from `GET /users/me/portfolio`. */
export type PortfolioRow = {
  auction: Auction;
  payment: { id: string; status: PaymentStatus } | null;
};
