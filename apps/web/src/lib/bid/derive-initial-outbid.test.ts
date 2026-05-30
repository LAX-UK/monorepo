import { describe, expect, it } from "vitest";
import { deriveInitialOutbid, deriveUserHasBid } from "./derive-initial-outbid";

describe("deriveInitialOutbid", () => {
  it("is true when user bid but is not leading on active lot", () => {
    expect(
      deriveInitialOutbid({
        lotStatus: "active",
        sessionUserId: "u1",
        leadingBidderId: "u2",
        userHasBid: true,
      }),
    ).toBe(true);
  });

  it("is false when user is leading", () => {
    expect(
      deriveInitialOutbid({
        lotStatus: "active",
        sessionUserId: "u1",
        leadingBidderId: "u1",
        userHasBid: true,
      }),
    ).toBe(false);
  });

  it("is false when lot is not active", () => {
    expect(
      deriveInitialOutbid({
        lotStatus: "ended",
        sessionUserId: "u1",
        leadingBidderId: "u2",
        userHasBid: true,
      }),
    ).toBe(false);
  });
});

describe("deriveUserHasBid", () => {
  it("detects user bids by bidderId or placedByUserId", () => {
    expect(deriveUserHasBid([{ bidderId: "u1", placedByUserId: null }], "u1")).toBe(true);
    expect(deriveUserHasBid([{ bidderId: null, placedByUserId: "u1" }], "u1")).toBe(true);
    expect(deriveUserHasBid([], "u1")).toBe(false);
  });
});
