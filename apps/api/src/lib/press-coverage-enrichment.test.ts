import type { SalePressRef } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { enrichPressCoverageWithOpenGraphImages } from "./press-coverage-enrichment.js";

describe("enrichPressCoverageWithOpenGraphImages", () => {
  it("preserves existing imageUrl for unchanged article URLs", async () => {
    const fetchImage = vi.fn();
    const previous: SalePressRef[] = [
      {
        url: "https://example.com/a",
        headline: "A",
        outletName: "O",
        imageUrl: "https://cdn.example.com/a.jpg",
      },
    ];
    const next: SalePressRef[] = [{ url: "https://example.com/a", headline: "A", outletName: "O" }];

    const result = await enrichPressCoverageWithOpenGraphImages(previous, next, fetchImage);

    expect(result[0]?.imageUrl).toBe("https://cdn.example.com/a.jpg");
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("fetches og:image for new items", async () => {
    const fetchImage = vi.fn().mockResolvedValue("https://cdn.example.com/new.jpg");

    const result = await enrichPressCoverageWithOpenGraphImages(
      undefined,
      [{ url: "https://example.com/new", headline: "N", outletName: "O" }],
      fetchImage,
    );

    expect(result[0]?.imageUrl).toBe("https://cdn.example.com/new.jpg");
    expect(fetchImage).toHaveBeenCalledWith("https://example.com/new");
  });
});
