import { describe, expect, it } from "vitest";
import { sanitizePageUrlForMarketing } from "./sanitize-page-url";

describe("sanitizePageUrlForMarketing", () => {
  it("removes sensitive query params and hash", () => {
    const out = sanitizePageUrlForMarketing(
      "https://lax.bid/reset?token=secret&lot=1#section",
    );
    expect(out).toBe("https://lax.bid/reset?lot=1");
  });

  it("returns undefined for invalid URLs", () => {
    expect(sanitizePageUrlForMarketing("not-a-url")).toBeUndefined();
  });
});
