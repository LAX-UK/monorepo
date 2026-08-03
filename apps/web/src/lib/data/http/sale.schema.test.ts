import { describe, expect, it } from "vitest";
import { parseSaleSchema } from "./sale.schema";

const basePayload = {
  id: "sale-1",
  title: "Evening sale",
  coverImages: [],
  categoryIds: [],
  deliveryMode: "online",
  status: "scheduled",
  startTime: "2030-01-01T10:00:00.000Z",
  endTime: "2030-01-02T10:00:00.000Z",
  createdAt: "2029-12-01T10:00:00.000Z",
  updatedAt: "2029-12-01T10:00:00.000Z",
};

describe("parseSaleSchema hero compatibility", () => {
  it.each([undefined, null, "legacy-value"])(
    "defaults external heroPresentation %s to cover",
    (heroPresentation) => {
      const sale = parseSaleSchema({ ...basePayload, heroPresentation });

      expect(sale.heroPresentation).toBe("cover");
      expect(sale.heroVideoUrl).toBeNull();
    },
  );

  it("preserves an external video hero payload", () => {
    const sale = parseSaleSchema({
      ...basePayload,
      heroPresentation: "video",
      heroVideoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    });

    expect(sale.heroPresentation).toBe("video");
    expect(sale.heroVideoUrl).toBe("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  });
});
