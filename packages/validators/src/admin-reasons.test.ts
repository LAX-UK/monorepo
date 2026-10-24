import { describe, expect, it } from "vitest";
import { ADMIN_REFUND_BUYER_REASON_MIN, adminRefundBuyerBodySchema } from "./payout.js";
import {
  ADMIN_SUSPEND_REASON_MAX,
  ADMIN_SUSPEND_REASON_MIN,
  adminBulkUsersBodySchema,
  adminSuspendBodySchema,
} from "./user.js";

const REASON = "Repeated chargebacks and a failed identity check.";
const IDS = ["user-1", "user-2"];

describe("adminSuspendBodySchema", () => {
  it("requires a reason and trims it", () => {
    expect(adminSuspendBodySchema.parse({ reason: `  ${REASON}  ` })).toEqual({ reason: REASON });
  });

  it.each([
    ["missing", {}],
    ["blank", { reason: "      " }],
    ["too short", { reason: "x".repeat(ADMIN_SUSPEND_REASON_MIN - 1) }],
    ["too long", { reason: "x".repeat(ADMIN_SUSPEND_REASON_MAX + 1) }],
  ])("rejects a reason that is %s", (_label, body) => {
    expect(adminSuspendBodySchema.safeParse(body).success).toBe(false);
  });

  it("accepts the minimum and the maximum", () => {
    expect(
      adminSuspendBodySchema.safeParse({ reason: "x".repeat(ADMIN_SUSPEND_REASON_MIN) }).success,
    ).toBe(true);
    expect(
      adminSuspendBodySchema.safeParse({ reason: "x".repeat(ADMIN_SUSPEND_REASON_MAX) }).success,
    ).toBe(true);
  });
});

describe("adminBulkUsersBodySchema", () => {
  it("requires a reason to suspend", () => {
    expect(adminBulkUsersBodySchema.safeParse({ ids: IDS, op: "suspend" }).success).toBe(false);
    expect(
      adminBulkUsersBodySchema.safeParse({ ids: IDS, op: "suspend", reason: "spam" }).success,
    ).toBe(false);
    expect(
      adminBulkUsersBodySchema.safeParse({ ids: IDS, op: "suspend", reason: REASON }).success,
    ).toBe(true);
  });

  it("does not need a reason to restore", () => {
    expect(adminBulkUsersBodySchema.safeParse({ ids: IDS, op: "unsuspend" }).success).toBe(true);
  });

  it("still limits the batch size", () => {
    const ids = Array.from({ length: 51 }, (_, i) => `user-${i}`);
    expect(adminBulkUsersBodySchema.safeParse({ ids, op: "unsuspend" }).success).toBe(false);
    expect(adminBulkUsersBodySchema.safeParse({ ids: [], op: "unsuspend" }).success).toBe(false);
  });
});

describe("adminRefundBuyerBodySchema", () => {
  it("requires a reason", () => {
    expect(adminRefundBuyerBodySchema.parse({ reason: ` ${REASON} ` })).toEqual({ reason: REASON });
    expect(adminRefundBuyerBodySchema.safeParse({}).success).toBe(false);
    expect(
      adminRefundBuyerBodySchema.safeParse({
        reason: "x".repeat(ADMIN_REFUND_BUYER_REASON_MIN - 1),
      }).success,
    ).toBe(false);
    expect(adminRefundBuyerBodySchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
  });
});
