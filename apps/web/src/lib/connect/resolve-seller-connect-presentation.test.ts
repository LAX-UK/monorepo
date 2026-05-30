import { describe, expect, it } from "vitest";
import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "./resolve-seller-connect-presentation";

const baseEntity = {
  status: "approved",
  stripeConnectAccountId: null,
  stripeConnectPayoutsEnabled: false,
  stripeConnectRequirementsCurrentlyDue: [] as string[],
  stripeConnectDisabledReason: null,
  isLaxManaged: false,
};

describe("resolveSellerConnectPresentation", () => {
  it("returns no banner when connect is not enforced", () => {
    const result = resolveSellerConnectPresentation({
      connectEnforced: false,
      entity: legalEntityToConnectFields(baseEntity),
    });
    expect(result.showBanner).toBe(false);
    expect(result.connectReady).toBe(true);
  });

  it("returns no banner when entity is null", () => {
    const result = resolveSellerConnectPresentation({
      connectEnforced: true,
      entity: null,
    });
    expect(result.showBanner).toBe(false);
  });

  it("returns no banner for LAX-managed inventory", () => {
    const result = resolveSellerConnectPresentation({
      connectEnforced: true,
      entity: legalEntityToConnectFields({ ...baseEntity, isLaxManaged: true }),
    });
    expect(result.showBanner).toBe(false);
    expect(result.connectReady).toBe(true);
    expect(result.gap?.stage).toBe("managed_by_lax");
  });

  it("shows banner when connect enforced and not ready", () => {
    const result = resolveSellerConnectPresentation({
      connectEnforced: true,
      entity: legalEntityToConnectFields(baseEntity),
    });
    expect(result.showBanner).toBe(true);
    expect(result.connectReady).toBe(false);
    expect(result.bannerCopy?.title).toBeTruthy();
    expect(result.gap?.stage).toBe("not_started");
  });

  it("shows banner for requirements_due with copy", () => {
    const result = resolveSellerConnectPresentation({
      connectEnforced: true,
      entity: legalEntityToConnectFields({
        ...baseEntity,
        stripeConnectAccountId: "acct_1",
        stripeConnectRequirementsCurrentlyDue: ["individual.verification.document"],
      }),
    });
    expect(result.showBanner).toBe(true);
    expect(result.gap?.stage).toBe("requirements_due");
    expect(result.bannerCopy?.title).toContain("payout");
  });

  it("returns no banner when seller connect is ready", () => {
    const result = resolveSellerConnectPresentation({
      connectEnforced: true,
      entity: legalEntityToConnectFields({
        ...baseEntity,
        stripeConnectAccountId: "acct_1",
        stripeConnectPayoutsEnabled: true,
      }),
    });
    expect(result.showBanner).toBe(false);
    expect(result.connectReady).toBe(true);
    expect(result.gap?.stage).toBe("ready");
  });
});
