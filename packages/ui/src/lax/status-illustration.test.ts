import { describe, expect, it } from "vitest";
import { resolveStatusIllustration } from "./status-illustration.js";

describe("resolveStatusIllustration", () => {
  it("maps the older names to the LAX drawings", () => {
    expect(resolveStatusIllustration("gallery")).toBe("frame");
    expect(resolveStatusIllustration("search-remove")).toBe("search");
    expect(resolveStatusIllustration("bag")).toBe("parcel");
    expect(resolveStatusIllustration("alert")).toBe("askew");
  });

  it("passes the set's own names through", () => {
    expect(resolveStatusIllustration("ticket")).toBe("ticket");
    expect(resolveStatusIllustration("lock")).toBe("lock");
  });
});
