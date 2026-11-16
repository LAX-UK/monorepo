import { describe, expect, it } from "vitest";
import { emailCoverUrl } from "./cover-image.js";

const site = "https://lax.bid";

describe("emailCoverUrl", () => {
  it("asks the site's image pipeline for a 640 pixel copy of a stored picture", () => {
    const url = new URL(
      emailCoverUrl({
        key: "uploads/sales/spring.jpg",
        mediaBaseUrl: "https://media.lax.bid/",
        siteOrigin: site,
      }) ?? "",
    );
    expect(url.origin + url.pathname).toBe("https://lax.bid/_next/image");
    expect(url.searchParams.get("url")).toBe("https://media.lax.bid/uploads/sales/spring.jpg");
    expect(url.searchParams.get("w")).toBe("640");
  });

  it("keeps an absolute address and gives none when the key cannot be placed", () => {
    expect(
      new URL(
        emailCoverUrl({
          key: "https://media.lax.bid/a.jpg",
          mediaBaseUrl: null,
          siteOrigin: site,
        }) ?? "",
      ).searchParams.get("url"),
    ).toBe("https://media.lax.bid/a.jpg");
    expect(emailCoverUrl({ key: "a.jpg", mediaBaseUrl: null, siteOrigin: site })).toBeNull();
    expect(emailCoverUrl({ key: " ", mediaBaseUrl: "https://m", siteOrigin: site })).toBeNull();
  });
});
