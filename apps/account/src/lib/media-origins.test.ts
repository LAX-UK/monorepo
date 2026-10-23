import { describe, expect, it } from "vitest";
import { DEFAULT_MEDIA_ORIGINS, parseMediaOrigins, safeImageUrl } from "./media-origins";

describe("parseMediaOrigins", () => {
  it("collects configured and published media origins, de-duplicated", () => {
    expect(
      parseMediaOrigins({
        LAX_MEDIA_ORIGINS: "https://cdn.lax.bid/, https://img.lax.art",
        NEXT_PUBLIC_MEDIA_BASE_URL: "https://cdn.lax.bid/media",
        SHOP_MEDIA_PUBLIC_BASE_URL: "https://shop-cdn.lax.art",
      }),
    ).toEqual(["https://cdn.lax.bid", "https://img.lax.art", "https://shop-cdn.lax.art"]);
  });

  it("ignores plain http on public hosts, credentials and junk", () => {
    expect(
      parseMediaOrigins({
        LAX_MEDIA_ORIGINS:
          "http://cdn.lax.bid,https://u:p@x.example,nonsense,http://localhost:9000",
      }),
    ).toEqual(["http://localhost:9000"]);
  });

  it("falls back to the test media host when nothing is configured", () => {
    expect(parseMediaOrigins({})).toEqual([...DEFAULT_MEDIA_ORIGINS]);
  });
});

describe("safeImageUrl", () => {
  const allowed = ["https://cdn.lax.bid"];

  it("keeps an image on an allowed origin", () => {
    expect(safeImageUrl("https://cdn.lax.bid/a.jpg", allowed)).toBe("https://cdn.lax.bid/a.jpg");
  });

  it.each([
    ["another origin", "https://evil.example/a.jpg"],
    ["a look-alike host", "https://cdn.lax.bid.evil.example/a.jpg"],
    ["a script URL", "javascript:alert(1)"],
    ["nothing", null],
  ])("drops %s", (_name, src) => {
    expect(safeImageUrl(src, allowed)).toBeNull();
  });
});
