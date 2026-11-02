import { describe, expect, it } from "vitest";
import { isMarketingPromptRoute } from "./route-eligibility";

describe("isMarketingPromptRoute", () => {
  it.each(["/", "/results", "/artists", "/buy", "/sales", "/search", "/artist/x", "/artists/x"])(
    "allows %s",
    (pathname) => {
      expect(isMarketingPromptRoute(pathname)).toBe(true);
    },
  );

  it.each(["/lot/example/lot-1", "/home", "/sell", "/login"])("excludes %s", (pathname) => {
    expect(isMarketingPromptRoute(pathname)).toBe(false);
  });
});
