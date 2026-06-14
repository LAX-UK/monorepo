import type { PaymentStatus } from "@auction/types";

/** Payment statuses that represent live or settled buyer exposure for SoF aggregation. */
export const ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "requires_manual_review",
] as const satisfies readonly PaymentStatus[];
