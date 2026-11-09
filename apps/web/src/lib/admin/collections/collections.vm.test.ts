import type { StaffCollectionException } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  collectionsHref,
  describeException,
  formatExceptionDays,
  formatVisitSlot,
  hoursOfDay,
  parseCollectionTab,
  weekdayLabel,
} from "./collections.vm";

const closure = (over: Partial<StaffCollectionException> = {}): StaffCollectionException => ({
  id: "e1",
  kind: "closure",
  startsOn: "2026-12-25",
  endsOn: "2026-12-25",
  opensLocal: null,
  closesLocal: null,
  source: "bank_holiday",
  reason: null,
  saleTitle: null,
  canRemove: true,
  ...over,
});

describe("collections view model", () => {
  it("reads the tab from the address, defaulting to hours", () => {
    expect(parseCollectionTab("closures")).toBe("closures");
    expect(parseCollectionTab("anything")).toBe("hours");
    expect(parseCollectionTab(undefined)).toBe("hours");
    expect(collectionsHref("hours")).toBe("/admin/collections");
    expect(collectionsHref("hours", "v1")).toBe("/admin/collections/v1");
    expect(collectionsHref("closures", "v1")).toBe("/admin/collections/v1?tab=closures");
  });

  it("names weekdays and orders a day's ranges", () => {
    expect(weekdayLabel(1)).toBe("Monday");
    expect(weekdayLabel(7)).toBe("Sunday");
    const hours = [
      { weekday: 2, opensLocal: "14:00", closesLocal: "18:00" },
      { weekday: 2, opensLocal: "10:00", closesLocal: "13:00" },
      { weekday: 3, opensLocal: "10:00", closesLocal: "18:00" },
    ];
    expect(hoursOfDay(hours, 2).map((r) => r.opensLocal)).toEqual(["10:00", "14:00"]);
  });

  it("says what a closure or an opening does", () => {
    expect(describeException(closure())).toBe("Closed all day");
    expect(describeException(closure({ opensLocal: "13:00", closesLocal: "14:00" }))).toBe(
      "Closed 13:00 to 14:00",
    );
    expect(describeException(closure({ kind: "extra_opening" }))).toBe("Open the regular hours");
    expect(
      describeException(
        closure({ kind: "extra_opening", opensLocal: "10:00", closesLocal: "16:00" }),
      ),
    ).toBe("Open 10:00 to 16:00");
  });

  const NOW = new Date("2026-11-09T12:00:00Z");

  it("writes the days in the one date style, with the year only when it isn't this one", () => {
    expect(formatExceptionDays(closure(), NOW)).toBe("Fri 25 Dec");
    expect(formatExceptionDays(closure({ endsOn: "2026-12-27" }), NOW)).toBe(
      "Fri 25 Dec to Sun 27 Dec",
    );
    expect(
      formatExceptionDays(closure({ startsOn: "2027-01-01", endsOn: "2027-01-01" }), NOW),
    ).toBe("Fri 1 Jan 2027");
  });

  it("writes a visit in London time, winter and summer", () => {
    expect(formatVisitSlot("2026-11-13T17:30:00Z", "2026-11-13T18:00:00Z", NOW)).toBe(
      "Fri 13 Nov, 17:30 GMT to 18:00",
    );
    expect(formatVisitSlot("2026-07-10T09:00:00Z", "2026-07-10T09:30:00Z", NOW)).toBe(
      "Fri 10 Jul, 10:00 BST to 10:30",
    );
  });
});
