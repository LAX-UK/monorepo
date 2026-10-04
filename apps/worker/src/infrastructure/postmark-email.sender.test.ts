import { describe, expect, it } from "vitest";
import { postmarkMetadataUnsubscribeToken } from "./postmark-email.sender.js";

describe("postmarkMetadataUnsubscribeToken", () => {
  it("returns the token query param when within Postmark metadata limits", () => {
    expect(postmarkMetadataUnsubscribeToken("https://lax.bid/unsubscribe?t=short-token")).toBe(
      "short-token",
    );
  });

  it("omits tokens longer than 80 characters", () => {
    const longToken = "x".repeat(81);
    expect(
      postmarkMetadataUnsubscribeToken(`https://lax.bid/unsubscribe?t=${longToken}`),
    ).toBeNull();
  });
});
