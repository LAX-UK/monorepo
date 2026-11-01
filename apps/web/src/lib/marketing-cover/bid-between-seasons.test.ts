import { describe, expect, it } from "vitest";
import { seasonRows, toBidBetweenSeasonsSlide } from "./bid-between-seasons";

const now = new Date("2026-11-01T15:25:00Z");
const deadline = new Date("2026-12-04T17:00:00Z");
const feb = { title: "Modern British", startsAt: new Date("2027-02-16T19:00:00Z") };
const mar = { title: "Works on paper", startsAt: new Date("2027-03-10T19:00:00Z") };

describe("seasonRows", () => {
  it("names the deadline, then the next sales by the month they open", () => {
    expect(seasonRows({ consignmentDeadline: deadline, nextSales: [mar, feb], now })).toEqual([
      { label: "Consign by", value: "Fri 4 Dec" },
      { label: "February", value: "Modern British" },
      { label: "March", value: "Works on paper" },
    ]);
  });

  it("shows two sales at most", () => {
    const apr = { title: "Prints", startsAt: new Date("2027-04-10T19:00:00Z") };
    const rows = seasonRows({ consignmentDeadline: null, nextSales: [apr, mar, feb], now });
    expect(rows?.map((row) => row.label)).toEqual(["February", "March"]);
  });

  it("leaves out a passed deadline and an undated or past sale", () => {
    const rows = seasonRows({
      consignmentDeadline: new Date("2026-10-01T00:00:00Z"),
      nextSales: [
        { title: "Undated", startsAt: null },
        { title: "Gone", startsAt: new Date("2026-09-01T00:00:00Z") },
        feb,
      ],
      now,
    });
    expect(rows).toEqual([{ label: "February", value: "Modern British" }]);
  });

  it("is undefined when no dates are known", () => {
    expect(seasonRows({ consignmentDeadline: null, nextSales: [], now })).toBeUndefined();
  });
});

describe("toBidBetweenSeasonsSlide", () => {
  const vm = {
    title: "The winter season is in preparation",
    fact: "New sales are announced here first.",
    notifyAction: "/api/alerts",
    sellHref: "/sell",
    consignmentDeadline: deadline,
    nextSales: [feb],
    cover: undefined,
    lot: null,
  };

  it("puts the email field before the primary action and the season on the slide", () => {
    const slide = toBidBetweenSeasonsSlide(vm, now);
    expect(slide.alert).toEqual({ action: "/api/alerts", fieldLabel: "Your email address" });
    expect(slide.primary.label).toBe("Notify me");
    expect(slide.badge).toBeUndefined();
    expect(slide.seasons).toHaveLength(2);
    expect(slide.media).toEqual([]);
  });

  it("omits the season list when no dates are known", () => {
    const slide = toBidBetweenSeasonsSlide(
      { ...vm, consignmentDeadline: null, nextSales: [] },
      now,
    );
    expect("seasons" in slide).toBe(false);
  });
});
