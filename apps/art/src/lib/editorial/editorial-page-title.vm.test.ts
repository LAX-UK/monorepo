import { describe, expect, it } from "vitest";
import {
  exhibitionHasEnded,
  exhibitionMetaLine,
  exhibitionSectionTabs,
  openingHoursLine,
  venueMetaLines,
} from "./editorial-page-title.vm.js";

describe("exhibitionHasEnded", () => {
  const now = new Date("2026-08-28T09:00:00Z");

  it("is true only once the end date is before today (UTC)", () => {
    expect(exhibitionHasEnded("2026-08-27", now)).toBe(true);
    expect(exhibitionHasEnded("2026-08-28", now)).toBe(false);
    expect(exhibitionHasEnded("2026-09-01", now)).toBe(false);
  });

  it("is false when the end date is missing or malformed", () => {
    expect(exhibitionHasEnded(null, now)).toBe(false);
    expect(exhibitionHasEnded("27 August", now)).toBe(false);
  });
});

describe("exhibitionMetaLine", () => {
  it("joins kind and dates, or falls back to the kind", () => {
    expect(exhibitionMetaLine("Exhibition", "18 Aug – 27 Aug 2026")).toBe(
      "Exhibition · 18 Aug – 27 Aug 2026",
    );
    expect(exhibitionMetaLine("Event", null)).toBe("Event");
  });
});

describe("venue lines", () => {
  it("prefixes opening hours once and skips the label of plain-string hours", () => {
    expect(
      openingHoursLine([
        { label: "Tue – Sat", value: "10:00 – 18:00" },
        { label: "Sun", value: "12:00 – 17:00" },
      ]),
    ).toBe("Opening hours: Tue – Sat 10:00 – 18:00 · Sun 12:00 – 17:00");
    expect(openingHoursLine([{ label: "Opening hours", value: "Mon – Fri, 9am – 5pm" }])).toBe(
      "Opening hours: Mon – Fri, 9am – 5pm",
    );
    expect(openingHoursLine([])).toBeNull();
  });

  it("lists the address then hours, omitting unknowns", () => {
    expect(venueMetaLines("156 New Cavendish Street, W1W 6YW", [])).toEqual([
      "156 New Cavendish Street, W1W 6YW",
    ]);
    expect(venueMetaLines(null, [{ label: "Sat", value: "10 – 4" }])).toEqual([
      "Opening hours: Sat 10 – 4",
    ]);
  });
});

describe("exhibitionSectionTabs", () => {
  it("lists rendered sections and drops the bar when only one renders", () => {
    expect(exhibitionSectionTabs({ overview: true, installationViews: true })).toEqual([
      { id: "overview", label: "Overview" },
      { id: "installation-views", label: "Installation views" },
    ]);
    expect(exhibitionSectionTabs({ overview: true, installationViews: false })).toEqual([]);
  });
});
