import { describe, expect, it } from "vitest";
import { isPgUniqueViolation } from "../lib/pg-errors.js";

/**
 * Webhook transition invariants are enforced in `completeShopCheckoutSession` /
 * `expireShopCheckoutSession` (row locks, pending_payment, per-edition reserved
 * checks, processed-event deduplication). PostgreSQL integration coverage lives
 * in `drizzle-commerce.integration.test.ts` when `DATABASE_URL_SHOP` is set.
 */
describe("commerce webhook helpers", () => {
  it("treats idempotency races as unique violations for checkout retry", () => {
    expect(isPgUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });
});
