import { describe, expect, it } from "vitest";
import { hasLiveSales, resolveCalendarTabs } from "./sales-calendar-tabs";

const ids = (tabs: ReturnType<typeof resolveCalendarTabs>) => tabs.map((t) => t.id);

describe("resolveCalendarTabs", () => {
  it("hides Live while nothing is live", () => {
    expect(ids(resolveCalendarTabs({ live: 0, upcoming: 2, results: 8 }, "upcoming"))).toEqual([
      "upcoming",
      "results",
    ]);
  });

  it("leads with Live when something is live", () => {
    expect(ids(resolveCalendarTabs({ live: 1, upcoming: 2 }, "live"))).toEqual([
      "live",
      "upcoming",
      "results",
    ]);
  });

  it("keeps Live for a shared link to it, even when nothing is live", () => {
    expect(ids(resolveCalendarTabs({ live: 0 }, "live"))).toContain("live");
  });

  it("hides Live when its count could not be read", () => {
    expect(ids(resolveCalendarTabs({ upcoming: 1 }, "upcoming"))).not.toContain("live");
  });

  it("carries a count only above zero", () => {
    const tabs = resolveCalendarTabs({ live: 0, upcoming: 0, results: 8 }, "live");
    expect(tabs.find((t) => t.id === "live")).not.toHaveProperty("count");
    expect(tabs.find((t) => t.id === "upcoming")).not.toHaveProperty("count");
    expect(tabs.find((t) => t.id === "results")?.count).toBe(8);
  });

  it("names the tabs in sentence case", () => {
    expect(resolveCalendarTabs({ live: 1 }, "live").map((t) => t.label)).toEqual([
      "Live now",
      "Upcoming",
      "Results",
    ]);
  });
});

describe("hasLiveSales", () => {
  it("is true only for a positive live count", () => {
    expect(hasLiveSales({ live: 1 })).toBe(true);
    expect(hasLiveSales({ live: 0 })).toBe(false);
    expect(hasLiveSales({})).toBe(false);
  });
});
