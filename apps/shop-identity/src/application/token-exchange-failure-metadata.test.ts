import { IdentityRejectedError, IdentityUnavailableError } from "@auction/identity-rp";
import { describe, expect, it } from "vitest";
import { describeTokenExchangeFailure } from "./token-exchange-failure-metadata.js";

describe("describeTokenExchangeFailure", () => {
  it("classifies OAuth rejections without leaking secrets", () => {
    const metadata = describeTokenExchangeFailure(
      new IdentityRejectedError(400, "bad grant", "invalid_grant"),
    );
    expect(metadata).toEqual({
      tokenExchangeFailureClass: "rejected",
      oauthError: "invalid_grant",
    });
  });

  it("classifies unavailable token endpoint failures", () => {
    expect(describeTokenExchangeFailure(new IdentityUnavailableError("down"))).toEqual({
      tokenExchangeFailureClass: "unavailable",
    });
  });
});
