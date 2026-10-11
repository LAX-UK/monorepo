import { describe, expect, it } from "vitest";
import { assertConnectUrlAllowed } from "./connect-return-url.js";

describe("assertConnectUrlAllowed", () => {
  it("allows same-origin URLs", () => {
    expect(() =>
      assertConnectUrlAllowed("https://shop.lax.art/account/payouts", "https://shop.lax.art"),
    ).not.toThrow();
  });

  it("rejects foreign origins", () => {
    expect(() =>
      assertConnectUrlAllowed("https://evil.example/return", "https://shop.lax.art"),
    ).toThrow(/connect_url_origin_not_allowed/);
  });

  it("fail-closed when origin not configured", () => {
    expect(() =>
      assertConnectUrlAllowed("https://shop.lax.art/return", undefined, { failClosed: true }),
    ).toThrow(/connect_url_origin_not_configured/);
  });
});
