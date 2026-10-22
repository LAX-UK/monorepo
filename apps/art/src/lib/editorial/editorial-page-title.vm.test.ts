import { describe, expect, it } from "vitest";
import {
  exhibitionHasEnded,
  exhibitionMetaLine,
  exhibitionSectionTabs,
  openingHoursLine,
  venueMetaLines,
} from "./editorial-page-title.vm.js";

describe("exhibitionHasEnded", () => {
  it("keeps the end date itself open and closes the day after", () => {
    expect(exhibitionHasEnded("2026-08-27", new Date("2026-08-27T12:00:00Z"))).toBe(false);
    expect(exhibitionHasEnded("2026-08-27", new Date("2026-08-28T12:00:00Z"))).toBe(true);
    expect(exhibitionHasEnded("2026-09-01", new Date("2026-08-28T12:00:00Z"))).toBe(false);
  });

  it("switches at London midnight in summer (BST, UTC+1)", () => {
    expect(exhibitionHasEnded("2026-08-27", new Date("2026-08-27T22:59:00Z"))).toBe(false);
    expect(exhibitionHasEnded("2026-08-27", new Date("2026-08-27T23:00:00Z"))).toBe(true);
  });

  it("switches at UTC midnight in winter (GMT)", () => {
    expect(exhibitionHasEnded("2026-12-10", new Date("2026-12-10T23:59:00Z"))).toBe(false);
    expect(exhibitionHasEnded("2026-12-10", new Date("2026-12-11T00:00:00Z"))).toBe(true);
  });

  it("is false when the end date is missing or malformed", () => {
    const now = new Date("2026-08-28T09:00:00Z");
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
  const none = { overview: false, works: false, artists: false, press: false };

  it("lists only the sections that render, in page order", () => {
    expect(
      exhibitionSectionTabs({ overview: true, works: true, artists: true, press: true }),
    ).toEqual([
      { id: "overview", label: "Overview" },
      { id: "works", label: "Works" },
      { id: "featured-artists", label: "Featured artists" },
      { id: "press", label: "Press" },
    ]);
    expect(exhibitionSectionTabs({ ...none, works: true, press: true })).toEqual([
      { id: "works", label: "Works" },
      { id: "press", label: "Press" },
    ]);
  });

  it("drops the bar when fewer than two sections render", () => {
    expect(exhibitionSectionTabs({ ...none, overview: true })).toEqual([]);
    expect(exhibitionSectionTabs(none)).toEqual([]);
  });
});
