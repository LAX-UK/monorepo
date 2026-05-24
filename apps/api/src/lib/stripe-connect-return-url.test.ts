import { describe, expect, it } from "vitest";
import { assertConnectUrlAllowed } from "./stripe-connect-return-url.js";

describe("assertConnectUrlAllowed", () => {
  it("allows URLs on the trusted web origin", () => {
    expect(() =>
      assertConnectUrlAllowed(
        "https://app.example.com/dashboard/seller/connect",
        "https://app.example.com",
      ),
    ).not.toThrow();
  });

  it("rejects URLs on a different origin", () => {
    expect(() =>
      assertConnectUrlAllowed("https://evil.example.com/phish", "https://app.example.com"),
    ).toThrow("connect_url_origin_not_allowed");
  });
});
