import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { describe, expect, it } from "vitest";
import { shouldSuppressConnectPendingEntityBanner } from "./should-suppress-connect-pending-entity-banner";

describe("shouldSuppressConnectPendingEntityBanner", () => {
  it("suppresses on payout setup route", () => {
    expect(shouldSuppressConnectPendingEntityBanner(DASHBOARD_ROUTES.sellerConnect)).toBe(true);
  });

  it("does not suppress on payouts list", () => {
    expect(shouldSuppressConnectPendingEntityBanner(DASHBOARD_ROUTES.sellerPayouts)).toBe(false);
  });
});
