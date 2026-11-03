import { describe, expect, it } from "vitest";
import { firstImageByArtworkId } from "./public-artwork-rows.js";

const resolve = (key: string | null | undefined) => (key ? `https://media.test/${key}` : null);

describe("firstImageByArtworkId", () => {
  it("keeps the first image of each work in the order given", () => {
    const covers = firstImageByArtworkId(
      [
        { artworkId: "a", mediaKey: "a-1.webp" },
        { artworkId: "a", mediaKey: "a-2.webp" },
        { artworkId: "b", mediaKey: "b-1.webp" },
      ],
      resolve,
    );

    expect(covers.get("a")?.url).toBe("https://media.test/a-1.webp");
    expect(covers.get("b")?.url).toBe("https://media.test/b-1.webp");
  });

  it("skips an image that does not resolve and takes the next one", () => {
    const covers = firstImageByArtworkId(
      [
        { artworkId: "a", mediaKey: "" },
        { artworkId: "a", mediaKey: "a-2.webp" },
      ],
      resolve,
    );

    expect(covers.get("a")?.url).toBe("https://media.test/a-2.webp");
  });

  it("returns nothing for a work with no images", () => {
    expect(firstImageByArtworkId([], resolve).size).toBe(0);
  });
});
