import { describe, expect, it } from "vitest";
import { englishOnlyAdminLotAuctionTypeViolation } from "./english-auction-policy.js";

describe("englishOnlyAdminLotAuctionTypeViolation", () => {
  it("allows everything when disabled", () => {
    expect(
      englishOnlyAdminLotAuctionTypeViolation({
        enabled: false,
        existing: "english",
        requested: "dutch",
      }),
    ).toBeNull();
  });

  it("blocks new non-English types", () => {
    const msg = englishOnlyAdminLotAuctionTypeViolation({
      enabled: true,
      requested: "dutch",
    });
    expect(msg).toBeTruthy();
  });

  it("allows English", () => {
    expect(
      englishOnlyAdminLotAuctionTypeViolation({
        enabled: true,
        requested: "english",
      }),
    ).toBeNull();
  });

  it("allows keeping an existing legacy type", () => {
    expect(
      englishOnlyAdminLotAuctionTypeViolation({
        enabled: true,
        existing: "dutch",
        requested: "dutch",
      }),
    ).toBeNull();
  });

  it("blocks lateral change between non-English types", () => {
    expect(
      englishOnlyAdminLotAuctionTypeViolation({
        enabled: true,
        existing: "dutch",
        requested: "sealed",
      }),
    ).toBeTruthy();
  });

  it("blocks switching English to another type", () => {
    expect(
      englishOnlyAdminLotAuctionTypeViolation({
        enabled: true,
        existing: "english",
        requested: "dutch",
      }),
    ).toBeTruthy();
  });

  it("allows migrating legacy to English", () => {
    expect(
      englishOnlyAdminLotAuctionTypeViolation({
        enabled: true,
        existing: "dutch",
        requested: "english",
      }),
    ).toBeNull();
  });
});
