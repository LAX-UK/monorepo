import { describe, expect, it } from "vitest";
import { UNKNOWN_SCOPE_DESCRIPTION, describeHostedScopes } from "./scopes.js";

describe("describeHostedScopes", () => {
  it("describes each known scope in plain words", () => {
    expect(
      describeHostedScopes(["openid", "profile", "email", "offline_access", "shop.admin"]),
    ).toEqual([
      "Confirm it's you",
      "See your name",
      "See your email address",
      "Keep you signed in",
      "Use LAX Admin",
    ]);
  });

  it("never shows a raw scope string and shows the generic line once", () => {
    const lines = describeHostedScopes([
      "bid.write",
      "<img onerror=x>",
      "__proto__",
      "constructor",
    ]);
    expect(lines).toEqual([UNKNOWN_SCOPE_DESCRIPTION]);
  });
});
