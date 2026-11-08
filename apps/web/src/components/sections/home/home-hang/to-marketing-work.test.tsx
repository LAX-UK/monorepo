import { describe, expect, it } from "vitest";
import { toMarketingWork } from "./to-marketing-work";

const work = {
  lotId: "lot-1",
  href: "/lot/harbour/lot-1",
  photo: {
    imageSrc: "https://lax-media.lon1.cdn.digitaloceanspaces.com/lot/a.jpg",
    aspect: 1.25,
    longSideCm: 90,
    sourceWidthPx: 1371,
    sourceHeightPx: 1100,
  },
  label: { eyebrow: "Artist", title: "Harbour" },
} as never;

describe("toMarketingWork", () => {
  it("names resized files, so a small work is not served the original", () => {
    const result = toMarketingWork(work);
    expect(result.imageSrcSet).toContain("/_next/image?url=");
    expect(result.imageSrcSet).toContain("w=256");
    // The wall works the width out per work, so none is claimed here.
    expect(result.imageSizes).toBeUndefined();
  });

  it("never names a file wider than the ladder's widest", () => {
    const widths = [...(toMarketingWork(work).imageSrcSet ?? "").matchAll(/&w=(\d+)&/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...widths)).toBe(1280);
  });
});
