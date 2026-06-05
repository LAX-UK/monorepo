import { describe, expect, it } from "vitest";
import {
  parseStripeConnectActionErrorFromBody,
  readStripeConnectApiJson,
} from "./parse-stripe-connect-action-error";

describe("parseStripeConnectActionErrorFromBody", () => {
  it("prefers errorCode then code then error string", () => {
    expect(
      parseStripeConnectActionErrorFromBody(
        { error: "Internal server error", code: "stripe_platform_profile_incomplete" },
        "stripe_connect_failed",
      ),
    ).toBe("stripe_platform_profile_incomplete");
  });

  it("returns fallback when body is empty", () => {
    expect(parseStripeConnectActionErrorFromBody({}, "stripe_connect_failed")).toBe(
      "stripe_connect_failed",
    );
  });
});

describe("readStripeConnectApiJson", () => {
  it("returns empty object for non-JSON responses", async () => {
    const res = new Response("<html>gateway error</html>", { status: 502 });
    await expect(readStripeConnectApiJson(res)).resolves.toEqual({});
  });
});
