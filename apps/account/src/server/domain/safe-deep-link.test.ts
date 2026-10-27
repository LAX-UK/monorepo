import { describe, expect, it } from "vitest";
import { safeDeepLink } from "./safe-deep-link";

describe("safeDeepLink", () => {
  it("keeps https links and local http links", () => {
    expect(safeDeepLink("https://lax.bid/purchases#payment-history")).toBe(
      "https://lax.bid/purchases#payment-history",
    );
    expect(safeDeepLink("http://localhost:3000/lot/1")).toBe("http://localhost:3000/lot/1");
  });

  it.each([
    ["a script URL", "javascript:alert(1)"],
    ["a data URL", "data:text/html,hi"],
    ["plain http on a public host", "http://lax.bid/x"],
    ["credentials in the URL", "https://user:pass@lax.bid/x"],
    ["a relative path", "/purchases#payment-history"],
    ["nothing", undefined],
  ])("drops %s", (_name, href) => {
    expect(safeDeepLink(href)).toBeNull();
  });
});
