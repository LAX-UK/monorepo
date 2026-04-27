import type { Lot } from "./lot.js";

export const paymentStatuses = ["pending", "authorized", "captured", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

/** Response from `POST /payments` (checkout). */
export type CreatePaymentResponse = {
  paymentId: string;
  clientSecret: string | null;
  checkoutUrl: string | null;
};

/** Winner portfolio row from `GET /users/me/portfolio`. */
export type PortfolioRow = {
  lot: Lot;
  payment: { id: string; status: PaymentStatus } | null;
};
