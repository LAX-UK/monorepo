import { describe, expect, it } from "vitest";
import { biddingStanding } from "./bidding-standing";

describe("biddingStanding", () => {
  it("asks an unverified person to verify, then always offers a limit increase", () => {
    const [identity, limit] = biddingStanding(undefined);
    expect(identity).toMatchObject({
      title: "Verify your identity",
      action: { label: "Verify identity", href: "/verify-identity" },
    });
    expect(limit?.action?.href).toBe("/contact?intent=bidding-limit");
  });

  it("offers nothing to do once verified or while checking", () => {
    expect(biddingStanding("approved")[0]?.action).toBeNull();
    expect(biddingStanding("pending")[0]?.title).toBe("We're checking your identity");
  });
});
