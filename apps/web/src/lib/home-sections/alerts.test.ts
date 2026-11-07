import { buildAlerts } from "@/lib/home-sections/alerts";
import { describe, expect, it } from "vitest";

describe("buildAlerts", () => {
  it("keeps the first three distinct photographs", () => {
    const alerts = buildAlerts(["a.jpg", "a.jpg", "b.jpg", null, "c.jpg", "d.jpg"]);
    expect(alerts.thumbnails.map((t) => t.src)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  it("has no thumbnails when no recent work has a photograph", () => {
    expect(buildAlerts([null, undefined, ""]).thumbnails).toEqual([]);
  });
});
